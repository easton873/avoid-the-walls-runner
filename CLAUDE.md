# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build (bundle JS for the browser)
npm run build

# Watch mode (rebuilds on file changes)
npm run dev

# Run tests
npm test

# Run a single test file
node --experimental-vm-modules node_modules/.bin/jest tests/gameEngine.test.js
```

The game runs by opening `index.html` in a browser after building. There is no dev server — esbuild produces `bundle.js` which is loaded directly by `index.html`.

## Architecture

The project is a Tron-style browser game. The codebase is split into four strictly separated layers:

### `js/gameEngine.js` — Pure logic (no DOM)
All game state is plain JS objects. Every exported function takes a state and returns a **new** state (immutable-style). Key exports:
- `createGame({ numCPU, gameMode })` — creates initial state
- `tick(state)` — advances one game step: runs AI, moves all players, checks collisions, resolves round/game over
- `queueDirection(state, playerId, dir)` — queues a direction change (rejects 180-degree flips)
- `activateBoost(state, playerId)` — one-time speed boost (2 cells/tick for `BOOST_DURATION` ticks)
- `checkCollisions(state)` — marks players dead on trail or head-to-head collisions
- `getAIInput(state, playerId)` — BFS flood-fill picks the direction with most open space

The `occupiedCells` field on state is a `Set<string>` of `"x,y"` keys rebuilt on every state clone.

### `js/renderer.js` — Canvas drawing only
`Renderer` takes the canvas element and exposes `draw(state)` and `drawCountdown(n)`. It reads from game state but never modifies it. Scales everything by `devicePixelRatio`.

### `js/inputHandler.js` — Keyboard and touch input
`InputHandler` wraps keyboard (WASD/arrows/space) and mobile touch (D-pad + boost button) events. Calls `onDirection(dir)` and `onBoost()` callbacks. `destroy()` removes all listeners.

### `js/ui.js` — Menu and overlay DOM management
`UI` manages screen transitions (`showMenu`, `showGame`) and overlays (`showRoundOver`, `showGameOver`). Handles portrait-mode warning on mobile. Imports `isMobile()` / `isPortrait()` from `inputHandler.js`.

### `js/main.js` — Wiring and game loop
The entry point. Owns the `requestAnimationFrame` loop running at 12 ticks/second. Manages the countdown phase (3-second timer before each round starts). Coordinates all four modules — game engine state flows through: `tick()` → `renderer.draw()`, player input → `queueDirection()` / `activateBoost()`.

### Game modes
- `best1` — first to 1 win ends the game
- `best3` — first to 2 wins ends the game
- `endless` — rounds continue forever

### State shape (key fields)
```js
{
  players: [{ id, name, x, y, direction, nextDirection, alive, trail, boostUsed, boostTicksLeft, color, isHuman, score }],
  gridWidth: 80, gridHeight: 50,
  occupiedCells: Set<string>,   // rebuilt each tick
  phase: 'playing' | 'roundOver' | 'gameOver',
  gameMode, currentRound, maxRounds, roundWinner, gameWinner, tickCount
}
```

## Testing

Tests live in `tests/gameEngine.test.js` and cover only `gameEngine.js` (pure logic). The renderer, UI, and input handler have no tests (they require a DOM). Jest is configured to use native ES modules (`"type": "module"` in package.json, `--experimental-vm-modules` flag).
