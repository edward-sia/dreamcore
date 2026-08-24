import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeChild } from '../src/core/presence.js';
import { makeClockFace } from '../src/core/props.js';

test('makeChild is small, lit, shadow-casting, faceless, with a torch that switches', () => {
  const c = makeChild();
  const box = new THREE.Box3().setFromObject(c);
  assert.ok(box.max.y > 1.0 && box.max.y < 1.25, `height ${box.max.y}`);
  let meshes = 0;
  c.traverse((o) => { if (o.isMesh && o !== c._lens) { meshes++; } });
  assert.ok(meshes >= 4);
  const body = c.children.find((o) => o.isMesh);
  assert.equal(body.castShadow, true);
  assert.ok(body.material.color.getHex() > 0x404040, 'lit material, not the figure\'s black');
  assert.ok(c.torch.isSpotLight);
  assert.equal(c.torch.intensity, 0);
  c.setTorch(true);
  assert.equal(c.torch.intensity, 6);
  c.setTorch(false);
  assert.equal(c.torch.intensity, 0);
  assert.equal(c.userData.isChild, true);
  c.faceToward({ x: 0, y: 0, z: 5 });
  assert.ok(Math.abs(c.rotation.y) < 1e-6);
  c.faceToward({ x: 5, y: 0, z: 0 });
  assert.ok(Math.abs(c.rotation.y - Math.PI / 2) < 1e-6);
});

test('makeChild: the torch target sits in front of the child (local +Z)', () => {
  const c = makeChild();
  c.updateMatrixWorld(true);
  const p = new THREE.Vector3(); c.torch.target.getWorldPosition(p);
  assert.ok(p.z > 2, `target z ${p.z}`);
});

test('makeClockFace: setTime turns the hands; animate 0 is instant; update eases toward the target', () => {
  const clock = makeClockFace({ radius: 0.16 });
  clock.setTime(3, 0, 0);
  const hour = clock._hour, minute = clock._minute;
  assert.ok(Math.abs(hour.rotation.z + Math.PI / 2) < 1e-6, 'three o\'clock: the hour hand a quarter turn clockwise');
  assert.ok(Math.abs(minute.rotation.z) < 1e-6);
  clock.setTime(6, 30, 1.0);
  assert.ok(Math.abs(hour.rotation.z + Math.PI / 2) < 1e-6, 'not yet moved');
  clock.update(0.5);
  const mid = hour.rotation.z;
  assert.ok(mid < -Math.PI / 2 && mid > -Math.PI * 13 / 12, `moving clockwise: ${mid}`);
  clock.update(0.6);
  assert.ok(Math.abs(hour.rotation.z + Math.PI * 13 / 12) < 1e-6, 'half past six: 6.5/12 of a turn');
  assert.ok(Math.abs(minute.rotation.z + Math.PI) < 1e-6);
});
