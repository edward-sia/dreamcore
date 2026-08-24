import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LevelBase } from '../src/core/LevelBase.js';
import { Hours } from '../src/core/hours.js';

function fakeGame() {
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.08, 600);
  const calls = { flashes: 0, grades: [], moods: [], enabled: [], loops: [] };
  return {
    engine: { camera, pulseGrade() {}, setGrade: (g) => calls.grades.push({ ...g }) },
    ui: { subtitle() {}, flash: () => { calls.flashes++; }, setObjective() {}, addClue() {}, showNote() {}, setItems() {} },
    audio: {
      sfx() {}, sfxAt() {}, setDread() {}, hush() {}, setAmbience: (m) => calls.moods.push(m),
      loopAt: (kind) => { const h = { kind, stopped: false, stop() { h.stopped = true; }, setPosition() {}, setGain() {} }; calls.loops.push(h); return h; },
    },
    interaction: { add() {}, clear() {}, remove() {}, setEnabled: (o, on) => calls.enabled.push([o.name, on]) },
    player: { setColliders() {}, position: new THREE.Vector3(0, 1.62, 0) },
    save: { data: { captions: false } },
    calls,
  };
}
class L extends LevelBase {
  build() { this.scene.fog = new THREE.Fog('#000000', 1, 10); this.scene.background = new THREE.Color('#000000'); }
}
const named = (n) => { const o = new THREE.Object3D(); o.name = n; return o; };

function setup() {
  const g = fakeGame(); const lvl = new L(g); lvl.init();
  const hours = new Hours(lvl, { fade: 1.0, blink: 100 });
  const pan = named('pan'), box = named('box'), always = named('always');
  const lampE = new THREE.PointLight(0xffffff, 0), lampM = new THREE.PointLight(0xffffff, 0);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); wall.position.set(5, 0.5, 0); wall.updateMatrixWorld(true);
  hours.bind('night', { objects: [pan], interact: [pan], fog: { color: '#0a0a10', near: 1.5, far: 14 }, grade: { lift: 0.02 }, mood: 'night' });
  hours.bind('morning', { objects: [box], interact: [box], lights: [{ light: lampM, intensity: 2 }], colliders: [wall], fog: { color: '#d8d5ce', near: 1, far: 9 }, grade: { lift: 0.09 }, mood: 'morning', loops: [{ kind: 'birds', position: { x: 0, y: 1, z: 0 } }] });
  hours.bind('evening', { lights: [{ light: lampE, intensity: 4 }], mood: 'evening', blockers: [[[0, 0, 0], [1, 1, 1]]] });
  return { g, lvl, hours, pan, box, always, lampE, lampM, wall };
}

test('start applies the initial hour at once: visibility, interactables, lights, fog, grade, mood', () => {
  const { g, lvl, hours, pan, box, lampE, lampM } = setup();
  hours.start();
  assert.equal(hours.current, 'night');
  assert.equal(pan.visible, true); assert.equal(box.visible, false);
  assert.deepEqual(g.calls.enabled.sort(), [['box', false], ['pan', true]]);
  assert.equal(lampE.intensity, 0); assert.equal(lampM.intensity, 0);
  assert.equal(lvl.scene.fog.far, 14);
  assert.equal(g.calls.grades.at(-1).lift, 0.02);
  assert.deepEqual(g.calls.moods, ['night']);
  assert.equal(g.calls.flashes, 0);
});

test('next() cycles night → morning → evening → night and refuses while changing', () => {
  const { hours } = setup(); hours.start();
  assert.equal(hours.next(), true);
  assert.equal(hours.changing, true);
  assert.equal(hours.next(), false);                 // busy
  hours.update(2.0);
  assert.equal(hours.current, 'morning'); assert.equal(hours.changing, false);
  hours.next(); hours.update(2.0); assert.equal(hours.current, 'evening');
  hours.next(); hours.update(2.0); assert.equal(hours.current, 'night');
});

test('the swap happens under the blink at the midpoint; lights and fog lerp across the fade', () => {
  const { g, lvl, hours, pan, box, lampM, wall } = setup(); hours.start();
  hours.set('morning');
  hours.update(0.25);                                 // k = 0.25 — before the midpoint
  assert.equal(hours.current, 'night'); assert.equal(pan.visible, true); assert.equal(g.calls.flashes, 0);
  assert.ok(lampM.intensity > 0 && lampM.intensity < 2, `lerping: ${lampM.intensity}`);
  hours.update(0.3);                                  // k = 0.55 — past the midpoint
  assert.equal(hours.current, 'morning'); assert.equal(g.calls.flashes, 1);
  assert.equal(pan.visible, false); assert.equal(box.visible, true);
  assert.ok(lvl.solids.some((b) => b.min.x > 4), 'the morning collider is solid now');
  assert.equal(g.calls.loops.length, 1); assert.equal(g.calls.loops[0].kind, 'birds');
  assert.equal(g.calls.moods.at(-1), 'morning');
  hours.update(1.0);                                  // done
  assert.equal(hours.changing, false);
  assert.equal(lampM.intensity, 2);
  assert.equal(lvl.scene.fog.far, 9);
  assert.equal(g.calls.grades.at(-1).lift, 0.09);
});

test('leaving an hour stops its loops and removes its solids; onEnter/onLeave/onChange fire in order', () => {
  const { g, lvl, hours } = setup();
  hours.start();                                       // (start() also fires onChange, with prev null — so wire the log after it)
  const log = [];
  hours.bind('morning', { onEnter: (h) => log.push('enter ' + h), onLeave: (h) => log.push('leave ' + h) });
  hours.onChange = (h, prev) => log.push(`change ${prev}→${h}`);
  hours.set('morning'); hours.update(2.0);
  const solidsInMorning = lvl.solids.length;
  hours.set('evening'); hours.update(2.0);
  assert.equal(g.calls.loops[0].stopped, true);
  assert.equal(lvl.solids.length, solidsInMorning);    // one Box3 out (the wall), one in (the blocker)
  assert.ok(!lvl.solids.some((b) => b.min.x > 4));
  assert.deepEqual(log, ['enter morning', 'change night→morning', 'leave morning', 'change morning→evening']);
});
