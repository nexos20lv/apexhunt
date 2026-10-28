import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from '../game/Room.js';

describe('GameRoom State Machine & Capture Validation', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom('WOLF', {
      durationMinutes: 30,
      headStartMinutes: 0.1, // 6 secondes pour le test
      pingIntervalSeconds: 60,
      zoneCenter: { lat: 48.8584, lng: 2.2945 },
      zoneRadiusMeters: 1000,
    });
  });

  it('initialise la room dans l’état lobby avec un code secret à 4 chiffres généré', () => {
    expect(room.code).toBe('WOLF');
    expect(room.state).toBe('lobby');
    expect(room.secretCode).toMatch(/^[0-9]{4}$/);
  });

  it('permet aux joueurs de rejoindre et d’attribuer les rôles', () => {
    room.addPlayer('p1', 'Alice', true);
    room.addPlayer('p2', 'Bob', false);

    room.setPlayerRole('p1', 'runner');
    room.setPlayerRole('p2', 'hunter');

    const players = room.getPlayers();
    expect(players.find((p) => p.id === 'p1')?.role).toBe('runner');
    expect(players.find((p) => p.id === 'p2')?.role).toBe('hunter');
  });

  it('démarre la partie en phase head_start puis transitionne en hunting', () => {
    room.addPlayer('p1', 'Alice', true);
    room.addPlayer('p2', 'Bob', false);
    room.setPlayerRole('p1', 'runner');
    room.setPlayerRole('p2', 'hunter');

    room.startGame();
    expect(room.state).toBe('head_start');

    // Avance le temps après le head_start
    room.advanceTime(10000); // 10 secondes
    expect(room.state).toBe('hunting');
  });

  it('valide la capture uniquement si le code à 4 chiffres est exact', () => {
    room.addPlayer('p1', 'Alice', true);
    room.addPlayer('p2', 'Bob', false);
    room.setPlayerRole('p1', 'runner');
    room.setPlayerRole('p2', 'hunter');
    room.startGame();
    room.advanceTime(10000); // En mode hunting

    const secret = room.secretCode;
    const wrongCode = secret === '1234' ? '4321' : '1234';

    // Tentative avec code erroné
    const failAttempt = room.claimCapture('p2', wrongCode);
    expect(failAttempt.success).toBe(false);
    expect(room.state).toBe('hunting');
    expect(room.winner).toBeNull();

    // Tentative avec le bon code secret
    const successAttempt = room.claimCapture('p2', secret);
    expect(successAttempt.success).toBe(true);
    expect(room.state).toBe('game_over');
    expect(room.winner).toBe('hunters');
  });

  it('gère l’atout Ghost Mode qui occulte le prochain ping', () => {
    room.addPlayer('p1', 'Alice', true);
    room.addPlayer('p2', 'Bob', false);
    room.setPlayerRole('p1', 'runner');
    room.setPlayerRole('p2', 'hunter');
    room.startGame();
    room.advanceTime(10000);

    room.updatePlayerPosition('p1', 48.8584, 2.2945);

    // Runner active le Ghost Mode
    const perkResult = room.usePerk('p1', 'ghost');
    expect(perkResult.success).toBe(true);

    // Déclenchement d'un tick de ping
    const ping = room.triggerSonarPing();
    expect(ping.isGhosted).toBe(true);
  });
});
