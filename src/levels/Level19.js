import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, chalkTexture, blurredPhotoTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeKeyProp, makeTable, makeShelf, makeSign,
  makePictureFrame, makeClockFace, makeDust, applyFog,
} from '../core/props.js';
import { makeChild } from '../core/presence.js';
import { Hours } from '../core/hours.js';

// XIX — The Stairs
// The landing at three hours: the archive in the airing cupboard at the
// morning, the bathroom and the box room at the evening, and at 3:07 the
// shaft of XII behind the cupboard door — with the roles swapped. You are
// the footsteps below. Light the doors one closer each time round, write
// the chalk, and when it stops, go up to it and stop two metres short.
// Design: docs/superpowers/specs/2026-08-23-rooms-xvi-xx-design.md §5.4

const LAND_Y = 1.8;
const FLOOR_H = 2.72, RISE = 0.17, RUN = 0.28, STEPS = 8, TREAD = 0.24;
const MAIN = { x0: -3.4, x1: -1.2 }, FLIGHT = { x0: -5.64, x1: -3.4 }, HALF = { x0: -7.8, x1: -5.64 };
const ZS = { s0: -0.4, s1: 0.9, n0: 0.9, n1: 2.2 };        // south flight z, north flight z
const MAIN_CX = (MAIN.x0 + MAIN.x1) / 2, HALF_CX = (HALF.x0 + HALF.x1) / 2;
const ZC = (ZS.s0 + ZS.n1) / 2, ZD = ZS.n1 - ZS.s0;
const Z_SOUTH = (ZS.s0 + ZS.s1) / 2, Z_NORTH = (ZS.n0 + ZS.n1) / 2;
const LANDINGS = [                                            // idx → label, y
  ['2', LAND_Y], ['1', LAND_Y - FLOOR_H], ['G', LAND_Y - 2 * FLOOR_H],
  ['−1', LAND_Y - 3 * FLOOR_H], ['−2', LAND_Y - 4 * FLOOR_H], ['−3', LAND_Y - 5 * FLOOR_H],
];
const SHAFT_TOP = LAND_Y + 2.5;                               // 4.3 — the landing's ceiling height
const SHAFT_BOT = LAND_Y - 6 * FLOOR_H - 1.4;                 // −15.92
const LOOP_FOOT = LAND_Y - 5 * FLOOR_H - 1.36 - 0.24;         // −13.4: below L5's half-landing, on the north flight
const LOOP_UP = 3 * FLOOR_H;                                  // 8.16
const CLOCK_POS = { x: 1.0, y: LAND_Y + 1.7, z: -0.5 };

// the landing and the stair hall
const LX = 1.2, LZ0 = -3.0, LZ1 = 2.7, CEIL = LAND_Y + 2.5;
const FOOT_X = 0.9, FOOT_Z1 = 7.0;                            // the stair hall: x ±0.9, z 2.7..7.0

const CARDS = [                                               // top of the tray first
  ['the street', 'three lamps came on, and the one outside your house never did. the key was under the stone that didn\'t match.'],
  ['the pool', 'nobody watched you swim but her. the deep end was four.'],
  ['the hallway', 'doors 203 to 212. the spare key where the flowers used to be; you watered them on Sundays.'],
  ['the field', 'from the tree that died the summer you were eight, thirteen posts along the wire, and look down. a tin. a ribbon.'],
  ['the theater', 'row F, seat 8. The Long Summer, 1974. you cannot remember it.'],
  ['the house', 'supper, then slippers, then the wireless, and yours always last. the porch was dead.'],
  ['the platform', 'the 23:47, carriage 3, seat 41. the train did not stop.'],
  ['the supermarket', 'milk, bread, apples, sunflowers, for Sunday. the office knew the aisles: 3 1 4 2.'],
];
const BOX_LINES = {
  'the street': 'A house key, and a stone that does not match.', 'the pool': 'A tile from the deep end.',
  'the field': 'A rusted tin, empty.', 'the theater': 'A ticket stub, row F.',
  'the platform': 'A ticket for the 23:47, smudged.', 'the supermarket': 'A list. You know the list.',
};
const HUM = LevelBase.tune('EGAG');                           // hers, from downstairs, at the evening
const FIRE_PLAN = 'IN THE EVENT OF FIRE\ndo not use the lifts\ndo not run\nassembly point: the playground';
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

/** An empty per-hour spec, filled by the builders and handed to Hours.bind. */
const spec = () => ({ objects: [], colliders: [], interact: [], lights: [], blockers: [], loops: [] });

export default class Level19 extends LevelBase {
  static meta = {
    id: 19,
    numeral: 'XIX',
    title: 'The Stairs',
    mood: 'stairwell',
    grade: GRADE,
    intro: 'Up, then. Two flights below it, always; she taught you that without meaning to.',
    outro:
      'You lit the doors one closer each time round,\n' +
      'and wrote wait for me in the only hand it could have been in,\n' +
      'and when it stopped, you stopped two metres short, and the door gave.',
  };

  build() {
    applyFog(this.scene, '#0a0a10', 1.5, 14);
    this.hours = new Hours(this, { initial: 'night' });

    this._wound = false;
    this._have = { photo: false, ribbon: false, key: false };   // in the box
    this._strikes = 0;
    this._ready = false;
    this._tray = 0;                                              // next card index
    this._holding = null;                                        // the card index in hand
    this._filed = 0;
    this._loopCount = 0; this._correct = 0; this._pleaded = 0;
    this._chalkWritten = false; this._tally = 0;
    this._still = 0; this._climb = 0; this._tPrev = null;
    this._approach = null;                                       // null | 'fixed' | 'done'
    this._exitOpen = false;
    this._inShaft = false;
    this._stub = {};                                             // floor idx (3,4,5) → { light, plane, cord, on, y }
    this._stubBlockers = {};
    this._shaftBlockers = [];
    this._shaftBulbs = [];                                       // { light, x, y, z, radius }
    this._boxes = {};                                            // archive label → { mesh, lid, open }
    this._dimmable = [];                                         // lights switched off while dark
    this._rooms = [];                                            // rooms drawn only when their door is open
    this._doorRecs = {};

    this._materials();
    this._buildStairHall();
    this._buildLanding();
    this._buildBathroom();
    this._buildCupboard();
    this._buildBoxRoom();
    this._buildArchive();
    this._buildClock();
    // Everything above is the house; everything below it is the shaft. They
    // are never both in shot, so each is one group that can be switched off.
    this._house = new THREE.Group();
    this._house.add(...this.root.children.slice());
    this.root.add(this._house);
    this._buildShaft();
    this._bindLook({ x: 0.3, y: LAND_Y + 1.4, z: -2.95 }, { x: 2, y: 8, z: -10 });
    this._wireLightBudget();
    this._wirePuzzle();

    this.spawn.position.set(0, 0, 6.2);
    this.spawn.yaw = 0;
    this.bounds = new THREE.Box3(new THREE.Vector3(-8.2, -16, -3.2), new THREE.Vector3(4.6, 4.8, 7.2));
    this.setObjective('up. then yours last.');

    this.hours.start();
    this.track(this.hours);
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

  /** The same, but bound to one hour: solid and visible only then. */
  _hourBox(s, w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    s.objects.push(m);
    if (collide) s.colliders.push(m);
    if (ground) this.addGround(m);
    return m;
  }

  /**
   * A floor the downward raycast can find only at the hours it belongs to.
   * Hours hides an object at the other hours; it cannot unregister a ground,
   * and the raycast ignores visibility, so an hour-only floor over another
   * hour's drop has to be added and dropped by hand.
   */
  _hourGround(mesh, hours) {
    const on = () => { if (!this.grounds.includes(mesh)) this.grounds.push(mesh); };
    const off = () => { const i = this.grounds.indexOf(mesh); if (i >= 0) this.grounds.splice(i, 1); };
    for (const h of this.hours.order) this.hours.bind(h, { onEnter: hours.includes(h) ? on : off });
  }

  /**
   * Pack everything added to the root since `from` into one group, and make
   * that group the hour's only object: a room behind a shut door is never in
   * shot, and this scene is fill-bound, so it should not be drawn either.
   */
  _pack(s, from, hour, rec, box) {
    const moved = this.root.children.slice(from);
    const g = new THREE.Group();
    for (const o of moved) g.add(o);
    this.root.add(g);
    s.objects.length = 0;
    s.objects.push(g);
    this._rooms.push({ group: g, hour, rec, box });
    return g;
  }

  _plane(w, h, mat, x, y, z, rot = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    if (rot.x) m.rotation.x = rot.x;
    if (rot.y) m.rotation.y = rot.y;
    this.add(m);
    return m;
  }

  /**
   * makeDoor draws a fresh 512-square wood texture and a noise bump for every
   * leaf, and this room has eleven doors; one material per colour is eleven
   * canvases' worth of load time saved. It also tints its map with `color` and
   * then multiplies the material by that colour again, so a hex goes on twice
   * and the leaf renders near black under one bulb — keep the map, drop the
   * second tint, and drop the bump with it (see _flat).
   */
  _door(opts) {
    const d = makeDoor(opts);
    const key = opts.color ?? '#6e5940';
    const cache = (this._doorMats ??= {});
    if (!cache[key]) {
      d.panel.material.color.setScalar(1);
      d.panel.material.bumpMap?.dispose();
      d.panel.material.bumpMap = null;
      cache[key] = d.panel.material;
    } else {
      d.panel.material.map?.dispose();
      d.panel.material.bumpMap?.dispose();
      d.panel.material.dispose();
      d.panel.material = cache[key];
    }
    this.track(d);
    return d;
  }

  /**
   * Two raised panels on a leaf, so a slab of wood reads as joinery. Nothing
   * in this room casts shadows, so a six-millimetre relief in the same wood is
   * invisible; the panels are the same map a shade darker, which is what a
   * moulded edge looks like anyway.
   */
  _panelled(door, face = 1) {
    const base = door.panel.material;
    const cache = (this._panelMats ??= new Map());
    let mat = cache.get(base);
    if (!mat) {
      mat = base.clone();
      mat.color.multiplyScalar(0.74);
      cache.set(base, mat);
    }
    for (const [py, h] of [[0.55, 0.62], [-0.45, 0.78]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.66, h, 0.012), mat);
      m.position.set(0, py, face * 0.031);
      door.panel.add(m);
    }
    return door;
  }

  /** A hanging bulb whose glass goes dark with it. */
  _bulb(opts) {
    const g = makeBulbLight(opts);
    g.light.userData.glow = g.children.find((c) => c.isMesh && c.material?.emissive && c.material.emissiveIntensity > 1);
    return g;
  }

  /**
   * makeMat hangs the colour map on the material a second time as a bump map,
   * which triples the texture fetches per lit pixel. This room is three rooms
   * and a six-storey shaft in one scene and is fill-bound before anything
   * else, so it keeps the maps and drops the bump.
   */
  _flat(mat) { mat.bumpMap = null; return mat; }

  _materials() {
    this._plaster = this._flat(makeMat('plaster', { base: '#a9a597', repeat: [2, 1] }));
    this._paper = this._flat(makeMat('wallpaper', { base: '#8d8378', stripe: '#7f7468', repeat: [3, 1.2] }));
    this._carpet = this._flat(makeMat('carpet', { base: '#5a4e4c', repeat: [3, 3] }));
    this._stair = this._flat(makeMat('carpet', { base: '#7a6b66', repeat: [2, 2] }));
    this._ceilMat = this._flat(makeMat('ceiling', { base: '#b8b3a6', repeat: [2, 2] }));
    this._wood = this._flat(makeMat('wood', { base: '#4a3a2c', repeat: [1, 2] }));
    this._trim = new THREE.MeshStandardMaterial({ color: 0x6d5a45, roughness: 0.75 });
    this._tile = this._flat(makeMat('tile', { base: '#c9c4b4', grout: '#e2ded2', repeat: [3, 2] }));
    // Concrete floors face up and get their light from a bulb 2.3 m over them
    // at a steep angle, so the spec's greys read black. These are the same
    // greys opened up until a flight is legible from the landing above it.
    this._concrete = this._flat(makeMat('concrete', { base: '#7a766f', repeat: [2, 1] }));
    this._shaftFloor = this._flat(makeMat('concrete', { base: '#827d74', repeat: [1, 1] }));
    this._stepMat = this._shaftFloor;
    this._dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9 });
    // painted steel: there is no environment map here, so high metalness is black
    this._railMat = new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.42, metalness: 0.18 });
    this._card = new THREE.MeshStandardMaterial({ color: 0xa3896a, roughness: 0.95 });
    this._white = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, emissive: 0xffffff, emissiveIntensity: 1.6 });
  }

  // ---------- the stair hall ----------

  _buildStairHall() {
    const stub = this._box(FOOT_X * 2, 0.2, 1.6, this._carpet, 0, -0.1, 6.2, { collide: false, ground: true });
    stub.receiveShadow = true;
    for (let k = 0; k < 10; k++) {                              // ten treads, z 5.4 → 2.7, rise 0.18
      const top = 0.18 * (k + 1);
      this._box(FOOT_X * 2, top, 0.27, this._stair, 0, top / 2, 5.4 - 0.27 * (k + 0.5), { ground: true });
    }
    for (const sx of [-1, 1]) {
      this._box(0.2, 4.3, FOOT_Z1 - 2.4, this._paper, sx * (FOOT_X + 0.1), 2.15, (2.6 + FOOT_Z1 + 0.2) / 2);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.9), this._trim);
      rail.position.set(sx * (FOOT_X - 0.06), 1.62, 4.05);
      rail.rotation.x = -Math.atan2(1.8, 2.7);
      this.add(rail);
    }
    // photographs up the wall, the way a stair in a house like this has them:
    // they are the only thing to look at from inside the hall
    const shot = blurredPhotoTexture({ figures: 2 });
    const shot1 = blurredPhotoTexture({ figures: 1 });
    const shot3 = blurredPhotoTexture({ figures: 3 });
    const LINES = ['Somebody small, in a coat too big.', 'Her, squinting, holding the camera wrong.',
      'A garden gone. Three of you. Two of you are gone as well.', 'A birthday. The candles are out already.',
      'The two of you on the step, in the light from the hall.'];
    [[-1, 6.05, 1.5, shot], [-1, 4.9, 1.9, shot1], [-1, 3.75, 2.3, shot3], [1, 6.15, 1.62, shot1], [1, 4.9, 2.1, shot]]
      .forEach(([sx, z, y, tex], i) => {
        const fr = makePictureFrame({ texture: tex, width: 0.24, height: 0.18 });
        fr.position.set(sx * (FOOT_X - 0.02), y, z);
        fr.rotation.y = -sx * Math.PI / 2;
        this.add(fr);
        this.interact(fr, { prompt: 'a photograph', onInteract: () => this.subtitle(LINES[i], 4) });
      });
    this._box(FOOT_X * 2 + 0.4, 4.3, 0.2, this._paper, 0, 2.15, FOOT_Z1 + 0.1);
    this._box(FOOT_X * 2 + 0.4, 0.2, FOOT_Z1 - 2.5, this._ceilMat, 0, 4.4, (2.7 + FOOT_Z1) / 2, { collide: false });

    this._backDoor = this._door({ width: 0.9, color: '#6b543c', frameColor: '#4c4034' });
    this._backDoor.position.set(0, 0, FOOT_Z1 - 0.02);
    this._backDoor.rotation.y = Math.PI;
    this._panelled(this._backDoor);
    this.add(this._backDoor);
    this.addCollider(this._backDoor.panel);
    this.interact(this._backDoor, {
      prompt: 'the way you came',
      onInteract: () => { this.playSound('locked'); this.subtitle('It shut behind you. They always do.', 4); },
    });
  }

  // ---------- the landing ----------

  _buildLanding() {
    const P = this._plaster, W = this._paper;
    this._box(LX * 2, 0.2, LZ1 - LZ0, this._carpet, 0, LAND_Y - 0.1, (LZ0 + LZ1) / 2, { collide: false, ground: true });
    this._box(LX * 2 + 0.4, 0.2, LZ1 - LZ0 + 0.4, this._ceilMat, 0, CEIL + 0.1, (LZ0 + LZ1) / 2, { collide: false });

    // a wall from y LAND_Y to CEIL, with a dado: plaster below, the bedroom's paper above
    const wall = (w, d, x, z, y0 = LAND_Y, y1 = CEIL) => {
      const dado = Math.min(y1, LAND_Y + 1.0);
      if (dado > y0) this._box(w, dado - y0, d, P, x, (y0 + dado) / 2, z);
      if (y1 > dado) this._box(w, y1 - dado, d, W, x, (dado + y1) / 2, z);
    };
    // west wall (x −1.2): openings z −2.0..−1.0 (bathroom) and 0.4..1.4 (airing cupboard)
    wall(0.2, 1.0, -LX - 0.1, -2.5);
    wall(0.2, 1.4, -LX - 0.1, -0.3);
    wall(0.2, 1.3, -LX - 0.1, 2.05);
    this._box(0.2, CEIL - LAND_Y - 2.1, 1.0, W, -LX - 0.1, LAND_Y + 2.1 + (CEIL - LAND_Y - 2.1) / 2, -1.5);
    this._box(0.2, CEIL - LAND_Y - 2.1, 1.0, W, -LX - 0.1, LAND_Y + 2.1 + (CEIL - LAND_Y - 2.1) / 2, 0.9);
    // east wall (x +1.2): openings z −2.0..−1.0 (box room) and 0.1..1.1 (the child's door)
    wall(0.2, 1.0, LX + 0.1, -2.5);
    wall(0.2, 1.1, LX + 0.1, -0.45);
    wall(0.2, 1.6, LX + 0.1, 1.9);
    this._box(0.2, CEIL - LAND_Y - 2.1, 1.0, W, LX + 0.1, LAND_Y + 2.1 + (CEIL - LAND_Y - 2.1) / 2, -1.5);
    this._box(0.2, CEIL - LAND_Y - 2.1, 1.0, W, LX + 0.1, LAND_Y + 2.1 + (CEIL - LAND_Y - 2.1) / 2, 0.6);
    // north wall (z −3.0): her door x −1.0..0.0, the window x 0.0..0.6
    wall(0.2, 0.2, -1.1, LZ0 - 0.1);
    wall(0.6, 0.2, 0.9, LZ0 - 0.1);
    this._box(1.0, CEIL - LAND_Y - 2.1, 0.2, W, -0.5, LAND_Y + 2.1 + (CEIL - LAND_Y - 2.1) / 2, LZ0 - 0.1);
    this._box(0.6, 1.0, 0.2, P, 0.3, LAND_Y + 0.5, LZ0 - 0.1);                       // under the window
    this._box(0.6, CEIL - LAND_Y - 2.0, 0.2, W, 0.3, LAND_Y + 2.0 + (CEIL - LAND_Y - 2.0) / 2, LZ0 - 0.1);
    // south wall (z +2.7): the stairwell opening x −0.9..0.9
    wall(LX - FOOT_X, 0.2, -(FOOT_X + LX) / 2, LZ1 + 0.1);
    wall(LX - FOOT_X, 0.2, (FOOT_X + LX) / 2, LZ1 + 0.1);

    // the doors
    const mk = (key, x, z, ry, color, blocker) => {
      const d = this._door({ width: 0.95, color, frameColor: '#4c4034' });
      d.position.set(x, LAND_Y, z);
      d.rotation.y = ry;
      this.add(d);
      this._doorRecs[key] = { door: d, box: blocker, blocker: this.addBlocker(blocker[0], blocker[1]) };
      return d;
    };
    this._bathDoor = this._panelled(mk('bath', -LX, -1.5, Math.PI / 2, '#7d6a52',
      [[-1.35, LAND_Y, -2.0], [-1.05, LAND_Y + 2.2, -1.0]]), -1);
    this._airDoor = this._panelled(mk('air', -LX, 0.9, Math.PI / 2, '#7d6a52',
      [[-1.35, LAND_Y, 0.4], [-1.05, LAND_Y + 2.2, 1.4]]), -1);
    this._boxDoor = this._panelled(mk('box', LX, -1.5, -Math.PI / 2, '#7d6a52',
      [[1.05, LAND_Y, -2.0], [1.35, LAND_Y + 2.2, -1.0]]), -1);

    this._childDoor = this._door({ width: 0.95, color: '#5a4636', frameColor: '#4c4034' });
    this._childDoor.position.set(LX, LAND_Y, 0.6);
    this._childDoor.rotation.y = -Math.PI / 2;
    this._panelled(this._childDoor, -1);
    this.add(this._childDoor);
    this.addCollider(this._childDoor.panel);
    this._box(0.2, 2.2, 1.1, this._dark, 1.42, LAND_Y + 1.1, 0.6, { collide: false });

    this._herDoor = this._door({ width: 0.95, color: '#7d6a52', frameColor: '#4c4034' });
    this._herDoor.position.set(-0.5, LAND_Y, LZ0);
    this._panelled(this._herDoor);
    this.add(this._herDoor);
    this.addCollider(this._herDoor.panel);
    this._box(1.1, 2.2, 0.2, this._dark, -0.5, LAND_Y + 1.1, LZ0 - 0.32, { collide: false });

    // the fire plan, beside the airing cupboard door
    const plan = makeSign({ text: FIRE_PLAN, width: 0.4, height: 0.5, bg: '#d8cfba', color: '#33302a', font: 'italic 30px Georgia' });
    plan.position.set(-LX + 0.01, LAND_Y + 1.6, 1.75);
    plan.rotation.y = Math.PI / 2;
    this.add(plan);
    this.interact(plan, { prompt: 'the fire plan', onInteract: () => this.subtitle('do not run.', 3) });

    // the window: three panes, one per hour
    const wp = { x: 0.3, y: LAND_Y + 1.5, z: LZ0 + 0.01 };
    this._paneNight = this._plane(0.58, 0.98, new THREE.MeshStandardMaterial({ color: 0x0d1220, emissive: 0x1b2740, emissiveIntensity: 0.5 }), wp.x, wp.y, wp.z);
    this._paneEve = this._plane(0.58, 0.98, new THREE.MeshStandardMaterial({ color: 0x4a3324, emissive: 0xb2703a, emissiveIntensity: 0.7 }), wp.x, wp.y, wp.z);
    this._paneMorn = this._plane(0.58, 0.98, this._white, wp.x, wp.y, wp.z);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.0, 0.03), this._trim);
    bar.position.set(wp.x, wp.y, wp.z + 0.01); this.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.03), this._trim);
    bar2.position.set(wp.x, wp.y, wp.z + 0.01); this.add(bar2);

    // fireflies in the field beyond, at night only
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      pos[i * 3] = 0.3 + (Math.random() - 0.5) * 3.0;
      pos[i * 3 + 1] = LAND_Y + 0.6 + Math.random() * 1.6;
      pos[i * 3 + 2] = LZ0 - 0.6 - Math.random() * 4.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._fireflies = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8e8a0, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false }));
    this.add(this._fireflies);

    // the landing bulb — the evening's light
    this._landBulb = this._bulb({ color: 0xffd2a0, intensity: 0, distance: 9, y: LAND_Y + 2.4 });
    this._landBulb.position.set(0, 0, -0.2);
    this.add(this._landBulb);
    this._dimmable.push(this._landBulb.light);

    const dust = makeDust({ count: 90, size: 0.012, box: [2.2, 2.2, 5.0], center: [0, LAND_Y + 1.3, 0] });
    this.add(dust); this.track(dust);
  }

  // ---------- the bathroom (evening) ----------

  _buildBathroom() {
    const s = spec(), T = this._tile, from = this.root.children.length;
    const X0 = -3.6, X1 = -1.2, Z0 = -2.6, Z1 = -0.4;
    this._hourBox(s, X1 - X0, 0.2, Z1 - Z0, T, (X0 + X1) / 2, LAND_Y - 0.1, (Z0 + Z1) / 2, { collide: false, ground: true });
    this._hourBox(s, X1 - X0 + 0.4, 0.2, Z1 - Z0 + 0.4, this._ceilMat, (X0 + X1) / 2, CEIL + 0.1, (Z0 + Z1) / 2, { collide: false });
    this._hourBox(s, 0.2, CEIL - LAND_Y, Z1 - Z0 + 0.4, T, X0 - 0.1, (LAND_Y + CEIL) / 2, (Z0 + Z1) / 2);
    this._hourBox(s, X1 - X0, CEIL - LAND_Y, 0.2, T, (X0 + X1) / 2, (LAND_Y + CEIL) / 2, Z0 - 0.1);
    this._hourBox(s, X1 - X0, CEIL - LAND_Y, 0.2, T, (X0 + X1) / 2, (LAND_Y + CEIL) / 2, Z1 + 0.1);

    const enamel = new THREE.MeshStandardMaterial({ color: 0xe6e3da, roughness: 0.28 });
    const bath = this._hourBox(s, 0.7, 0.55, 1.6, enamel, X0 + 0.45, LAND_Y + 0.275, -1.5);
    bath.castShadow = true;
    // the water in it: dark, but not a hole — _dark reads as a void here
    const water = new THREE.MeshStandardMaterial({ color: 0x76858f, roughness: 0.55, metalness: 0 });
    this._hourBox(s, 0.5, 0.06, 1.4, water, X0 + 0.45, LAND_Y + 0.53, -1.5, { collide: false });
    this._hourBox(s, 0.45, 0.18, 0.6, enamel, X0 + 0.32, LAND_Y + 0.86, -0.85);       // the basin
    this._hourBox(s, 0.1, 0.75, 0.1, enamel, X0 + 0.32, LAND_Y + 0.38, -0.85, { collide: false });

    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.2, metalness: 0.4 }));
    mirror.position.set(X0 + 0.02, LAND_Y + 1.55, -0.85); mirror.rotation.y = Math.PI / 2;
    this.add(mirror); s.objects.push(mirror);
    this._cloth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.58), new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.95 }));
    this._cloth.position.set(X0 + 0.06, LAND_Y + 1.55, -0.85);
    this._cloth.castShadow = true;
    this.add(this._cloth); s.objects.push(this._cloth); s.interact.push(this._cloth);

    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), this._railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(-3.3, LAND_Y + 1.1, -1.0);
    this.add(rail); s.objects.push(rail);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.3), new THREE.MeshStandardMaterial({ color: 0xd6cdbc, roughness: 0.95 }));
    towel.position.set(-3.3, LAND_Y + 0.86, -1.28);
    this.add(towel); s.objects.push(towel);
    this._ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: 0x4a6aa8, roughness: 0.8, emissive: 0x16233d, emissiveIntensity: 0.6 }));
    this._ribbon.position.set(-3.3, LAND_Y + 1.07, -0.88);      // over the rail
    this.add(this._ribbon); s.objects.push(this._ribbon); s.interact.push(this._ribbon);

    const bulb = this._bulb({ color: 0xffd2a0, intensity: 0, distance: 5, y: LAND_Y + 2.3 });
    bulb.position.set(-2.4, 0, -1.4);
    this.add(bulb); s.objects.push(bulb);
    s.lights.push({ light: bulb.light, intensity: 2.2 });
    this._dimmable.push(bulb.light);
    // the tap is quiet — 0.15, under the boiler and the wireless — and the
    // hours' own loop table has nowhere to put a gain, so it is run by hand
    const tapPos = { x: -3.3, y: LAND_Y + 0.6, z: -2.2 };
    s.onEnter = () => { this._tapLoop = this.loopAt('tap', tapPos); this._tapLoop.setGain(0.15); };
    s.onLeave = () => { this._tapLoop?.stop(0.6); this._tapLoop = null; };

    this._pack(s, from, 'evening', 'bath', [-3.7, -1.2, -2.7, -0.3]);
    this.hours.bind('evening', s);
    // at the morning the doorway is white, and stopped
    const m = spec();
    const pane = this._plane(0.98, 2.06, this._white, -1.42, LAND_Y + 1.03, -1.5, { y: Math.PI / 2 });
    m.objects.push(pane);
    m.blockers.push([[-1.5, LAND_Y, -2.05], [-1.3, LAND_Y + 2.2, -0.95]]);
    this.hours.bind('morning', m);
  }

  // ---------- the airing cupboard (evening) ----------

  _buildCupboard() {
    const s = spec(), from = this.root.children.length;
    const X0 = -2.6, X1 = -1.2, Z0 = 0.3, Z1 = 1.5;
    this._hourBox(s, X1 - X0, 0.2, Z1 - Z0, this._plaster, (X0 + X1) / 2, LAND_Y - 0.1, (Z0 + Z1) / 2, { collide: false, ground: true });
    this._hourBox(s, X1 - X0 + 0.4, 0.2, Z1 - Z0 + 0.4, this._ceilMat, (X0 + X1) / 2, CEIL + 0.1, (Z0 + Z1) / 2, { collide: false });
    this._hourBox(s, 0.2, CEIL - LAND_Y, Z1 - Z0 + 0.4, this._plaster, X0 - 0.1, (LAND_Y + CEIL) / 2, (Z0 + Z1) / 2);
    this._hourBox(s, X1 - X0, CEIL - LAND_Y, 0.2, this._plaster, (X0 + X1) / 2, (LAND_Y + CEIL) / 2, Z0 - 0.1);
    this._hourBox(s, X1 - X0, CEIL - LAND_Y, 0.2, this._plaster, (X0 + X1) / 2, (LAND_Y + CEIL) / 2, Z1 + 0.1);

    const copper = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.5, metalness: 0.35 });
    this._boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 14), copper);
    this._boiler.position.set(-2.15, LAND_Y + 0.55, 0.9);
    this._boiler.castShadow = true;
    this.add(this._boiler); s.objects.push(this._boiler); s.colliders.push(this._boiler); s.interact.push(this._boiler);
    for (let k = 0; k < 3; k++) {
      const slat = this._hourBox(s, 1.3, 0.03, 0.36, this._trim, -1.9, LAND_Y + 1.35 + k * 0.32, 1.25, { collide: false });
      slat.receiveShadow = true;
      const towels = this._hourBox(s, 0.9, 0.18, 0.3, new THREE.MeshStandardMaterial({ color: 0xd9d0bd, roughness: 0.95 }), -1.9, LAND_Y + 1.45 + k * 0.32, 1.25, { collide: false });
      towels.castShadow = true;
    }
    const bulb = this._bulb({ color: 0xffd2a0, intensity: 0, distance: 3.6, y: LAND_Y + 2.2 });
    bulb.position.set(-1.9, 0, 0.9);
    this.add(bulb); s.objects.push(bulb);
    s.lights.push({ light: bulb.light, intensity: 1.6 });
    this._dimmable.push(bulb.light);
    s.loops.push({ kind: 'boiler', position: { x: -2.0, y: LAND_Y + 0.8, z: 0.9 }, opts: {} });
    this._pack(s, from, 'evening', 'air', [-2.7, -1.2, 0.2, 1.6]);
    this.hours.bind('evening', s);
  }

  // ---------- the box room (evening) ----------

  _buildBoxRoom() {
    const s = spec(), from = this.root.children.length;
    const X0 = 1.2, X1 = 4.2, Z0 = -3.0, Z1 = 0.0;
    this._hourBox(s, X1 - X0, 0.2, Z1 - Z0, this._carpet, (X0 + X1) / 2, LAND_Y - 0.1, (Z0 + Z1) / 2, { collide: false, ground: true });
    this._hourBox(s, X1 - X0 + 0.4, 0.2, Z1 - Z0 + 0.4, this._ceilMat, (X0 + X1) / 2, CEIL + 0.1, (Z0 + Z1) / 2, { collide: false });
    this._hourBox(s, 0.2, CEIL - LAND_Y, Z1 - Z0 + 0.4, this._paper, X1 + 0.1, (LAND_Y + CEIL) / 2, (Z0 + Z1) / 2);
    this._hourBox(s, X1 - X0, CEIL - LAND_Y, 0.2, this._paper, (X0 + X1) / 2, (LAND_Y + CEIL) / 2, Z0 - 0.1);
    this._hourBox(s, X1 - X0, CEIL - LAND_Y, 0.2, this._paper, (X0 + X1) / 2, (LAND_Y + CEIL) / 2, Z1 + 0.1);

    // a cot frame, stripped
    for (const sz of [-1, 1]) {
      this._hourBox(s, 0.7, 0.6, 0.05, this._trim, 3.6, LAND_Y + 0.3, -2.5 + sz * 0.62, { collide: false });
    }
    this._hourBox(s, 0.66, 0.06, 1.2, this._trim, 3.6, LAND_Y + 0.3, -2.5);
    // the trunk, and the box on it
    const trunk = this._hourBox(s, 0.9, 0.5, 0.5, this._wood, 2.7, LAND_Y + 0.25, -1.6);
    trunk.castShadow = true;
    this._theBox = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), this._card);
    body.position.y = 0.175; body.castShadow = body.receiveShadow = true;
    for (const [w, d, x, z] of [[0.5, 0.02, 0, -0.2], [0.5, 0.02, 0, 0.2], [0.02, 0.4, -0.25, 0], [0.02, 0.4, 0.25, 0]]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), this._card);
      flap.position.set(x, 0.42, z);
      flap.rotation.x = z ? Math.sign(z) * 0.5 : 0;
      flap.rotation.z = x ? -Math.sign(x) * 0.5 : 0;
      this._theBox.add(flap);
    }
    this._labelTex = this._scribbleLabel();
    this._label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ map: this._labelTex, roughness: 0.9 }));
    this._label.position.set(0, 0.2, 0.201);
    this._theBox.add(body, this._label);
    this._theBox.position.set(2.7, LAND_Y + 0.5, -1.6);
    this.add(this._theBox);
    s.objects.push(this._theBox); s.interact.push(this._theBox); s.interact.push(this._label);

    this._photoIn = makePictureFrame({ texture: blurredPhotoTexture({ figures: 2 }), width: 0.2, height: 0.15 });
    // the three things lie in the open box, on top of what is already in it
    this._photoIn.position.set(-0.11, 0.375, 0.03); this._photoIn.rotation.x = -Math.PI / 2.1;
    this._ribbonIn = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.26), this._ribbon ? this._ribbon.material : new THREE.MeshStandardMaterial({ color: 0x4a6aa8 }));
    this._ribbonIn.position.set(0.13, 0.37, -0.08);
    this._keyIn = makeKeyProp();
    this._keyIn.position.set(0.09, 0.365, 0.11);
    for (const o of [this._photoIn, this._ribbonIn, this._keyIn]) { o.visible = false; this._theBox.add(o); }

    const bulb = this._bulb({ color: 0xffd2a0, intensity: 0, distance: 7, y: LAND_Y + 2.3 });
    bulb.position.set(2.6, 0, -1.5);
    this.add(bulb); s.objects.push(bulb);
    s.lights.push({ light: bulb.light, intensity: 2.6 });
    this._dimmable.push(bulb.light);
    this._pack(s, from, 'evening', 'box', [1.2, 4.3, -3.1, 0.1]);
    this.hours.bind('evening', s);

    const m = spec();
    const pane = this._plane(0.98, 2.06, this._white, 1.42, LAND_Y + 1.03, -1.5, { y: -Math.PI / 2 });
    m.objects.push(pane);
    m.blockers.push([[1.3, LAND_Y, -2.05], [1.5, LAND_Y + 2.2, -0.95]]);
    this.hours.bind('morning', m);
  }

  /** One scribbled cursive word on a gummed label, struck through 0/1/2 times. */
  _scribbleLabel() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const draw = ({ strikes = 0 } = {}) => {
      ctx.fillStyle = '#d9cfbd';
      ctx.fillRect(0, 0, 256, 96);
      ctx.strokeStyle = '#3a332c';
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      let x = 42;
      ctx.moveTo(x, 58);
      for (let i = 0; i < 24; i++) {
        const y = 58 + Math.sin(i * 1.7) * 11 - Math.sin(i * 0.42) * 6;
        x += 6.6;
        ctx.quadraticCurveTo(x - 3.5, y - (i % 3 ? 4 : 17), x, y);
      }
      ctx.stroke();
      ctx.lineWidth = 4;
      for (let s = 0; s < strikes; s++) {
        ctx.beginPath();
        ctx.moveTo(28, 50 + s * 9);
        ctx.lineTo(228, 60 - s * 7);
        ctx.stroke();
      }
      tex.needsUpdate = true;
    };
    draw();
    tex.redraw = draw;
    return tex;
  }

  // ---------- the archive (morning) ----------

  _buildArchive() {
    const s = spec(), from = this.root.children.length;
    const X0 = -6.2, X1 = -1.2, Z0 = -1.0, Z1 = 2.0;
    // The archive stands over the shaft: its floor spans the whole of the L0
    // south flight. The ground raycast does not look at object.visible, so
    // registered once and for good it is what you stand on at 3:07 too — over
    // the flight, on nothing, all the way to the west wall. So it is ground at
    // every hour but that one. The evening keeps it because nothing can reach
    // out here then anyway, and a floor is a kinder thing to cross an hour on
    // than a shaft that is not being drawn.
    const floor = this._hourBox(s, X1 - X0, 0.2, Z1 - Z0, this._flat(makeMat('checker', { a: '#b9b2a2', b: '#8e897d', repeat: [4, 3] })), (X0 + X1) / 2, LAND_Y - 0.1, (Z0 + Z1) / 2, { collide: false });
    this._hourGround(floor, ['morning', 'evening']);
    this._hourBox(s, X1 - X0 + 0.4, 0.2, Z1 - Z0 + 0.4, this._ceilMat, (X0 + X1) / 2, CEIL + 0.1, (Z0 + Z1) / 2, { collide: false });
    this._hourBox(s, 0.2, CEIL - LAND_Y, Z1 - Z0 + 0.4, this._plaster, X0 - 0.1, (LAND_Y + CEIL) / 2, (Z0 + Z1) / 2);
    this._hourBox(s, X1 - X0, CEIL - LAND_Y, 0.2, this._plaster, (X0 + X1) / 2, (LAND_Y + CEIL) / 2, Z0 - 0.1);
    this._hourBox(s, X1 - X0, CEIL - LAND_Y, 0.2, this._plaster, (X0 + X1) / 2, (LAND_Y + CEIL) / 2, Z1 + 0.1);

    // four shelves, two on each long wall, and eight boxes on them
    const shelfMat = this._flat(makeMat('wood', { base: '#5a4630', repeat: [1, 2] }));
    const shelfAt = (x, z, ry) => {
      const sh = makeShelf({ w: 0.9, h: 1.8, d: 0.3, mat: shelfMat });
      sh.position.set(x, LAND_Y, z); sh.rotation.y = ry;
      this.add(sh); s.objects.push(sh); s.colliders.push(sh);
      return sh;
    };
    shelfAt(-5.5, Z1 - 0.16, Math.PI); shelfAt(-4.3, Z1 - 0.16, Math.PI);
    shelfAt(-5.5, Z0 + 0.16, 0); shelfAt(-4.3, Z0 + 0.16, 0);

    // makeShelf's plates sit at 0.05 + i·0.425 above its base; the boxes stand
    // on the third one, centred on the carcass so none of them overhangs
    const SY = LAND_Y + 0.49, NZ = Z1 - 0.16, SZ = Z0 + 0.16;
    const slots = [
      [-5.72, SY, NZ, Math.PI], [-5.28, SY, NZ, Math.PI],
      [-4.52, SY, NZ, Math.PI], [-4.08, SY, NZ, Math.PI],
      [-5.72, SY, SZ, 0], [-5.28, SY, SZ, 0],
      [-4.52, SY, SZ, 0], [-4.08, SY, SZ, 0],
    ];
    const labels = ['the hallway', 'the pool', 'the street', 'the supermarket', 'the house', 'the field', 'the platform', 'the theater'];
    labels.forEach((label, i) => {
      const [x, y, z, ry] = slots[i];
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.26), this._card);
      body.position.y = 0.1; body.castShadow = body.receiveShadow = true;
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.09),
        new THREE.MeshStandardMaterial({ map: textTexture({ text: label, font: 'italic 30px Georgia', color: '#3a332c', bg: '#d9cfbd', width: 320, height: 110 }), roughness: 0.9 }));
      lab.position.set(0, 0.1, 0.131);
      const lid = new THREE.Group();
      lid.position.set(0, 0.2, -0.13);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.012, 0.26), this._card);
      leaf.position.z = 0.13; leaf.castShadow = true;
      lid.add(leaf);
      g.add(body, lab, lid);
      g.position.set(x, y, z); g.rotation.y = ry;
      this.add(g);
      s.objects.push(g); s.colliders.push(g); s.interact.push(g);
      this._boxes[label] = { mesh: g, lid, open: false };
    });

    // the reading table, the green lamp, the in-tray
    const table = makeTable({ w: 1.3, d: 0.7, mat: shelfMat });
    table.position.set(-3.7, LAND_Y, 1.0);
    this.add(table); s.objects.push(table); s.colliders.push(table);
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.16, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f5b3f, roughness: 0.6, side: THREE.DoubleSide }));
    lamp.position.set(-4.1, LAND_Y + 0.95, 1.0);
    this.add(lamp); s.objects.push(lamp);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.2, 8), this._railMat);
    stem.position.set(-4.1, LAND_Y + 0.84, 1.0);
    this.add(stem); s.objects.push(stem);

    this._trayMesh = new THREE.Group();
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.22), new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.5, metalness: 0.3 }));
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.17), new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.9, emissive: 0xfff8e0, emissiveIntensity: 0.12 }));
    paper.position.y = 0.05;
    this._trayMesh.add(tray, paper);
    this._trayMesh.position.set(-3.4, LAND_Y + 0.80, 1.1);
    this.add(this._trayMesh);
    s.objects.push(this._trayMesh); s.interact.push(this._trayMesh);

    // what two of the boxes hold, lying in the open lid
    this._keyArch = makeKeyProp();
    this._keyArch.position.set(-5.72, SY + 0.215, NZ - 0.03);
    this._keyArch.visible = false;
    this.add(this._keyArch);
    this._photoArch = makePictureFrame({ texture: blurredPhotoTexture({ figures: 2 }), width: 0.2, height: 0.15 });
    this._photoArch.position.set(-5.72, SY + 0.29, SZ + 0.02);
    this._photoArch.rotation.x = -0.4;
    this._photoArch.visible = false;
    this.add(this._photoArch);

    this._morningBox(s, 'ARCHIVE — 1 of 6', -3.6, LAND_Y, -0.5, () => this.subtitle('Paper, and more paper, and a smell you know.', 4));
    for (const [x, z] of [[-2.4, 1.6], [-4.9, 1.6]]) {
      const sheet = this._hourBox(s, 0.9, 0.02, 0.9, new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.98 }), x, LAND_Y + 0.62, z, { collide: false });
      sheet.receiveShadow = true;
      this._hourBox(s, 0.8, 0.6, 0.8, new THREE.MeshStandardMaterial({ color: 0xc4bdb0, roughness: 0.98 }), x, LAND_Y + 0.31, z);
    }
    this._pack(s, from, 'morning', 'air', [-6.3, -1.2, -1.1, 2.1]);
    this.hours.bind('morning', s);

    // and what the morning leaves on the landing itself, outside that door
    const m = spec();
    this._morningBox(m, 'LANDING — van', 0.62, LAND_Y, 1.9, () => this.subtitle('The lamp from the landing, its shade crushed.', 4));
    this._morningBox(m, 'STAIRS — keep', -0.62, LAND_Y, 2.0, () => this.subtitle('Books, and the runner off the stairs, rolled and tied.', 4));
    const sheet = this._hourBox(m, 0.5, 0.02, 0.62, new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.98 }), -0.78, LAND_Y + 0.92, -2.35, { collide: false });
    sheet.receiveShadow = true;
    this._hourBox(m, 0.42, 0.9, 0.54, new THREE.MeshStandardMaterial({ color: 0xc4bdb0, roughness: 0.98 }), -0.78, LAND_Y + 0.46, -2.35);
    this.hours.bind('morning', m);
  }

  // ---------- the shaft (night) ----------

  /** Merge a list of geometries into one, so a flight of stairs is one draw. */
  _merge(geos) {
    let total = 0, tri = 0;
    for (const g of geos) { total += g.attributes.position.count; tri += g.index.count; }
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const idx = new Uint32Array(tri);
    let vo = 0, io = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      io += gi.length;
      vo += g.attributes.position.count;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }

  /**
   * One flight: eight treads, merged. Steps are never colliders — every one of
   * them is 0.17 m high and the player steps over anything under 0.55 — so the
   * flight only has to be ground, and one mesh can be.
   */
  _flight(x0, y0, dx, dz, z) {
    const geos = [];
    for (let k = 0; k < STEPS; k++) {
      const g = new THREE.BoxGeometry(RUN, TREAD, dz);
      g.translate(x0 + dx * (k + 0.5), y0 - RISE * (k + 1) - TREAD / 2, z);
      geos.push(g);
    }
    const m = new THREE.Mesh(this._merge(geos), this._stepMat);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /** A sloped handrail and its balusters, merged into one mesh. */
  _railMesh(xa, ya, xb, yb, z) {
    const len = Math.hypot(xb - xa, yb - ya) + 0.1;
    const rail = new THREE.BoxGeometry(len, 0.05, 0.05);
    rail.rotateZ(Math.atan2(yb - ya, xb - xa));
    rail.translate((xa + xb) / 2, (ya + yb) / 2 + 0.95, z);
    const geos = [rail];
    for (let k = 0; k <= 3; k++) {
      const f = k / 3;
      const stay = new THREE.BoxGeometry(0.035, 0.95, 0.035);
      stay.translate(xa + (xb - xa) * f, ya + (yb - ya) * f + 0.475, z);
      geos.push(stay);
    }
    return new THREE.Mesh(this._merge(geos), this._railMat);
  }

  _buildShaft() {
    const s = spec();
    this._nightSpec = s;
    const concrete = this._concrete, floorMat = this._shaftFloor;
    const shell = new THREE.Group();
    this.add(shell);
    s.objects.push(shell);
    this._shaftShell = shell;
    const boxIn = (parent, w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) => {
      const m = makeWall(w, h, d, mat);
      m.position.set(x, y, z);
      parent.add(m);
      if (collide) s.colliders.push(m);
      if (ground) this.addGround(m);
      return m;
    };

    this._fireDoors = {};
    this._floorGroups = [];
    this._path = [];                                            // the stair path, top to bottom
    this._planMat = new THREE.MeshStandardMaterial({
      map: textTexture({ text: FIRE_PLAN, width: 512, height: 640, font: 'italic 30px Georgia', color: '#33302a', bg: '#d8cfba' }),
      roughness: 0.85,
    });

    // ---- the shell: three outer walls, a ceiling, and the house side ----
    const H = SHAFT_TOP - SHAFT_BOT, MID = (SHAFT_TOP + SHAFT_BOT) / 2;
    boxIn(shell, 0.2, H, ZD + 0.4, concrete, HALF.x0 - 0.1, MID, ZC);                                   // west
    boxIn(shell, MAIN.x1 - HALF.x0 + 0.4, H, 0.2, concrete, (HALF.x0 + MAIN.x1) / 2, MID, ZS.s0 - 0.1); // south
    boxIn(shell, 5.15, H, 0.2, concrete, -5.425, MID, ZS.n1 + 0.1);                                     // north, west of the wardrobe
    boxIn(shell, 0.75, H, 0.2, concrete, -1.375, MID, ZS.n1 + 0.1);                                     // north, east of it
    boxIn(shell, 1.1, LAND_Y - SHAFT_BOT, 0.2, concrete, -2.3, (SHAFT_BOT + LAND_Y) / 2, ZS.n1 + 0.1);
    boxIn(shell, 1.1, SHAFT_TOP - (LAND_Y + 2.1), 0.2, concrete, -2.3, (LAND_Y + 2.1 + SHAFT_TOP) / 2, ZS.n1 + 0.1);
    boxIn(shell, MAIN.x1 - HALF.x0 + 0.4, 0.2, ZD + 0.4, concrete, (HALF.x0 + MAIN.x1) / 2, SHAFT_TOP + 0.1, ZC, { collide: false });
    for (const [z0, z1] of [[ZS.s0, ZC - 0.5], [ZC + 0.5, ZS.n1]]) {
      boxIn(shell, 0.2, LAND_Y - SHAFT_BOT, z1 - z0, concrete, MAIN.x1 - 0.1, (SHAFT_BOT + LAND_Y) / 2, (z0 + z1) / 2);
    }
    for (let f = 1; f <= 5; f++) {                              // a lintel between each pair of doorways
      const y = LANDINGS[f][1];
      boxIn(shell, 0.2, FLOOR_H - 2.1, 1.0, concrete, MAIN.x1 - 0.1, y + 2.1 + (FLOOR_H - 2.1) / 2, ZC);
    }
    boxIn(shell, 0.2, LANDINGS[5][1] - SHAFT_BOT, 1.0, concrete, MAIN.x1 - 0.1, (SHAFT_BOT + LANDINGS[5][1]) / 2, ZC);
    // the bottom: a slab where L6 would be, and a sheet across the flight the
    // loop fires on, for after the loop is switched off
    boxIn(shell, MAIN.x1 - MAIN.x0, 0.2, ZD, floorMat, MAIN_CX, LANDINGS[5][1] - FLOOR_H - 0.1, ZC, { ground: true });
    this._shaftBlockers.push(this.addBlocker([-4.9, LOOP_FOOT - 1.8, ZS.n0 - 0.05], [-4.7, LOOP_FOOT + 2.4, ZS.n1 + 0.05]));
    // you cannot step across the well between the two flights
    s.blockers.push([[FLIGHT.x0, SHAFT_BOT, ZS.s1 - 0.07], [FLIGHT.x1, SHAFT_TOP, ZS.s1 + 0.07]]);

    // ---- six floors ----
    for (let f = 0; f < 6; f++) {
      const y = LANDINGS[f][1], yh = y - 1.36;
      const fg = new THREE.Group();
      this.add(fg);
      this._floorGroups.push(fg);
      s.objects.push(fg);

      boxIn(fg, MAIN.x1 - MAIN.x0, 0.2, ZD, floorMat, MAIN_CX, y - 0.1, ZC, { ground: true });
      boxIn(fg, HALF.x1 - HALF.x0, 0.2, ZD, floorMat, HALF_CX, yh - 0.1, ZC, { ground: true });
      const south = this._flight(FLIGHT.x1, y, -RUN, ZS.s1 - ZS.s0, Z_SOUTH);
      const north = this._flight(FLIGHT.x0, yh, RUN, ZS.n1 - ZS.n0, Z_NORTH);
      fg.add(south, north);
      this.addGround(south); this.addGround(north);
      boxIn(fg, FLIGHT.x1 - FLIGHT.x0, FLOOR_H, 0.12, floorMat, (FLIGHT.x0 + FLIGHT.x1) / 2, y - FLOOR_H / 2, ZS.s1, { collide: false });
      fg.add(this._railMesh(FLIGHT.x1, y, FLIGHT.x0, yh, ZS.s0 + 0.1));
      fg.add(this._railMesh(FLIGHT.x0, yh, FLIGHT.x1, y - FLOOR_H, ZS.n1 - 0.1));

      const sign = makeSign({ text: LANDINGS[f][0], width: 0.5, height: 0.5, bg: '#4a4844', color: '#d9d4c8', font: 'bold 160px Georgia' });
      // L0's north wall is where the wardrobe's back is, so its number moves
      // along to the piece of wall beside the opening
      sign.position.set(f === 0 ? -1.42 : MAIN_CX, y + 1.5, ZS.n1 - 0.005);
      sign.rotation.y = Math.PI;
      fg.add(sign);
      const plan = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), this._planMat);
      plan.position.set(MAIN.x1 - 0.205, y + 1.6, ZC - 0.85);
      plan.rotation.y = -Math.PI / 2;
      fg.add(plan);

      // The bulbs hang off the spine's plane, one to each side of it: a bulb
      // at z = ZC is coplanar with the wall between the flights and lights
      // neither of its faces, which left that wall reading as a hole.
      const bulb = this._bulb({ color: 0xd8dcd0, intensity: 0, distance: 11, y: y + 2.45 });
      bulb.position.set(MAIN_CX, 0, ZC - 0.45);
      fg.add(bulb);
      s.lights.push({ light: bulb.light, intensity: 3.2 });
      const rec = { light: bulb.light, x: MAIN_CX, y: y + 2.3, z: ZC - 0.45, radius: 6.6 };
      this._shaftBulbs.push(rec);
      if (f === 2) this._flick = { rec, base: 3.2, next: 0, on: true };   // G's bulb is the one that stutters
      if (f === 3) {
        // −1's bulb is the shaft's one shadow-caster, as XII's is. A point
        // light draws the scene six times over for its cube map, which is a
        // fifth of the frame in this room, so the map is small and the budget
        // below only asks for it while the child is standing on this landing —
        // the only thing down here that a shadow is ever about.
        this._shadowBulb = rec;
        bulb.light.shadow.mapSize.set(256, 256);
        bulb.light.shadow.bias = -0.004;
        bulb.light.shadow.normalBias = 0.04;
      }
      const hb = this._bulb({ color: 0xd8dcd0, intensity: 0, distance: 10, y: yh + 2.45 });
      hb.position.set(HALF_CX, 0, ZC + 0.45);
      fg.add(hb);
      s.lights.push({ light: hb.light, intensity: 2.4 });
      this._shaftBulbs.push({ light: hb.light, x: HALF_CX, y: yh + 2.3, z: ZC + 0.45, radius: 6.6 });

      if (f >= 1) {
        const door = this._door({ width: 0.95, color: '#8f979b', frameColor: '#4b5356' });
        door.position.set(MAIN.x1, y, ZC);
        door.rotation.y = -Math.PI / 2;                       // in the house-side wall, swinging east
        fg.add(door);
        s.interact.push(door);
        this._fireDoors[f] = door;
        this._stubBlockers[f] = this.addBlocker([MAIN.x1 - 0.1, y, ZC - 0.5], [MAIN.x1 + 0.1, y + 2.2, ZC + 0.5]);
        if (f >= 3) this._buildStub(f, y, s, fg, boxIn);
        else boxIn(fg, 0.5, 2.4, 1.4, this._dark, MAIN.x1 + 0.35, y + 1.2, ZC, { collide: false });
      }

      this._path.push(
        new THREE.Vector3(MAIN_CX, y, Z_SOUTH),
        new THREE.Vector3(FLIGHT.x1, y, Z_SOUTH),
        new THREE.Vector3(FLIGHT.x0, yh, Z_SOUTH),
        new THREE.Vector3(FLIGHT.x0, yh, Z_NORTH),
        new THREE.Vector3(FLIGHT.x1, y - FLOOR_H, Z_NORTH),
        new THREE.Vector3(MAIN_CX, y - FLOOR_H, Z_NORTH),
      );
    }

    // the chalk on L4's south wall
    this._chalk = chalkTexture({ tally: 0, lines: [] });
    this._chalkPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshStandardMaterial({ map: this._chalk, roughness: 1 }));
    this._chalkPlane.position.set(MAIN_CX, LANDINGS[4][1] + 1.2, ZS.s0 + 0.005);
    this._floorGroups[4].add(this._chalkPlane);
    s.interact.push(this._chalkPlane);

    // the wardrobe's back on L0's north wall, and the stub beyond it
    this._wardrobeBack = this._door({ width: 1.0, color: '#917759', frameColor: '#4b5356', knob: false });
    this._wardrobeBack.position.set(MAIN_CX, LAND_Y, ZS.n1);
    this._wardrobeBack.rotation.y = Math.PI;
    shell.add(this._wardrobeBack);
    s.interact.push(this._wardrobeBack);
    this._wbBlocker = this.addBlocker([MAIN_CX - 0.55, LAND_Y, ZS.n1 - 0.1], [MAIN_CX + 0.55, LAND_Y + 2.2, ZS.n1 + 0.1]);
    boxIn(shell, 1.0, 0.2, 1.6, floorMat, -2.3, LAND_Y - 0.1, 3.0, { collide: false, ground: true });
    boxIn(shell, 0.2, 2.4, 1.8, concrete, -2.9, LAND_Y + 1.2, 3.0);
    boxIn(shell, 0.2, 2.4, 1.8, concrete, -1.7, LAND_Y + 1.2, 3.0);
    boxIn(shell, 1.4, 2.4, 0.2, this._dark, -2.3, LAND_Y + 1.2, 3.9);
    boxIn(shell, 1.4, 0.2, 1.8, concrete, -2.3, LAND_Y + 2.5, 3.0, { collide: false });
    const wbLight = new THREE.PointLight(0x9aa6bd, 0, 4.5, 1.8);
    wbLight.position.set(-2.3, LAND_Y + 1.9, 3.15);
    shell.add(wbLight);
    s.lights.push({ light: wbLight, intensity: 1.6 });
    this._dimmable.push(wbLight);

    // the child, above
    this._wMesh = makeChild();
    // makeChild leaves a gap between the shoulders and the head; from a flight
    // below, at the one moment the room shows it, that reads as a floating
    // head. A neck of the same grey closes it. (presence.js is shared and is
    // not this room's to change — noted in the hand-back.)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a8c80, roughness: 0.9 }));
    neck.position.y = 0.80;
    neck.castShadow = true;
    this._wMesh.add(neck);
    this._wMesh.position.set(MAIN_CX, LANDINGS[5][1], Z_SOUTH);
    this._wMesh.visible = false;
    this._wMesh.torch.visible = false;                          // this one carries no torch
    this.add(this._wMesh);
    s.objects.push(this._wMesh);

    this.hours.bind('night', s);

    this._floorLen = 0;
    for (let i = 0; i < 6; i++) this._floorLen += this._path[i].distanceTo(this._path[i + 1]);

    // Six floors of stair is six times more room than can ever be in shot, the
    // fog closes at fourteen metres, and from the stair hall the shaft is
    // behind a shut cupboard door — so the shaft is only drawn from inside it
    // or from the landing, a floor at a time, and the house is only drawn
    // while the player is somewhere near its own floor.
    this.tick(() => {
      const p = this.game.player.position, fy = p.y - 1.62;
      this._house.visible = fy > LAND_Y - 3.2;
      const near = this.hours.is('night') && (p.x < -1.3
        || (this._doorRecs.air.door.isOpen() && p.z < 3.1 && fy < LAND_Y + 0.6));
      this._shaftShell.visible = near;
      if (this._hemiShaft) this._hemiShaft.visible = near && this._hemiShaft.intensity > 0.02;
      for (let f = 0; f < 6; f++) this._floorGroups[f].visible = near && Math.abs(LANDINGS[f][1] - fy) < 5.0;
    });
  }

  /** Behind a fire door: a corridor east under the house, lockers, a light on a cord. */
  _buildStub(f, y, s, fg, boxIn) {
    boxIn(fg, 5.0, 0.2, 1.4, this._shaftFloor, 1.3, y - 0.1, 0.9, { collide: false, ground: true });
    boxIn(fg, 5.0, 2.6, 0.2, this._concrete, 1.3, y + 1.3, 0.1);
    boxIn(fg, 5.0, 2.6, 0.2, this._concrete, 1.3, y + 1.3, 1.7);
    boxIn(fg, 0.2, 2.6, 1.8, this._concrete, 3.9, y + 1.3, 0.9);
    boxIn(fg, 5.0, 0.2, 1.8, this._concrete, 1.3, y + 2.7, 0.9, { collide: false });
    const locker = new THREE.MeshStandardMaterial({ color: 0x79817f, roughness: 0.6, metalness: 0.2 });
    for (let k = 0; k < 4; k++) boxIn(fg, 0.36, 1.7, 0.4, locker, 0.1 + k * 0.42, y + 0.85, 0.42);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a8, emissiveIntensity: 0 }));
    plane.position.set(3.5, y + 2.55, 0.9); plane.rotation.x = Math.PI / 2;
    fg.add(plane);
    const light = new THREE.PointLight(0xffd9a8, 0, 7, 1.8);
    light.position.set(3.5, y + 2.3, 0.9);
    fg.add(light);
    this._dimmable.push(light);
    const cord = new THREE.Group();
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0xd9d4c8 }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe6e0d0, roughness: 0.7 }));
    knob.position.y = -0.47;
    cord.add(line, knob);
    cord.position.set(3.3, y + 1.6, 0.9);
    fg.add(cord);
    s.interact.push(cord);
    this._stub[f] = { light, plane, cord, on: false, y };
  }

  /**
   * A room at three hours carries three rooms' worth of lights, and every one
   * of them costs the fragment shader whether it is lit or not. Two rules keep
   * the count down to what XII runs at: a light with no intensity is switched
   * off entirely, and a caged bulb in the shaft is only switched on while the
   * player is near enough for it to reach them.
   */
  _wireLightBudget() {
    for (const g of this._shaftBulbs) g.light.visible = false;
    this.tick(() => {
      const p = this.game.player.position;
      for (const r of this._rooms) {
        const inside = p.x > r.box[0] && p.x < r.box[1] && p.z > r.box[2] && p.z < r.box[3];
        r.group.visible = this.hours.is(r.hour) && (this._doorRecs[r.rec].door.isOpen() || inside);
      }
      for (const l of this._dimmable) {
        l.visible = l.intensity > 0.02;
        if (l.userData.glow) l.userData.glow.material.emissiveIntensity = l.visible ? 3.5 : 0;
      }
      for (const g of this._shaftBulbs) {
        const want = g.light.intensity > 0.02 && Math.hypot(p.x - g.x, p.y - g.y, p.z - g.z) < g.radius;
        g.light.visible = want;
        if (g.light.userData.glow) g.light.userData.glow.material.emissiveIntensity = g.light.intensity > 0.02 ? 3.5 : 0;
      }
      const sb = this._shadowBulb, w = this._wMesh;
      sb.light.castShadow = sb.light.visible && w.visible && Math.abs(w.position.y - LANDINGS[3][1]) < 1.5;
    });

    // G's bulb stutters. It rides on top of the budget above, so the glass
    // goes dim with the light, and it keeps off the hours' crossfade, which
    // owns this intensity while it is running.
    this.tick((dt, t) => {
      const f = this._flick;
      if (!this.hours.is('night') || this.hours.changing) return;
      if (t >= f.next) {
        f.on = Math.random() > 0.28;
        f.next = t + (f.on ? 0.15 + Math.random() * 1.8 : 0.04 + Math.random() * 0.14);
      }
      f.rec.light.intensity = f.on ? f.base : f.base * 0.12;
      const glow = f.rec.light.userData.glow;
      if (glow) glow.material.emissiveIntensity = f.on ? 3.5 : 0.5;
    });
  }

  // ---------- the clock ----------

  _buildClock() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.0, 0.45), this._wood);
    body.position.set(1.0, LAND_Y + 1.0, -0.5);
    body.castShadow = body.receiveShadow = true;
    this.add(body); this.addCollider(body);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.5), this._wood);
    hood.position.set(1.0, LAND_Y + 2.02, -0.5); this.add(hood);
    this._clockFace = makeClockFace({ radius: 0.12 });
    this._clockFace.position.set(0.845, CLOCK_POS.y, -0.5);
    this._clockFace.rotation.y = -Math.PI / 2;                 // faces −X, into the landing
    this._clockFace.setTime(3, 7, 0);
    this.add(this._clockFace); this.track(this._clockFace);
    this.interact(body, { prompt: 'the clock', distance: 3, onInteract: () => this._wind() });
    this._clockBody = body;
    this.tick((dt) => {                                         // it ticks at the evening and the morning
      if (this.hours.is('night')) return;
      this._tickT = (this._tickT ?? 0) + dt;
      if (this._tickT >= 1.0) { this._tickT = 0; this.playSoundAt('tick', CLOCK_POS, { gain: 0.035 }); }
    });
  }

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
    }
  }

  // ---------- the per-hour look ----------

  _bindLook(windowPos, sunFrom) {
    const hemiN = new THREE.HemisphereLight(0x424a70, 0x2b2b38, 0);
    const hemiE = new THREE.HemisphereLight(0x5a4a3a, 0x1a1410, 0);
    const hemiM = new THREE.HemisphereLight(0xffffff, 0xcfcac0, 0);
    this.add(hemiN, hemiE, hemiM);
    const moon = new THREE.PointLight(0x8ea0cc, 0, 12, 1.6);
    moon.position.set(windowPos.x, windowPos.y, windowPos.z);
    this.add(moon);
    // a second, fainter fall of the same cold light over the stairs, so the
    // climb out of the hall reads at 3:07
    const moon2 = new THREE.PointLight(0x8ea0cc, 0, 12, 1.6);
    moon2.position.set(0, 3.5, 3.6);
    this.add(moon2);
    const sun = new THREE.DirectionalLight(0xfff2dc, 0);
    sun.position.set(sunFrom.x, sunFrom.y, sunFrom.z);
    sun.target.position.set(0, 1, 0);
    // No shadow caster in this room, at any hour. The landing has a ceiling
    // and one small window, so the sun's shadow map came out solid — every
    // interior pixel in shadow — while a shadowed light costs nine extra
    // texture fetches per lit pixel, and this scene is fill-bound. The sun is
    // a fill light instead, and the fog does the depth.
    this.add(sun, sun.target);
    this._dimmable.push(hemiN, hemiE, hemiM, moon, moon2, sun);
    const GRADE_N = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
    const GRADE_E = { vignette: 1.2, grain: 0.03, desat: 0.08, lift: 0.03, fringe: 0.0005 };
    const GRADE_M = { vignette: 0.9, grain: 0.045, desat: 0.35, lift: 0.09, fringe: 0.001 };
    // Concrete bounces, and a shaft is mostly surfaces facing each other: the
    // ground colour is what lights every downward face — the ceiling, the
    // soffits under the flights — and the house's near-black one left them as
    // holes. The shaft gets a second, warmer hemisphere of its own, switched
    // on only while the player is inside it.
    const hemiShaft = new THREE.HemisphereLight(0x6a6f78, 0x46443f, 0);
    hemiShaft.visible = false;
    this.add(hemiShaft);
    this._hemiShaft = hemiShaft;
    this.hours.bind('night', {
      objects: [this._paneNight, this._fireflies],
      lights: [{ light: hemiN, intensity: 1.9 }, { light: moon, intensity: 5.0 }, { light: moon2, intensity: 4.2 },
        { light: hemiShaft, intensity: 1.5 }],
      fog: { color: '#0a0a10', near: 1.5, far: 14 }, grade: GRADE_N, mood: this.constructor.meta.mood,
    });
    const below = new THREE.PointLight(0xffc07a, 0, 7, 1.6);
    below.position.set(0, 1.0, 6.8);
    this.add(below);
    this._dimmable.push(below);
    this.hours.bind('evening', {
      objects: [this._paneEve],
      lights: [{ light: hemiE, intensity: 0.9 }, { light: this._landBulb.light, intensity: 3.5 }, { light: below, intensity: 2.4 }],
      fog: { color: '#1a140f', near: 2, far: 18 }, grade: GRADE_E, mood: 'evening',
      loops: [{ kind: 'radio', position: { x: 0, y: 0.9, z: 6.4 }, opts: {} }],
    });
    this.hours.bind('morning', {
      objects: [this._paneMorn],
      lights: [{ light: hemiM, intensity: 1.5 }, { light: sun, intensity: 1.4 }],
      fog: { color: '#d8d5ce', near: 1, far: 9 }, grade: GRADE_M, mood: 'morning',
      loops: [{ kind: 'birds', position: windowPos, opts: {} }],
    });
  }

  /** A cardboard box with a written label, the way the morning leaves a room. */
  _morningBox(s, label, x, y, z, onOpen) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), this._card);
    body.position.y = 0.2; body.castShadow = body.receiveShadow = true;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1),
      new THREE.MeshStandardMaterial({ map: textTexture({ text: label, font: '24px Georgia', color: '#3a332c', bg: '#d9cfbd', width: 384, height: 128 }), roughness: 0.9 }));
    lab.position.set(0, 0.26, 0.201);
    g.add(body, lab);
    g.position.set(x, y, z);
    this.add(g);
    this.interact(g, { prompt: label.toLowerCase(), onInteract: () => onOpen(g) });
    s.objects.push(g); s.colliders.push(g); s.interact.push(g);
    return g;
  }

  async _waitFor(test, capSeconds) {
    const until = Date.now() + capSeconds * 1000;
    while (!test() && Date.now() < until) await this.debugWait(0.05);
  }

  // ---------- the puzzle ----------

  _shutDoor(rec) {
    if (rec.door.isOpen()) rec.door.setOpen(false);
    if (!rec.blocker) rec.blocker = this.addBlocker(rec.box[0], rec.box[1]);
  }

  _openDoorway(rec) {
    if (!rec.door.isOpen()) { rec.door.setOpen(true, 1); this.playSound('door'); }
    if (rec.blocker) { this.removeBlocker(rec.blocker); rec.blocker = null; }
  }

  _wirePuzzle() {
    // ---- the doors, by hour ----
    const doorAt = (rec, hour, lockedLine) => this.interact(rec.door, {
      prompt: 'the door',
      onInteract: () => {
        if (this.hours.is(hour)) { this._openDoorway(rec); return; }
        this.playSound('locked');
        this.subtitle(lockedLine(this.hours.current), 5);
      },
    });
    doorAt(this._doorRecs.bath, 'evening', (h) => (h === 'night'
      ? 'Locked. Behind it, water is running into a tub that never fills.'
      : 'White. The house is gone from here on.'));
    doorAt(this._doorRecs.box, 'evening', (h) => (h === 'night'
      ? 'Locked.'
      : 'White. The house is gone from here on.'));
    this.interact(this._airDoor, {
      prompt: 'the airing cupboard',
      onInteract: () => {
        if (this.hours.is('night') && !this._ready) {
          this.playSound('locked');
          this.subtitle('Locked. Something on the other side is still going down.', 5);
          this.playSoundAt('stepOther', { x: -2.3, y: LAND_Y - 4, z: 0.9 }, { soft: true });
          this.cue('a step, a long way down', new THREE.Vector3(-2.3, LAND_Y - 4, 0.9));
          return;
        }
        this._openDoorway(this._doorRecs.air);
      },
    });
    this.interact(this._childDoor, {
      prompt: 'the door',
      onInteract: () => { this.playSound('locked'); this.subtitle('Shut. Yours always last.', 4); },
    });
    this.interact(this._herDoor, {
      prompt: 'her door',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle(this.hours.is('evening') ? 'Her room. She is still up.' : 'Her room. You never went in.', 4);
      },
    });

    // every hour shuts the three doors again — the rooms behind them swap
    this.hours.onChange = (hour) => {
      for (const key of ['bath', 'air', 'box']) this._shutDoor(this._doorRecs[key]);
      if (hour === 'morning') {                         // the doorways stand open onto white
        this._doorRecs.bath.door.setOpen(true, 1);
        this._doorRecs.box.door.setOpen(true, 1);
      }
      this.game.interaction.setEnabled(this._keyArch, hour === 'morning' && this._keyArch.visible);
      this.game.interaction.setEnabled(this._photoArch, hour === 'morning' && this._photoArch.visible);
      // the hour that just arrived says what to do with it — from the first
      // wind on, which is the one that opens the landing's other two rooms
      if (!this._inShaft && !this._approach) {
        const carrying = this.hasItem('photo') || this.hasItem('ribbon') || this.hasItem('spare-key');
        this.setObjective(this._ready ? 'down, two flights below'
          : carrying ? 'the box, in the box room'
            : this._wound ? 'the landing, at another hour' : 'up. then yours last.');
      }
    };

    this.tick((dt) => {                                 // two knocks behind the child's door
      this._knockT = (this._knockT ?? 30) + dt;
      if (this._knockT > 50) {
        this._knockT = 0;
        const at = { x: 1.3, y: LAND_Y + 1.2, z: 0.6 };
        this.playSoundAt('knock', at, { count: 2, soft: true });
        this.cue('two knocks, behind the door', new THREE.Vector3(at.x, at.y, at.z));
      }
    });

    this.tick((dt) => {                                 // her humming from below, once a minute, at the evening
      if (!this.hours.is('evening')) { this._humT = 52; return; }
      this._humT = (this._humT ?? 52) + dt;
      if (this._humT < 60) return;
      this._humT = 0;
      const at = { x: 0, y: 0.5, z: 6 };
      this.playSoundAt('hummed', at, { notes: HUM });
      this.cue('humming, from below', new THREE.Vector3(at.x, at.y, at.z));
    });

    // ---- the bathroom ----
    this.interact(this._cloth, { prompt: 'the mirror', onInteract: () => this.subtitle('Covered. She keeps it covered. Leave it.', 4) });
    this.interact(this._ribbon, {
      prompt: 'the ribbon',
      once: true,
      onInteract: () => {
        if (!this._ribbon.visible) return;
        this._ribbon.visible = false;
        this.giveItem({ id: 'ribbon', name: 'a ribbon, blue' });
        this.subtitle('Blue. Not blue once — blue. It is newer than you remember it.', 5);
        this.setObjective('the box, in the box room');
      },
    });
    this.interact(this._boiler, { prompt: 'the boiler', onInteract: () => this.subtitle('Warm. Towels, and the boiler ticking like something counting.', 4) });

    // ---- the archive: the tray and the boxes ----
    this.interact(this._trayMesh, {
      prompt: 'the in-tray',
      onInteract: () => {
        if (this._holding !== null) { this.subtitle('One at a time. You are the filer tonight.', 4); return; }
        if (this._tray >= CARDS.length) { this.subtitle('The tray is empty.', 3); return; }
        const k = this._tray++;
        this._holding = k;
        this.giveNote({ id: 'l19-card-' + k, title: 'an index card', body: CARDS[k][1] });
        this.giveItem({ id: 'card', name: 'an index card' });
      },
    });
    for (const [label, box] of Object.entries(this._boxes)) {
      this.interact(box.mesh, {
        prompt: label,
        onInteract: () => {
          if (box.open) { this.subtitle(BOX_LINES[label] ?? 'Open.', 4); return; }
          if (this._holding === null) { this.playSound('locked'); this.subtitle('The lid is down. The tray is on the table.', 4); return; }
          if (CARDS[this._holding][0] !== label) {
            this.playSound('locked');
            this.subtitle(`The lid stays down. That was not ${label}.`, 4);
            return;
          }
          this._holding = null;
          this.removeItem('card');
          this._filed++;
          this.playSound('paper');
          box.open = true;
          this._openLid(box);
          if (label === 'the hallway') {
            this._keyArch.visible = true;
            this.game.interaction.setEnabled(this._keyArch, true);
            this.subtitle('The spare key. Cold now. It will be warm again by the time it is found.', 5);
          } else if (label === 'the house') {
            this._photoArch.visible = true;
            this.game.interaction.setEnabled(this._photoArch, true);
            this.subtitle('Two figures, faces gone soft. One of them is you.', 5);
          } else this.subtitle(BOX_LINES[label], 4);
          if (this._filed === CARDS.length) {
            this.learnClue({
              id: 'l19-records',
              title: 'the records',
              body: 'what the records agree on — how deep the water finally went, the aisle that faced the sun, the carriage you always chose, your row, counted on your fingers.',
            });
          }
        },
      });
    }
    this.interact(this._keyArch, {
      prompt: 'the spare key',
      once: true,
      enabled: false,
      onInteract: () => {
        this._keyArch.visible = false;
        this.giveItem({ id: 'spare-key', name: 'the spare key, cold now' });
        this.setObjective('the box, in the box room');
      },
    });
    this.interact(this._photoArch, {
      prompt: 'the photograph',
      once: true,
      enabled: false,
      onInteract: () => {
        this._photoArch.visible = false;
        this.giveItem({ id: 'photo', name: 'a photograph, two figures' });
        this.setObjective('the box, in the box room');
      },
    });

    // ---- the box room: the box, then the label ----
    // interaction.add stamps every descendant with its root, so the box has to
    // be registered before the label that is glued to its front, or looking at
    // the label opens the box instead.
    this.interact(this._theBox, {
      prompt: 'the box',
      onInteract: () => {
        const put = (id, key, mesh) => {
          if (this.hasItem(id) && !this._have[key]) {
            this.removeItem(id); this._have[key] = true; mesh.visible = true; this.playSound('paper'); return true;
          }
          return false;
        };
        if (put('photo', 'photo', this._photoIn) || put('ribbon', 'ribbon', this._ribbonIn) || put('spare-key', 'key', this._keyIn)) {
          this._checkReady();
          return;
        }
        this.subtitle(this._ready ? 'It is ready.' : 'Empty. It has been kept empty a long time. It is waiting for three things.', 5);
      },
    });
    this.interact(this._label, {
      prompt: 'the label',
      onInteract: () => {
        if (this._strikes >= 2) return;
        this._strikes++;
        this._labelTex.redraw({ strikes: this._strikes });
        this.playSound('paper');
        this.subtitle(this._strikes === 1
          ? 'You cross it out. It was hers to give, not yours to keep.'
          : 'And once more, for whoever is small next.', 5);
        this._checkReady();
      },
    });

    this._wireShaft();
  }

  /** A cardboard lid, standing up over 0.6 s. */
  _openLid(box) {
    let t = 0;
    const off = this.tick((dt) => {
      t = Math.min(0.6, t + dt);
      box.lid.rotation.x = -(Math.PI / 2) * (t / 0.6);
      if (t >= 0.6) off();
    });
  }

  _checkReady() {
    if (this._ready || this._strikes < 2 || !(this._have.photo && this._have.ribbon && this._have.key)) return;
    this._ready = true;
    this.playSound('clue');
    this.subtitle('It is ready. It will be found under the house, in a room that does not exist yet.', 6);
    this.setObjective('down, two flights below');
  }

  // ---------- the shaft: the loop, the child, the lights, the chalk ----------

  _wireShaft() {
    for (const f of [3, 4, 5]) {
      const st = this._stub[f];
      this.interact(st.cord, {
        prompt: 'the cord',
        onInteract: () => {
          st.on = !st.on;
          this.playSound('switch');
          st.light.intensity = st.on ? 4 : 0;
          st.plane.material.emissiveIntensity = st.on ? 1.2 : 0;
        },
      });
      this.interact(this._fireDoors[f], {
        prompt: 'the fire door',
        onInteract: () => {
          if (this._fireDoors[f].isOpen()) return;
          this.playSound('unlock');
          this._fireDoors[f].setOpen(true, 1);
          this.removeBlocker(this._stubBlockers[f]);
          this.playSound('door');
        },
      });
    }
    this.interact(this._fireDoors[1], {
      prompt: 'the fire door',
      onInteract: () => { this.playSound('locked'); this.subtitle('Locked. Through the glass, a corridor with every light off.', 5); },
    });
    this.interact(this._fireDoors[2], {
      prompt: 'the fire door',
      onInteract: () => { this.playSound('locked'); this.subtitle('Locked. Someone has stacked chairs against the other side.', 5); },
    });

    this.interact(this._chalkPlane, {
      prompt: 'the wall',
      onInteract: () => {
        if (!this._chalkWritten) {
          this._chalkWritten = true;
          this._tally = 1;
          this._chalk.redraw({ tally: 1, lines: ['wait for me'] });
          this.playSound('clue');
          this.subtitle('You write it, in an adult hand. It is the only hand it could have been in.', 6);
          this.game.interaction.setPrompt(this._chalkPlane, 'the chalk');
          this.setObjective('wait for me');
        } else if (this._loopCount > this._tally) {         // a stroke per round, and no more
          this._tally++;
          this._redrawChalk();
          this.playSound('clue');
          this.subtitle('One more. You keep count for it.', 4);
        } else this.subtitle('wait for me. and a count, so far.', 3);
      },
    });

    this.interact(this._wardrobeBack, {
      prompt: 'the back of a wardrobe',
      onInteract: () => {
        if (this._approach !== 'done') { this.subtitle('The back of a wardrobe. It is not your way yet.', 4); return; }
        if (!this._exitOpen) {
          this._exitOpen = true;
          this._wardrobeBack.setOpen(true, -1);
          this.removeBlocker(this._wbBlocker);
          this.playSound('door');
        }
      },
    });

    // `dt` is the engine's simulation step, clamped at 50 ms, so on a slow
    // machine it runs slower than the world does and five seconds of standing
    // still becomes half a minute of it. `t` is real elapsed seconds, so every
    // beat below — the stillness, the child's cadence, the approach — is
    // measured off that instead, the way XII measures its own.
    this.tick((dt, t) => {
      const pl = this.game.player, p = pl.position, footY = p.y - 1.62;
      const rdt = this._tPrev === null || this._tPrev === undefined || pl.frozen ? 0 : Math.min(0.25, t - this._tPrev);
      this._tPrev = t;
      if (this._exitOpen && !this.isCompleted && p.z > 3.3 && Math.abs(footY - LAND_Y) < 1.2) { this.complete(); return; }
      this._inShaft = this.hours.is('night') && p.x < -1.25 && p.z > ZS.s0 - 0.2 && p.z < ZS.n1 + 0.2;
      if (!this._inShaft) { this._wMesh.visible = false; return; }

      // the loop: below L5's half-landing, back up three floors, same heading
      if (this._approach !== 'done' && footY < LOOP_FOOT && p.x < FLIGHT.x1 && p.x > FLIGHT.x0 && p.z > ZS.n0) {
        pl.teleport(p.x, p.z, pl.yaw, footY + LOOP_UP);
        this._loopCount++;
        this._loopCheck();
        if (this._loopCount === 1) this.setObjective('one door closer each time round');
        return;
      }

      if (footY > LANDINGS[3][1] + 0.3 && this._approach === null) { this._wMesh.visible = false; return; }
      this._updateW(rdt);

      const v = pl.velocity ? Math.hypot(pl.velocity.x, pl.velocity.z) : 0;
      if (this._approach === null && this._correct >= 2 && this._chalkWritten && footY <= -9.0) {
        this._still = v < 0.05 && !this.game.ui.modalOpen ? this._still + rdt : 0;
        if (this._still >= 5) this._startApproach();
      }
      if (this._approach === 'fixed') this._runApproach(rdt, v);
    });
  }

  _redrawChalk() {
    const lines = ['wait for me'];
    if (this._pleaded >= 1) lines.push('please');
    this._chalk.redraw({ tally: Math.min(this._tally, 12), lines });
  }

  /** One stub light must be on, and it must be the one the dream sees this time. */
  _loopCheck() {
    const lit = [3, 4, 5].filter((f) => this._stub[f].on);
    // One door closer than the last one it saw — counted off the doors it has
    // already seen, not off the rounds. The first walk down is a round with
    // nothing lit, and the room has to survive it: a wrong round costs the
    // round, never the way out.
    const seen = Math.min(this._correct, 2);
    const want = seen === 0 ? 5 : seen === 1 ? 4 : 3;
    const right = lit.length === 1 && lit[0] === want;
    const wpos = this._wMesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    // the hum and the hurry are the whole answer to the light rule, so each
    // gets a caption and a line as well as the sound
    if (right && this._correct < 2) {
      this._correct++;
      this.playSoundAt('hummed', wpos, { notes: LevelBase.tune('EG'), small: true });
      this.cue('it hums', wpos);
      this.subtitle('Above you it hums, two notes, and goes on down.', 4);
    } else if (!right) {
      this._pleaded++;
      if (this._chalkWritten) this._redrawChalk();
      this._hurry = 3.0;
      this.cue('it hurries', wpos);
      this.subtitle('Above you the small steps quicken. That was not the door it wanted.', 5);
    }
  }

  // W is one floor above you on the stair path, always.
  _projectOnPath(p) {
    let best = { d: Infinity, s: 0, pos: this._path[0].clone() }, acc = 0;
    const a = new THREE.Vector3(), ab = new THREE.Vector3(), ap = new THREE.Vector3();
    for (let i = 0; i < this._path.length - 1; i++) {
      a.copy(this._path[i]); ab.subVectors(this._path[i + 1], a); ap.subVectors(p, a);
      const len = ab.length(), t = len > 0 ? Math.max(0, Math.min(1, ap.dot(ab) / (len * len))) : 0;
      const q = a.clone().addScaledVector(ab, t), d = q.distanceTo(p);
      if (d < best.d) best = { d, s: acc + t * len, pos: q };
      acc += len;
    }
    return best;
  }

  _pointAt(s) {
    let acc = 0;
    for (let i = 0; i < this._path.length - 1; i++) {
      const len = this._path[i].distanceTo(this._path[i + 1]);
      if (s <= acc + len) return this._path[i].clone().lerp(this._path[i + 1], len > 0 ? (s - acc) / len : 0);
      acc += len;
    }
    return this._path[this._path.length - 1].clone();
  }

  _updateW(rdt) {
    const pl = this.game.player, p = pl.position;
    if (this._approach) return;                                   // it stands; _runApproach moves it
    const foot = new THREE.Vector3(p.x, p.y - 1.62, p.z);
    const here = this._projectOnPath(foot);
    const sW = Math.max(0, here.s - this._floorLen);
    const wp = this._pointAt(sW);
    const ahead = this._pointAt(Math.min(sW + 0.3, here.s));
    this._wMesh.position.copy(wp);
    this._wMesh.visible = true;
    this._wMesh.faceToward(ahead);
    const v = pl.velocity ? Math.hypot(pl.velocity.x, pl.velocity.z) : 0;
    const rate = this._hurry > 0 ? 0.3 : 0.5;
    if (this._hurry > 0) this._hurry -= rdt;
    this._stepT = (this._stepT ?? 0) + rdt;
    if (v > 0.5 || this._hurry > 0) {
      if (this._stepT >= rate) {
        this._stepT = 0;
        this.playSoundAt('smallStep', wp.clone().add(new THREE.Vector3(0, 0.1, 0)));
        if (!this._wCued) { this._wCued = true; this.cue('small footsteps, above you', wp); }
      }
      this._lastMoving = 0;
    } else if (this._lastMoving !== undefined && this._lastMoving < 0.5) {
      this._lastMoving += rdt;                                    // one more step after you stop
      if (this._lastMoving >= 0.5) this.playSoundAt('smallStep', wp.clone().add(new THREE.Vector3(0, 0.1, 0)));
    }
    // climb toward it and it climbs away; say so, now and then
    this._climb = here.s < (this._lastS ?? here.s) - 0.01 ? this._climb + rdt : 0;
    this._lastS = here.s;
    if (this._climb > 2 && !(this._climbSaidAt > performance.now() - 20000)) {
      this._climbSaidAt = performance.now();
      this.subtitle('It stops, above you. It will come no closer than that.', 4);
    }
  }

  _startApproach() {
    this._approach = 'fixed';
    const wy = this._wMesh.position.y;
    let f = 3;
    for (const g of [4, 5]) if (Math.abs(LANDINGS[g][1] - wy) < Math.abs(LANDINGS[f][1] - wy)) f = g;
    this._approachFloor = f;
    const y = LANDINGS[f][1];
    this._wTarget = new THREE.Vector3(MAIN_CX, y, Z_SOUTH);
    // It walks to the landing along the stairs, not through them: a straight
    // line from a tread to the landing centre runs under the treads, and its
    // feet come out below the flight — which is the one angle this room ever
    // shows it from. The landing is the path point one floor down from L0's.
    this._wS = this._projectOnPath(this._wMesh.position).s;
    this._wTargetS = f * this._floorLen;
    // the top two steps of the south flight below its landing: you stop about
    // two metres short, on the flight, looking up at it
    this._approachBlocker = this.addBlocker([FLIGHT.x1 - 0.56, y - 0.6, ZS.s0], [FLIGHT.x1, y + 2.2, ZS.s1]);
    this.hush(2);
    this.subtitle('It has stopped, above you, in front of a door. It is waiting to see what you do.', 6);
    this.setObjective('up to it. two metres short.');
    this._breathed = false;
    this._moved = 0;
  }

  _runApproach(rdt, v) {
    const w = this._wMesh, p = this.game.player.position;
    const gap = this._wTargetS - this._wS;
    const arrived = Math.abs(gap) < 0.02;
    if (!arrived) {
      this._wS += Math.sign(gap) * Math.min(rdt * 0.8, Math.abs(gap));
      w.position.copy(this._pointAt(this._wS));
      w.faceToward(this._wTarget);
    } else {
      w.position.copy(this._wTarget);
      w.rotation.y = Math.PI / 2;                                  // facing +X, its door
    }
    w.visible = true;
    if (v > 0.3 && !this._breathed) {
      this._moved += rdt;
      if (this._moved > 1.0) { this._cancelApproach(); return; }
    } else this._moved = 0;
    const head = new THREE.Vector3(p.x, p.y, p.z);
    const wHead = w.position.clone().add(new THREE.Vector3(0, 1.0, 0));
    // it has to have stopped before you can be the thing that stops it: the
    // walk into the stub starts from the landing, never from mid-flight
    if (arrived && !this._breathed && head.distanceTo(wHead) < 2.8 && head.y < wHead.y + 0.6) {
      this._breathed = true;
      this.playSound('breath');
      this.hush(3);
      this.flinch({ flash: 0 });
      this.after(1, () => this._openForIt());
    }
  }

  _cancelApproach() {
    this._approach = null;
    this._still = 0;
    this.removeBlocker(this._approachBlocker);
    this.subtitle('It goes on. It will stop again when you do.', 4);
  }

  _openForIt() {
    const f = this._approachFloor, door = this._fireDoors[f], st = this._stub[f];
    this.playSound('unlock');
    door.setOpen(true, 1);
    this.playSound('door');
    st.on = true;
    st.light.intensity = 4;
    st.plane.material.emissiveIntensity = 1.2;
    const from = this._wMesh.position.clone(), to = new THREE.Vector3(3.5, st.y, 0.9);
    this._approach = 'done';
    this.footsteps([from, to], {
      every: 0.45,
      opts: { soft: true },
      onStep: (i, pos) => { this._wMesh.position.copy(pos); this._wMesh.faceToward(to); },
      // The walk away takes four and a half seconds, and nothing but these two
      // blockers stands between you and it while it lasts — a run up the last
      // two steps closes the two metres in a fifth of a second. You are held
      // where you stopped until it is gone, and then the stairs are yours.
      onDone: () => {
        this._wMesh.visible = false;
        this.removeBlocker(this._approachBlocker);
        this.removeBlocker(this._stubBlockers[f]);
      },
    });
    this.cue('small footsteps, going away', from);
    this.subtitle('The door beside it gives, and it goes through, and does not look back. You did not want it to.', 6);
    this.setObjective('up. the back of the wardrobe.');
  }


  /**
   * Wind the clock on to `to`, through the clock's own handler. The crossfade
   * runs on the engine's clamped step and a headless render sits far below
   * real time, so hurry the hour along — the handlers stay real, and the
   * beats that matter (the stillness, the child) are measured off `t`, which
   * the time scale does not touch. XVII's _windTo does the same.
   */
  async _windTo(to) {
    await this._waitFor(() => !this.hours.changing, 10);
    this.debugInteract(this._clockBody);
    this.game.engine.timeScale = 12;
    await this._waitFor(() => this.hours.is(to) && !this.hours.changing, 12);
    this.game.engine.timeScale = 1;
  }

  async debugSolve() {
    const pl = this.game.player;
    const t = (x, z, yaw, y) => pl.teleport(x, z, yaw, y);
    try {
      await this._solve(t);
    } finally {
      this.game.engine.timeScale = 1;
    }
  }

  async _solve(t) {
    t(0, 0.5, 0, LAND_Y);

    // the morning: the archive, six cards filed, the key and the photograph
    await this._windTo('morning');
    this.debugInteract(this._airDoor);
    await this.debugWait(0.25);
    for (let k = 0; k < 6; k++) {
      this.debugInteract(this._trayMesh);
      await this.debugWait(0.12);
      this.game.ui.closeModal();
      this.debugInteract(this._boxes[CARDS[k][0]].mesh);
      await this.debugWait(0.12);
    }
    this.debugInteract(this._keyArch);
    await this.debugWait(0.12);
    this.debugInteract(this._photoArch);
    await this.debugWait(0.12);

    // the evening: the ribbon, the label crossed out twice, the box filled
    await this._windTo('evening');
    this.debugInteract(this._bathDoor);
    await this.debugWait(0.25);
    this.debugInteract(this._ribbon);
    await this.debugWait(0.12);
    this.debugInteract(this._boxDoor);
    await this.debugWait(0.25);
    this.debugInteract(this._label);
    await this.debugWait(0.12);
    this.debugInteract(this._label);
    await this.debugWait(0.12);
    for (let i = 0; i < 3; i++) { this.debugInteract(this._theBox); await this.debugWait(0.12); }

    // 3:07: the shaft
    await this._windTo('night');
    this.debugInteract(this._airDoor);
    await this.debugWait(0.25);
    t(MAIN_CX, 0.25, Math.PI / 2, LANDINGS[3][1]);                       // L3; W appears a floor above
    await this.debugWait(0.25);
    t(2.8, 0.9, 0, LANDINGS[5][1]);                                      // −3 lit
    this.debugInteract(this._stub[5].cord);
    await this.debugWait(0.12);
    t(-4.5, 1.55, -Math.PI / 2, LOOP_FOOT - 0.5);                        // round once: correct
    await this._waitFor(() => this._loopCount >= 1, 4);
    await this.debugWait(0.12);
    t(2.8, 0.9, 0, LANDINGS[5][1]);
    this.debugInteract(this._stub[5].cord);                              // −3 off
    await this.debugWait(0.12);
    t(2.8, 0.9, 0, LANDINGS[4][1]);
    this.debugInteract(this._stub[4].cord);                              // −2 lit
    await this.debugWait(0.12);
    t(-4.5, 1.55, -Math.PI / 2, LOOP_FOOT - 0.5);                        // round twice: correct
    await this._waitFor(() => this._loopCount >= 2, 4);
    await this.debugWait(0.12);
    t(MAIN_CX, 0.0, 0, LANDINGS[4][1]);
    this.debugInteract(this._chalkPlane);                                // wait for me
    await this.debugWait(0.12);

    // stand still on L4 until it stops on L3, then up to it and two metres short
    t(MAIN_CX, 0.9, Math.PI / 2, LANDINGS[4][1]);
    await this._waitFor(() => this._approach === 'fixed', 14);
    t(-4.35, 0.25, -Math.PI / 2, LANDINGS[3][1] - 0.51);
    await this._waitFor(() => this._approach === 'done', 8);

    // up, and out through the back of the wardrobe
    t(MAIN_CX, 1.55, 0, LAND_Y);
    this.debugInteract(this._wardrobeBack);
    await this.debugWait(0.25);
    t(MAIN_CX, 3.6, 0, LAND_Y);
    await this.debugWait(0.5);
  }
}
