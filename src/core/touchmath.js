// Pure gesture math for the touch controls. No DOM, no three.js — every
// number a thumb produces is decided here, where node:test can reach it.

export const STICK_RADIUS = 56;     // CSS px: ring radius = max thumb travel
export const STICK_DEADZONE = 8;    // CSS px ignored around where the thumb landed
export const LOOK_PER_PX = 0.0035;  // radians of head-turn per CSS px of drag
export const TAP_MAX_MS = 250;      // a press longer than this is a drag
export const TAP_MAX_TRAVEL = 12;   // a press that moved further is a drag
export const HURRY_ON = 0.95;       // |v| at/above the rim (after the delay) hurries
export const HURRY_OFF = 0.85;      // |v| below this stops hurrying (hysteresis)
export const HURRY_DELAY_MS = 150;  // the rim must be held this long

/** Thumb offset from the stick origin (CSS px) -> {fwd, strafe, mag} in [-1, 1]. */
export function stickVector(dx, dy, radius = STICK_RADIUS, dead = STICK_DEADZONE) {
  const len = Math.hypot(dx, dy);
  if (len <= dead) return { fwd: 0, strafe: 0, mag: 0 };
  const mag = (Math.min(len, radius) - dead) / (radius - dead);
  return { fwd: (-dy / len) * mag, strafe: (dx / len) * mag, mag };
}

/** Look-drag delta (CSS px) -> {dyaw, dpitch} in radians, sensitivity applied. */
export function lookDelta(dx, dy, sensitivity = 1) {
  const s = LOOK_PER_PX * sensitivity;
  return { dyaw: -dx * s, dpitch: -dy * s };
}

/** A press is a tap if it was quick and did not travel. */
export function isTap(durationMs, travelPx) {
  return durationMs < TAP_MAX_MS && travelPx < TAP_MAX_TRAVEL;
}

/** Rim-hold state machine: feed it |v| and a clock, read back hurrying. */
export class HurryGate {
  constructor() { this.hurrying = false; this._since = null; }
  update(mag, nowMs) {
    if (this.hurrying) {
      if (mag < HURRY_OFF) this.hurrying = false;
    } else if (mag >= HURRY_ON) {
      if (this._since === null) this._since = nowMs;
      else if (nowMs - this._since >= HURRY_DELAY_MS) this.hurrying = true;
    } else {
      this._since = null;
    }
    if (!this.hurrying && mag < HURRY_ON) this._since = null;
    return this.hurrying;
  }
}
