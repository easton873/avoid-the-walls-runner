// renderer.js — Canvas drawing only. No game logic.

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = this.canvas.offsetWidth * devicePixelRatio;
    this.canvas.height = this.canvas.offsetHeight * devicePixelRatio;
  }

  // Main draw call — takes a GameState from gameEngine
  draw(state) {
    const { ctx, canvas } = this;
    const cw = canvas.width;
    const ch = canvas.height;

    const cellW = cw / state.gridWidth;
    const cellH = ch / state.gridHeight;

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, cw, ch);

    // Optional subtle grid lines
    ctx.strokeStyle = '#ffffff08';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= state.gridWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellW, 0);
      ctx.lineTo(x * cellW, ch);
      ctx.stroke();
    }
    for (let y = 0; y <= state.gridHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellH);
      ctx.lineTo(cw, y * cellH);
      ctx.stroke();
    }

    // Trails
    for (const player of state.players) {
      if (player.trail.length === 0) continue;

      ctx.fillStyle = player.color + '99'; // semi-transparent trail
      for (const cell of player.trail) {
        ctx.fillRect(
          cell.x * cellW + 0.5,
          cell.y * cellH + 0.5,
          cellW - 1,
          cellH - 1
        );
      }

      // Draw head brighter
      if (player.alive) {
        const headR = Math.min(cellW, cellH) * 0.65;
        const cx = player.x * cellW + cellW / 2;
        const cy = player.y * cellH + cellH / 2;

        ctx.save();
        ctx.shadowColor = player.color;
        ctx.shadowBlur = player.boostTicksLeft > 0 ? 18 : 8;
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(cx, cy, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Boost ring
        if (player.boostTicksLeft > 0) {
          ctx.save();
          ctx.strokeStyle = player.color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(cx, cy, headR + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // HUD — round info top-left, scores top-right
    this._drawHUD(state, cw, ch);
  }

  _drawHUD(state, cw, ch) {
    const { ctx } = this;
    const scale = devicePixelRatio;
    const fontSize = Math.max(11, Math.round(12 * scale));

    ctx.font = `${fontSize}px 'Courier New', monospace`;
    ctx.fillStyle = '#ffffff66';

    // Round info
    const roundLabel =
      state.gameMode === 'endless'
        ? `ROUND ${state.currentRound}`
        : `ROUND ${state.currentRound} / ${state.maxRounds}`;
    ctx.fillText(roundLabel, 10 * scale, 18 * scale);

    // Scores
    let x = cw - 10 * scale;
    for (let i = state.players.length - 1; i >= 0; i--) {
      const p = state.players[i];
      const label = `${p.name}: ${p.score}`;
      const w = ctx.measureText(label).width;
      x -= w + 12 * scale;
      ctx.fillStyle = p.alive ? p.color : p.color + '55';
      ctx.fillText(label, x, 18 * scale);
    }
  }

  drawCountdown(n) {
    const { ctx, canvas } = this;
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = devicePixelRatio;

    ctx.save();
    ctx.fillStyle = '#00f5ffcc';
    ctx.font = `bold ${80 * scale}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 30;
    ctx.fillText(n > 0 ? String(n) : 'GO!', cw / 2, ch / 2);
    ctx.restore();
  }
}
