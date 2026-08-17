import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeFluorescent, makeSign,
  makeTable, makeChair, makeShelf, makeKeyProp, makeDust, applyFog,
} from '../core/props.js';
import { makeFigure } from '../core/presence.js';

// XIII — The School
// The primary school at night. Your peg has a sunflower and no name. The door
// plates lie; the music room is the one with the single note. The board has
// five of the seven; the tannoy has been chiming the other two all night.
// Play it on the hall piano and the fire door to the playground opens.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.3

const CW = 2.6, CH = 3.0, CLEN = 30;              // corridor: x −1.3..1.3, z 2..−30
const TUBE_Z = (i) => -1.5 - 3 * i;               // ten tubes
const TUNE = 'EGAGEGE';
const PIANO_POS = { x: -4, y: 1.5, z: -38.5 };
const HALL_SPEAKER = { x: 0, y: 4.8, z: -34 };
const SPEAKERS = [{ x: 0, y: 2.95, z: -8 }, { x: 0, y: 2.95, z: -24 }, HALL_SPEAKER];
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };
// peg 12 (index 11) is yours: a sunflower and no name
const NAMES = ['ada', 'tom', 'nell', 'ruth', 'sam', 'iris', 'joe', 'may', 'ben', 'lou', 'edie', '', 'kit', 'fay', 'ned', 'wren'];
const PEG_Z = (i) => -2.5 - i * 0.3;              // pegs run z −2.5 … −7.0
const LOCKER_Z = (n) => -6.2 - (n - 1) * 0.5;     // lockers 1..12, twelve at −11.7
const STAGE_FRONT = -36.8;                        // stage top y 0.6, z −40.2 … −36.8
const STAGE_NOTCH = -37.9;                        // …except the corner by the fire door
const LID_UP = -0.9, LID_DOWN = -0.15;            // the grand's lid, hinged at the back

export default class Level13 extends LevelBase {
  static meta = {
    id: 13,
    numeral: 'XIII',
    title: 'The School',
    mood: 'school',
    grade: GRADE,
    intro: 'The school is dark, and the bell has not rung, and someone is playing one note.',
    outro:
      'You played it once for her and never again.\n' +
      'Tonight it played itself, all the way to the end,\n' +
      'with nobody at the keys.',
  };

  build() {
    applyFog(this.scene, '#0b0d10', 2, 26);

    this._wallMat = makeMat('plaster', { base: '#a9a597', repeat: [4, 1] });
    this._dadoMat = makeMat('plaster', { base: '#6f7a72', repeat: [4, 1] });
    this._floorMat = makeMat('checker', { a: '#c9c3b2', b: '#8b8f8a', cell: 128, repeat: [3, 34] });
    this._ceilMat = makeMat('ceiling', { base: '#d8d4c8', repeat: [2, 20] });
    this._roomFloorMat = makeMat('wood', { base: '#6b563d', repeat: [3, 3] });
    this._roomWallMat = makeMat('plaster', { base: '#9c9889', repeat: [3, 1] });
    this._roomCeilMat = makeMat('ceiling', { base: '#cbc7bb', repeat: [2, 2] });
    this._hallWallMat = makeMat('plaster', { base: '#8f8a7c', repeat: [5, 2] });
    this._hallFloorMat = makeMat('wood', { base: '#7a6242', repeat: [6, 5] });
    this._metalMat = new THREE.MeshStandardMaterial({ color: 0x7c8386, roughness: 0.6, metalness: 0.4 });
    this._greyMat = new THREE.MeshStandardMaterial({ color: 0x8b8f8c, roughness: 0.6 });

    this._tubes = [];
    this._buildCorridor();
    this._buildRooms();
    this._wirePuzzle();

    this.spawn.position.set(0, 0, 1.2);
    this.spawn.yaw = 0;
    this.bounds = new THREE.Box3(new THREE.Vector3(-8, 0, -41), new THREE.Vector3(10.5, 5, 2.4));
    this.setObjective('your peg is somewhere along here');
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

  _floor(w, d, mat, x, z, y = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.add(m);
    this.addGround(m);
    return m;
  }

  _ceiling(w, d, mat, x, z, y) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    this.add(m);
    return m;
  }

  /**
   * A room opening off the corridor. `side` −1 = west (its far wall at x0),
   * +1 = east (far wall at x1). The wall it shares with the corridor is the
   * corridor wall itself, which already has the doorway cut into it.
   */
  _roomShell({ x0, x1, z0, z1, h = CH, floorMat, wallMat, ceilMat, side }) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const fm = floorMat ?? this._roomFloorMat;
    const wm = wallMat ?? this._roomWallMat;
    const cm = ceilMat ?? this._roomCeilMat;
    this._floor(w, d, fm, cx, cz);
    this._ceiling(w, d, cm, cx, cz, h);
    const ecx = cx + (side < 0 ? -0.1 : 0.1);
    this._box(w + 0.2, h, 0.2, wm, ecx, h / 2, z0 - 0.1);
    this._box(w + 0.2, h, 0.2, wm, ecx, h / 2, z1 + 0.1);
    this._box(0.2, h, d + 0.4, wm, side < 0 ? x0 - 0.1 : x1 + 0.1, h / 2, cz);
  }

  /** A door in a corridor side wall. side −1 = west, +1 = east. */
  _sideDoor(side, z, opts = {}) {
    const door = makeDoor({ width: 1.0, color: opts.color ?? '#6a5a44', frameColor: '#443b31' });
    door.position.set(side * (CW / 2), 0, z);
    door.rotation.y = -side * Math.PI / 2;
    this.add(door);
    this.track(door);
    this.addCollider(door.panel);
    return door;
  }

  /** The little numeral plate beside a door. */
  _plate(side, z, text, width = 0.16) {
    const sign = makeSign({
      text, width, height: 0.12, font: 'bold 44px Georgia', bg: '#d8cfba', color: '#2e2618',
    });
    sign.position.set(side * (CW / 2 - 0.012), 1.86, z + side * 0.66);
    sign.rotation.y = -side * Math.PI / 2;
    this.add(sign);
    return sign;
  }

  // ---------- the corridor ----------

  _buildCorridor() {
    this._floor(CW, CLEN + 2.5, this._floorMat, 0, -13.75);
    this._ceiling(CW, CLEN + 2.5, this._ceilMat, 0, -13.75, CH);

    // long walls, in segments, so the doorways are real holes
    const wallSeg = (side, z0, z1) => {
      const len = z0 - z1, zc = (z0 + z1) / 2;
      if (len <= 0.01) return;
      this._box(0.2, CH, len, this._wallMat, side * (CW / 2 + 0.1), CH / 2, zc);
      this._box(0.03, 1.1, len, this._dadoMat, side * (CW / 2 - 0.015), 0.55, zc, { collide: false });
    };
    const west = [-11, -17, -23], east = [-3, -15, -21, -27];
    for (const [side, doors] of [[-1, west], [1, east]]) {
      let z = 2;
      for (const dz of doors) {
        wallSeg(side, z, dz + 0.5);
        this._box(0.2, CH - 2.1, 1.0, this._wallMat, side * (CW / 2 + 0.1), 2.1 + (CH - 2.1) / 2, dz);
        z = dz - 0.5;
      }
      wallSeg(side, z, -CLEN);
    }

    this._buildEntrance();

    // fluorescents; the fourth stutters
    for (let i = 0; i < 10; i++) {
      const fix = makeFluorescent({ length: 1.4, intensity: 4.5, flicker: i === 3 ? 0.35 : 0 });
      fix.position.set(0, CH - 0.05, TUBE_Z(i));
      if (i === 2) fix.light.castShadow = true;
      this.add(fix);
      this.track(fix);
      this._tubes.push({ fix, light: fix.light, tubeMat: fix.children[0].material, z: TUBE_Z(i) });
    }
    this.add(new THREE.HemisphereLight(0x6f7580, 0x15171b, 0.35));

    // tannoy speakers on the corridor ceiling
    for (const p of SPEAKERS.slice(0, 2)) {
      this._box(0.25, 0.1, 0.25, this._greyMat, p.x, p.y, p.z, { collide: false });
      this._box(0.19, 0.02, 0.19, new THREE.MeshStandardMaterial({ color: 0x3a3d3c, roughness: 0.9 }),
        p.x, p.y - 0.055, p.z, { collide: false });
    }

    this._buildPegs();
    this._buildLockers();

    this.add(this.track(makeDust({ count: 220, box: [2.4, 2.6, 26], center: [0, 1.5, -13] })));
  }

  _buildEntrance() {
    // the fire door you came through, and the wall it is set in
    this._box(CW + 0.4, CH, 0.2, this._wallMat, 0, CH / 2, 2.1);
    this._box(CW - 0.03, 1.1, 0.03, this._dadoMat, 0, 0.55, 1.985, { collide: false });
    const entry = makeDoor({ width: 0.95, color: '#637074', frameColor: '#414a4d' });
    entry.position.set(0, 0, 2.0);
    this.add(entry);
    this.track(entry);
    this.addCollider(entry.panel);
    this.interact(entry, {
      prompt: 'the door you came through',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('It shut behind you. They always do.', 4);
      },
    });
    const barMat = new THREE.MeshStandardMaterial({ color: 0xb8bdba, roughness: 0.5, metalness: 0.25 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, 0.07), barMat);
    bar.position.set(0, 1.06, 1.93);
    this.add(bar);
    for (const bx of [-0.3, 0.3]) {
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), barMat);
      mount.position.set(bx, 1.06, 1.965);
      this.add(mount);
    }
    const doorSign = makeSign({
      text: 'FIRE DOOR\nkeep clear', width: 0.34, height: 0.2,
      font: 'bold 34px Georgia', bg: '#c9c2ae', color: '#3a3128',
    });
    // above eye level (1.62): at eye height the interact prompt, drawn at screen
    // centre when you look at the door, lands on top of the sign's own words
    doorSign.position.set(0, 1.88, 1.955);
    doorSign.rotation.y = Math.PI;
    this.add(doorSign);

    // the little green box above it — the only light the entrance keeps
    const exitBox = this._box(0.36, 0.14, 0.05, new THREE.MeshStandardMaterial({
      color: 0x1d3a2a, emissive: 0x2f7a52, emissiveIntensity: 1.6,
    }), 0, 2.42, 1.94, { collide: false });
    void exitBox;
    // 0.29 m further down the corridor than it used to sit. The sign moved up to
    // 1.88, which put it close to this lamp and nearly face-on to it, and it
    // washed out to white. From here the sign reads black on cream again.
    const exitLamp = new THREE.PointLight(0xaee0c6, 4.2, 7, 1.6);
    exitLamp.position.set(0, 2.06, 1.15);
    this.add(exitLamp);

    // the marker the lights set-piece watches: the way you came in
    this._entranceMarker = new THREE.Object3D();
    this._entranceMarker.position.set(0, 1.5, 0);
    this.add(this._entranceMarker);

    // children's paintings on the west wall, notices on the east
    const paintings = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.95),
      new THREE.MeshStandardMaterial({ map: this._paintingsTexture(), roughness: 0.92 })
    );
    paintings.position.set(-CW / 2 + 0.055, 1.55, 1.05);
    paintings.rotation.y = Math.PI / 2;
    this.add(paintings);
    this._box(1.62, 1.07, 0.04, new THREE.MeshStandardMaterial({ color: 0x6a563c, roughness: 0.9 }),
      -CW / 2 + 0.015, 1.55, 1.05, { collide: false }).rotation.y = Math.PI / 2;

    const notices = makeSign({
      text: 'NOTICES\n\nlost property: one shoe, one glove\nrecorders to be returned to rm 3\nthe hall doors stay locked at night',
      width: 1.1, height: 0.8, font: 'italic 26px Georgia', bg: '#b9a884', color: '#332c22',
    });
    notices.position.set(CW / 2 - 0.055, 1.55, 1.1);
    notices.rotation.y = -Math.PI / 2;
    this.add(notices);
    this._box(1.2, 0.9, 0.04, new THREE.MeshStandardMaterial({ color: 0x5f4d36, roughness: 0.9 }),
      CW / 2 - 0.015, 1.55, 1.1, { collide: false }).rotation.y = -Math.PI / 2;

    // a wet-floor sign a little way down the corridor: two moulded leaves that
    // meet at the top, the lettering on the outward face of each. One texture,
    // shared — the two leaves say the same thing.
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd5bf3a, roughness: 0.55 });
    const wetFaceMat = new THREE.MeshStandardMaterial({
      map: textTexture({
        text: 'wet\nfloor', width: 256, height: 448,
        font: 'bold 54px Georgia', bg: '#d5bf3a', color: '#2b2721',
      }),
      roughness: 0.55,
    });
    const frame = new THREE.Group();
    const lean = 0.22, halfH = 0.275;
    for (const s of [-1, 1]) {
      // BoxGeometry material order is [+x, −x, +y, −y, +z, −z]: the outward
      // face of each leaf carries the words, the other five are moulded plastic
      const mats = [yellowMat, yellowMat, yellowMat, yellowMat,
        s > 0 ? wetFaceMat : yellowMat, s > 0 ? yellowMat : wetFaceMat];
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.3, halfH * 2, 0.028), mats);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      // the +0.011 sets how far apart the feet stand; the tops just overlap, so
      // the apex is closed and no light leaks through the join
      leaf.position.set(0, halfH * Math.cos(lean), s * (halfH * Math.sin(lean) + 0.011));
      leaf.rotation.x = -s * lean;               // tops converge, feet splay
      frame.add(leaf);
    }
    frame.position.set(0.72, 0, -1.7);
    frame.rotation.y = 0.4;
    this.add(frame);
  }

  _paintingsTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 324;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8d7a58';
    ctx.fillRect(0, 0, 512, 324);
    const sheets = [
      ['#e6dfc9', '#7fa8c8'], ['#e9e2cf', '#c8b27f'], ['#e4dcc6', '#8fb87f'], ['#eae3d0', '#c98f8f'],
    ];
    sheets.forEach(([paper, ink], i) => {
      const x = 26 + (i % 4) * 120, y = 60;
      ctx.save();
      ctx.translate(x + 48, y + 66);
      ctx.rotate((i % 2 ? 1 : -1) * 0.035);
      ctx.fillStyle = paper;
      ctx.fillRect(-48, -66, 96, 132);
      ctx.fillStyle = ink;
      if (i === 0) {                                  // a sunflower, like the one on your peg
        ctx.fillStyle = '#d8ae34';
        for (let k = 0; k < 10; k++) {
          ctx.beginPath();
          ctx.ellipse(Math.cos(k / 10 * Math.PI * 2) * 22, -14 + Math.sin(k / 10 * Math.PI * 2) * 22, 9, 5, k / 10 * Math.PI * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#6b4720';
        ctx.beginPath(); ctx.arc(0, -14, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#4c7a3a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-3, 58); ctx.stroke();
      } else if (i === 1) {                           // a house with a light on
        ctx.fillStyle = '#b58c62'; ctx.fillRect(-32, -6, 64, 54);
        ctx.fillStyle = '#8a4f3c';
        ctx.beginPath(); ctx.moveTo(-38, -6); ctx.lineTo(0, -42); ctx.lineTo(38, -6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2e2a8'; ctx.fillRect(-18, 8, 16, 16);
      } else if (i === 2) {                           // stick figures, two of them
        ctx.strokeStyle = '#4a5a3a'; ctx.lineWidth = 4;
        for (const dx of [-16, 16]) {
          ctx.beginPath(); ctx.arc(dx, -26, 9, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(dx, -17); ctx.lineTo(dx, 18); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(dx - 14, 0); ctx.lineTo(dx + 14, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(dx, 18); ctx.lineTo(dx - 12, 42); ctx.moveTo(dx, 18); ctx.lineTo(dx + 12, 42); ctx.stroke();
        }
      } else {                                        // a school, in wax
        ctx.fillStyle = '#9aa8b4'; ctx.fillRect(-36, -18, 72, 62);
        ctx.fillStyle = '#e8dfc4';
        for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) ctx.fillRect(-28 + k * 22, -10 + r * 24, 14, 14);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(40,34,26,0.3)';
      ctx.strokeRect(x, y, 96, 132);
    });
    ctx.fillStyle = '#efe7d2';
    ctx.font = 'italic 34px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('our summer', 256, 36);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  _buildPegs() {
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 0.85 });
    this._box(0.06, 0.06, 5.0, railMat, -CW / 2 + 0.04, 1.44, -4.75, { collide: false });
    const hookMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.7, roughness: 0.4 });
    NAMES.forEach((name, i) => {
      const z = PEG_Z(i);
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 6), hookMat);
      hook.rotation.z = Math.PI / 2;
      hook.position.set(-CW / 2 + 0.09, 1.42, z);
      this.add(hook);

      const tex = i === 11
        ? this._sunflowerTexture()
        : textTexture({ text: name, width: 128, height: 96, font: 'italic 30px Georgia', bg: '#e8e0cf', color: '#3a3630' });
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(0.13, 0.1),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
      );
      card.position.set(-CW / 2 + 0.012, 1.63, z);
      card.rotation.y = Math.PI / 2;

      if (i === 11) {
        // your peg: the sunflower card and the coat still on it
        const target = new THREE.Group();
        const coat = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.86, 0.32),
          new THREE.MeshStandardMaterial({ color: 0x5c4a3d, roughness: 1 })
        );
        coat.position.set(-CW / 2 + 0.13, 0.97, z);
        coat.castShadow = true;
        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.14, 0.14, 8),
          new THREE.MeshStandardMaterial({ color: 0x53433a, roughness: 1 })
        );
        collar.position.set(-CW / 2 + 0.12, 1.36, z);
        target.add(card, coat, collar);
        this.add(target);
        this._pegCard = target;
      } else {
        this.add(card);
      }
    });
  }

  _sunflowerTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e0cf';
    ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = '#e2b53a';
    for (let k = 0; k < 12; k++) {
      ctx.beginPath();
      ctx.ellipse(64 + Math.cos(k / 12 * Math.PI * 2) * 22, 40 + Math.sin(k / 12 * Math.PI * 2) * 22, 8, 5, k / 12 * Math.PI * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#5a3d1e';
    ctx.beginPath(); ctx.arc(64, 40, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4c7a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(64, 52); ctx.lineTo(62, 92); ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildLockers() {
    const lines = [
      'Locked. Something inside shifts, and settles.',
      'Locked. A drawing is taped inside — you can see its corner.',
      'Locked.',
    ];
    for (let n = 1; n <= 12; n++) {
      const z = LOCKER_Z(n);
      const body = this._box(0.4, 1.7, 0.36, this._metalMat, CW / 2 - 0.2, 0.85, z);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.07),
        new THREE.MeshStandardMaterial({
          map: textTexture({ text: String(n), width: 96, height: 64, font: 'bold 40px Georgia', bg: '#d8cfba', color: '#2e2618' }),
          roughness: 0.7,
        })
      );
      plate.position.set(CW / 2 - 0.402, 1.5, z);
      plate.rotation.y = -Math.PI / 2;
      this.add(plate);
      const vent = new THREE.Mesh(
        new THREE.PlaneGeometry(0.26, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x4a5052, roughness: 0.8 })
      );
      vent.position.set(CW / 2 - 0.402, 1.24, z);
      vent.rotation.y = -Math.PI / 2;
      this.add(vent);

      if (n === 12) {
        this._locker12 = body;
        // its own door, on a pivot, and the key on its wool loop inside
        const pivot = new THREE.Group();
        pivot.position.set(CW / 2 - 0.4, 0.85, z - 0.18);
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 1.66, 0.34),
          new THREE.MeshStandardMaterial({ color: 0x717a7d, roughness: 0.55, metalness: 0.4 })
        );
        leaf.position.set(0, 0, 0.17);
        pivot.add(leaf);
        this.add(pivot);
        this._lockerLeaf = pivot;
        this._lockerAngle = 0;
        this._lockerTarget = 0;
        this.tick((dt) => {
          if (Math.abs(this._lockerTarget - this._lockerAngle) < 0.001) return;
          this._lockerAngle += (this._lockerTarget - this._lockerAngle) * Math.min(1, 3 * dt);
          pivot.rotation.y = this._lockerAngle;
        });
        // the key hangs on the inside of the door, hidden until the door swings
        const key = makeKeyProp();
        key.scale.setScalar(0.85);
        key.position.set(-0.04, 0.16, 0.2);
        key.rotation.z = 0.5;
        pivot.add(key);
        this._lockerKey = key;
        const loop = new THREE.Mesh(
          new THREE.TorusGeometry(0.035, 0.006, 6, 14),
          new THREE.MeshStandardMaterial({ color: 0xa8434a, roughness: 1 })
        );
        loop.position.set(-0.04, 0.22, 0.2);
        pivot.add(loop);
        this._lockerLoop = loop;
      } else {
        this.interact(body, {
          prompt: 'locker ' + n,
          onInteract: () => {
            this.playSound('locked');
            this.subtitle(lines[n % 3], 4);
          },
        });
      }
    }
  }

  // ---------- the rooms ----------

  _buildRooms() {
    this._buildOffice();
    this._buildClassroom1();
    this._buildCupboard2();
    this._buildMusicRoom();
    this._buildCupboard4();
    this._buildLockedRooms();
    this._buildHall();

    // the one key that still sounds, heard through the door of room 3
    this.loopAt('pianoKey', this._uprightPos, { freq: LevelBase.NOTES.E, every: 2.6 });
    // the tap behind door 5 (east side, z −21)
    this.loopAt('tap', { x: 3.5, y: 1.0, z: -21 }).setGain(0.4);
    // hall speaker
    this._box(0.3, 0.12, 0.3, this._greyMat, HALL_SPEAKER.x, HALL_SPEAKER.y, HALL_SPEAKER.z, { collide: false });

    // the figure for the corridor set-piece — hidden the moment it is made
    this._figure = makeFigure();
    this._figure.visible = false;
    this.add(this._figure);
  }

  _buildOffice() {
    this._roomShell({ x0: 1.3, x1: 5.3, z0: -4.5, z1: -1.5, side: 1 });
    const door = this._sideDoor(1, -3, { color: '#5f5140' });
    this._plate(1, -3, 'OFFICE', 0.34);
    this._openable(door, 1, null, 'the office door');

    const bulb = makeBulbLight({ y: 2.62, intensity: 5, distance: 9 });
    bulb.position.set(3.4, 0, -3.1);
    this.add(bulb);
    this._officeBulb = bulb;

    const desk = makeTable({ w: 1.3, d: 0.7, h: 0.74 });
    desk.position.set(3.6, 0, -3.6);
    this.add(desk);
    this.addCollider(desk);
    const chair = makeChair();
    chair.position.set(3.6, 0, -2.7);
    chair.rotation.y = Math.PI;
    this.add(chair);

    this._register = this._box(0.34, 0.05, 0.24,
      new THREE.MeshStandardMaterial({ color: 0x5b3f34, roughness: 0.85 }), 3.5, 0.79, -3.6, { collide: false });
    const pages = this._box(0.31, 0.02, 0.21,
      new THREE.MeshStandardMaterial({ color: 0xd8d0ba, roughness: 0.95 }), 3.5, 0.815, -3.6, { collide: false });
    void pages;

    // the tannoy panel and its paper label — the chime, written down
    this._tannoyPanel = this._box(0.1, 0.3, 0.4,
      new THREE.MeshStandardMaterial({ color: 0x6d6f68, roughness: 0.7 }), 5.2, 1.62, -3.0, { collide: false });
    const grille = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2e312e, roughness: 0.95 })
    );
    grille.position.set(5.145, 1.62, -3.0);
    grille.rotation.y = -Math.PI / 2;
    this.add(grille);
    const label = makeSign({
      text: 'chime: G · E — do not adjust', width: 0.4, height: 0.12, font: 'italic 26px Georgia',
    });
    label.position.set(5.28, 1.38, -3.0);
    label.rotation.y = -Math.PI / 2;
    this.add(label);

    const shelf = makeShelf({ w: 0.8, h: 1.6, d: 0.3 });
    shelf.position.set(1.75, 0, -4.02);
    shelf.rotation.y = Math.PI / 2;
    this.add(shelf);
    this.addCollider(shelf);

    // the clock the school keeps: it says 3:07, and goes on saying it
    const clock = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 28),
      new THREE.MeshStandardMaterial({ map: this._clockTexture(), roughness: 0.6 })
    );
    clock.position.set(3.4, 2.15, -1.62);
    clock.rotation.y = Math.PI;
    this.add(clock);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.165, 0.014, 8, 26),
      new THREE.MeshStandardMaterial({ color: 0x40474a, roughness: 0.6, metalness: 0.3 })
    );
    rim.position.set(3.4, 2.15, -1.63);
    this.add(rim);
  }

  _clockTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e6e2d6';
    ctx.beginPath(); ctx.arc(128, 128, 128, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2e2c28';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = i % 3 === 0 ? 7 : 3;
      ctx.beginPath();
      ctx.moveTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104);
      ctx.lineTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118);
      ctx.stroke();
    }
    const hand = (angle, len, w) => {
      ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + Math.sin(angle) * len, 128 - Math.cos(angle) * len);
      ctx.stroke();
    };
    hand(((3 + 7 / 60) / 12) * Math.PI * 2, 62, 11);   // 3:07
    hand((7 / 60) * Math.PI * 2, 96, 7);
    ctx.fillStyle = '#2e2c28';
    ctx.beginPath(); ctx.arc(128, 128, 8, 0, Math.PI * 2); ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildClassroom1() {
    this._roomShell({ x0: -7.3, x1: -1.3, z0: -13.5, z1: -8.5, side: -1 });
    const door = this._sideDoor(-1, -11);
    this._plate(-1, -11, '1');
    this._openable(door, 1, null, 'door 1');

    this._classroomFurniture([-5.7, -3.2], [-9.4, -10.6, -11.8, -13.0], 8);
    this._windows(-7.28, [-9.4, -12.6], 1);
    const lamp = new THREE.PointLight(0x8ea0bc, 6.5, 13, 1.6);
    lamp.position.set(-5.4, 2.45, -11);
    this.add(lamp);

    const board = makeSign({
      text: '4 · 2 · 3 · 6 =', width: 2, height: 1,
      bg: '#2f3a34', color: '#e0dccf', font: 'italic 64px Georgia',
    });
    board.position.set(-7.18, 1.55, -11);
    board.rotation.y = Math.PI / 2;
    this.add(board);
    this._box(2.1, 1.1, 0.04, new THREE.MeshStandardMaterial({ color: 0x5d4a33, roughness: 0.85 }),
      -7.22, 1.55, -11, { collide: false }).rotation.y = Math.PI / 2;
    this.interact(board, {
      prompt: 'the board',
      onInteract: () => this.subtitle("Somebody's sum. The answer is rubbed out.", 5),
    });
  }

  /** Desks in rows, chairs upended on them: legs up, backs hooked over the near edge. */
  _classroomFurniture(columns, rows, count) {
    let n = 0;
    for (const z of rows) {
      for (const x of columns) {
        if (n++ >= count) break;
        const desk = makeTable({ w: 1.05, d: 0.6, h: 0.74 });
        desk.position.set(x, 0, z);
        this.add(desk);
        this.addCollider(desk);
        const chair = makeChair();
        chair.rotation.x = Math.PI;
        chair.position.set(x, 1.21, z + 0.42);
        this.add(chair);
      }
    }
  }

  _windows(x, zs, facing) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x16202c, emissive: 0x39485f, emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.1,
    });
    const barMat = new THREE.MeshStandardMaterial({ color: 0x4d4a41, roughness: 0.9 });
    for (const z of zs) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), glassMat);
      glass.position.set(x, 1.75, z);
      glass.rotation.y = facing * Math.PI / 2;
      this.add(glass);
      for (const dz of [-0.47, 0, 0.47]) {
        this._box(0.04, 1.3, 0.05, barMat, x + facing * 0.02, 1.75, z + dz, { collide: false });
      }
      this._box(0.05, 0.05, 1.5, barMat, x + facing * 0.02, 1.14, z, { collide: false });
      this._box(0.05, 0.05, 1.5, barMat, x + facing * 0.02, 2.36, z, { collide: false });
    }
  }

  _buildCupboard2() {
    this._roomShell({
      x0: -2.7, x1: -1.3, z0: -17.7, z1: -16.3, side: -1,
      floorMat: makeMat('concrete', { base: '#6d6a63', repeat: [1, 1] }),
    });
    const door = this._sideDoor(-1, -17, { color: '#5c4c3a' });
    this._plate(-1, -17, '2');
    this._openable(door, 1, () => this.after(0.8, () => this._cupboard2Line()), 'door 2');

    const shelf = makeShelf({ w: 1.2, h: 1.7, d: 0.32 });
    shelf.position.set(-2.5, 0, -17.0);
    shelf.rotation.y = Math.PI / 2;
    this.add(shelf);
    this.addCollider(shelf);
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.12, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x3f5a63, roughness: 0.75 })
    );
    bucket.position.set(-1.75, 0.14, -17.4);
    this.add(bucket);
    const mop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 0.9 })
    );
    mop.position.set(-1.85, 0.65, -16.6);
    mop.rotation.z = 0.18;
    this.add(mop);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x9b9683, roughness: 1 })
    );
    head.position.set(-1.97, 0.1, -16.6);
    this.add(head);
    const bottles = new THREE.MeshStandardMaterial({ color: 0xc9c4a8, roughness: 0.6 });
    for (const [bx, bz, by] of [[-2.5, -17.2, 0.52], [-2.42, -16.85, 0.52], [-2.55, -16.95, 0.92]]) {
      this._box(0.1, 0.22, 0.1, bottles, bx, by, bz, { collide: false });
    }

    this._cupboard2Line = () => this._once('cupboard2', () => this.subtitle('Buckets. Bleach. A mop with its head down.', 5));
    this.tick(() => {
      const p = this.game.player.position;
      if (p.x < -1.45 && p.z < -16.2 && p.z > -17.8) this._cupboard2Line();
    });
  }

  _buildMusicRoom() {
    this._roomShell({ x0: -7.3, x1: -1.3, z0: -25.5, z1: -20.5, side: -1 });
    this._door3 = this._sideDoor(-1, -23);
    this._plate(-1, -23, '3');

    this._classroomFurniture([-5.7, -3.2], [-21.6, -22.8, -24.0], 6);
    // one chair down at the front desk
    const chair = makeChair();
    chair.position.set(-4.85, 0, -21.6);
    chair.rotation.y = -Math.PI / 2 + 0.2;
    this.add(chair);

    this._windows(-7.28, [-24.8], 1);
    const lamp = new THREE.PointLight(0x8ea0bc, 6.5, 13, 1.6);
    lamp.position.set(-5.2, 2.45, -22.6);
    this.add(lamp);

    // the upright against the far wall — the source of the one note
    const upright = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a2c24, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 1.4), bodyMat);
    body.position.set(-6.95, 0.6, -23);
    body.castShadow = true;
    upright.add(body);
    const keys = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.04, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.5 })
    );
    keys.position.set(-6.57, 0.94, -23);
    upright.add(keys);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 1.44), bodyMat);
    lid.position.set(-6.95, 1.22, -23);
    upright.add(lid);
    for (const dz of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), bodyMat);
      leg.position.set(-6.62, 0.3, -23 + dz);
      upright.add(leg);
    }
    this.add(upright);
    this.addCollider(body);
    this._uprightPos = { x: -6.5, y: 1.05, z: -23 };
    this.interact(upright, {
      prompt: 'the upright piano',
      onInteract: () => {
        this.playSoundAt('piano', this._uprightPos, { freq: LevelBase.NOTES.E });
        this.subtitle('Only one key still sounds. E. The rest are dead.', 5);
      },
    });

    // the board: five of the seven, and two rubbed out
    this._board = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1),
      new THREE.MeshStandardMaterial({ map: this._boardTexture(), roughness: 0.92 })
    );
    this._board.position.set(-7.18, 1.55, -21.5);
    this._board.rotation.y = Math.PI / 2;
    this.add(this._board);
    this._box(2.1, 1.1, 0.04, new THREE.MeshStandardMaterial({ color: 0x5d4a33, roughness: 0.85 }),
      -7.22, 1.55, -21.5, { collide: false }).rotation.y = Math.PI / 2;
  }

  _boardTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2f3a34';
    ctx.fillRect(0, 0, 512, 256);
    // chalk dust, wiped in arcs
    for (let i = 0; i < 14; i++) {
      const g = ctx.createRadialGradient(Math.random() * 512, Math.random() * 256, 4, Math.random() * 512, Math.random() * 256, 90);
      g.addColorStop(0, 'rgba(224,220,207,0.05)');
      g.addColorStop(1, 'rgba(224,220,207,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 256);
    }
    ctx.fillStyle = '#e0dccf';
    ctx.font = 'italic 54px Georgia';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('our song', 44, 66);
    ctx.font = 'italic 60px Georgia';
    'EGAGE'.split('').forEach((n, i) => ctx.fillText(n, 44 + i * 62, 168));
    // the last two, rubbed out: chalk clouds where the letters were
    for (const x of [44 + 5 * 62, 44 + 6 * 62]) {
      const g = ctx.createRadialGradient(x + 18, 168, 3, x + 18, 168, 40);
      g.addColorStop(0, 'rgba(224,220,207,0.34)');
      g.addColorStop(0.6, 'rgba(224,220,207,0.14)');
      g.addColorStop(1, 'rgba(224,220,207,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 26, 120, 90, 96);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  _buildCupboard4() {
    this._roomShell({
      x0: 1.3, x1: 2.7, z0: -15.7, z1: -14.3, side: 1,
      floorMat: makeMat('concrete', { base: '#6d6a63', repeat: [1, 1] }),
    });
    this._door4 = this._sideDoor(1, -15, { color: '#5c4c3a' });
    this._plate(1, -15, '4');

    const shelf = makeShelf({ w: 1.2, h: 1.7, d: 0.32 });
    shelf.position.set(2.5, 0, -15.0);
    shelf.rotation.y = -Math.PI / 2;
    this.add(shelf);
    this.addCollider(shelf);
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 0.9 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x9b9683, roughness: 1 });
    for (const [mx, mz, tilt] of [[1.62, -14.6, 0.16], [1.72, -14.9, -0.1], [1.66, -15.35, 0.2]]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 6), stickMat);
      stick.position.set(mx, 0.67, mz);
      stick.rotation.z = tilt;
      this.add(stick);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), headMat);
      head.position.set(mx - tilt * 0.6, 0.09, mz);
      this.add(head);
    }
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.12, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x3f5a63, roughness: 0.75 })
    );
    bucket.position.set(2.1, 0.14, -15.45);
    this.add(bucket);

    this._cupboard4Line = () => this._once('cupboard4', () =>
      this.subtitle('Mops. A bucket. Whoever numbered the doors did it in the dark.', 6));
    this.tick(() => {
      const p = this.game.player.position;
      if (p.x > 1.45 && p.z < -14.2 && p.z > -15.8) this._cupboard4Line();
    });
  }

  _buildLockedRooms() {
    const lines = {
      5: 'Locked. Behind it, a tap is running.',
      6: 'Locked.',
    };
    for (const [n, z] of [[5, -21], [6, -27]]) {
      const door = this._sideDoor(1, z, { color: '#5f5140' });
      this._plate(1, z, String(n));
      // a blind wall right behind it: nothing to see through the seams
      this._box(0.3, CH, 1.6, this._roomWallMat, CW / 2 + 0.35, CH / 2, z);
      this.interact(door, {
        prompt: 'door ' + n,
        onInteract: () => {
          this.playSound('locked');
          this.subtitle(lines[n], 4);
        },
      });
    }
  }

  // ---------- the hall ----------

  _buildHall() {
    const H = 5;
    this._floor(14, 10, this._hallFloorMat, 0, -35);
    this._ceiling(14, 10, this._roomCeilMat, 0, -35, H);

    // north wall, with the double doorway
    this._box(6, H, 0.3, this._hallWallMat, -4, H / 2, -30);
    this._box(6, H, 0.3, this._hallWallMat, 4, H / 2, -30);
    this._box(2, H - 2.1, 0.3, this._hallWallMat, 0, 2.1 + (H - 2.1) / 2, -30);
    // west wall, south wall
    this._box(0.3, H, 10.6, this._hallWallMat, -7.15, H / 2, -35);
    this._box(14.6, H, 0.3, this._hallWallMat, 0, H / 2, -40.15);
    // east wall, with the fire doorway at z −37
    this._box(0.3, H, 6.5, this._hallWallMat, 7.15, H / 2, -33.25);
    this._box(0.3, H, 2.5, this._hallWallMat, 7.15, H / 2, -38.75);
    this._box(0.3, H - 2.1, 1.0, this._hallWallMat, 7.15, 2.1 + (H - 2.1) / 2, -37);

    this.add(new THREE.HemisphereLight(0x6b7280, 0x14161a, 0.25));
    for (const [x, z, inten] of [[-2.6, -33, 6], [2.6, -35.6, 6]]) {
      const bulb = makeBulbLight({ y: 4.6, intensity: inten, distance: 16 });
      bulb.position.set(x, 0, z);
      this.add(bulb);
    }
    const stageLamp = makeBulbLight({ y: 4.4, intensity: 7, distance: 13, color: 0xffdcb0 });
    stageLamp.position.set(-4, 0, -37.7);
    this.add(stageLamp);

    // the double doors
    const group = new THREE.Group();
    const mk = (x, flip) => {
      const d = makeDoor({ width: 0.9, color: '#5a4c3a', frameColor: '#3f3830' });
      d.position.set(x, 0, -29.88);
      if (flip) d.rotation.y = Math.PI;
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x141a1c, roughness: 0.25, metalness: 0.2 })
      );
      glass.position.set(0, 0.42, 0.03);
      d.panel.add(glass);
      const back = glass.clone();
      back.position.z = -0.03;
      back.rotation.y = Math.PI;
      d.panel.add(back);
      group.add(d);
      this.track(d);
      return d;
    };
    const left = mk(-0.5, false), right = mk(0.5, true);
    this.add(group);
    this.addCollider(left.panel);
    this.addCollider(right.panel);
    this._hallDoors = group;
    this._hallDoorPanels = [left.panel, right.panel];
    this._hallLeaves = [left, right];
    const hallSign = makeSign({
      text: 'HALL', width: 0.6, height: 0.18, font: 'bold 46px Georgia', bg: '#c9c2ae', color: '#33302a',
    });
    hallSign.position.set(0, 2.42, -29.83);
    this.add(hallSign);

    // stacked chairs down the sides
    for (const side of [-1, 1]) {
      for (let s = 0; s < 3; s++) {
        const z = -32.2 - s * 2.2;
        for (let k = 0; k < 3; k++) {
          const ch = makeChair();
          ch.position.set(side * 6.1, k * 0.46, z);
          ch.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          this.add(ch);
          if (k === 0) this.addCollider(ch);
        }
      }
    }

    // The stage, in two slabs: the full-width back, and an apron in front of it
    // that stops 1.6 m short of the east wall. The gap is the corner in front of
    // the fire door — the stage top is 0.6 m up, and the fire doorway's head is
    // at 2.1 m, so a player standing on the stage there would have 1.5 m of
    // headroom and could not walk out. On the hall floor they have 2.1 m.
    // Neither slab collides: 0.6 m is above the 0.55 m step-up, so a solid one
    // would be a wall with no way over it. As ground, the downward raycast lifts
    // the player and they walk up the front edge.
    const stageMat = makeMat('wood', { base: '#5f4a33', repeat: [8, 2] });
    const back = this._box(14, 0.6, 2.3, stageMat, 0, 0.3, -39.05, { collide: false });
    this.addGround(back);
    const apron = this._box(12.4, 0.6, 1.1, stageMat, -0.8, 0.3, -37.35, { collide: false });
    this.addGround(apron);
    // the lip along the exposed edges, including the two sides of the notch
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x33291d, roughness: 0.9 });
    this._box(12.4, 0.06, 0.06, skirtMat, -0.8, 0.6, STAGE_FRONT, { collide: false });
    this._box(0.06, 0.06, 1.1, skirtMat, 5.4, 0.6, -37.35, { collide: false });
    this._box(1.6, 0.06, 0.06, skirtMat, 6.2, 0.6, STAGE_NOTCH, { collide: false });
    // the curtain behind it: a backdrop with folds
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x4a2a2e, roughness: 1 });
    const foldMat = new THREE.MeshStandardMaterial({ color: 0x5a353a, roughness: 1 });
    this._box(13.8, 3.8, 0.12, curtainMat, 0, 2.5, -39.86, { collide: false });
    for (let i = 0; i < 16; i++) {
      const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 3.8, 7), foldMat);
      fold.position.set(-6.6 + i * 0.88, 2.5, -39.74);
      this.add(fold);
    }
    const pelmet = this._box(13.8, 0.34, 0.24, curtainMat, 0, 4.55, -39.8, { collide: false });
    void pelmet;

    this._buildGrand();
    this._buildFireDoor();
  }

  _buildGrand() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.45, metalness: 0.15 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.4), bodyMat);
    body.position.set(-4, 1.45, -38.5);
    body.castShadow = true;
    g.add(body);
    for (const [lx, lz] of [[-0.65, 0.55], [0.65, 0.55], [0, -0.55]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.67, 8), bodyMat);
      leg.position.set(-4 + lx, 0.94, -38.5 + lz);
      g.add(leg);
    }
    const keys = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.03, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.45 })
    );
    keys.position.set(-4, 1.635, -37.92);
    g.add(keys);
    const fall = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.06), bodyMat);
    fall.position.set(-4, 1.68, -38.06);
    g.add(fall);

    // the lid, hinged along the back edge
    const lidPivot = new THREE.Group();
    lidPivot.position.set(-4, 1.625, -39.2);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 1.3), bodyMat);
    lid.position.set(0, 0.015, 0.65);
    lidPivot.add(lid);
    lidPivot.rotation.x = LID_UP;
    g.add(lidPivot);
    this._lid = lidPivot;

    this.add(g);
    this.addCollider(body);
    this._piano = g;

    // the stool
    const stool = new THREE.Group();
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0x4a3928, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.32), stoolMat);
    seat.position.y = 0.48;
    stool.add(seat);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), stoolMat);
      leg.position.set(sx * 0.22, 0.225, sz * 0.12);
      stool.add(leg);
    }
    stool.position.set(-4, 0.6, -37.4);
    this.add(stool);
    this._stool = stool;
  }

  _buildFireDoor() {
    this._fireDoor = makeDoor({ width: 1.0, color: '#4f5a5e', frameColor: '#3a4043' });
    this._fireDoor.position.set(7, 0, -37);
    this._fireDoor.rotation.y = -Math.PI / 2;
    this.add(this._fireDoor);
    this.track(this._fireDoor);
    this.addCollider(this._fireDoor.panel);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.82),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a2, roughness: 0.35, metalness: 0.8 })
    );
    bar.position.set(6.92, 1.06, -37);
    this.add(bar);
    const sign = makeSign({
      text: 'PLAYGROUND', width: 0.5, height: 0.14, font: 'bold 40px Georgia', bg: '#c9c2ae', color: '#33302a',
    });
    sign.position.set(6.93, 1.66, -37);
    sign.rotation.y = -Math.PI / 2;
    this.add(sign);

    // the stub beyond it
    const stubFloor = makeMat('concrete', { base: '#5f5d58', repeat: [2, 1] });
    this._floor(3.4, 1.8, stubFloor, 8.7, -37);
    this._ceiling(3.4, 1.8, this._roomCeilMat, 8.7, -37, 2.3);
    this._box(3.6, 2.3, 0.2, this._hallWallMat, 8.7, 1.15, -37.9);
    this._box(3.6, 2.3, 0.2, this._hallWallMat, 8.7, 1.15, -36.1);
    this._box(0.2, 2.3, 1.8, this._hallWallMat, 10.3, 1.15, -37);
    const lamp = new THREE.PointLight(0xbcd0c4, 1.6, 6, 1.7);
    lamp.position.set(9.2, 2.05, -37);
    this.add(lamp);
    this._box(0.3, 0.12, 0.05, new THREE.MeshStandardMaterial({
      color: 0x1d3a2a, emissive: 0x2f7a52, emissiveIntensity: 1.4,
    }), 9.9, 2.1, -36.22, { collide: false });
  }

  // ---------- doors, puzzle wiring ----------

  _once(key, fn) {
    this._onceFlags ??= new Set();
    if (this._onceFlags.has(key)) return;
    this._onceFlags.add(key);
    fn();
  }

  _openable(door, dir, onOpen, prompt = 'the door') {
    let open = false;
    this.interact(door, {
      prompt,
      onInteract: () => {
        if (open) return;
        open = true;
        door.setOpen(true, dir);
        this.removeColliderOf(door.panel);
        this.playSound('door');
        onOpen?.();
      },
    });
  }

  _wirePuzzle() {
    const s = this;
    this._hasNote = false;
    this._lightsDone = false;
    this._tuneDone = false;
    this._wrongTune = 0;
    this._figureDone = false;

    // the peg with the sunflower → the timetable in the coat pocket
    this.interact(this._pegCard, {
      prompt: 'the peg with the sunflower',
      once: true,
      onInteract: () => {
        this.subtitle('Your peg. No name — she drew a sunflower so you would know it.', 5);
        this.after(1.6, () => {
          this.giveNote({
            id: 'l13-timetable',
            title: 'a timetable, folded small, in the coat pocket',
            body:
              'MON — music, rm 4\nTUE — sums\nWED — reading\nTHU — nature\nFRI — hall\nSUN — home\n\n' +
              'the tune from the wireless. you played it for me\non the hall piano. once, then never again.\n\n' +
              '— M.',
          });
          this._hasNote = true;
          this.setObjective('music. room 4.');
        });
      },
    });

    // locker 12: the hall key
    this.interact(this._locker12, {
      prompt: 'locker 12',
      once: true,
      onInteract: () => {
        this.playSound('handle');
        this._lockerTarget = -1.0;
        this._lockerKey.visible = true;
        this.after(0.6, () => {
          this._lockerKey.visible = false;
          this._lockerLoop.visible = false;
          this.giveItem({ id: 'hall-key', name: 'a small key on a wool loop' });
          this.subtitle('HALL, in her writing on the tag.', 4);
        });
      },
    });

    // door 4 lies; door 3 is the music room
    this._openable(this._door4, 1, () => this.after(0.8, () => this._cupboard4Line()), 'door 4');
    this._openable(this._door3, 1, null, 'door 3');

    this.interact(this._board, {
      prompt: 'the board',
      once: true,
      onInteract: () => {
        this.learnClue({
          id: 'l13-board',
          title: 'the board in the music room',
          body: 'our song — E G A G E, and two more, rubbed out.',
        });
        this.setObjective('the last two notes');
      },
    });

    this.interact(this._register, {
      prompt: 'the register',
      onInteract: () => this.subtitle('The register. A line for every child. Yours says "left early", every day but Sunday.', 6),
    });

    this.interact(this._tannoyPanel, {
      prompt: 'the tannoy panel',
      onInteract: () => this.learnClue({
        id: 'l13-tannoy',
        title: 'the tannoy panel',
        body: 'chime: G, then E. do not adjust.',
      }),
    });

    // the hall doors want the wool loop
    this._hallOpen = false;
    this.interact(this._hallDoors, {
      prompt: 'the hall doors',
      onInteract: () => {
        if (this._hallOpen) return;
        if (!this.hasItem('hall-key')) {
          this.playSound('locked');
          this.subtitle('Locked. HALL, stencilled on the glass. Your locker had a key.', 5);
          return;
        }
        this._hallOpen = true;
        this.playSound('unlock');
        this.playSound('door');
        this._hallLeaves[0].setOpen(true, 1);
        this._hallLeaves[1].setOpen(true, -1);
        for (const p of this._hallDoorPanels) this.removeColliderOf(p);
      },
    });

    // the tannoy chime, from the nearest speaker, every 24 s; the first at 10 s
    const chime = () => {
      const p = s.game.player.position;
      const spk = SPEAKERS.reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b));
      this.playSoundAt('chime', spk);
      this.cue('the tannoy chime', spk);
      this.after(24, chime);
    };
    this.after(10, chime);

    // the corridor lights: once, deep in, facing away from the way you came
    this.tick(() => {
      if (this._lightsDone || !this._hasNote) return;
      const p = s.game.player.position;
      if (p.z < -14 && Math.abs(p.x) < 1.4 && !this.isSeen(this._entranceMarker, { angleDeg: 60 })) {
        this._lightsDone = true;
        this._runLights();
      }
    });

    // the hall piano
    this.interact(this._piano, {
      prompt: 'the hall piano',
      onInteract: () => {
        if (this._tuneDone) {
          this.subtitle('It has already played. It does not need you now.', 4);
          return;
        }
        s.game.ui.showKeypad({
          label: 'the hall piano — seven notes',
          length: 7,
          keys: 'CDEFGAB',
          onKey: (k) => this.playSoundAt('piano', PIANO_POS, { freq: LevelBase.NOTES[k] }),
          onSubmit: (code) => (code === TUNE ? this._tuneRight() : this._tuneWrong()),
        });
      },
    });

    // the fire door by the stage
    this._fireOpen = false;
    this.interact(this._fireDoor, {
      prompt: 'PLAYGROUND',
      onInteract: () => {
        if (this._fireOpen) return;
        this.playSound('locked');
        this.subtitle('Locked. PLAYGROUND, on the bar. It will open when the song does.', 5);
      },
    });

    this.tick(() => {
      if (this._fireOpen && !this.isCompleted && s.game.player.position.x > 9.5) this.complete();
    });
  }

  // ---------- the lights, and the shape under them ----------

  _tubeOff(i) {
    const tb = this._tubes[i];
    if (!tb) return null;
    this._tracked.delete(tb.fix);          // stop its own flicker, if it had one
    tb.light.intensity = 0;
    tb.tubeMat.emissiveIntensity = 0.05;
    const pos = { x: 0, y: 2.9, z: tb.z };
    this.playSoundAt('clunk', pos);
    return pos;
  }

  _runLights() {
    const pz = this.game.player.position.z;
    let p = 0, best = Infinity;
    this._tubes.forEach((tb, i) => {
      const d = Math.abs(tb.z - pz);
      if (d < best) { best = d; p = i; }
    });
    if (p < 3) return;                      // cannot happen (the trigger needs z < −14); guard anyway
    for (let i = 0; i <= p - 3; i++) {
      this.after(i * 0.9, () => {
        const pos = this._tubeOff(i);
        if (i === 0 && pos) this.cue('a light going out', pos);
      });
    }
    this.after(Math.max(0, p - 2) * 0.9, () => {
      const fz = this._tubes[p - 2].z;
      this._figure.position.set(0, 0, fz);
      this._figure.faceToward(this.game.player.position);
      this._figure.visible = true;
      // it goes when you look at it — and it never lets you get near it
      this._figureSeenOff = this.whenSeen(this._figure, () => this._resolveFigure(p), { minTime: 1.0 });
      this._figureGuardOff = this.tick(() => {
        if (!this._figure.visible) return;
        const pp = this.game.player.position;
        if (Math.hypot(pp.x - this._figure.position.x, pp.z - fz) < 3.2) this._resolveFigure(p);
      });
      this.after(30, () => this._resolveFigure(p));
    });
  }

  _resolveFigure(p) {
    if (this._figureDone) return;
    this._figureDone = true;
    this._figureSeenOff?.();
    this._figureGuardOff?.();
    this._tubeOff(p - 2);
    this._figure.visible = false;
    this.flinch();
    this.dread(0.55);
    this.after(1.0, () => this._tubeOff(p - 1));
    this.after(2.2, () => this._flickerHold(p));
  }

  _flickerHold(p) {
    const tb = this._tubes[p];
    if (!tb) return;
    this._tracked.delete(tb.fix);
    let n = 0;
    const flick = () => {
      if (n++ > 10) {
        tb.light.intensity = 4.5;
        tb.tubeMat.emissiveIntensity = 2.6;
        this.subtitle('The corridor behind you is dark now. The office keeps its light. Nothing else does.', 6);
        return;
      }
      const on = Math.random() > 0.5;
      tb.light.intensity = on ? 4.5 : 0.4;
      tb.tubeMat.emissiveIntensity = on ? 2.6 : 0.3;
      this.after(0.08 + Math.random() * 0.25, flick);
    };
    flick();
  }

  // ---------- the tune ----------

  _tuneWrong() {
    this.playSound('wrong');
    this._wrongTune++;
    if (this._wrongTune >= 3) {
      this.subtitle('The board had five of them. The school has been chiming the other two all night.', 7);
    } else {
      this.subtitle('Not how it went. She would have said so, gently.', 5);
    }
    this._lid.rotation.x = LID_DOWN;
    this.after(2, () => { this._lid.rotation.x = LID_UP; });
  }

  _tuneRight() {
    this._tuneDone = true;
    this.hush(2);
    const notes = LevelBase.tune(TUNE);
    this.after(0.8, () => {
      for (let r = 0; r < 2; r++) {
        notes.forEach((f, i) => this.after(r * 4 + i * 0.5, () => this.playSoundAt('piano', PIANO_POS, { freq: f })));
      }
    });
    this._stool.position.z += 0.4;
    this.playSound('door');
    this.playSound('unlock');
    this._fireDoor.setOpen(true, 1);          // swings into the stub, +X
    this.removeColliderOf(this._fireDoor.panel);
    this._fireOpen = true;
    this.setObjective('the door by the stage');
    this.subtitle('It carries on without you. All the way to the end.', 6);
    this.after(6, () => {
      this.playSoundAt('breath', HALL_SPEAKER);
      this.cue('a breath, over the tannoy', HALL_SPEAKER);
    });
  }

  // ---------- playtest ----------

  async debugSolve() {
    this.debugInteract(this._pegCard);        // the coat pocket gives the timetable at 1.6 s
    await this.debugWait(2.0);
    this.game.ui.closeModal();
    this.debugInteract(this._locker12);       // the key arrives 0.6 s later
    await this.debugWait(0.9);
    this.debugInteract(this._hallDoors);
    await this.debugWait(0.4);
    this.debugInteract(this._door3);
    await this.debugWait(0.3);
    this.debugInteract(this._board);
    await this.debugWait(0.3);
    this.debugInteract(this._piano);          // opens the keypad
    await this.debugWait(0.4);
    this.game.ui.submitKeypad(TUNE);          // through the keypad's own onSubmit
    await this.debugWait(1.5);
    this.game.player.teleport(9.8, -37);      // into the stub, past x 9.5
    await this.debugWait(0.8);
  }
}
