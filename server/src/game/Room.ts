import { GeoPoint, applySonarUncertainty, isInsideZone, calculateDistance, SonarPing } from './geo.js';
import { PlayerRole, GameState } from '../schemas/ws.js';

export interface PlayerPerks {
  ghost: boolean; // 1 use max
  decoy: boolean; // 1 use max
  sonarFlash: boolean; // 1 use max (hunter)
  triangulation: boolean; // 1 use max (hunter)
}

export interface BreadcrumbPoint {
  lat: number;
  lng: number;
  t: number; // ms écoulées depuis startTime
  role: PlayerRole;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  initialRole: PlayerRole;
  isHost: boolean;
  position?: GeoPoint;
  accuracy?: number;
  lastSeen: number;
  isOutSideZone?: boolean;
  secretCode?: string;
  perks: PlayerPerks;
  distanceTraveledMeters: number;
  survivalSeconds: number;
  capturesCount: number;
  breadcrumbs: BreadcrumbPoint[];
}

export interface RoomSettings {
  durationMinutes: number;
  headStartMinutes: number;
  pingIntervalSeconds: number;
  zoneCenter: GeoPoint;
  zoneRadiusMeters: number;
  shrinkEnabled: boolean;
  shrinkIntervalMinutes: number;
  shrinkStepMeters: number;
  minZoneRadiusMeters: number;
}

export interface PingResult {
  isGhosted: boolean;
  pings: SonarPing[];
  nextPingInSeconds: number;
}

export interface TacticalEvent {
  id: string;
  time: string;
  message: string;
  type: 'start' | 'ping' | 'perk' | 'infected' | 'zone';
}

export class GameRoom {
  public readonly code: string;
  public state: GameState = 'lobby';
  public settings: RoomSettings;
  public winner: 'runner' | 'hunters' | null = null;
  public events: TacticalEvent[] = [];

  private players = new Map<string, Player>();
  private startTime: number = 0;
  private headStartEndTime: number = 0;
  private gameEndTime: number = 0;
  private lastPingTime: number = 0;
  private lastShrinkTime: number = 0;
  private lastPingsResult: SonarPing[] = [];
  private simulatedTimeOffset: number = 0;

  // Active temporary perk effects
  private ghostModeActive: boolean = false;
  private decoyActive: boolean = false;
  private triangulationActive: boolean = false;

  constructor(code: string, settings?: Partial<RoomSettings>) {
    this.code = code.toUpperCase();

    this.settings = {
      durationMinutes: settings?.durationMinutes ?? 30,
      headStartMinutes: settings?.headStartMinutes ?? 0,
      pingIntervalSeconds: settings?.pingIntervalSeconds ?? 90,
      zoneCenter: settings?.zoneCenter ?? { lat: 48.8584, lng: 2.2945 },
      zoneRadiusMeters: settings?.zoneRadiusMeters ?? 1000,
      shrinkEnabled: settings?.shrinkEnabled ?? false,
      shrinkIntervalMinutes: settings?.shrinkIntervalMinutes ?? 3,
      shrinkStepMeters: settings?.shrinkStepMeters ?? 100,
      minZoneRadiusMeters: settings?.minZoneRadiusMeters ?? 100,
    };
  }

  private generateSecretCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private now(): number {
    return Date.now() + this.simulatedTimeOffset;
  }

  public advanceTime(ms: number) {
    this.simulatedTimeOffset += ms;
    this.tick();
  }

  private addEvent(message: string, type: TacticalEvent['type']) {
    const d = new Date(this.now());
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    this.events.push({
      id: `evt_${Math.random().toString(36).substring(2, 9)}`,
      time,
      message,
      type,
    });
    if (this.events.length > 25) {
      this.events.shift();
    }
  }

  public addPlayer(id: string, name: string, isHost = false): Player {
    const existing = this.players.get(id);
    if (existing) {
      existing.name = name;
      existing.lastSeen = this.now();
      return existing;
    }

    const defaultRole: PlayerRole =
      this.players.size === 0 ? 'runner' : 'hunter';

    const angle = Math.random() * 2 * Math.PI;
    const distanceMeters = 25 + Math.random() * 50;
    const initialPosition: GeoPoint = {
      lat: this.settings.zoneCenter.lat + (distanceMeters * Math.cos(angle)) / 111111,
      lng:
        this.settings.zoneCenter.lng +
        (distanceMeters * Math.sin(angle)) /
          (111111 * Math.cos((this.settings.zoneCenter.lat * Math.PI) / 180)),
    };

    const player: Player = {
      id,
      name,
      role: defaultRole,
      initialRole: defaultRole,
      isHost,
      position: initialPosition,
      lastSeen: this.now(),
      secretCode: defaultRole === 'runner' ? this.generateSecretCode() : undefined,
      perks: {
        ghost: true,
        decoy: true,
        sonarFlash: true,
        triangulation: true,
      },
      distanceTraveledMeters: 0,
      survivalSeconds: 0,
      capturesCount: 0,
      breadcrumbs: [],
    };

    this.players.set(id, player);
    return player;
  }

  public removePlayer(id: string) {
    this.players.delete(id);
  }

  public getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  public getPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  public setPlayerRole(id: string, role: PlayerRole) {
    const player = this.players.get(id);
    if (player) {
      player.role = role;
      player.initialRole = role;
      if (role === 'runner' && !player.secretCode) {
        player.secretCode = this.generateSecretCode();
      } else if (role !== 'runner') {
        player.secretCode = undefined;
      }
    }
  }

  public updatePlayerPosition(id: string, lat: number, lng: number, accuracy?: number) {
    const player = this.players.get(id);
    if (player) {
      // Calcul de la distance parcourue et échantillonnage des coordonnées pour le replay
      if (player.position && (this.state === 'hunting' || this.state === 'head_start')) {
        const d = calculateDistance(player.position.lat, player.position.lng, lat, lng);
        // Filtrage des micro-oscillations (<2m) et des sauts aberrants (>300m)
        if (d >= 2 && d < 300) {
          player.distanceTraveledMeters += Math.round(d);
          const t = Math.max(0, this.now() - this.startTime);
          const lastBc = player.breadcrumbs[player.breadcrumbs.length - 1];
          if (!lastBc || t - lastBc.t >= 2500 || d >= 10) {
            player.breadcrumbs.push({ lat, lng, t, role: player.role });
            if (player.breadcrumbs.length > 500) {
              player.breadcrumbs = player.breadcrumbs.filter(
                (_, idx) => idx % 2 === 0 || idx === player.breadcrumbs.length - 1
              );
            }
          }
        }
      }

      player.position = { lat, lng };
      player.accuracy = accuracy;
      player.lastSeen = this.now();

      if (this.state === 'hunting' || this.state === 'head_start') {
        const wasOutside = player.isOutSideZone;
        player.isOutSideZone = !isInsideZone(
          player.position,
          this.settings.zoneCenter,
          this.settings.zoneRadiusMeters
        );

        if (!wasOutside && player.isOutSideZone) {
          this.addEvent(`⚠️ ${player.name} est sorti de la zone de jeu !`, 'zone');
        }
      }
    }
  }

  public updateSettings(newSettings: Partial<RoomSettings>) {
    if (this.state !== 'lobby') return;
    const oldCenter = this.settings.zoneCenter;
    this.settings = { ...this.settings, ...newSettings };

    // Si le centre de la zone change, repositionne les joueurs du lobby autour du nouveau centre
    if (
      newSettings.zoneCenter &&
      (Math.abs(newSettings.zoneCenter.lat - oldCenter.lat) > 0.0001 ||
        Math.abs(newSettings.zoneCenter.lng - oldCenter.lng) > 0.0001)
    ) {
      for (const player of this.players.values()) {
        const angle = Math.random() * 2 * Math.PI;
        const distanceMeters = 20 + Math.random() * 40;
        player.position = {
          lat: this.settings.zoneCenter.lat + (distanceMeters * Math.cos(angle)) / 111111,
          lng:
            this.settings.zoneCenter.lng +
            (distanceMeters * Math.sin(angle)) /
              (111111 * Math.cos((this.settings.zoneCenter.lat * Math.PI) / 180)),
        };
        player.isOutSideZone = false;
      }
    }
  }

  public startGame() {
    if (this.state !== 'lobby') return;

    for (const player of this.players.values()) {
      player.initialRole = player.role;
      player.distanceTraveledMeters = 0;
      player.survivalSeconds = 0;
      player.capturesCount = 0;
      player.breadcrumbs = player.position
        ? [{ lat: player.position.lat, lng: player.position.lng, t: 0, role: player.role }]
        : [];

      if (player.role === 'runner' && !player.secretCode) {
        player.secretCode = this.generateSecretCode();
      }
      // Réinitialise les bonus pour 1 utilisation
      player.perks = {
        ghost: true,
        decoy: true,
        sonarFlash: true,
        triangulation: true,
      };
    }

    this.startTime = this.now();
    const headStartMs = this.settings.headStartMinutes * 60 * 1000;
    const durationMs = this.settings.durationMinutes * 60 * 1000;

    this.headStartEndTime = this.startTime + headStartMs;
    this.gameEndTime = this.startTime + durationMs;
    this.lastPingTime = this.headStartEndTime;
    this.lastShrinkTime = this.headStartEndTime;

    if (headStartMs > 0) {
      this.state = 'head_start';
      this.addEvent(`Avance de ${this.settings.headStartMinutes} min accordée aux fuyards !`, 'start');
    } else {
      this.state = 'hunting';
      this.addEvent('La traque est lancée ! Que la chasse commence !', 'start');
    }
  }

  public triggerSonarPing(): PingResult {
    const activeRunners = this.getPlayers().filter((p) => p.role === 'runner');
    const interval = this.settings.pingIntervalSeconds;

    if (activeRunners.length === 0) {
      return { isGhosted: false, pings: [], nextPingInSeconds: interval };
    }

    if (this.ghostModeActive) {
      this.ghostModeActive = false;
      this.addEvent('👻 Ghost Mode actif : Ping sonar masqué pour les fuyards !', 'perk');
      return { isGhosted: true, pings: [], nextPingInSeconds: interval };
    }

    const pings: SonarPing[] = [];

    // Détermination de l'incertitude selon les bonus actifs
    let uncertaintyMin = 30;
    let uncertaintyMax = 60;

    if (this.decoyActive) {
      uncertaintyMin = 180;
      uncertaintyMax = 260;
      this.decoyActive = false;
      this.addEvent('📡 Faux Leurre activé par un fuyard !', 'perk');
    } else if (this.triangulationActive) {
      // Triangulation chasseur : précision chirurgicale 10-15m
      uncertaintyMin = 10;
      uncertaintyMax = 15;
      this.triangulationActive = false;
      this.addEvent('🎯 Triangulation appliquée : Ping haute précision (~12m) !', 'perk');
    }

    for (const runner of activeRunners) {
      if (runner.position) {
        const ping = applySonarUncertainty(
          runner.position,
          uncertaintyMin,
          uncertaintyMax
        );
        pings.push(ping);
      }
    }

    this.lastPingsResult = pings;
    this.lastPingTime = this.now();
    this.addEvent(`📡 Ping Sonar : ${pings.length} fuyard(s) détecté(s)`, 'ping');

    return {
      isGhosted: false,
      pings,
      nextPingInSeconds: interval,
    };
  }

  public claimCapture(
    hunterId: string,
    enteredCode: string
  ): { success: boolean; message: string; allCaptured: boolean; infectedPlayerName?: string } {
    if (this.state !== 'hunting') {
      return { success: false, message: 'La traque n’est pas active', allCaptured: false };
    }

    const hunter = this.players.get(hunterId);
    if (!hunter || hunter.role !== 'hunter') {
      return { success: false, message: 'Seul un chasseur peut capturer un fuyard', allCaptured: false };
    }

    const cleanCode = (enteredCode || '').trim();
    const capturedRunner = this.getPlayers().find(
      (p) => p.role === 'runner' && p.secretCode === cleanCode
    );

    if (!capturedRunner) {
      return { success: false, message: 'Code incorrect ! Aucun fuyard ne correspond.', allCaptured: false };
    }

    // Infection
    hunter.capturesCount += 1;
    capturedRunner.survivalSeconds = Math.max(0, Math.round((this.now() - this.headStartEndTime) / 1000));
    capturedRunner.role = 'hunter';
    capturedRunner.secretCode = undefined;
    // Le nouveau chasseur hérite de ses bonus chasseur
    capturedRunner.perks.sonarFlash = true;
    capturedRunner.perks.triangulation = true;

    if (capturedRunner.position) {
      capturedRunner.breadcrumbs.push({
        lat: capturedRunner.position.lat,
        lng: capturedRunner.position.lng,
        t: Math.max(0, this.now() - this.startTime),
        role: 'hunter',
      });
    }

    const remainingRunners = this.getPlayers().filter((p) => p.role === 'runner');

    if (remainingRunners.length === 0) {
      this.state = 'game_over';
      this.winner = 'hunters';
      this.addEvent(`🎯 ${hunter.name} a éliminé le dernier fuyard (${capturedRunner.name}) ! Victoire des Chasseurs !`, 'infected');
      return {
        success: true,
        message: `Dernier fuyard (${capturedRunner.name}) capturé ! Victoire totale des chasseurs !`,
        allCaptured: true,
        infectedPlayerName: capturedRunner.name,
      };
    }

    this.addEvent(`🧟 ${capturedRunner.name} a été infecté par ${hunter.name} et devient Chasseur !`, 'infected');

    return {
      success: true,
      message: `${capturedRunner.name} a été infecté et devient chasseur ! Reste ${remainingRunners.length} fuyard(s) !`,
      allCaptured: false,
      infectedPlayerName: capturedRunner.name,
    };
  }

  /**
   * Utilisation de bonus (1 seule fois par partie pour chaque joueur)
   */
  public usePerk(
    playerId: string,
    perk: 'ghost' | 'decoy' | 'sonar_flash' | 'triangulation'
  ): { success: boolean; message: string; pingTriggered?: boolean; pingResult?: PingResult } {
    if (this.state !== 'hunting') {
      return { success: false, message: 'La traque n’est pas encore active' };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, message: 'Joueur introuvable' };
    }

    // --- BONUS FUYARD ---
    if (perk === 'ghost' || perk === 'decoy') {
      if (player.role !== 'runner') {
        return { success: false, message: 'Ce bonus est réservé aux fuyards' };
      }

      if (perk === 'ghost') {
        if (!player.perks.ghost) {
          return { success: false, message: 'Ghost Mode déjà utilisé (1x par partie) !' };
        }
        player.perks.ghost = false;
        this.ghostModeActive = true;
        this.addEvent(`👻 ${player.name} a activé Ghost Mode (prochain ping masqué) !`, 'perk');
        return { success: true, message: 'Ghost Mode activé : le prochain ping sera masqué !' };
      } else {
        if (!player.perks.decoy) {
          return { success: false, message: 'Leurre déjà utilisé (1x par partie) !' };
        }
        player.perks.decoy = false;
        this.decoyActive = true;
        this.addEvent(`📡 ${player.name} a activé un Faux Leurre GPS !`, 'perk');
        return { success: true, message: 'Leurre déployé : le prochain ping enverra un faux signal !' };
      }
    }

    // --- BONUS CHASSEUR ---
    if (perk === 'sonar_flash' || perk === 'triangulation') {
      if (player.role !== 'hunter') {
        return { success: false, message: 'Ce bonus est réservé aux chasseurs' };
      }

      if (perk === 'sonar_flash') {
        if (!player.perks.sonarFlash) {
          return { success: false, message: 'Sonar Flash déjà utilisé (1x par partie) !' };
        }
        player.perks.sonarFlash = false;
        this.addEvent(`⚡ ${player.name} a forcé un Sonar Flash Immédiat !`, 'perk');
        const pingResult = this.triggerSonarPing();
        return {
          success: true,
          message: '⚡ Sonar Flash immédiat déclenché sur tous les fuyards !',
          pingTriggered: true,
          pingResult,
        };
      } else {
        if (!player.perks.triangulation) {
          return { success: false, message: 'Triangulation déjà utilisée (1x par partie) !' };
        }
        player.perks.triangulation = false;
        this.triangulationActive = true;
        this.addEvent(`🎯 ${player.name} a activé la Triangulation Précise (10m) !`, 'perk');
        return {
          success: true,
          message: 'Triangulation activée : le prochain ping sera ultra-précis (~10m) !',
        };
      }
    }

    return { success: false, message: 'Bonus inconnu' };
  }

  public tick(): {
    shouldPing: boolean;
    stateChanged: boolean;
    pingResult?: PingResult;
  } {
    if (this.state === 'lobby' || this.state === 'game_over') {
      return { shouldPing: false, stateChanged: false };
    }

    const currentTime = this.now();
    let stateChanged = false;

    if (this.state === 'head_start' && currentTime >= this.headStartEndTime) {
      this.state = 'hunting';
      stateChanged = true;
      this.lastShrinkTime = currentTime;
      this.addEvent('Fin de l’avance ! Les radars s’activent maintenant !', 'start');
    }

    if (this.state === 'hunting') {
      // Met à jour la survie des fuyards encore vivants
      const matchElapsed = Math.max(0, Math.round((currentTime - this.headStartEndTime) / 1000));
      for (const p of this.players.values()) {
        if (p.role === 'runner') {
          p.survivalSeconds = matchElapsed;
        }
      }

      // Zone Rétrécissante (Mode Battle Royale)
      if (this.settings.shrinkEnabled) {
        const shrinkIntervalMs = this.settings.shrinkIntervalMinutes * 60 * 1000;
        if (currentTime - this.lastShrinkTime >= shrinkIntervalMs) {
          const newRadius = Math.max(
            this.settings.minZoneRadiusMeters,
            this.settings.zoneRadiusMeters - this.settings.shrinkStepMeters
          );
          if (newRadius < this.settings.zoneRadiusMeters) {
            this.settings.zoneRadiusMeters = newRadius;
            this.lastShrinkTime = currentTime;
            stateChanged = true;
            this.addEvent(`⚠️ La zone se rétrécit ! Nouveau rayon : ${newRadius}m`, 'zone');
          }
        }
      }
    }

    if (this.state === 'hunting' && currentTime >= this.gameEndTime) {
      this.state = 'game_over';
      this.winner = 'runner';
      stateChanged = true;
      this.addEvent('Temps écoulé ! Les fuyards survivants remportent la traque !', 'start');
      return { shouldPing: false, stateChanged };
    }

    if (this.state === 'hunting') {
      const pingIntervalMs = this.settings.pingIntervalSeconds * 1000;
      if (currentTime - this.lastPingTime >= pingIntervalMs) {
        const pingResult = this.triggerSonarPing();
        return { shouldPing: true, stateChanged, pingResult };
      }
    }

    return { shouldPing: false, stateChanged };
  }

  public restartGame() {
    this.state = 'lobby';
    this.winner = null;
    this.events = [];
    this.lastPingsResult = [];
    this.startTime = 0;
    this.headStartEndTime = 0;
    this.gameEndTime = 0;
    this.lastShrinkTime = 0;
    for (const player of this.players.values()) {
      player.distanceTraveledMeters = 0;
      player.survivalSeconds = 0;
      player.capturesCount = 0;
      player.breadcrumbs = [];
      player.isOutSideZone = false;
      player.secretCode = player.role === 'runner' ? this.generateSecretCode() : undefined;
      player.perks = {
        ghost: true,
        decoy: true,
        sonarFlash: true,
        triangulation: true,
      };
    }
    this.addEvent('Nouvelle partie prête dans le lobby !', 'start');
  }

  public getPublicState(requestingPlayerId?: string) {
    const requestingPlayer = requestingPlayerId
      ? this.players.get(requestingPlayerId)
      : undefined;

    const isRunner = requestingPlayer?.role === 'runner';
    const isHunter = requestingPlayer?.role === 'hunter';

    const playerList = Array.from(this.players.values()).map((p) => {
      const showDirectPosition =
        p.id === requestingPlayerId ||
        (isHunter && p.role === 'hunter') ||
        (isRunner && p.role === 'runner') ||
        this.state === 'lobby' ||
        this.state === 'game_over';

      return {
        id: p.id,
        name: p.name,
        role: p.role,
        isHost: p.isHost,
        isOutSideZone: p.isOutSideZone,
        position: showDirectPosition ? p.position : undefined,
      };
    });

    const activeRunners = this.getPlayers().filter((p) => p.role === 'runner');
    const activeHunters = this.getPlayers().filter((p) => p.role === 'hunter');

    const currentTime = this.now();
    const remainingTimeSeconds =
      this.gameEndTime > currentTime
        ? Math.round((this.gameEndTime - currentTime) / 1000)
        : 0;

    const headStartRemainingSeconds =
      this.headStartEndTime > currentTime
        ? Math.round((this.headStartEndTime - currentTime) / 1000)
        : 0;

    const nextPingInSeconds =
      this.state === 'hunting'
        ? Math.max(
            0,
            Math.round(
              (this.settings.pingIntervalSeconds * 1000 -
                (currentTime - this.lastPingTime)) /
                1000
            )
          )
        : this.state === 'head_start'
        ? headStartRemainingSeconds
        : 0;

    const nextShrinkInSeconds =
      this.settings.shrinkEnabled && this.state === 'hunting'
        ? Math.max(
            0,
            Math.round(
              (this.settings.shrinkIntervalMinutes * 60 * 1000 -
                (currentTime - this.lastShrinkTime)) /
                1000
            )
          )
        : null;

    let gameStats = undefined;
    if (this.state === 'game_over') {
      const allPlayers = Array.from(this.players.values());
      const runners = allPlayers.filter((p) => p.initialRole === 'runner');
      const hunters = allPlayers.filter((p) => p.initialRole === 'hunter');

      let mvpRunner = undefined;
      if (runners.length > 0) {
        const sortedRunners = [...runners].sort((a, b) => b.survivalSeconds - a.survivalSeconds);
        mvpRunner = {
          id: sortedRunners[0].id,
          name: sortedRunners[0].name,
          survivalSeconds: sortedRunners[0].survivalSeconds,
        };
      }

      let mvpHunter = undefined;
      if (hunters.length > 0) {
        const sortedHunters = [...hunters].sort((a, b) => b.capturesCount - a.capturesCount);
        mvpHunter = {
          id: sortedHunters[0].id,
          name: sortedHunters[0].name,
          capturesCount: sortedHunters[0].capturesCount,
        };
      }

      const sortedByDist = [...allPlayers].sort(
        (a, b) => b.distanceTraveledMeters - a.distanceTraveledMeters
      );
      const topMarathonian =
        sortedByDist.length > 0
          ? {
              id: sortedByDist[0].id,
              name: sortedByDist[0].name,
              distanceMeters: sortedByDist[0].distanceTraveledMeters,
            }
          : undefined;

      const durationSeconds = Math.max(0, Math.round((this.now() - this.startTime) / 1000));

      gameStats = {
        winner: this.winner,
        durationSeconds,
        mvpRunner,
        mvpHunter,
        topMarathonian,
        playersStats: allPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          initialRole: p.initialRole || p.role,
          finalRole: p.role,
          distanceMeters: p.distanceTraveledMeters,
          survivalSeconds: p.survivalSeconds,
          capturesCount: p.capturesCount,
          breadcrumbs: p.breadcrumbs,
        })),
      };
    }

    return {
      code: this.code,
      state: this.state,
      winner: this.winner,
      settings: this.settings,
      players: playerList,
      activeRunnersCount: activeRunners.length,
      activeHuntersCount: activeHunters.length,
      remainingTimeSeconds,
      headStartRemainingSeconds,
      nextPingInSeconds,
      nextShrinkInSeconds,
      lastPings: this.lastPingsResult,
      events: this.events.slice(-10),
      myPerks: requestingPlayer?.perks,
      secretCode: isRunner ? requestingPlayer?.secretCode : undefined,
      gameStats,
    };
  }
}
