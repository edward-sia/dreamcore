import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stickVector, lookDelta, isTap, HurryGate,
  STICK_RADIUS, STICK_DEADZONE,
} from '../src/core/touchmath.js';

test('stick: inside the dead zone is stillness', () => {
  assert.deepEqual(stickVector(4, -4), { fwd: 0, strafe: 0, mag: 0 });
});

test('stick: full push up is full forward', () => {
  const v = stickVector(0, -STICK_RADIUS);
  assert.equal(v.fwd, 1);
  assert.equal(v.strafe, 0);
  assert.equal(v.mag, 1);
});

test('stick: travel past the rim clamps to 1', () => {
  assert.equal(stickVector(0, -200).mag, 1);
});

test('stick: partial push scales from the dead zone edge', () => {
  // len 24 -> (24-8)/(56-8) = 1/3, all of it strafe
  const v = stickVector(24, 0);
  assert.ok(Math.abs(v.strafe - 1 / 3) < 1e-9);
  assert.equal(Math.abs(v.fwd), 0);   // -dy/len is -0 when dy is 0; strict equal is Object.is
});

test('look: left drag turns left, sensitivity scales', () => {
  assert.ok(Math.abs(lookDelta(-100, 0, 1).dyaw - 0.35) < 1e-9);
  assert.ok(Math.abs(lookDelta(0, 50, 2).dpitch + 0.35) < 1e-9);
});

test('tap: quick and still is a tap; slow or travelled is not', () => {
  assert.equal(isTap(200, 5), true);
  assert.equal(isTap(300, 5), false);
  assert.equal(isTap(100, 20), false);
});

test('hurry: the rim must be held, and releases with hysteresis', () => {
  const g = new HurryGate();
  assert.equal(g.update(1.0, 0), false);    // just arrived at the rim
  assert.equal(g.update(1.0, 100), false);  // 100ms < 150ms
  assert.equal(g.update(1.0, 200), true);   // held long enough
  assert.equal(g.update(0.9, 300), true);   // 0.9 >= HURRY_OFF: still hurrying
  assert.equal(g.update(0.8, 400), false);  // below 0.85: released
  assert.equal(g.update(0.96, 500), false); // re-approach restarts the clock
  assert.equal(g.update(0.96, 700), true);
});

test('hurry: dipping off the rim before the delay restarts the clock', () => {
  const g = new HurryGate();
  g.update(1.0, 0);
  g.update(0.5, 100);                       // left the rim
  assert.equal(g.update(1.0, 200), false);  // clock restarted at 200
  assert.equal(g.update(1.0, 349), false);
  assert.equal(g.update(1.0, 350), true);
});

test('dead zone edges: exactly at the dead zone is still, just past it moves', () => {
  assert.equal(stickVector(STICK_DEADZONE, 0).mag, 0);
  assert.ok(stickVector(STICK_DEADZONE + 0.001, 0).mag > 0);
});

test('stick: a diagonal push never exceeds unit magnitude', () => {
  const v = stickVector(STICK_RADIUS, -STICK_RADIUS);
  assert.equal(v.mag, 1);
  assert.ok(Math.abs(Math.hypot(v.fwd, v.strafe) - 1) < 1e-9);
});

test('look: no drag is no turn', () => {
  assert.deepEqual(lookDelta(0, 0), { dyaw: -0, dpitch: -0 });
});
