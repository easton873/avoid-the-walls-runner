// gameEngine.js — Pure game logic, no DOM access.
// All functions return new state objects (immutable-style).

export const GRID_WIDTH = 80;
export const GRID_HEIGHT = 50;
export const BOOST_DURATION = 8;
export const BOOST_FLOOD_THRESHOLD = 30;

const PLAYER_COLORS = ['#00f5ff', '#ff4757', '#2ed573', '#ffa502'];
const PLAYER_NAMES = ['You', 'CPU 1', 'CPU 2', 'CPU 3'];

const STARTING_POSITIONS = [
  { x: 15, y: 25, direction: 'right' },
  { x: 65, y: 25, direction: 'left' },
  { x: 38, y: 10, direction: 'down' },
  { x: 42, y: 40, direction: 'up' },
];

const OPPOSITES = { up: 'down', down: 'up', left: 'right', right: 'left' };

const DIR_DELTA = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx: 1,  dy:  0 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellKey(x, y) {
  return `${x},${y}`;
}

function buildOccupied(players) {
  const set = new Set();
  for (const p of players) {
    for (const cell of p.trail) {
      set.add(cellKey(cell.x, cell.y));
    }
  }
  return set;
}

function clonePlayer(p) {
  return {
    ...p,
    trail: p.trail.slice(),
  };
}

function cloneState(state) {
  const players = state.players.map(clonePlayer);
  return {
    ...state,
    players,
    occupiedCells: buildOccupied(players),
  };
}

function isOutOfBounds(x, y, w, h) {
  return x < 0 || y < 0 || x >= w || y >= h;
}

// ---------------------------------------------------------------------------
// createGame
// ---------------------------------------------------------------------------

export function createGame({ numCPU, gameMode }) {
  const totalPlayers = 1 + numCPU;
  const maxRounds = gameMode === 'best1' ? 1 : gameMode === 'best3' ? 3 : Infinity;

  const players = [];
  for (let i = 0; i < totalPlayers; i++) {
    const pos = STARTING_POSITIONS[i];
    players.push({
      id: i,
      name: PLAYER_NAMES[i],
      x: pos.x,
      y: pos.y,
      direction: pos.direction,
      nextDirection: pos.direction,
      alive: true,
      trail: [{ x: pos.x, y: pos.y }],
      boostUsed: false,
      boostTicksLeft: 0,
      color: PLAYER_COLORS[i],
      isHuman: i === 0,
      score: 0,
      directionStepsCount: 3,
    });
  }

  return {
    players,
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    occupiedCells: buildOccupied(players),
    gameMode,
    currentRound: 1,
    maxRounds,
    phase: 'playing',
    roundWinner: null,
    gameWinner: null,
    tickCount: 0,
  };
}

// ---------------------------------------------------------------------------
// queueDirection — validate and queue a direction change for a player
// ---------------------------------------------------------------------------

export function queueDirection(state, playerId, dir) {
  const player = state.players[playerId];
  if (!player || !player.alive) return state;
  if (!DIR_DELTA[dir]) return state;
  // Reject 180-degree flip
  if (OPPOSITES[player.direction] === dir) return state;

  const newPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, nextDirection: dir } : p
  );
  return { ...state, players: newPlayers };
}

// ---------------------------------------------------------------------------
// activateBoost
// ---------------------------------------------------------------------------

export function activateBoost(state, playerId) {
  const player = state.players[playerId];
  if (!player || !player.alive || player.boostUsed) return state;

  const newPlayers = state.players.map((p) =>
    p.id === playerId
      ? { ...p, boostUsed: true, boostTicksLeft: BOOST_DURATION }
      : p
  );
  return { ...state, players: newPlayers };
}

// ---------------------------------------------------------------------------
// movePlayer — move a single player one step (internal)
// ---------------------------------------------------------------------------

function movePlayer(player, occupied, gridWidth, gridHeight) {
  if (!player.alive) return player;

  // Apply queued direction (only if not a 180)
  let dir = player.direction;
  if (player.nextDirection !== dir && OPPOSITES[dir] !== player.nextDirection) {
    dir = player.nextDirection;
  }

  const { dx, dy } = DIR_DELTA[dir];
  const steps = player.boostTicksLeft > 0 ? 2 : 1;
  const newTrail = player.trail.slice();
  let x = player.x;
  let y = player.y;
  let alive = true;

  for (let s = 0; s < steps; s++) {
    const nx = x + dx;
    const ny = y + dy;

    if (isOutOfBounds(nx, ny, gridWidth, gridHeight)) {
      alive = false;
      break;
    }
    // Will check collision against full occupied set after all players move
    x = nx;
    y = ny;
    newTrail.push({ x, y });
  }

  const dirChanged = dir !== player.direction;
  const directionStepsCount = dirChanged ? 1 : (player.directionStepsCount ?? 3) + 1;

  return {
    ...player,
    x,
    y,
    direction: dir,
    directionStepsCount,
    alive,
    trail: newTrail,
    boostTicksLeft: Math.max(0, player.boostTicksLeft - 1),
  };
}

// ---------------------------------------------------------------------------
// checkCollisions — mark players dead if their new head is in occupied cells
// ---------------------------------------------------------------------------

export function checkCollisions(state) {
  // Build occupied set from trails EXCLUDING each player's own new head
  // (head-to-head collisions: both die)
  const newPlayers = state.players.map(clonePlayer);

  // Build set of all trail cells (includes new positions already added by movePlayer)
  const allCells = new Map(); // cellKey -> [playerIds]
  for (const p of newPlayers) {
    for (const cell of p.trail) {
      const key = cellKey(cell.x, cell.y);
      if (!allCells.has(key)) allCells.set(key, []);
      allCells.get(key).push(p.id);
    }
  }

  // Build set of "old" cells (all trail cells except the very last one added per player)
  const oldCells = new Set();
  for (const p of newPlayers) {
    // Everything except the last 1 (or 2 if boosting, but after move boostTicksLeft already decremented)
    const steps = (p.boostTicksLeft === BOOST_DURATION - 1 && p.boostUsed) ? 2 : 1;
    for (let i = 0; i < p.trail.length - steps; i++) {
      oldCells.add(cellKey(p.trail[i].x, p.trail[i].y));
    }
  }

  // Head positions of alive players
  const headKeys = new Map();
  for (const p of newPlayers) {
    if (p.alive) headKeys.set(cellKey(p.x, p.y), p.id);
  }

  for (const p of newPlayers) {
    if (!p.alive) continue;
    const hk = cellKey(p.x, p.y);

    // Collision with old trail cells
    if (oldCells.has(hk)) {
      p.alive = false;
      continue;
    }

    // Head-to-head: another alive player's head is at same cell
    for (const [key, id] of headKeys) {
      if (key === hk && id !== p.id) {
        p.alive = false;
        break;
      }
    }
  }

  return {
    ...state,
    players: newPlayers,
    occupiedCells: buildOccupied(newPlayers),
  };
}

// ---------------------------------------------------------------------------
// getAIInput — BFS flood fill to choose best direction for a CPU player
// ---------------------------------------------------------------------------

export function getAIInput(state, playerId) {
  const player = state.players[playerId];
  if (!player || !player.alive) return player?.direction ?? 'right';

  const dirs = ['up', 'down', 'left', 'right'].filter(
    (d) => OPPOSITES[player.direction] !== d
  );

  // Require at least 2 steps in the current direction before allowing a turn.
  // Turns are still allowed as an emergency fallback if going straight is blocked.
  const canTurn = (player.directionStepsCount ?? 3) >= 3;
  const primaryDirs = canTurn ? dirs : dirs.filter((d) => d === player.direction);
  const emergencyDirs = canTurn ? [] : dirs.filter((d) => d !== player.direction);

  let bestDir = null;
  let bestScore = -1;

  for (const d of primaryDirs) {
    const { dx, dy } = DIR_DELTA[d];
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (isOutOfBounds(nx, ny, state.gridWidth, state.gridHeight)) continue;
    if (state.occupiedCells.has(cellKey(nx, ny))) continue;
    const openCells = floodFill(nx, ny, state.occupiedCells, state.gridWidth, state.gridHeight, 200);
    if (openCells > bestScore) {
      bestScore = openCells;
      bestDir = d;
    }
  }

  // Straight is blocked — allow turns as emergency to avoid dying
  if (bestDir === null) {
    for (const d of emergencyDirs) {
      const { dx, dy } = DIR_DELTA[d];
      const nx = player.x + dx;
      const ny = player.y + dy;
      if (isOutOfBounds(nx, ny, state.gridWidth, state.gridHeight)) continue;
      if (state.occupiedCells.has(cellKey(nx, ny))) continue;
      const openCells = floodFill(nx, ny, state.occupiedCells, state.gridWidth, state.gridHeight, 200);
      if (openCells > bestScore) {
        bestScore = openCells;
        bestDir = d;
      }
    }
  }

  return bestDir ?? player.direction;
}

function floodFill(startX, startY, occupied, w, h, maxCells) {
  const visited = new Set();
  const queue = [{ x: startX, y: startY }];
  visited.add(cellKey(startX, startY));
  let count = 0;

  while (queue.length > 0 && count < maxCells) {
    const { x, y } = queue.shift();
    count++;

    for (const { dx, dy } of Object.values(DIR_DELTA)) {
      const nx = x + dx;
      const ny = y + dy;
      const key = cellKey(nx, ny);
      if (!isOutOfBounds(nx, ny, w, h) && !occupied.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// tick — advance game state by one step
// ---------------------------------------------------------------------------

export function tick(state) {
  if (state.phase !== 'playing') return state;

  let s = cloneState(state);

  // Apply AI inputs for CPU players
  for (const p of s.players) {
    if (!p.isHuman && p.alive) {
      const aiDir = getAIInput(s, p.id);
      s = queueDirection(s, p.id, aiDir);

      // AI boost: use if in tight space
      if (!p.boostUsed) {
        const openCells = floodFill(p.x, p.y, s.occupiedCells, s.gridWidth, s.gridHeight, 200);
        if (openCells < BOOST_FLOOD_THRESHOLD) {
          s = activateBoost(s, p.id);
        }
      }
    }
  }

  // Move all alive players
  const movedPlayers = s.players.map((p) =>
    movePlayer(p, s.occupiedCells, s.gridWidth, s.gridHeight)
  );

  s = { ...s, players: movedPlayers, occupiedCells: buildOccupied(movedPlayers) };

  // Check collisions
  s = checkCollisions(s);

  s = { ...s, tickCount: s.tickCount + 1 };

  // Check round over
  if (isRoundOver(s)) {
    s = resolveRound(s);
  }

  return s;
}

// ---------------------------------------------------------------------------
// isRoundOver
// ---------------------------------------------------------------------------

export function isRoundOver(state) {
  const alive = state.players.filter((p) => p.alive);
  if (state.players.length === 1) {
    return alive.length === 0; // solo: only over when dead
  }
  return alive.length <= 1;
}

// ---------------------------------------------------------------------------
// resolveRound — set winner, update scores, advance phase
// ---------------------------------------------------------------------------

export function resolveRound(state) {
  const alive = state.players.filter((p) => p.alive);
  const roundWinner = alive.length === 1 ? alive[0] : null;

  const newPlayers = state.players.map((p) => {
    if (roundWinner && p.id === roundWinner.id) {
      return { ...p, score: p.score + 1 };
    }
    return p;
  });

  const updatedState = {
    ...state,
    players: newPlayers,
    roundWinner: roundWinner ? newPlayers.find((p) => p.id === roundWinner.id) : null,
    phase: 'roundOver',
  };

  if (isGameOver(updatedState)) {
    const gameWinner = getGameWinner(updatedState);
    return { ...updatedState, phase: 'gameOver', gameWinner };
  }

  return updatedState;
}

// ---------------------------------------------------------------------------
// startNextRound — reset positions, trails, boost; increment round counter
// ---------------------------------------------------------------------------

export function startNextRound(state) {
  const players = state.players.map((p, i) => {
    const pos = STARTING_POSITIONS[i];
    return {
      ...p,
      x: pos.x,
      y: pos.y,
      direction: pos.direction,
      nextDirection: pos.direction,
      alive: true,
      trail: [{ x: pos.x, y: pos.y }],
      boostUsed: false,
      boostTicksLeft: 0,
    };
  });

  return {
    ...state,
    players,
    occupiedCells: buildOccupied(players),
    currentRound: state.currentRound + 1,
    phase: 'playing',
    roundWinner: null,
    tickCount: 0,
  };
}

// ---------------------------------------------------------------------------
// isGameOver / getGameWinner
// ---------------------------------------------------------------------------

export function isGameOver(state) {
  if (state.gameMode === 'endless') return false;

  const winsNeeded = state.gameMode === 'best3' ? 2 : 1;
  return state.players.some((p) => p.score >= winsNeeded);
}

export function getGameWinner(state) {
  const winsNeeded = state.gameMode === 'best3' ? 2 : 1;
  return state.players.find((p) => p.score >= winsNeeded) ?? null;
}
