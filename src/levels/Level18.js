import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeTable, makeShelf, makePictureFrame, makeDust,
  makeClockFace, applyFog,
} from '../core/props.js';
import { makeChild } from '../core/presence.js';
import { Hours } from '../core/hours.js';

// XVIII — The Sitting Room
// The wireless must be tuned to the one station, three clicks, and every
// click brings something small down the stairs with a torch. You are the
// thing in the dark now: keep out of its light, throw a sound, click, move.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.3

const W = 6.4, D = 5.2, H = 2.7;                       // origin at the centre; +X is the hall wall
const CLOCK_POS = { x: -2.7, y: 1.34, z: 0.5 };
const WIRELESS = { x: 2.0, y: 0.85, z: -2.3 };
const SET_Y = 0.89;                                    // the set sits on the table top (0.74)
const DOOR_POS = { x: 3.2, y: 1.2, z: 1.6 };
const D_SPOT = new THREE.Vector3(2.4, 0, 1.6);        // the child's place just inside the door
const OUT = new THREE.Vector3(3.8, 0, 1.6);           // through the door, out of sight
const HEARTH = { x: -2.9, y: 0.3, z: 0.4 };           // the poker, and the fire
const CUP = { x: -0.95, y: 0.75, z: 2.2 };
const HATCH = { x: 3.15, y: 1.2, z: -1.5 };
const WINDOW = { x: -1.2, y: 1.4, z: -2.58 };
const STATION = '247';
const TUNE = LevelBase.tune('EGAGEGE');
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
const GRADE_E = { vignette: 1.2, grain: 0.03, desat: 0.08, lift: 0.03, fringe: 0.0005 };
const GRADE_M = { vignette: 0.9, grain: 0.045, desat: 0.35, lift: 0.09, fringe: 0.001 };

export default class Level18 extends LevelBase {
  static meta = {
    id: 18,
    numeral: 'XVIII',
    title: 'The Sitting Room',
    mood: 'night',
    grade: GRADE,
    intro: 'The wireless is on, between stations, and something small upstairs has heard you come in.',
    outro:
      'You were the one in the dark, for once,\n' +
      'keeping out of the light it carried,\n' +
      'and it went back up to bed humming your song. Her song.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    this._wound = false;
    this._digits = '';
    this._tuned = false;
    this._exitOpen = false;
    this._wrongCount = 0;
    this._seenCount = 0;
    this._torchTaken = false;
    this._clockLocked = false;
    this._timers = {};
    this._cooldown = {};                                  // sound event name -> time until reusable
    this._child = null;                                   // built in _buildChild
    this._doorBlocker = null;

    this._buildShell();
    this._buildFurniture();
    this._buildWireless();
    this._buildClock();
    this._buildChild();
    this._bindLook({ x: -1.2, y: 1.4, z: -2.55 }, { x: -2, y: 6, z: -10 }, { x: -1.5, y: 1.7, z: -4.5 });
    this._wirePuzzle();

    this.spawn.position.set(2.4, 0, 1.6);
    this.spawn.yaw = Math.PI / 2;                          // facing −X into the room
    this.bounds = new THREE.Box3(new THREE.Vector3(-3.0, 0, -2.4), new THREE.Vector3(5.2, 3, 2.4));
    this.setObjective('the wireless. she said the wireless.');

    this.hours.start();
    this.track(this.hours);
  }

  // ---------- shell helpers ----------

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

  // ---------- the shell ----------

  _buildShell() {
    const wallMat = makeMat('wallpaper', { base: '#8d8378', stripe: '#7f7468', repeat: [3, 1.2] });
    const carpetMat = makeMat('carpet', { base: '#5a4e4c', repeat: [4, 3] });
    const rugMat = makeMat('carpet', { base: '#6b4a48', repeat: [2, 1.5] });
    const ceilMat = makeMat('plaster', { base: '#9a9384', repeat: [3, 2.5] });
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x3c322a, roughness: 0.8 });
    this._wood = makeMat('wood', { base: '#5a4028', repeat: [1, 1] });

    const floor = this._plane(W, D, carpetMat, 0, 0, 0, 'up');
    this.addGround(floor);
    this._plane(3.2, 2.4, rugMat, -0.6, 0.005, 0, 'up');
    this._plane(W, D, ceilMat, 0, H, 0, 'down');

    // north wall (−Z) with the window opening: x −1.9..−0.5, y 0.8..2.0
    this._box(1.5, H, 0.2, wallMat, -2.65, H / 2, -2.7);
    this._box(3.9, H, 0.2, wallMat, 1.45, H / 2, -2.7);
    this._box(1.4, 0.8, 0.2, wallMat, -1.2, 0.4, -2.7);
    this._box(1.4, 0.7, 0.2, wallMat, -1.2, 2.35, -2.7);
    // south wall (+Z), west wall (−X)
    this._box(W + 0.4, H, 0.2, wallMat, 0, H / 2, 2.7);
    this._box(0.2, H, D + 0.4, wallMat, -3.3, H / 2, 0);
    // east wall (+X) with the hall doorway: z 1.0..2.2
    this._box(0.2, H, 3.8, wallMat, 3.3, H / 2, -0.9);
    this._box(0.2, H, 0.6, wallMat, 3.3, H / 2, 2.5);
    this._box(0.2, 0.51, 1.2, wallMat, 3.3, 2.445, 1.6, { collide: false });
    // skirting
    for (const [w, d, x, z] of [[W, 0.04, 0, -2.58], [W, 0.04, 0, 2.58], [0.04, D, -3.18, 0], [0.04, D, 3.18, 0]]) {
      this._box(w, 0.14, d, skirtMat, x, 0.07, z, { collide: false });
    }

    // ---------- the hall door and the stub beyond ----------
    this._hallDoor = makeDoor({ color: '#5a4636' });
    this._hallDoor.position.set(DOOR_POS.x, 0, DOOR_POS.z);
    this._hallDoor.rotation.y = -Math.PI / 2;
    this._hallDoor.panel.material.color.set('#9c8365');   // the map is already dark; let the grain read
    this.add(this._hallDoor);
    this.track(this._hallDoor);
    this._blockDoor(true);

    const stubWall = makeMat('wallpaper', { base: '#7d7469', stripe: '#6f6659', repeat: [1.5, 1.4] });
    const stubFloor = this._plane(2.2, 1.2, makeMat('carpet', { base: '#4c4340', repeat: [2, 1] }), 4.3, 0, 1.6, 'up');
    this.addGround(stubFloor);
    this._plane(2.2, 1.2, makeMat('plaster', { base: '#8b8477', repeat: [2, 1] }), 4.3, 3.2, 1.6, 'down');
    this._box(2.2, 3.2, 0.2, stubWall, 4.5, 1.6, 0.9);
    this._box(2.2, 3.2, 0.2, stubWall, 4.5, 1.6, 2.3);
    this._box(0.2, 3.2, 1.6, stubWall, 5.5, 1.6, 1.6);
    this._box(0.2, 0.5, 1.4, stubWall, 3.3, 2.95, 1.6, { collide: false });   // above the room's ceiling
    const treadMat = makeMat('wood', { base: '#4e3a29', repeat: [1, 1] });
    for (let i = 0; i < 3; i++) {
      const h = 0.16 * (i + 1);
      this._box(0.3, h, 1.2, treadMat, 4.55 + i * 0.3, h / 2, 1.6, { collide: true, ground: true });
    }
    this._landing = makeBulbLight({ intensity: 0, y: 3.0 });
    this._landing.position.set(5.0, 0, 1.6);
    this.add(this._landing);
    this._underDoor = new THREE.PointLight(0xffd9a0, 0, 3.0, 1.3);   // it comes under the door
    this._underDoor.position.set(2.98, 0.34, 1.6);
    this.add(this._underDoor);
    const leak = new THREE.MeshStandardMaterial({ color: 0x120d08, emissive: 0xffd9a0, emissiveIntensity: 0.75, roughness: 1 });
    this._doorGlow = [
      this._box(0.01, 2.02, 0.014, leak, 3.168, 1.03, 1.106, { collide: false }),
      this._box(0.01, 2.02, 0.014, leak, 3.168, 1.03, 2.094, { collide: false }),
      this._box(0.01, 0.014, 1.0, leak, 3.168, 2.045, 1.6, { collide: false }),
      this._box(0.01, 0.012, 1.0, leak, 3.168, 0.026, 1.6, { collide: false }),
    ];
    this.tick(() => {
      const on = !this._hallDoor.isOpen() && !this.hours.is('morning');
      for (const g of this._doorGlow) g.visible = on;
    });

    // the morning: the door stands open onto white
    this._white = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 1 })
    );
    this._white.position.set(3.45, 1.1, 1.6);
    this._white.rotation.y = -Math.PI / 2;
    this.add(this._white);
    this.hours.bind('morning', { objects: [this._white], blockers: [[[3.4, 0, 1.0], [3.5, 2.5, 2.2]]] });

    // ---------- the chimney breast, the hearth, the mantel ----------
    const brick = makeMat('plaster', { base: '#6f6259', repeat: [1, 1.6] });
    this._breast = new THREE.Group();
    for (const [d, cz] of [[0.4, -0.6], [0.4, 0.6]]) {
      const m = makeWall(0.45, 0.7, d, brick);
      m.position.set(-2.975, 0.35, cz);
      this._breast.add(m);
    }
    const above = makeWall(0.45, 2.0, 1.6, brick);
    above.position.set(-2.975, 1.7, 0);
    this._breast.add(above);
    this.add(this._breast);
    this.addCollider(this._breast);
    // the opening: a dark back plate and a stone floor to it
    const sooty = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 1 });
    this._box(0.06, 0.7, 0.8, sooty, -3.17, 0.35, 0, { collide: false });
    this._box(0.42, 0.04, 0.8, new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 1 }),
      -2.98, 0.02, 0, { collide: false });
    const mantel = this._box(0.58, 0.06, 1.8, this._wood, -2.91, 1.18, 0, { collide: false });
    mantel.castShadow = true;

    // the poker, leaning in the hearth
    this._poker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.011, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.45, metalness: 0.8 })
    );
    this._poker.position.set(-2.9, 0.35, 0.22);
    this._poker.rotation.z = 0.22;
    this._poker.rotation.x = -0.12;
    this._poker.castShadow = true;
    this.add(this._poker);

    // ---------- the window, and the street that refuses it ----------
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.8 });
    this._box(1.5, 0.07, 0.24, frameMat, -1.2, 0.79, -2.66, { collide: false });   // sill
    this._box(1.5, 0.06, 0.14, frameMat, -1.2, 2.02, -2.66, { collide: false });
    for (const x of [-1.91, -0.49]) this._box(0.05, 1.25, 0.14, frameMat, x, 1.4, -2.66, { collide: false });
    this._box(0.04, 1.2, 0.1, frameMat, -1.2, 1.4, -2.64, { collide: false });
    this._box(1.4, 0.04, 0.1, frameMat, -1.2, 1.4, -2.64, { collide: false });

    this._windowPane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x10141f, roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.55,
      })
    );
    this._windowPane.position.set(-1.2, 1.4, -2.62);
    this.add(this._windowPane);
    this._windowMorning = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 1 })
    );
    this._windowMorning.position.set(-1.2, 1.4, -2.62);
    this.add(this._windowMorning);
    this.hours.bind('night', { objects: [this._windowPane] });
    this.hours.bind('evening', { objects: [this._windowPane] });
    this.hours.bind('morning', { objects: [this._windowMorning] });

    // outside: a strip of garden, a wall, and III's lamp post
    this._plane(12, 11.2, makeMat('grass', { base: '#33382c', repeat: [8, 8] }), -2, -0.02, -8.4, 'up');
    this._box(12, 1.6, 0.24, makeMat('concrete', { base: '#4c4741', repeat: [8, 1] }), -2, 0.8, -9, { collide: false });
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.7, metalness: 0.4 })
    );
    post.position.set(-1.2, 1.7, -7);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.34, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2a2f34, emissive: 0xffd9a0, emissiveIntensity: 0.5, roughness: 0.6 })
    );
    head.position.set(-1.2, 3.5, -7);
    this.add(post, head);
    this._postLight = new THREE.PointLight(0xffd9a0, 0, 9, 1.6);
    this._postLight.position.set(-1.2, 3.35, -7);
    this.add(this._postLight);
    let postNext = 0;
    this.tick((dt, t) => {                                   // it flickers, and it never quite reaches in
      if (!this.hours.is('night') || this.hours.changing) return;
      if (t < postNext) return;
      const on = Math.random() > 0.05;
      this._postLight.intensity = on ? 0.8 : 0.15;
      postNext = t + (on ? 0.4 + Math.random() * 2.6 : 0.05 + Math.random() * 0.12);
    });

    // ---------- the serving hatch ----------
    this._hatch = new THREE.Group();
    const hFrame = makeWall(0.05, 0.62, 0.82, frameMat);
    hFrame.position.set(3.19, HATCH.y, HATCH.z);
    const shutter = makeWall(0.05, 0.5, 0.7, this._wood);
    shutter.position.set(3.16, HATCH.y, HATCH.z);
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a7440, roughness: 0.4, metalness: 0.8 })
    );
    handle.position.set(3.12, HATCH.y - 0.02, HATCH.z);
    this._hatch.add(hFrame, shutter, handle);
    this.add(this._hatch);

    this._dust = makeDust({ count: 160, box: [6, 2.6, 5], center: [0, 1.4, 0], size: 0.009 });
    this.add(this._dust);
    this.track(this._dust);
  }

  // ---------- the furniture ----------

  _buildFurniture() {
    const chairMat = makeMat('carpet', { base: '#6d625b', repeat: [1, 1] });
    const sheetMat = new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 1 });
    this._chairBacks = [];
    const sheets = [];
    const chair = (z) => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.7), chairMat);
      seat.position.set(-1.4, 0.225, z);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.05, 0.7), chairMat);
      back.position.set(-1.05, 0.525, z);
      g.add(seat, back);
      for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.14), chairMat);
        arm.position.set(-1.4, 0.55, z + s * 0.29);
        g.add(arm);
      }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.add(g);
      this.addCollider(g);
      this._chairBacks.push(back);
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.16, 0.84), sheetMat);
      sheet.position.set(-1.32, 0.58, z);
      sheet.castShadow = sheet.receiveShadow = true;
      this.add(sheet);
      sheets.push(sheet);
      return g;
    };
    this._chairN = chair(-0.8);                              // hers: the dent, the knitting
    this._chairS = chair(0.8);

    // the dent, and her knitting — the evening only
    const dent = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.02, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x38322f, roughness: 1 })
    );
    dent.position.set(-1.4, 0.455, -0.8);
    this.add(dent);
    const wool = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x8d5b52, roughness: 1 })
    );
    wool.position.set(-1.28, 0.52, -0.62);
    wool.castShadow = true;
    const needles = new THREE.Group();
    for (const s of [-1, 1]) {
      const n = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.004, 0.3, 6),
        new THREE.MeshStandardMaterial({ color: 0xc9bda6, roughness: 0.5 })
      );
      n.position.set(-1.45 + s * 0.02, 0.5, -0.9);
      n.rotation.z = Math.PI / 2.2;
      n.rotation.y = s * 0.2;
      needles.add(n);
    }
    this.add(wool, needles);

    // the sofa, against the south wall
    const sofaMat = makeMat('carpet', { base: '#675d59', repeat: [1, 1] });
    this._sofa = new THREE.Group();
    const sSeat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.75), sofaMat);
    sSeat.position.set(0.2, 0.21, 2.15);
    this._sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.18), sofaMat);
    this._sofaBack.position.set(0.2, 0.62, 2.47);
    this._sofa.add(sSeat, this._sofaBack);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.75), sofaMat);
      arm.position.set(0.2 + s * 0.86, 0.5, 2.15);
      this._sofa.add(arm);
    }
    this._sofa.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.add(this._sofa);
    this.addCollider(this._sofa);
    const sofaSheet = new THREE.Mesh(new THREE.BoxGeometry(2.06, 1.24, 0.9), sheetMat);
    sofaSheet.position.set(0.2, 0.62, 2.16);
    sofaSheet.castShadow = sofaSheet.receiveShadow = true;
    this.add(sofaSheet);
    sheets.push(sofaSheet);

    // the side table and the cup
    const side = makeTable({ w: 0.45, d: 0.45, h: 0.72 });
    side.position.set(-0.95, 0, 2.2);
    this.add(side);
    this.addCollider(side);
    this._cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.033, 0.08, 14),
      new THREE.MeshStandardMaterial({ color: 0xd6cdba, roughness: 0.5 })
    );
    this._cup.position.set(CUP.x, 0.78, CUP.z);
    this._cup.castShadow = true;
    this.add(this._cup);
    this._cupSteam = makeDust({ count: 16, box: [0.09, 0.34, 0.09], center: [CUP.x, 0.98, CUP.z], size: 0.008 });
    this.add(this._cupSteam);
    this.track(this._cupSteam);

    // the bookcase, making the alcove with the west wall
    this._bookcase = makeShelf({ w: 1.2, h: 1.9, d: 0.3 });
    this._bookcase.position.set(-2.0, 0, 1.9);
    this._bookcase.rotation.y = Math.PI / 2;
    this.add(this._bookcase);
    this.addCollider(this._bookcase);
    const spines = ['#5c3a33', '#3f4a3a', '#4a4258', '#6a5a3a', '#3a4a52'];
    for (let s = 0; s < 4; s++) {
      let z = 1.42;
      while (z < 2.42) {
        const w = 0.03 + Math.random() * 0.03, h = 0.19 + Math.random() * 0.06;
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, h, w),
          new THREE.MeshStandardMaterial({ color: spines[Math.floor(Math.random() * spines.length)], roughness: 0.9 })
        );
        b.position.set(-2.0, 0.065 + s * 0.45 + h / 2, z + w / 2);
        b.castShadow = true;
        this.add(b);
        z += w + 0.004;
      }
    }

    // the standard lamp
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16), lampMat);
    base.position.set(2.6, 0.015, -0.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 8), lampMat);
    pole.position.set(2.6, 0.78, -0.6);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.21, 0.26, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xd9c39a, emissive: 0xffd2a0, emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide,
      })
    );
    shade.position.set(2.6, 1.62, -0.6);
    this.add(base, pole, shade);
    this._shade = shade;
    this._lampLight = new THREE.PointLight(0xffd2a0, 0, 6, 1.6);
    this._lampLight.position.set(2.6, 1.6, -0.6);
    this.add(this._lampLight);

    // the fire
    this._fireLight = new THREE.PointLight(0xff9a4a, 0, 6, 1.5);
    this._fireLight.position.set(-2.7, 0.45, 0);
    this.add(this._fireLight);
    this._embers = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.14, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff7a28, emissiveIntensity: 1.8, roughness: 1 })
    );
    this._embers.position.set(-3.0, 0.11, 0);
    this.add(this._embers);
    let fireNext = 0;
    this.tick((dt, t) => {
      if (!this.hours.is('evening') || this.hours.changing) return;
      if (t < fireNext) return;
      this._fireLight.intensity = 3.6 * (0.8 + Math.random() * 0.4);
      this._embers.material.emissiveIntensity = 1.5 + Math.random() * 0.7;
      fireNext = t + 0.08 + Math.random() * 0.18;
    });

    // the photographs on the breast, and the pale squares they leave
    const photos = [], pales = [];
    for (const z of [-0.6, 0, 0.6]) {
      const f = makePictureFrame({ texture: blurredPhotoTexture({ figures: 2 }), width: 0.16, height: 0.12 });
      f.position.set(-2.735, 1.62, z);
      f.rotation.y = Math.PI / 2;
      this.add(f);
      photos.push(f);
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x8e8177, roughness: 1 })
      );
      p.position.set(-2.745, 1.62, z);
      p.rotation.y = Math.PI / 2;
      this.add(p);
      pales.push(p);
    }

    // ---------- the morning: boxes ----------
    this._boxKeep = this._morningBox('SITTING ROOM — keep', -0.2, -1.6, () => {
      this.subtitle('The wireless, its cord wound round it. It still gets the one station, she said.', 6);
    });
    this._boxToys = this._morningBox('SMALL — toys', 0.6, -1.6, () => {
      if (this._torchTaken) { this.subtitle('Nothing else in it that is yours.', 4); return; }
      this._torchTaken = true;
      this.giveItem({ id: 'torch', name: 'a torch' });
      this.subtitle('A torch. Its batteries are long dead, here. You take it anyway.', 6);
    });
    this._boxVan = this._morningBox('SITTING ROOM — van', 1.4, -1.6, () => {
      this.subtitle('Books. The rug, rolled.', 4);
    });
    const boxes = [this._boxKeep, this._boxToys, this._boxVan];

    // ---------- what belongs to which hour ----------
    const nightThings = [this._cup, ...photos];
    const eveningThings = [this._cup, ...photos, dent, wool, needles, this._embers, this._cupSteam];
    this.hours.bind('night', { objects: nightThings, interact: [this._cup, this._poker, this._windowPane, this._hatch] });
    this.hours.bind('evening', {
      objects: eveningThings,
      interact: [this._cup, this._poker, this._windowPane, this._hatch],
      loops: [{ kind: 'fire', position: { x: -2.9, y: 0.5, z: 0 } }],
    });
    this.hours.bind('morning', { objects: [...sheets, ...pales, ...boxes], colliders: boxes, interact: boxes });
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

  // ---------- the wireless ----------

  _buildWireless() {
    const table = makeTable({ w: 0.8, d: 0.5, h: 0.7 });
    table.position.set(WIRELESS.x, 0, WIRELESS.z);
    this.add(table); this.addCollider(table);
    const wood = makeMat('wood', { base: '#5a3f2e', repeat: [1, 1] });
    const set = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.22), wood);
    set.position.set(WIRELESS.x, SET_Y, WIRELESS.z);
    set.castShadow = true;
    this.add(set);
    this._wireless = set;
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));
    grille.position.set(WIRELESS.x - 0.1, SET_Y, WIRELESS.z + 0.111);
    this.add(grille);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.08), new THREE.MeshStandardMaterial({
      map: textTexture({ text: '200 · 250 · 300 · 350 · 400 · 450 · 500 · 550', font: '18px Georgia', color: '#3a332c', bg: '#e8e0cc', width: 512, height: 96 }),
      emissive: 0xffe7b8, emissiveIntensity: 0.25, roughness: 0.7,
    }));
    face.position.set(WIRELESS.x + 0.1, SET_Y + 0.03, WIRELESS.z + 0.111);
    this.add(face);
    this._needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.07, 0.002), new THREE.MeshStandardMaterial({ color: 0xaa2a1a }));
    this._needle.position.set(WIRELESS.x + 0.1, SET_Y + 0.03, WIRELESS.z + 0.113);
    this.add(this._needle);
    this._setNeedle(540);
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.03, 14),
      new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.5 })
    );
    knob.rotation.x = Math.PI / 2;
    knob.position.set(WIRELESS.x + 0.16, SET_Y - 0.08, WIRELESS.z + 0.12);
    this.add(knob);
    // a faint warm glow off the dial — the only light in the room that is on
    this._dialGlow = new THREE.PointLight(0xffd9a0, 0, 1.6, 1.6);
    this._dialGlow.position.set(WIRELESS.x + 0.1, SET_Y + 0.03, WIRELESS.z + 0.2);
    this.add(this._dialGlow);

    // the strip on the glass (evening)
    this._strip = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.018), new THREE.MeshStandardMaterial({
      map: textTexture({ text: '247 — ours', font: 'italic 22px Georgia', color: '#3a332c', bg: '#f1ead6', width: 256, height: 64 }), roughness: 0.8,
    }));
    this._strip.position.set(WIRELESS.x + 0.1, SET_Y - 0.015, WIRELESS.z + 0.114);
    this.add(this._strip);
    // a pale square where it stood, at the morning
    this._palePatch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x8a7050, roughness: 0.9 })
    );
    this._palePatch.rotation.x = -Math.PI / 2;
    this._palePatch.position.set(WIRELESS.x, 0.745, WIRELESS.z);
    this.add(this._palePatch);

    const parts = [set, grille, face, this._needle, knob];
    this.hours.bind('night', { objects: parts });
    this.hours.bind('evening', { objects: [...parts, this._strip], interact: [this._strip] });
    this.hours.bind('morning', { objects: [this._palePatch], interact: [this._palePatch] });
  }

  _setNeedle(metres) {
    const k = (Math.min(550, Math.max(200, metres)) - 200) / 350;     // 0..1 across the face
    this._needle.position.x = WIRELESS.x + 0.1 - 0.09 + 0.18 * k;
  }

  // ---------- the mantel clock: the hours device ----------

  _buildClock() {
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.26), caseMat);
    body.position.set(CLOCK_POS.x - 0.02, CLOCK_POS.y, CLOCK_POS.z);
    body.castShadow = true;
    this.add(body);
    this._clockFace = makeClockFace({ radius: 0.1 });
    this._clockFace.position.set(CLOCK_POS.x + 0.022, CLOCK_POS.y, CLOCK_POS.z);
    this._clockFace.rotation.y = Math.PI / 2;
    this._clockFace.setTime(3, 7, 0);
    this.add(this._clockFace); this.track(this._clockFace);
    this.interact(body, { prompt: 'the clock', distance: 3, onInteract: () => this._wind() });
    this._clockBody = body;
  }

  // ---------- the child ----------

  _buildChild() {
    const c = makeChild();
    // rule 12: it is lit — a warm grey you can make out at 3:07, the opposite
    // of the figure. The torch lens keeps its own emissive, so leave it alone.
    c.traverse((o) => {
      if (o.isMesh && o !== c._lens && o.material?.emissive) {
        o.material.emissive.setHex(0x4a4038);
        o.material.emissiveIntensity = 0.85;
      }
    });
    c.visible = false;
    c.position.copy(D_SPOT);
    c.rotation.y = -Math.PI / 2;                           // facing −X
    this.add(c);
    // rule 11: a body you cannot walk into. The near rule is off while it
    // flees, stands still or leaves, so this is what keeps you out of it.
    // Parked out of the world while it is upstairs.
    this._childBox = this.addBlocker([1e4, 0, 1e4], [1e4 + 0.1, 1.15, 1e4 + 0.1]);
    this._child = {
      mesh: c, state: 'off', phase: 0, target: null, t: 0, seenT: 0, nearT: 0, baseYaw: -Math.PI / 2, offT: 0, gone: false,
    };
    this._childOccluders = [this._breast, this._bookcase, ...this._chairBacks];
  }

  // ---------- the look of each hour ----------

  _bindLook(windowPos, sunFrom, moonAt) {
    const hemiN = new THREE.HemisphereLight(0x2a2e44, 0x07070a, 0);
    const hemiE = new THREE.HemisphereLight(0x5a4a3a, 0x1a1410, 0);
    const hemiM = new THREE.HemisphereLight(0xffffff, 0xcfcac0, 0);
    this.add(hemiN, hemiE, hemiM);
    const moon = new THREE.PointLight(0x6c7ea8, 0, 16, 1.4);   // outside, so it comes in at the window
    moon.position.set(moonAt.x, moonAt.y, moonAt.z);
    this.add(moon);
    const sun = new THREE.DirectionalLight(0xfff2dc, 0);
    sun.position.set(sunFrom.x, sunFrom.y, sunFrom.z);
    sun.target.position.set(0, 1, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6; sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
    this.add(sun, sun.target);
    const fill = new THREE.PointLight(0x39435f, 0, 10, 1.3);
    fill.position.set(1.0, 1.9, 0.6);
    this.add(fill);
    this.hours.bind('night', {
      lights: [{ light: hemiN, intensity: 0.95 }, { light: moon, intensity: 9.0 },
        { light: fill, intensity: 1.9 }, { light: this._underDoor, intensity: 2.6 },
        { light: this._landing.light, intensity: 4.0 }, { light: this._dialGlow, intensity: 0.5 },
        { light: this._postLight, intensity: 0.8 }],
      fog: { color: '#0a0a10', near: 1.5, far: 14 }, grade: GRADE, mood: this.constructor.meta.mood,
    });
    this.hours.bind('evening', {
      lights: [{ light: hemiE, intensity: 1.15 }, { light: this._lampLight, intensity: 6.0 },
        { light: this._fireLight, intensity: 3.6 }, { light: this._landing.light, intensity: 3.0 },
        { light: this._dialGlow, intensity: 0.6 }, { light: this._underDoor, intensity: 2.0 }],
      fog: { color: '#1a140f', near: 2, far: 18 }, grade: GRADE_E, mood: 'evening',
    });
    this.hours.bind('morning', {
      lights: [{ light: hemiM, intensity: 1.5 }, { light: sun, intensity: 1.4 }],
      fog: { color: '#d8d5ce', near: 1, far: 9 }, grade: GRADE_M, mood: 'morning',
      loops: [{ kind: 'birds', position: windowPos }],
    });
    // the shade lights up with the lamp
    this.tick(() => {
      this._shade.material.emissiveIntensity = Math.min(1, this._lampLight.intensity / 6) * 1.6;
    });
  }

  // ---------- the hours, by hand, at the clock ----------

  _wind() {
    if (this._clockLocked || this.hours.changing) return;
    this.playSoundAt('wind', CLOCK_POS);
    const next = this.hours.order[(this.hours.order.indexOf(this.hours.current) + 1) % 3];
    const [h, m] = { night: [3, 7], morning: [7, 15], evening: [8, 30] }[next];
    this._clockFace.setTime(h, m, 1.6);
    this.hours.next();
    if (!this._wound) {
      this._wound = true;
      this.subtitle('The hands move. They never did, before.', 5);
      this.setObjective('the wireless, at another hour');
    }
  }

  /** The doorway is shut to you until the tune plays. Idempotent. */
  _blockDoor(on) {
    if (on && !this._doorBlocker) this._doorBlocker = this.addBlocker([3.15, 0, 1.0], [3.25, 2.2, 2.2]);
    else if (!on && this._doorBlocker) { this.removeBlocker(this._doorBlocker); this._doorBlocker = null; }
  }

  // ---------- the puzzle ----------

  _wirePuzzle() {
    // ---- hours ----
    this.hours.bind('evening', { onEnter: () => {
      this._setNeedle(247);
      const tune = () => {
        if (!this.hours.is('evening')) return;
        TUNE.forEach((f, i) => this.after(i * 0.5, () => this.playSoundAt('piano', WIRELESS, { freq: f, gain: 0.05 })));
        this._timers.tune = this.after(14, tune);
      };
      tune();
      this._radio = this.loopAt('radio', WIRELESS); this._radio.setGain(0.3);
      if (!this._eveningOnce) {
        this._eveningOnce = true;
        this.after(15, () => {
          if (this.hours.is('evening')) {
            this.playSoundAt('handle', DOOR_POS);
            this.cue('the door handle', new THREE.Vector3(DOOR_POS.x, DOOR_POS.y, DOOR_POS.z));
            this.subtitle('She thought of something, and didn\'t.', 4);
          }
        });
      }
    } });
    this.hours.bind('evening', { onLeave: () => { clearTimeout(this._timers?.tune); this._radio?.stop(0.5); this._radio = null; } });
    this.hours.bind('night', { onEnter: () => {
      if (!this._tuned) this._setNeedle(this._digits ? parseInt(this._digits.padEnd(3, '0'), 10) : 540);
      this._radio = this.loopAt('radio', WIRELESS); this._radio.setGain(this._tuned ? 0.2 : 0.25);
      const st = () => {
        if (!this.hours.is('night') || this._tuned) return;
        this.playSoundAt('static', WIRELESS, { dur: 0.6 });
        this._timers.static = this.after(9, st);
      };
      this._timers.static = this.after(4, st);
    } });
    this.hours.bind('night', { onLeave: () => { clearTimeout(this._timers?.static); this._radio?.stop(0.5); this._radio = null; } });
    this.hours.bind('morning', { onEnter: () => { if (!this._exitOpen) { this._hallDoor.setAngle(Math.PI / 2); this._blockDoor(false); } } });
    this.hours.bind('morning', { onLeave: () => { if (!this._exitOpen) { this._hallDoor.setAngle(0); this._blockDoor(true); } } });

    // ---- the strip, her things ----
    this.interact(this._strip, { prompt: 'a label on the glass', onInteract: () => this.learnClue({ id: 'l18-dial', title: 'the wireless, at half past eight', body: '247. a label on the glass, in her hand: "ours".' }) });
    this.interact(this._palePatch, { prompt: 'where the wireless stood', onInteract: () => this.subtitle('A pale square where it stood.', 4) });
    this.interact(this._cup, { prompt: 'the cup', onInteract: () => this._soundEvent('cup') });
    this.interact(this._poker, { prompt: 'the poker', onInteract: () => this._soundEvent('poker') });
    this.interact(this._hatch, { prompt: 'the hatch', onInteract: () => this._soundEvent('hatch') });
    this.interact(this._windowPane, { prompt: 'the window', onInteract: () => this._soundEvent('window') });

    // ---- the hall door ----
    this.interact(this._hallDoor, { prompt: 'the door to the hall', onInteract: () => {
      if (this._exitOpen) return;
      this.playSound('locked');
      this.subtitle(this.hours.is('evening') ? 'Not yet. She is still up.' : this.hours.is('morning') ? 'White. The house is gone from here on.' : 'It shut behind you. They always do.', 4);
    } });
    this.tick(() => {
      const pl = this.game.player.position;
      if (this._exitOpen && !this.isCompleted && pl.x > 4.4) this.complete();
      // the door shut behind the child while you were out in the stub, so the
      // blocker was left off: put it back as soon as you are in the room again
      if (!this._exitOpen && !this._doorBlocker && !this._hallDoor.isOpen() && pl.x < 2.9) this._blockDoor(true);
    });

    // ---- the wireless: one digit per touch ----
    this.interact(this._wireless, { prompt: 'the wireless', onInteract: () => {
      if (!this.hours.is('night')) { this.subtitle('On the station. The needle rests where it always rests.', 4); return; }
      if (this._tuned) { this.subtitle('On the station. Low. Leave it.', 3); return; }
      const shown = STATION.split('').map((_, i) => this._digits[i] ?? '·').join(' ');
      this.game.ui.showKeypad({ label: 'the wireless — ' + shown, length: 1, keys: '1234567890', onSubmit: (d) => this._click(d), onCancel: () => {} });
    } });

    // ---- the child ----
    this.tick((dt) => this._updateChild(dt));
  }

  _click(d) {
    this.playSoundAt('tick', WIRELESS, { gain: 0.08 });
    this.cue('a click, at the wireless', new THREE.Vector3(WIRELESS.x, WIRELESS.y, WIRELESS.z));
    this._digits += d;
    this._setNeedle(parseInt(this._digits.padEnd(3, '0'), 10));
    this._summon(new THREE.Vector3(WIRELESS.x, 0, WIRELESS.z));
    if (this._digits.length < 3) { this.setObjective('keep out of its light'); return; }
    if (this._digits === STATION) { this._tunedNow(); return; }
    this.playSoundAt('static', WIRELESS, { dur: 0.8 });
    this.subtitle('Between stations. The needle always rested a little past the middle.', 5);
    this._digits = ''; this._setNeedle(540);
    this._wrongCount++;
    if (this._wrongCount >= 2) this.after(4, () => this.subtitle('There is a label on the glass, at half past eight.', 5));
  }

  _soundEvent(name) {
    const now = performance.now() / 1000;
    if ((this._cooldown[name] ?? 0) > now) return;
    this._cooldown[name] = now + 8;
    const P = {
      poker: { pos: HEARTH, sound: ['clunk', {}], cue: 'the poker falls' },
      cup: { pos: CUP, sound: ['tone', { freq: 1800, gain: 0.05, decay: 0.8 }], cue: 'the cup, set down' },
      hatch: { pos: HATCH, sound: ['knock', { count: 1, soft: true }], cue: 'a plate, in the hatch' },
      window: { pos: WINDOW, sound: ['knock', { count: 1, soft: true }], cue: 'the window, tapped' },
    }[name];
    this.playSoundAt(P.sound[0], P.pos, P.sound[1]);
    this.cue(P.cue, new THREE.Vector3(P.pos.x, P.pos.y, P.pos.z));
    if (name === 'cup' && this.hours.is('evening') && !this._teaSaid) {
      this._teaSaid = true;
      this.subtitle('Tea. She has just put it down.', 4);
    }
    if (this.hours.is('night')) this._summon(new THREE.Vector3(P.pos.x, 0, P.pos.z));
  }

  /** A sound at P: the child comes (if it is not here yet) or turns toward it. */
  _summon(P) {
    const c = this._child;
    if (c.gone || !this.hours.is('night')) return;
    if (c.state === 'off') {
      if (c.offT > 0) return;                                 // it is still upstairs, put off
      const pl = this.game.player.position;
      c.mesh.visible = true; c.mesh.position.copy(D_SPOT); c.mesh.rotation.y = c.baseYaw;
      c.mesh.setTorch(!this._torchTaken);
      this._hallDoor.setOpen(true, 1); this._blockDoor(false); this.playSound('door');
      this.cue('the door', new THREE.Vector3(DOOR_POS.x, DOOR_POS.y, DOOR_POS.z));
      if (this._torchTaken && !this._darkSaid) { this._darkSaid = true; this.subtitle('It stands in the doorway without a light, listening for you. You wish you hadn\'t.', 6); }
      c.state = 'wait'; c.t = 0;
      // you were standing in its doorway when it came down: it sees you at
      // once and goes back up, so it is never near you (rule 11)
      if (Math.hypot(pl.x - D_SPOT.x, pl.z - D_SPOT.z) < 1.6) { this._seen(); return; }
    }
    if (c.state === 'flee' || c.state === 'leaving' || c.state === 'still') return;
    c.target = P.clone(); c.state = 'sound'; c.t = 0; c.turnFrom = c.mesh.rotation.y;
    c.turnTo = Math.atan2(P.x - c.mesh.position.x, P.z - c.mesh.position.z);
  }

  /** Would someone small standing at (x, z) be inside the furniture? */
  _blocked(x, z) {
    for (const b of this.solids) {
      if (b === this._childBox) continue;                     // its own body
      if (b.min.y > 1.0) continue;                            // things it walks under
      if (x > b.min.x - 0.22 && x < b.max.x + 0.22 && z > b.min.z - 0.22 && z < b.max.z + 0.22) return true;
    }
    return false;
  }

  /** Keeps a body-sized blocker on the child (rule 11), or parks it away. */
  _boxChild(pos) {
    const b = this._childBox;
    if (!pos) { b.min.set(1e4, 0, 1e4); b.max.set(1e4 + 0.1, 1.15, 1e4 + 0.1); return; }
    b.min.set(pos.x - 0.45, 0, pos.z - 0.45);
    b.max.set(pos.x + 0.45, 1.15, pos.z + 0.45);
  }

  _updateChild(dt) {
    const c = this._child, m = c.mesh;
    this._boxChild(m.visible ? m.position : null);
    if (c.gone) return;
    if (!this.hours.is('night')) {
      if (c.state !== 'off' || m.visible) {
        m.visible = false; m.setTorch(false);
        c.state = 'off'; c.phase = 0; c.target = null; c.offT = 0; c.seenT = 0; c.nearT = 0;
      }
      return;
    }
    if (c.offT > 0) {
      c.offT -= dt;
      if (c.offT <= 0) { this._summon(D_SPOT.clone()); if (c.state === 'sound') { c.state = 'wait'; c.t = 0; c.target = null; } }
      return;
    }
    if (c.state === 'off') return;
    c.t += dt;
    const pl = this.game.player.position;
    const moveToward = (target, speed, stopAt, avoid = false) => {
      const dx = target.x - m.position.x, dz = target.z - m.position.z, d = Math.hypot(dx, dz);
      if (d <= stopAt) return true;
      const step = Math.min(d - stopAt, speed * dt);
      const nx = m.position.x + dx / d * step, nz = m.position.z + dz / d * step;
      m.rotation.y = Math.atan2(dx, dz);
      if (avoid && this._blocked(nx, nz)) return true;        // it stops at the furniture
      m.position.x = nx; m.position.z = nz;
      return d - step <= stopAt + 0.01;
    };
    switch (c.state) {
      case 'wait':
        m.rotation.y = c.baseYaw + Math.sin(c.t * (2 * Math.PI / 7)) * (65 * Math.PI / 180);
        break;
      case 'sound': {
        if (c.t < 0.6) { let d = c.turnTo - c.turnFrom; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; m.rotation.y = c.turnFrom + d * (c.t / 0.6); }
        else if (moveToward(c.target, 1.1, 1.5, true)) { c.state = 'look'; c.t = 0; c.lookYaw = m.rotation.y; }
        break;
      }
      case 'look':
        if (c.t < 1.0) m.rotation.y = c.lookYaw;
        else if (c.t < 2.6) m.rotation.y = c.lookYaw + Math.sin((c.t - 1.0) * (Math.PI / 0.8)) * (45 * Math.PI / 180);
        else { c.state = 'return'; c.t = 0; }
        break;
      case 'return':
        if (moveToward(D_SPOT, 1.1, 0.05)) {
          if (Math.hypot(D_SPOT.x - m.position.x, D_SPOT.z - m.position.z) < 0.3) m.position.copy(D_SPOT);
          c.state = 'wait'; c.t = 0;
        }
        break;
      case 'flee': {                                          // to the door, then out; phase 0 → 1
        if (c.phase !== 1) { if (moveToward(D_SPOT, 2.2, 0.05)) c.phase = 1; }
        else if (moveToward(OUT, 2.2, 0.05)) {
          m.visible = false; c.state = 'off'; c.phase = 0; c.offT = 12;
          this._hallDoor.setOpen(false); this.playSound('door');
          if (pl.x < 3.05) this._blockDoor(true);             // never shut a player out in the stub
        }
        return;
      }
      case 'leaving': {
        if (c.phase !== 1) { if (moveToward(D_SPOT, 1.0, 0.05)) c.phase = 1; }
        else if (moveToward(OUT, 1.0, 0.05)) {
          m.visible = false; c.gone = true;
          this.footsteps([{ x: 3.4, y: 0, z: 1.6 }, { x: 5.0, y: 1.8, z: 1.6 }], { every: 0.45, opts: { soft: true } });
          this.cue('it goes up', new THREE.Vector3(4.6, 1.4, 1.6));
        }
        return;
      }
      case 'still': return;
    }
    // the seen-test: inside its beam for 0.45 s, or within 1.6 m for 0.3 s
    const eye = new THREE.Vector3(0, 0.95, 0);
    const inBeam = !this._torchTaken && this.isSeenBy(m, { angleDeg: 22, maxDist: 9, occluders: this._childOccluders, eye });
    const near = Math.hypot(pl.x - m.position.x, pl.z - m.position.z) < 1.6;
    c.seenT = inBeam ? c.seenT + dt : 0;
    c.nearT = near ? c.nearT + dt : 0;
    if (c.seenT >= 0.45 || c.nearT >= 0.3) this._seen();
  }

  _seen() {
    const c = this._child;
    c.state = 'flee'; c.phase = 0; c.t = 0; c.seenT = 0; c.nearT = 0;
    this.playSoundAt('gasp', c.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
    this.cue('a gasp', c.mesh.position);
    c.mesh.setTorch(false);
    this.flinch({ flash: 0 });
    this._digits = ''; this._setNeedle(540);
    this.playSoundAt('static', WIRELESS, { dur: 0.6 });
    this.dread(0.5); this.after(6, () => this.dread(0));
    this._seenCount++;
    this.subtitle(this._seenCount === 1 ? 'It saw you. She never let it see her. You know why, now.' : 'It saw you. It will come down again. It always does.', this._seenCount === 1 ? 6 : 5);
    if (this._seenCount >= 3) this.after(4, () => this.subtitle('Give it something else to look at. The poker. The cup. The hatch. The window.', 7));
    if (this.game.ui.modalOpen) this.game.ui.closeModal();
  }

  _tunedNow() {
    this._tuned = true;
    this._clockLocked = true;
    const c = this._child;
    c.state = 'still'; c.t = 0;
    c.mesh.faceToward({ x: WIRELESS.x, y: 0, z: WIRELESS.z });
    c.mesh.setTorch(false);
    this.hush(2);
    this._radio?.setGain(0.2);
    const play = (offset, hum) => TUNE.forEach((f, i) => this.after(offset + i * 0.5, () => {
      this.playSoundAt('piano', WIRELESS, { freq: f, gain: 0.06 });
      if (hum && i === 0) { this.playSoundAt('hummed', c.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), { notes: TUNE, step: 0.5, small: true, holdSeconds: 6 }); this.cue('it hums along', c.mesh.position); }
    }));
    this.after(2, () => { this.cue('the tune, from the wireless', new THREE.Vector3(WIRELESS.x, WIRELESS.y, WIRELESS.z)); play(0, false); });
    this.after(6, () => play(0, true));
    this.after(10.5, () => {
      if (c.state !== 'still') return;
      c.state = 'leaving'; c.phase = 0; c.t = 0;
      this._exitOpen = true;
      if (!this._hallDoor.isOpen()) { this._hallDoor.setOpen(true, 1); }
      this._blockDoor(false);
      this.setObjective('up. two metres behind.');
      if (this._torchTaken) this.subtitle('It goes up humming, in the dark.', 5);
      const again = () => {
        if (!this.hours.is('night')) return;
        TUNE.forEach((f, i) => this.after(i * 0.5, () => this.playSoundAt('piano', WIRELESS, { freq: f, gain: 0.04 })));
        this._timers.again = this.after(20, again);
      };
      this._timers.again = this.after(20, again);
    });
  }

  // ---------- playtest ----------

  async _waitFor(test, capSeconds) {
    const until = Date.now() + capSeconds * 1000;
    while (!test() && Date.now() < until) await this.debugWait(0.05);
  }

  /**
   * Wait under a raised time scale. The crossfade and the child both run on
   * frame time, and a headless render sits far below real time with the engine
   * clamping dt — so hurry the waiting along, as XVII does. Every handler,
   * every test, stays the real one.
   */
  async _fastWait(scale, test, cap) {
    this.game.engine.timeScale = scale;
    try { await this._waitFor(test, cap); } finally { this.game.engine.timeScale = 1; }
  }

  async debugSolve() {
    const pl = this.game.player, c = this._child;
    const wind = async (to) => {
      await this._waitFor(() => !this.hours.changing, 16);
      this.debugInteract(this._clockBody);
      await this._fastWait(12, () => this.hours.is(to) && !this.hours.changing, 22);
    };
    const alcove = () => pl.teleport(-2.7, 1.9, Math.PI / 2);      // behind the bookcase, out of the beam
    const dial = () => pl.teleport(1.6, -1.2, 0);                  // within reach of the wireless

    try {
      await wind('morning');                                        // the torch stays in its box
      await wind('evening');
      this.debugInteract(this._strip); await this.debugWait(0.2);   // 247 — ours
      await wind('night');

      dial();
      this.debugInteract(this._wireless); this.game.ui.submitKeypad('2');  // the child comes down
      alcove();                                                     // behind the bookcase before it turns
      this.debugInteract(this._cup);                                // give it something else to look at
      await this._fastWait(4, () => c.mesh.position.x < 2.2 || c.state === 'look', 10);
      dial();
      this.debugInteract(this._wireless); this.game.ui.submitKeypad('4');
      await this.debugWait(0.25);
      this.debugInteract(this._wireless); this.game.ui.submitKeypad('7');
      alcove();
      await this._waitFor(() => this._tuned, 8);
      await this._waitFor(() => this._exitOpen, 22);
      await this._fastWait(10, () => c.gone, 14);                   // it goes up; you follow
      pl.teleport(4.8, 1.6); await this.debugWait(0.6);
    } finally {
      this.game.engine.timeScale = 1;
    }
  }
}
