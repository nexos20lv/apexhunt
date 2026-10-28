export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface SonarPing {
  lat: number;
  lng: number;
  radiusMeters: number;
  timestamp: number;
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calcule la distance en mètres entre deux coordonnées géographiques (Formule Haversine)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Vérifie si un joueur est à l'intérieur de la zone de jeu circulaire
 */
export function isInsideZone(
  point: GeoPoint,
  center: GeoPoint,
  radiusMeters: number
): boolean {
  return calculateDistance(point.lat, point.lng, center.lat, center.lng) <= radiusMeters;
}

/**
 * Applique un décalage aléatoire et un rayon d'incertitude pour le ping sonar du fuyard.
 * Cela évite de donner la position au centimètre près et préserve le bluff en milieu urbain.
 */
export function applySonarUncertainty(
  realPoint: GeoPoint,
  minMeters: number = 30,
  maxMeters: number = 60
): SonarPing {
  // Distance aléatoire entre minMeters et maxMeters
  const distance = minMeters + Math.random() * (maxMeters - minMeters);
  const angle = Math.random() * 2 * Math.PI;

  // 1 degré de latitude correspond à environ 111 111 mètres
  const deltaLat = (distance * Math.cos(angle)) / 111111;
  const deltaLng =
    (distance * Math.sin(angle)) /
    (111111 * Math.cos(toRadians(realPoint.lat)));

  return {
    lat: realPoint.lat + deltaLat,
    lng: realPoint.lng + deltaLng,
    radiusMeters: Math.round(distance * 1.15),
    timestamp: Date.now(),
  };
}

/**
 * Calcule le relèvement (bearing en degrés 0-360) entre deux points
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}
