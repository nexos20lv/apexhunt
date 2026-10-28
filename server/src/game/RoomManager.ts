import { WebSocket, RawData } from 'ws';
import { GameRoom, RoomSettings } from './Room.js';
import { ClientMessage, ClientMessageSchema } from '../schemas/ws.js';

interface ConnectedClient {
  socket: WebSocket;
  playerId: string;
  roomCode?: string;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private clients = new Map<WebSocket, ConnectedClient>();
  private tickerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startGlobalTicker();
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 1, 0 pour éviter la confusion
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  public createRoom(settings?: Partial<RoomSettings>): GameRoom {
    const code = this.generateCode();
    const room = new GameRoom(code, settings);
    this.rooms.set(code, room);
    return room;
  }

  public getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public registerClient(socket: WebSocket, playerId: string) {
    this.clients.set(socket, { socket, playerId });
  }

  public unregisterClient(socket: WebSocket) {
    const client = this.clients.get(socket);
    if (client && client.roomCode) {
      const room = this.rooms.get(client.roomCode);
      if (room) {
        room.removePlayer(client.playerId);
        this.broadcastRoomState(room);

        // Si la room est vide, la nettoyer après 5 minutes
        if (room.getPlayers().length === 0) {
          setTimeout(() => {
            if (room.getPlayers().length === 0) {
              this.rooms.delete(room.code);
            }
          }, 5 * 60 * 1000);
        }
      }
    }
    this.clients.delete(socket);
  }

  public handleMessage(socket: WebSocket, rawData: RawData | string) {
    const client = this.clients.get(socket);
    if (!client) return;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawData.toString());
    } catch {
      this.sendError(socket, 'Format JSON invalide');
      return;
    }

    const validation = ClientMessageSchema.safeParse(parsedJson);
    if (!validation.success) {
      this.sendError(socket, 'Message non conforme au schéma', validation.error.flatten());
      return;
    }

    const msg: ClientMessage = validation.data;

    if (msg.type === 'join') {
      let room = this.getRoom(msg.roomCode);
      if (!room) {
        // Si l'hôte crée la room avec un code demandé ou si elle n'existe pas
        if (msg.isHost) {
          room = new GameRoom(msg.roomCode.toUpperCase());
          this.rooms.set(room.code, room);
        } else {
          this.sendError(socket, `Partie "${msg.roomCode}" introuvable`);
          return;
        }
      }

      client.roomCode = room.code;
      room.addPlayer(client.playerId, msg.playerName, !!msg.isHost);
      this.broadcastRoomState(room);
      return;
    }

    // Pour toute autre action, le joueur doit être dans une room
    if (!client.roomCode) {
      this.sendError(socket, 'Veuillez d’abord rejoindre une partie');
      return;
    }

    const room = this.rooms.get(client.roomCode);
    if (!room) {
      this.sendError(socket, 'Partie expirée ou inexistante');
      return;
    }

    switch (msg.type) {
      case 'set_role':
        room.setPlayerRole(client.playerId, msg.role);
        this.broadcastRoomState(room);
        break;

      case 'update_position':
        room.updatePlayerPosition(client.playerId, msg.lat, msg.lng, msg.accuracy);
        this.broadcastRoomState(room);
        break;

      case 'start_game': {
        const player = room.getPlayer(client.playerId);
        if (!player?.isHost) {
          this.sendError(socket, 'Seul l’hôte peut lancer la traque');
          return;
        }
        room.startGame();
        this.broadcastRoomState(room);
        break;
      }

      case 'claim_capture': {
        const result = room.claimCapture(client.playerId, msg.code);
        this.send(socket, {
          type: 'capture_feedback',
          success: result.success,
          message: result.message,
          allCaptured: result.allCaptured,
        });
        this.broadcastRoomState(
          room,
          result.success ? 'player_infected' : 'state_update',
          result
        );
        break;
      }

      case 'use_perk': {
        const result = room.usePerk(client.playerId, msg.perk);
        this.send(socket, {
          type: 'perk_feedback',
          success: result.success,
          message: result.message,
        });
        this.broadcastRoomState(room);
        break;
      }

      case 'update_settings': {
        const player = room.getPlayer(client.playerId);
        if (!player?.isHost) {
          this.sendError(socket, 'Seul l’hôte peut modifier les règles');
          return;
        }
        room.updateSettings(msg.settings);
        this.broadcastRoomState(room);
        break;
      }
    }
  }

  public broadcastRoomState(room: GameRoom, eventType: string = 'state_update', payload?: any) {
    for (const [socket, client] of this.clients.entries()) {
      if (client.roomCode === room.code && socket.readyState === WebSocket.OPEN) {
        const publicState = room.getPublicState(client.playerId);
        this.send(socket, {
          type: eventType,
          room: publicState,
          payload,
        });
      }
    }
  }

  private send(socket: WebSocket, data: any) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  private sendError(socket: WebSocket, error: string, details?: any) {
    this.send(socket, {
      type: 'error',
      error,
      details,
    });
  }

  private startGlobalTicker() {
    if (this.tickerInterval) return;

    this.tickerInterval = setInterval(() => {
      for (const room of this.rooms.values()) {
        const { shouldPing, stateChanged, pingResult } = room.tick();

        if (shouldPing && pingResult) {
          this.broadcastRoomState(room, 'sonar_ping', pingResult);
        } else if (stateChanged) {
          this.broadcastRoomState(room, 'state_changed');
        }
      }
    }, 1000);
  }

  public destroy() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }
}
