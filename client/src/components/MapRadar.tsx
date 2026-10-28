import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { PlayerPublic, SonarPingPublic } from '../hooks/useGameSocket';
import { Crosshair } from 'lucide-react';

interface MapRadarProps {
  userPosition: { lat: number; lng: number } | null;
  accuracy: number | null;
  zoneCenter: { lat: number; lng: number };
  zoneRadiusMeters: number;
  players: PlayerPublic[];
  currentUserId: string;
  isRunner: boolean;
  lastPing: SonarPingPublic | null;
}

export const MapRadar: React.FC<MapRadarProps> = ({
  userPosition,
  accuracy,
  zoneCenter,
  zoneRadiusMeters,
  players,
  currentUserId,
  isRunner,
  lastPing,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layers refs
  const zoneCircleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccCircleRef = useRef<L.Circle | null>(null);
  const huntersLayerRef = useRef<L.LayerGroup | null>(null);
  const pingCircleRef = useRef<L.Circle | null>(null);

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

    // Tuiles CartoDB Dark Matter (ultra légères, thème stealth OLED)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Groupe pour les autres joueurs
    const huntersLayer = L.layerGroup().addTo(map);
    huntersLayerRef.current = huntersLayer;

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Mise à jour de la zone de jeu
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

  // Mise à jour de la position de l'utilisateur
  useEffect(() => {
    if (!mapRef.current || !userPosition) return;

    const userLatLng = L.latLng(userPosition.lat, userPosition.lng);

    // Couleur : Cyan (#06b6d4) pour fuyard, Ambre (#f59e0b) pour chasseur
    const markerColor = isRunner ? '#06b6d4' : '#f59e0b';
    const markerHtml = `
      <div style="
        position: relative;
        width: 18px;
        height: 18px;
        background: ${markerColor};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 12px ${markerColor};
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

    // Cercle de précision GPS
    if (accuracy && accuracy < 60) {
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

  // Mise à jour des co-chasseurs (uniquement visible entre chasseurs)
  useEffect(() => {
    if (!mapRef.current || !huntersLayerRef.current) return;
    huntersLayerRef.current.clearLayers();

    if (!isRunner) {
      players.forEach((player) => {
        if (player.id !== currentUserId && player.role === 'hunter' && player.position) {
          const hunterHtml = `
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="
                width: 14px;
                height: 14px;
                background: #f97316;
                border: 2px solid #fff;
                border-radius: 50%;
                box-shadow: 0 0 8px #f97316;
              "></div>
              <span style="
                margin-top: 2px;
                font-size: 9px;
                color: #fed7aa;
                background: rgba(0,0,0,0.7);
                padding: 1px 4px;
                border-radius: 4px;
                white-space: nowrap;
              ">${player.name}</span>
            </div>
          `;

          const hunterIcon = L.divIcon({
            html: hunterHtml,
            className: 'hunter-marker',
            iconSize: [40, 26],
            iconAnchor: [20, 7],
          });

          L.marker([player.position.lat, player.position.lng], {
            icon: hunterIcon,
          }).addTo(huntersLayerRef.current!);
        }
      });
    }
  }, [players, currentUserId, isRunner]);

  // Mise à jour du Ping Sonar du fuyard
  useEffect(() => {
    if (!mapRef.current) return;

    if (lastPing) {
      const pingLatLng = L.latLng(lastPing.lat, lastPing.lng);

      if (pingCircleRef.current) {
        pingCircleRef.current.setLatLng(pingLatLng);
        pingCircleRef.current.setRadius(lastPing.radiusMeters);
      } else {
        pingCircleRef.current = L.circle(pingLatLng, {
          radius: lastPing.radiusMeters,
          color: '#ef4444',
          weight: 2,
          fillColor: '#ef4444',
          fillOpacity: 0.25,
        }).addTo(mapRef.current);
      }
    } else if (pingCircleRef.current) {
      pingCircleRef.current.remove();
      pingCircleRef.current = null;
    }
  }, [lastPing]);

  const handleRecenter = () => {
    if (mapRef.current && userPosition) {
      mapRef.current.setView([userPosition.lat, userPosition.lng], 16, {
        animate: true,
      });
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Conteneur de carte */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Bouton Recentrer Tactique (Touch-friendly 44x44px) */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-6 right-4 z-10 w-12 h-12 bg-black/80 border border-cyan-500/40 rounded-full flex items-center justify-center text-cyan-400 backdrop-blur-md active-press shadow-lg shadow-cyan-500/20"
        title="Recentrer sur ma position"
      >
        <Crosshair className="w-6 h-6 animate-pulse" />
      </button>

      {/* Grille réticule tactique d'ambiance */}
      <div className="absolute inset-0 pointer-events-none border border-white/5 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] z-[1]" />
    </div>
  );
};
