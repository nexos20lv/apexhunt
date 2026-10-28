import React from 'react';
import { RoomPublicState } from '../hooks/useGameSocket';
import { Shield, EyeOff, Radio, AlertTriangle, Clock, Users } from 'lucide-react';

interface RunnerHUDProps {
  roomState: RoomPublicState;
  onUsePerk: (perk: 'ghost' | 'decoy') => void;
  isOutSideZone?: boolean;
}

export const RunnerHUD: React.FC<RunnerHUDProps> = ({
  roomState,
  onUsePerk,
  isOutSideZone,
}) => {
  const secretCode = roomState.secretCode || '----';

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none z-10 flex flex-col justify-between p-4 h-full">
      {/* Top Header Status */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <div className="flex items-center justify-between bg-black/85 border border-cyan-500/30 rounded-xl px-4 py-2.5 backdrop-blur-md shadow-lg shadow-cyan-950/40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Fuyard
            </span>
          </div>

          {/* Compteur de fuyards encore en liberté */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/50 border border-cyan-500/30 rounded-lg text-xs font-bold text-cyan-300">
            <Users className="w-3.5 h-3.5" />
            <span>{roomState.activeRunnersCount} fuyard(s) restants</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-200">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-sm font-bold">
              {roomState.state === 'head_start'
                ? `Avance : ${formatTime(roomState.headStartRemainingSeconds)}`
                : formatTime(roomState.remainingTimeSeconds)}
            </span>
          </div>
        </div>

        {/* Alerte Hors Zone */}
        {isOutSideZone && (
          <div className="bg-red-950/90 border border-red-500 rounded-xl p-3 flex items-center gap-3 animate-bounce">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div className="text-xs text-red-200">
              <span className="font-bold block uppercase">⚠️ Hors Zone de Jeu !</span>
              Retournez immédiatement en zone avant révélation directe permanente.
            </div>
          </div>
        )}
      </div>

      {/* Code Secret 4 Chiffres Unique du joueur */}
      <div className="pointer-events-auto flex flex-col items-center my-auto">
        <div className="bg-black/90 border-2 border-cyan-400/80 rounded-2xl p-6 backdrop-blur-xl shadow-[0_0_35px_rgba(6,182,212,0.35)] text-center flex flex-col items-center max-w-xs w-full">
          <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-400/80 mb-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            Votre Code Secret Personnel
          </div>
          <div className="text-4xl font-extrabold tracking-[0.35em] text-cyan-300 font-orbitron my-2 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
            {secretCode}
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Si un chasseur vous rattrape et tape ce code, vous serez <strong>infecté</strong> et deviendrez chasseur à votre tour !
          </p>
        </div>

        {/* Compte à rebours du prochain Ping Sonar / Avance */}
        <div className="mt-4 bg-black/80 border border-slate-700/60 rounded-full px-4 py-1.5 flex items-center gap-2 backdrop-blur-md">
          <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-xs text-slate-300">
            {roomState.state === 'head_start' ? (
              <>
                Avance Fuyard :{' '}
                <strong className="text-cyan-400 font-bold">
                  {roomState.headStartRemainingSeconds}s
                </strong>{' '}
                <span className="text-[10px] text-slate-500">(Radar inactif)</span>
              </>
            ) : (
              <>
                Prochain Ping Sonar :{' '}
                <strong className="text-amber-400 font-bold">
                  {roomState.nextPingInSeconds}s
                </strong>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Barre d'Atouts Tactiques */}
      <div className="pointer-events-auto grid grid-cols-2 gap-3 mb-2">
        <button
          onClick={() => onUsePerk('ghost')}
          className="bg-black/85 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 rounded-xl p-3.5 flex flex-col items-center gap-1 backdrop-blur-lg active-press transition shadow-lg"
        >
          <EyeOff className="w-5 h-5 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider">Ghost Mode</span>
          <span className="text-[9px] text-slate-400">Masque le 1er ping</span>
        </button>

        <button
          onClick={() => onUsePerk('decoy')}
          className="bg-black/85 border border-amber-500/50 hover:border-amber-400 text-amber-300 rounded-xl p-3.5 flex flex-col items-center gap-1 backdrop-blur-lg active-press transition shadow-lg"
        >
          <Radio className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider">Leurre GPS</span>
          <span className="text-[9px] text-slate-400">Faux ping à 200m</span>
        </button>
      </div>
    </div>
  );
};
