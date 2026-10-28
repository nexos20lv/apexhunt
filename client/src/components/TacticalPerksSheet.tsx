import React from 'react';
import { X, Zap, EyeOff, Radio, Target, Sparkles } from 'lucide-react';
import { PlayerPerks } from '../hooks/useGameSocket';

interface TacticalPerksSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isRunner: boolean;
  perks: PlayerPerks;
  onUsePerk: (perk: 'ghost' | 'decoy' | 'sonar_flash' | 'triangulation') => void;
  gameActive: boolean;
}

export const TacticalPerksSheet: React.FC<TacticalPerksSheetProps> = ({
  isOpen,
  onClose,
  isRunner,
  perks,
  onUsePerk,
  gameActive,
}) => {
  if (!isOpen) return null;

  const handleTriggerPerk = (perk: 'ghost' | 'decoy' | 'sonar_flash' | 'triangulation') => {
    onUsePerk(perk);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
      />

      {/* Sheet Content */}
      <div className="relative bg-black/95 border-t border-slate-800 rounded-t-3xl max-h-[80vh] flex flex-col backdrop-blur-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-10 animate-in slide-in-from-bottom duration-300">
        {/* Grab Handle */}
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-12 h-1.5 bg-slate-700/80 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Sparkles className={`w-5 h-5 ${isRunner ? 'text-cyan-400' : 'text-amber-400'}`} />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider font-orbitron text-slate-100">
                Atouts Tactiques {isRunner ? 'Fuyard' : 'Chasseur'}
              </h2>
              <span className="text-[10px] text-slate-400">
                Bonus à usage unique (1x par joueur)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 active-press hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Perks List */}
        <div className="p-4 flex flex-col gap-3">
          {isRunner ? (
            <>
              {/* Ghost Mode */}
              <button
                onClick={() => perks.ghost && gameActive && handleTriggerPerk('ghost')}
                disabled={!perks.ghost || !gameActive}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition backdrop-blur-md ${
                  perks.ghost && gameActive
                    ? 'bg-cyan-950/30 border-cyan-500/50 hover:border-cyan-400 text-cyan-200 active-press shadow-lg shadow-cyan-950/50 cursor-pointer'
                    : 'bg-black/50 border-slate-800/60 text-slate-600 opacity-50 cursor-not-allowed'
                }`}
              >
                <div
                  className={`p-3 rounded-xl border ${
                    perks.ghost
                      ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400'
                      : 'bg-black/40 border-slate-800 text-slate-600'
                  }`}
                >
                  <EyeOff className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-orbitron text-sm uppercase tracking-wide">
                      Ghost Mode
                    </span>
                    <span
                      className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        perks.ghost
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-900 text-slate-600 border border-slate-800'
                      }`}
                    >
                      {perks.ghost ? '⚡ 1x DISPO' : '🔒 ÉPUISÉ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Masque totalement votre signal lors du prochain ping sonar. Les chasseurs ne reçoivent aucune position pour vous.
                  </p>
                </div>
              </button>

              {/* Leurre GPS */}
              <button
                onClick={() => perks.decoy && gameActive && handleTriggerPerk('decoy')}
                disabled={!perks.decoy || !gameActive}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition backdrop-blur-md ${
                  perks.decoy && gameActive
                    ? 'bg-amber-950/30 border-amber-500/50 hover:border-amber-400 text-amber-200 active-press shadow-lg shadow-amber-950/50 cursor-pointer'
                    : 'bg-black/50 border-slate-800/60 text-slate-600 opacity-50 cursor-not-allowed'
                }`}
              >
                <div
                  className={`p-3 rounded-xl border ${
                    perks.decoy
                      ? 'bg-amber-950/80 border-amber-500/50 text-amber-400'
                      : 'bg-black/40 border-slate-800 text-slate-600'
                  }`}
                >
                  <Radio className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-orbitron text-sm uppercase tracking-wide">
                      Leurre GPS
                    </span>
                    <span
                      className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        perks.decoy
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-900 text-slate-600 border border-slate-800'
                      }`}
                    >
                      {perks.decoy ? '⚡ 1x DISPO' : '🔒 ÉPUISÉ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Projette un faux signal radar à plus de 200m de vous pour envoyer la meute de chasseurs sur une fausse piste.
                  </p>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Sonar Flash (Hunter) */}
              <button
                onClick={() => perks.sonarFlash && gameActive && handleTriggerPerk('sonar_flash')}
                disabled={!perks.sonarFlash || !gameActive}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition backdrop-blur-md ${
                  perks.sonarFlash && gameActive
                    ? 'bg-amber-950/30 border-amber-500/50 hover:border-amber-400 text-amber-200 active-press shadow-lg shadow-amber-950/50 cursor-pointer'
                    : 'bg-black/50 border-slate-800/60 text-slate-600 opacity-50 cursor-not-allowed'
                }`}
              >
                <div
                  className={`p-3 rounded-xl border ${
                    perks.sonarFlash
                      ? 'bg-amber-950/80 border-amber-500/50 text-amber-400'
                      : 'bg-black/40 border-slate-800 text-slate-600'
                  }`}
                >
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-orbitron text-sm uppercase tracking-wide">
                      Sonar Flash
                    </span>
                    <span
                      className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        perks.sonarFlash
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-900 text-slate-600 border border-slate-800'
                      }`}
                    >
                      {perks.sonarFlash ? '⚡ 1x DISPO' : '🔒 ÉPUISÉ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Déclenche un <strong>scan radar immédiat</strong> sur tous les fuyards actifs sans attendre le décompte automatique.
                  </p>
                </div>
              </button>

              {/* Triangulation (Hunter) */}
              <button
                onClick={() => perks.triangulation && gameActive && handleTriggerPerk('triangulation')}
                disabled={!perks.triangulation || !gameActive}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition backdrop-blur-md ${
                  perks.triangulation && gameActive
                    ? 'bg-red-950/30 border-red-500/50 hover:border-red-400 text-red-200 active-press shadow-lg shadow-red-950/50 cursor-pointer'
                    : 'bg-black/50 border-slate-800/60 text-slate-600 opacity-50 cursor-not-allowed'
                }`}
              >
                <div
                  className={`p-3 rounded-xl border ${
                    perks.triangulation
                      ? 'bg-red-950/80 border-red-500/50 text-red-400'
                      : 'bg-black/40 border-slate-800 text-slate-600'
                  }`}
                >
                  <Target className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-orbitron text-sm uppercase tracking-wide">
                      Triangulation
                    </span>
                    <span
                      className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        perks.triangulation
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-slate-900 text-slate-600 border border-slate-800'
                      }`}
                    >
                      {perks.triangulation ? '🎯 1x DISPO' : '🔒 ÉPUISÉ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Affine la précision du prochain ping sonar à ~10-15m (au lieu de 40-60m) pour débusquer la cachette exacte des fuyards.
                  </p>
                </div>
              </button>
            </>
          )}
        </div>

        {/* Footer Close */}
        <div className="p-4 border-t border-slate-800/60 bg-black/40">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold py-3 rounded-xl text-xs uppercase tracking-wider active-press"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
