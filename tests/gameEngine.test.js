import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createGame,
  queueDirection,
  activateBoost,
  tick,
  checkCollisions,
  isRoundOver,
  resolveRound,
  startNextRound,
  isGameOver,
  getGameWinner,
  getAIInput,
  GRID_WIDTH,
  GRID_HEIGHT,
  BOOST_DURATION,
} from '../js/gameEngine.js';

// ---------------------------------------------------------------------------
// createGame
// ---------------------------------------------------------------------------

describe('createGame', () => {
  it('creates correct number of players', () => {
    const state = createGame({ numCPU: 2, gameMode: 'best1' });
    expect(state.players.length).toBe(3);
  });

  it('player 0 is human', () => {
    const state = createGame({ numCPU: 1, gameMode: 'best1' });
    expect(state.players[0].isHuman).toBe(true);
    expect(state.players[1].isHuman).toBe(false);
  });

  it('all players start alive', () => {
    const state = createGame({ numCPU: 3, gameMode: 'best3' });
    expect(state.players.every((p) => p.alive)).toBe(true);
  });

  it('starts in playing phase', () => {
    const state = createGame({ numCPU: 1, gameMode: 'best1' });
    expect(state.phase).toBe('playing');
  });

  it('each player starts with a trail of length 1', () => {
    const state = createGame({ numCPU: 2, gameMode: 'best1' });
    for (const p of state.players) {
      expect(p.trail.length).toBe(1);
    }
  });

  it('sets maxRounds = 1 for best1', () => {
    const state = createGame({ numCPU: 1, gameMode: 'best1' });
    expect(state.maxRounds).toBe(1);
  });

  it('sets maxRounds = 3 for best3', () => {
    const state = createGame({ numCPU: 1, gameMode: 'best3' });
    expect(state.maxRounds).toBe(3);
  });

  it('sets maxRounds = Infinity for endless', () => {
    const state = createGame({ numCPU: 1, gameMode: 'endless' });
    expect(state.maxRounds).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// queueDirection
// ---------------------------------------------------------------------------

describe('queueDirection', () => {
  let state;
  beforeEach(() => {
    state = createGame({ numCPU: 1, gameMode: 'best1' });
    // Player 0 starts going 'right'
  });

  it('accepts a valid direction change', () => {
    const s = queueDirection(state, 0, 'up');
    expect(s.players[0].nextDirection).toBe('up');
  });

  it('rejects a 180-degree flip (right → left)', () => {
    const s = queueDirection(state, 0, 'left');
    expect(s.players[0].nextDirection).toBe('right'); // unchanged
  });

  it('rejects a 180-degree flip (up → down)', () => {
    let s = queueDirection(state, 0, 'up');
    // simulate direction update
    s = { ...s, players: s.players.map((p) => p.id === 0 ? { ...p, direction: 'up' } : p) };
    s = queueDirection(s, 0, 'down');
    expect(s.players[0].nextDirection).toBe('up'); // unchanged
  });

  it('ignores input for dead player', () => {
    const deadState = {
      ...state,
      players: state.players.map((p) => p.id === 0 ? { ...p, alive: false } : p),
    };
    const s = queueDirection(deadState, 0, 'up');
    expect(s).toBe(deadState); // exact same reference
  });

  it('ignores unknown direction', () => {
    const s = queueDirection(state, 0, 'diagonal');
    expect(s).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// activateBoost
// ---------------------------------------------------------------------------

describe('activateBoost', () => {
  let state;
  beforeEach(() => {
    state = createGame({ numCPU: 1, gameMode: 'best1' });
  });

  it('sets boostTicksLeft and boostUsed', () => {
    const s = activateBoost(state, 0);
    expect(s.players[0].boostTicksLeft).toBe(BOOST_DURATION);
    expect(s.players[0].boostUsed).toBe(true);
  });

  it('second activation does nothing', () => {
    const s1 = activateBoost(state, 0);
    const s2 = activateBoost(s1, 0);
    expect(s2).toBe(s1);
  });

  it('does nothing for dead player', () => {
    const deadState = {
      ...state,
      players: state.players.map((p) => p.id === 0 ? { ...p, alive: false } : p),
    };
    const s = activateBoost(deadState, 0);
    expect(s).toBe(deadState);
  });
});

// ---------------------------------------------------------------------------
// Movement via tick
// ---------------------------------------------------------------------------

describe('tick — movement', () => {
  it('player moves 1 cell per tick normally', () => {
    let state = createGame({ numCPU: 0, gameMode: 'endless' });
    // 0 CPU so no AI interference; player 0 starts at (15,25) going right
    const before = { x: state.players[0].x, y: state.players[0].y };
    state = tick(state);
    expect(state.players[0].x).toBe(before.x + 1);
    expect(state.players[0].y).toBe(before.y);
  });

  it('player moves 2 cells per tick while boosting', () => {
    let state = createGame({ numCPU: 0, gameMode: 'endless' });
    const before = { x: state.players[0].x };
    state = activateBoost(state, 0);
    state = tick(state);
    expect(state.players[0].x).toBe(before.x + 2);
  });

  it('trail grows by 1 cell per tick normally', () => {
    let state = createGame({ numCPU: 0, gameMode: 'endless' });
    const before = state.players[0].trail.length;
    state = tick(state);
    expect(state.players[0].trail.length).toBe(before + 1);
  });

  it('trail grows by 2 cells per tick while boosting', () => {
    let state = createGame({ numCPU: 0, gameMode: 'endless' });
    const before = state.players[0].trail.length;
    state = activateBoost(state, 0);
    state = tick(state);
    expect(state.players[0].trail.length).toBe(before + 2);
  });

  it('boostTicksLeft decrements each tick', () => {
    let state = createGame({ numCPU: 0, gameMode: 'endless' });
    state = activateBoost(state, 0);
    expect(state.players[0].boostTicksLeft).toBe(BOOST_DURATION);
    state = tick(state);
    expect(state.players[0].boostTicksLeft).toBe(BOOST_DURATION - 1);
  });

  it('tickCount increments each tick', () => {
    let state = createGame({ numCPU: 0, gameMode: 'endless' });
    state = tick(state);
    expect(state.tickCount).toBe(1);
    state = tick(state);
    expect(state.tickCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

describe('checkCollisions', () => {
  function makeState(overrides = {}) {
    const base = createGame({ numCPU: 1, gameMode: 'endless' });
    return { ...base, ...overrides };
  }

  it('player dies when head enters an occupied cell', () => {
    let state = createGame({ numCPU: 0, gameMode: 'endless' });
    // Manually set player 0 head on top of an occupied cell in their own trail
    // Add a cell ahead of the player to occupied
    const p = state.players[0];
    const trail = [...p.trail, { x: p.x + 1, y: p.y }]; // next cell already in trail
    const players = [{ ...p, trail }];
    state = {
      ...state,
      players,
      occupiedCells: new Set([`${p.x},${p.y}`, `${p.x + 1},${p.y}`]),
    };
    // Move player right into their own extended trail
    const movedPlayers = [{ ...players[0], x: p.x + 1, trail: [...trail, { x: p.x + 1, y: p.y }] }];
    state = { ...state, players: movedPlayers };
    state = checkCollisions(state);
    expect(state.players[0].alive).toBe(false);
  });

  it('player dies when out of bounds (handled by movePlayer → alive=false)', () => {
    let state = createGame({ numCPU: 0, gameMode: 'endless' });
    // Move player to edge then push them over
    state = {
      ...state,
      players: [{ ...state.players[0], x: GRID_WIDTH - 1, y: 25, direction: 'right', nextDirection: 'right' }],
    };
    state = tick(state);
    expect(state.players[0].alive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRoundOver
// ---------------------------------------------------------------------------

describe('isRoundOver', () => {
  it('returns false when multiple players alive', () => {
    const state = createGame({ numCPU: 2, gameMode: 'best1' });
    expect(isRoundOver(state)).toBe(false);
  });

  it('returns true when exactly 1 player alive', () => {
    let state = createGame({ numCPU: 2, gameMode: 'best1' });
    state = {
      ...state,
      players: state.players.map((p, i) => ({ ...p, alive: i === 0 })),
    };
    expect(isRoundOver(state)).toBe(true);
  });

  it('returns true when 0 players alive', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best1' });
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, alive: false })),
    };
    expect(isRoundOver(state)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveRound
// ---------------------------------------------------------------------------

describe('resolveRound', () => {
  it('increments score for the surviving player', () => {
    let state = createGame({ numCPU: 2, gameMode: 'best3' });
    state = {
      ...state,
      players: state.players.map((p, i) => ({ ...p, alive: i === 1 })),
    };
    const resolved = resolveRound(state);
    expect(resolved.players[1].score).toBe(1);
    expect(resolved.players[0].score).toBe(0);
  });

  it('sets roundWinner', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best3' });
    state = {
      ...state,
      players: state.players.map((p, i) => ({ ...p, alive: i === 0 })),
    };
    const resolved = resolveRound(state);
    expect(resolved.roundWinner.id).toBe(0);
  });

  it('sets phase to roundOver when game not over', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best3' });
    state = {
      ...state,
      players: state.players.map((p, i) => ({ ...p, alive: i === 0 })),
    };
    const resolved = resolveRound(state);
    expect(resolved.phase).toBe('roundOver');
  });

  it('sets phase to gameOver when game is over', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best1' });
    state = {
      ...state,
      players: state.players.map((p, i) => ({ ...p, alive: i === 0 })),
    };
    const resolved = resolveRound(state);
    expect(resolved.phase).toBe('gameOver');
  });
});

// ---------------------------------------------------------------------------
// startNextRound
// ---------------------------------------------------------------------------

describe('startNextRound', () => {
  it('resets all players to alive', () => {
    let state = createGame({ numCPU: 2, gameMode: 'best3' });
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, alive: false })),
    };
    const next = startNextRound(state);
    expect(next.players.every((p) => p.alive)).toBe(true);
  });

  it('clears trails to length 1', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best3' });
    state = tick(tick(tick(state)));
    const next = startNextRound(state);
    expect(next.players.every((p) => p.trail.length === 1)).toBe(true);
  });

  it('resets boostUsed', () => {
    let state = createGame({ numCPU: 0, gameMode: 'best3' });
    state = activateBoost(state, 0);
    const next = startNextRound(state);
    expect(next.players[0].boostUsed).toBe(false);
  });

  it('increments currentRound', () => {
    const state = createGame({ numCPU: 1, gameMode: 'best3' });
    const next = startNextRound(state);
    expect(next.currentRound).toBe(2);
  });

  it('sets phase to playing', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best3' });
    state = { ...state, phase: 'roundOver' };
    const next = startNextRound(state);
    expect(next.phase).toBe('playing');
  });
});

// ---------------------------------------------------------------------------
// isGameOver
// ---------------------------------------------------------------------------

describe('isGameOver', () => {
  it('returns false for endless mode', () => {
    let state = createGame({ numCPU: 1, gameMode: 'endless' });
    state = { ...state, players: state.players.map((p, i) => ({ ...p, score: i === 0 ? 99 : 0 })) };
    expect(isGameOver(state)).toBe(false);
  });

  it('returns true for best1 after 1 win', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best1' });
    state = { ...state, players: state.players.map((p, i) => ({ ...p, score: i === 0 ? 1 : 0 })) };
    expect(isGameOver(state)).toBe(true);
  });

  it('returns false for best3 with only 1 win', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best3' });
    state = { ...state, players: state.players.map((p, i) => ({ ...p, score: i === 0 ? 1 : 0 })) };
    expect(isGameOver(state)).toBe(false);
  });

  it('returns true for best3 when someone has 2 wins', () => {
    let state = createGame({ numCPU: 1, gameMode: 'best3' });
    state = { ...state, players: state.players.map((p, i) => ({ ...p, score: i === 0 ? 2 : 0 })) };
    expect(isGameOver(state)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAIInput
// ---------------------------------------------------------------------------

describe('getAIInput', () => {
  it('returns a valid direction string', () => {
    const state = createGame({ numCPU: 1, gameMode: 'endless' });
    const dir = getAIInput(state, 1);
    expect(['up', 'down', 'left', 'right']).toContain(dir);
  });

  it('does not return a 180-flip direction', () => {
    const state = createGame({ numCPU: 1, gameMode: 'endless' });
    // CPU 1 starts going 'left', so should never return 'right'
    const dir = getAIInput(state, 1);
    expect(dir).not.toBe('right');
  });

  it('avoids immediate collision', () => {
    let state = createGame({ numCPU: 1, gameMode: 'endless' });
    const cpu = state.players[1]; // starts at (65,25) going left
    // Block left and up, should go down
    const blocked = new Set(state.occupiedCells);
    blocked.add(`${cpu.x - 1},${cpu.y}`);   // left blocked
    blocked.add(`${cpu.x},${cpu.y - 1}`);   // up blocked
    state = { ...state, occupiedCells: blocked };
    const dir = getAIInput(state, 1);
    expect(dir).not.toBe('left');
    expect(dir).not.toBe('up');
  });
});
