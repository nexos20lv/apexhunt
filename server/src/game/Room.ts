import { GeoPoint, applySonarUncertainty, isInsideZone, SonarPing } from './geo.js';
import { PlayerRole, GameState } from '../schemas/ws.js';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  isHost: boolean;
  position?: GeoPoint;
  accuracy?: number;
  lastSeen: number;
  isOutSideZone?: boolean;
  secretCode?: string;
}

export interface RoomSettings {
  durationMinutes: number;
  headStartMinutes: number;
  pingIntervalSeconds: number;
  zoneCenter: GeoPoint;
  zoneRadiusMeters: number;
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
  private lastPingsResult: SonarPing[] = [];
  private simulatedTimeOffset: number = 0;

  // Perks
  private ghostModeActive: boolean = false;
  private decoyActive: boolean = false;

  constructor(code: string, settings?: Partial<RoomSettings>) {
    this.code = code.toUpperCase();

    this.settings = {
      durationMinutes: settings?.durationMinutes ?? 30,
      headStartMinutes: settings?.headStartMinutes ?? 0,
      pingIntervalSeconds: settings?.pingIntervalSeconds ?? 90,
      zoneCenter: settings?.zoneCenter ?? { lat: 48.8584, lng: 2.2945 },
      zoneRadiusMeters: settings?.zoneRadiusMeters ?? 1000,
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

    const player: Player = {
      id,
      name,
      role: defaultRole,
      isHost,
      lastSeen: this.now(),
      secretCode: defaultRole === 'runner' ? this.generateSecretCode() : undefined,
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
    this.settings = { ...this.settings, ...newSettings };
  }

  public startGame() {
    if (this.state !== 'lobby') return;

    for (const player of this.players.values()) {
      if (player.role === 'runner' && !player.secretCode) {
        player.secretCode = this.generateSecretCode();
      }
    }

    this.startTime = this.now();
    const headStartMs = this.settings.headStartMinutes * 60 * 1000;
    const durationMs = this.settings.durationMinutes * 60 * 1000;

    this.headStartEndTime = this.startTime + headStartMs;
    this.gameEndTime = this.startTime + durationMs;
    this.lastPingTime = this.headStartEndTime;

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
      this.addEvent('👻 Ghost Mode actif : Ping sonar masqué !', 'perk');
      return { isGhosted: true, pings: [], nextPingInSeconds: interval };
    }

    const pings: SonarPing[] = [];
    const uncertaintyMin = this.decoyActive ? 150 : 30;
    const uncertaintyMax = this.decoyActive ? 250 : 60;

    if (this.decoyActive) {
      this.addEvent('📡 Faux Leurre activé par un fuyard !', 'perk');
      this.decoyActive = false;
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
    capturedRunner.role = 'hunter';
    capturedRunner.secretCode = undefined;

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

  public usePerk(playerId: string, perk: 'ghost' | 'decoy'): { success: boolean; message: string } {
    const player = this.players.get(playerId);
    if (!player || player.role !== 'runner') {
      return { success: false, message: 'Seul un fuyard peut activer cet atout' };
    }

    if (perk === 'ghost') {
      this.ghostModeActive = true;
      this.addEvent(`${player.name} a activé Ghost Mode`, 'perk');
      return { success: true, message: 'Ghost Mode activé : le prochain ping sera brouillé !' };
    } else if (perk === 'decoy') {
      this.decoyActive = true;
      this.addEvent(`${player.name} a déployé un Leurre GPS`, 'perk');
      return { success: true, message: 'Leurre déployé : le prochain ping émettra un faux signal !' };
    }

    return { success: false, message: 'Atout inconnu' };
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
      this.addEvent('Fin de l’avance ! Les radars s’activent maintenant !', 'start');
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

  public getPublicState(requestingPlayerId?: string) {
    const requestingPlayer = requestingPlayerId
      ? this.players.get(requestingPlayerId)
      : undefined;

    const isRunner = requestingPlayer?.role === 'runner';

    const playerList = Array.from(this.players.values()).map((p) => {
      const showDirectPosition =
        (p.role === 'hunter' && requestingPlayer?.role === 'hunter') ||
        (p.role === 'runner' && isRunner) ||
        p.id === requestingPlayerId;

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
      lastPings: this.lastPingsResult,
      events: this.events.slice(-10),
      secretCode: isRunner ? requestingPlayer?.secretCode : undefined,
    };
  }
}
