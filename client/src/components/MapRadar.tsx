import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { PlayerPublic, SonarPingPublic } from '../hooks/useGameSocket';
import { Crosshair, Radio } from 'lucide-react';

interface MapRadarProps {
  userPosition: { lat: number; lng: number } | null;
  accuracy: number | null;
  zoneCenter: { lat: number; lng: number };
  zoneRadiusMeters: number;
  players: PlayerPublic[];
  currentUserId: string;
  isRunner: boolean;
  lastPings: SonarPingPublic[];
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hasAutoCenteredRef = useRef(false);

  // Layers refs
  const zoneCircleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccCircleRef = useRef<L.Circle | null>(null);
  const teammatesLayerRef = useRef<L.LayerGroup | null>(null);
  const pingsLayerRef = useRef<L.LayerGroup | null>(null);

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

    // Tuiles OpenStreetMap 100% gratuites sans API Key avec filtre Dark OLED tactique
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      className: 'tactical-dark-tiles',
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    teammatesLayerRef.current = L.layerGroup().addTo(map);
    pingsLayerRef.current = L.layerGroup().addTo(map);

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

  // Position du joueur courant + centrage automatique initial
  useEffect(() => {
    if (!mapRef.current || !userPosition) return;

    const userLatLng = L.latLng(userPosition.lat, userPosition.lng);

    // Auto-centre la première fois que le GPS obtient le signal
    if (!hasAutoCenteredRef.current) {
      mapRef.current.setView(userLatLng, 16, { animate: true });
      hasAutoCenteredRef.current = true;
    }

    const markerColor = isRunner ? '#06b6d4' : '#f59e0b';
    const markerHtml = `
      <div style="
        position: relative;
        width: 18px;
        height: 18px;
        background: ${markerColor};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 14px ${markerColor};
      "></div>
    `;

    const icon = L.divIcon({
      html: markerHtml,
      className: 'custom-user-marker',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
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

  // Position des coéquipiers (Chasseurs voient Chasseurs, Fuyards voient Fuyards)
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

          const markerHtml = `
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="
                width: 14px;
                height: 14px;
                background: ${color};
                border: 2px solid #fff;
                border-radius: 50%;
                box-shadow: 0 0 8px ${color};
              "></div>
              <span style="
                margin-top: 2px;
                font-size: 9px;
                color: ${labelColor};
                background: rgba(0,0,0,0.7);
                padding: 1px 4px;
                border-radius: 4px;
                white-space: nowrap;
              ">${player.name}</span>
            </div>
          `;

          const icon = L.divIcon({
            html: markerHtml,
            className: 'teammate-marker',
            iconSize: [40, 26],
            iconAnchor: [20, 7],
          });

          L.marker([player.position.lat, player.position.lng], {
            icon,
          }).addTo(teammatesLayerRef.current!);
        }
      }
    });
  }, [players, currentUserId, isRunner]);

  // Pings Sonar actifs
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

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Badge Indicateur GPS Temps Réel */}
      <div className="absolute top-16 left-4 z-10 flex items-center gap-2 bg-black/85 border border-slate-700/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-mono shadow-lg">
        <Radio
          className={`w-3.5 h-3.5 ${
            userPosition ? 'text-emerald-400 animate-pulse' : 'text-amber-400 animate-ping'
          }`}
        />
        <span className={userPosition ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
          {userPosition
            ? `GPS FIX (~${accuracy ?? 5}m)`
            : 'RECHERCHE DU SIGNAL GPS...'}
        </span>
      </div>

      {/* Bouton Recentrer Tactique */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-6 right-4 z-10 w-12 h-12 bg-black/85 border border-cyan-500/40 rounded-full flex items-center justify-center text-cyan-400 backdrop-blur-md active-press shadow-lg shadow-cyan-500/20"
        title="Recentrer sur ma position"
      >
        <Crosshair className="w-6 h-6 animate-pulse" />
      </button>

      <div className="absolute inset-0 pointer-events-none border border-white/5 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] z-[1]" />
    </div>
  );
};
