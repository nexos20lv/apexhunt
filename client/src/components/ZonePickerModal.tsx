import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, Search, Crosshair, Check, Sliders } from 'lucide-react';

interface ZonePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCenter: { lat: number; lng: number };
  currentRadius: number;
  userGpsPosition: { lat: number; lng: number } | null;
  onSaveZone: (center: { lat: number; lng: number }, radius: number) => void;
}

export const ZonePickerModal: React.FC<ZonePickerModalProps> = ({
  isOpen,
  onClose,
  currentCenter,
  currentRadius,
  userGpsPosition,
  onSaveZone,
}) => {
  const [center, setCenter] = useState(currentCenter);
  const [radius, setRadius] = useState(currentRadius);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    setCenter(currentCenter);
    setRadius(currentRadius);
  }, [currentCenter, currentRadius, isOpen]);

  // Initialisation de la carte Leaflet
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: 15,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        className: 'tactical-dark-tiles',
        maxZoom: 19,
      }).addTo(map);

      // Clic sur la carte pour définir le centre
      map.on('click', (e: L.LeafletMouseEvent) => {
        setCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;
    }

    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Mise à jour du cercle et des marqueurs
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const latLng: [number, number] = [center.lat, center.lng];

    // Cercle de zone
    if (circleRef.current) {
      circleRef.current.setLatLng(latLng);
      circleRef.current.setRadius(radius);
    } else {
      circleRef.current = L.circle(latLng, {
        radius,
        color: '#06b6d4',
        weight: 3,
        fillColor: '#06b6d4',
        fillOpacity: 0.15,
        dashArray: '8, 8',
      }).addTo(map);
    }

    // Marqueur central
    const centerIcon = L.divIcon({
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:20px;height:20px;background:#06b6d4;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 15px #06b6d4;"></div>
          <span style="font-size:9px;font-weight:bold;color:#06b6d4;background:rgba(0,0,0,0.85);padding:1px 6px;border-radius:6px;border:1px solid #06b6d4;white-space:nowrap;margin-top:2px;">Centre de Zone</span>
        </div>
      `,
      className: 'zone-center-marker',
      iconSize: [80, 40],
      iconAnchor: [40, 10],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
      markerRef.current.setIcon(centerIcon);
    } else {
      markerRef.current = L.marker(latLng, { icon: centerIcon }).addTo(map);
    }

    // Marqueur GPS réel du joueur s'il existe
    if (userGpsPosition) {
      const gpsLatLng: [number, number] = [userGpsPosition.lat, userGpsPosition.lng];
      const gpsIcon = L.divIcon({
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="width:16px;height:16px;background:#10b981;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 12px #10b981;"></div>
            <span style="font-size:8px;font-weight:bold;color:#10b981;background:rgba(0,0,0,0.85);padding:1px 4px;border-radius:4px;white-space:nowrap;">Mon GPS</span>
          </div>
        `,
        className: 'user-gps-marker',
        iconSize: [60, 30],
        iconAnchor: [30, 8],
      });

      if (gpsMarkerRef.current) {
        gpsMarkerRef.current.setLatLng(gpsLatLng);
      } else {
        gpsMarkerRef.current = L.marker(gpsLatLng, { icon: gpsIcon }).addTo(map);
      }
    }
  }, [center, radius, userGpsPosition]);

  // Recentre sur le GPS utilisateur
  const handleCenterOnGps = () => {
    if (userGpsPosition) {
      setCenter(userGpsPosition);
      mapRef.current?.setView([userGpsPosition.lat, userGpsPosition.lng], 15);
    }
  };

  // Recherche d'adresse / ville via OpenStreetMap Nominatim
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&limit=1`,
        {
          headers: {
            'Accept-Language': 'fr',
          },
        }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        setCenter({ lat: newLat, lng: newLng });
        mapRef.current?.setView([newLat, newLng], 15);
        setSearchQuery('');
      } else {
        setSearchError('Lieu introuvable. Essayez avec un nom de ville ou un parc.');
      }
    } catch {
      setSearchError('Erreur de connexion au service de recherche.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = () => {
    onSaveZone(center, radius);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 pointer-events-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer" />

      {/* Modal Container */}
      <div className="relative bg-black/95 border-2 border-cyan-500/50 rounded-3xl max-w-lg w-full h-[85vh] flex flex-col overflow-hidden backdrop-blur-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-black/60">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider font-orbitron text-slate-100">
                Définir la Zone de Jeu
              </h2>
              <span className="text-[10px] text-slate-400">
                Cliquez sur la carte ou recherchez un lieu
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

        {/* Barre de Recherche de Ville / Adresse */}
        <div className="p-3 bg-slate-950 border-b border-slate-800/80 flex flex-col gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: Lyon, Parc Monceau, Bordeaux..."
                className="w-full bg-black/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-black font-bold px-3 py-2 rounded-xl text-xs active-press transition"
            >
              {isSearching ? '...' : 'Chercher'}
            </button>
          </form>

          {searchError && (
            <span className="text-[10px] text-red-400 font-medium px-1">
              {searchError}
            </span>
          )}

          {/* Bouton rapide Mon GPS */}
          {userGpsPosition && (
            <button
              onClick={handleCenterOnGps}
              className="w-full py-1.5 px-3 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 active-press transition"
            >
              <Crosshair className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Centrer la zone sur ma position GPS actuelle</span>
            </button>
          )}
        </div>

        {/* Carte Interactive */}
        <div className="relative flex-1 w-full bg-black">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Indication tactile en superposition */}
          <div className="absolute top-2 left-2 z-10 bg-black/80 border border-slate-700/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-slate-300 pointer-events-none">
            👆 Touchez la carte pour déplacer le centre
          </div>
        </div>

        {/* Contrôles du Rayon & Validation */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Rayon de la zone :
            </span>
            <span className="text-sm font-extrabold font-orbitron text-cyan-400">
              {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
            </span>
          </div>

          {/* Presets rapides de rayon */}
          <div className="grid grid-cols-5 gap-1.5">
            {[250, 500, 1000, 2000, 3000].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={`py-1.5 rounded-lg text-[10px] font-mono font-bold active-press transition ${
                  radius === r
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>

          {/* Bouton de confirmation */}
          <button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold py-3.5 rounded-xl uppercase tracking-wider font-orbitron text-xs flex items-center justify-center gap-2 active-press shadow-lg shadow-cyan-950/60 transition mt-1"
          >
            <Check className="w-4 h-4" />
            <span>Valider cette Zone de Jeu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
