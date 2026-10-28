import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PlayerPublic, SonarPingPublic } from '../hooks/useGameSocket';
import {
  Crosshair,
  Radio,
  Navigation,
  Volume2,
  VolumeX,
  Globe,
  AlertTriangle,
  Flame,
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
  nextShrinkInSeconds?: number | null;
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
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Génère un polygone "masque inversé" : remplit le monde entier sauf l'intérieur du cercle de jeu
function createInvertedCirclePolygon(
  center: { lat: number; lng: number },
  radiusMeters: number
): [number, number][][] {
  const outerWorld: [number, number][] = [
    [-85, -180],
    [-85, 180],
    [85, 180],
    [85, -180],
    [-85, -180],
  ];

  const innerHole: [number, number][] = [];
  const points = 64;
  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const lat = center.lat + (radiusMeters * Math.cos(angle)) / 111111;
    const lng =
      center.lng +
      (radiusMeters * Math.sin(angle)) /
        (111111 * Math.cos((center.lat * Math.PI) / 180));
    innerHole.push([lat, lng]);
  }

  return [outerWorld, innerHole];
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
  nextShrinkInSeconds,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hasAutoCenteredRef = useRef(false);
  const hasCenteredOnGpsRef = useRef(false);
  const isFollowingRef = useRef(true);

  const [isMuted, setIsMuted] = useState(soundFX.isMuted);
  const [isFollowing, setIsFollowing] = useState(true);

  // Layers refs
  const zoneBoundaryLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccCircleRef = useRef<L.Circle | null>(null);
  const teammatesLayerRef = useRef<L.LayerGroup | null>(null);
  const pingsLayerRef = useRef<L.LayerGroup | null>(null);

  // Distance et relèvement vers la cible / chasseur
  let targetDistance: number | null = null;
  let targetBearing: number = 0;
  let targetLabel = '';

  // Distance jusqu'à la limite de zone
  let distToBoundary: number | null = null;
  let isOutsideLimit = false;

  if (userPosition) {
    const distFromCenter = calculateDistanceMeters(
      userPosition.lat,
      userPosition.lng,
      zoneCenter.lat,
      zoneCenter.lng
    );
    distToBoundary = Math.round(zoneRadiusMeters - distFromCenter);
    isOutsideLimit = distToBoundary < 0;

    if (!isRunner && lastPings.length > 0) {
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
        targetBearing = calculateBearingDegrees(
          userPosition.lat,
          userPosition.lng,
          closestPing.lat,
          closestPing.lng
        );
        targetLabel = 'Dernier Signal';
      }
    } else if (isRunner) {
      let minD = Infinity;
      for (const p of players) {
        if (p.role === 'hunter' && p.position) {
          const d = calculateDistanceMeters(
            userPosition.lat,
            userPosition.lng,
            p.position.lat,
            p.position.lng
          );
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
    }).addTo(map);

    zoneBoundaryLayerRef.current = L.layerGroup().addTo(map);
    teammatesLayerRef.current = L.layerGroup().addTo(map);
    pingsLayerRef.current = L.layerGroup().addTo(map);

    // Détection du glissement manuel : suspend le recentrage automatique pour laisser explorer
    map.on('dragstart', () => {
      isFollowingRef.current = false;
      setIsFollowing(false);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Affichage Haute Visibilité des Limites de Zone
  useEffect(() => {
    if (!mapRef.current || !zoneBoundaryLayerRef.current) return;
    zoneBoundaryLayerRef.current.clearLayers();

    const layer = zoneBoundaryLayerRef.current;
    const centerLatLng: [number, number] = [zoneCenter.lat, zoneCenter.lng];

    // 1. Masque sombre extérieur ("Zone Interdite / Brouillard de guerre")
    const invertedCoords = createInvertedCirclePolygon(zoneCenter, zoneRadiusMeters);
    L.polygon(invertedCoords, {
      fillColor: '#000000',
      fillOpacity: 0.55,
      stroke: false,
      interactive: false,
    }).addTo(layer);

    // 2. Cercle de limite rouge néon continu
    L.circle(centerLatLng, {
      radius: zoneRadiusMeters,
      color: '#ef4444',
      weight: 4,
      opacity: 0.95,
      fill: false,
      interactive: false,
    }).addTo(layer);

    // 3. Halo lumineux extérieur pointillé
    L.circle(centerLatLng, {
      radius: zoneRadiusMeters + 4,
      color: '#f87171',
      weight: 2,
      dashArray: '10, 10',
      opacity: 0.75,
      fill: false,
      interactive: false,
    }).addTo(layer);

    // 4. Badges cardinaux "⛔ LIMITE DE ZONE" le long du périmètre
    const cardinalAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    cardinalAngles.forEach((ang) => {
      const tagLat = zoneCenter.lat + (zoneRadiusMeters * Math.cos(ang)) / 111111;
      const tagLng =
        zoneCenter.lng +
        (zoneRadiusMeters * Math.sin(ang)) /
          (111111 * Math.cos((zoneCenter.lat * Math.PI) / 180));

      const tagIcon = L.divIcon({
        html: `
          <div style="display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);">
            <span style="
              background: rgba(239, 68, 68, 0.95);
              color: #ffffff;
              font-size: 9px;
              font-weight: 900;
              padding: 2px 8px;
              border-radius: 999px;
              border: 1.5px solid #ffffff;
              box-shadow: 0 0 14px #ef4444;
              letter-spacing: 1px;
              white-space: nowrap;
            ">⛔ LIMITE</span>
          </div>
        `,
        className: 'boundary-tag-marker',
        iconSize: [80, 20],
        iconAnchor: [40, 10],
      });

      L.marker([tagLat, tagLng], { icon: tagIcon, interactive: false }).addTo(layer);
    });
  }, [zoneCenter, zoneRadiusMeters]);

  // Position du joueur courant + auto-centrage fluide
  useEffect(() => {
    if (!mapRef.current || !userPosition) return;

    const userLatLng = L.latLng(userPosition.lat, userPosition.lng);

    // Centrage automatique initial OU premier fix GPS réel précis
    if (
      !hasAutoCenteredRef.current ||
      (!hasCenteredOnGpsRef.current && accuracy && accuracy < 100)
    ) {
      mapRef.current.setView(userLatLng, 16, { animate: true });
      hasAutoCenteredRef.current = true;
      if (accuracy && accuracy < 100) {
        hasCenteredOnGpsRef.current = true;
      }
    } else if (isFollowingRef.current) {
      // Suivi de caméra automatique et fluide dès que le joueur avance
      mapRef.current.panTo(userLatLng, { animate: true, duration: 0.6 });
    }

    const markerColor = isRunner ? '#06b6d4' : '#f59e0b';
    const roleIcon = isRunner ? '🏃' : '🏹';

    const markerHtml = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
        <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: ${markerColor};
            opacity: 0.35;
            animation: radar-pulse 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
          "></div>
          <div style="
            width: 22px;
            height: 22px;
            background: ${markerColor};
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 20px ${markerColor}, 0 0 40px ${markerColor};
            z-index: 2;
          "></div>
        </div>
        <span style="
          margin-top: 3px;
          font-size: 10px;
          font-weight: 800;
          color: #ffffff;
          background: #000000;
          border: 1.5px solid ${markerColor};
          padding: 1.5px 8px;
          border-radius: 8px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.8);
          z-index: 3;
        ">${roleIcon} VOUS</span>
      </div>
    `;

    const icon = L.divIcon({
      html: markerHtml,
      className: 'custom-user-marker',
      iconSize: [60, 48],
      iconAnchor: [30, 24],
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
          opacity: 0.35,
          fillColor: markerColor,
          fillOpacity: 0.1,
        }).addTo(mapRef.current);
      }
    }
  }, [userPosition, accuracy, isRunner]);

  // Coéquipiers visibles en direct
  useEffect(() => {
    if (!mapRef.current || !teammatesLayerRef.current) return;
    teammatesLayerRef.current.clearLayers();

    players.forEach((player) => {
      if (player.id !== currentUserId && player.position) {
        const isTeammate =
          (isRunner && player.role === 'runner') ||
          (!isRunner && player.role === 'hunter');

        if (isTeammate) {
          const color = player.role === 'runner' ? '#06b6d4' : '#f97316';
          const labelColor = player.role === 'runner' ? '#a5f3fc' : '#fed7aa';
          const roleBadge = player.role === 'runner' ? '🏃' : '🏹';

          const markerHtml = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
              <div style="
                width: 18px;
                height: 18px;
                background: ${color};
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 0 14px ${color};
              "></div>
              <span style="
                margin-top: 2px;
                font-size: 9px;
                font-weight: 700;
                color: ${labelColor};
                background: rgba(0,0,0,0.85);
                border: 1px solid rgba(255,255,255,0.2);
                padding: 1px 6px;
                border-radius: 6px;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0,0,0,0.7);
              ">${roleBadge} ${player.name}</span>
            </div>
          `;

          const icon = L.divIcon({
            html: markerHtml,
            className: 'custom-teammate-marker',
            iconSize: [70, 36],
            iconAnchor: [35, 12],
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

  // Recentrer sur soi et reverrouiller le suivi caméra automatique
  const handleRecenter = () => {
    if (mapRef.current && userPosition) {
      isFollowingRef.current = true;
      setIsFollowing(true);
      mapRef.current.setView([userPosition.lat, userPosition.lng], 16, {
        animate: true,
      });
    }
  };

  // Afficher TOUTE la zone de jeu et ses limites en 1 clic
  const handleFitZone = () => {
    if (mapRef.current) {
      isFollowingRef.current = false;
      setIsFollowing(false);
      const bounds = L.circle([zoneCenter.lat, zoneCenter.lng], {
        radius: zoneRadiusMeters,
      }).getBounds();
      mapRef.current.fitBounds(bounds, { padding: [40, 40], animate: true });
    }
  };

  const handleToggleMute = () => {
    const muted = soundFX.toggleMute();
    setIsMuted(muted);
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

      {/* Alerte Rétrécissement de Zone (Battle Royale) */}
      {nextShrinkInSeconds !== null && nextShrinkInSeconds !== undefined && nextShrinkInSeconds <= 60 && nextShrinkInSeconds > 0 && (
        <div className="absolute top-28 inset-x-0 mx-auto w-fit z-20 flex items-center gap-2 bg-red-950/90 border border-red-500/80 text-red-200 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold shadow-2xl backdrop-blur-md animate-pulse">
          <Flame className="w-4 h-4 text-red-400 animate-bounce" />
          <span>RÉTRÉCISSEMENT ZONE : {nextShrinkInSeconds}s !</span>
        </div>
      )}

      {/* Badge Indicateur GPS (Top Left) */}
      <div className="absolute top-16 left-3 z-10 flex items-center gap-2 bg-black/85 border border-slate-700/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-mono shadow-lg">
        <Radio
          className={`w-3.5 h-3.5 ${
            userPosition ? 'text-emerald-400 animate-pulse' : 'text-amber-400 animate-ping'
          }`}
        />
        <span className={userPosition ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
          {userPosition ? `GPS ACTIF (~${accuracy ?? 5}m)` : 'RECHERCHE GPS...'}
        </span>
      </div>

      {/* Badge Distance aux Limites de Zone (Top Right) */}
      {distToBoundary !== null && (
        <div
          className={`absolute top-16 right-3 z-10 flex items-center gap-1.5 border backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-mono shadow-lg transition ${
            isOutsideLimit
              ? 'bg-red-950/90 border-red-500 text-red-300 font-bold animate-pulse'
              : distToBoundary < 100
              ? 'bg-amber-950/90 border-amber-500 text-amber-300 font-bold'
              : 'bg-black/85 border-slate-700/60 text-slate-300'
          }`}
        >
          {isOutsideLimit ? (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-red-400" />
          )}
          <span>
            {isOutsideLimit
              ? `HORS ZONE (${Math.abs(distToBoundary)}m)`
              : `Limite : ${distToBoundary}m`}
          </span>
        </div>
      )}

      {/* Commandes Droite : Limites (Vue globale) + Recentrer (Moi) + Mute */}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col gap-2.5 pointer-events-auto">
        {/* Bouton Voir Toutes les Limites */}
        <button
          onClick={handleFitZone}
          className="w-11 h-11 bg-black/85 border border-red-500/50 hover:border-red-400 rounded-full flex items-center justify-center text-red-400 backdrop-blur-md active-press shadow-lg shadow-red-950/50"
          title="Afficher toute la zone de jeu et ses limites"
        >
          <Globe className="w-5 h-5 animate-pulse" />
        </button>

        {/* Bouton Recentrer / Suivi Automatique sur Moi */}
        <button
          onClick={handleRecenter}
          className={`w-11 h-11 border rounded-full flex items-center justify-center backdrop-blur-md active-press shadow-lg transition-all duration-300 ${
            isFollowing
              ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-cyan-950/60 ring-2 ring-cyan-500/30'
              : 'bg-black/85 border-slate-700/80 hover:border-cyan-400/70 text-slate-400 hover:text-cyan-300 shadow-black/80'
          }`}
          title={isFollowing ? 'Suivi GPS verrouillé' : 'Cliquer pour reverrouiller le suivi GPS'}
        >
          <Crosshair className={`w-5 h-5 ${isFollowing ? 'text-cyan-300' : 'text-slate-400'}`} />
        </button>

        {/* Bouton Audio */}
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
      </div>

      <div className="absolute inset-0 pointer-events-none border border-white/5 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] z-[1]" />
    </div>
  );
};
