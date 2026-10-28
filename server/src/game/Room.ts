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
  ping?: SonarPing;
  nextPingInSeconds: number;
}

export class GameRoom {
  public readonly code: string;
  public state: GameState = 'lobby';
  public secretCode: string;
  public settings: RoomSettings;
  public winner: 'runner' | 'hunters' | null = null;

  private players = new Map<string, Player>();
  private startTime: number = 0;
  private headStartEndTime: number = 0;
  private gameEndTime: number = 0;
  private lastPingTime: number = 0;
  private lastPingResult: SonarPing | null = null;
  private simulatedTimeOffset: number = 0;

  // Perks
  private ghostModeActive: boolean = false;
  private decoyActive: boolean = false;

  constructor(code: string, settings?: Partial<RoomSettings>) {
    this.code = code.toUpperCase();
    this.secretCode = Math.floor(1000 + Math.random() * 9000).toString();

    this.settings = {
      durationMinutes: settings?.durationMinutes ?? 30,
      headStartMinutes: settings?.headStartMinutes ?? 5,
      pingIntervalSeconds: settings?.pingIntervalSeconds ?? 90,
      zoneCenter: settings?.zoneCenter ?? { lat: 48.8584, lng: 2.2945 },
      zoneRadiusMeters: settings?.zoneRadiusMeters ?? 1000,
    };
  }

  private now(): number {
    return Date.now() + this.simulatedTimeOffset;
  }

  public advanceTime(ms: number) {
    this.simulatedTimeOffset += ms;
    this.tick();
  }

  public addPlayer(id: string, name: string, isHost = false): Player {
    const existing = this.players.get(id);
    if (existing) {
      existing.name = name;
      existing.lastSeen = this.now();
      return existing;
    }

    // Par défaut, le premier joueur (hôte) est runner, les autres hunters
    const defaultRole: PlayerRole =
      this.players.size === 0 ? 'runner' : 'hunter';

    const player: Player = {
      id,
      name,
      role: defaultRole,
      isHost,
      lastSeen: this.now(),
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
    }
  }

  public updatePlayerPosition(id: string, lat: number, lng: number, accuracy?: number) {
    const player = this.players.get(id);
    if (player) {
      player.position = { lat, lng };
      player.accuracy = accuracy;
      player.lastSeen = this.now();

      // Vérifie si le joueur est hors de la zone de jeu
      if (this.state === 'hunting' || this.state === 'head_start') {
        player.isOutSideZone = !isInsideZone(
          player.position,
          this.settings.zoneCenter,
          this.settings.zoneRadiusMeters
        );
      }
    }
  }

  public updateSettings(newSettings: Partial<RoomSettings>) {
    if (this.state !== 'lobby') return;
    this.settings = { ...this.settings, ...newSettings };
  }

  public startGame() {
    if (this.state !== 'lobby') return;

    this.startTime = this.now();
    const headStartMs = this.settings.headStartMinutes * 60 * 1000;
    const durationMs = this.settings.durationMinutes * 60 * 1000;

    this.headStartEndTime = this.startTime + headStartMs;
    this.gameEndTime = this.startTime + durationMs;
    this.lastPingTime = this.headStartEndTime;

    if (headStartMs > 0) {
      this.state = 'head_start';
    } else {
      this.state = 'hunting';
    }
  }

  public triggerSonarPing(): PingResult {
    const runner = this.getPlayers().find((p) => p.role === 'runner');
    const interval = this.settings.pingIntervalSeconds;

    if (!runner || !runner.position) {
      return { isGhosted: false, nextPingInSeconds: interval };
    }

    // Si Ghost Mode est activé
    if (this.ghostModeActive) {
      this.ghostModeActive = false; // Consommé
      return { isGhosted: true, nextPingInSeconds: interval };
    }

    // Si Leurre actif : décalage important
    const uncertaintyMin = this.decoyActive ? 150 : 30;
    const uncertaintyMax = this.decoyActive ? 250 : 60;
    this.decoyActive = false;

    const ping = applySonarUncertainty(
      runner.position,
      uncertaintyMin,
      uncertaintyMax
    );
    this.lastPingResult = ping;
    this.lastPingTime = this.now();

    return {
      isGhosted: false,
      ping,
      nextPingInSeconds: interval,
    };
  }

  public claimCapture(hunterId: string, enteredCode: string): { success: boolean; message: string } {
    if (this.state !== 'hunting') {
      return { success: false, message: 'La traque n’est pas active' };
    }

    const hunter = this.players.get(hunterId);
    if (!hunter || hunter.role !== 'hunter') {
      return { success: false, message: 'Seul un chasseur peut capturer le fuyard' };
    }

    if (enteredCode.trim() === this.secretCode) {
      this.state = 'game_over';
      this.winner = 'hunters';
      return { success: true, message: 'Fuyard capturé ! Les chasseurs l’emportent !' };
    }

    return { success: false, message: 'Code incorrect ! Le fuyard s’échappe !' };
  }

  public usePerk(playerId: string, perk: 'ghost' | 'decoy'): { success: boolean; message: string } {
    const player = this.players.get(playerId);
    if (!player || player.role !== 'runner') {
      return { success: false, message: 'Seul le fuyard peut activer cet atout' };
    }

    if (perk === 'ghost') {
      this.ghostModeActive = true;
      return { success: true, message: 'Ghost Mode activé : le prochain ping sera brouillé !' };
    } else if (perk === 'decoy') {
      this.decoyActive = true;
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

    // Transition head_start -> hunting
    if (this.state === 'head_start' && currentTime >= this.headStartEndTime) {
      this.state = 'hunting';
      stateChanged = true;
    }

    // Fin du temps imparti -> Victoire du runner
    if (this.state === 'hunting' && currentTime >= this.gameEndTime) {
      this.state = 'game_over';
      this.winner = 'runner';
      stateChanged = true;
      return { shouldPing: false, stateChanged };
    }

    // Vérification du ping sonar périodique
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
      // Les chasseurs voient les autres chasseurs en temps réel.
      // Mais ils ne voient JAMAIS la position directe du runner (seulement via le ping sonar).
      const showDirectPosition =
        p.role === 'hunter' || p.id === requestingPlayerId;

      return {
        id: p.id,
        name: p.name,
        role: p.role,
        isHost: p.isHost,
        isOutSideZone: p.isOutSideZone,
        position: showDirectPosition ? p.position : undefined,
      };
    });

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
        : 0;

    return {
      code: this.code,
      state: this.state,
      winner: this.winner,
      settings: this.settings,
      players: playerList,
      remainingTimeSeconds,
      headStartRemainingSeconds,
      nextPingInSeconds,
      lastPing: this.lastPingResult,
      // Seul le fuyard voit son code secret à 4 chiffres sur son écran
      secretCode: isRunner ? this.secretCode : undefined,
    };
  }
}
