import React, { useState, useEffect } from 'react';
import { Smartphone, Share2, PlusSquare, Check, X, Download } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Détection iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Détection si déjà installé en PWA
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Écoute de l'événement natif Android / Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Smartphone className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-amber-400 uppercase">
            Mode Plein Écran
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Installez ApexHunt pour supprimer les barres Safari/Chrome et jouer comme sur une vraie application native.
          </p>
        </div>

        {isStandalone ? (
          <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs">
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>L'application est déjà installée sur cet appareil !</span>
          </div>
        ) : isIOS ? (
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                <Share2 className="w-4 h-4" />
              </div>
              <span>1. Touchez le bouton <strong>Partager</strong> en bas de Safari</span>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <PlusSquare className="w-4 h-4" />
              </div>
              <span>2. Choisissez <strong>« Sur l'écran d'accueil »</strong></span>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <span>3. Touchez <strong>Ajouter</strong> en haut à droite</span>
            </div>
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleNativeInstall}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold py-3.5 rounded-xl uppercase tracking-wider font-orbitron text-xs active-press flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
          >
            <Download className="w-4 h-4" />
            <span>Installer l'application</span>
          </button>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center">
            Ouvrez le menu de votre navigateur (les trois points ⋮) et sélectionnez <strong>« Ajouter à l'écran d'accueil »</strong> ou <strong>« Installer l'application »</strong>.
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 text-xs text-slate-500 hover:text-slate-300 text-center font-medium"
        >
          Continuer dans le navigateur
        </button>
      </div>
    </div>
  );
};
