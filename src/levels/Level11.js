import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeTable, makeChair, makeDust,
  makePictureFrame, applyFog,
} from '../core/props.js';

// XI — The Bedroom
// False awakening. 3:07, the door locked from the other side, M.'s knock code,
// knocking that moves along the walls, and the back of the wardrobe.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.1

const W = 4.2, D = 3.6, H = 2.5;                       // interior; origin at the centre; +Z is the door wall
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
const HUM = LevelBase.tune('EGAG');
const DOOR_POS = { x: 1.2, y: 1.2, z: 1.8 };
const BEYOND_DOOR = { x: 1.2, y: 1.4, z: 2.8 };
const WB_POS = { x: -0.55, y: 1.2, z: 1.79 };          // the wardrobe's back panel
const LANDING_POS = { x: -0.05, y: 1.4, z: 2.8 };

export default class Level11 extends LevelBase {
  static meta = {
    id: 11,
    numeral: 'XI',
    title: 'The Bedroom',
    mood: 'night',
    grade: GRADE,
    prologue:
      'You open your eyes.\n\n' +
      'The ceiling of your own room. Morning, or nearly.\n\n' +
      'Except it is the old ceiling — the one with the stick-on stars —\n' +
      'and it is not morning, and the door is shut.\n\n' +
      'You never shut the door.',
    intro: 'It is 3:07. It has been 3:07 for as long as you can remember.',
    outro:
      'The door was never going to open.\n' +
      'You knew that. You knocked anyway,\n' +
      'the way you always did, and something knocked back.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1, 9);
    this._buildShell();
    this._buildFurniture();
    this._buildKnockSpots();
    this._wirePuzzle();
    // The spec says (−0.9, 0, 0.7); that stands you 0.48 m from the wardrobe
    // front (its own z 1.18), so the whole first frame is one door panel.
    // Same side of the room, same yaw, 0.9 m further from the wall.
    this.spawn.position.set(-0.6, 0, -0.2);
    this.spawn.yaw = Math.PI;                              // facing the door wall (+Z)
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-W / 2, 0, -D / 2),
      new THREE.Vector3(W / 2, 3, 3.8)
    );
    this.setObjective('the door was open when you fell asleep');
  }

  // ---------- small builders ----------

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  /**
   * makeDoor tints its wood texture — which is already generated from that
   * colour — by the colour a second time. In a hallway lit by seven bulbs
   * that reads fine; in a room lit by one desk lamp it lands the albedo at
   * about 0.01 and the door renders black. Keep the texture, drop the tint,
   * so the panel actually reads as the colour the spec names.
   */
  _plainWood(door) {
    door.panel.material.color.setScalar(1);
    return door;
  }

  /** Two raised panels on a door leaf, so a slab of wood reads as joinery. `face` is the room-facing side. */
  _raisedPanels(door, w, h, offY, face) {
    for (const py of [offY, -offY]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), door.panel.material);
      m.position.set(0, py, face * 0.031);
      door.panel.add(m);
    }
    return door;
  }

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

  // ---------- shell ----------

  _buildShell() {
    const wallMat = makeMat('wallpaper', { base: '#8d8378', stripe: '#7f7468', repeat: [3, 1.2] });
    const floorMat = makeMat('carpet', { base: '#5a4e4c', repeat: [3, 3] });
    const ceilMat = makeMat('plaster', { base: '#9a9488', repeat: [2, 2] });
    const concrete = makeMat('concrete', { base: '#6e6a64', repeat: [2, 2] });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x6d5a45, roughness: 0.75 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.add(floor); this.addGround(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
    this.add(ceil);

    // walls: west, east, north (window), south (door + wardrobe opening)
    this._box(0.2, H, D + 0.4, wallMat, -W / 2 - 0.1, H / 2, 0);
    this._box(0.2, H, D + 0.4, wallMat, W / 2 + 0.1, H / 2, 0);
    this._box(W + 0.4, H, 0.2, wallMat, 0, H / 2, -D / 2 - 0.1);
    // south wall in pieces: west of the wardrobe, between wardrobe and door, east of the door, lintels
    this._box(1.05, H, 0.2, wallMat, -1.575, H / 2, D / 2 + 0.1);         // x -2.1..-1.05
    this._box(0.65, H, 0.2, wallMat, 0.275, H / 2, D / 2 + 0.1);          // x -0.05..0.6
    this._box(0.3, H, 0.2, wallMat, 1.95, H / 2, D / 2 + 0.1);            // x 1.8..2.1
    this._box(1.2, H - 2.1, 0.2, wallMat, 1.2, 2.1 + (H - 2.1) / 2, D / 2 + 0.1);   // door lintel
    this._box(1.0, H - 2.1, 0.2, wallMat, -0.55, 2.1 + (H - 2.1) / 2, D / 2 + 0.1); // wardrobe lintel

    // skirting, so the walls meet the carpet somewhere
    for (const [w, d, x, z] of [
      [0.04, D, -W / 2 + 0.02, 0], [0.04, D, W / 2 - 0.02, 0],
      [W, 0.04, 0, -D / 2 + 0.02], [1.05, 0.04, -1.575, D / 2 - 0.02],
      [0.65, 0.04, 0.275, D / 2 - 0.02], [0.3, 0.04, 1.95, D / 2 - 0.02],
    ]) {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), trimMat);
      sk.position.set(x, 0.06, z);
      this.add(sk);
    }

    // ceiling stars — three loose constellations, the only thing that reads as childhood
    const starMat = new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x9fd6a8, emissiveIntensity: 1.6 });
    const starGeo = new THREE.SphereGeometry(0.012, 6, 5);
    for (let i = 0; i < 45; i++) {
      const s = new THREE.Mesh(starGeo, starMat);
      const cl = i % 3;
      s.position.set((cl - 1) * 1.1 + (Math.random() - 0.5) * 1.3, H - 0.012, (cl - 1) * 0.6 + (Math.random() - 0.5) * 1.6);
      this.add(s);
    }

    this.add(new THREE.HemisphereLight(0x3a3f55, 0x0b0b10, 0.25));

    // the door (south wall, x +1.2), never opens
    this._door = this._raisedPanels(this._plainWood(makeDoor({ color: '#5a4636' })), 0.7, 0.85, 0.5, -1);
    this._door.position.set(1.2, 0, D / 2);
    this.add(this._door); this.track(this._door); this.addCollider(this._door.panel);

    // window (north wall): black glossy pane + architrave + curtains; rain outside
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x05060a, metalness: 0.9, roughness: 0.15,
        emissive: 0x0b1220, emissiveIntensity: 0.55,
      }));
    pane.position.set(-0.6, 1.5, -D / 2 + 0.005);
    this.add(pane);
    // architrave around the pane + a sill, so the black glass reads as glass
    for (const [w, h, x, y] of [
      [1.12, 0.06, -0.6, 2.13], [1.12, 0.06, -0.6, 0.87],
      [0.06, 1.32, -1.13, 1.5], [0.06, 1.32, -0.07, 1.5],
    ]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), trimMat);
      f.position.set(x, y, -D / 2 + 0.025);
      this.add(f);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.045, 0.12), trimMat);
    sill.position.set(-0.6, 0.845, -D / 2 + 0.055);
    this.add(sill);
    // the glazing bars — a child's window, four panes
    const barMat = new THREE.MeshStandardMaterial({ color: 0x3b3129, roughness: 0.8 });
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), barMat);
    barV.position.set(-0.6, 1.5, -D / 2 + 0.02); this.add(barV);
    const barH = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.03), barMat);
    barH.position.set(-0.6, 1.5, -D / 2 + 0.02); this.add(barH);

    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x6b6f7c, roughness: 1 });
    for (const cx of [-1.26, 0.06]) {
      this._box(0.22, 1.5, 0.08, curtainMat, cx, 1.5, -D / 2 + 0.09, { collide: false });
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.6, 8), trimMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-0.6, 2.26, -D / 2 + 0.09);
    this.add(rail);
    this.loopAt('rain', { x: -0.6, y: 1.5, z: -2.6 });

    // ---------- beyond the wardrobe's back: a concrete landing and the first steps down ----------
    const landingFloor = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.45), concrete);
    landingFloor.rotation.x = -Math.PI / 2;
    landingFloor.position.set(-0.05, 0, 2.525);            // z 1.8..3.25
    landingFloor.receiveShadow = true;
    this.add(landingFloor); this.addGround(landingFloor);
    this._box(0.2, 3.8, 2.0, concrete, -1.15, 0.7, 2.8);   // west wall, y -1.2..2.6
    this._box(0.2, 3.8, 2.0, concrete, 1.05, 0.7, 2.8);    // east wall
    this._box(2.4, 3.8, 0.2, concrete, -0.05, 0.7, 3.9);   // far wall
    const lc = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), concrete);
    lc.rotation.x = Math.PI / 2; lc.position.set(-0.05, H, 2.8); this.add(lc);
    // four steps going down, each box deep enough that no void shows under it
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 0.15), concrete);
      step.position.set(-0.05, -0.17 * (i + 1) - 0.6, 3.325 + i * 0.15);
      step.receiveShadow = true;
      this.add(step);
    }
    this.addBlocker([-1.15, -2, 3.1], [1.05, 3, 4.0]);

    this._cagedBulb = makeBulbLight({ color: 0xd8dcd0, intensity: 0, distance: 5, y: 2.35 });
    this._cagedBulb.position.set(-0.05, 0, 2.8);
    this.add(this._cagedBulb);
    // it is off: keep the glass dark until the panel opens
    this._bulbGlass = this._cagedBulb.children.find((c) => c.isMesh && c.material.emissiveIntensity > 1);
    if (this._bulbGlass) this._bulbGlass.material.emissiveIntensity = 0.05;
    const cageMat = new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.6, metalness: 0.7 });
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), cageMat);
    rose.position.set(-0.05, H - 0.01, 2.8);
    this.add(rose);
    for (let i = 0; i < 4; i++) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 14, Math.PI), cageMat);
      hoop.position.set(-0.05, 2.2, 2.8);
      hoop.rotation.y = (i / 4) * Math.PI;
      hoop.rotation.z = Math.PI / 2;
      this.add(hoop);
    }
  }

  // ---------- furniture ----------

  _buildFurniture() {
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x745c43, roughness: 0.8 });
    const linen = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 1 });
    const blanketMat = new THREE.MeshStandardMaterial({ color: 0x6d5a52, roughness: 1 });

    // ---- bed: west wall, head at north ----
    const bed = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 2.0), woodDark);
    frame.position.set(-1.55, 0.16, -0.6);
    frame.castShadow = frame.receiveShadow = true;
    this.add(frame); this.addCollider(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.17, 1.92), linen);
    mattress.position.set(-1.55, 0.4, -0.6);
    mattress.receiveShadow = true;
    bed.add(mattress);
    const duvet = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.13, 1.15), blanketMat);
    duvet.position.set(-1.55, 0.55, -0.35);
    duvet.rotation.y = 0.02;
    duvet.castShadow = duvet.receiveShadow = true;
    bed.add(duvet);
    const folded = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.42), blanketMat);
    folded.position.set(-1.55, 0.53, 0.15);
    bed.add(folded);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.32), linen);
    pillow.position.set(-1.55, 0.54, -1.3);
    pillow.rotation.y = 0.09;
    pillow.castShadow = true;
    bed.add(pillow);
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.9, 0.06), woodDark);
    headboard.position.set(-1.55, 0.45, -1.63);
    headboard.castShadow = true;
    bed.add(headboard);
    this.add(bed);

    // ---- desk: east wall ----
    const desk = makeTable({ w: 0.7, d: 1.0, h: 0.76 });
    desk.position.set(1.65, 0, -0.4);                      // x 1.30..2.00, z −0.9..0.1
    this.add(desk); this.addCollider(desk);

    const drawerBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.5), woodDark);
    drawerBody.position.set(1.65, 0.65, -0.4);
    drawerBody.castShadow = true;
    this.add(drawerBody);
    this._drawer = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.13, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.7 })
    );
    this._drawer.position.set(1.328, 0.65, -0.4);
    this._drawer.castShadow = true;
    this.add(this._drawer);
    const brass = new THREE.MeshStandardMaterial({
      color: 0xa8925e, roughness: 0.35, metalness: 0.85,
      emissive: 0x3a2c10, emissiveIntensity: 0.9,          // a glint, so brass is findable in the dark
    });
    const pull = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), brass);
    pull.position.set(1.306, 0.65, -0.4);
    this.add(pull);

    // the lamp — the only light in the room
    const lampMetal = new THREE.MeshStandardMaterial({ color: 0x8e7a56, roughness: 0.45, metalness: 0.65 });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 14), lampMetal);
    lampBase.position.set(1.45, 0.795, -0.5);
    this.add(lampBase);
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.29, 8), lampMetal);
    lampStem.position.set(1.45, 0.945, -0.5);
    this.add(lampStem);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.17, 18, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xb9a37a, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide })
    );
    shade.position.set(1.45, 1.13, -0.5);
    this.add(shade);
    const filament = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x241d12, emissive: 0xffd9a8, emissiveIntensity: 2.6 })
    );
    filament.position.set(1.45, 1.06, -0.5);
    this.add(filament);
    // One low lamp in a 4.2 x 3.6 room casts shadows that are pure black — the
    // floor, the wall above the shelf and the whole south wall become voids.
    // The lamp lights the room; the falloff does the shaping.
    const lamp = new THREE.PointLight(0xffd9a8, 3.2, 6, 1.0);
    lamp.position.set(1.4, 1.05, -0.5);
    this.add(lamp);

    // the clock — a small body with a plane of glowing digits facing the room
    const clockBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 0.6 })
    );
    clockBody.position.set(1.645, 0.845, -0.05);
    clockBody.castShadow = true;
    this.add(clockBody);
    this._clock = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.09),
      new THREE.MeshStandardMaterial({ emissive: 0xff6a4a, emissiveIntensity: 0.9 })
    );
    this._clock.position.set(1.598, 0.86, -0.05);
    this._clock.rotation.y = -Math.PI / 2;                 // facing −X, into the room
    this.add(this._clock);
    this._setClock('3:07');

    // the chair, at the desk, facing it
    this._chair = makeChair();
    this._chair.position.set(1.05, 0, -0.35);
    this._chair.rotation.y = Math.PI / 2;
    this.add(this._chair); this.addCollider(this._chair);

    // the shelf above the desk, and the music box on it
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.9), woodDark);
    plank.position.set(1.94, 1.695, -0.4);
    plank.castShadow = plank.receiveShadow = true;
    this.add(plank);
    for (const bz of [-0.75, -0.05]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.03), woodDark);
      bracket.position.set(1.99, 1.61, bz);
      this.add(bracket);
    }
    this._musicBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.6 })
    );
    this._musicBox.position.set(1.85, 1.75, -0.4);
    this._musicBox.castShadow = true;
    this.add(this._musicBox);

    // two photographs over the bed, figures too blurred to name — the motif from I and V
    for (const [pz, py, figs] of [[-0.25, 1.66, 2], [0.06, 1.60, 3]]) {
      const frame = makePictureFrame({ texture: blurredPhotoTexture({ figures: figs }), width: 0.24, height: 0.18 });
      frame.position.set(-2.085, py, pz);
      frame.rotation.y = Math.PI / 2;
      this.add(frame);
    }

    // ---- mirror and the sheet over it: west wall ----
    const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.6), woodDark);
    mirrorFrame.position.set(-2.09, 1.4, 0.95);
    this.add(mirrorFrame);
    this._mirror = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0a0b0e, metalness: 1, roughness: 0.05 })
    );
    this._mirror.position.set(-2.073, 1.4, 0.95);
    this._mirror.rotation.y = Math.PI / 2;                 // facing +X, into the room
    this.add(this._mirror);
    this._sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.95, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xb9b1a2, roughness: 1 })
    );
    this._sheet.position.set(-2.06, 1.4, 0.95);
    this._sheet.rotation.y = Math.PI / 2;                  // hanging flat against the wall
    this._sheet.castShadow = this._sheet.receiveShadow = true;
    this.add(this._sheet);
    this._sheetDown = false;

    // ---- wardrobe: south wall, west of the door ----
    const carcass = new THREE.MeshStandardMaterial({ color: 0x7a6349, roughness: 0.8 });
    this._box(0.03, 2.1, 0.62, carcass, -1.035, 1.05, 1.49);
    this._box(0.03, 2.1, 0.62, carcass, -0.065, 1.05, 1.49);
    this._box(1.0, 0.04, 0.62, carcass, -0.55, 2.08, 1.49, { collide: false });
    this._box(1.0, 0.03, 0.62, carcass, -0.55, 0.015, 1.49, { collide: false, ground: true });
    this._box(1.0, 0.11, 0.04, carcass, -0.55, 2.045, 1.79, { collide: false });   // over the back panel
    this._box(1.12, 0.09, 0.72, carcass, -0.55, 2.145, 1.44, { collide: false });  // cornice
    this._box(1.08, 0.1, 0.68, carcass, -0.55, 0.05, 1.46, { collide: false });    // plinth

    const railBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.94, 8), lampMetal);
    railBar.rotation.z = Math.PI / 2;
    railBar.position.set(-0.55, 1.9, 1.45);
    this.add(railBar);
    // five coats, bunched to the ends of the rail — someone pushed them apart
    const coats = [[-0.91, 0x6b5f52], [-0.85, 0x847d73], [-0.79, 0x59565a], [-0.22, 0x8d7a60], [-0.16, 0x646a70]];
    coats.forEach(([cx, c], i) => {
      const coat = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 1.0, 0.12),
        new THREE.MeshStandardMaterial({ color: c, roughness: 1 })
      );
      coat.position.set(cx, 1.4, 1.45);
      coat.rotation.y = (i % 2 ? 1 : -1) * 0.06;
      coat.castShadow = true;
      this.add(coat);
    });
    this._fallenCoat = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.11, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x847d73, roughness: 1 })
    );
    this._fallenCoat.position.set(-0.62, 0.09, 1.5);
    this._fallenCoat.rotation.y = 0.4;
    this._fallenCoat.visible = false;
    this.add(this._fallenCoat);
    this._coatMarker = new THREE.Object3D();
    this._coatMarker.position.set(-0.55, 1.0, 1.5);
    this.add(this._coatMarker);

    this._wardrobeDoors = new THREE.Group();
    this._wardrobeDoors.position.set(-0.55, 1.0, 1.18);     // its world position is what whenUnseen watches
    this.add(this._wardrobeDoors);
    this._wdL = this._bareDoor(makeDoor({ width: 0.5, height: 2.0, knob: false, color: '#5a4636' }));
    this._wdL.position.set(-0.25, -1.0, 0);                 // world (−0.8, 0, 1.18); hinge at the west edge
    this._wdR = this._bareDoor(makeDoor({ width: 0.5, height: 2.0, knob: false, color: '#5a4636' }));
    this._wdR.position.set(0.25, -1.0, 0);                  // world (−0.3, 0, 1.18)
    this._wdR.rotation.y = Math.PI;                         // so its hinge sits at the east edge
    this._raisedPanels(this._wdL, 0.34, 0.8, 0.48, -1);
    this._raisedPanels(this._wdR, 0.34, 0.8, 0.48, 1);      // this one is turned around
    // the little handles, where a child's hands would find them; on the leaves,
    // so they swing with them
    for (const [wd, hz] of [[this._wdL, -0.055], [this._wdR, 0.055]]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), brass);
      h.position.set(0.18, 0.05, hz);
      wd.panel.add(h);
    }
    this._wardrobeDoors.add(this._wdL, this._wdR);
    this.track(this._wdL); this.track(this._wdR);
    this.addCollider(this._wdL.panel); this.addCollider(this._wdR.panel);

    this._backPanel = this._bareDoor(makeDoor({ width: 1.0, height: 2.0, knob: false, color: '#5a4636' }));
    this._backPanel.position.set(-0.55, 0, 1.79);
    this.add(this._backPanel);
    this.track(this._backPanel);
    this.addCollider(this._backPanel.panel);
  }

  /**
   * Repaint the clock face. `half` draws 3:07 with the last digit only half
   * there — the spec's `'3:07 '`.
   */
  _setClock(text, { half = false } = {}) {
    const tex = textTexture({ text, font: 'bold 60px monospace', color: '#ff7a5a', bg: '#140c0a', width: 256, height: 96 });
    if (half) {
      const ctx = tex.image.getContext('2d');
      ctx.fillStyle = '#140c0a';
      ctx.fillRect(160, 47, 46, 30);
      tex.needsUpdate = true;
    }
    const old = this._clock.material.map;
    this._clock.material.map = tex;
    this._clock.material.emissiveMap = tex;
    this._clock.material.needsUpdate = true;
    old?.dispose?.();
  }

  // ---------- the knock spots ----------

  _buildKnockSpots() {
    // faintly darker patches of wallpaper, 0.5 × 0.5 at y 1.3, 2 mm proud of the wall
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x1a1612, transparent: true, opacity: 0.12, roughness: 1 });
    const defs = [
      ['W1', -W / 2 + 0.002, -1.0, Math.PI / 2], ['W2', -W / 2 + 0.002, 0.6, Math.PI / 2],
      ['N1', -1.4, -D / 2 + 0.002, 0], ['N2', 1.2, -D / 2 + 0.002, 0],
      ['E1', W / 2 - 0.002, -1.4, -Math.PI / 2], ['E2', W / 2 - 0.002, 0.9, -Math.PI / 2],
    ];
    this._spots = defs.map(([name, x, z, ry]) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), spotMat);
      mesh.position.set(x, 1.3, z); mesh.rotation.y = ry;
      this.add(mesh);
      return { name, mesh, pos: new THREE.Vector3(x, 1.3, z) };
    });
    this._wbSpot = { name: 'WB', mesh: this._backPanel, pos: new THREE.Vector3(WB_POS.x, WB_POS.y, WB_POS.z) };
  }

  _spot(name) { return this._spots.find((s) => s.name === name); }

  // ---------- the puzzle ----------

  _wirePuzzle() {
    const s = this;
    this._round = 0; this._wrong = 0; this._noteRead = false; this._answered = false; this._panelOpen = false;

    // the door: locked from the other side; a knock answers; once, humming beyond it
    this.interact(this._door, {
      prompt: 'the door',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('Locked. From the other side.', 5);
        this.after(1.2, () => {
          this.playSoundAt('knock', DOOR_POS, { count: 1, soft: true });
          this.cue('a knock', DOOR_POS);
        });
        if (!this._hummed) {
          this._hummed = true;
          this.after(4.0, () => {
            this.playSoundAt('hummed', BEYOND_DOOR, { notes: HUM });
            this.cue('humming', BEYOND_DOOR);
          });
        }
      },
    });

    // the drawer: M.'s note → round 1
    this.interact(this._drawer, {
      prompt: 'the drawer', once: true,
      onInteract: () => {
        this.giveNote({
          id: 'l11-note',
          title: 'a note in the drawer, older than the others',
          body:
            'when you couldn’t sleep I knocked on the wall\n' +
            'and you knocked back.\n\n' +
            'two for "still there".\n' +
            'three for "come and find me".\n\n' +
            '— M.',
        });
        this._noteRead = true;
        this.setObjective('listen');
        this.whenUnseen(this._musicBox, () =>
          this.playSoundAt('musicbox', this._musicBox.position, { notes: HUM, slow: 0.15 }));
        this._startRound(1);
      },
    });

    // knock spots (wall patches); the wardrobe back is registered when the doors open
    for (const spot of this._spots) this.interact(spot.mesh, { prompt: 'knock', onInteract: () => this._knockAt(spot) });

    // the wardrobe doors
    this.interact(this._wardrobeDoors, {
      prompt: 'the wardrobe', once: true,
      onInteract: () => {
        this._wardrobeOpened = true;
        this.removeColliderOf(this._wdL.panel);            // before the swing moves them
        this.removeColliderOf(this._wdR.panel);
        this._wdL.setOpen(true, 1); this._wdR.setOpen(true, -1);   // both swing into the room
        this.playSound('door');
        this.whenUnseen(this._coatMarker, () => { this._fallenCoat.visible = true; });
        this.interact(this._backPanel, { prompt: 'knock', onInteract: () => this._knockAt(this._wbSpot) });
      },
    });

    // unseen change 0: the wardrobe stands ajar after 15 s (first look-away), unless you already opened it
    this.after(15, () => this.whenUnseen(this._wardrobeDoors, () => { if (!this._wardrobeOpened) this._wdL.setAngle(0.2); }));

    // the clock misreads, sometimes, while you aren't looking
    this._clockOdd = false;
    this.whenUnseen(this._clock, () => {
      if (this._clockOdd) { this._setClock('3:07'); this._clockOdd = false; return; }
      if (Math.random() < 0.3) {
        const pick = (Math.random() * 3) | 0;
        if (pick === 0) this._setClock('3:O7');
        else if (pick === 1) this._setClock('7:03');
        else this._setClock('3:07', { half: true });
        this._clockOdd = true;
      }
    }, { once: false });
    this.interact(this._clock, {
      prompt: 'the clock',
      onInteract: () => this.subtitle('3:07. It was 3:07 when you fell asleep, too.', 5),
    });
    this.interact(this._mirror, {
      prompt: 'the mirror',
      onInteract: () => this.subtitle(
        this._sheetDown ? 'Dark glass. Nothing in it that should not be.' : 'A sheet over it. You always kept it covered.',
        4
      ),
    });

    // through the wardrobe: the handle turns behind you, and the room lets you go
    this.tick(() => {
      if (this._panelOpen && !this.isCompleted && s.game.player.position.z > 2.6) {
        this.playSoundAt('handle', DOOR_POS);
        this.cue('the handle turns', DOOR_POS);
        this.flinch({ flash: 90 });
        this.complete();
      }
    });
  }

  /** Round n: knocking (three) from a source spot every 6 s until answered at that spot. */
  _startRound(n) {
    this._round = n; this._wrong = 0; this._answered = false;
    this._source = n === 1 ? this._spot('E2') : n === 2 ? this._spot('W1') : this._wbSpot;
    const src = this._source;
    const burst = () => {
      if (this._round !== n || this._answered) return;
      this.playSoundAt('knock', src.pos, { count: 3 });
      this.cue('knocking', src.pos);
      this._puff(src.pos);
      this._burstTimer = this.after(6, burst);
    };
    burst();
  }

  _knockAt(spot) {
    if (!this._noteRead) { this.subtitle('The wall is cold.', 3); return; }
    this.playSoundAt('knock', spot.pos, { count: 2 });          // your two: still there
    if (this._answered) return;
    if (spot !== this._source) {
      this._wrong++;
      this.after(0.6, () => {
        this.playSoundAt('knock', spot.pos, { count: 1, soft: true });
        if (this._wrong >= 2) this.subtitle('Nothing there. Listen — it is coming from somewhere else.', 5);
      });
      return;
    }
    this._answered = true;
    clearTimeout(this._burstTimer);
    if (this._round === 3) {
      this.hush(1.4, 0.9);                                      // silence, and then the back of the wardrobe
      this.after(1.5, () => this._openPanel());
      return;
    }
    this.after(0.6, () => {
      this.playSoundAt('knock', spot.pos, { count: 2, soft: true });   // her two: still there
      this.subtitle('Two. Still there.', 4);
      if (this._round === 1) {
        this.learnClue({ id: 'l11-code', title: 'the knocks', body: 'two — still there.\nthree — come and find me.' });
        this.whenUnseen(this._chair, () => this._turnChair());
        this.after(5, () => this._startRound(2));
      } else {
        this.whenUnseen(this._sheet, () => this._dropSheet());
        this.after(5, () => this._startRound(3));
      }
    });
  }

  _turnChair() {
    this._chair.rotation.y += Math.PI * 0.85;
    this._chair.position.x -= 0.15;
  }

  _dropSheet() {
    this._sheetDown = true;
    this._sheet.rotation.set(-Math.PI / 2, 0, 0.3);
    this._sheet.position.set(-1.75, 0.02, 0.95);
    this.whenSeen(this._mirror, () => this.subtitle('You always kept it covered. You were right to.', 5));
  }

  _openPanel() {
    this._panelOpen = true;
    this._backPanel.setOpen(true, -1);                          // swings into the landing (+Z)
    this.removeColliderOf(this._backPanel.panel);
    this.playSound('door');
    // the landing's own light, and the only shadow caster in the room — the
    // concrete has to keep it out of the bedroom except through the opening
    this._cagedBulb.light.intensity = 2.5;
    this._cagedBulb.light.castShadow = true;
    this._cagedBulb.light.shadow.mapSize.set(1024, 1024);
    this._cagedBulb.light.shadow.camera.near = 0.2;
    this._cagedBulb.light.shadow.bias = -0.002;
    this._cagedBulb.light.shadow.normalBias = 0.03;
    if (this._bulbGlass) this._bulbGlass.material.emissiveIntensity = 3.5;
    this.playSoundAt('reverse', LANDING_POS, { dur: 1.4 });
    this.dread(0.35);
    this.setObjective('down');
    this.subtitle('Cold air. Concrete. Stairs, going down, where the back of the wardrobe used to be.', 6);
  }

  /** The sighted fallback for a knock: a small fall of dust at the spot for 1.2 s. */
  _puff(pos) {
    const d = makeDust({
      count: 16, box: [0.32, 0.36, 0.32], center: [pos.x, pos.y, pos.z],
      size: 0.018, color: 0xd8cfc0,
    });
    d.material.opacity = 0.5;
    this.add(d); this.track(d);
    this.after(1.2, () => {
      this.root.remove(d);
      this._tracked.delete(d);
      d.geometry.dispose();
      d.material.dispose();
    });
  }

  async debugSolve() {
    // M.'s note, in the drawer
    this.debugInteract(this._drawer);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    await this.debugWait(0.4);
    // round 1: the east wall answers
    this.debugInteract(this._spot('E2').mesh);
    await this.debugWait(6.0);                     // her reply at 0.6 s, round 2 arms at 5.6 s
    // round 2: above the bed
    this.debugInteract(this._spot('W1').mesh);
    await this.debugWait(6.0);
    // round 3: inside the wardrobe
    this.debugInteract(this._wardrobeDoors);
    await this.debugWait(0.4);
    this.debugInteract(this._backPanel);           // the panel opens 1.5 s later
    await this.debugWait(2.0);
    // through the back of the wardrobe, onto the landing
    this.game.player.teleport(-0.4, 3.0);
    await this.debugWait(0.6);
  }
}
