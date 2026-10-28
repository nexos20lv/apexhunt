import { useState, useEffect, useRef, useCallback } from 'react';
import { soundFX } from '../audio/soundfx';

export interface PlayerPublic {
  id: string;
  name: string;
  role: 'runner' | 'hunter' | 'spectator';
  isHost: boolean;
  isOutSideZone?: boolean;
  position?: { lat: number; lng: number };
}

export interface SonarPingPublic {
  lat: number;
  lng: number;
  radiusMeters: number;
  timestamp: number;
}

export interface TacticalEventPublic {
  id: string;
  time: string;
  message: string;
  type: 'start' | 'ping' | 'perk' | 'infected' | 'zone';
}

export interface RoomPublicState {
  code: string;
  state: 'lobby' | 'head_start' | 'hunting' | 'game_over';
  winner: 'runner' | 'hunters' | null;
  settings: {
    durationMinutes: number;
    headStartMinutes: number;
    pingIntervalSeconds: number;
    zoneCenter: { lat: number; lng: number };
    zoneRadiusMeters: number;
  };
  players: PlayerPublic[];
  activeRunnersCount: number;
  activeHuntersCount: number;
  remainingTimeSeconds: number;
  headStartRemainingSeconds: number;
  nextPingInSeconds: number;
  lastPings: SonarPingPublic[];
  events?: TacticalEventPublic[];
  secretCode?: string;
}

export function useGameSocket() {
  const [roomState, setRoomState] = useState<RoomPublicState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const getPlayerId = () => {
    let id = localStorage.getItem('apexhunt_player_id');
    if (!id) {
      id = `p_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('apexhunt_player_id', id);
    }
    return id;
  };

  const playerId = getPlayerId();

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host =
      window.location.port === '5173'
        ? `${window.location.hostname}:4000`
        : window.location.host;

    const wsUrl = `${protocol}//${host}/ws?playerId=${playerId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('🔗 Connecté au serveur de jeu');

      const savedRoom = localStorage.getItem('apexhunt_current_room');
      const savedName = localStorage.getItem('apexhunt_user_name');
      const savedIsHost = localStorage.getItem('apexhunt_is_host') === 'true';

      if (savedRoom && savedName) {
        console.log(`🔄 Reconnexion automatique à la room ${savedRoom}...`);
        ws.send(
          JSON.stringify({
            type: 'join',
            roomCode: savedRoom,
            playerName: savedName,
            isHost: savedIsHost,
          })
        );
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (
          msg.type === 'state_update' ||
          msg.type === 'state_changed' ||
          msg.type === 'tick'
        ) {
          setRoomState(msg.room);
        } else if (msg.type === 'sonar_ping') {
          setRoomState(msg.room);
          soundFX.playSonarPing();
        } else if (msg.type === 'player_infected') {
          setRoomState(msg.room);
          setFeedback({
            message: msg.payload?.message || 'Un fuyard a été infecté !',
            type: 'success',
          });
          soundFX.playCaptureSound(true);
        } else if (msg.type === 'capture_feedback') {
          setFeedback({
            message: msg.message,
            type: msg.success ? 'success' : 'error',
          });
        } else if (msg.type === 'perk_feedback') {
          setFeedback({
            message: msg.message,
            type: msg.success ? 'success' : 'error',
          });
        } else if (msg.type === 'error') {
          setFeedback({ message: msg.error, type: 'error' });
        }
      } catch (e) {
        console.error('Erreur décodage message WS:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 1500);
    };

    ws.onerror = (err) => {
      console.warn('Erreur WebSocket:', err);
      ws.close();
    };

    socketRef.current = ws;
  }, [playerId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  // Ticker fluide local chaque seconde pour décrémenter le temps en continu
  useEffect(() => {
    if (!roomState || (roomState.state !== 'hunting' && roomState.state !== 'head_start')) {
      return;
    }

    const interval = setInterval(() => {
      setRoomState((prev) => {
        if (!prev) return null;

        const newRemaining = Math.max(0, prev.remainingTimeSeconds - 1);
        const newHeadStart = Math.max(0, prev.headStartRemainingSeconds - 1);
        const newNextPing = Math.max(0, prev.nextPingInSeconds - 1);

        // Bips sonores de tension quand le ping approche (3, 2, 1s)
        if (prev.state === 'hunting' && newNextPing <= 3 && newNextPing >= 1) {
          soundFX.playCountdownBeep(newNextPing);
        }

        let newState = prev.state;
        if (prev.state === 'head_start' && newHeadStart <= 0) {
          newState = 'hunting';
        }

        return {
          ...prev,
          state: newState,
          remainingTimeSeconds: newRemaining,
          headStartRemainingSeconds: newHeadStart,
          nextPingInSeconds: newNextPing,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [roomState?.state]);

  const joinRoom = useCallback(
    (roomCode: string, playerName: string, isHost = false) => {
      localStorage.setItem('apexhunt_current_room', roomCode.toUpperCase());
      localStorage.setItem('apexhunt_user_name', playerName);
      localStorage.setItem('apexhunt_is_host', String(isHost));

      sendMessage({
        type: 'join',
        roomCode,
        playerName,
        isHost,
      });
    },
    [sendMessage]
  );

  const leaveRoom = useCallback(() => {
    localStorage.removeItem('apexhunt_current_room');
    localStorage.removeItem('apexhunt_is_host');
    setRoomState(null);
  }, []);

  const setRole = useCallback(
    (role: 'runner' | 'hunter' | 'spectator') => {
      sendMessage({ type: 'set_role', role });
    },
    [sendMessage]
  );

  const updatePosition = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      sendMessage({
        type: 'update_position',
        lat,
        lng,
        accuracy,
      });
    },
    [sendMessage]
  );

  const startGame = useCallback(() => {
    sendMessage({ type: 'start_game' });
  }, [sendMessage]);

  const claimCapture = useCallback(
    (code: string) => {
      sendMessage({ type: 'claim_capture', code });
    },
    [sendMessage]
  );

  const usePerk = useCallback(
    (perk: 'ghost' | 'decoy') => {
      sendMessage({ type: 'use_perk', perk });
    },
    [sendMessage]
  );

  const updateSettings = useCallback(
    (settings: Partial<RoomPublicState['settings']>) => {
      sendMessage({ type: 'update_settings', settings });
    },
    [sendMessage]
  );

  return {
    playerId,
    isConnected,
    roomState,
    feedback,
    clearFeedback: () => setFeedback(null),
    joinRoom,
    leaveRoom,
    setRole,
    updatePosition,
    startGame,
    claimCapture,
    usePerk,
    updateSettings,
  };
}
