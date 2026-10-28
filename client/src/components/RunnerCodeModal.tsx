import React from 'react';
import { X, Shield } from 'lucide-react';

interface RunnerCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  secretCode: string;
}

export const RunnerCodeModal: React.FC<RunnerCodeModalProps> = ({
  isOpen,
  onClose,
  secretCode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
      />

      {/* Modal Card */}
      <div className="relative bg-black/95 border-2 border-cyan-400 rounded-3xl p-6 text-center max-w-sm w-full backdrop-blur-2xl shadow-[0_0_50px_rgba(6,182,212,0.4)] z-10 flex flex-col items-center animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-slate-300 active-press hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 mb-3 shadow-lg shadow-cyan-950/60">
          <Shield className="w-8 h-8" />
        </div>

        <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400 font-orbitron">
          Votre Code de Fuyard
        </span>

        {/* Big digits */}
        <div className="text-6xl font-black font-orbitron tracking-[0.25em] text-cyan-300 my-4 drop-shadow-[0_0_20px_rgba(6,182,212,0.9)] select-all">
          {secretCode}
        </div>

        <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3 my-2 text-xs text-cyan-200/90 leading-relaxed">
          Si un chasseur vous touche IRL, tendez-lui cet écran : il doit taper ces <strong>4 chiffres</strong> pour vous infecter et vous faire rejoindre sa meute !
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider active-press shadow-lg font-orbitron"
        >
          Masquer & Retourner à la Carte
        </button>
      </div>
    </div>
  );
};
