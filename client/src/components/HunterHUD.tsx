import React, { useState } from 'react';
import { RoomPublicState } from '../hooks/useGameSocket';
import { Radio, Crosshair, KeyRound, Clock, X, Check } from 'lucide-react';
import { soundFX } from '../audio/soundfx';

interface HunterHUDProps {
  roomState: RoomPublicState;
  onClaimCapture: (code: string) => void;
  userPosition: { lat: number; lng: number } | null;
}

export const HunterHUD: React.FC<HunterHUDProps> = ({
  roomState,
  onClaimCapture,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');

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

  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none z-10 flex flex-col justify-between p-4 h-full">
      {/* Header Chasseur */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <div className="flex items-center justify-between bg-black/85 border border-amber-500/30 rounded-xl px-4 py-2.5 backdrop-blur-md shadow-lg shadow-amber-950/40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Rôle : Chasseur
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-200">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-mono text-sm font-bold">
              {formatTime(roomState.remainingTimeSeconds)}
            </span>
          </div>
        </div>

        {/* Statut Sonar & Dernier repérage */}
        <div className="bg-black/80 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-red-400 animate-pulse" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Dernier Ping Sonar
              </div>
              <div className="text-xs text-slate-200 font-medium">
                {roomState.lastPing ? (
                  <span>
                    Zone de ~{roomState.lastPing.radiusMeters}m détectée
                  </span>
                ) : (
                  <span className="text-slate-500 italic">En attente du premier ping...</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase">Prochain Ping</div>
            <div className="text-sm font-bold text-amber-400 font-orbitron">
              {roomState.nextPingInSeconds}s
            </div>
          </div>
        </div>
      </div>

      {/* Bouton de Saisie de Capture (Bottom) */}
      <div className="pointer-events-auto mb-2">
        <button
          onClick={() => setShowKeypad(true)}
          className="w-full bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(239,68,68,0.4)] active-press uppercase tracking-wider font-orbitron text-sm border border-red-400/30"
        >
          <Crosshair className="w-6 h-6 animate-spin" />
          Capturer le Fuyard (Code)
        </button>
      </div>

      {/* Clavier Tactile Plein Écran pour la Capture (Modal Apple HIG) */}
      {showKeypad && (
        <div className="pointer-events-auto fixed inset-0 z-50 bg-black/95 flex flex-col justify-end p-6 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-amber-400">
              <KeyRound className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider font-orbitron">
                Validation de Capture
              </span>
            </div>
            <button
              onClick={() => {
                setShowKeypad(false);
                setEnteredCode('');
              }}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-slate-300 active-press"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center mb-6">
            Lisez le code secret à 4 chiffres affiché sur l'écran du fuyard pour confirmer l'élimination :
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

          {/* Pavé numérique tactile 3x4 ergonomique */}
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
    </div>
  );
};
