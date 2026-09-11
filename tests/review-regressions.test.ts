import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Interaction } from '../src/core/Interaction.js';
import { LevelBase } from '../src/core/LevelBase.js';

const documentStub = { addEventListener() {} };
function interaction() {
  (globalThis as any).document = documentStub;
  const camera = new THREE.PerspectiveCamera();
  camera.updateMatrixWorld();
  const ui = { prompt: null, modalOpen: false, setPrompt(p) { this.prompt = p; } };
  const input = new Interaction(camera, ui);
  input.enabled = true;
  return { input, ui };
}
function meshAt(z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), new THREE.MeshBasicMaterial());
  mesh.position.z = z;
  mesh.updateMatrixWorld();
  return mesh;
}

test('a board with a four metre range can be read at 3.5 metres', () => {
  const { input } = interaction();
  const board = meshAt(-3.5);
  input.add(board, { distance: 4, prompt: 'departures' });
  input.update();
  assert.equal(input.current, board);
});

test('hidden descendants and hidden hour groups cannot become gaze targets', () => {
  const { input } = interaction();
  const group = new THREE.Group();
  const hidden = meshAt(-2);
  group.add(hidden);
  hidden.visible = false;
  input.add(group, { prompt: 'hidden' });
  input.update();
  assert.equal(input.current, null);
  input.clear();
  hidden.visible = true;
  group.visible = false;
  input.add(hidden, { prompt: 'other hour' });
  input.update();
  assert.equal(input.current, null);
});

test('changing the current prompt updates it without looking away', () => {
  const { input, ui } = interaction();
  const board = meshAt(-2);
  input.add(board, { prompt: 'the wall' });
  input.update();
  input.setPrompt(board, 'the chalk');
  input.update();
  assert.equal(ui.prompt, 'the chalk');
});

test('a modal blocks gaze targeting and stale touch activation', () => {
  const { input, ui } = interaction();
  const board = meshAt(-2);
  let count = 0;
  input.add(board, { onInteract: () => count++ });
  input.update();
  ui.modalOpen = true;
  input.trigger();
  input.update();
  assert.equal(count, 0);
  assert.equal(input.current, null);
});

test('room callbacks advance only with room updates and can be cancelled', async () => {
  const level = new LevelBase({} as any);
  let calls = 0;
  level.after(0.02, () => calls++);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(calls, 0, 'paused room must not run wall-clock callbacks');
  level.update(0.01, 0.01);
  assert.equal(calls, 0);
  level.update(0.02, 0.03);
  assert.equal(calls, 1);
  const handle = level.after(0.01, () => calls++);
  level.cancelAfter(handle);
  level.update(0.1, 0.13);
  assert.equal(calls, 1);
});
