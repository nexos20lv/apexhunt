import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  isInsideZone,
  applySonarUncertainty,
  calculateBearing,
} from '../game/geo.js';

describe('Geospatial & Sonar Mechanics', () => {
  // Coordonnées de test : Paris (Tour Eiffel vs Champ de Mars)
  const eiffelTower = { lat: 48.8584, lng: 2.2945 };
  const champDeMars = { lat: 48.8556, lng: 2.2986 };

  it('calcule la distance exacte en mètres avec la formule Haversine', () => {
    const dist = calculateDistance(
      eiffelTower.lat,
      eiffelTower.lng,
      champDeMars.lat,
      champDeMars.lng
    );
    // Distance réelle ~435m à 450m
    expect(dist).toBeGreaterThan(420);
    expect(dist).toBeLessThan(460);
  });

  it('détecte correctement si un joueur est à l’intérieur ou l’extérieur de la zone de jeu', () => {
    // Zone centrée sur la Tour Eiffel avec rayon 300m
    const center = eiffelTower;
    const radius = 300;

    // Un point à 50m
    const nearby = { lat: 48.8586, lng: 2.2948 };
    expect(isInsideZone(nearby, center, radius)).toBe(true);

    // Champ de Mars est à ~440m -> Hors zone
    expect(isInsideZone(champDeMars, center, radius)).toBe(false);
  });

  it('génère un cercle d’incertitude réaliste autour du fuyard sans révéler sa position exacte', () => {
    const ping = applySonarUncertainty(eiffelTower, 30, 60);

    // Le centre du ping doit être décalé par rapport à la vraie position
    const offsetDistance = calculateDistance(
      eiffelTower.lat,
      eiffelTower.lng,
      ping.lat,
      ping.lng
    );

    expect(offsetDistance).toBeGreaterThanOrEqual(30);
    expect(offsetDistance).toBeLessThanOrEqual(65);
    // Le rayon d'incertitude affiché doit englober la zone
    expect(ping.radiusMeters).toBeGreaterThanOrEqual(40);
  });

  it('calcule le relèvement (bearing) en degrés de 0 à 360', () => {
    // Vers le Sud-Est
    const bearing = calculateBearing(
      eiffelTower.lat,
      eiffelTower.lng,
      champDeMars.lat,
      champDeMars.lng
    );
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThanOrEqual(360);
    // Sud-Est est autour de 120-160 degrés
    expect(bearing).toBeGreaterThan(100);
    expect(bearing).toBeLessThan(180);
  });
});
