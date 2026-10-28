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

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: GeoCoordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const acc = pos.coords.accuracy;

        setPosition(coords);
        setAccuracy(acc);

        if (callbackRef.current) {
          callbackRef.current(coords, acc);
        }
      },
      (err) => {
        let msg = 'Erreur GPS';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Autorisation GPS refusée. Veuillez activer la localisation.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Signal GPS introuvable';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Délai d’attente GPS dépassé';
        }
        setError(msg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 15000,
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

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

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
