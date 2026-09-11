import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, chalkTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp,
  makeTable, makeChair, makeShelf, makePictureFrame, makeDust, applyFog,
} from '../core/props.js';
import { makeFigure } from '../core/presence.js';

// XV — Under the House
// The cellar of V. The fuse box has lost its labels and each switch wakes a
// room above you; flip them in the order M. gave. Then a corridor that loops
// until you stand still, a box that fills while you aren't looking, and the
// last room. Four acts, one for each of XI–XIV.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.5

const ORDER = ['kitchen', 'hall', 'sitting', 'yours'];                // V's evening
const SWITCHES = ['porch', 'sitting', 'kitchen', 'yours', 'hall'];    // left → right, no labels
const OVERHEAD = {
  kitchen: { x: -4.5, y: 3.4, z: -2.5 }, sitting: { x: 4.5, y: 3.4, z: -0.5 },
  hall: { x: 0.5, y: 3.4, z: 3.5 }, yours: { x: -1, y: 3.4, z: -3.6 },
};
const DESC = {
  kitchen: 'A tap, running.',
  hall: 'Slippers on a mat, back and forth.',
  sitting: 'A wireless, tuning between stations.',
  yours: 'A music box, winding down.',
};
const TUNE = LevelBase.tune('EGAGEGE');

const CX = -2;                                  // corridor / under-room / last room centre line
const CEIL = 2.3;                               // cellar ceiling — the floor of the house
const STAIR = { x: 4, z0: 1.9, rise: 0.23, run: 0.3, steps: 7 };
const LAST_DOOR = { x: CX, y: 1.2, z: -22 };
const DOORWAY = { x: CX, y: 1.4, z: -26 };
const FIGURE = { x: CX - 0.55, z: -25.3 };      // ≥ 2 m from anywhere the player can stand
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level15 extends LevelBase {
  static meta = {
    id: 15,
    numeral: 'XV',
    title: 'Under the House',
    mood: 'under',
    grade: GRADE,
    intro: 'Under the house, where you never went, the house is still going on.',
    outro:
      'She was never behind you.\n' +
      'She was ahead the whole time,\n' +
      'leaving the doors open, going on to bed.',
  };

  build() {
    applyFog(this.scene, '#08080a', 2, 22);

    this._wall = makeMat('concrete', { base: '#6b665e', repeat: [5, 2] });
    this._wallFine = makeMat('concrete', { base: '#6b665e', repeat: [1.6, 1.6] });
    this._ceilMat = makeMat('concrete', { base: '#57534c', repeat: [4, 3] });
    this._ceilMat.emissive = new THREE.Color(0x16130f);   // boards never quite go to nothing
    this._ceilMat.emissiveIntensity = 1;
    this._wood = makeMat('wood', { base: '#4a3a2c', repeat: [1, 1] });

    this.add(new THREE.HemisphereLight(0x453f3a, 0x2b2724, 0.6));   // the ground tone lifts the joists

    // state, before anything can be interacted with
    this._on = [];
    this._wrongCount = 0;
    this._overhead = [];
    this._timers = {};
    this._resetting = false;
    this._act = 1;
    this._loopActive = false;
    this._loopCount = 0;
    this._still = 0;
    this._approach = null;
    this._pleaded = 0;
    this._entered2 = false;
    this._entered4 = false;
    this._letGo = false;
    this._lastOpen = false;

    this._buildCellar();
    this._buildStairs();
    this._buildCorridor();
    this._buildUnderRoom();
    this._buildLastRoom();
    this._wirePuzzle();

    this.spawn.position.set(STAIR.x - 0.3, 0, STAIR.z0 - 0.6);   // at the foot of the steps
    this.spawn.yaw = Math.PI / 2;                          // forward (−1, 0, 0): into the cellar
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-6.5, -1, -28.5),
      new THREE.Vector3(6.5, 4.5, 4.5)
    );
    this.setObjective('the fuse box has lost its labels');
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

  /**
   * Floor, ceiling with joists, and four walls. `openings` cuts a doorway
   * 1.0 wide and 2.1 high in a wall: { side: 'n'|'s'|'e'|'w', at: centre }.
   * 'n' is the −Z wall. `hole` leaves a rectangle out of the ceiling.
   */
  _room(x0, x1, z0, z1, h, openings = [], { wallMat = this._wall, joists = 'z', hole = null } = {}) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

    const floorMat = makeMat('concrete', {
      base: '#4f4b45', repeat: [Math.max(2, w / 2), Math.max(2, d / 2)],
    });
    const floor = this._plane(w, d, floorMat, cx, 0, cz, 'up');
    this.addGround(floor);

    // ceiling, in up to four pieces so a stairwell can come through it
    const ceilRect = (a0, a1, b0, b1) => {
      if (a1 - a0 < 0.01 || b1 - b0 < 0.01) return;
      this._plane(a1 - a0, b1 - b0, this._ceilMat, (a0 + a1) / 2, h, (b0 + b1) / 2, 'down');
    };
    if (hole) {
      ceilRect(x0, hole.x0, z0, z1);
      ceilRect(hole.x1, x1, z0, z1);
      ceilRect(hole.x0, hole.x1, z0, hole.z0);
      ceilRect(hole.x0, hole.x1, hole.z1, z1);
    } else {
      ceilRect(x0, x1, z0, z1);
    }

    // joists — thin boxes under the ceiling, skipped where the stairwell is
    if (joists === 'z') {
      for (let x = x0 + 0.25; x < x1; x += 0.5) {
        if (hole && x > hole.x0 - 0.2 && x < hole.x1 + 0.2) continue;
        this._box(0.08, 0.14, d, this._wood, x, h - 0.07, cz, { collide: false });
      }
      if (hole) {
        for (const hx of [hole.x0, hole.x1]) {
          this._box(0.1, 0.16, d, this._wood, hx, h - 0.08, cz, { collide: false });
        }
      }
    } else {
      for (let z = z0 + 0.25; z < z1; z += 0.5) {
        this._box(w, 0.08, 0.1, this._wood, cx, h - 0.05, z, { collide: false });
      }
    }

    const wall = (side) => {
      const o = openings.find((k) => k.side === side);
      const vertical = side === 'e' || side === 'w';
      const wx = side === 'e' ? x1 + 0.1 : side === 'w' ? x0 - 0.1 : cx;
      const wz = side === 'n' ? z0 - 0.1 : side === 's' ? z1 + 0.1 : cz;
      if (!o) {
        if (vertical) this._box(0.2, h, d + 0.4, wallMat, wx, h / 2, wz);
        else this._box(w + 0.4, h, 0.2, wallMat, wx, h / 2, wz);
        return;
      }
      const c = o.at;
      const lo = vertical ? z0 - 0.2 : x0 - 0.2;
      const hi = vertical ? z1 + 0.2 : x1 + 0.2;
      for (const [a, b] of [[lo, c - 0.5], [c + 0.5, hi]]) {
        const len = b - a, mid = (a + b) / 2;
        if (len <= 0.01) continue;
        if (vertical) this._box(0.2, h, len, wallMat, wx, h / 2, mid);
        else this._box(len, h, 0.2, wallMat, mid, h / 2, wz);
      }
      const lintelH = h - 2.1;
      if (lintelH > 0.01) {
        if (vertical) this._box(0.2, lintelH, 1.0, wallMat, wx, 2.1 + lintelH / 2, c);
        else this._box(1.0, lintelH, 0.2, wallMat, c, 2.1 + lintelH / 2, wz);
      }
    };
    for (const side of ['n', 's', 'e', 'w']) wall(side);
  }

  // ---------- act 1: the cellar ----------

  _buildCellar() {
    const holeX0 = STAIR.x - 0.75, holeX1 = STAIR.x + 0.75;
    this._room(-6, 6, -4, 4, CEIL, [{ side: 'n', at: CX }], {
      hole: { x0: holeX0, x1: holeX1, z0: STAIR.z0 - 0.05, z1: 4 },
    });

    // boiler — it ticks like something counting
    const boiler = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 1.9, 18),
      new THREE.MeshStandardMaterial({ color: 0x5a5651, metalness: 0.5, roughness: 0.6 })
    );
    boiler.position.set(-4, 0.95, -2.5);
    boiler.castShadow = boiler.receiveShadow = true;
    this.add(boiler);
    this.addCollider(boiler);
    for (const dz of [-0.5, 0.5]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8),
        new THREE.MeshStandardMaterial({ color: 0x6a635b, metalness: 0.6, roughness: 0.5 })
      );
      pipe.position.set(-4 + dz * 0.6, 2.07, -2.5);
      this.add(pipe);
    }
    const pilot = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff9a4a, emissiveIntensity: 3 })
    );
    pilot.position.set(-4, 0.4, -1.78);
    this.add(pilot);
    const pilotLight = new THREE.PointLight(0xff9a4a, 1.6, 4, 1.8);
    pilotLight.position.set(-4, 0.45, -1.6);
    this.add(pilotLight);
    this.loopAt('boiler', { x: -4, y: 1, z: -2.5 });
    this.interact(boiler, {
      prompt: 'the boiler',
      onInteract: () => this.subtitle('It ticks like something counting.', 4),
    });

    // shelves of jars along the −X wall
    const jarMat = new THREE.MeshStandardMaterial({
      color: 0x8a7a55, transparent: true, opacity: 0.7, roughness: 0.2,
    });
    for (let s = 0; s < 3; s++) {
      const cz = 1.2 - s * 1.0;
      const shelf = makeShelf({ w: 0.9, h: 1.6, d: 0.3, shelves: 3 });
      shelf.position.set(-5.83, 0, cz);
      shelf.rotation.y = Math.PI / 2;
      this.add(shelf);
      this.addCollider(shelf);
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 3; k++) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), jarMat);
          jar.position.set(-5.8, 0.145 + row * 0.5, cz - 0.3 + k * 0.3);
          this.add(jar);
        }
      }
    }

    // washing machine
    this._box(0.6, 0.85, 0.6, new THREE.MeshStandardMaterial({ color: 0xbfbdb5, roughness: 0.4 }),
      2, 0.425, -3.5);
    const porthole = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 20),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0.8, roughness: 0.2 })
    );
    porthole.position.set(2, 0.5, -3.19);
    this.add(porthole);

    // coal chute in the +X wall, and what came down it
    const chute = this._box(1.0, 0.1, 2.0, this._wood, 5.5, 1.5, 2.6, { collide: false });
    chute.rotation.z = 0.7;
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1 })
    );
    mouth.position.set(5.98, 1.86, 2.6);
    mouth.rotation.y = -Math.PI / 2;
    this.add(mouth);
    for (const [h, y, d] of [[0.08, 1.53, 0.95], [0.08, 2.19, 0.95]]) {
      this._box(0.1, h, d, this._wood, 5.96, y, 2.6, { collide: false });
    }
    const coalMat = new THREE.MeshStandardMaterial({ color: 0x201d1c, roughness: 1 });
    for (let k = 0; k < 16; k++) {
      const lump = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 6, 5), coalMat);
      lump.position.set(5.1 + (Math.random() - 0.5) * 1.0, 0.07, 2.5 + (Math.random() - 0.5) * 1.5);
      this.add(lump);
    }

    // the one light down here
    const bulb = makeBulbLight({ intensity: 9, distance: 17, y: 2.2 });
    bulb.position.set(0, 0, 0);
    bulb.light.decay = 1.3;                        // one bulb has a whole cellar to reach
    bulb.light.castShadow = true;
    this.add(bulb);
    this.add(this.track(makeDust({
      count: 220, box: [11, 2.1, 7.4], center: [0, 1.2, 0], color: 0xffe9c8, size: 0.013,
    })));

    // the rooms above — light through the boards when a switch wakes one
    this._glows = {};
    for (const k of Object.keys(OVERHEAD)) {
      const g = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x100c08, emissive: 0xffca88, emissiveIntensity: 0.7 })
      );
      g.rotation.x = Math.PI / 2;
      g.position.set(OVERHEAD[k].x, CEIL - 0.02, OVERHEAD[k].z);
      g.visible = false;
      this.add(g);
      this._glows[k] = g;
    }

    // the fuse box on the +X wall: five switches, no labels, a red pilot lamp
    this._box(0.12, 0.7, 0.5, new THREE.MeshStandardMaterial({
      color: 0x9aa09c, metalness: 0.15, roughness: 0.55,
    }), 5.93, 1.45, -1, { collide: false });
    this._switches = SWITCHES.map((key, i) => {
      const z = -1.22 + i * 0.11;
      const sw = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.12, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
      );
      sw.position.set(5.84, 1.45, z);
      sw.rotation.z = -0.35;
      this.add(sw);
      const plate = new THREE.Mesh(              // blank: whatever was written has gone
        new THREE.PlaneGeometry(0.07, 0.035),
        new THREE.MeshStandardMaterial({ color: 0xd8cfba, roughness: 0.9 })
      );
      plate.position.set(5.869, 1.32, z);
      plate.rotation.y = -Math.PI / 2;
      this.add(plate);
      return { key, mesh: sw };
    });
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a2a, emissiveIntensity: 2 })
    );
    lamp.position.set(5.86, 1.72, -1);
    this.add(lamp);

    // the meter beside it, still counting a house nobody is in
    this._box(0.14, 0.34, 0.24, new THREE.MeshStandardMaterial({
      color: 0x3d3a34, roughness: 0.6,
    }), 5.92, 1.5, 0.35, { collide: false });
    const dial = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xcfc6ae, roughness: 0.4, emissive: 0x2a2418 })
    );
    dial.position.set(5.849, 1.55, 0.35);
    dial.rotation.y = -Math.PI / 2;
    this.add(dial);

    // M.'s note, pinned beside it again
    this._fuseNote = makeNoteProp({ tilt: 0 });
    this._fuseNote.position.set(5.975, 1.12, -0.55);
    this._fuseNote.rotation.set(0, 0, Math.PI / 2);
    this.add(this._fuseNote);

    // the corridor door, and the strip of light under it
    this._corridorDoor = makeDoor({ color: '#4c4038' });
    this._corridorDoor.position.set(CX, 0, -4);
    this.add(this._corridorDoor);
    this.track(this._corridorDoor);
    this.addCollider(this._corridorDoor.panel);
    this._strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe0b0, emissiveIntensity: 0 })
    );
    this._strip.rotation.x = -Math.PI / 2;
    this._strip.position.set(CX, 0.014, -3.86);
    this.add(this._strip);
  }

  /** Seven steps up to a door that is shut from the other side, in a boxed stairwell. */
  _buildStairs() {
    const { x, z0, rise, run, steps } = STAIR;
    const top = rise * steps;                      // 1.61
    const stepMat = makeMat('concrete', { base: '#5a5650', repeat: [2, 1] });
    for (let i = 0; i < steps; i++) {
      this._box(1.5, rise * (i + 1), run, stepMat, x, (rise * (i + 1)) / 2, z0 + 0.15 + i * run,
        { ground: true });
    }
    // the stairwell: two walls straight through the ceiling, a header, a lid
    for (const sx of [-0.8, 0.8]) {
      this._box(0.1, 3.9, (steps * run) + 0.3, this._wallFine, x + sx, 1.95, z0 - 0.05 + (steps * run) / 2);
    }
    this._box(1.5, 1.6, 0.1, this._wallFine, x, 3.1, z0 - 0.1, { collide: false });
    this._box(1.5, 1.6, 0.12, this._wallFine, x, 3.1, 4.04, { collide: false });
    this._plane(1.5, (steps * run) + 0.1, this._wood, x, 3.9, z0 - 0.05 + (steps * run) / 2, 'down');

    const upDoor = makeDoor({ color: '#5d4e40' });
    upDoor.position.set(x, top, 3.93);
    this.add(upDoor);
    this.track(upDoor);
    this.addCollider(upDoor.panel);
    this.interact(upDoor, {
      prompt: 'the door at the top',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('Shut from that side. It always was.', 4);
      },
    });
    // the house, still lit, on the other side of it
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd9a0, emissiveIntensity: 2.4 })
    );
    line.position.set(x, top + 0.035, 3.87);
    this.add(line);
    const seep = new THREE.PointLight(0xffd9a0, 6, 7, 1.3);
    seep.position.set(x, top + 0.6, 3.35);
    this.add(seep);
  }

  // ---------- act 2: the corridor ----------

  _buildCorridor() {
    this._room(CX - 0.7, CX + 0.7, -16, -4, 2.2,
      [{ side: 's', at: CX }, { side: 'n', at: CX }],
      { wallMat: this._wallFine, joists: 'x' });

    const frame = (z) => {
      for (const sx of [-0.55, 0.55]) {
        this._box(0.1, 2.1, 0.1, this._wood, CX + sx, 1.05, z, { collide: false });
      }
      this._box(1.2, 0.1, 0.1, this._wood, CX, 2.15, z, { collide: false });
    };
    frame(-4.6);
    frame(-15.4);

    this._chalk = chalkTexture({ tally: 1, lines: ['wait for me'], base: '#6b665e' });
    const chalk = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.36),
      new THREE.MeshStandardMaterial({ map: this._chalk, roughness: 1 })
    );
    chalk.position.set(CX + 0.695, 1.2, -10);
    chalk.rotation.y = -Math.PI / 2;
    this.add(chalk);
    this.interact(chalk, {
      prompt: 'the chalk',
      onInteract: () => this.subtitle('The same hand. The same two words. You have been counted.', 5),
    });

    for (const z of [-7, -13]) {
      const b = makeBulbLight({ color: 0xd8dcd0, intensity: 4, distance: 11, y: 2.1 });
      b.light.decay = 1.15;
      b.position.set(CX, 0, z);
      this.add(b);
    }
  }

  // ---------- act 3: the under-room ----------

  _buildUnderRoom() {
    this._room(-5, 1, -22, -16, 2.3,
      [{ side: 's', at: CX }, { side: 'n', at: CX }],
      { wallMat: this._wallFine });

    const table = makeTable({ w: 1.0, d: 0.7 });
    table.position.set(CX, 0, -19);
    this.add(table);
    this.addCollider(table);

    // the box: cardboard, open, its label written and crossed out twice
    const card = new THREE.MeshStandardMaterial({
      color: 0xa3896a, roughness: 1, side: THREE.DoubleSide,
    });
    const W = 0.5, D = 0.4, H = 0.3, T = 0.014;
    const box = new THREE.Group();
    box.position.set(CX, 0.76, -19);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), card);
    bottom.position.y = T / 2;
    box.add(bottom);
    for (const sz of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), card);
      side.position.set(0, H / 2, sz * (D / 2));
      box.add(side);
    }
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(T, H, D), card);
      side.position.set(sx * (W / 2), H / 2, 0);
      box.add(side);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.22, T, D), card);
      flap.position.set(sx * (W / 2 + 0.07), H + 0.07, 0);
      flap.rotation.z = sx * 0.95;
      box.add(flap);
    }
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.1),
      new THREE.MeshStandardMaterial({ map: this._labelTexture(), roughness: 0.9 })
    );
    label.position.set(0, 0.15, D / 2 + 0.008);
    box.add(label);
    box.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    this.add(box);
    this._boxMesh = box;

    // the three things that will be in it, when you are not looking
    this._photo = makePictureFrame({
      texture: blurredPhotoTexture({ figures: 2 }), width: 0.18, height: 0.14,
    });
    this._photo.position.set(CX - 0.05, 0.826, -19.02);
    this._photo.rotation.set(-1.24, 0.2, 0);
    this._photo.visible = false;
    this.add(this._photo);

    this._ribbon = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.009, 6, 18),
      new THREE.MeshStandardMaterial({ color: 0x4f6a8a, roughness: 0.9 })
    );
    this._ribbon.position.set(CX + 0.13, 0.786, -18.93);
    this._ribbon.rotation.set(Math.PI / 2, 0, 0.3);
    this._ribbon.visible = false;
    this.add(this._ribbon);

    this._key = makeKeyProp();
    this._key.position.set(CX - 0.02, 0.788, -19.08);
    this._key.rotation.z = 0.6;
    this._key.visible = false;
    this.add(this._key);

    const b = makeBulbLight({ intensity: 3.6, distance: 10, y: 2.2 });
    b.light.decay = 1.3;
    b.position.set(CX, 0, -18);
    this.add(b);

    this._lastDoor = makeDoor({ color: '#5a4636' });
    this._lastDoor.position.set(CX, 0, -22);
    this.add(this._lastDoor);
    this.track(this._lastDoor);
    this.addCollider(this._lastDoor.panel);
  }

  /** A name in someone's hand, crossed out twice. */
  _labelTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e0cf';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = 'rgba(40,36,32,0.75)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();                                  // the name, too worn to read
    ctx.moveTo(34, 56);
    for (let i = 0; i < 7; i++) {
      ctx.quadraticCurveTo(44 + i * 26, 28 + (i % 2) * 30, 60 + i * 26, 54);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,28,26,0.85)';
    ctx.lineWidth = 5;
    for (const dy of [-6, 8]) {                        // crossed out, twice
      ctx.beginPath();
      ctx.moveTo(26, 52 + dy);
      ctx.lineTo(230, 44 - dy);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ---------- act 4: the last room ----------

  _buildLastRoom() {
    this._room(-4, 0, -26, -22, 2.3,
      [{ side: 's', at: CX }, { side: 'n', at: CX }],
      { wallMat: this._wallFine });
    this._room(-3, -1, -28.5, -26, 2.3, [{ side: 's', at: CX }], { wallMat: this._wallFine });

    this._lamp = makeBulbLight({ color: 0xffdcb0, intensity: 3.5, distance: 8, y: 2.1 });
    this._lamp.light.decay = 1.4;
    this._lamp.position.set(CX, 0, -24);
    this._lampBulb = this._lamp.children.find((o) => o.isMesh && o.material.emissiveIntensity > 1);
    this.add(this._lamp);

    this._chair = makeChair();
    this._chair.position.set(CX + 0.4, 0, -24.5);
    this._chair.rotation.y = 2.5;                     // turned away, toward the doorway
    this.add(this._chair);
    this.addCollider(this._chair);
    const note = makeNoteProp({ tilt: 0.3 });
    note.position.set(CX + 0.44, 0.495, -24.46);
    this.add(note);

    // the figure: never lit, no face, facing away, and never within two metres
    this._figure = makeFigure();
    this._figure.position.set(FIGURE.x, 0, FIGURE.z);
    this._figure.rotation.y = Math.PI;                // its front is +Z, so this turns its back to you
    this.add(this._figure);
    this._lastBlocker = this.addBlocker([-4, 0, -26], [0, 2.4, -23.4]);

    // the doorway of light
    this._doorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 2.1),
      new THREE.MeshStandardMaterial({
        color: 0x222222, emissive: 0xfff1d6, emissiveMap: this._glowTexture(), emissiveIntensity: 0.4,
      })
    );
    this._doorGlow.position.set(CX, 1.05, -28.35);
    this.add(this._doorGlow);
    this._doorLight = new THREE.PointLight(0xfff1d6, 0, 9, 1.2);
    this._doorLight.position.set(CX, 1.6, -27.4);
    this.add(this._doorLight);
  }

  /** Light through a doorway: bright in the middle, gone at the jambs. */
  _glowTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, 256);
    const g = ctx.createRadialGradient(64, 150, 8, 64, 150, 150);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#cfc7b6');
    g.addColorStop(1, '#151310');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---------- the four acts ----------

  _wirePuzzle() {
    const s = this;

    // ---- act 1: the fuse box ----
    this.interact(this._fuseNote, {
      prompt: 'the note by the pilot light',
      onInteract: () => {
        this.giveNote({
          id: 'l15-evening',
          title: 'the note by the pilot light — pinned again',
          body:
            'supper before slippers.\n' +
            'slippers before the wireless.\n' +
            'and yours always last,\n' +
            'so the dark never caught you.\n\n' +
            '— M.',
        });
      },
    });
    for (const sw of this._switches) {
      this.interact(sw.mesh, { prompt: 'a switch', distance: 2.2, onInteract: () => this._flip(sw.key) });
    }

    // someone crossing the hall above, now and then
    const upstairs = () => {
      if (this._act !== 1) return;
      for (let i = 0; i < 4; i++) {
        this.after(i * 0.7, () => this.playSoundAt(
          'stepOther', { x: -3 + i * 2.3, y: 3.4, z: 2 + i * 0.3 }, { soft: true }
        ));
      }
      if (!this._cuedUp) {
        this._cuedUp = true;
        this.cue('footsteps, upstairs', new THREE.Vector3(-3, 3.4, 2));
      }
      this.after(40, upstairs);
    };
    this.after(25, upstairs);

    // ---- act 2: the corridor, and the thresholds of acts 2 and 4 ----
    // Act 2 counts wall-clock seconds, not the engine's clamped dt: six seconds
    // of standing still should be six seconds on a slow machine too.
    this._lastTick = performance.now();
    this.tick(() => {
      const pl = s.game.player, p = pl.position;
      const v = Math.hypot(pl.velocity.x, pl.velocity.z);
      const now = performance.now();
      const rdt = Math.min((now - this._lastTick) / 1000, 0.3);
      this._lastTick = now;

      if (this._act === 2 && !this._entered2 && p.z < -4.6) {
        this._entered2 = true;
        this._stopOverhead(1.6);                      // the evening closes behind you
      }
      if (this._loopActive && p.z < -15.6 && p.z > -17.2) {
        pl.teleport(p.x, p.z + 11.4);                 // back through the near frame
        this._loopCount++;
        this._redrawChalk();
        if (this._loopCount >= 2 && !this._saidStop) {
          this._saidStop = true;
          this.subtitle('You know this one. Stop.', 5);
        }
        return;
      }
      if (this._act === 2 && this._loopActive) {
        if (this._approach) { this._runApproach(rdt, v); return; }
        const inCorridor = p.z < -4.6 && p.z > -15.4 && Math.abs(p.x - CX) < 0.7;
        if (inCorridor && v < 0.05 && !pl.frozen && !s.game.ui.modalOpen) this._still += rdt;
        else this._still = 0;
        if (this._still >= 6) {
          this._still = 0;
          this._approach = { t: 0, i: 0, breath: false, passed: 0 };
        }
      }

      if (!this._entered4 && p.z < -22.4) {
        this._entered4 = true;
        this.hush(6);
        this.dread(0);
      }
      if (this._letGo && !this.isCompleted && p.z < -27) this.complete();
    });

    // ---- act 3: the box ----
    this.interact(this._boxMesh, {
      prompt: 'look inside',
      once: true,
      onInteract: () => {
        this.subtitle('Empty. It has been kept empty a long time.', 5);
        this._armStage(0);
      },
    });
    this.interact(this._photo, {
      prompt: 'the photograph',
      once: true,
      enabled: false,
      onInteract: () => {
        this.learnClue({
          id: 'l15-photo',
          title: 'a photograph',
          body: 'two figures, faces gone soft. one of them is you.',
        });
        this._photo.visible = false;
        this._armStage(1);
      },
    });
    this.interact(this._ribbon, {
      prompt: 'the ribbon',
      once: true,
      enabled: false,
      onInteract: () => {
        this._ribbon.visible = false;
        this.giveItem({ id: 'ribbon', name: 'a ribbon, blue once' });
        this.subtitle('Hers. You wind it once around your finger, and this time you keep it.', 6);
        this._armStage(2);
      },
    });
    this.interact(this._key, {
      prompt: 'the brass key',
      once: true,
      enabled: false,
      onInteract: () => {
        this._key.visible = false;
        this.giveItem({ id: 'warm-key', name: 'a brass key, warm again' });
        this.subtitle('Warm. Someone has just put it down.', 5);
        this.after(1.5, () => {
          this.playSoundAt('knock', LAST_DOOR, { count: 3 });
          this.cue('three knocks', new THREE.Vector3(LAST_DOOR.x, LAST_DOOR.y, LAST_DOOR.z));
          this.setObjective('come and find me');
        });
      },
    });
    this.interact(this._lastDoor, {
      prompt: 'the last door',
      onInteract: () => {
        if (this._lastOpen) return;
        if (!this.hasItem('warm-key')) {
          this.playSound('locked');
          this.subtitle('Locked. It wants the key it always wanted.', 5);
          return;
        }
        this._lastOpen = true;
        this.removeItem('warm-key');
        this.playSound('unlock');
        this._lastDoor.setOpen(true, -1);
        this.removeColliderOf(this._lastDoor.panel);
        this.playSound('door');
      },
    });

    // ---- act 4: the note on the chair ----
    this.interact(this._chair, {
      prompt: 'the chair',
      once: true,
      onInteract: () => {
        this.giveNote({
          id: 'l15-last',
          title: 'the last note',
          body:
            'you can stop running now.\n' +
            'I only ever wanted to say goodnight.\n\n' +
            '— M.',
        }, () => this._letGoNow());
      },
    });
  }

  // ---------- act 1 machinery ----------

  _switchOf(k) { return this._switches.find((x) => x.key === k).mesh; }

  _setSwitch(k, on) { this._switchOf(k).rotation.z = on ? 0.35 : -0.35; }

  _flip(k) {
    this.playSound('switch');
    if (this._resetting || this._act !== 1) return;
    if (k === 'porch') {
      const m = this._switchOf('porch');
      m.rotation.z = -m.rotation.z;
      this.playSound('locked');
      this.subtitle('Dead. It was dead upstairs, too.', 4);
      return;
    }
    if (this._on.includes(k)) return;
    this._on.push(k);
    this._setSwitch(k, true);
    this._startOverhead(k);                        // every switch wakes its room, in order or not
    this.subtitle(DESC[k], 4);
    if (!this._on.every((v, i) => v === ORDER[i])) {
      this._resetting = true;                      // a beat to hear what you woke, then the house corrects you
      this.after(1.9, () => this._resetEvening());
      return;
    }
    if (this._on.length === ORDER.length) this._act1Done();
  }

  _resetEvening() {
    this._resetting = false;
    this._wrongCount++;
    this.playSound('wrong');
    this._stopOverhead();
    this._on = [];
    for (const sw of this._switches) this._setSwitch(sw.key, false);
    const spellIt = this._wrongCount >= 3;
    this.subtitle(
      spellIt
        ? 'Supper. Then slippers. Then the wireless. Then yours. Listen for them.'
        : 'That was not how the evening went.',
      spellIt ? 7 : 5
    );
  }

  _startOverhead(k) {
    const pos = OVERHEAD[k];
    if (this._glows[k]) this._glows[k].visible = true;
    if (k === 'kitchen') this._overhead.push(this.loopAt('tap', pos));
    else if (k === 'sitting') this._overhead.push(this.loopAt('radio', pos));
    else if (k === 'hall') {
      const step = () => {
        this.playSoundAt('stepOther', pos, { soft: true });
        this._timers.hall = this.after(0.9, step);
      };
      step();
    } else if (k === 'yours') {
      const wind = () => {
        this.playSoundAt('musicbox', pos, { notes: TUNE, step: 0.36, slow: 0.05 });
        this._timers.yours = this.after(6, wind);
      };
      wind();
    }
  }

  _stopOverhead(fade = 0.4) {
    for (const h of this._overhead) h.stop(fade);
    this._overhead = [];
    for (const id of Object.values(this._timers)) this.cancelAfter(id);
    this._timers = {};
    for (const g of Object.values(this._glows)) g.visible = false;
  }

  _act1Done() {
    this._act = 2;
    this._loopActive = true;
    this.playSoundAt('musicbox', OVERHEAD.yours, { notes: TUNE, step: 0.36, gain: 0.08 });
    this._strip.material.emissiveIntensity = 1.4;
    this.playSound('unlock');
    this._corridorDoor.setOpen(true, -1);
    this.removeColliderOf(this._corridorDoor.panel);
    this.playSound('door');
    this.setObjective('the door under the door');
  }

  // ---------- act 2 machinery ----------

  _redrawChalk() {
    const lines = ['wait for me'];
    if (this._pleaded >= 1) lines.push('please');
    this._chalk.redraw({ tally: Math.min(this._loopCount + 1, 12), lines });
  }

  /** Six steps from behind over 4 s, a breath at the right ear, then three going on ahead. */
  _runApproach(rdt, v) {
    const a = this._approach, pl = this.game.player, p = pl.position;
    const footY = p.y - 1.62;
    a.t += rdt;

    if (v > 0.3 && a.t < 4.0) {                    // you moved: it goes back and waits
      this._approach = null;
      this._still = 0;
      this._pleaded++;
      this._redrawChalk();
      this.dread(0.4);
      for (let i = 0; i < 3; i++) {
        this.after(i * 0.5, () => this.playSoundAt(
          'stepOther', { x: CX, y: footY, z: p.z + 2 + i * 1.5 }
        ));
      }
      this.subtitle('It goes back. It will wait as long as you make it.', 5);
      return;
    }

    while (a.i < 6 && a.t >= a.i * 0.8) {
      const k = a.i / 5;
      this.playSoundAt('stepOther', { x: CX, y: footY, z: p.z + 5 - 4.4 * k });
      this.dread(0.4 + 0.6 * k);
      a.i++;
    }
    if (!a.breath && a.t >= 4.0) {
      a.breath = true;
      const ear = {                                // 0.35 m to the right, at eye height
        x: p.x + Math.cos(pl.yaw) * 0.35, y: p.y, z: p.z - Math.sin(pl.yaw) * 0.35,
      };
      this.playSoundAt('breath', ear);
      this.cue('a breath', new THREE.Vector3(ear.x, ear.y, ear.z));
      this.hush(3);
      this.flinch();
    }
    if (a.breath && a.passed < 3 && a.t >= 4.5 + a.passed * 0.75) {
      this.playSoundAt('stepOther', { x: CX, y: footY, z: p.z - 1 - a.passed * 1.5 });
      a.passed++;
    }
    if (a.t >= 6.5) {
      this._approach = null;
      this._loopActive = false;
      this._act = 3;
      this.dread(0.5);
      this.subtitle('It goes past. It was only ever going past.', 5);
    }
  }

  // ---------- act 3 machinery ----------

  _armStage(n) {
    this.whenUnseen(this._boxMesh, () => {
      const item = [this._photo, this._ribbon, this._key][n];
      item.visible = true;
      this.game.interaction.setEnabled(item, true);
    });
  }

  // ---------- act 4 machinery ----------

  _letGoNow() {
    this._letGo = true;
    this._lamp.light.intensity = 0;
    if (this._lampBulb) this._lampBulb.material.emissiveIntensity = 0.05;
    this.playSoundAt('clunk', { x: CX, y: 2.1, z: -24 });
    this.game.ui.flash('#000', 400);
    this._figure.visible = false;
    this.removeBlocker(this._lastBlocker);
    this.dread(0);
    let t = 0;
    this.tick((dt) => {
      if (t >= 2) return;
      t = Math.min(2, t + dt);
      const k = t / 2;
      this._doorLight.intensity = 7 * k;
      this._doorGlow.material.emissiveIntensity = 0.4 + 1.0 * k;
    });
    this.after(0.8, () => {
      this.playSoundAt('hummed', DOORWAY, { notes: TUNE });
      this.subtitle('Goodnight.', 4);
    });
    this.setObjective('');
  }

  // ---------- playtest ----------

  /** Wait for a level state, not a wall clock: the engine clamps dt, so the
   *  corridor's six still seconds take longer than six seconds on a slow frame. */
  async _waitFor(test, capSeconds) {
    const until = Date.now() + capSeconds * 1000;
    while (!test() && Date.now() < until) await this.debugWait(0.05);
  }

  async debugSolve() {
    const pl = this.game.player;

    // act 1 — the note, then the evening in order
    this.debugInteract(this._fuseNote);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    for (const k of ORDER) {
      this.debugInteract(this._switchOf(k));
      await this.debugWait(0.2);
    }
    await this.debugWait(0.4);

    // act 2 — stand still in the corridor until it comes, and goes past
    pl.teleport(CX, -8, 0);
    await this._waitFor(() => this._act === 3, 30);

    // act 3 — the box fills while you are not looking
    pl.teleport(CX, -17.5, 0);
    this.debugInteract(this._boxMesh);
    await this.debugWait(0.2);
    for (const item of [this._photo, this._ribbon, this._key]) {
      pl.teleport(CX, -17.5, Math.PI);
      await this._waitFor(() => item.visible, 5);
      pl.teleport(CX, -17.5, 0);
      this.debugInteract(item);
      await this.debugWait(0.2);
    }
    await this.debugWait(1.7);                            // the three knocks
    this.debugInteract(this._lastDoor);
    await this.debugWait(0.5);

    // act 4 — the last note, and the doorway
    pl.teleport(CX, -23.0, 0);
    this.debugInteract(this._chair);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    await this.debugWait(1.2);
    pl.teleport(CX, -27.5);
    await this.debugWait(0.6);
  }
}
