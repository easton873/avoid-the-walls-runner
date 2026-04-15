// main.js — Game loop, wires engine + renderer + input + ui together.

import {
  createGame,
  queueDirection,
  activateBoost,
  tick,
  startNextRound,
} from './gameEngine.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './inputHandler.js';
import { UI } from './ui.js';

const TICK_INTERVAL_MS = 1000 / 12; // 12 ticks per second

// ── State ──────────────────────────────────────────────────────────

let gameState = null;
let inputHandler = null;
let renderer = null;
let ui = null;
let lastTickTime = 0;
let animFrameId = null;
let phase = 'menu'; // local phase tracker: 'menu' | 'countdown' | 'playing' | 'paused'
let countdownValue = 3;
let countdownTimer = null;

// ── Boot ───────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  renderer = new Renderer(canvas);

  ui = new UI({ onStart: startGame });
  ui.showMenu();
});

// ── Start / restart ────────────────────────────────────────────────

function startGame({ gameMode, numCPU }) {
  if (inputHandler) {
    inputHandler.destroy();
    inputHandler = null;
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  gameState = createGame({ gameMode, numCPU });
  ui.showGame();

  inputHandler = new InputHandler({
    onDirection: (dir) => {
      if (gameState && gameState.phase === 'playing') {
        gameState = queueDirection(gameState, 0, dir);
      }
    },
    onBoost: () => {
      if (gameState && gameState.phase === 'playing') {
        if (!gameState.players[0].boostUsed) {
          gameState = activateBoost(gameState, 0);
          inputHandler.markBoostUsed();
        }
      }
    },
  });

  beginCountdown();
}

// ── Countdown ──────────────────────────────────────────────────────

function beginCountdown() {
  countdownValue = 3;
  phase = 'countdown';

  // Draw the initial game state so arena is visible during countdown
  if (renderer && gameState) renderer.draw(gameState);

  countdownTimer = setInterval(() => {
    if (renderer && gameState) {
      renderer.draw(gameState);
      renderer.drawCountdown(countdownValue);
    }
    countdownValue--;
    if (countdownValue < 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      phase = 'playing';
      lastTickTime = performance.now();
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }, 800);
}

// ── Game loop ──────────────────────────────────────────────────────

function gameLoop(now) {
  if (phase !== 'playing') return;

  if (now - lastTickTime >= TICK_INTERVAL_MS) {
    lastTickTime = now;
    gameState = tick(gameState);

    // Sync boost button state
    if (inputHandler && gameState.players[0].boostUsed) {
      inputHandler.markBoostUsed();
    }

    if (gameState.phase === 'roundOver') {
      renderer.draw(gameState);
      phase = 'paused';
      ui.showRoundOver(gameState, () => {
        if (gameState.phase === 'gameOver') {
          // resolveRound already set gameOver — show game over
          ui.showGameOver(gameState, goToMenu);
        } else {
          gameState = startNextRound(gameState);
          if (inputHandler) inputHandler.resetBoost();
          beginCountdown();
        }
      });
      return;
    }

    if (gameState.phase === 'gameOver') {
      renderer.draw(gameState);
      phase = 'paused';
      ui.showGameOver(gameState, goToMenu);
      return;
    }
  }

  renderer.draw(gameState);
  animFrameId = requestAnimationFrame(gameLoop);
}

// ── Go to menu ─────────────────────────────────────────────────────

function goToMenu() {
  phase = 'menu';
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (inputHandler) {
    inputHandler.destroy();
    inputHandler = null;
  }
  gameState = null;
  ui.showMenu();
}
