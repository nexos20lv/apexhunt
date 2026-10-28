import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from '../game/Room.js';

describe('GameRoom State Machine & Infection / Multi-Runner Mode', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom('WOLF', {
      durationMinutes: 30,
      headStartMinutes: 0.1,
      pingIntervalSeconds: 60,
      zoneCenter: { lat: 48.8584, lng: 2.2945 },
      zoneRadiusMeters: 1000,
    });
  });

  it('génère un code secret à 4 chiffres unique pour chaque fuyard', () => {
    room.addPlayer('p1', 'Alice', true);
    room.addPlayer('p2', 'Bob', false);
    room.setPlayerRole('p1', 'runner');
    room.setPlayerRole('p2', 'runner');

    const p1 = room.getPlayer('p1');
    const p2 = room.getPlayer('p2');

    expect(p1?.secretCode).toMatch(/^[0-9]{4}$/);
    expect(p2?.secretCode).toMatch(/^[0-9]{4}$/);
    expect(p1?.secretCode).not.toBe(p2?.secretCode);
  });

  it('gère l’infection : la capture d’un fuyard le convertit en chasseur et la partie continue', () => {
    room.addPlayer('r1', 'Runner1', true);
    room.addPlayer('r2', 'Runner2', false);
    room.addPlayer('h1', 'Hunter1', false);

    room.setPlayerRole('r1', 'runner');
    room.setPlayerRole('r2', 'runner');
    room.setPlayerRole('h1', 'hunter');

    room.startGame();
    room.advanceTime(10000); // En mode hunting

    const r1Code = room.getPlayer('r1')!.secretCode!;

    // Hunter1 capture Runner1
    const captureResult = room.claimCapture('h1', r1Code);
    expect(captureResult.success).toBe(true);
    expect(captureResult.allCaptured).toBe(false);

    // Runner1 doit maintenant être converti en Chasseur (Infection)
    expect(room.getPlayer('r1')?.role).toBe('hunter');

    // La partie continue car Runner2 est encore vivant
    expect(room.state).toBe('hunting');
    expect(room.winner).toBeNull();
  });

  it('termine la partie avec victoire des chasseurs quand le dernier fuyard est capturé', () => {
    room.addPlayer('r1', 'Runner1', true);
    room.addPlayer('r2', 'Runner2', false);
    room.addPlayer('h1', 'Hunter1', false);

    room.setPlayerRole('r1', 'runner');
    room.setPlayerRole('r2', 'runner');
    room.setPlayerRole('h1', 'hunter');

    room.startGame();
    room.advanceTime(10000);

    const r1Code = room.getPlayer('r1')!.secretCode!;
    const r2Code = room.getPlayer('r2')!.secretCode!;

    // Capture du premier fuyard
    room.claimCapture('h1', r1Code);
    expect(room.state).toBe('hunting');

    // Capture du dernier fuyard
    const finalCapture = room.claimCapture('h1', r2Code);
    expect(finalCapture.success).toBe(true);
    expect(finalCapture.allCaptured).toBe(true);

    expect(room.state).toBe('game_over');
    expect(room.winner).toBe('hunters');
  });

  it('génère un ping sonar pour chacun des fuyards encore vivants', () => {
    room.addPlayer('r1', 'Runner1', true);
    room.addPlayer('r2', 'Runner2', false);
    room.addPlayer('h1', 'Hunter1', false);

    room.setPlayerRole('r1', 'runner');
    room.setPlayerRole('r2', 'runner');
    room.setPlayerRole('h1', 'hunter');

    room.startGame();
    room.advanceTime(10000);

    room.updatePlayerPosition('r1', 48.8584, 2.2945);
    room.updatePlayerPosition('r2', 48.8556, 2.2986);

    const pingResult = room.triggerSonarPing();
    expect(pingResult.pings).toHaveLength(2);
  });

  it('gère les atouts/bonus à usage unique (1x par partie) pour les fuyards', () => {
    room.addPlayer('r1', 'Runner1', true);
    room.addPlayer('h1', 'Hunter1', false);
    room.setPlayerRole('r1', 'runner');
    room.setPlayerRole('h1', 'hunter');

    room.startGame();
    room.advanceTime(10000);

    // 1ère utilisation de Ghost : Succès
    const ghost1 = room.usePerk('r1', 'ghost');
    expect(ghost1.success).toBe(true);

    // 2ème utilisation de Ghost : Rejetée (usage unique)
    const ghost2 = room.usePerk('r1', 'ghost');
    expect(ghost2.success).toBe(false);
    expect(ghost2.message).toContain('déjà utilisé');

    // Le fuyard ne peut pas utiliser un atout de chasseur
    const hunterPerk = room.usePerk('r1', 'sonar_flash');
    expect(hunterPerk.success).toBe(false);
    expect(hunterPerk.message).toContain('réservé aux chasseurs');
  });

  it('gère les atouts/bonus à usage unique (1x par partie) pour les chasseurs (sonar_flash & triangulation)', () => {
    room.addPlayer('r1', 'Runner1', true);
    room.addPlayer('h1', 'Hunter1', false);
    room.setPlayerRole('r1', 'runner');
    room.setPlayerRole('h1', 'hunter');

    room.startGame();
    room.advanceTime(10000);
    room.updatePlayerPosition('r1', 48.8584, 2.2945);

    // 1ère utilisation de Sonar Flash par le chasseur : Succès et déclenchement d'un ping immédiat
    const flash1 = room.usePerk('h1', 'sonar_flash');
    expect(flash1.success).toBe(true);
    expect(flash1.pingTriggered).toBe(true);
    expect(flash1.pingResult?.pings).toHaveLength(1);

    // 2ème utilisation de Sonar Flash : Rejetée
    const flash2 = room.usePerk('h1', 'sonar_flash');
    expect(flash2.success).toBe(false);
    expect(flash2.message).toContain('déjà utilisé');

    // 1ère utilisation de Triangulation par le chasseur : Succès
    const tri1 = room.usePerk('h1', 'triangulation');
    expect(tri1.success).toBe(true);

    // 2ème utilisation de Triangulation : Rejetée
    const tri2 = room.usePerk('h1', 'triangulation');
    expect(tri2.success).toBe(false);
    expect(tri2.message).toContain('déjà utilisé');

    // Le chasseur ne peut pas utiliser un atout de fuyard
    const runnerPerk = room.usePerk('h1', 'ghost');
    expect(runnerPerk.success).toBe(false);
    expect(runnerPerk.message).toContain('réservé aux fuyards');
  });

  it('rétrécit la zone de jeu en mode Battle Royale (shrinkEnabled)', () => {
    room.updateSettings({
      shrinkEnabled: true,
      shrinkIntervalMinutes: 2,
      shrinkStepMeters: 100,
      minZoneRadiusMeters: 200,
      zoneRadiusMeters: 1000,
    });

    room.addPlayer('r1', 'Runner', true);
    room.setPlayerRole('r1', 'runner');
    room.startGame();

    // Fin du head start
    room.advanceTime(10000);
    expect(room.settings.zoneRadiusMeters).toBe(1000);

    // Avance de 2 minutes (120 000 ms)
    room.advanceTime(125000);
    expect(room.settings.zoneRadiusMeters).toBe(900);

    // Avance de 2 autres minutes
    room.advanceTime(125000);
    expect(room.settings.zoneRadiusMeters).toBe(800);
  });

  it('calcule la distance cumulée, les breadcrumbs et génère les gameStats de fin de partie', () => {
    room.addPlayer('r1', 'Runner1', true);
    room.addPlayer('h1', 'Hunter1', false);
    room.setPlayerRole('r1', 'runner');
    room.setPlayerRole('h1', 'hunter');

    room.startGame();
    room.advanceTime(10000); // Mode hunting

    // Déplacement de Hunter1 (environ 50 mètres)
    room.updatePlayerPosition('h1', 48.8584, 2.2945);
    room.advanceTime(3000);
    room.updatePlayerPosition('h1', 48.8588, 2.2945);

    const hunter = room.getPlayer('h1');
    expect(hunter?.distanceTraveledMeters).toBeGreaterThan(30);
    expect(hunter?.breadcrumbs.length).toBeGreaterThanOrEqual(1);

    // Capture et fin de partie
    const r1Code = room.getPlayer('r1')!.secretCode!;
    room.claimCapture('h1', r1Code);

    expect(room.state).toBe('game_over');
    const publicState = room.getPublicState('h1') as any;
    expect(publicState.gameStats).toBeDefined();
    expect(publicState.gameStats.mvpHunter?.id).toBe('h1');
    expect(publicState.gameStats.topMarathonian?.id).toBe('h1');
    expect(publicState.gameStats.playersStats).toHaveLength(2);
  });
});
