import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeFigure, Presence } from '../src/core/presence.js';

function fakeLevel(seenFn) {
  return { game: { player: { position: new THREE.Vector3(0, 1.62, 0) } }, isSeen: seenFn };
}

test('makeFigure builds a dark, shadowless group of the requested height', () => {
  const f = makeFigure({ height: 1.95 });
  const box = new THREE.Box3().setFromObject(f);
  assert.ok(box.max.y > 1.8 && box.max.y < 2.05, `height ${box.max.y}`);
  let meshes = 0;
  f.traverse((o) => { if (o.isMesh) { meshes++; assert.equal(o.castShadow, false); assert.ok(o.material.color.getHex() < 0x202020); } });
  assert.ok(meshes >= 3);
  assert.equal(f.userData.isFigure, true);
  f.faceToward({ x: 0, y: 0, z: 5 });
  assert.ok(Math.abs(f.rotation.y) < 1e-6);
});

test('Presence advances one station per unseen interval, only while unseen', () => {
  let seen = true;
  const lvl = fakeLevel(() => seen);
  const fig = makeFigure();
  const arrived = [];
  const p = new Presence(lvl, fig, {
    stations: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
    minUnseen: 0.6,
    onArrive: (i) => arrived.push(i),
  });
  p.placeAt(0);
  p.advanceTo(2);
  for (let i = 0; i < 20; i++) p.update(0.1);
  assert.equal(p.index, 0);                    // watched: never moves
  seen = false;
  for (let i = 0; i < 7; i++) p.update(0.1);   // 0.7 s unseen → one hop
  assert.equal(p.index, 1);
  assert.deepEqual(arrived, [1]);
  for (let i = 0; i < 7; i++) p.update(0.1);
  assert.equal(p.index, 2);
  for (let i = 0; i < 20; i++) p.update(0.1);
  assert.equal(p.index, 2);                    // target reached: stays
  assert.equal(p.isArmed(), false);
  assert.equal(fig.position.x, 2);
});

test('enabled=false freezes it; hide() hides; walkTo moves smoothly and calls onDone', () => {
  const lvl = fakeLevel(() => false);
  const fig = makeFigure();
  const p = new Presence(lvl, fig, { stations: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] });
  p.placeAt(0);
  p.advanceTo(1);
  p.enabled = false;
  for (let i = 0; i < 20; i++) p.update(0.1);
  assert.equal(p.index, 0);
  let done = false;
  p.walkTo({ x: 0, y: 0, z: -3 }, 1.5, () => { done = true; });
  for (let i = 0; i < 25; i++) p.update(0.1);   // 2.5 s at 1.5 m/s covers 3 m
  assert.ok(done);
  assert.ok(Math.abs(fig.position.z + 3) < 1e-6);
  p.hide();
  assert.equal(fig.visible, false);
  assert.equal(p.enabled, false);
});
