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
  secretCode?: string;
}

export function useGameSocket() {
  const [roomState, setRoomState] = useState<RoomPublicState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const getPlayerId = () => {
    let id = sessionStorage.getItem('apexhunt_player_id');
    if (!id) {
      id = `p_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('apexhunt_player_id', id);
    }
    return id;
  };

  const playerId = getPlayerId();

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
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'state_update' || msg.type === 'state_changed') {
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
      }, 2000);
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

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  }, []);

  const joinRoom = useCallback(
    (roomCode: string, playerName: string, isHost = false) => {
      sendMessage({
        type: 'join',
        roomCode,
        playerName,
        isHost,
      });
    },
    [sendMessage]
  );

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
    setRole,
    updatePosition,
    startGame,
    claimCapture,
    usePerk,
    updateSettings,
  };
}
