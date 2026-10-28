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
});
