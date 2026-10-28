import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PostGameStatsPublic } from '../hooks/useGameSocket';
import {
  Trophy,
  Footprints,
  Clock,
  Shield,
  Crosshair,
  Play,
  Pause,
  RotateCcw,
  Film,
  Award,
  Zap,
} from 'lucide-react';

interface PostGameRecapProps {
  stats?: PostGameStatsPublic;
  currentUserId: string;
  isHost: boolean;
  zoneCenter: { lat: number; lng: number };
  zoneRadiusMeters: number;
  onRestartGame: () => void;
  onLeaveRoom: () => void;
}

export const PostGameRecap: React.FC<PostGameRecapProps> = ({
  stats,
  currentUserId,
  isHost,
  zoneCenter,
  zoneRadiusMeters,
  onRestartGame,
  onLeaveRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'podium' | 'replay'>('podium');

  // Replay Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0.0 à 1.0
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const replayMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const replayPolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const durationSec = stats?.durationSeconds || 60;
  const winnerIsHunters = stats?.winner === 'hunters';

  // Formatage secondes en mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Initialisation de la carte pour le replay
  useEffect(() => {
    if (activeTab !== 'replay' || !mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [zoneCenter.lat, zoneCenter.lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      className: 'tactical-dark-tiles',
    }).addTo(map);

    // Cercle de zone de départ
    L.circle([zoneCenter.lat, zoneCenter.lng], {
      radius: zoneRadiusMeters,
      color: '#ef4444',
      weight: 2,
      dashArray: '6, 6',
      fill: false,
      opacity: 0.7,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      replayMarkersRef.current.clear();
      replayPolylinesRef.current.clear();
    };
  }, [activeTab, zoneCenter, zoneRadiusMeters]);

  // Boucle d'animation fluide du Replay (accéléré sur ~15 secondes réelles)
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const TARGET_REPLAY_DURATION_MS = 15000 / playbackSpeed;

    const updateFrame = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      setPlaybackProgress((prev) => {
        const next = prev + delta / TARGET_REPLAY_DURATION_MS;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(updateFrame);
    };

    animFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Mise à jour des positions sur la carte Replay selon playbackProgress
  useEffect(() => {
    if (activeTab !== 'replay' || !mapRef.current || !stats?.playersStats) return;

    const currentMatchTimeMs = playbackProgress * (durationSec * 1000);

    stats.playersStats.forEach((p) => {
      if (!p.breadcrumbs || p.breadcrumbs.length === 0) return;

      // Filtrer les points jusqu'au temps courant
      const validPoints = p.breadcrumbs.filter((pt) => pt.t <= currentMatchTimeMs);
      const latestPoint = validPoints[validPoints.length - 1] || p.breadcrumbs[0];

      const latLngs: [number, number][] = validPoints.map((pt) => [pt.lat, pt.lng]);
      if (latLngs.length === 0) latLngs.push([latestPoint.lat, latestPoint.lng]);

      const isHunterNow = latestPoint.role === 'hunter';
      const color = isHunterNow ? '#f97316' : '#06b6d4';

      // 1. Mise à jour ou création de la trace
      let polyline = replayPolylinesRef.current.get(p.id);
      if (!polyline) {
        polyline = L.polyline(latLngs, {
          color,
          weight: 3,
          opacity: 0.6,
        }).addTo(mapRef.current!);
        replayPolylinesRef.current.set(p.id, polyline);
      } else {
        polyline.setLatLngs(latLngs);
        polyline.setStyle({ color });
      }

      // 2. Mise à jour ou création du marker joueur
      let marker = replayMarkersRef.current.get(p.id);
      const roleIcon = isHunterNow ? '🏹' : '🏃';

      const icon = L.divIcon({
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="
              width: 14px;
              height: 14px;
              background: ${color};
              border: 2px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 0 10px ${color};
            "></div>
            <span style="
              font-size: 8px;
              font-weight: 700;
              color: #ffffff;
              background: rgba(0,0,0,0.85);
              padding: 1px 4px;
              border-radius: 4px;
              white-space: nowrap;
              margin-top: 1px;
            ">${roleIcon} ${p.name}</span>
          </div>
        `,
        className: 'replay-marker',
        iconSize: [60, 30],
        iconAnchor: [30, 15],
      });

      if (!marker) {
        marker = L.marker([latestPoint.lat, latestPoint.lng], { icon }).addTo(mapRef.current!);
        replayMarkersRef.current.set(p.id, marker);
      } else {
        marker.setLatLng([latestPoint.lat, latestPoint.lng]);
        marker.setIcon(icon);
      }
    });
  }, [activeTab, playbackProgress, stats, durationSec]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 text-slate-100 max-w-lg mx-auto backdrop-blur-2xl overflow-y-auto">
      {/* Header Victoire */}
      <div className="flex flex-col items-center text-center mt-2 mb-4 animate-in fade-in duration-300">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 shadow-2xl border ${
            winnerIsHunters
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
              : 'bg-cyan-950/40 border-cyan-500/50 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
          }`}
        >
          <Trophy className="w-8 h-8 animate-bounce" />
        </div>

        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
          Partie Terminée • {formatTime(durationSec)}
        </span>
        <h1
          className={`text-2xl font-black font-orbitron tracking-wider uppercase mt-1 ${
            winnerIsHunters ? 'text-amber-400' : 'text-cyan-400'
          }`}
        >
          {winnerIsHunters ? 'Victoire des Chasseurs !' : 'Victoire du Fuyard !'}
        </h1>
      </div>

      {/* Onglets : Podium vs Replay */}
      <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 mb-4">
        <button
          onClick={() => setActiveTab('podium')}
          className={`flex-1 py-2 rounded-lg text-xs font-orbitron font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'podium'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Podiums & Stats</span>
        </button>

        <button
          onClick={() => setActiveTab('replay')}
          className={`flex-1 py-2 rounded-lg text-xs font-orbitron font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'replay'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Replay 15s</span>
        </button>
      </div>

      {/* CONTENU ONGLETS */}
      {activeTab === 'podium' ? (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          {/* Cartes Podiums MVP */}
          <div className="grid grid-cols-3 gap-2">
            {/* MVP Fuyard */}
            <div className="bg-slate-900/60 border border-cyan-500/30 rounded-2xl p-2.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase font-bold text-cyan-400 flex items-center gap-1 mb-1">
                <Shield className="w-3 h-3" />
                Survivant
              </span>
              <span className="text-xs font-bold text-slate-100 truncate w-full">
                {stats?.mvpRunner ? stats.mvpRunner.name : '—'}
              </span>
              <span className="text-[11px] font-mono font-black text-cyan-300 mt-1">
                {stats?.mvpRunner ? formatTime(stats.mvpRunner.survivalSeconds) : '—'}
              </span>
            </div>

            {/* MVP Chasseur */}
            <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-2.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase font-bold text-amber-400 flex items-center gap-1 mb-1">
                <Crosshair className="w-3 h-3" />
                Prédateur
              </span>
              <span className="text-xs font-bold text-slate-100 truncate w-full">
                {stats?.mvpHunter ? stats.mvpHunter.name : '—'}
              </span>
              <span className="text-[11px] font-mono font-black text-amber-300 mt-1">
                {stats?.mvpHunter ? `${stats.mvpHunter.capturesCount} kill(s)` : '0 kill'}
              </span>
            </div>

            {/* Top Marathonien */}
            <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-2.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase font-bold text-emerald-400 flex items-center gap-1 mb-1">
                <Footprints className="w-3 h-3" />
                Marathon
              </span>
              <span className="text-xs font-bold text-slate-100 truncate w-full">
                {stats?.topMarathonian ? stats.topMarathonian.name : '—'}
              </span>
              <span className="text-[11px] font-mono font-black text-emerald-300 mt-1">
                {stats?.topMarathonian
                  ? stats.topMarathonian.distanceMeters >= 1000
                    ? `${(stats.topMarathonian.distanceMeters / 1000).toFixed(2)} km`
                    : `${stats.topMarathonian.distanceMeters} m`
                  : '0 m'}
              </span>
            </div>
          </div>

          {/* Tableau Détaillé des Joueurs */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Performances Individuelles
            </span>

            <div className="flex flex-col gap-1.5">
              {(stats?.playersStats || []).map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-black/60 border border-slate-800/80 px-3 py-2 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 w-4">#{idx + 1}</span>
                    <span className="font-semibold text-slate-200">
                      {p.name} {p.id === currentUserId && '(Vous)'}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        p.initialRole === 'runner'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-800/40'
                      }`}
                    >
                      {p.initialRole}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Footprints className="w-3 h-3 text-slate-500" />
                      {p.distanceMeters >= 1000
                        ? `${(p.distanceMeters / 1000).toFixed(1)}km`
                        : `${p.distanceMeters}m`}
                    </span>

                    {p.initialRole === 'runner' ? (
                      <span className="text-cyan-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(p.survivalSeconds)}
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {p.capturesCount}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* REPLAY INTERACTIF */
        <div className="flex flex-col gap-3 animate-in fade-in duration-200">
          <div className="w-full h-72 rounded-2xl overflow-hidden border border-slate-800 relative shadow-2xl">
            <div ref={mapContainerRef} className="w-full h-full" />

            <div className="absolute top-2 right-2 z-[400] bg-black/85 border border-slate-700/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono">
              ⏱️ {formatTime(Math.round(playbackProgress * durationSec))} / {formatTime(durationSec)}
            </div>
          </div>

          {/* Contrôles du Lecteur Replay */}
          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center font-bold active-press shadow-md"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              {/* Slider de scrub temporel */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={playbackProgress}
                onChange={(e) => {
                  setIsPlaying(false);
                  setPlaybackProgress(parseFloat(e.target.value));
                }}
                className="flex-1 accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              {/* Sélecteur de vitesse */}
              <button
                onClick={() => {
                  const speeds = [1, 2, 4];
                  const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                  setPlaybackSpeed(speeds[nextIndex]);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-cyan-300"
              >
                {playbackSpeed}x
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOUTONS D'ACTION BAS DE PAGE */}
      <div className="mt-auto pt-4 flex flex-col gap-2">
        {isHost ? (
          <button
            onClick={onRestartGame}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold py-3.5 rounded-xl uppercase tracking-wider font-orbitron text-xs active-press flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Relancer une Partie (Lobby)</span>
          </button>
        ) : (
          <div className="text-center text-[11px] text-slate-500 italic mb-1">
            En attente de l'hôte pour relancer une partie...
          </div>
        )}

        <button
          onClick={onLeaveRoom}
          className="w-full py-2.5 text-xs text-slate-400 hover:text-white font-medium text-center"
        >
          Quitter la Room
        </button>
      </div>
    </div>
  );
};
