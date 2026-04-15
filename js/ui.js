// ui.js — Menu and overlay DOM management. No game logic.

import { isMobile, isPortrait } from './inputHandler.js';

export class UI {
  constructor({ onStart }) {
    this.onStart = onStart;
    this._selectedMode = 'best1';
    this._selectedCPU = 1;
    this._portraitHandler = null;

    this._bindMenu();
    this._checkPortrait();
    if (isMobile()) this._watchOrientation();
  }

  // ── Menu ──────────────────────────────────────────────────────────

  _bindMenu() {
    // Mode buttons
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mode]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._selectedMode = btn.dataset.mode;
      });
    });

    // CPU count buttons
    document.querySelectorAll('[data-cpu]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cpu]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._selectedCPU = parseInt(btn.dataset.cpu, 10);
      });
    });

    // Start button
    document.getElementById('start-btn').addEventListener('click', () => {
      if (isMobile() && isPortrait()) return; // guard: shouldn't be reachable
      this.onStart({ gameMode: this._selectedMode, numCPU: this._selectedCPU });
    });
  }

  // ── Screen switching ──────────────────────────────────────────────

  showMenu() {
    document.getElementById('menu-screen').classList.add('active');
    document.getElementById('game-screen').classList.remove('active');
    this.hideOverlays();
  }

  showGame() {
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    this.hideOverlays();
  }

  hideOverlays() {
    document.querySelectorAll('.overlay').forEach((el) => el.classList.remove('active'));
  }

  // ── Round over overlay ────────────────────────────────────────────

  showRoundOver(state, onContinue) {
    const overlay = document.getElementById('round-over-overlay');
    const title = document.getElementById('round-over-title');
    const sub = document.getElementById('round-over-sub');

    const winner = state.roundWinner;
    if (winner) {
      title.textContent = `${winner.name} wins the round!`;
      title.style.color = winner.color;
    } else {
      title.textContent = 'Draw!';
      title.style.color = '#aaa';
    }

    const modeLabel =
      state.gameMode === 'endless'
        ? `Round ${state.currentRound}`
        : `Round ${state.currentRound} of ${state.maxRounds}`;
    sub.textContent = modeLabel;

    overlay.classList.add('active');

    // Auto-continue after 2.5s
    const timeout = setTimeout(() => {
      overlay.classList.remove('active');
      onContinue();
    }, 2500);

    // Manual skip on click
    const skip = () => {
      clearTimeout(timeout);
      overlay.classList.remove('active');
      overlay.removeEventListener('click', skip);
      onContinue();
    };
    overlay.addEventListener('click', skip);
  }

  // ── Game over overlay ─────────────────────────────────────────────

  showGameOver(state, onMenu) {
    const overlay = document.getElementById('game-over-overlay');
    const title = document.getElementById('game-over-title');
    const scoreTable = document.getElementById('score-table');

    const winner = state.gameWinner;
    if (winner) {
      title.textContent = `${winner.name} wins!`;
      title.style.color = winner.color;
    } else {
      title.textContent = 'Game Over';
      title.style.color = '#aaa';
    }

    // Build score table
    scoreTable.innerHTML = '';
    for (const p of [...state.players].sort((a, b) => b.score - a.score)) {
      const name = document.createElement('span');
      name.className = 'score-name';
      name.textContent = p.name;
      name.style.color = p.color;

      const val = document.createElement('span');
      val.className = 'score-val';
      val.textContent = `${p.score} win${p.score !== 1 ? 's' : ''}`;
      val.style.color = p.color;

      scoreTable.appendChild(name);
      scoreTable.appendChild(val);
    }

    overlay.classList.add('active');

    document.getElementById('menu-btn').onclick = () => {
      overlay.classList.remove('active');
      onMenu();
    };
  }

  // ── Portrait overlay ──────────────────────────────────────────────

  _checkPortrait() {
    const overlay = document.getElementById('portrait-overlay');
    if (isMobile() && isPortrait()) {
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }

  _watchOrientation() {
    const handler = () => this._checkPortrait();
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    this._portraitHandler = handler;
  }

  destroy() {
    if (this._portraitHandler) {
      window.removeEventListener('resize', this._portraitHandler);
      window.removeEventListener('orientationchange', this._portraitHandler);
    }
  }
}
