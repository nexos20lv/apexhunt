import React, { useState } from 'react';
import { RoomPublicState } from '../hooks/useGameSocket';
import { Shield, Sparkles, Activity, AlertTriangle, Clock, Users, Radio } from 'lucide-react';
import { RunnerCodeModal } from './RunnerCodeModal';
import { TacticalPerksSheet } from './TacticalPerksSheet';
import { TacticalJournalSheet } from './TacticalJournalSheet';

interface RunnerHUDProps {
  roomState: RoomPublicState;
  onUsePerk: (perk: 'ghost' | 'decoy' | 'sonar_flash' | 'triangulation') => void;
  isOutSideZone?: boolean;
}

export const RunnerHUD: React.FC<RunnerHUDProps> = ({
  roomState,
  onUsePerk,
  isOutSideZone,
}) => {
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showPerksSheet, setShowPerksSheet] = useState(false);
  const [showJournalSheet, setShowJournalSheet] = useState(false);

  const secretCode = roomState.secretCode || '----';
  const perks = roomState.myPerks || {
    ghost: true,
    decoy: true,
    sonarFlash: true,
    triangulation: true,
  };

  const availablePerksCount = (perks.ghost ? 1 : 0) + (perks.decoy ? 1 : 0);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* HUD Overlay Conteneur */}
      <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3">
        {/* Top Floating Island (Minimaliste & Compacte) */}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5 w-full max-w-md mx-auto">
          <div className="w-full bg-black/85 border border-cyan-500/30 rounded-2xl px-3.5 py-2 backdrop-blur-xl shadow-xl flex items-center justify-between">
            {/* Rôle & Équipe */}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400 font-orbitron leading-none">
                  Fuyard
                </span>
                <span className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Users className="w-2.5 h-2.5 text-cyan-400" />
                  {roomState.activeRunnersCount} en vie
                </span>
              </div>
            </div>

            {/* Timer Global */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.05] border border-white/10 text-slate-100 font-mono text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {roomState.state === 'head_start'
                  ? `Avance : ${formatTime(roomState.headStartRemainingSeconds)}`
                  : formatTime(roomState.remainingTimeSeconds)}
              </span>
            </div>

            {/* Compte à rebours Ping Radar */}
            <div className="flex items-center gap-1.5 text-right">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <div className="flex flex-col items-end">
                <span className="text-[8px] uppercase tracking-wider text-slate-400 leading-none">
                  {roomState.state === 'head_start' ? 'Avance' : 'Prochain Ping'}
                </span>
                <span className="font-orbitron text-xs font-bold text-amber-400 leading-tight">
                  {roomState.state === 'head_start'
                    ? `${roomState.headStartRemainingSeconds}s`
                    : `${roomState.nextPingInSeconds}s`}
                </span>
              </div>
            </div>
          </div>

          {/* Alerte Hors Zone non intrusive */}
          {isOutSideZone && (
            <div className="bg-red-600/90 text-white border border-red-400 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-2 shadow-lg animate-bounce">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>HORS ZONE DE JEU ! Réintégrez le cercle immédiatement.</span>
            </div>
          )}
        </div>

        {/* Centre de l'écran : TOTALEMENT LIBRE pour une visibilité 100% de la carte */}

        {/* Bottom Floating Action Dock (Ergonomique au pouce) */}
        <div className="pointer-events-auto w-full max-w-md mx-auto mb-1">
          <div className="bg-black/90 border border-slate-800 rounded-2xl p-2 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-center justify-between gap-2">
            {/* Bouton Révéler Mon Code Secret */}
            <button
              onClick={() => setShowCodeModal(true)}
              className="flex-1 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 active-press transition"
              title="Afficher mon code de capture"
            >
              <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="flex flex-col text-left leading-none">
                <span className="text-[8px] uppercase tracking-wider text-cyan-400/80 font-semibold">
                  Mon Code
                </span>
                <span className="text-sm font-extrabold font-orbitron tracking-widest text-cyan-200">
                  {secretCode}
                </span>
              </div>
            </button>

            {/* Menu Atouts Tactiques */}
            <button
              onClick={() => setShowPerksSheet(true)}
              className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 active-press transition"
            >
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="flex flex-col text-left leading-none">
                <span className="text-[8px] uppercase tracking-wider text-slate-400 font-semibold">
                  Bonus 1x
                </span>
                <span className="text-xs font-bold text-amber-300 font-orbitron">
                  {availablePerksCount > 0 ? `${availablePerksCount} Atout(s)` : 'Épuisés'}
                </span>
              </div>
            </button>

            {/* Menu Journal */}
            <button
              onClick={() => setShowJournalSheet(true)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl py-2.5 px-3 flex items-center justify-center gap-1.5 active-press transition"
              title="Ouvrir le journal de traque"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Journal
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modales & Feuilles Tiroir (Apple Design Fluid Sheets) */}
      <RunnerCodeModal
        isOpen={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        secretCode={secretCode}
      />

      <TacticalPerksSheet
        isOpen={showPerksSheet}
        onClose={() => setShowPerksSheet(false)}
        isRunner={true}
        perks={perks}
        onUsePerk={onUsePerk}
        gameActive={roomState.state === 'hunting'}
      />

      <TacticalJournalSheet
        isOpen={showJournalSheet}
        onClose={() => setShowJournalSheet(false)}
        events={roomState.events}
      />
    </>
  );
};
