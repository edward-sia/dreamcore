import {
  stickVector, lookDelta, isTap, HurryGate, STICK_RADIUS,
} from './touchmath.js';

const STICK_ZONE = 0.45; // left fraction of the screen that births the stick

/**
 * Owns every touch gesture (spec §3): the drift stick, the look drag, and
 * tap-the-thing. One stick touch and one look touch may live at once,
 * tracked by identifier. The word-pill and corner words are plain buttons
 * wired in main.js — touches that start on them never reach #app.
 */
export class TouchControls {
  constructor({ player, interaction, ui, app }) {
    this.player = player;
    this.interaction = interaction;
    this.ui = ui;
    this._stick = null;   // { id, ox, oy, dx, dy } — where the thumb landed, and where it is now
    this._look = null;    // { id, x, y, startX, startY, startT, travel }
    this._gate = new HurryGate();
    this._ring = document.getElementById('touch-stick');
    this._pebble = document.getElementById('touch-stick-pebble');

    app.addEventListener('touchstart', (e) => this._start(e), { passive: false });
    app.addEventListener('touchmove', (e) => this._move(e), { passive: false });
    app.addEventListener('touchend', (e) => this._end(e));
    app.addEventListener('touchcancel', (e) => this._end(e, true));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  /**
   * Called once per frame from the engine loop: the stick feeds the player
   * every frame it lives (spec §3.1) so a thumb held still at the rim still
   * walks, and still crosses the hurry delay (spec §3.2).
   */
  update() {
    const s = this._stick;
    if (!s) return;
    const v = stickVector(s.dx, s.dy);
    this.player.setMoveInput(v.fwd, v.strafe, this._gate.update(v.mag, performance.now()));
  }

  /** Drop every live touch (modal opened, tab hidden, level change). */
  reset() {
    this._stick = null;
    this._look = null;
    this._gate = new HurryGate();
    this.player.setMoveInput(0, 0, false);
    this._ring.classList.add('hidden');
    this._ring.classList.remove('driving');
  }

  _start(e) {
    if (this.ui.modalOpen || this.player.frozen) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      // Which zone the touch lands in decides what it is — a second finger in
      // the walk zone is not a look drag, it is a finger the stick already has.
      if (t.clientX < window.innerWidth * STICK_ZONE) {
        if (this._stick) continue;
        this._stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
        this._ring.style.left = `${t.clientX}px`;
        this._ring.style.top = `${t.clientY}px`;
        this._pebble.style.transform = 'translate(0px, 0px)';
        this._ring.classList.remove('hidden', 'driving');
      } else if (!this._look) {
        this._look = {
          id: t.identifier, x: t.clientX, y: t.clientY,
          startX: t.clientX, startY: t.clientY,
          startT: performance.now(), travel: 0,
        };
      }
    }
  }

  _move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this._stick && t.identifier === this._stick.id) {
        const dx = t.clientX - this._stick.ox;
        const dy = t.clientY - this._stick.oy;
        this._stick.dx = dx;
        this._stick.dy = dy;
        const len = Math.hypot(dx, dy) || 1;
        const clamp = Math.min(len, STICK_RADIUS);
        this._pebble.style.transform =
          `translate(${(dx / len) * clamp}px, ${(dy / len) * clamp}px)`;
        this._ring.classList.toggle('driving', stickVector(dx, dy).mag > 0);
      } else if (this._look && t.identifier === this._look.id) {
        const dx = t.clientX - this._look.x;
        const dy = t.clientY - this._look.y;
        this._look.travel += Math.hypot(dx, dy);
        this._look.x = t.clientX;
        this._look.y = t.clientY;
        const d = lookDelta(dx, dy, this.player.sensitivity);
        this.player.addLook(d.dyaw, d.dpitch);
      }
    }
  }

  _end(e, cancelled = false) {
    for (const t of e.changedTouches) {
      if (this._stick && t.identifier === this._stick.id) {
        this._stick = null;
        this._gate = new HurryGate();
        this.player.setMoveInput(0, 0, false);
        this._ring.classList.add('hidden');
        this._ring.classList.remove('driving');
      } else if (this._look && t.identifier === this._look.id) {
        const l = this._look;
        this._look = null;
        // A cancelled touch is one the player did not finish — the OS took the
        // gesture (edge swipe, notification shade, a call). It is never a tap.
        if (!cancelled && isTap(performance.now() - l.startT, l.travel)
            && !this.ui.modalOpen && !this.player.frozen) {
          // spec §3.4: a tap fires only when it lands on the current gaze target
          const ndcX = (t.clientX / window.innerWidth) * 2 - 1;
          const ndcY = -(t.clientY / window.innerHeight) * 2 + 1;
          this.interaction.triggerFromPoint(ndcX, ndcY);
        }
      }
    }
  }
}
