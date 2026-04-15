// inputHandler.js — Keyboard and touch input. No game logic.
// Calls provided callbacks: onDirection(dir), onBoost()

const KEY_MAP = {
  w: 'up', W: 'up', ArrowUp: 'up',
  s: 'down', S: 'down', ArrowDown: 'down',
  a: 'left', A: 'left', ArrowLeft: 'left',
  d: 'right', D: 'right', ArrowRight: 'right',
};

export function isMobile() {
  return window.matchMedia('(pointer: coarse)').matches;
}

export function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

export class InputHandler {
  constructor({ onDirection, onBoost }) {
    this.onDirection = onDirection;
    this.onBoost = onBoost;
    this._teardowns = [];
    this._boostUsed = false;

    if (isMobile()) {
      this._setupMobile();
    } else {
      this._setupKeyboard();
    }
  }

  markBoostUsed() {
    this._boostUsed = true;
    const btn = document.getElementById('boost-mobile-btn');
    if (btn) btn.classList.add('used');
  }

  resetBoost() {
    this._boostUsed = false;
    const btn = document.getElementById('boost-mobile-btn');
    if (btn) btn.classList.remove('used');
  }

  _setupKeyboard() {
    const handler = (e) => {
      if (e.repeat) return;
      if (KEY_MAP[e.key]) {
        e.preventDefault();
        this.onDirection(KEY_MAP[e.key]);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this._boostUsed) this.onBoost();
      }
    };
    window.addEventListener('keydown', handler);
    this._teardowns.push(() => window.removeEventListener('keydown', handler));
  }

  _setupMobile() {
    const controls = document.getElementById('mobile-controls');
    if (controls) controls.classList.add('visible');

    const dirs = ['up', 'down', 'left', 'right'];
    for (const dir of dirs) {
      const btn = document.getElementById(`dpad-${dir}`);
      if (!btn) continue;
      const handler = (e) => {
        e.preventDefault();
        this.onDirection(dir);
      };
      btn.addEventListener('touchstart', handler, { passive: false });
      this._teardowns.push(() => btn.removeEventListener('touchstart', handler));
    }

    const boostBtn = document.getElementById('boost-mobile-btn');
    if (boostBtn) {
      const handler = (e) => {
        e.preventDefault();
        if (!this._boostUsed) this.onBoost();
      };
      boostBtn.addEventListener('touchstart', handler, { passive: false });
      this._teardowns.push(() => boostBtn.removeEventListener('touchstart', handler));
    }
  }

  destroy() {
    for (const fn of this._teardowns) fn();
    this._teardowns = [];
    const controls = document.getElementById('mobile-controls');
    if (controls) controls.classList.remove('visible');
  }
}
