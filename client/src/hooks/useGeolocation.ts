import { useState, useEffect, useRef, useCallback } from 'react';

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export function useGeolocation(onPositionUpdate?: (pos: GeoCoordinates, accuracy: number) => void) {
  const [position, setPosition] = useState<GeoCoordinates | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const callbackRef = useRef(onPositionUpdate);

  useEffect(() => {
    callbackRef.current = onPositionUpdate;
  }, [onPositionUpdate]);

  // Active le WakeLock pour maintenir l'écran allumé pendant la traque
  const acquireWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = lock;
        setWakeLockActive(true);

        lock.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock non disponible ou refusé:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('La géolocalisation n’est pas supportée par votre navigateur');
      return;
    }

    acquireWakeLock();
    setIsTracking(true);
    setError(null);

    // Récupère une première position immédiate
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: GeoCoordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const acc = Math.round(pos.coords.accuracy);
        setPosition(coords);
        setAccuracy(acc);
        if (callbackRef.current) callbackRef.current(coords, acc);
      },
      (err) => {
        console.warn('Échec première géolocalisation:', err.message);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    // Écoute les déplacements en continu
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: GeoCoordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const acc = Math.round(pos.coords.accuracy);

        setPosition(coords);
        setAccuracy(acc);

        if (callbackRef.current) {
          callbackRef.current(coords, acc);
        }
      },
      (err) => {
        let msg = 'Signal GPS introuvable';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Autorisation GPS refusée. Veuillez activer la localisation dans les réglages.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Recherche du signal satellite GPS en cours...';
        }
        setError(msg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );
  }, [acquireWakeLock]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
    setIsTracking(false);
  }, [releaseWakeLock]);

  // Démarre automatiquement le tracking GPS dès l'ouverture de l'application
  useEffect(() => {
    startTracking();
    return () => {
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  return {
    position,
    accuracy,
    error,
    isTracking,
    wakeLockActive,
    startTracking,
    stopTracking,
  };
}
