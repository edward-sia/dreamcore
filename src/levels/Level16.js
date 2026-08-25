import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, skyGradientTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeTable, makeChair,
  makeShelf, makeDust, makeClockFace, applyFog,
} from '../core/props.js';
import { Hours } from '../core/hours.js';

// XVI — The Kitchen
// The house comes back for someone small; you are on her side of the door.
// The stopped clock moves you between her evening, 3:07 and the morning the
// house is emptied. Put the pan back, the little key down, write the fuses
// up — at night, because only the night counts — and the hall door gives.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.1

const W = 6.0, D = 4.6, H = 2.6;                       // interior; origin at the centre; −Z is the hall wall
const CLOCK_POS = { x: -1.5, y: 2.32, z: -2.27 };
const HALL_DOOR = { x: -1.5, y: 1.2, z: -2.3 };
const FUSE = { x: 2.94, y: 1.5, z: -1.4 };             // on the east wall, facing −X
const SWITCH_ORDER = ['porch', 'sitting', 'kitchen', 'yours', 'hall'];     // left → right as you face the box
const LABELS = ['', 'kitchen', 'hall', 'sitting room', 'your room', 'porch'];  // the plate cycle
const LABEL_OF = { porch: 'porch', sitting: 'sitting room', kitchen: 'kitchen', yours: 'your room', hall: 'hall' };
const HER_PLATES = ['porch', 'sitting room', '', 'your room', ''];         // hers, in the morning: the 3rd and 5th fell off
const OVERHEAD_MUSIC = { x: 1, y: 3.4, z: 0.5 };
const TUNE = LevelBase.tune('EGAGEGE');
const HUM = LevelBase.tune('EGAG');
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

const WINDOW = { z: -0.6, y: 1.45, w: 1.4, h: 0.95 };  // over the sink, in the west wall
const RANGE = { x: -1.6, z: 2.0 };
const FRIDGE = { x: 1.8, z: 1.92 };
const FRIDGE_OPEN = 1.3;                               // radians the fridge door stands open at the morning
const HATCH = { x: 0.3, y: 1.2, hw: 0.39, hh: 0.29 };  // the serving hatch hole (the shutter is smaller)

export default class Level16 extends LevelBase {
  static meta = {
    id: 16,
    numeral: 'XVI',
    title: 'The Kitchen',
    mood: 'night',
    grade: GRADE,
    prologue:
      'You open your eyes.\n\n' +
      'The ceiling of your own room. Morning.\n' +
      'This time it stays.\n\n' +
      'Somewhere, in a house that is gone, someone turns off the last light —\n' +
      'the one that was left on for you —\n' +
      'and goes to bed.\n\n' +
      'Years.\n\n' +
      'Then one night the house comes back, and it is not waiting for you.\n' +
      'Someone small is asleep upstairs, and every light is off,\n' +
      'and you know what that is like.',
    intro: 'The kitchen, at the hour every clock in the house stopped.',
    outro:
      'You put the pan back and the key down and wrote the fuses up,\n' +
      'and the door to the hall gave, the way it gave for her,\n' +
      'onto a hall longer than the house.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    // state
    this._wound = false;
    this._panOnRange = false;
    this._keyPlaced = false;
    this._wrongCount = 0;
    this._on = {};                  // switch key -> bool (night)
    this._plate = [0, 0, 0, 0, 0];  // index into LABELS per plate
    this._timers = {};
    this._exitOpen = false;
    this._listRead = false;
    this._visitedEvening = false;
    this._tapPlayedAtNight = false;
    this._overheadArmed = false;
    this._wasChanging = false;

    this._buildShell();
    this._buildFurniture();
    this._buildFuseBox();
    this._buildClock();
    this._bindLook({ x: -3.55, y: 1.7, z: -0.6 }, { x: -9, y: 6, z: -2 });
    this._wirePuzzle();

    this.spawn.position.set(2.1, 0, -0.2);
    this.spawn.yaw = Math.PI / 2;                          // facing −X into the room
    this.bounds = new THREE.Box3(new THREE.Vector3(-2.9, 0, -4.4), new THREE.Vector3(2.9, 3, 2.2));
    this.setObjective('the clock stopped at 3:07. every clock did.');

    this.hours.start();
    this.track(this.hours);
  }

  // ---------- small builders (as Level15) ----------

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  _plane(w, d, mat, x, y, z, facing) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = facing === 'up' ? -Math.PI / 2 : Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = facing === 'up';
    this.add(m);
    return m;
  }

  /** An upright plane. `ry` turns its face: 0 → +Z, π → −Z, +π/2 → +X, −π/2 → −X. */
  _vplane(w, h, mat, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.add(m);
    return m;
  }

  // ---------- the hours ----------

  _bindLook(windowPos, sunFrom) {
    const hemiN = new THREE.HemisphereLight(0x2a2e44, 0x07070a, 0);
    const hemiE = new THREE.HemisphereLight(0x5a4a3a, 0x1a1410, 0);
    const hemiM = new THREE.HemisphereLight(0xffffff, 0xcfcac0, 0);
    this.add(hemiN, hemiE, hemiM);
    const moon = new THREE.PointLight(0x6c7ea8, 0, 16, 1.5);
    moon.position.set(windowPos.x, windowPos.y, windowPos.z);
    this.add(moon);
    const sun = new THREE.DirectionalLight(0xfff2dc, 0);
    sun.position.set(sunFrom.x, sunFrom.y, sunFrom.z);
    sun.target.position.set(0, 1, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.left = -5; sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 30;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    this.add(sun, sun.target);
    const GRADE_N = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
    const GRADE_E = { vignette: 1.2, grain: 0.03, desat: 0.08, lift: 0.03, fringe: 0.0005 };
    const GRADE_M = { vignette: 0.9, grain: 0.045, desat: 0.35, lift: 0.09, fringe: 0.001 };
    this.hours.bind('night', { lights: [{ light: hemiN, intensity: 1.3 }, { light: moon, intensity: 4.4 }], fog: { color: '#0a0a10', near: 1.5, far: 14 }, grade: GRADE_N, mood: this.constructor.meta.mood });
    this.hours.bind('evening', { lights: [{ light: hemiE, intensity: 0.62 }], fog: { color: '#1a140f', near: 2, far: 18 }, grade: GRADE_E, mood: 'evening' });
    this.hours.bind('morning', { lights: [{ light: hemiM, intensity: 1.5 }, { light: sun, intensity: 1.4 }], fog: { color: '#d8d5ce', near: 1, far: 9 }, grade: GRADE_M, mood: 'morning',
      loops: [{ kind: 'birds', position: windowPos }] });
  }

  _wind() {
    if (this._clockLocked) { this.subtitle('The clock has done what it was for.', 3); return; }
    if (this.hours.changing) return;
    this.playSoundAt('wind', CLOCK_POS);
    const next = this.hours.order[(this.hours.order.indexOf(this.hours.current) + 1) % 3];
    const [h, m] = { night: [3, 7], morning: [7, 15], evening: [8, 30] }[next];
    this._clockFace.setTime(h, m, 1.6);
    this.hours.next();
    if (!this._wound) {
      this._wound = true;
      this.subtitle('The hands move. They never did, before.', 5);
    }
  }

  _wrongHourPlacing() {
    if (this.hours.is('evening')) this.subtitle('She\'d only tidy it away. Leave it for the night.', 5);
    else this.subtitle('There is nothing here to leave it on, not any more.', 5);
  }

  _morningBox(label, x, z, onOpen) {
    const g = new THREE.Group();
    const card = new THREE.MeshStandardMaterial({ color: 0xa3896a, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), card);
    body.position.y = 0.2; body.castShadow = body.receiveShadow = true;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1),
      new THREE.MeshStandardMaterial({ map: textTexture({ text: label, font: '24px Georgia', color: '#3a332c', bg: '#d9cfbd', width: 384, height: 128 }), roughness: 0.9 }));
    lab.position.set(0, 0.26, 0.201);
    g.add(body, lab);
    g.position.set(x, 0, z);
    this.add(g);
    this.interact(g, { prompt: label.toLowerCase(), onInteract: () => onOpen(g) });
    return g;
  }

  async _waitFor(test, capSeconds) {
    const until = Date.now() + capSeconds * 1000;
    while (!test() && Date.now() < until) await this.debugWait(0.05);
  }

  // ---------- shell ----------

  _buildShell() {
    const wall = makeMat('plaster', { base: '#b9ad96', repeat: [1.6, 1.0] });
    const floorMat = makeMat('checker', { a: '#b8b09c', b: '#6f6a60', cell: 128, repeat: [6, 5] });
    const ceilMat = makeMat('plaster', { base: '#cdc8ba', repeat: [3, 2.3] });
    const paper = makeMat('wallpaper', { base: '#b7a48e', stripe: '#a8927a', repeat: [2, 1.2] });
    const carpet = makeMat('carpet', { base: '#6d5a58', repeat: [1, 1.4] });
    this._wallMat = wall;
    this._tileMat = makeMat('tile', { tile: '#c9c4b4', grout: '#ded9c9', tileSize: 48, repeat: [3, 1] });

    // floor and ceiling run out under the walls so the doorway is never a hole
    const floor = this._plane(W + 0.4, D + 0.4, floorMat, 0, 0, 0, 'up');
    this.addGround(floor);
    this._plane(W + 0.4, D + 0.4, ceilMat, 0, H, 0, 'down');

    const seg = (x0, x1, y0, y1, z0, z1, mat = wall) =>
      this._box(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

    // north (−Z): the hall door at x −1.5 (1.0 wide) and the hatch at x +0.3
    const hx0 = HATCH.x - HATCH.hw, hx1 = HATCH.x + HATCH.hw;
    const hy0 = HATCH.y - HATCH.hh, hy1 = HATCH.y + HATCH.hh;
    seg(-3.2, -2.0, 0, H, -2.5, -2.3);
    seg(-2.0, -1.0, 2.1, H, -2.5, -2.3);
    seg(-1.0, hx0, 0, H, -2.5, -2.3);
    seg(hx0, hx1, 0, hy0, -2.5, -2.3);
    seg(hx0, hx1, hy1, H, -2.5, -2.3);
    seg(hx1, 3.2, 0, H, -2.5, -2.3);
    // south (+Z): the range wall
    seg(-3.2, 3.2, 0, H, 2.3, 2.5);
    // west (−X): the window over the sink
    const wz0 = WINDOW.z - WINDOW.w / 2, wz1 = WINDOW.z + WINDOW.w / 2;
    const wy0 = WINDOW.y - WINDOW.h / 2, wy1 = WINDOW.y + WINDOW.h / 2;
    seg(-3.2, -3.0, 0, H, -2.5, wz0);
    seg(-3.2, -3.0, 0, H, wz1, 2.5);
    seg(-3.2, -3.0, 0, wy0, wz0, wz1);
    seg(-3.2, -3.0, wy1, H, wz0, wz1);
    // east (+X): the back door at z +1.2, the fuse box, the calendar
    seg(3.0, 3.2, 0, H, -2.5, 0.7);
    seg(3.0, 3.2, 0, H, 1.7, 2.5);
    seg(3.0, 3.2, 2.1, H, 0.7, 1.7);

    // ---- the window ----
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xbfb6a2, roughness: 0.75 });
    this._box(0.1, 0.05, WINDOW.w + 0.16, frameMat, -2.96, wy0 - 0.03, WINDOW.z, { collide: false });   // sill
    this._box(0.07, WINDOW.h, 0.045, frameMat, -3.0, WINDOW.y, WINDOW.z, { collide: false });
    this._box(0.07, 0.045, WINDOW.w, frameMat, -3.0, WINDOW.y, WINDOW.z, { collide: false });
    const glassNight = new THREE.MeshStandardMaterial({
      color: 0x05060a, metalness: 0.9, roughness: 0.15, transparent: true, opacity: 0.28,
    });
    this._paneNight = this._vplane(WINDOW.w, WINDOW.h, glassNight, -3.0, WINDOW.y, WINDOW.z, Math.PI / 2);
    const glassMorning = new THREE.MeshStandardMaterial({
      color: 0xf4f2ec, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.4,
    });
    this._paneMorning = this._vplane(WINDOW.w, WINDOW.h, glassMorning, -3.0, WINDOW.y, WINDOW.z, Math.PI / 2);
    this.hours.bind('night', { objects: [this._paneNight] });
    this.hours.bind('evening', { objects: [this._paneNight] });
    this.hours.bind('morning', { objects: [this._paneMorning] });

    // ---- beyond the window ----
    this._backE = this._vplane(8, 4, new THREE.MeshBasicMaterial({ map: skyGradientTexture({ top: '#2e3550', mid: '#6f5a6a', bottom: '#b98a6e' }) }), -6, 1.6, WINDOW.z, Math.PI / 2);
    this._backM = this._vplane(8, 4, new THREE.MeshBasicMaterial({ color: 0xf0eee7 }), -6, 1.6, WINDOW.z, Math.PI / 2);
    this._backN = new THREE.Group();
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({
      map: skyGradientTexture({ top: '#0a1020', mid: '#1a2440', bottom: '#242b3c' }),
    }));
    dark.position.set(-6, 1.6, WINDOW.z);
    dark.rotation.y = Math.PI / 2;
    this._backN.add(dark);
    const fg = new THREE.BufferGeometry();
    const fp = new Float32Array(12 * 3);
    for (let i = 0; i < 12; i++) {
      fp[i * 3] = -5.6 + Math.random() * 0.9;
      fp[i * 3 + 1] = 0.7 + Math.random() * 1.6;
      fp[i * 3 + 2] = WINDOW.z - 1.6 + Math.random() * 3.2;
    }
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    const flies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xc9e08a, size: 0.05, transparent: true, opacity: 0.75, depthWrite: false }));
    this._backN.add(flies);
    this.add(this._backN);
    this.hours.bind('night', { objects: [this._backN] });
    this.hours.bind('evening', { objects: [this._backE] });
    this.hours.bind('morning', { objects: [this._backM] });

    // ---- the hall door and the stub of hall beyond it ----
    this._hallDoor = makeDoor({ color: '#5a4636' });
    this._hallDoor.position.set(HALL_DOOR.x, 0, HALL_DOOR.z);
    this.add(this._hallDoor);
    this.track(this._hallDoor);
    this._hallBlocker = this.addBlocker([-2.0, 0, -2.4], [-1.0, 2.2, -2.2]);

    const hallFloor = this._plane(1.6, 2.0, carpet, -1.5, 0, -3.5, 'up');
    this.addGround(hallFloor);
    this._plane(1.6, 2.0, this._wallMat, -1.5, 2.3, -3.5, 'down');
    seg(-2.5, -2.3, 0, 2.3, -4.6, -2.5, paper);
    seg(-0.7, -0.5, 0, 2.3, -4.6, -2.5, paper);
    seg(-2.5, -0.5, 0, 2.3, -4.6, -4.4, paper);

    const stripMat = new THREE.MeshStandardMaterial({ color: 0x3a2f22, emissive: 0xffd9a8, emissiveIntensity: 0 });
    this._strip = this._plane(0.9, 0.02, stripMat, HALL_DOOR.x, 0.012, -2.255, 'up');
    this._hallLight = new THREE.PointLight(0xffd9a8, 0, 3);
    this._hallLight.position.set(-1.5, 1.4, -3.0);
    this.add(this._hallLight);

    // the morning: the door stands open onto white
    this._whiteHall = this._vplane(1.6, 2.3, new THREE.MeshBasicMaterial({ color: 0xf4f2ec }), -1.5, 1.15, -3.2, 0);
    this.hours.bind('morning', { objects: [this._whiteHall], blockers: [[[-2.3, 0, -3.2], [-0.7, 3, -2.6]]] });

    // ---- the serving hatch ----
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x0d0d10, emissive: 0xffd9a8, emissiveIntensity: 0 });
    this._hatchGlow = this._vplane(HATCH.hw * 2, HATCH.hh * 2, glowMat, HATCH.x, HATCH.y, -2.34, 0);
    const shutterMat = makeMat('wood', { base: '#5f4a35', repeat: [1, 1] });
    this._hatchShutter = this._box(0.74, 0.54, 0.03, shutterMat, HATCH.x, HATCH.y, -2.285, { collide: false });
    this._hatchBoards = new THREE.Group();
    for (const a of [0.42, -0.42]) {
      const b = makeWall(0.95, 0.09, 0.02, shutterMat);
      b.position.set(HATCH.x, HATCH.y, -2.26);
      b.rotation.z = a;
      this._hatchBoards.add(b);
    }
    this.add(this._hatchBoards);
    this.hours.bind('morning', { objects: [this._hatchBoards] });

    // ---- the back door, never opened, and the key on its hook ----
    this._vplane(1.0, 2.1, new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 1 }), 3.16, 1.05, 1.2, -Math.PI / 2);
    this._backDoor = makeDoor({ color: '#9a8265', frameColor: '#6b5a45' });
    this._backDoor.position.set(3.0, 0, 1.2);
    this._backDoor.rotation.y = -Math.PI / 2;
    this.add(this._backDoor);
    this.addCollider(this._backDoor.panel);
    this.interact(this._backDoor, { prompt: 'the back door', onInteract: () => { this.playSound('locked'); this.subtitle('The garden is another night.', 4); } });
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.4, metalness: 0.8 }));
    hook.rotation.z = Math.PI / 2;
    hook.position.set(2.97, 1.52, 0.5);
    this.add(hook);
    this._backKey = makeKeyProp();
    this._backKey.scale.setScalar(0.65);
    this._backKey.position.set(2.945, 1.505, 0.5);
    this._backKey.rotation.set(0, 0, -Math.PI / 2);
    this.add(this._backKey);
    this.interact(this._backKey, { prompt: 'the key on the hook', onInteract: () => this.subtitle('The back door key. Not tonight.', 4) });

    this._windowPos = { x: -2.9, y: 1.4, z: -0.6 };
  }

  // ---------- furniture ----------

  _buildFurniture() {
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.42, metalness: 0.6 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xb9bec3, roughness: 0.2, metalness: 0.95 });
    const panMat = new THREE.MeshStandardMaterial({ color: 0x2e2e30, roughness: 0.45, metalness: 0.55 });
    const paint = new THREE.MeshStandardMaterial({ color: 0xcfc7b4, roughness: 0.85 });

    // ---- the bulb over the table ----
    this._bulb = makeBulbLight({ color: 0xffd2a0, intensity: 0, distance: 9, y: 2.35 });
    this._bulb.position.set(0, 0, 0.2);
    this._bulb.light.castShadow = true;
    this._bulb.light.shadow.mapSize.set(512, 512);
    this._bulb.light.shadow.camera.far = 9;
    this.add(this._bulb);
    this._bulbMesh = this._bulb.children.find((o) => o.isMesh && o.geometry.type === 'SphereGeometry');
    if (this._bulbMesh) this._bulbMesh.material.emissiveIntensity = 0;
    this.tick(() => {
      if (this._bulbMesh) this._bulbMesh.material.emissiveIntensity = Math.min(3.5, this._bulb.light.intensity * 0.8);
    });
    this.hours.bind('evening', { lights: [{ light: this._bulb.light, intensity: 4.5 }] });

    // ---- the sink under the window ----
    this._box(0.55, 0.86, 1.2, paint, -2.675, 0.43, WINDOW.z);
    const top = (x0, x1, z0, z1) => this._box(x1 - x0, 0.05, z1 - z0, paint, (x0 + x1) / 2, 0.895, (z0 + z1) / 2, { collide: false });
    top(-2.95, -2.85, -1.2, 0.0);
    top(-2.5, -2.4, -1.2, 0.0);
    top(-2.85, -2.5, -1.2, -0.85);
    top(-2.85, -2.5, -0.35, 0.0);
    this._box(0.35, 0.02, 0.5, metal, -2.675, 0.79, WINDOW.z, { collide: false });        // basin floor
    this._box(0.02, 0.13, 0.5, metal, -2.84, 0.855, WINDOW.z, { collide: false });
    this._box(0.02, 0.13, 0.5, metal, -2.51, 0.855, WINDOW.z, { collide: false });
    this._box(0.35, 0.13, 0.02, metal, -2.675, 0.855, -0.84, { collide: false });
    this._box(0.35, 0.13, 0.02, metal, -2.675, 0.855, -0.36, { collide: false });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 10), chrome);
    stem.position.set(-2.88, 1.05, WINDOW.z);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 10), chrome);
    spout.rotation.z = Math.PI / 2;
    spout.position.set(-2.80, 1.17, WINDOW.z);
    this.add(stem, spout);
    this._tapPos = { x: -2.6, y: 1.0, z: -0.6 };

    // the pan, in the sink at night (holder so the hours never un-take it)
    this._panSink = new THREE.Group();
    const sinkPanBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), panMat);
    const sinkPanHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8), panMat);
    sinkPanHandle.rotation.z = Math.PI / 2;
    sinkPanHandle.position.set(0.26, 0.01, 0);
    this._panSink.add(sinkPanBody, sinkPanHandle);
    this._panSink.position.set(-2.675, 0.87, WINDOW.z);
    const panSinkHolder = new THREE.Group();
    panSinkHolder.add(this._panSink);
    this.add(panSinkHolder);
    this.hours.bind('night', { objects: [panSinkHolder], interact: [this._panSink] });

    // ---- the range ----
    this._range = new THREE.Group();
    const rangeBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.6), metal);
    rangeBody.position.y = 0.45;
    rangeBody.castShadow = rangeBody.receiveShadow = true;
    this._range.add(rangeBody);
    for (const dx of [-0.22, 0.22]) for (const dz of [-0.14, 0.14]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.015, 16), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.7 }));
      ring.position.set(dx, 0.905, dz);
      this._range.add(ring);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.03), chrome);
    rail.position.set(0, 1.02, -0.32);
    this._range.add(rail);
    this._range.position.set(RANGE.x, 0, RANGE.z);
    this.add(this._range);
    this.hours.bind('night', { objects: [this._range], colliders: [this._range] });
    this.hours.bind('evening', { objects: [this._range], colliders: [this._range] });

    // splashback behind the range; at the morning the paler rectangle where it stood
    this._vplane(1.2, 0.62, this._tileMat, RANGE.x, 1.22, 2.288, Math.PI);
    this._paleRect = this._vplane(1.04, 0.92, new THREE.MeshStandardMaterial({ color: 0xd4cebc, roughness: 0.9 }), RANGE.x, 0.46, 2.287, Math.PI);
    this.hours.bind('morning', { objects: [this._paleRect] });

    // her pan, at her hour: on the range, steaming
    this._panEvening = new THREE.Group();
    const evPan = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), panMat);
    const evHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8), panMat);
    evHandle.rotation.z = Math.PI / 2;
    evHandle.position.set(0.26, 0.01, 0);
    this._panEvening.add(evPan, evHandle);
    this._panEvening.position.set(RANGE.x - 0.22, 0.97, RANGE.z - 0.14);
    this.add(this._panEvening);
    this._steam = makeDust({ count: 40, box: [0.3, 0.8, 0.3], center: [RANGE.x, 1.3, RANGE.z], size: 0.02, color: 0xe6ded0 });
    this.add(this._steam);
    this.track(this._steam);
    this.hours.bind('evening', { objects: [this._panEvening, this._steam], loops: [{ kind: 'simmer', position: { x: RANGE.x, y: 1.0, z: RANGE.z } }] });

    // your pan, at your hour: not there until you put it back
    this._panRange = new THREE.Group();
    const nPan = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), panMat);
    const nHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8), panMat);
    nHandle.rotation.z = Math.PI / 2;
    nHandle.position.set(0.26, 0.01, 0);
    this._panRange.add(nPan, nHandle);
    this._panRange.position.set(RANGE.x - 0.22, 0.97, RANGE.z - 0.14);
    this._panRange.visible = false;
    const panRangeHolder = new THREE.Group();
    panRangeHolder.add(this._panRange);
    this.add(panRangeHolder);
    this.hours.bind('night', { objects: [panRangeHolder] });

    this._rangeGlow = new THREE.PointLight(0xff9a4a, 0, 3);
    this._rangeGlow.position.set(RANGE.x, 0.9, RANGE.z - 0.1);
    this.add(this._rangeGlow);
    this.hours.bind('evening', { lights: [{ light: this._rangeGlow, intensity: 1.2 }] });

    // ---- the fridge ----
    const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.55 });
    const fridgeIn = new THREE.MeshStandardMaterial({ color: 0x8d8a82, roughness: 0.85 });
    this._fridgeShell = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.65), fridgeMat);
    this._fridgeShell.position.set(FRIDGE.x, 0.85, FRIDGE.z + 0.05);
    this._fridgeShell.castShadow = this._fridgeShell.receiveShadow = true;
    this.add(this._fridgeShell);
    this.addCollider(this._fridgeShell);
    this._fridgeHollow = new THREE.Group();
    {
      const g = this._fridgeHollow, z0 = FRIDGE.z + 0.05;
      const p = (w, h, d, x, y, z) => { const m = makeWall(w, h, d, fridgeIn); m.position.set(x, y, z); g.add(m); };
      p(0.7, 1.7, 0.05, FRIDGE.x, 0.85, z0 + 0.30);
      p(0.05, 1.7, 0.65, FRIDGE.x - 0.325, 0.85, z0);
      p(0.05, 1.7, 0.65, FRIDGE.x + 0.325, 0.85, z0);
      p(0.7, 0.05, 0.65, FRIDGE.x, 1.675, z0);
      p(0.7, 0.05, 0.65, FRIDGE.x, 0.025, z0);
      for (const y of [0.55, 1.05]) p(0.6, 0.02, 0.55, FRIDGE.x, y, z0);
    }
    this.add(this._fridgeHollow);
    this.hours.bind('night', { objects: [this._fridgeShell] });
    this.hours.bind('evening', { objects: [this._fridgeShell] });
    this.hours.bind('morning', { objects: [this._fridgeHollow] });

    this._fridgeDoorShut = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.66, 0.05), fridgeMat);
    this._fridgeDoorShut.position.set(FRIDGE.x, 0.85, FRIDGE.z - 0.30);
    this._fridgeDoorShut.castShadow = true;
    this.add(this._fridgeDoorShut);
    this._fridgeDoorOpen = new THREE.Group();
    const openLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.66, 0.05), fridgeMat);
    openLeaf.position.set(0.35, 0.85, 0);
    openLeaf.castShadow = true;
    this._fridgeDoorOpen.add(openLeaf);
    this._fridgeDoorOpen.position.set(FRIDGE.x - 0.35, 0, FRIDGE.z - 0.30);
    this._fridgeDoorOpen.rotation.y = FRIDGE_OPEN;
    this.add(this._fridgeDoorOpen);
    this.hours.bind('night', { objects: [this._fridgeDoorShut] });
    this.hours.bind('evening', { objects: [this._fridgeDoorShut] });
    this.hours.bind('morning', { objects: [this._fridgeDoorOpen] });

    this._drawing = this._vplane(0.22, 0.3, new THREE.MeshStandardMaterial({ map: this._sunflowerTexture(), roughness: 0.9 }), FRIDGE.x, 1.16, FRIDGE.z - 0.33, Math.PI);
    this._placeDrawing(false);
    this.hours.bind('evening', { objects: [this._drawing], onEnter: () => this._placeDrawing(false) });
    this.hours.bind('night', { onEnter: () => this._placeDrawing(false) });
    this.hours.bind('morning', { objects: [this._drawing], onEnter: () => this._placeDrawing(true) });
    this.hours.bind('night', { loops: [{ kind: 'hum', position: { x: FRIDGE.x, y: 1.0, z: FRIDGE.z } }] });
    this.hours.bind('evening', { loops: [{ kind: 'hum', position: { x: FRIDGE.x, y: 1.0, z: FRIDGE.z } }] });

    // ---- the dresser, the cup, the little key ----
    this._dresser = makeShelf({ w: 1.2, h: 1.5, d: 0.3 });
    this._dresser.position.set(1.5, 0, -2.14);
    this.add(this._dresser);
    this.addCollider(this._dresser);
    const china = new THREE.MeshStandardMaterial({ color: 0xe4dccb, roughness: 0.5 });
    this._dresserThings = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 18), china);
      plate.position.set(1.15 + (i % 3) * 0.02, 0.42 + Math.floor(i / 3) * 0.35 + i * 0.014, -2.12);
      plate.rotation.x = Math.PI / 2.02;
      this._dresserThings.add(plate);
    }
    this.add(this._dresserThings);
    this.hours.bind('night', { objects: [this._dresserThings] });
    this.hours.bind('evening', { objects: [this._dresserThings] });
    this._cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.038, 0.085, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe4dccb, roughness: 0.5, side: THREE.DoubleSide })
    );
    this._cup.position.set(1.62, 1.17, -2.10);
    this.add(this._cup);
    this.hours.bind('night', { objects: [this._cup] });
    this.hours.bind('evening', { objects: [this._cup] });
    this._cupKey = makeKeyProp();
    this._cupKey.scale.setScalar(0.75);
    this._cupKey.position.set(1.62, 1.21, -2.10);
    this._cupKey.rotation.set(-1.0, 0, 0.4);
    const cupKeyHolder = new THREE.Group();
    cupKeyHolder.add(this._cupKey);
    this.add(cupKeyHolder);
    this.hours.bind('evening', { objects: [cupKeyHolder] });

    // ---- the table ----
    this._table = makeTable({ w: 1.6, d: 0.9 });
    this._table.position.set(0, 0, 0.2);
    this.add(this._table);
    this.addCollider(this._table);
    this._sheet = this._box(1.72, 0.06, 1.02, new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.95 }), 0, 0.77, 0.2, { collide: false });
    this.hours.bind('morning', { objects: [this._sheet] });

    this._list = makeNoteProp();
    this._list.position.set(0.3, 0.785, 0.1);
    this.add(this._list);
    this.hours.bind('evening', { objects: [this._list], interact: [this._list] });

    this._keyOnTable = makeKeyProp();
    this._keyOnTable.position.set(-0.3, 0.79, 0.15);
    this._keyOnTable.visible = false;
    const tableKeyHolder = new THREE.Group();
    tableKeyHolder.add(this._keyOnTable);
    this.add(tableKeyHolder);
    this.hours.bind('night', { objects: [tableKeyHolder] });

    // ---- the chairs ----
    const chairAt = (x, z, ry) => { const c = makeChair(); c.position.set(x, 0, z); c.rotation.y = ry; this.add(c); return c; };
    this._chairs = new THREE.Group();
    for (const c of [chairAt(0, -0.5, 0), chairAt(1.05, 0.2, -Math.PI / 2), chairAt(-1.05, 0.2, Math.PI / 2)]) this._chairs.attach(c);
    this.add(this._chairs);
    this.hours.bind('night', { objects: [this._chairs] });          // at the morning they are under the sheet
    this.hours.bind('evening', { objects: [this._chairs] });
    this._chairSouthN = chairAt(0, 0.85, Math.PI);
    this._chairSouthE = chairAt(0, 1.15, Math.PI);
    this.hours.bind('night', { objects: [this._chairSouthN] });
    this.hours.bind('evening', { objects: [this._chairSouthE] });
    this.interact(this._chairSouthE, { prompt: 'the chair', onInteract: () => this.subtitle('Warm. She has just got up.', 4) });

    // ---- the calendar ----
    const calMat = new THREE.MeshStandardMaterial({ map: this._calendarTexture(false), roughness: 0.9 });
    this._calendar = this._vplane(0.3, 0.4, calMat, 2.94, 1.5, 0.2, -Math.PI / 2);
    const calM = new THREE.MeshStandardMaterial({ map: this._calendarTexture(true), roughness: 0.9 });
    this._calendarM = this._vplane(0.3, 0.4, calM, 2.928, 1.5, 0.2, -Math.PI / 2);
    this.hours.bind('morning', { objects: [this._calendarM], interact: [this._calendarM] });

    // ---- the crack in the ceiling, over the small one's room ----
    this._crackGlow = this._plane(0.4, 0.02, new THREE.MeshStandardMaterial({ color: 0x2a2118, emissive: 0xffd9a8, emissiveIntensity: 1.8 }), 1, 2.59, 0.5, 'down');
    this._crackGlow.visible = false;

    // ---- the morning: boxes, and a van at the kerb ----
    // (clear of the fridge door's swing, which stands open at this hour)
    this._boxMisc = this._morningBox('KITCHEN — misc', 0.35, 1.35, () => this.learnClue({
      id: 'l16-fallen', title: 'two plates from the fuse box',
      body: 'kitchen. hall. unscrewed and put in a box; which went where, nobody wrote down.',
    }));
    this._boxKeep = this._morningBox('KITCHEN — keep', 0.95, 1.35, () => this.subtitle('Plates. The good ones.', 4));
    this._boxVan = this._morningBox('KITCHEN — van', 0.65, 0.9, () => this.subtitle('Tea towels. The calendar, folded, with its Sunday still ringed.', 5));
    for (const b of [this._boxMisc, this._boxKeep, this._boxVan]) {
      this.hours.bind('morning', { objects: [b], colliders: [b], interact: [b] });
    }
    this.hours.bind('morning', { loops: [{ kind: 'idle', position: { x: 8, y: 0.5, z: 1 } }] });
    // the evening wireless is started in _enterEvening — it wants gain 0.5, and
    // the hours' loop spec has nowhere to put one

    this.track(this.add(makeDust({ count: 70, box: [5.6, 2.4, 4.2], center: [0, 1.3, 0], size: 0.007 })));
  }

  /** The drawing rides the fridge door; at the morning the door stands open. */
  _placeDrawing(open) {
    if (!open) {
      this._drawing.position.set(FRIDGE.x, 1.16, FRIDGE.z - 0.33);
      this._drawing.rotation.y = Math.PI;
      return;
    }
    const hx = FRIDGE.x - 0.35, hz = FRIDGE.z - 0.30;
    const lx = 0.35, lz = -0.031;
    const c = Math.cos(FRIDGE_OPEN), s = Math.sin(FRIDGE_OPEN);
    this._drawing.position.set(hx + lx * c + lz * s, 1.16, hz - lx * s + lz * c);
    this._drawing.rotation.y = Math.PI + FRIDGE_OPEN;
  }

  /** A sunflower in crayon, on paper. */
  _sunflowerTexture() {
    const c = document.createElement('canvas');
    c.width = 96; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#efe8d6'; x.fillRect(0, 0, 96, 128);
    x.strokeStyle = '#4c7a35'; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(48, 120); x.lineTo(47, 66); x.stroke();
    x.beginPath(); x.moveTo(47, 92); x.quadraticCurveTo(22, 84, 18, 98); x.stroke();
    x.beginPath(); x.moveTo(47, 100); x.quadraticCurveTo(74, 94, 78, 108); x.stroke();
    x.fillStyle = '#e8b62a';
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      x.beginPath();
      x.ellipse(48 + Math.cos(a) * 22, 48 + Math.sin(a) * 22, 11, 6, a, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = '#6b4a22';
    x.beginPath(); x.arc(48, 48, 14, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** A month, one Sunday ringed, sunflowers under it in her hand. */
  _calendarTexture(crossed) {
    const c = document.createElement('canvas');
    c.width = 384; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#e6ddc8'; x.fillRect(0, 0, 384, 512);
    x.fillStyle = '#3a332c';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '30px Georgia';
    x.fillText('AUGUST', 192, 40);
    x.font = '19px Georgia';
    const cols = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const cx = (i) => 40 + i * 51, cy = (r) => 96 + r * 52;
    cols.forEach((s, i) => x.fillText(s, cx(i), 72));
    let day = 1;
    const cells = [];
    for (let r = 0; r < 6 && day <= 31; r++) {
      for (let i = 0; i < 7 && day <= 31; i++) {
        if (r === 0 && i < 3) continue;
        cells.push({ d: day, x: cx(i), y: cy(r), sun: i === 6 });
        day++;
      }
    }
    x.font = '22px Georgia';
    for (const cell of cells) x.fillText(String(cell.d), cell.x, cell.y);
    const ringed = cells.find((k) => k.sun && k.d > 10);
    if (ringed) {
      x.strokeStyle = '#9c2a20'; x.lineWidth = 3;
      x.beginPath(); x.arc(ringed.x, ringed.y, 19, 0, Math.PI * 2); x.stroke();
      x.font = 'italic 27px Georgia'; x.fillStyle = '#3a332c';
      x.fillText('sunflowers', 192, 432);        // her hand, under the month
    }
    if (crossed) {
      x.strokeStyle = '#3a332c'; x.lineWidth = 2;
      for (const cell of cells) {
        if (ringed && cell.d <= ringed.d) continue;
        x.beginPath();
        x.moveTo(cell.x - 15, cell.y - 15); x.lineTo(cell.x + 15, cell.y + 15);
        x.moveTo(cell.x + 15, cell.y - 15); x.lineTo(cell.x - 15, cell.y + 15);
        x.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------- the fuse box ----------

  _buildFuseBox() {
    const grey = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.5, metalness: 0.4 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.5), grey);
    box.position.set(FUSE.x, FUSE.y, FUSE.z);
    this.add(box); this.addCollider(box);
    this._switches = []; this._plates = []; this._plateMats = [];
    const swMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const z = FUSE.z - 0.18 + 0.09 * i;                // i = 0 is the leftmost as you face the box (looking +X, left is −Z)
      const pivot = new THREE.Group();
      pivot.position.set(FUSE.x - 0.07, FUSE.y, z);
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), swMat);
      sw.position.y = 0.02;
      pivot.add(sw);
      pivot.rotation.z = -0.35;                          // off
      this.add(pivot);
      this._switches.push(pivot);
      const mat = new THREE.MeshStandardMaterial({ map: this._plateTexture(''), roughness: 0.8 });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.035), mat);
      plate.position.set(FUSE.x - 0.061, FUSE.y - 0.12, z);
      plate.rotation.y = -Math.PI / 2;
      this.add(plate);
      this._plates.push(plate); this._plateMats.push(mat);
    }
    // her plates are the morning's; yours are the ones you can write on
    this.hours.bind('night', { objects: this._plates, interact: this._plates });
    this.hours.bind('evening', { objects: this._plates, interact: this._plates });
    // the morning: her labels, each under its own switch; the 3rd and 5th fell off
    this._herPlates = new THREE.Group();
    const gone = new THREE.MeshStandardMaterial({ color: 0x74777b, roughness: 0.7, metalness: 0.3 });
    HER_PLATES.forEach((text, i) => {
      const mat = text
        ? new THREE.MeshStandardMaterial({ map: this._plateTexture(text), roughness: 0.8 })
        : gone;                                            // the plate is off; the box's face behind it
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.035), mat);
      plate.position.set(FUSE.x - 0.062, FUSE.y - 0.12, FUSE.z - 0.18 + 0.09 * i);
      plate.rotation.y = -Math.PI / 2;
      this._herPlates.add(plate);
    });
    this.add(this._herPlates);
    this.hours.bind('morning', { objects: [this._herPlates], interact: [this._herPlates] });
    // the pilot lamp
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 1.1 }));
    pilot.position.set(FUSE.x - 0.065, FUSE.y + 0.3, FUSE.z);
    this.add(pilot);
    const pilotGlow = new THREE.PointLight(0xff5533, 0.07, 0.34, 2);   // finds the box in the dark
    pilotGlow.position.set(FUSE.x - 0.12, FUSE.y + 0.24, FUSE.z);
    this.add(pilotGlow);
  }

  _plateTexture(text, width = 256) {
    return textTexture({ text, font: 'italic 28px Georgia', color: '#3a332c', bg: '#cfc6b3', width, height: 96 });
  }

  // ---------- the clock ----------

  _buildClock() {
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 8, 32), caseMat);
    ring.position.set(CLOCK_POS.x, CLOCK_POS.y, CLOCK_POS.z);
    this.add(ring);
    this._clockFace = makeClockFace({ radius: 0.16 });
    this._clockFace.position.set(CLOCK_POS.x, CLOCK_POS.y, CLOCK_POS.z + 0.004);   // faces +Z, into the kitchen
    this._clockFace.setTime(3, 7, 0);
    this.add(this._clockFace);
    this.track(this._clockFace);
    this.interact(ring, { prompt: 'the clock', distance: 3.4, onInteract: () => this._wind() });
    // the rim is a thin torus; aiming at the middle of the clock must work too
    this.interact(this._clockFace, { prompt: 'the clock', distance: 3.4, onInteract: () => this._wind() });
    this._clockRing = ring;
  }

  // ---------- the puzzle ----------

  _wirePuzzle() {
    // ---- hours: what happens when an hour begins ----
    this.hours.bind('evening', { onEnter: () => this._enterEvening(), onLeave: () => this._leaveEvening() });
    this.hours.bind('night', { onEnter: () => this._enterNight(), onLeave: () => this._leaveNight() });
    this.hours.bind('morning', { onEnter: () => { this._hallDoor.setAngle(Math.PI / 2); this.removeBlocker(this._hallBlocker); } });
    this.hours.bind('morning', { onLeave: () => { if (!this._exitOpen) { this._hallDoor.setAngle(0); this._hallBlocker = this.addBlocker([-2.0, 0, -2.4], [-1.0, 2.2, -2.2]); } } });
    this.hours.onChange = (hour) => {
      if (hour === 'morning' && !this._firstMorning) { this._firstMorning = true; this.setObjective('the house, at another hour'); }
    };
    // The crossfade lerps every light the hours own — the bulb among them — on
    // frame time, so the lamps the switches own go back on when it has finished.
    // A wall-clock timer loses that race whenever the frame rate is low.
    this.tick(() => {
      const changing = this.hours.changing;
      if (this._wasChanging && !changing) this._applyGlows();
      this._wasChanging = changing;
    });

    // ---- the list, the cup, the calendar, the drawing, the boxes ----
    this.interact(this._list, {
      prompt: 'her list', once: true,
      onInteract: () => {
        this._listRead = true;
        this.giveNote({
          id: 'l16-list', title: 'her list, on the kitchen table',
          body:
            'before bed —\n\n' +
            'the pan stays on. supper was real,\n' +
            'and there should be something to show for it.\n' +
            'the little key on the table, where small hands can find it.\n' +
            'write the fuses up. I always forget which is which,\n' +
            'and the dark is no time to learn.\n' +
            'then slippers. then the wireless. then up, and yours last.\n\n' +
            '— M.',
        });
        this.setObjective('before bed — her list');
      },
    });
    this.interact(this._cup, {
      prompt: 'the cup on the dresser',
      onInteract: () => {
        if (this.hours.is('evening') && this._cupKey.visible) {
          this._cupKey.visible = false;
          this.giveItem({ id: 'little-key', name: 'the little key' });
          this.subtitle('A cup with no handle. In it, the little key for the door at the top of the stairs. She keeps it here. You take it.', 6);
        } else if (this.hours.is('morning')) {
          this.subtitle('The dresser is bare. The cup went in a box, or a bin.', 4);
        } else {
          this.subtitle('A cup with no handle. Empty.', 4);
        }
      },
    });
    this.interact(this._calendar, {
      prompt: 'the calendar',
      onInteract: () => this.subtitle(this.hours.is('morning')
        ? 'Sunday, ringed. sunflowers, in her hand. Every day after it is crossed off.'
        : 'Sunday, ringed. sunflowers.', 5),
    });
    this.interact(this._calendarM, {
      prompt: 'the calendar',
      onInteract: () => this.subtitle('Sunday, ringed. sunflowers, in her hand. Every day after it is crossed off.', 5),
    });
    this.interact(this._drawing, {
      prompt: 'the drawing on the fridge',
      onInteract: () => this.subtitle('A sunflower, in crayon. Someone drew it so that someone would know.', 5),
    });
    this.interact(this._herPlates, {
      prompt: 'the fuse box', once: true,
      onInteract: () => this.learnClue({
        id: 'l16-plates', title: 'the fuse box, in the morning',
        body: 'in her hand, left to right: porch · sitting room · (fallen) · your room · (fallen).',
      }),
    });

    // ---- the pan ----
    this.interact(this._panSink, {
      prompt: 'the pan, in the sink',
      onInteract: () => {
        if (!this._panSink.visible) return;
        this._panSink.visible = false;
        this.game.interaction.setEnabled(this._panSink, false);
        this.giveItem({ id: 'pan', name: 'the supper pan, cold' });
      },
    });
    this.interact(this._range, {
      prompt: 'the range',
      onInteract: () => {
        if (!this.hours.is('night')) { this.subtitle(this.hours.is('evening') ? 'Supper. Still warm. She has just turned it down.' : 'Gone. A paler rectangle on the wall where it stood.', 4); return; }
        if (this.hasItem('pan')) {
          this.removeItem('pan');
          this._panRange.visible = true;
          this._panOnRange = true;
          this.playSound('pickup');
          this.subtitle('You put it back. Supper was real.', 4);
        } else {
          this.subtitle(this._panOnRange ? 'The pan, back where it was.' : 'Cold. She washed up. She always washed up.', 4);
        }
      },
    });

    // ---- the table: the little key ----
    this.interact(this._table, {
      prompt: 'the table',
      onInteract: () => {
        if (!this.hasItem('little-key')) { this.subtitle(this.hours.is('evening') ? 'Her list is on it.' : 'The table. Bare.', 3); return; }
        if (!this.hours.is('night')) { this._wrongHourPlacing(); return; }
        this.removeItem('little-key');
        this._keyOnTable.visible = true;
        this._keyPlaced = true;
        this.playSound('pickup');
        this.subtitle('You put it down where small hands can find it. It will be warm for a while.', 5);
        this.whenUnseen(this._chairSouthN, () => {
          this._chairSouthN.position.z += 0.3;
          this.playSoundAt('door', { x: 0, y: 0.5, z: 1.0 }, { soft: true });
          this.whenSeen(this._chairSouthN, () => this.subtitle('The chair is out again. Somebody sat down to supper.', 5));
        });
      },
    });

    // ---- the fuse box ----
    this._switches.forEach((pivot, i) => this.interact(pivot, { prompt: 'the switch', onInteract: () => this._flip(i) }));
    this._plates.forEach((plate, i) => this.interact(plate, { prompt: 'the plate', onInteract: () => this._cyclePlate(i) }));

    // ---- the hall door ----
    this.interact(this._hallDoor, { prompt: 'the door to the hall', distance: 3.2, onInteract: () => this._tryHallDoor() });
    this.tick(() => {
      if (this._exitOpen && !this.isCompleted && this.game.player.position.z < -3.2) this.complete();
    });

    // ---- the child overhead (night) ----
    this.tick((dt) => {
      if (!this.hours.is('night')) { this._overheadT = 0; return; }
      this._overheadT = (this._overheadT ?? 20) + dt;
      if (this._overheadT > 45) {
        this._overheadT = 0;
        this.footsteps([{ x: 1, y: 3.4, z: -1 }, { x: 0.5, y: 3.4, z: 1.5 }], { stride: 1.2, every: 0.5, opts: { soft: true } });
        if (!this._overheadCued) { this._overheadCued = true; this.cue('something small, turning over, upstairs', new THREE.Vector3(0.8, 3.4, 0.2)); }
      }
    });
  }

  /** The lamps the hours do not lerp: the strip, the hall, the hatch, the crack. */
  _applyGlows() {
    const night = this.hours.is('night');
    const evening = this.hours.is('evening');
    this._strip.material.emissiveIntensity = night && this._on.hall ? 1.4 : 0;
    this._hallLight.intensity = night && this._on.hall ? 1.5 : 0;
    this._hatchGlow.material.emissiveIntensity = evening || (night && this._on.sitting) ? 1.2 : 0;
    this._crackGlow.visible = !!(night && this._on.yours);
    if (!night) return;
    this._bulb.light.intensity = this._on.kitchen ? 4.5 : 0;
    // the hatch must not glow with no wireless, nor the crack with no music box
    if (this._on.sitting && !this._hatchRadio) {
      this._hatchRadio = this.loopAt('radio', { x: 0.3, y: 1.2, z: -2.4 });
      this._hatchRadio.setGain(0.4);
    }
    if (this._on.yours && !this._timers.yours) this._windMusicBox();
  }

  /** The music box upstairs, re-armed every 6 s for as long as her switch is on. */
  _windMusicBox() {
    if (!this.hours.is('night') || !this._on.yours) { this._timers.yours = null; return; }
    this.playSoundAt('musicbox', OVERHEAD_MUSIC, { notes: TUNE, step: 0.36, slow: 0.05, holdSeconds: 6 });
    this._timers.yours = this.after(6, () => this._windMusicBox());
  }

  _enterEvening() {
    this._visitedEvening = true;
    this._eveningRadio = this.loopAt('radio', { x: 0.3, y: 1.2, z: -3.2 });
    this._eveningRadio.setGain(0.5);                       // faint, through the hatch
    if (this._eveningOnce) return;
    this._eveningOnce = true;
    this._tap = this.loopAt('tap', this._tapPos);
    this.after(12, () => {
      this._stopTap(0.8);
      this.after(5, () => {
        if (!this.hours.is('evening')) return;
        this.playSoundAt('hummed', { x: -1.5, y: 1.5, z: -2.8 }, { notes: HUM });
        this.cue('humming, beyond the door', new THREE.Vector3(-1.5, 1.5, -2.8));
        for (let i = 0; i < 3; i++) this.after(2.4 + i * 0.9, () => this.playSoundAt('stepOther', { x: -1.5, y: 0, z: -3.2 - i * 0.8 }, { soft: true }));
      });
    });
  }

  _enterNight() {
    if (this._visitedEvening && !this._tapPlayedAtNight) {
      this._tapPlayedAtNight = true;
      this._tap = this.loopAt('tap', this._tapPos);
      this.cue('the tap', new THREE.Vector3(this._tapPos.x, this._tapPos.y, this._tapPos.z));
      this.after(10, () => this._stopTap(1.0));
    }
  }

  /** The tap belongs to the hour that turned it on; it does not follow you out of it. */
  _stopTap(fade = 0.6) {
    this._tap?.stop(fade);
    this._tap = null;
  }

  _leaveEvening() {
    this._eveningRadio?.stop(0.6);
    this._eveningRadio = null;
    this._stopTap();
  }

  _leaveNight() {
    this._stopTap();
    this._hatchRadio?.stop(0.5);
    this._hatchRadio = null;
    clearTimeout(this._timers.yours);
    this._timers.yours = null;
    this._crackGlow.visible = false;
    this._strip.material.emissiveIntensity = 0;
    this._hallLight.intensity = 0;
    this._hatchGlow.material.emissiveIntensity = 0;
  }

  _flip(i) {
    this.playSound('switch');
    const k = SWITCH_ORDER[i];
    if (!this.hours.is('night')) {
      this._switches[i].rotation.z = -this._switches[i].rotation.z;
      this.after(0.5, () => { this._switches[i].rotation.z = -0.35; });
      this.subtitle('She\'d only put it back. Leave them for the night.', 4);
      return;
    }
    const on = !this._on[k];
    this._on[k] = on;
    this._switches[i].rotation.z = on ? 0.35 : -0.35;
    const ordinal = ['first', 'second', 'third', 'fourth', 'fifth'][i];
    const note = (what) => this.learnClue({ id: 'l16-sw-' + i, title: `the ${ordinal} switch`, body: what });
    if (k === 'porch') {
      this.playSound('locked');
      if (!this._porchSaid) { this._porchSaid = true; this.subtitle('Dead. It always was.', 4); }
      note('a dead click. the porch.');
    } else if (k === 'kitchen') {
      this._bulb.light.intensity = on ? 4.5 : 0;
      if (on) { this.subtitle('The kitchen light. This one is the kitchen.', 4); note('lights the kitchen.'); }
    } else if (k === 'hall') {
      this._strip.material.emissiveIntensity = on ? 1.4 : 0;
      this._hallLight.intensity = on ? 1.5 : 0;
      if (on) { this.subtitle('A line of light under the hall door.', 4); note('a line of light under the hall door.'); }
    } else if (k === 'sitting') {
      this._hatchGlow.material.emissiveIntensity = on ? 1.2 : 0;
      if (on) {
        this._hatchRadio = this.loopAt('radio', { x: 0.3, y: 1.2, z: -2.4 }); this._hatchRadio.setGain(0.4);
        this.subtitle('Light at the edges of the hatch, and the wireless, faint.', 4);
        this.cue('the wireless, through the hatch', new THREE.Vector3(0.3, 1.2, -2.4));
        note('light at the hatch; the wireless. the sitting room.');
      } else { this._hatchRadio?.stop(0.5); this._hatchRadio = null; }
    } else if (k === 'yours') {
      if (on) {
        this._windMusicBox();
        this._crackGlow.visible = true;
        this.subtitle('A music box, upstairs. Winding down.', 4);
        this.cue('a music box, upstairs', new THREE.Vector3(OVERHEAD_MUSIC.x, OVERHEAD_MUSIC.y, OVERHEAD_MUSIC.z));
        note('a music box, upstairs. your room.');
      } else { clearTimeout(this._timers.yours); this._timers.yours = null; this._crackGlow.visible = false; }
    }
  }

  _cyclePlate(i) {
    if (!this.hours.is('night')) { this.subtitle('Blank. She keeps meaning to.', 3); return; }
    this.playSound('paper');
    this._plate[i] = (this._plate[i] + 1) % LABELS.length;
    this._plateMats[i].map?.dispose();
    this._plateMats[i].map = this._plateTexture(LABELS[this._plate[i]]);
    this._plateMats[i].needsUpdate = true;
  }

  _labelsRight() {
    return SWITCH_ORDER.every((k, i) => LABELS[this._plate[i]] === LABEL_OF[k]);
  }

  _tryHallDoor() {
    if (this._exitOpen) return;
    if (this.hours.is('evening')) { this.playSound('locked'); this.subtitle('Not yet. She is still up.', 4); return; }
    if (this.hours.is('morning')) { this.subtitle('White. The house is gone from here on.', 5); return; }
    let miss = null;
    if (!this._panOnRange) miss = 'Supper was real. Put it back where it can be seen.';
    else if (!this._keyPlaced) miss = 'The little key. On the table, where it can be found.';
    else if (!this._labelsRight()) miss = this._plate.every((p) => p === 0) ? 'The fuses. Write them up.' : 'The fuses. One of them is lying.';
    if (miss) {
      this.playSound('locked');
      this.subtitle(miss, 5);
      this._wrongCount++;
      if (this._wrongCount >= 3) {
        this.after(4, () => this.subtitle(this._listRead
          ? 'Porch. The wireless. Here. The small one\'s. The hall. Test them.'
          : 'Her list is on the table, at half past eight.', 6));
      }
      return;
    }
    this._exitOpen = true;
    this._clockLocked = true;
    this.playSound('unlock');
    this._hallDoor.setOpen(true, -1);
    this.removeBlocker(this._hallBlocker);
    this.playSound('door');
    this.playSoundAt('reverse', { x: -1.5, y: 1.3, z: -3.5 }, { dur: 1.4 });
    this.dread(0.2);
    this._strip.material.emissiveIntensity = 0;
    this._hallLight.intensity = 1.2;
    this.subtitle('It opens onto the hall, and the hall is longer than the house.', 6);
    this.setObjective('slippers');
  }

  /**
   * Wind the clock on to `to`, through the clock's own handler. The crossfade
   * runs on frame time and headless renders sit far below real time with the
   * engine clamping dt, so hurry the hour along — the handlers stay real.
   */
  async _windTo(to) {
    this.game.engine.timeScale = 8;
    // the clock refuses a wind while the hour is still turning, so retry
    for (let i = 0; i < 4 && !this.hours.is(to); i++) {
      await this._waitFor(() => !this.hours.changing, 6);
      this.debugInteract(this._clockRing);
      await this._waitFor(() => this.hours.is(to), 6);
    }
    await this._waitFor(() => !this.hours.changing, 6);
    this.game.engine.timeScale = 1;
  }

  async debugSolve() {
    const pl = this.game.player;
    try {
      await this._windTo('morning');
      await this._windTo('evening');
      this.debugInteract(this._list); await this.debugWait(0.3); this.game.ui.closeModal();
      this.debugInteract(this._cup); await this._waitFor(() => this.hasItem('little-key'), 3);
      await this._windTo('night');
      this.debugInteract(this._panSink); await this._waitFor(() => this.hasItem('pan'), 3);
      this.debugInteract(this._range); await this._waitFor(() => this._panOnRange, 3);
      this.debugInteract(this._table); await this._waitFor(() => this._keyPlaced, 3);
      const turns = [5, 3, 1, 4, 2];                                          // porch, sitting room, kitchen, your room, hall
      for (let i = 0; i < 5; i++) for (let k = 0; k < turns[i]; k++) { this.debugInteract(this._plates[i]); await this.debugWait(0.05); }
      this.debugInteract(this._hallDoor); await this._waitFor(() => this._exitOpen, 3);
      pl.teleport(-1.5, -3.6);
      await this._waitFor(() => this.isCompleted, 6);
    } finally {
      this.game.engine.timeScale = 1;
    }
  }
}
