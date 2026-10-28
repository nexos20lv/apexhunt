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
  const pollIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);
  const callbackRef = useRef(onPositionUpdate);
  const lastCoordsRef = useRef<GeoCoordinates | null>(null);

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

  const handleNewPosition = useCallback((pos: GeolocationPosition) => {
    const coords: GeoCoordinates = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };
    const acc = Math.round(pos.coords.accuracy);

    // Vérifie si la position a bougé significativement ou si première position
    const last = lastCoordsRef.current;
    if (
      !last ||
      Math.abs(last.lat - coords.lat) > 0.000005 ||
      Math.abs(last.lng - coords.lng) > 0.000005
    ) {
      lastCoordsRef.current = coords;
      setPosition(coords);
      setAccuracy(acc);
      setError(null);

      if (callbackRef.current) {
        callbackRef.current(coords, acc);
      }
    } else {
      // Même position, met à jour la précision
      setAccuracy(acc);
    }
  }, []);

  const handleGpsError = useCallback((err: GeolocationPositionError) => {
    let msg = 'Signal GPS en cours d’acquisition...';
    if (err.code === err.PERMISSION_DENIED) {
      msg = '⚠️ Autorisation GPS refusée. Veuillez activer la géolocalisation dans les paramètres de votre navigateur.';
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      msg = 'Signal satellite GPS faible ou indisponible.';
    }
    setError(msg);
  }, []);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('La géolocalisation n’est pas supportée par votre navigateur');
      return;
    }

    acquireWakeLock();
    setIsTracking(true);
    setError(null);

    // 1. Position immédiate
    navigator.geolocation.getCurrentPosition(
      handleNewPosition,
      handleGpsError,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    // 2. Écoute continue watchPosition
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleNewPosition,
      handleGpsError,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );

    // 3. Heartbeat Polling de secours actif (toutes les 2.5 secondes)
    // Empêche le GPS mobile de s'endormir ou de décrocher
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handleNewPosition,
        () => {}, // Silencieux en cas de timeout temporaire pour ne pas écraser
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }, 2500);
  }, [acquireWakeLock, handleNewPosition, handleGpsError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
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
