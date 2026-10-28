import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { PlayerPublic, SonarPingPublic, TacticalEventPublic } from '../hooks/useGameSocket';
import {
  Crosshair,
  Radio,
  Navigation,
  Volume2,
  VolumeX,
  Footprints,
  ChevronUp,
  ChevronDown,
  Activity,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { soundFX } from '../audio/soundfx';

interface MapRadarProps {
  userPosition: { lat: number; lng: number } | null;
  accuracy: number | null;
  zoneCenter: { lat: number; lng: number };
  zoneRadiusMeters: number;
  players: PlayerPublic[];
  currentUserId: string;
  isRunner: boolean;
  lastPings: SonarPingPublic[];
  events?: TacticalEventPublic[];
  onManualPositionChange?: (lat: number, lng: number) => void;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function calculateBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) * (180 / Math.PI)) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLon);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export const MapRadar: React.FC<MapRadarProps> = ({
  userPosition,
  accuracy,
  zoneCenter,
  zoneRadiusMeters,
  players,
  currentUserId,
  isRunner,
  lastPings,
  events = [],
  onManualPositionChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hasAutoCenteredRef = useRef(false);

  const [isMuted, setIsMuted] = useState(soundFX.isMuted);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [simMode, setSimMode] = useState(false);

  // Layers refs
  const zoneCircleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccCircleRef = useRef<L.Circle | null>(null);
  const teammatesLayerRef = useRef<L.LayerGroup | null>(null);
  const pingsLayerRef = useRef<L.LayerGroup | null>(null);

  // Calcul du détecteur de proximité et compas
  let targetDistance: number | null = null;
  let targetBearing: number = 0;
  let targetLabel = '';

  if (userPosition) {
    if (!isRunner && lastPings.length > 0) {
      // Pour les chasseurs : distance vers le ping de fuyard le plus proche
      let minD = Infinity;
      let closestPing: SonarPingPublic | null = null;
      for (const p of lastPings) {
        const d = calculateDistanceMeters(userPosition.lat, userPosition.lng, p.lat, p.lng);
        if (d < minD) {
          minD = d;
          closestPing = p;
        }
      }
      if (closestPing) {
        targetDistance = minD;
        targetBearing = calculateBearingDegrees(userPosition.lat, userPosition.lng, closestPing.lat, closestPing.lng);
        targetLabel = 'Dernier Signal';
      }
    } else if (isRunner) {
      // Pour les fuyards : alerte de proximité si un chasseur approche !
      let minD = Infinity;
      for (const p of players) {
        if (p.role === 'hunter' && p.position) {
          const d = calculateDistanceMeters(userPosition.lat, userPosition.lng, p.position.lat, p.position.lng);
          if (d < minD) {
            minD = d;
          }
        }
      }
      if (minD < Infinity) {
        targetDistance = minD;
        targetLabel = 'Chasseur le + proche';
      }
    }
  }

  // Initialisation de la carte Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter = userPosition || zoneCenter;
    const map = L.map(mapContainerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      className: 'tactical-dark-tiles',
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    teammatesLayerRef.current = L.layerGroup().addTo(map);
    pingsLayerRef.current = L.layerGroup().addTo(map);

    // Clic sur la carte en mode simulation
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onManualPositionChange) {
        onManualPositionChange(e.latlng.lat, e.latlng.lng);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Zone de jeu circulaire
  useEffect(() => {
    if (!mapRef.current) return;

    if (zoneCircleRef.current) {
      zoneCircleRef.current.setLatLng([zoneCenter.lat, zoneCenter.lng]);
      zoneCircleRef.current.setRadius(zoneRadiusMeters);
    } else {
      zoneCircleRef.current = L.circle([zoneCenter.lat, zoneCenter.lng], {
        radius: zoneRadiusMeters,
        color: '#ef4444',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#ef4444',
        fillOpacity: 0.04,
      }).addTo(mapRef.current);
    }
  }, [zoneCenter, zoneRadiusMeters]);

  // Position du joueur courant + auto-centrage initial
  useEffect(() => {
    if (!mapRef.current || !userPosition) return;

    const userLatLng = L.latLng(userPosition.lat, userPosition.lng);

    if (!hasAutoCenteredRef.current) {
      mapRef.current.setView(userLatLng, 16, { animate: true });
      hasAutoCenteredRef.current = true;
    }

    const markerColor = isRunner ? '#06b6d4' : '#f59e0b';
    const roleIcon = isRunner ? '🏃' : '🏹';
    const markerHtml = `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <div style="
          position: relative;
          width: 20px;
          height: 20px;
          background: ${markerColor};
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 16px ${markerColor}, 0 0 30px ${markerColor};
        "></div>
        <span style="
          margin-top: 2px;
          font-size: 10px;
          font-weight: bold;
          color: #ffffff;
          background: rgba(0,0,0,0.85);
          border: 1px solid ${markerColor};
          padding: 1px 6px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        ">${roleIcon} Moi</span>
      </div>
    `;

    const icon = L.divIcon({
      html: markerHtml,
      className: 'custom-user-marker',
      iconSize: [60, 40],
      iconAnchor: [30, 10],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLatLng);
      userMarkerRef.current.setIcon(icon);
    } else {
      userMarkerRef.current = L.marker(userLatLng, { icon }).addTo(mapRef.current);
    }

    if (accuracy && accuracy < 80) {
      if (userAccCircleRef.current) {
        userAccCircleRef.current.setLatLng(userLatLng);
        userAccCircleRef.current.setRadius(accuracy);
      } else {
        userAccCircleRef.current = L.circle(userLatLng, {
          radius: accuracy,
          color: markerColor,
          weight: 1,
          opacity: 0.3,
          fillColor: markerColor,
          fillOpacity: 0.08,
        }).addTo(mapRef.current);
      }
    }
  }, [userPosition, accuracy, isRunner]);

  // Coéquipiers
  useEffect(() => {
    if (!mapRef.current || !teammatesLayerRef.current) return;
    teammatesLayerRef.current.clearLayers();

    players.forEach((player) => {
      if (player.id !== currentUserId && player.position) {
        // En mode chasseur : voir tous les autres chasseurs
        // En mode fuyard : voir tous les autres fuyards
        const isTeammate =
          (isRunner && player.role === 'runner') ||
          (!isRunner && player.role === 'hunter');

        if (isTeammate) {
          const color = player.role === 'runner' ? '#06b6d4' : '#f97316';
          const labelColor = player.role === 'runner' ? '#a5f3fc' : '#fed7aa';
          const roleBadge = player.role === 'runner' ? '🏃' : '🏹';

          const markerHtml = `
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="
                width: 16px;
                height: 16px;
                background: ${color};
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 0 12px ${color};
              "></div>
              <span style="
                margin-top: 2px;
                font-size: 9px;
                font-weight: 600;
                color: ${labelColor};
                background: rgba(0,0,0,0.85);
                border: 1px solid rgba(255,255,255,0.15);
                padding: 1px 5px;
                border-radius: 4px;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.6);
              ">${roleBadge} ${player.name}</span>
            </div>
          `;

          const icon = L.divIcon({
            html: markerHtml,
            className: 'teammate-marker',
            iconSize: [60, 36],
            iconAnchor: [30, 8],
          });

          L.marker([player.position.lat, player.position.lng], {
            icon,
          }).addTo(teammatesLayerRef.current!);
        }
      }
    });
  }, [players, currentUserId, isRunner]);

  // Pings Sonar
  useEffect(() => {
    if (!mapRef.current || !pingsLayerRef.current) return;
    pingsLayerRef.current.clearLayers();

    lastPings.forEach((ping) => {
      L.circle([ping.lat, ping.lng], {
        radius: ping.radiusMeters,
        color: '#ef4444',
        weight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.25,
      }).addTo(pingsLayerRef.current!);
    });
  }, [lastPings]);

  const handleRecenter = () => {
    if (mapRef.current && userPosition) {
      mapRef.current.setView([userPosition.lat, userPosition.lng], 16, {
        animate: true,
      });
    }
  };

  const handleToggleMute = () => {
    const muted = soundFX.toggleMute();
    setIsMuted(muted);
  };

  const handleSimMove = (dLat: number, dLng: number) => {
    if (!onManualPositionChange) return;
    const base = userPosition || zoneCenter;
    onManualPositionChange(base.lat + dLat, base.lng + dLng);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Compas & Détecteur de Proximité Tactique (Top Center) */}
      {targetDistance !== null && (
        <div className="absolute top-16 inset-x-0 mx-auto w-fit z-10 flex items-center gap-2.5 bg-black/85 border border-slate-700/80 backdrop-blur-xl px-4 py-1.5 rounded-full shadow-2xl animate-in fade-in duration-200">
          {!isRunner && (
            <Navigation
              className="w-4 h-4 text-cyan-400 transition-transform duration-300"
              style={{ transform: `rotate(${targetBearing}deg)` }}
            />
          )}
          <div className="text-xs font-mono font-bold flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase">{targetLabel} :</span>
            <span
              className={`font-orbitron font-extrabold ${
                targetDistance < 100
                  ? 'text-red-400 animate-pulse'
                  : targetDistance < 250
                  ? 'text-amber-400'
                  : 'text-cyan-400'
              }`}
            >
              {targetDistance} m
            </span>
            {targetDistance < 80 && (
              <span className="text-[9px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded-md animate-bounce">
                PROCHE !
              </span>
            )}
          </div>
        </div>
      )}

      {/* Badge Indicateur GPS Temps Réel (Top Left) */}
      <div className="absolute top-16 left-4 z-10 flex items-center gap-2 bg-black/85 border border-slate-700/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-mono shadow-lg">
        <Radio
          className={`w-3.5 h-3.5 ${
            userPosition ? 'text-emerald-400 animate-pulse' : 'text-amber-400 animate-ping'
          }`}
        />
        <span className={userPosition ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
          {userPosition ? `GPS FIX (~${accuracy ?? 5}m)` : 'RECHERCHE GPS...'}
        </span>
      </div>

      {/* Commandes Droite : Mute + Recentrer */}
      <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-2.5">
        <button
          onClick={handleToggleMute}
          className={`w-11 h-11 border rounded-full flex items-center justify-center backdrop-blur-md active-press shadow-lg ${
            isMuted
              ? 'bg-red-950/80 border-red-500/50 text-red-400'
              : 'bg-black/80 border-slate-700 text-slate-200'
          }`}
          title={isMuted ? 'Son coupé (Mode Furtif)' : 'Son activé'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        <button
          onClick={handleRecenter}
          className="w-11 h-11 bg-black/80 border border-cyan-500/40 rounded-full flex items-center justify-center text-cyan-400 backdrop-blur-md active-press shadow-lg shadow-cyan-500/20"
          title="Recentrer sur ma position"
        >
          <Crosshair className="w-5 h-5 animate-pulse" />
        </button>
      </div>

      {/* Commandes Gauche : Mode Simulation (Indoor/Test living room) */}
      <div className="absolute bottom-24 left-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setSimMode(!simMode)}
          className={`px-3 py-2 rounded-xl border text-[10px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md active-press shadow-lg ${
            simMode
              ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
              : 'bg-black/80 border-slate-700 text-slate-400'
          }`}
        >
          <Footprints className="w-3.5 h-3.5" />
          <span>{simMode ? '🕹️ Simu Active' : '🛰️ GPS Réel'}</span>
        </button>

        {simMode && (
          <div className="bg-black/90 border border-cyan-500/40 p-2 rounded-xl backdrop-blur-md flex flex-col items-center gap-1 shadow-2xl animate-in fade-in duration-200">
            <span className="text-[9px] text-slate-400 uppercase font-bold">Déplacer (20m)</span>
            <button
              onClick={() => handleSimMove(0.0002, 0)}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 active-press"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => handleSimMove(0, -0.00025)}
                className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 active-press"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSimMove(-0.0002, 0)}
                className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 active-press"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSimMove(0, 0.00025)}
                className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 active-press"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[8px] text-slate-500">ou cliquez sur la carte</span>
          </div>
        )}
      </div>

      {/* Volet Tactique Inférieur (Journal des Événements & Roster) */}
      <div className="absolute bottom-2 inset-x-4 z-20 pointer-events-auto">
        <button
          onClick={() => setShowEventDrawer(!showEventDrawer)}
          className="w-full bg-black/85 border border-slate-800 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-slate-300 backdrop-blur-md shadow-lg active-press"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-[11px]">
              Journal Tactique ({events.length})
            </span>
          </div>
          {showEventDrawer ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {showEventDrawer && (
          <div className="mt-1 bg-black/95 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto flex flex-col gap-1.5 text-xs backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200">
            {events.length === 0 ? (
              <span className="text-slate-500 italic text-[11px] text-center">Aucun événement pour l'instant</span>
            ) : (
              events
                .slice()
                .reverse()
                .map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1 border-b border-slate-900 text-[11px]">
                    <span
                      className={
                        e.type === 'infected'
                          ? 'text-amber-400 font-bold'
                          : e.type === 'perk'
                          ? 'text-cyan-300 font-semibold'
                          : e.type === 'zone'
                          ? 'text-red-400 font-bold'
                          : 'text-slate-300'
                      }
                    >
                      {e.message}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono ml-2 flex-shrink-0">{e.time}</span>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none border border-white/5 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] z-[1]" />
    </div>
  );
};
