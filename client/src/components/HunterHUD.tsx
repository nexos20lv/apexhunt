import React, { useState } from 'react';
import { RoomPublicState } from '../hooks/useGameSocket';
import { Radio, Crosshair, KeyRound, Clock, X, Check, Users, Sparkles, Activity } from 'lucide-react';
import { soundFX } from '../audio/soundfx';
import { TacticalPerksSheet } from './TacticalPerksSheet';
import { TacticalJournalSheet } from './TacticalJournalSheet';

interface HunterHUDProps {
  roomState: RoomPublicState;
  onClaimCapture: (code: string) => void;
  onUsePerk: (perk: 'ghost' | 'decoy' | 'sonar_flash' | 'triangulation') => void;
  userPosition: { lat: number; lng: number } | null;
}

export const HunterHUD: React.FC<HunterHUDProps> = ({
  roomState,
  onClaimCapture,
  onUsePerk,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [showPerksSheet, setShowPerksSheet] = useState(false);
  const [showJournalSheet, setShowJournalSheet] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');

  const perks = roomState.myPerks || {
    ghost: true,
    decoy: true,
    sonarFlash: true,
    triangulation: true,
  };

  const availablePerksCount =
    (perks.sonarFlash ? 1 : 0) + (perks.triangulation ? 1 : 0);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDigitPress = (digit: string) => {
    if (enteredCode.length < 4) {
      soundFX.playTick();
      setEnteredCode((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    soundFX.playTick();
    setEnteredCode((prev) => prev.slice(0, -1));
  };

  const handleSubmitCode = () => {
    if (enteredCode.length === 4) {
      onClaimCapture(enteredCode);
      setShowKeypad(false);
      setEnteredCode('');
    }
  };

  const pingsCount = roomState.lastPings?.length || 0;

  return (
    <>
      {/* HUD Overlay Conteneur */}
      <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3">
        {/* Top Floating Island (Minimaliste & Compacte) */}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5 w-full max-w-md mx-auto">
          <div className="w-full bg-black/85 border border-amber-500/30 rounded-2xl px-3.5 py-2 backdrop-blur-xl shadow-xl flex items-center justify-between">
            {/* Rôle & Équipe */}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 font-orbitron leading-none">
                  Chasseur
                </span>
                <span className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Users className="w-2.5 h-2.5 text-amber-400" />
                  {roomState.activeRunnersCount} cible(s)
                </span>
              </div>
            </div>

            {/* Timer Global */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.05] border border-white/10 text-slate-100 font-mono text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {roomState.state === 'head_start'
                  ? `Avance : ${formatTime(roomState.headStartRemainingSeconds)}`
                  : formatTime(roomState.remainingTimeSeconds)}
              </span>
            </div>

            {/* Compte à rebours Ping Radar */}
            <div className="flex items-center gap-1.5 text-right">
              <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <div className="flex flex-col items-end">
                <span className="text-[8px] uppercase tracking-wider text-slate-400 leading-none">
                  {roomState.state === 'head_start'
                    ? 'Début traque'
                    : pingsCount > 0
                    ? `${pingsCount} signal${pingsCount > 1 ? 's' : ''}`
                    : 'Prochain Ping'}
                </span>
                <span className="font-orbitron text-xs font-bold text-amber-400 leading-tight">
                  {roomState.state === 'head_start'
                    ? `${roomState.headStartRemainingSeconds}s`
                    : `${roomState.nextPingInSeconds}s`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Centre de l'écran : TOTALEMENT LIBRE pour une visibilité 100% de la carte */}

        {/* Bottom Floating Action Dock (Ergonomique au pouce) */}
        <div className="pointer-events-auto w-full max-w-md mx-auto mb-1">
          <div className="bg-black/90 border border-slate-800 rounded-2xl p-2 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-center justify-between gap-2">
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

            {/* Bouton Primaire Central : Infecter un Fuyard */}
            <button
              onClick={() => setShowKeypad(true)}
              className="flex-[1.4] bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.4)] active-press uppercase tracking-wider font-orbitron text-xs border border-red-400/30 transition"
            >
              <Crosshair className="w-4 h-4" />
              <span>Infecter</span>
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

      {/* Clavier Tactile Plein Écran pour la Capture */}
      {showKeypad && (
        <div className="pointer-events-auto fixed inset-0 z-50 bg-black/95 flex flex-col justify-end p-6 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-amber-400">
              <KeyRound className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider font-orbitron">
                Validation d'Infection
              </span>
            </div>
            <button
              onClick={() => {
                setShowKeypad(false);
                setEnteredCode('');
              }}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-slate-300 active-press hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center mb-6">
            Rattrapez un fuyard et entrez le code secret à 4 chiffres affiché sur son écran pour l'infecter et le faire rejoindre votre équipe :
          </p>

          {/* Affichage des 4 chiffres saisis */}
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="w-14 h-16 rounded-xl border-2 border-amber-400/60 bg-amber-950/30 flex items-center justify-center text-3xl font-extrabold text-amber-300 font-orbitron shadow-inner"
              >
                {enteredCode[idx] || ''}
              </div>
            ))}
          </div>

          {/* Pavé numérique tactile */}
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto w-full mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((key) => {
              const isAction = key === 'C' || key === 'OK';
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'C') handleBackspace();
                    else if (key === 'OK') handleSubmitCode();
                    else handleDigitPress(key);
                  }}
                  className={`h-16 rounded-2xl flex items-center justify-center text-2xl font-bold font-orbitron active-press transition ${
                    isAction
                      ? key === 'OK'
                        ? 'bg-emerald-600 text-white border border-emerald-400/50'
                        : 'bg-red-950/60 text-red-400 border border-red-500/30'
                      : 'bg-white/10 text-slate-100 hover:bg-white/15 border border-white/10'
                  }`}
                >
                  {key === 'OK' ? <Check className="w-7 h-7" /> : key}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feuilles Tiroir Modales */}
      <TacticalPerksSheet
        isOpen={showPerksSheet}
        onClose={() => setShowPerksSheet(false)}
        isRunner={false}
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
