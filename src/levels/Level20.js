import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp, makeTable, makeChair,
  makePictureFrame, makeDust, applyFog,
} from '../core/props.js';
import { makeFigure, makeChild } from '../core/presence.js';
import { Hours } from '../core/hours.js';

// XX — The Room
// XI's bedroom from the other side: the child asleep two metres away, the
// evening showing how she left it, the morning's slip saying it in words.
// Set the room, stop the clock at 3:07, go out, lock the door, answer the
// knocks, and leave the last light on.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.5

const W = 4.2, D = 3.6, H = 2.5;                       // XI's interior; origin at the centre; +Z is the door wall
const MIRROR = { x: -2.08, y: 1.4, z: 0.95 };
const CLOCK_POS = { x: 1.6, y: 0.86, z: -0.05 };
const KNOCK_IN = { x: 2.05, y: 1.3, z: 0.9 };          // inside the room (XI's E2)
const KNOCK_OUT = { x: 2.24, y: 1.3, z: 0.9 };         // its back, on the landing
const SWITCH = { x: 0.6, y: 1.3, z: 3.09 };
const HOOK = { x: 3.28, y: 1.3, z: -0.3 };
const HUM4 = LevelBase.tune('EGAG');
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level20 extends LevelBase {
  static meta = {
    id: 20,
    numeral: 'XX',
    title: 'The Room',
    mood: 'night',
    grade: GRADE,
    intro: 'Its room. Your room. It is asleep, and the door is shut, and you have come in the long way.',
    outro:
      'You left it how she left it, and shut the door, and knocked, and left the light on.\n' +
      'Then you went to bed, the way she did,\n' +
      'and slept, for once, without dreaming.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    // fade 0.7, not the arc's 1.6: the software renderer the harness uses runs
    // this room at two or three frames a second with dt clamped to 0.05, so a
    // 1.6 s crossfade costs fifteen seconds of wall time and the screenshot
    // tool gives an hour swap fifteen seconds to land. The blink is the arc's
    // signature and is unchanged; only the dissolve either side of it is shorter.
    this.hours = new Hours(this, { initial: 'night', fade: 0.7, onChange: (h) => this._onHour(h) });

    this._wound = false;
    this._done = { chair: false, sheet: false, wound: false, note: false };
    this._stir = 0; this._stirNeed = 0; this._wakes = 0; this._waking = false;
    this._clockStopped = false; this._clockWrong = 0;
    this._out = false; this._doorOpen = false; this._doorShut = false; this._locked = false;
    this._answered = false; this._lightOn = true; this._lightStage = 0;
    this._holdStill = 0; this._breathT = 0;
    this._sheetHeld = false; this._boxOpen = false; this._noteTaken = false; this._glassSeen = false;
    this._doorBlocker = null; this._wbBlocker = null;

    this._mats();
    this._buildRoom();          // XI's shell + stars + furniture, per hour
    this._buildStub();          // the concrete way in (night)
    this._buildLanding();       // the corridor + east leg + her room + the switch + the hook + the knock spots
    this._buildMirror();        // the pane, the mirror room, the figure
    this._buildSleeper();       // the mound, the head, the seated child (evening)
    this._buildClock();
    this._bindLook({ x: -0.6, y: 1.5, z: -1.79 }, { x: -3, y: 6, z: -8 });
    this._wirePuzzle();

    this.spawn.position.set(-0.55, 0, 3.0);
    this.spawn.yaw = 0;                                    // facing the back panel
    this.bounds = new THREE.Box3(new THREE.Vector3(-2.1, 0, -2.5), new THREE.Vector3(6.4, 3, 4.6));
    this.setObjective('yours always last');

    this.hours.start();
    this.track(this.hours);
  }

  // ---------- small builders ----------

  _mats() {
    this.M = {
      wall: makeMat('wallpaper', { base: '#8d8378', stripe: '#7f7468', repeat: [3, 1.2] }),
      floor: makeMat('carpet', { base: '#5a4e4c', repeat: [3, 3] }),
      ceil: makeMat('plaster', { base: '#9a9488', repeat: [2, 2] }),
      land: makeMat('wallpaper', { base: '#7d7468', stripe: '#6e6659', repeat: [4, 1.2] }),
      landFloor: makeMat('carpet', { base: '#4c4340', repeat: [4, 4] }),
      concrete: makeMat('concrete', { base: '#6e6a64', repeat: [2, 2] }),
      wood: new THREE.MeshStandardMaterial({ color: 0x745c43, roughness: 0.8 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x6d5a45, roughness: 0.75 }),
      linen: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 1 }),
      blanket: new THREE.MeshStandardMaterial({ color: 0x6d5a52, roughness: 1 }),
      dustSheet: new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 1 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x8e7a56, roughness: 0.45, metalness: 0.65 }),
      brass: new THREE.MeshStandardMaterial({
        color: 0xa8925e, roughness: 0.35, metalness: 0.85,
        emissive: 0x3a2c10, emissiveIntensity: 0.9,
      }),
    };
  }

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  _plane(w, d, mat, x, y, z, { ground = false, down = false } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = down ? Math.PI / 2 : -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.add(m);
    if (ground) this.addGround(m);
    return m;
  }

  /**
   * makeDoor tints its wood texture — already generated from that colour — by
   * the colour a second time, which lands the albedo near zero in a room lit
   * by one lamp. Keep the texture, drop the tint (XI's fix).
   */
  _plainWood(door) { door.panel.material.color.setScalar(1); return door; }

  /** A makeDoor with its frame taken off — for panels that are part of a carcass. */
  _bareDoor(door) {
    const pivot = door.panel.parent;
    for (const child of [...door.children]) {
      if (child === pivot) continue;
      door.remove(child);
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
    return this._plainWood(door);
  }

  /** Two raised panels on a door leaf, so a slab of wood reads as joinery. */
  _raisedPanels(door, w, h, offY, face) {
    for (const py of [offY, -offY]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), door.panel.material);
      m.position.set(0, py, face * 0.031);
      door.panel.add(m);
    }
    return door;
  }

  // ---------- XI's room ----------

  _buildRoom() {
    const M = this.M;

    this._plane(W, D, M.floor, 0, 0, 0, { ground: true });
    this._plane(W, D, M.ceil, 0, H, 0, { down: true });

    // west wall, pierced at the mirror so the room behind the glass shows through
    this._box(0.2, H, 2.62, M.wall, -2.2, H / 2, -0.59);            // z −1.9..0.72
    this._box(0.2, H, 0.72, M.wall, -2.2, H / 2, 1.54);             // z 1.18..1.9
    this._box(0.2, 1.02, 0.46, M.wall, -2.2, 0.51, 0.95);           // under the glass
    this._box(0.2, 0.72, 0.46, M.wall, -2.2, 2.14, 0.95);           // over the glass
    // east wall — thin, so the knock spots sit on its landing face
    this._box(0.1, H, 3.8, M.wall, 2.15, H / 2, 0);
    this._box(W + 0.4, H, 0.2, M.wall, 0, H / 2, -1.9);             // north (window)
    // south wall in pieces: west of the wardrobe, between wardrobe and door, east of the door, lintels
    this._box(1.05, H, 0.2, M.wall, -1.575, H / 2, 1.9);
    this._box(0.65, H, 0.2, M.wall, 0.275, H / 2, 1.9);
    this._box(0.3, H, 0.2, M.wall, 1.95, H / 2, 1.9);
    this._box(1.2, H - 2.1, 0.2, M.wall, 1.2, 2.1 + (H - 2.1) / 2, 1.9);
    this._box(1.0, H - 2.1, 0.2, M.wall, -0.55, 2.1 + (H - 2.1) / 2, 1.9);

    for (const [w, d, x, z] of [
      [0.04, D, -2.08, 0], [0.04, D, 2.08, 0], [W, 0.04, 0, -1.78],
      [1.05, 0.04, -1.575, 1.78], [0.65, 0.04, 0.275, 1.78], [0.3, 0.04, 1.95, 1.78],
    ]) {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), M.trim);
      sk.position.set(x, 0.06, z);
      this.add(sk);
    }

    // the stick-on stars: forty-five at night and at the evening, six left by the morning
    const starMat = new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x9fd6a8, emissiveIntensity: 1.6 });
    const starGeo = new THREE.SphereGeometry(0.012, 6, 5);
    const at = [];
    for (let i = 0; i < 45; i++) {
      const cl = i % 3;
      at.push([(cl - 1) * 1.1 + (Math.random() - 0.5) * 1.3, H - 0.012, (cl - 1) * 0.6 + (Math.random() - 0.5) * 1.6]);
    }
    const few = at.filter((_, i) => i % 8 === 0);
    const stick = (list) => {
      const im = new THREE.InstancedMesh(starGeo, starMat, list.length);
      const m = new THREE.Matrix4();
      list.forEach((p, i) => im.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])));
      im.instanceMatrix.needsUpdate = true;
      return im;
    };
    this._starsFull = stick(at);
    this._starsFew = stick(few);
    this.add(this._starsFull, this._starsFew);

    // ---- the window, north wall ----
    this._paneNight = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x05060a, metalness: 0.9, roughness: 0.15,
        emissive: 0x0b1220, emissiveIntensity: 0.55,
      }));
    this._paneNight.position.set(-0.6, 1.5, -1.795);
    this._paneMorning = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 }));
    this._paneMorning.position.set(-0.6, 1.5, -1.793);
    this.add(this._paneNight, this._paneMorning);
    for (const [w, h, x, y] of [
      [1.12, 0.06, -0.6, 2.13], [1.12, 0.06, -0.6, 0.87],
      [0.06, 1.32, -1.13, 1.5], [0.06, 1.32, -0.07, 1.5],
    ]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), M.trim);
      f.position.set(x, y, -1.775);
      this.add(f);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.045, 0.12), M.trim);
    sill.position.set(-0.6, 0.845, -1.745);
    this.add(sill);
    const barMat = new THREE.MeshStandardMaterial({ color: 0x3b3129, roughness: 0.8 });
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), barMat);
    barV.position.set(-0.6, 1.5, -1.78); this.add(barV);
    const barH = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.03), barMat);
    barH.position.set(-0.6, 1.5, -1.78); this.add(barH);
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x6b6f7c, roughness: 1 });
    for (const cx of [-1.26, 0.06]) {
      this._box(0.22, 1.5, 0.08, curtainMat, cx, 1.5, -1.71, { collide: false });
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.6, 8), M.trim);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-0.6, 2.26, -1.71);
    this.add(rail);

    // ---- the door onto the landing (XI's, x +1.2) ----
    this._door = this._raisedPanels(this._plainWood(makeDoor({ color: '#5a4636' })), 0.7, 0.85, 0.5, -1);
    this._door.position.set(1.2, 0, 1.8);
    this.add(this._door); this.track(this._door);
    this._doorBlocker = this.addBlocker([0.6, 0, 1.7], [1.8, 2.2, 1.9]);

    // ---- the wardrobe, south wall, west of the door ----
    const carcass = new THREE.MeshStandardMaterial({ color: 0x7a6349, roughness: 0.8 });
    this._box(0.03, 2.1, 0.62, carcass, -1.035, 1.05, 1.49);
    this._box(0.03, 2.1, 0.62, carcass, -0.065, 1.05, 1.49);
    this._box(1.0, 0.04, 0.62, carcass, -0.55, 2.08, 1.49, { collide: false });
    this._box(1.0, 0.03, 0.62, carcass, -0.55, 0.015, 1.49, { collide: false, ground: true });
    this._box(1.0, 0.11, 0.04, carcass, -0.55, 2.045, 1.79, { collide: false });
    this._box(1.12, 0.09, 0.72, carcass, -0.55, 2.145, 1.44, { collide: false });
    this._box(1.08, 0.1, 0.68, carcass, -0.55, 0.05, 1.46, { collide: false });
    const railBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.94, 8), M.metal);
    railBar.rotation.z = Math.PI / 2;
    railBar.position.set(-0.55, 1.9, 1.45);
    this.add(railBar);
    const coats = [[-0.91, 0x6b5f52], [-0.85, 0x847d73], [-0.79, 0x59565a], [-0.22, 0x8d7a60], [-0.16, 0x646a70]];
    coats.forEach(([cx, c], i) => {
      const coat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.0, 0.12),
        new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
      coat.position.set(cx, 1.4, 1.45);
      coat.rotation.y = (i % 2 ? 1 : -1) * 0.06;
      coat.castShadow = true;
      this.add(coat);
    });
    // the two front doors, shut — a wardrobe from the room side
    for (const [dx, ry] of [[-0.8, 0], [-0.3, Math.PI]]) {
      const wd = this._bareDoor(makeDoor({ width: 0.5, height: 2.0, knob: false, color: '#5a4636' }));
      wd.position.set(dx, 0, 1.18);
      wd.rotation.y = ry;
      this._raisedPanels(wd, 0.34, 0.8, 0.48, ry === 0 ? -1 : 1);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), M.brass);
      h.position.set(0.18, 1.05, ry === 0 ? -0.055 : 0.055);
      wd.panel.add(h);
      this.add(wd); this.addCollider(wd.panel);
    }
    // the dust sheet over it, at the morning
    this._wbSheet = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.06, 0.07), M.dustSheet);
    this._wbSheet.position.set(-0.55, 1.05, 1.15);
    this._wbSheet.castShadow = this._wbSheet.receiveShadow = true;
    this.add(this._wbSheet);

    this._backPanel = this._bareDoor(makeDoor({ width: 1.0, height: 2.0, knob: false, color: '#7a5a3a' }));
    this._backPanel.position.set(-0.55, 0, 1.79);
    this.add(this._backPanel); this.track(this._backPanel);
    this._wbBlocker = this.addBlocker([-1.0, 0, 1.7], [-0.1, 2.2, 1.9]);

    // ---- the bed, west wall, head at the north ----
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 2.0), M.wood);
    frame.position.set(-1.55, 0.16, -0.6);
    frame.castShadow = frame.receiveShadow = true;
    this.add(frame); this.addCollider(frame);
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.9, 0.06), M.wood);
    headboard.position.set(-1.55, 0.45, -1.63);
    headboard.castShadow = true;
    this.add(headboard);
    this._bedding = new THREE.Group();
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.17, 1.92), M.linen);
    mattress.position.set(-1.55, 0.4, -0.6);
    mattress.receiveShadow = true;
    const duvet = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.13, 1.5), M.blanket);
    duvet.position.set(-1.55, 0.55, -0.7);
    duvet.castShadow = duvet.receiveShadow = true;
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.32), M.linen);
    pillow.position.set(-1.58, 0.54, -1.42);
    pillow.rotation.y = 0.09;
    pillow.castShadow = true;
    this._bedding.add(mattress, duvet, pillow);
    this.add(this._bedding);

    // the sheet, folded at the bed's foot until you take it
    this._sheetFold = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.34), M.dustSheet);
    this._sheetFold.position.set(-1.55, 0.57, 0.24);
    this._sheetFold.castShadow = this._sheetFold.receiveShadow = true;
    this.add(this._sheetFold);

    // two photographs over the bed, figures too blurred to name
    for (const [pz, py, figs] of [[-0.25, 1.66, 2], [0.06, 1.60, 3]]) {
      const pf = makePictureFrame({ texture: blurredPhotoTexture({ figures: figs }), width: 0.24, height: 0.18 });
      pf.position.set(-2.085, py, pz);
      pf.rotation.y = Math.PI / 2;
      this.add(pf);
    }

    // ---- the desk, east wall ----
    const desk = makeTable({ w: 0.7, d: 1.0, h: 0.76 });
    desk.position.set(1.65, 0, -0.4);
    this.add(desk); this.addCollider(desk);
    const drawerBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.5), M.wood);
    drawerBody.position.set(1.65, 0.65, -0.4);
    drawerBody.castShadow = true;
    this.add(drawerBody);
    this._drawer = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.7 }));
    this._drawer.position.set(1.325, 0.65, -0.4);
    this._drawer.castShadow = true;
    this.add(this._drawer);
    const pull = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), M.brass);
    pull.position.set(1.3, 0.65, -0.4);
    this._drawer.add(pull.clone());
    pull.geometry.dispose();
    // her note, half out of the drawer, at the evening
    this._drawerNoteEvening = makeNoteProp({ tilt: 0.5 });
    this._drawerNoteEvening.position.set(1.24, 0.66, -0.4);
    this._drawerNoteEvening.rotation.z = 0.35;
    this.add(this._drawerNoteEvening);

    // the lamp — the room's warm light at the evening
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 14), M.metal);
    lampBase.position.set(1.45, 0.795, -0.5); this.add(lampBase);
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.29, 8), M.metal);
    lampStem.position.set(1.45, 0.945, -0.5); this.add(lampStem);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.17, 18, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xb9a37a, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }));
    shade.position.set(1.45, 1.13, -0.5); this.add(shade);
    this._lampFilament = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x241d12, emissive: 0xffd9a8, emissiveIntensity: 0.05 }));
    this._lampFilament.position.set(1.45, 1.06, -0.5);
    this.add(this._lampFilament);
    this._deskLamp = new THREE.PointLight(0xffd9a8, 0, 6, 1.0);
    this._deskLamp.position.set(1.4, 1.05, -0.5);
    this.add(this._deskLamp);

    // the shelf and the music box on it
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.9), M.wood);
    plank.position.set(1.94, 1.695, -0.4);
    plank.castShadow = plank.receiveShadow = true;
    this.add(plank);
    for (const bz of [-0.75, -0.05]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.03), M.wood);
      bracket.position.set(1.99, 1.61, bz);
      this.add(bracket);
    }
    this._musicBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.6 }));
    this._musicBox.position.set(1.85, 1.75, -0.4);
    this._musicBox.castShadow = true;
    this.add(this._musicBox);

    // the chair: turned to face the bed at 3:07, at the desk at her evening
    this._chairN = makeChair();
    this._chairN.position.set(1.05, 0, -0.20);
    this._chairN.rotation.y = Math.PI / 2 - Math.PI * 0.85;   // wrong: turned off the desk
    this.add(this._chairN);
    this._chairE = makeChair();
    this._chairE.position.set(1.05, 0, -0.35);
    this._chairE.rotation.y = Math.PI / 2;
    this.add(this._chairE);

    // ---- the morning: the box, the slip, the note, the dust ----
    this._keepBox = this._morningBox('SMALL — keep', 0, -0.5, () => this._openKeepBox());
    this._noteInBox = makeNoteProp({ tilt: -0.3 });
    this._noteInBox.position.set(0, 0.425, -0.5);
    this.add(this._noteInBox);
    this._dust = makeDust({ count: 170, box: [3.8, 2.1, 3.2], center: [0, 1.3, 0] });
    this.add(this._dust); this.track(this._dust);

    // the sheet, once it is over the glass (hers at the evening, yours at 3:07)
    this._sheetOnMirror = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.03), M.dustSheet);
    this._sheetOnMirror.position.set(-2.05, 1.4, 0.95);
    this._sheetOnMirror.rotation.y = Math.PI / 2;
    this._sheetOnMirror.castShadow = this._sheetOnMirror.receiveShadow = true;
    this.add(this._sheetOnMirror);

    // keeping your distance from the bed: you never stand over what is asleep in it
    const bedKeep = [[-2.1, 0, -1.78], [0.45, 2.2, 1.0]];
    const westKeep = [[-2.1, 0, 1.0], [-1.05, 2.2, 1.8]];

    this.hours.bind('night', {
      objects: [this._starsFull, this._paneNight, this._bedding, this._sheetFold, this._chairN, this._musicBox, this._drawer],
      interact: [this._chairN, this._musicBox, this._drawer],
      colliders: [this._chairN],
      blockers: [bedKeep, westKeep],
    });
    this.hours.bind('evening', {
      objects: [this._starsFull, this._paneNight, this._bedding, this._chairE, this._musicBox, this._drawer, this._drawerNoteEvening],
      interact: [this._musicBox, this._drawer],
      colliders: [this._chairE],
      blockers: [bedKeep, westKeep],
      lights: [{ light: this._deskLamp, intensity: 3.2 }],
    });
    this.hours.bind('morning', {
      objects: [this._starsFew, this._paneMorning, this._keepBox, this._wbSheet, this._dust],
      interact: [this._keepBox],
      colliders: [this._keepBox],
    });
  }

  /** A box packed at the morning: label, lid, and whatever is in it. */
  _morningBox(label, x, z, onOpen) {
    const g = new THREE.Group();
    const card = new THREE.MeshStandardMaterial({ color: 0xa3896a, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), card);
    body.position.y = 0.2; body.castShadow = body.receiveShadow = true;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1),
      new THREE.MeshStandardMaterial({
        map: textTexture({ text: label, font: '24px Georgia', color: '#3a332c', bg: '#d9cfbd', width: 384, height: 128 }),
        roughness: 0.9,
      }));
    lab.position.set(0, 0.26, 0.201);
    g.add(body, lab);
    g.position.set(x, 0, z);
    this.add(g);
    this.interact(g, { prompt: label.toLowerCase(), onInteract: () => onOpen(g) });
    return g;
  }

  _openKeepBox() {
    if (!this._boxOpen) {
      this._boxOpen = true;
      this.learnClue({
        id: 'l20-slip', title: 'the slip in the box, in her hand',
        body: 'SMALL — keep. music box (wind it). the sheet — the mirror. the note — the drawer. the chair to the desk. don\'t let it see the glass.',
      });
      this._noteInBox.visible = true;
      this.game.interaction.setEnabled(this._noteInBox, true);
      this.subtitle('Her hand, on the back of a bill. A list for a room she was emptying.', 6);
      return;
    }
    this.subtitle('Stick-on stars, in a bag. Forty-five. You count them without meaning to.', 5);
  }

  // ---------- the concrete way in (night) ----------

  _buildStub() {
    const c = this.M.concrete;
    // The shell stands at every hour. The player can only be back here at
    // 3:07 — the panel shuts behind them and the clock is inside the room —
    // but the screenshot tool shoots from the spawn at all three, and a
    // hidden shell leaves a black void where the concrete should be.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), c);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-0.65, 0.001, 2.6);
    floor.receiveShadow = true;
    this.add(floor); this.addGround(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), c);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(-0.65, 2.3, 2.6);
    this.add(ceil);
    for (const [w, h, d, x, y, z] of [
      [0.2, 2.3, 1.8, -1.15, 1.15, 2.6],        // west
      [0.5, 2.3, 0.2, -1.0, 1.15, 3.4],         // far wall, west of the doorway
      [0.3, 2.3, 0.2, -0.2, 1.15, 3.4],         // far wall, east of it
      [1.2, 0.4, 0.2, -0.65, 2.1, 3.4],         // its lintel
    ]) {
      const m = makeWall(w, h, d, c);
      m.position.set(x, y, z);
      this.add(m);
    }
    for (const [w, h, x, y] of [[0.06, 2.0, -0.77, 0.95], [0.06, 2.0, -0.23, 0.95], [0.6, 0.06, -0.5, 1.92]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), this.M.trim);
      f.position.set(x, y, 3.29);
      this.add(f);
    }
    // one cold source, so the concrete has a shape and the panel can be found
    const lamp = new THREE.PointLight(0xa8b4bc, 0, 3.4, 1.5);
    lamp.position.set(-0.6, 2.1, 2.7);
    this.add(lamp);

    // the doorway at z 3.3: at 3:07 it is the shaft's first landing and no
    // further; at her hours the house is whole and the wall goes straight on
    this._shaftDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 1 }));
    this._shaftDoor.position.set(-0.5, 0.95, 3.42);
    this._shaftDoor.rotation.y = Math.PI;
    this._shaftInfill = makeWall(0.5, 1.9, 0.2, c);
    this._shaftInfill.position.set(-0.5, 0.95, 3.4);
    this.add(this._shaftDoor, this._shaftInfill);

    this.hours.bind('night', {
      objects: [this._shaftDoor],
      lights: [{ light: lamp, intensity: 1.4 }],
      blockers: [
        [[-1.25, 0, 2.5], [-1.05, 2.3, 3.45]],
        [[-1.05, 0, 3.28], [-0.05, 2.3, 3.5]],
      ],
    });
    this.hours.bind('evening', { objects: [this._shaftInfill], lights: [{ light: lamp, intensity: 0.7 }] });
    this.hours.bind('morning', { objects: [this._shaftInfill], lights: [{ light: lamp, intensity: 1.1 }] });

    // the concrete wall where the landing should go on — at every hour
    this._concreteWall = this._box(0.2, H, 1.8, this.M.concrete, -0.05, H / 2, 2.6);
    this.interact(this._concreteWall, { prompt: 'the wall', onInteract: () => this.subtitle('Concrete, where the landing should go on.', 4) });
  }

  // ---------- the landing, the stairs, her door, her room ----------

  _buildLanding() {
    const M = this.M;

    this._plane(3.25, 1.3, M.landFloor, 1.675, 0, 2.45, { ground: true });        // corridor x 0.05..3.3
    this._plane(1.3, 3.75, M.landFloor, 2.75, 0, -0.075, { ground: true });       // east leg x 2.1..3.4
    this._plane(3.4, 2.7, M.ceil, 1.65, H, 3.15, { down: true });
    this._plane(1.3, 3.75, M.ceil, 2.75, H, -0.075, { down: true });

    this._box(2.2, H, 0.2, M.land, 1.15, H / 2, 3.2);            // south wall, west of the stairs
    this._box(0.35, H, 0.2, M.land, 3.225, H / 2, 3.2);          // south wall, east of them
    this._box(1.3, H, 0.2, M.land, 2.75, H / 2, -2.05);          // the leg's north end
    this._box(0.2, H, 1.1, M.land, 3.4, H / 2, -2.05);           // her wall, north of her door
    this._box(0.2, H, 3.9, M.land, 3.4, H / 2, 1.45);            // her wall, south of it
    this._box(0.2, 0.4, 1.0, M.land, 3.4, 2.3, -1.0);            // her door's lintel

    // the light that is left on — never bound to an hour
    this._landBulb = makeBulbLight({ color: 0xffd2a0, intensity: 3.0, distance: 6.5, y: 2.4 });
    this._landBulb.position.set(1.6, 0, 2.45);
    this.add(this._landBulb);
    this._landBulbGlass = this._landBulb.children.find((o) => o.isMesh && o.material.emissiveIntensity > 1);
    // The one bulb hangs in the corridor; its light never reaches round the
    // corner or down the stairs, and the wall the knocks are on faces away
    // from it. Two soft fills carry it, switched with the bulb — the landing
    // light is one light, as far as the room is concerned.
    this._legFill = new THREE.PointLight(0xffd2a0, 1.7, 5.5, 1.5);
    this._legFill.position.set(2.75, 2.15, -0.2);
    this._stairFill = new THREE.PointLight(0xffd2a0, 0.8, 3.0, 1.4);
    this._stairFill.position.set(2.65, 1.7, 3.7);
    this.add(this._legFill, this._stairFill);

    this._switch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xd6cfc2, roughness: 0.6 }));
    this._switch.position.set(SWITCH.x, SWITCH.y, SWITCH.z);
    this._switch.castShadow = true;
    this.add(this._switch);

    // the stairs down, at the corridor's east end
    for (let i = 0; i < 3; i++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.32), M.trim);
      tread.position.set(2.65, -0.09 - 0.18 * i, 3.26 + 0.3 * i);
      tread.receiveShadow = true;
      this.add(tread); this.addGround(tread);
    }
    this._plane(0.8, 0.5, M.landFloor, 2.65, -0.54, 4.15, { ground: true });
    this._box(0.1, 3.2, 1.4, M.land, 2.2, 0.9, 3.8);
    this._box(0.1, 3.2, 1.4, M.land, 3.1, 0.9, 3.8);
    this._stairEnd = this._box(1.0, 3.2, 0.2, M.land, 2.65, 0.9, 4.5);
    this.addBlocker([2.2, -2, 4.3], [3.1, 3, 4.6]);
    this.interact(this._stairEnd, { prompt: 'down', onInteract: () => this.subtitle('Down. Not yet.', 4) });

    // her door, and the white behind it at the morning
    this._herDoor = this._raisedPanels(this._plainWood(makeDoor({ color: '#4f3d2e' })), 0.7, 0.85, 0.5, 1);
    this._herDoor.position.set(3.4, 0, -1.0);
    this._herDoor.rotation.y = -Math.PI / 2;
    this.add(this._herDoor); this.track(this._herDoor);
    this._herBlocker = this.addBlocker([3.3, 0, -1.55], [3.5, 2.2, -0.45]);
    this._whiteBeyond = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 }));
    this._whiteBeyond.position.set(3.62, 1.1, -1.0);
    this._whiteBeyond.rotation.y = -Math.PI / 2;
    this.add(this._whiteBeyond);
    this.hours.bind('morning', { objects: [this._whiteBeyond] });

    // the little key, on its hook by her door
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), M.metal);
    hook.rotation.z = Math.PI / 2;
    hook.position.set(3.28, 1.36, HOOK.z);
    this.add(hook);
    this._keyOnHook = makeKeyProp();
    this._keyOnHook.position.set(HOOK.x, HOOK.y, HOOK.z);
    this._keyOnHook.rotation.z = -Math.PI / 2;
    this._keyOnHook.rotation.y = Math.PI / 2;
    this.add(this._keyOnHook);

    // the three faint patches on the landing face of the room's east wall
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x1a1612, transparent: true, opacity: 0.12, roughness: 1 });
    const mk = (z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), spotMat);
      m.position.set(2.205, 1.3, z);
      m.rotation.y = Math.PI / 2;
      this.add(m);
      return m;
    };
    this._k1 = mk(-1.4); this._k2 = mk(-0.3); this._k3 = mk(0.9);

    // ---- her room ----
    this._plane(2.8, 2.4, M.landFloor, 4.9, 0, -1.2, { ground: true });
    this._plane(2.8, 2.4, M.ceil, 4.9, H, -1.2, { down: true });
    this._box(3.2, H, 0.2, M.land, 4.9, H / 2, -2.5);
    this._box(3.2, H, 0.2, M.land, 4.9, H / 2, 0.1);
    this._box(0.2, H, 2.8, M.land, 6.4, H / 2, -1.2);

    const herPane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x070a10, metalness: 0.9, roughness: 0.2, emissive: 0x0d1622, emissiveIntensity: 0.6 }));
    herPane.position.set(4.9, 1.5, -2.395);
    this.add(herPane);
    for (const [w, h, x, y] of [[1.12, 0.06, 4.9, 2.08], [1.12, 0.06, 4.9, 0.92], [0.06, 1.22, 4.34, 1.5], [0.06, 1.22, 5.46, 1.5]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), M.trim);
      f.position.set(x, y, -2.375);
      this.add(f);
    }
    const ffMat = new THREE.MeshStandardMaterial({ color: 0x2a2a12, emissive: 0xd8e08a, emissiveIntensity: 2.2 });
    this._fireflies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 5), ffMat, 7);
    {
      const m = new THREE.Matrix4();
      for (let i = 0; i < 7; i++) {
        m.makeTranslation(4.45 + Math.random() * 0.9, 1.05 + Math.random() * 0.85, -2.385);
        this._fireflies.setMatrixAt(i, m);
      }
      this._fireflies.instanceMatrix.needsUpdate = true;
    }
    this.add(this._fireflies);
    this._moonHer = new THREE.PointLight(0x6c7ea8, 0, 9, 1.2);
    this._moonHer.position.set(4.9, 1.7, -2.2);
    this.add(this._moonHer);
    this.hours.bind('night', { objects: [this._fireflies], lights: [{ light: this._moonHer, intensity: 3.4 }] });
    this.hours.bind('evening', { lights: [{ light: this._moonHer, intensity: 1.0 }] });

    const herFrame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.32, 0.95), M.wood);
    herFrame.position.set(5.3, 0.16, -1.83);
    herFrame.castShadow = herFrame.receiveShadow = true;
    this.add(herFrame); this.addCollider(herFrame);
    const herHead = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.95), M.wood);
    herHead.position.set(6.28, 0.42, -1.83);
    this.add(herHead);
    this._herBed = new THREE.Group();
    const hm = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.17, 0.9), M.linen);
    hm.position.set(5.3, 0.4, -1.83); hm.receiveShadow = true;
    const hd = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.13, 0.92), M.blanket);
    hd.position.set(5.1, 0.55, -1.83); hd.castShadow = hd.receiveShadow = true;
    const hp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.52), M.linen);
    hp.position.set(6.05, 0.54, -1.83); hp.castShadow = true;
    this._herBed.add(hm, hd, hp);
    this.add(this._herBed);

    const herChair = makeChair();
    herChair.position.set(4.1, 0, -0.45);
    herChair.rotation.y = -0.6;
    this.add(herChair); this.addCollider(herChair);
    const bedside = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.4), M.wood);
    bedside.position.set(4.15, 0.275, -1.95);
    bedside.castShadow = bedside.receiveShadow = true;
    this.add(bedside); this.addCollider(bedside);
    const photo = makePictureFrame({ texture: blurredPhotoTexture({ figures: 2 }), width: 0.2, height: 0.15 });
    photo.position.set(4.15, 0.66, -1.9);
    photo.rotation.y = -0.5;
    this.add(photo);
  }

  // ---------- the glass, and the room behind it ----------

  _buildMirror() {
    const dim = new THREE.MeshStandardMaterial({ color: 0x1a1c24, emissive: 0x171b26, emissiveIntensity: 0.5, roughness: 1 });
    const back = new THREE.MeshStandardMaterial({ color: 0x1a1c24, emissive: 0x27314a, emissiveIntensity: 1.1, roughness: 1 });
    for (const [w, h, d, x, y, z, mat] of [
      [0.2, 1.4, 1.6, -4.4, 1.4, 0.95, back],
      [2.2, 0.1, 1.6, -3.3, 0.8, 0.95, dim],
      [2.2, 0.1, 1.6, -3.3, 2.0, 0.95, dim],
      [2.2, 1.4, 0.1, -3.3, 1.4, 0.30, dim],
      [2.2, 1.4, 0.1, -3.3, 1.4, 1.60, dim],
    ]) {
      this._box(w, h, d, mat, x, y, z, { collide: false });
    }

    this._mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x0a0b0e, metalness: 1, roughness: 0.05, transparent: true, opacity: 0.55,
      }));
    this._mirror.position.set(MIRROR.x, MIRROR.y, MIRROR.z);
    this._mirror.rotation.y = Math.PI / 2;
    this.add(this._mirror);
    for (const [w, h, d, y, z] of [
      [0.03, 0.06, 0.62, 1.83, 0.95], [0.03, 0.06, 0.62, 0.97, 0.95],
      [0.03, 0.92, 0.06, 1.4, 0.67], [0.03, 0.92, 0.06, 1.4, 1.23],
    ]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.M.wood);
      b.position.set(-2.085, y, z);
      this.add(b);
    }

    this._figure = makeFigure();
    this._figure.position.set(-3.2, 0, 0.95);
    this._figure.visible = false;
    this.add(this._figure);
  }

  // ---------- what is asleep in the bed ----------

  _buildSleeper() {
    this._mound = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x8a7468, roughness: 1 }));
    this._mound.position.set(-1.62, 0.68, -1.15);
    this._mound.castShadow = this._mound.receiveShadow = true;
    this.add(this._mound);
    this._head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x9a8c80, roughness: 0.9 }));
    this._head.position.set(-1.6, 0.66, -1.55);
    this._head.castShadow = true;
    this.add(this._head);

    this._childSeated = makeChild();
    this._childSeated.remove(this._childSeated.torch, this._childSeated._lens);
    this._childSeated.setTorch = () => {};
    // makeChild has shoulders and a head but no neck, so the head floats a
    // hand's width clear of them under a lamp. One cylinder closes it here.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a8c80, roughness: 0.9, metalness: 0 }));
    neck.position.y = 0.86 * 1.12;
    neck.castShadow = true;
    this._childSeated.add(neck);
    this._childSeated.position.set(-1.5, 0.34, -1.05);          // sitting up in it, the duvet to its waist
    this._childSeated.rotation.y = Math.PI / 2;          // its front toward the desk lamp
    this.add(this._childSeated);

    this.hours.bind('night', { objects: [this._mound, this._head] });
    this.hours.bind('evening', { objects: [this._childSeated] });

    this.tick((dt, t) => {
      if (!this.hours.is('night')) return;
      this._mound.scale.y = 1 + Math.sin(t * Math.PI * 0.5) * 0.03;
      this._breathT += dt;
      if (this._breathT >= 4) {
        this._breathT = 0;
        this.playSoundAt('breath', { x: -1.6, y: 0.66, z: -1.55 });
      }
    });
  }

  // ---------- the clock ----------

  _buildClock() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 0.6 }));
    body.position.set(1.645, 0.845, CLOCK_POS.z);
    body.castShadow = true;
    this.add(body);
    this._clockMat = new THREE.MeshStandardMaterial({ emissive: 0xff6a4a, emissiveIntensity: 0.9 });
    this._clock = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), this._clockMat);
    this._clock.position.set(CLOCK_POS.x - 0.002, CLOCK_POS.y, CLOCK_POS.z);
    this._clock.rotation.y = -Math.PI / 2;
    this.add(this._clock);
    this._setClock('3:07');
    this.interact(this._clock, { prompt: 'the clock', onInteract: () => this._flip() });
  }

  _setClock(text) {
    const tex = textTexture({ text, font: 'bold 60px monospace', color: '#ff7a5a', bg: '#140c0a', width: 256, height: 128 });
    const old = this._clockMat.map;
    this._clockMat.map = tex;
    this._clockMat.emissiveMap = tex;
    this._clockMat.needsUpdate = true;
    if (old && old !== tex) old.dispose?.();
  }

  // ---------- the per-hour look (spec §5 conventions) ----------

  _bindLook(windowPos, sunFrom) {
    // One hemisphere, not three: every light in the scene costs every pixel of
    // every frame, and this room has to finish an hour swap inside fifteen
    // seconds on the software renderer the harness runs. The colour of the
    // hour is swapped under the blink (_onHour); the intensity still crossfades.
    this._hemi = new THREE.HemisphereLight(0x2a2e44, 0x07070a, 0);
    const hemi = this._hemi;
    this.add(hemi);
    const moon = new THREE.PointLight(0x6c7ea8, 0, 9, 1.6);
    moon.position.set(windowPos.x, windowPos.y, windowPos.z);
    this.add(moon);
    const sun = new THREE.DirectionalLight(0xfff2dc, 0);
    sun.position.set(sunFrom.x, sunFrom.y, sunFrom.z);
    sun.target.position.set(0, 1, 0);
    sun.castShadow = false;                      // turned on at the morning only (_onHour)
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.left = -6; sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
    sun.shadow.camera.far = 26;
    sun.shadow.bias = -0.0006;
    this.add(sun, sun.target);
    this._sun = sun;
    const GRADE_N = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
    const GRADE_E = { vignette: 1.2, grain: 0.03, desat: 0.08, lift: 0.03, fringe: 0.0005 };
    const GRADE_M = { vignette: 0.9, grain: 0.045, desat: 0.35, lift: 0.09, fringe: 0.001 };
    this.hours.bind('night', {
      lights: [{ light: hemi, intensity: 0.55 }, { light: moon, intensity: 3.0 }],
      fog: { color: '#0a0a10', near: 1.5, far: 14 }, grade: GRADE_N, mood: this.constructor.meta.mood,
    });
    this.hours.bind('evening', {
      lights: [{ light: hemi, intensity: 0.45 }],
      fog: { color: '#1a140f', near: 2, far: 18 }, grade: GRADE_E, mood: 'evening',
    });
    this.hours.bind('morning', {
      lights: [{ light: hemi, intensity: 1.5 }, { light: sun, intensity: 1.4 }],
      fog: { color: '#d8d5ce', near: 1, far: 9 }, grade: GRADE_M, mood: 'morning',
      loops: [{ kind: 'birds', position: windowPos }, { kind: 'idle', position: { x: -0.6, y: 0.6, z: -3.4 } }],
    });
  }

  /** Everything that is not lerped and not a plain hour swap. */
  _onHour(hour) {
    const night = hour === 'night';
    this._sheetOnMirror.visible = hour === 'evening' || (night && this._done.sheet);
    this._sheetFold.visible = night && !this._sheetHeld && !this._done.sheet;
    const showNote = hour === 'morning' && this._boxOpen && !this._noteTaken;
    this._noteInBox.visible = showNote;
    this.game.interaction.setEnabled(this._noteInBox, showNote);
    this._lampFilament.material.emissiveIntensity = hour === 'evening' ? 2.6 : 0.05;
    this._sun.castShadow = hour === 'morning';
    const sky = { night: [0x2a2e44, 0x07070a], evening: [0x5a4a3a, 0x1a1410], morning: [0xffffff, 0xcfcac0] }[hour];
    this._hemi.color.setHex(sky[0]);
    this._hemi.groundColor.setHex(sky[1]);
    if (this._lightStage < 2) this._herDoor.setOpen(hour === 'morning', 1);
    this._setClock({ night: '3:07', morning: '7:15', evening: '8:30' }[hour]);
  }

  _wrongHourPlacing() {
    if (this.hours.is('evening')) this.subtitle('She\'d only tidy it away. Leave it for the night.', 5);
    else this.subtitle('There is nothing here to leave it on, not any more.', 5);
  }

  // ---------- the doorway ----------

  _setDoorway(open) {
    if (open && this._doorBlocker) { this.removeBlocker(this._doorBlocker); this._doorBlocker = null; }
    if (!open && !this._doorBlocker) this._doorBlocker = this.addBlocker([0.6, 0, 1.7], [1.8, 2.2, 1.9]);
  }

  // ---------- the hours, by hand, at the clock ----------

  _flip() {
    if (this._clockStopped || this.hours.changing || this._waking) return;
    if (this.hours.is('night')) {
      const ok = this._done.chair && this._done.sheet && this._done.wound && this._done.note;
      if (!ok) {
        // The first touch is the discovery, and _advance says so; the nudge
        // would only overwrite it in the same breath.
        if (this._wound) {
          this._clockWrong++;
          this.playSound('tick');
          this.subtitle(
            this._clockWrong >= 2 ? 'Half past eight shows you how she left it.' : 'Not yet. It isn\'t how she left it.',
            this._clockWrong >= 2 ? 5 : 4,
          );
        }
        this._advance();                                   // it still flips: you may need the other hours
        return;
      }
      this._stop();
      return;
    }
    this._advance();
  }

  _advance() {
    for (let i = 0; i < 3; i++) this.after(i * 0.12, () => this.playSound('tick'));
    this._setClock({ night: '7:15', morning: '8:30', evening: '3:07' }[this.hours.current]);
    this.hours.next();
    if (!this._wound) {
      this._wound = true;
      this.subtitle('The digits flip. They never did, before.', 5);
      this.setObjective('how she left it, at another hour');
    }
  }

  _stop() {
    this._clockStopped = true;
    this.playSound('tick');
    this.subtitle('It stops. 3:07. It will be 3:07 for as long as anyone remembers.', 6);
    this.setObjective('out. shut the door.');
  }

  // ---------- the puzzle ----------

  _wirePuzzle() {
    const pl = this.game.player;

    // ---- the way in ----
    this.interact(this._backPanel, { prompt: 'through', once: true, onInteract: () => {
      this._backPanel.setOpen(true, 1);
      if (this._wbBlocker) { this.removeBlocker(this._wbBlocker); this._wbBlocker = null; }
      this.playSound('door');
      this.setObjective('how she left it');
      this.whenUnseen(this._backPanel, () => {
        this._backPanel.setOpen(false);
        this.playSoundAt('door', { x: -0.55, y: 1, z: 1.79 });
        if (pl.position.z < 1.7) this._wbBlocker = this.addBlocker([-1.0, 0, 1.7], [-0.1, 2.2, 1.9]);
      });
    } });

    // ---- the glass ----
    this.whenSeen(this._mirror, () => {
      // whenSeen has no occluders and once:true would spend itself on the
      // first look from the stub, through the wardrobe and two walls.
      if (this._glassSeen || !this.hours.is('night') || this._done.sheet) return;
      if (pl.position.z > 1.7) return;                         // still in the wardrobe
      this._glassSeen = true;
      this.flinch(); this.hush(2);
      this.subtitle('In the glass, where you should be, something stands a little too tall, with no face. You always kept it covered. You were right to.', 7);
    }, { minTime: 0.2, once: false, angleDeg: 35, maxDist: 5 });
    this.tick(() => {                                            // the reflection tracks you
      const p = pl.position;
      // anywhere in the bedroom: the blockers that keep you off the bed also
      // keep you more than two metres from whatever is standing in the glass
      const show = this.hours.is('night') && !this._done.sheet
        && p.x > MIRROR.x && p.x < 2.1 && p.z > -1.2 && p.z < 2.1;
      this._figure.visible = show;
      if (show) {
        // the mirrored point, kept inside the room behind the glass
        this._figure.position.set(
          Math.min(-2.9, Math.max(-4.1, 2 * MIRROR.x - p.x)), 0,
          Math.min(1.3, Math.max(0.6, p.z)),
        );
        this._figure.faceToward(p);
      }
    });
    this.interact(this._mirror, { prompt: 'cover it', onInteract: () => {
      if (!this.hours.is('night')) {
        if (this._sheetHeld) this._wrongHourPlacing();
        else if (this.hours.is('evening')) this.subtitle('Hers. Leave it. Yours is on the bed, at 3:07.', 4);
        else this.subtitle('There is nothing here to leave it on, not any more.', 5);
        return;
      }
      if (this._done.sheet) return;
      if (!this._sheetHeld) { this.subtitle('The glass. You need the sheet from the bed\'s foot.', 4); return; }
      this._sheetHeld = false; this.removeItem('sheet');
      this._sheetOnMirror.visible = true; this._done.sheet = true;
      this._figure.visible = false;
      this.playSound('paper');
      this.subtitle('Covered. You were right to.', 4);
    } });
    this.interact(this._sheetFold, { prompt: 'the sheet', once: true, onInteract: () => {
      this._sheetFold.visible = false; this._sheetHeld = true;
      this.giveItem({ id: 'sheet', name: 'the sheet, folded' });
    } });

    // ---- the four settings ----
    this.interact(this._chairN, { prompt: 'the chair', onInteract: () => {
      if (this._done.chair) { this.subtitle('At the desk, facing the desk. As she left it.', 3); return; }
      this._done.chair = true;
      this._chairN.rotation.y += Math.PI * 0.85;
      this._chairN.position.z -= 0.15;
      this.playSoundAt('door', { x: 1.4, y: 0.4, z: -0.4 });
      this._noise(1);
    } });
    this.interact(this._musicBox, { prompt: 'wind it', onInteract: () => {
      if (!this.hours.is('night')) { this.subtitle('Hers. Leave it.', 3); return; }
      if (this._done.wound) { this.subtitle('Wound. It will play when nobody is looking. It always did.', 4); return; }
      this._done.wound = true;
      this.playSoundAt('wind', { x: 1.5, y: 1.6, z: -0.5 }, { clicks: 6, gap: 0.09 });
      this._noise(2);
      this.whenUnseen(this._musicBox, () => {
        this.playSoundAt('musicbox', { x: 1.5, y: 1.6, z: -0.5 }, { notes: HUM4, slow: 0.15, holdSeconds: 6 });
        this.cue('a music box', new THREE.Vector3(1.5, 1.6, -0.5));
      });
    } });
    this.interact(this._drawer, { prompt: 'the drawer', onInteract: () => {
      if (!this.hours.is('night')) { this.subtitle('Hers. Leave it.', 3); return; }
      if (this._done.note) { this.subtitle('The note is in it, older than the others.', 3); return; }
      if (!this.hasItem('note-xi')) { this.subtitle('Empty. Something is missing from it — something older than the others.', 5); return; }
      this.removeItem('note-xi');
      this._done.note = true;
      this.playSound('paper');
      this._noise(1);
    } });

    // ---- the morning box ----
    this.interact(this._noteInBox, { prompt: 'a note, older than the others', once: true, enabled: false, onInteract: () => {
      this._noteInBox.visible = false;
      this._noteTaken = true;
      this.giveItem({ id: 'note-xi', name: 'a note, older than the others' });
      this.giveNote({
        id: 'l20-note', title: 'a note, older than the others',
        body:
          'when you couldn\'t sleep I knocked on the wall\n' +
          'and you knocked back.\n\n' +
          'two for "still there".\n' +
          'three for "come and find me".\n\n' +
          '— M.',
      });
    } });

    // ---- the sleeper and the stir ----
    this.tick((dt) => {
      if (!this.hours.is('night') || this._waking || this._out) { this._stirNeed = 0; return; }
      const v = Math.hypot(pl.velocity.x, pl.velocity.z);
      this._stir = Math.max(0, this._stir - dt / 10);
      if (this._stirNeed > 0) {
        if (v < 0.05) {
          this._holdStill += dt;
          if (this._holdStill >= 3) {
            this._stirNeed = 0; this._stir = 0;
            this.subtitle('It turns over, and settles.', 4);
          }
        } else if (v > 0.3) {
          this._wake();
        }
      }
    });

    // ---- the door follows the hour until the clock has stopped ----
    this.tick(() => {
      if (this._clockStopped || this._waking || this._doorOpen || this._doorShut) return;
      if (!this.hours.is('night')) { this._door.setOpen(true, -1); this._setDoorway(true); }
      else if (pl.position.z < 1.7) { this._door.setOpen(false); this._setDoorway(false); }
    });

    // ---- the door, out, the lock ----
    this.interact(this._door, { prompt: 'the door', onInteract: () => {
      if (this.hours.is('night') && !this._clockStopped) {
        this.playSound('locked');
        this.subtitle('Shut. Leave it shut until the clock has stopped.', 4);
        return;
      }
      if (!this.hours.is('night')) { this.subtitle('Open, at this hour. Leave it.', 3); return; }
      if (!this._doorOpen && !this._doorShut) {
        this._doorOpen = true;
        this._door.setOpen(true, -1);
        this._setDoorway(true);
        this.playSound('door');
        this.subtitle('Open. Out, and shut it behind you.', 4);
        return;
      }
      if (this._doorOpen && pl.position.z > 1.9) {               // from outside: shut it
        this._doorOpen = false; this._doorShut = true; this._out = true;
        this._door.setOpen(false); this.playSound('door');
        this.after(0.8, () => this._setDoorway(false));
        this.setObjective('the little key');
        return;
      }
      if (this._doorShut && !this._locked) {
        if (!this.hasItem('little-key')) {
          this.playSound('locked');
          this.subtitle('Shut. It wants locking, and the little key is not in your hand.', 4);
          return;
        }
        this.removeItem('little-key');
        this._locked = true;
        this.playSound('lock');
        this.subtitle('Locked, from the other side. You never shut the door. Tonight you do, so that it goes the long way round, the way you did, and finds the same things.', 7);
        this.setObjective('listen');
        this.hush(1.5);
        const hum = () => {
          if (this._answered) return;
          this.playSoundAt('hummed', KNOCK_IN, { notes: HUM4, small: true, holdSeconds: 6 });
          this.cue('humming, through the wall', new THREE.Vector3(KNOCK_IN.x, KNOCK_IN.y, KNOCK_IN.z));
          this._humT = this.after(8, hum);
        };
        this.after(1.5, hum);
        for (const k of [this._k1, this._k2, this._k3]) this.game.interaction.setEnabled(k, true);
        return;
      }
      this.subtitle('Open. Out, and shut it behind you.', 3);
    } });
    this.interact(this._keyOnHook, { prompt: 'the little key', once: true, onInteract: () => {
      this._keyOnHook.visible = false;
      this.giveItem({ id: 'little-key', name: 'the little key' });
      this.subtitle('The little key. On its hook, where she kept it. You take it.', 5);
    } });

    // ---- the knocks ----
    const spot = (mesh, right) => this.interact(mesh, { prompt: 'knock', enabled: false, onInteract: () => {
      if (this._answered) return;
      const p = mesh.getWorldPosition(new THREE.Vector3());
      this.playSoundAt('knock', p, { count: 3 });
      if (!right) {
        this.after(3, () => {
          if (this._answered) return;
          this.subtitle('Nothing. The humming goes on, '
            + this.directionWord(new THREE.Vector3(KNOCK_OUT.x, KNOCK_OUT.y, KNOCK_OUT.z)) + '.', 5);
        });
        return;
      }
      this._answered = true;
      clearTimeout(this._humT);
      this.after(0.8, () => {
        this.playSoundAt('knock', KNOCK_IN, { count: 2, soft: true });
        this.cue('two knocks', new THREE.Vector3(KNOCK_IN.x, KNOCK_IN.y, KNOCK_IN.z));
        this.subtitle('Two. Still there.', 4);
      });
      this.after(2.0, () => {
        this.playSoundAt('knock', p, { count: 2 });
        this.subtitle('Still there. It will go on dreaming now.', 5);
        this.setObjective('the last light');
        this._lightStage = 1;
      });
    } });
    spot(this._k1, false); spot(this._k2, false); spot(this._k3, true);

    // ---- the last light, her room, the bed ----
    this.interact(this._switch, { prompt: 'the landing light', onInteract: () => {
      if (this._lightStage < 1) { this.subtitle('The landing light. On. It stays on until everything else is done.', 4); return; }
      if (this._lightOn) {
        this._lightOn = false;
        this.playSound('clunk');
        this._landBulb.light.intensity = 0;
        this._legFill.intensity = 0; this._stairFill.intensity = 0;
        if (this._landBulbGlass) this._landBulbGlass.material.emissiveIntensity = 0.05;
        this.dread(0.3);
        this.playSoundAt('hummed', KNOCK_IN, { notes: [LevelBase.NOTES.E], small: true });
        this.subtitle('Dark. The whole house, dark, and something small in it. You know what that is like.', 6);
      } else {
        this._lightOn = true;
        this.playSound('switch');
        this._landBulb.light.intensity = 3.0;
        this._legFill.intensity = 1.7; this._stairFill.intensity = 0.8;
        if (this._landBulbGlass) this._landBulbGlass.material.emissiveIntensity = 3.5;
        this.dread(0);
        this.subtitle('You leave it on. You know now why she did.', 5);
        this.setObjective('bed');
        this._lightStage = 2;
      }
    } });
    this.interact(this._herDoor, { prompt: 'her door', onInteract: () => {
      if (this.hours.is('morning')) { this.subtitle('White. The house is gone from here on.', 5); return; }
      if (this.hours.is('evening')) { this.playSound('locked'); this.subtitle('Not yet. She is still up.', 4); return; }
      if (this._lightStage < 2) {
        this.playSound('locked');
        this.subtitle(this._lightOn ? 'Her room. Not yet.' : 'Not in the dark. Not for them.', 4);
        return;
      }
      if (!this._herDoor.isOpen()) {
        this._herDoor.setOpen(true, 1);
        if (this._herBlocker) { this.removeBlocker(this._herBlocker); this._herBlocker = null; }
        this.playSound('door');
      }
    } });
    this.interact(this._herBed, { prompt: 'lie down', once: true, onInteract: () => {
      this.subtitle('You lie down, the way she did, and the light stays on.', 4);
      this.after(1.6, () => this.complete());
    } });
  }

  /** A noisy act: the sleeper stirs at 2. */
  _noise(n) {
    if (!this.hours.is('night')) return;
    this._stir += n;
    if (this._stir >= 2 && this._stirNeed === 0) {
      this._stirNeed = 1; this._holdStill = 0;
      this.playSoundAt('door', { x: -1.55, y: 0.5, z: -0.6 });          // the bed creaks
      this._mound.rotation.z += 0.17;
      this.cue('it turns over', new THREE.Vector3(-1.55, 0.6, -0.6));
    }
  }

  _wake() {
    this._waking = true; this._stirNeed = 0; this._stir = 0; this._wakes++;
    this.playSoundAt('hummed', { x: -1.55, y: 0.7, z: -0.6 }, { notes: [LevelBase.NOTES.E], small: true });
    this.subtitle('It sits up. It is awake, and the hour is wrong, and you are not here yet.'
      + (this._wakes >= 2 ? ' Do one thing, and stand still, and then the next.' : ''), 6);
    this.hours.set('evening');
    this.after(25, () => {
      this.subtitle('It lies down. The lamp goes out. 3:07.', 4);
      this.hours.set('night');
      this.after(2, () => { this._waking = false; });
    });
  }

  async _waitFor(test, capSeconds) {
    const until = Date.now() + capSeconds * 1000;
    while (!test() && Date.now() < until) await this.debugWait(0.05);
  }

  /**
   * The harness renders this room at about three frames a second and the
   * engine clamps dt to 0.05, so game time runs at roughly a sixth of wall
   * time: an hour crossfade is seconds of real waiting, and the three-second
   * hold-still of the stir would be twenty. Wait on the state, not the clock,
   * and let the stir stay pending — standing still is optional, and nothing
   * downstream is gated on it.
   */
  async debugSolve() {
    const pl = this.game.player;
    const settled = () => this._waitFor(() => !this.hours.changing, 25);
    this.debugInteract(this._backPanel); await this.debugWait(0.4);
    pl.teleport(-0.6, 1.0, Math.PI / 2);                       // in, facing the mirror wall → the glass
    await this._waitFor(() => this._glassSeen, 4);
    this.debugInteract(this._clock); await settled();            // → morning
    this.debugInteract(this._keepBox); await this.debugWait(0.3);
    this.debugInteract(this._noteInBox); await this.debugWait(0.3); this.game.ui.closeModal();
    this.debugInteract(this._clock); await settled();            // → evening
    this.debugInteract(this._clock); await settled();            // → night
    this.debugInteract(this._chairN); await this.debugWait(0.2);
    this.debugInteract(this._sheetFold); await this.debugWait(0.2);
    this.debugInteract(this._mirror); await this.debugWait(0.2);
    this.debugInteract(this._musicBox); await this.debugWait(0.2);
    this.debugInteract(this._drawer); await this.debugWait(0.2);
    this.debugInteract(this._clock); await this.debugWait(0.4);  // STOP
    this.debugInteract(this._door); await this.debugWait(0.4);   // opens
    pl.teleport(1.2, 2.5, Math.PI);                                // out on the landing
    this.debugInteract(this._door); await this.debugWait(0.3);   // shut
    this.debugInteract(this._keyOnHook); await this.debugWait(0.2);
    this.debugInteract(this._door); await this.debugWait(0.6);   // locked; the humming starts
    this.debugInteract(this._k3); await this.debugWait(2.2);     // three knocks → two back → your two
    this.debugInteract(this._switch); await this.debugWait(0.4); // off
    this.debugInteract(this._switch); await this.debugWait(0.4); // on — you leave it on
    this.debugInteract(this._herDoor); await this.debugWait(0.3);
    pl.teleport(4.8, -1.2);
    this.debugInteract(this._herBed);
    await this._waitFor(() => this.isCompleted, 5);
  }
}
