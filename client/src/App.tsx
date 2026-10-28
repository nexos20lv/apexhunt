import React, { useEffect } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import { useGeolocation } from './hooks/useGeolocation';
import { LobbyScreen } from './components/LobbyScreen';
import { MapRadar } from './components/MapRadar';
import { RunnerHUD } from './components/RunnerHUD';
import { HunterHUD } from './components/HunterHUD';
import { PostGameRecap } from './components/PostGameRecap';
import { AlertCircle, Play } from 'lucide-react';

export const App: React.FC = () => {
  const {
    playerId,
    isConnected,
    roomState,
    feedback,
    clearFeedback,
    joinRoom,
    leaveRoom,
    setRole,
    updatePosition,
    startGame,
    restartGame,
    claimCapture,
    usePerk,
    updateSettings,
  } = useGameSocket();

  const {
    position,
    accuracy,
    error: gpsError,
    isTracking: gpsActive,
    startTracking,
  } = useGeolocation((coords, acc) => {
    updatePosition(coords.lat, coords.lng, acc);
  });

  // Réinitialisation automatique du toast feedback après 4 secondes
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        clearFeedback();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback, clearFeedback]);

  const currentPlayer = roomState?.players.find((p) => p.id === playerId);
  const isRunner = currentPlayer?.role === 'runner';

  // Position effective : GPS réel en direct, sinon dernière position connue
  const effectivePosition =
    position ||
    currentPlayer?.position ||
    roomState?.settings.zoneCenter ||
    null;

  // Centre automatiquement la zone de jeu sur la position GPS réelle de l'hôte
  useEffect(() => {
    if (effectivePosition && currentPlayer?.isHost && roomState?.state === 'lobby') {
      if (
        Math.abs(roomState.settings.zoneCenter.lat - 48.8584) < 0.001 &&
        Math.abs(roomState.settings.zoneCenter.lng - 2.2945) < 0.001
      ) {
        updateSettings({ zoneCenter: effectivePosition });
      }
    }
  }, [effectivePosition, currentPlayer?.isHost, roomState?.state, roomState?.settings.zoneCenter, updateSettings]);

  const handleStartGame = () => {
    if (effectivePosition && currentPlayer?.isHost) {
      updateSettings({ zoneCenter: effectivePosition });
    }
    startGame();
  };

  // Si pas dans une room ou en phase lobby
  if (!roomState || roomState.state === 'lobby') {
    return (
      <LobbyScreen
        roomState={roomState}
        currentUserId={playerId}
        onJoin={joinRoom}
        onSetRole={setRole}
        onStartGame={handleStartGame}
        onUpdateSettings={updateSettings}
        onRequestGPS={startTracking}
        gpsActive={gpsActive}
        gpsError={gpsError}
        userPosition={effectivePosition}
      />
    );
  }

  // Phase d'avance initiale (Head Start) pour les Chasseurs : écran verrouillé avec compte à rebours
  if (roomState.state === 'head_start' && !isRunner) {
    const mins = Math.floor(roomState.headStartRemainingSeconds / 60);
    const secs = roomState.headStartRemainingSeconds % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="w-16 h-16 rounded-full border-2 border-amber-500/40 bg-amber-950/30 flex items-center justify-center text-amber-400 mb-6 animate-pulse shadow-[0_0_25px_rgba(245,158,11,0.3)]">
          <Play className="w-8 h-8 ml-1" />
        </div>
        <h2 className="text-xs uppercase tracking-widest font-bold text-amber-400 mb-2">
          Avance Initiale du Fuyard
        </h2>
        <div className="text-6xl font-black font-orbitron tracking-wider text-amber-300 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] my-3">
          {timeFormatted}
        </div>
        <p className="text-xs text-slate-400 max-w-xs mt-2 leading-relaxed">
          Le fuyard est en train de prendre de l’avance pour se cacher dans la zone. Les radars s'activeront dès la fin du décompte !
        </p>
      </div>
    );
  }

  // Phase de jeu active (Hunting ou Head Start pour le runner)
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Alerte Déconnexion Réseau */}
      {!isConnected && (
        <div className="absolute top-0 inset-x-0 z-50 bg-red-600 text-white text-[11px] font-bold py-1 px-4 text-center">
          Connexion au serveur perdue... Reconnexion en cours...
        </div>
      )}

      {/* Carte Leaflet Radar OLED plein écran */}
      <MapRadar
        userPosition={effectivePosition}
        accuracy={accuracy}
        zoneCenter={roomState.settings.zoneCenter}
        zoneRadiusMeters={roomState.settings.zoneRadiusMeters}
        players={roomState.players}
        currentUserId={playerId}
        isRunner={isRunner}
        lastPings={roomState.lastPings}
        nextShrinkInSeconds={roomState.nextShrinkInSeconds}
      />

      {/* Superposition du HUD adapté selon le rôle */}
      {isRunner ? (
        <RunnerHUD
          roomState={roomState}
          onUsePerk={usePerk}
          isOutSideZone={currentPlayer?.isOutSideZone}
        />
      ) : (
        <HunterHUD
          roomState={roomState}
          onClaimCapture={claimCapture}
          onUsePerk={usePerk}
          userPosition={position}
        />
      )}

      {/* Toast de Notification Feedback */}
      {feedback && (
        <div className="fixed top-16 inset-x-4 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-3 rounded-xl border text-xs font-bold shadow-2xl flex items-center gap-2 backdrop-blur-xl ${
              feedback.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                : 'bg-red-950/90 border-red-500 text-red-200'
            }`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {/* Récapitulatif de Fin de Partie (Podiums & Replay 15s) */}
      {roomState.state === 'game_over' && (
        <PostGameRecap
          stats={roomState.gameStats}
          currentUserId={playerId}
          isHost={!!currentPlayer?.isHost}
          zoneCenter={roomState.settings.zoneCenter}
          zoneRadiusMeters={roomState.settings.zoneRadiusMeters}
          onRestartGame={restartGame}
          onLeaveRoom={leaveRoom}
        />
      )}
    </div>
  );
};
