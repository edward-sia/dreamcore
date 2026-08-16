import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LevelBase } from '../src/core/LevelBase.js';

function fakeGame() {
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.08, 600);
  camera.rotation.order = 'YXZ';
  const subs = [];
  return {
    engine: { camera, pulseGrade() {} },
    ui: {
      subtitle: (t, d, o) => subs.push({ t, d, o }),
      flash() {}, setObjective() {}, addClue() {}, showNote() {}, setItems() {},
    },
    audio: {
      sfx() {}, sfxAt() {}, setDread() {}, hush() {},
      loopAt: () => ({ stop() {}, setPosition() {}, setGain() {} }),
    },
    interaction: { add() {}, clear() {}, remove() {}, setEnabled() {} },
    player: { setColliders() {}, position: new THREE.Vector3(0, 1.62, 0) },
    save: { data: { captions: false } },
    subs,
  };
}
class L extends LevelBase { build() {} }
function lookAlong(camera, yaw) {
  camera.position.set(0, 1.62, 0);
  camera.rotation.set(0, yaw, 0);
  camera.updateMatrixWorld(true);
}
function objAt(x, y, z) {
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.updateMatrixWorld(true); return o;
}

test('tune() maps letters to frequencies', () => {
  assert.deepEqual(LevelBase.tune('EGA'), [329.63, 392.0, 440.0]);
});

test('isSeen: ahead is seen, behind is not, beyond maxDist is not', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const obj = objAt(0, 1.5, -5);
  lookAlong(g.engine.camera, 0);              // yaw 0 faces -Z
  assert.equal(lvl.isSeen(obj), true);
  assert.equal(lvl.isSeen(obj, { maxDist: 3 }), false);
  lookAlong(g.engine.camera, Math.PI);        // faces +Z
  assert.equal(lvl.isSeen(obj), false);
});

test('isSeen: an occluder between camera and object hides it', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const obj = objAt(0, 1.5, -5);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial());
  wall.position.set(0, 1.5, -2); wall.updateMatrixWorld(true);
  lookAlong(g.engine.camera, 0);
  assert.equal(lvl.isSeen(obj, { occluders: [wall] }), false);
  assert.equal(lvl.isSeen(obj), true);
});

test('whenUnseen fires once after minTime unseen; whenSeen mirrors it', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const obj = objAt(0, 1.5, -5);
  let unseen = 0, seen = 0;
  lvl.whenUnseen(obj, () => unseen++, { minTime: 0.4 });
  lvl.whenSeen(obj, () => seen++, { minTime: 0.15 });
  lookAlong(g.engine.camera, 0);
  for (let i = 0; i < 10; i++) lvl.update(0.1, i * 0.1);
  assert.equal(unseen, 0);
  assert.equal(seen, 1);
  lookAlong(g.engine.camera, Math.PI);
  for (let i = 0; i < 3; i++) lvl.update(0.1, 1 + i * 0.1);
  assert.equal(unseen, 0);                    // 0.3 s < 0.4 s
  for (let i = 0; i < 3; i++) lvl.update(0.1, 2 + i * 0.1);
  assert.equal(unseen, 1);
  for (let i = 0; i < 10; i++) lvl.update(0.1, 3 + i * 0.1);
  assert.equal(unseen, 1);                    // once
});

test('whenUnseen with once:false fires one time per look-away', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const obj = objAt(0, 1.5, -5);
  let n = 0;
  lvl.whenUnseen(obj, () => n++, { minTime: 0.2, once: false });
  lookAlong(g.engine.camera, Math.PI);
  for (let i = 0; i < 10; i++) lvl.update(0.1, i * 0.1);
  assert.equal(n, 1);
  lookAlong(g.engine.camera, 0);
  lvl.update(0.1, 2);
  lookAlong(g.engine.camera, Math.PI);
  for (let i = 0; i < 5; i++) lvl.update(0.1, 3 + i * 0.1);
  assert.equal(n, 2);
});

test('directionWord', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  lookAlong(g.engine.camera, 0);
  assert.equal(lvl.directionWord({ x: 0, y: 1.5, z: -3 }), 'ahead');
  assert.equal(lvl.directionWord({ x: 0, y: 1.5, z: 3 }), 'behind you');
  assert.equal(lvl.directionWord({ x: -3, y: 1.5, z: 0 }), 'to your left');
  assert.equal(lvl.directionWord({ x: 3, y: 1.5, z: 0 }), 'to your right');
  assert.equal(lvl.directionWord({ x: 0, y: 4, z: -1 }), 'above you');
});

test('cue appends a direction only when captions are on, in the cue voice', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  lookAlong(g.engine.camera, 0);
  lvl.cue('knocking', { x: 0, y: 1.5, z: -3 });
  assert.equal(g.subs.at(-1).t, '[knocking]');
  g.save.data.captions = true;
  lvl.cue('knocking', { x: 0, y: 1.5, z: -3 });
  assert.equal(g.subs.at(-1).t, '[knocking] — ahead');
  assert.equal(g.subs.at(-1).o.voice, 'cue');
});

test('addBlocker returns its box; removeBlocker removes it; loops stop on dispose', () => {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const b = lvl.addBlocker([0, 0, 0], [1, 1, 1]);
  assert.equal(lvl.solids.length, 1);
  lvl.removeBlocker(b);
  assert.equal(lvl.solids.length, 0);
  let stopped = 0;
  g.audio.loopAt = () => ({ stop() { stopped++; }, setPosition() {}, setGain() {} });
  lvl.loopAt('tap', { x: 0, y: 0, z: 0 });
  lvl.dispose();
  assert.equal(stopped, 1);
});
