import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LevelBase } from '../src/core/LevelBase.js';

function fakeGame() {
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.08, 600);
  camera.rotation.order = 'YXZ';
  const calls = { moods: [], sfxAt: [] };
  return {
    engine: { camera, pulseGrade() {}, setGrade() {} },
    ui: { subtitle() {}, flash() {}, setObjective() {}, addClue() {}, showNote() {}, setItems() {} },
    audio: {
      sfx() {}, sfxAt: (name, pos, opts) => calls.sfxAt.push({ name, pos: { ...pos }, opts }),
      setDread() {}, hush() {}, setAmbience: (m) => calls.moods.push(m),
      loopAt: () => ({ stop() {}, setPosition() {}, setGain() {} }),
    },
    interaction: { add() {}, clear() {}, remove() {}, setEnabled() {} },
    player: { setColliders() {}, position: new THREE.Vector3(0, 1.62, 0) },
    save: { data: { captions: false } },
    calls,
  };
}
class L extends LevelBase { build() {} }
function camAt(camera, x, z, yaw) {
  camera.position.set(x, 1.62, z);
  camera.rotation.set(0, yaw, 0);
  camera.updateMatrixWorld(true);
}
function looker(x, z, yaw) {
  const o = new THREE.Object3D();
  o.position.set(x, 0, z);
  o.rotation.y = yaw;            // local +Z is its front; rotation.y = 0 faces +Z
  o.updateMatrixWorld(true);
  return o;
}

test('setMood forwards to audio.setAmbience', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  lvl.setMood('evening');
  assert.deepEqual(g.calls.moods, ['evening']);
});

test('isSeenBy: the camera inside the object\'s forward cone is seen; behind it is not', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const child = looker(0, 0, 0);             // faces +Z
  camAt(g.engine.camera, 0, 4, 0);           // 4 m in front of it
  assert.equal(lvl.isSeenBy(child, { eye: new THREE.Vector3(0, 0.95, 0) }), true);
  camAt(g.engine.camera, 0, -4, 0);          // behind it
  assert.equal(lvl.isSeenBy(child), false);
  camAt(g.engine.camera, 0, 12, 0);          // beyond maxDist
  assert.equal(lvl.isSeenBy(child, { maxDist: 8 }), false);
  camAt(g.engine.camera, 3, 4, 0);           // 37° off the axis: inside 45, outside 30
  assert.equal(lvl.isSeenBy(child, { angleDeg: 45 }), true);
  assert.equal(lvl.isSeenBy(child, { angleDeg: 30 }), false);
});

test('isSeenBy: an occluder between the object and the camera hides the camera', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const child = looker(0, 0, 0);
  camAt(g.engine.camera, 0, 4, 0);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2), new THREE.MeshBasicMaterial());
  wall.position.set(0, 1.5, 2); wall.updateMatrixWorld(true);
  assert.equal(lvl.isSeenBy(child, { occluders: [wall] }), false);
  wall.position.set(0, 1.5, 6); wall.updateMatrixWorld(true);   // beyond the camera
  assert.equal(lvl.isSeenBy(child, { occluders: [wall] }), true);
});

test('footsteps walks a polyline at a stride, one positional sound per step, then onDone', async () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  let done = false; const steps = [];
  lvl.footsteps([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }],
    { stride: 1, every: 0.01, sound: 'smallStep', opts: { soft: true }, onStep: (i, p) => steps.push([i, p.x, p.z]), onDone: () => { done = true; } });
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(done, true);
  assert.equal(g.calls.sfxAt.length, 4);                       // length 3 → floor(3/1)+1 = 4 steps
  assert.equal(g.calls.sfxAt[0].name, 'smallStep');
  assert.equal(g.calls.sfxAt[0].opts.soft, true);
  assert.deepEqual(steps.map((s) => s.slice(1)), [[0, 0], [1, 0], [2, 0], [2, 1]]);
});

test('footsteps: cancel() stops the remaining steps', async () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const cancel = lvl.footsteps([{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }], { stride: 1, every: 0.02 });
  await new Promise((r) => setTimeout(r, 30));
  cancel();
  const n = g.calls.sfxAt.length;
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(g.calls.sfxAt.length, n);
  assert.ok(n >= 1 && n < 6);
});
