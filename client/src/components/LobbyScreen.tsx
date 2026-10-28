import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { RoomPublicState } from '../hooks/useGameSocket';
import { Shield, Crosshair, Users, Play, Copy, Check, QrCode, MapPin, Sliders, Smartphone, Flame } from 'lucide-react';
import { ZonePickerModal } from './ZonePickerModal';
import { PWAInstallModal } from './PWAInstallModal';

interface LobbyScreenProps {
  roomState: RoomPublicState | null;
  currentUserId: string;
  onJoin: (code: string, name: string, isHost?: boolean) => void;
  onSetRole: (role: 'runner' | 'hunter' | 'spectator') => void;
  onStartGame: () => void;
  onUpdateSettings: (settings: Partial<RoomPublicState['settings']>) => void;
  onRequestGPS: () => void;
  gpsActive: boolean;
  gpsError: string | null;
  userPosition?: { lat: number; lng: number } | null;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  roomState,
  currentUserId,
  onJoin,
  onSetRole,
  onStartGame,
  onUpdateSettings,
  onRequestGPS,
  gpsActive,
  gpsError,
  userPosition,
}) => {
  const [name, setName] = useState(
    () => localStorage.getItem('apexhunt_user_name') || ''
  );
  const [roomInput, setRoomInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-remplissage via l'URL (ex: ?room=WOLF)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('room');
    if (codeFromUrl) {
      setRoomInput(codeFromUrl.toUpperCase());
    }
  }, []);

  // Génération du QR Code
  useEffect(() => {
    if (roomState && qrCanvasRef.current) {
      const joinUrl = `${window.location.origin}?room=${roomState.code}`;
      QRCode.toCanvas(
        qrCanvasRef.current,
        joinUrl,
        {
          width: 180,
          margin: 1,
          color: {
            dark: '#ffffff',
            light: '#000000',
          },
        },
        (error) => {
          if (error) console.error('Erreur QR Code:', error);
        }
      );
    }
  }, [roomState?.code]);

  const handleCreate = () => {
    if (!name.trim()) return;
    localStorage.setItem('apexhunt_user_name', name.trim());
    onRequestGPS();
    // Génère un code aléatoire côté client ou serveur
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    onJoin(code, name.trim(), true);
  };

  const handleJoin = () => {
    if (!name.trim() || !roomInput.trim()) return;
    localStorage.setItem('apexhunt_user_name', name.trim());
    onRequestGPS();
    onJoin(roomInput.trim().toUpperCase(), name.trim(), false);
  };

  const handleCopyLink = () => {
    if (roomState) {
      const url = `${window.location.origin}?room=${roomState.code}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentPlayer = roomState?.players.find((p) => p.id === currentUserId);
  const isHost = currentPlayer?.isHost;
  const runnerCount = roomState?.players.filter((p) => p.role === 'runner').length || 0;
  const hunterCount = roomState?.players.filter((p) => p.role === 'hunter').length || 0;

  // Si pas encore dans une room
  if (!roomState) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-full max-w-sm flex flex-col gap-6">
          {/* Logo & Titre */}
          <div className="text-center">
            <div className="inline-flex p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl mb-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <Crosshair className="w-10 h-10 text-cyan-400 animate-pulse" />
            </div>
            <h1 className="text-3xl font-black font-orbitron tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-amber-400">
              APEX HUNT
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">
              Manhunt IRL • Radar Sonar • Mobile
            </p>
          </div>

          {/* Formulaire d'entrée */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md shadow-2xl flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Votre Prénom / Pseudo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Alex, Lucas..."
                maxLength={20}
                className="w-full bg-black/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono"
              />
            </div>

            {/* Rejoindre avec code */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Code de la partie (4 lettres)
              </label>
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="Ex: WOLF"
                maxLength={6}
                className="w-full bg-black/60 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl font-bold font-orbitron tracking-widest text-amber-400 placeholder-slate-700 focus:outline-none focus:border-amber-400 transition uppercase"
              />
            </div>

            {/* Détection Rejoindre en 1 Clic si lien d'invitation avec prénom déjà enregistré */}
            {roomInput && name.trim() && (
              <div className="bg-amber-950/40 border border-amber-500/50 p-3 rounded-xl flex flex-col gap-2 animate-in fade-in">
                <span className="text-[11px] text-amber-300 font-bold">
                  🔗 Invitation détectée : Room <strong>{roomInput}</strong>
                </span>
                <button
                  onClick={handleJoin}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold py-3 rounded-lg uppercase tracking-wider font-orbitron text-xs active-press shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Rejoindre en 1 clic ({name})</span>
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={handleJoin}
                disabled={!name.trim() || !roomInput.trim()}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold py-3.5 rounded-xl uppercase tracking-wider font-orbitron text-xs active-press disabled:opacity-40 transition shadow-lg shadow-amber-950/40"
              >
                Rejoindre la partie
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold">ou</span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-bold py-3.5 rounded-xl uppercase tracking-wider font-orbitron text-xs active-press disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Créer une nouvelle partie
              </button>
            </div>
          </div>

          {/* Bouton Installation PWA & GPS Info */}
          <div className="flex flex-col items-center gap-2 text-[11px] text-slate-400">
            <button
              onClick={() => setShowInstallModal(true)}
              className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 hover:text-cyan-300 active-press transition"
            >
              <Smartphone className="w-4 h-4" />
              <span>Installer l'App (Plein Écran sans barres)</span>
            </button>

            <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>Autorisation GPS requise pour synchroniser le radar</span>
            </div>
          </div>
        </div>

        <PWAInstallModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
        />
      </div>
    );
  }

  // Dans le Lobby de la room
  return (
    <div className="min-h-screen bg-black flex flex-col p-4 text-slate-100 max-w-md mx-auto">
      {/* Header Lobby */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Code de la Room
          </span>
          <div className="text-3xl font-black font-orbitron tracking-widest text-cyan-400">
            {roomState.code}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInstallModal(true)}
            className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-xs active-press font-medium text-slate-300 hover:text-cyan-400"
            title="Installer l'application"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Plein Écran</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-xs active-press font-medium"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copied ? 'Lien copié !' : 'Partager'}</span>
          </button>
        </div>
      </div>

      {/* QR Code pour les amis */}
      <div className="my-4 bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg">
        <canvas ref={qrCanvasRef} className="rounded-lg shadow-md mb-2" />
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <QrCode className="w-3.5 h-3.5 text-cyan-400" />
          Faites scanner ce QR Code à vos potes
        </span>
      </div>

      {/* Rôle du joueur actuel */}
      <div className="mb-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
          Choisissez votre Rôle :
        </span>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSetRole('runner')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 active-press transition ${
              currentPlayer?.role === 'runner'
                ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-black/50 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="text-xs font-bold font-orbitron uppercase">Fuyard</span>
            <span className="text-[9px] text-slate-500">Doit survivre</span>
          </button>

          <button
            onClick={() => onSetRole('hunter')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 active-press transition ${
              currentPlayer?.role === 'hunter'
                ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-black/50 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Crosshair className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold font-orbitron uppercase">Chasseur</span>
            <span className="text-[9px] text-slate-500">Traque en équipe</span>
          </button>
        </div>
      </div>

      {/* Liste des Joueurs */}
      <div className="flex-1 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col mb-4 overflow-y-auto max-h-48">
        <div className="flex items-center justify-between mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-cyan-400" />
            Joueurs ({roomState.players.length})
          </span>
          <span className="text-[10px]">
            {runnerCount} Fuyard(s) • {hunterCount} Chasseur(s)
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {roomState.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-black/60 border border-slate-800 px-3 py-2 rounded-xl text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    p.role === 'runner' ? 'bg-cyan-400' : 'bg-amber-400'
                  }`}
                />
                <span className="font-semibold text-slate-200">
                  {p.name} {p.id === currentUserId && '(Vous)'}
                </span>
                {p.isHost && (
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                    Hôte
                  </span>
                )}
              </div>

              <span
                className={`font-orbitron text-[10px] font-bold uppercase ${
                  p.role === 'runner' ? 'text-cyan-400' : 'text-amber-400'
                }`}
              >
                {p.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Statut GPS & Erreurs */}
      {gpsError && (
        <div className="mb-3 bg-red-950/60 border border-red-500/40 text-red-300 p-2.5 rounded-xl text-xs">
          {gpsError}
        </div>
      )}

      {!gpsActive && (
        <button
          onClick={onRequestGPS}
          className="mb-4 bg-amber-950/60 border border-amber-500/50 text-amber-300 p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold active-press animate-pulse"
        >
          <MapPin className="w-4 h-4" />
          <span>Activer le signal GPS de votre smartphone</span>
        </button>
      )}

      {/* Configuration de la Zone de Jeu (Hôte & Joueurs) */}
      <div className="mb-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            Zone de Traque
          </span>
          <span className="text-xs font-mono font-bold text-cyan-400">
            Rayon : {roomState.settings.zoneRadiusMeters >= 1000 ? `${(roomState.settings.zoneRadiusMeters / 1000).toFixed(1)} km` : `${roomState.settings.zoneRadiusMeters} m`}
          </span>
        </div>

        <div className="text-[11px] text-slate-300 font-mono bg-black/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <span>Centre : {roomState.settings.zoneCenter.lat.toFixed(4)}, {roomState.settings.zoneCenter.lng.toFixed(4)}</span>
          {Math.abs(roomState.settings.zoneCenter.lat - 48.8584) < 0.005 && Math.abs(roomState.settings.zoneCenter.lng - 2.2945) < 0.005 && (
            <span className="text-[9px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/40">Paris (Défaut)</span>
          )}
        </div>

        {isHost ? (
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => {
                if (userPosition) {
                  onUpdateSettings({ zoneCenter: userPosition });
                } else {
                  onRequestGPS();
                }
              }}
              className="py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 active-press transition"
              title="Centrer la zone sur ma position GPS réelle"
            >
              <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sur mon GPS</span>
            </button>

            <button
              onClick={() => setShowZonePicker(true)}
              className="py-2.5 px-3 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 active-press transition"
              title="Ouvrir la carte pour choisir ou chercher une zone"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sur la Carte</span>
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-slate-500 italic">
            L'hôte configure la zone avant le lancement.
          </span>
        )}
      </div>

      {/* Paramètres de la partie (Hôte) */}
      {isHost && (
        <div className="mb-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-300 active-press"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Paramètres de la Traque</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {roomState.settings.durationMinutes} min • {roomState.settings.zoneRadiusMeters} m
            </span>
          </button>

          {showSettings && (
            <div className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Durée (minutes) :</span>
                <div className="flex gap-1">
                  {[15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      onClick={() => onUpdateSettings({ durationMinutes: d })}
                      className={`px-2.5 py-1 rounded text-xs font-mono ${
                        roomState.settings.durationMinutes === d
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Avance Fuyard :</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 5].map((hs) => (
                    <button
                      key={hs}
                      onClick={() => onUpdateSettings({ headStartMinutes: hs })}
                      className={`px-2.5 py-1 rounded text-xs font-mono ${
                        roomState.settings.headStartMinutes === hs
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {hs === 0 ? '0m (Direct)' : `${hs}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rayon Zone :</span>
                <div className="flex gap-1">
                  {[500, 1000, 1500, 2000].map((r) => (
                    <button
                      key={r}
                      onClick={() => onUpdateSettings({ zoneRadiusMeters: r })}
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        roomState.settings.zoneRadiusMeters === r
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Battle Royale (Zone Rétrécissante) */}
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    Zone Rétrécissante (Battle Royale) :
                  </span>
                  <button
                    onClick={() =>
                      onUpdateSettings({ shrinkEnabled: !roomState.settings.shrinkEnabled })
                    }
                    className={`px-3 py-1 rounded-full text-xs font-bold transition active-press ${
                      roomState.settings.shrinkEnabled
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {roomState.settings.shrinkEnabled ? 'Activé' : 'Désactivé'}
                  </button>
                </div>

                {roomState.settings.shrinkEnabled && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>Intervalle de réduction :</span>
                    <div className="flex gap-1">
                      {[2, 3, 5].map((int) => (
                        <button
                          key={int}
                          onClick={() => onUpdateSettings({ shrinkIntervalMinutes: int })}
                          className={`px-2.5 py-0.5 rounded font-mono ${
                            (roomState.settings.shrinkIntervalMinutes || 3) === int
                              ? 'bg-amber-400 text-black font-bold'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {int}m
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bouton de Lancement (Hôte) */}
      {isHost ? (
        <button
          onClick={onStartGame}
          disabled={runnerCount === 0 || hunterCount === 0}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold py-4 rounded-2xl uppercase tracking-wider font-orbitron text-sm flex items-center justify-center gap-2 active-press disabled:opacity-40 shadow-[0_0_25px_rgba(6,182,212,0.4)] transition"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Lancer la Traque</span>
        </button>
      ) : (
        <div className="text-center p-4 bg-black/60 border border-slate-800 rounded-2xl text-xs text-slate-400 font-medium">
          En attente que l'hôte lance la partie...
        </div>
      )}

      {/* Modal Sélecteur de Zone Carte */}
      {showZonePicker && (
        <ZonePickerModal
          isOpen={showZonePicker}
          onClose={() => setShowZonePicker(false)}
          currentCenter={roomState.settings.zoneCenter}
          currentRadius={roomState.settings.zoneRadiusMeters}
          userGpsPosition={userPosition || null}
          onSaveZone={(center, radius) => {
            onUpdateSettings({ zoneCenter: center, zoneRadiusMeters: radius });
          }}
        />
      )}

      <PWAInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </div>
  );
};
