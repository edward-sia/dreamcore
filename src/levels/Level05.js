import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp,
  makeTable, makeChair, makeShelf, makePictureFrame, makeDust, applyFog,
} from '../core/props.js';

// V — The House
// The childhood house, rain-dark and unlit: entry hall, sitting room,
// kitchen, and stairs to a landing with one door, light waiting under it.
// The fuse box in the kitchen knows five switches; M.'s note remembers an
// evening, not an order. Supper is the kitchen, slippers are the hall, the
// wireless is the sitting room — light them the way she did, yours last,
// and the small key comes back into the light.

const HW = 7.6;            // half interior width (walls at ±HW)
const FRONT = 4.6;         // front wall z
const BACK = -6.2;         // back wall z
const CEIL = 2.7;          // ground-floor ceiling
const TALL = 4.5;          // stairwell ceiling
const HALL = 1.5;          // hall partitions at ±HALL
const LAND_Y = 1.8;        // landing height
const STAIR_Z0 = -1.6;     // first tread front edge
const RISE = 0.18, TREAD = 0.27, STEPS = 10;
const ORDER = ['kitchen', 'hall', 'sitting', 'yours'];
const LIT_LINES = {
  kitchen: 'The kitchen wakes first. Supper before slippers.',
  hall: 'Then the hall, where the slippers waited by the mat.',
  sitting: 'Then the sitting room, and the wireless finds its voice again.',
  yours: 'And yours last, so the dark never caught you on the stairs.',
};

// rain on black glass — the only weather this house gets now
function rainPaneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#131a28');
  g.addColorStop(1, '#0b0e16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    let x = Math.random() * 256, y = -10;
    ctx.strokeStyle = `rgba(150,172,206,${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < 266) {
      y += 14 + Math.random() * 22;
      x += (Math.random() - 0.5) * 3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(170,190,220,0.16)';
  for (let i = 0; i < 70; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 0.7 + Math.random() * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the grandfather clock's face, hands stopped where the evening left them
function clockFaceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1712';
  ctx.fillRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.fillStyle = '#d3c9b0';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#43392b';
  ctx.stroke();
  ctx.strokeStyle = '#4a4234';
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86);
    ctx.lineTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
    ctx.stroke();
  }
  ctx.strokeStyle = '#332e24';
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;                       // hour hand
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(2.62) * 50, 128 + Math.sin(2.62) * 50);
  ctx.stroke();
  ctx.lineWidth = 4;                       // minute hand
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(-0.55) * 78, 128 + Math.sin(-0.55) * 78);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// figures too blurred to name, like the ones in the hallway
function blurredPhotoTexture(figures) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 128, 96);
  g.addColorStop(0, '#94897a');
  g.addColorStop(1, '#665f53');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = 'rgba(56,50,44,0.55)';
  for (let f = 0; f < figures; f++) {
    ctx.beginPath();
    ctx.ellipse(28 + f * 30, 54, 9, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(28 + f * 30, 33, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'blur(2px)';
  ctx.drawImage(c, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default class Level05 extends LevelBase {
  static meta = {
    id: 5,
    numeral: 'V',
    title: 'The House',
    mood: 'home',
    intro: 'This is the house, the whole of it dark except the rain, every room waiting its turn for the light.',
    outro:
      'Supper, then slippers, then the wireless, and yours always last.\n' +
      'The dark never caught you once. She saw to that,\n' +
      'every evening, for longer than you ever thought to notice.',
  };

  build() {
    applyFog(this.scene, '#0c0e13', 2.5, 22);

    // ---------- materials ----------
    const hallWallMat = makeMat('wallpaper', { base: '#93826d', stripe: '#867561', repeat: [4, 1.35] });
    const sitWallMat = makeMat('wallpaper', { base: '#7e6f67', stripe: '#72635d', repeat: [5, 1.35] });
    const kitWallMat = makeMat('plaster', { base: '#989d8c', repeat: [4, 1.4] });
    const pocketWallMat = makeMat('wallpaper', { base: '#a68d6d', stripe: '#99805f', repeat: [3, 1.3] });
    const ceilMat = makeMat('plaster', { base: '#8e8779', repeat: [3, 6] });
    const woodFloorMat = makeMat('wood', { base: '#5c4836', repeat: [2, 4] });
    const treadMat = makeMat('wood', { base: '#584431', repeat: [1.6, 0.5] });
    const rainMat = new THREE.MeshStandardMaterial({
      map: rainPaneTexture(), roughness: 0.22, metalness: 0.3,
      emissive: 0x94aed6, emissiveIntensity: 0.95,
      emissiveMap: rainPaneTexture(),
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x322c24, roughness: 0.8 });
    const darkWoodMat = makeMat('wood', { base: '#463525', repeat: [1, 2] });

    const wall = (w, h, d, x, y, z, mat, collide = true) => {
      const m = makeWall(w, h, d, mat);
      m.position.set(x, y, z);
      this.add(m);
      if (collide) this.addCollider(m);
      return m;
    };

    // ---------- floors & ceilings ----------
    const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 6.3), woodFloorMat);
    hallFloor.rotation.x = -Math.PI / 2;
    hallFloor.position.set(0, 0, 1.45);
    hallFloor.receiveShadow = true;
    this.add(hallFloor);
    this.addGround(hallFloor);

    const sitFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(6.1, 10.8),
      makeMat('carpet', { base: '#63564d', repeat: [4, 7] })
    );
    sitFloor.rotation.x = -Math.PI / 2;
    sitFloor.position.set(-4.55, 0, -0.8);
    sitFloor.receiveShadow = true;
    this.add(sitFloor);
    this.addGround(sitFloor);

    const kitFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(6.1, 10.8),
      makeMat('checker', { a: '#b3ab99', b: '#6b685f', repeat: [4, 7] })
    );
    kitFloor.rotation.x = -Math.PI / 2;
    kitFloor.position.set(4.55, 0, -0.8);
    kitFloor.receiveShadow = true;
    this.add(kitFloor);
    this.addGround(kitFloor);

    const hallCeil = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 6.2), ceilMat);
    hallCeil.rotation.x = Math.PI / 2;
    hallCeil.position.set(0, CEIL, 1.5);
    this.add(hallCeil);
    const stairCeil = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.6), ceilMat);
    stairCeil.rotation.x = Math.PI / 2;
    stairCeil.position.set(0, TALL, -3.9);
    this.add(stairCeil);
    for (const sx of [-1, 1]) {
      const wingCeil = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 10.8), ceilMat);
      wingCeil.rotation.x = Math.PI / 2;
      wingCeil.position.set(sx * 4.55, CEIL, -0.8);
      this.add(wingCeil);
    }
    // the ceiling steps up over the stairs; this face closes the seam
    wall(3.0, TALL - CEIL, 0.12, 0, CEIL + (TALL - CEIL) / 2, STAIR_Z0, hallWallMat, false);

    // ---------- exterior walls ----------
    // front (+z), parted around the front door
    wall(HW - 0.55, CEIL, 0.24, -(0.55 + (HW - 0.55) / 2), CEIL / 2, FRONT, hallWallMat);
    wall(HW - 0.55, CEIL, 0.24, 0.55 + (HW - 0.55) / 2, CEIL / 2, FRONT, hallWallMat);
    wall(1.1, CEIL - 2.1, 0.24, 0, 2.1 + (CEIL - 2.1) / 2, FRONT, hallWallMat, false);
    // sides
    wall(0.24, CEIL, FRONT - BACK + 0.4, -HW, CEIL / 2, (FRONT + BACK) / 2, sitWallMat);
    wall(0.24, CEIL, FRONT - BACK + 0.4, HW, CEIL / 2, (FRONT + BACK) / 2, kitWallMat);
    // back (−z): wings, then the tall hall strip parted around the upstairs door
    wall(HW - HALL, CEIL, 0.24, -(HALL + (HW - HALL) / 2), CEIL / 2, BACK, sitWallMat);
    wall(HW - HALL, CEIL, 0.24, HALL + (HW - HALL) / 2, CEIL / 2, BACK, kitWallMat);
    wall(1.0, TALL, 0.24, -1.0, TALL / 2, BACK, hallWallMat);
    wall(1.0, TALL, 0.24, 1.0, TALL / 2, BACK, hallWallMat);
    wall(1.0, LAND_Y, 0.24, 0, LAND_Y / 2, BACK, hallWallMat);              // riser below the door
    wall(1.0, TALL - (LAND_Y + 2.1), 0.24, 0, LAND_Y + 2.1 + (TALL - LAND_Y - 2.1) / 2, BACK, hallWallMat, false);

    // ---------- partitions: hall | sitting room, hall | kitchen ----------
    for (const side of [-1, 1]) {
      const mat = hallWallMat;
      wall(0.24, CEIL, FRONT - 1.75, side * HALL, CEIL / 2, (FRONT + 1.75) / 2, mat);
      wall(0.24, CEIL, 0.65 - STAIR_Z0, side * HALL, CEIL / 2, (0.65 + STAIR_Z0) / 2, mat);
      wall(0.24, TALL, STAIR_Z0 - BACK, side * HALL, TALL / 2, (STAIR_Z0 + BACK) / 2, mat);
      wall(0.24, CEIL - 2.1, 1.1, side * HALL, 2.1 + (CEIL - 2.1) / 2, 1.2, mat, false);
    }

    // skirting along the hall
    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 2.7), trimMat);
      skirt.position.set(side * (HALL - 0.15), 0.07, 3.2);
      this.add(skirt);
    }

    // ---------- the stairs & landing ----------
    for (let i = 0; i < STEPS; i++) {
      const h = RISE * (i + 1);
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.96, h, TREAD), treadMat);
      step.position.set(0, h / 2, STAIR_Z0 - i * TREAD - TREAD / 2);
      step.castShadow = step.receiveShadow = true;
      this.add(step);
      this.addGround(step);
    }
    const landing = new THREE.Mesh(new THREE.PlaneGeometry(2.96, 1.9), makeMat('wood', { base: '#5f4b38', repeat: [2, 1.2] }));
    landing.rotation.x = -Math.PI / 2;
    landing.position.set(0, LAND_Y, -5.25);
    landing.receiveShadow = true;
    this.add(landing);
    this.addGround(landing);
    // the face beneath the landing's front edge, so the hall sees no void
    wall(2.96, LAND_Y, 0.08, 0, LAND_Y / 2, -4.32, hallWallMat, false);

    // ---------- your door, and the room the dark never entered ----------
    const upDoor = makeDoor({ width: 1.0, height: 2.1, color: '#7c6347', frameColor: '#4a3c2e' });
    upDoor.position.set(0, LAND_Y, BACK);
    this.add(upDoor);
    this.track(upDoor);
    this.addCollider(upDoor.panel);
    this._upDoor = upDoor;
    this._doorOpen = false;

    // light under the door — the one light the house never lost
    const spillMat = new THREE.MeshStandardMaterial({
      color: 0x221a10, emissive: 0xffd9a0, emissiveIntensity: 1.15,
    });
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.13), spillMat);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, LAND_Y + 0.012, BACK + 0.2);
    this.add(spill);
    const underdoor = new THREE.PointLight(0xffd9a0, 1.8, 3.2, 2);
    underdoor.position.set(0, LAND_Y + 0.1, BACK + 0.3);
    this.add(underdoor);

    // the pocket room beyond: warm, small, kept
    const pocketFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.6),
      makeMat('carpet', { base: '#7c6653', repeat: [2.5, 1.8] })
    );
    pocketFloor.rotation.x = -Math.PI / 2;
    pocketFloor.position.set(0, LAND_Y + 0.002, -7.5);
    pocketFloor.receiveShadow = true;
    this.add(pocketFloor);
    this.addGround(pocketFloor);
    const pocketCeil = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.6), ceilMat);
    pocketCeil.rotation.x = Math.PI / 2;
    pocketCeil.position.set(0, 4.2, -7.5);
    this.add(pocketCeil);
    wall(3.8, 2.4, 0.2, 0, LAND_Y + 1.2, -8.8, pocketWallMat);
    wall(0.2, 2.4, 2.6, -1.9, LAND_Y + 1.2, -7.5, pocketWallMat);
    wall(0.2, 2.4, 2.6, 1.9, LAND_Y + 1.2, -7.5, pocketWallMat);
    wall(1.4, 2.4, 0.16, -1.2, LAND_Y + 1.2, BACK - 0.2, pocketWallMat);
    wall(1.4, 2.4, 0.16, 1.2, LAND_Y + 1.2, BACK - 0.2, pocketWallMat);
    wall(1.0, 0.3, 0.16, 0, LAND_Y + 2.25, BACK - 0.2, pocketWallMat, false);

    // a narrow bed, made; a lamp left on all these years
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 1.95), darkWoodMat);
    bedFrame.position.set(-1.28, LAND_Y + 0.13, -7.75);
    bedFrame.castShadow = bedFrame.receiveShadow = true;
    this.add(bedFrame);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.16, 1.85),
      new THREE.MeshStandardMaterial({ color: 0xcfc5ab, roughness: 0.95 })
    );
    mattress.position.set(-1.28, LAND_Y + 0.34, -7.75);
    mattress.castShadow = mattress.receiveShadow = true;
    this.add(mattress);
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.11, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xe0d8c2, roughness: 1 })
    );
    pillow.position.set(-1.28, LAND_Y + 0.46, -8.45);
    pillow.rotation.y = 0.06;
    this.add(pillow);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), darkWoodMat);
    crate.position.set(1.45, LAND_Y + 0.2, -8.4);
    crate.castShadow = true;
    this.add(crate);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.13, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xd8b57e, emissive: 0xffca7a, emissiveIntensity: 0.9, side: THREE.DoubleSide })
    );
    lampShade.position.set(1.45, LAND_Y + 0.56, -8.4);
    this.add(lampShade);
    const lampLight = new THREE.PointLight(0xffc98e, 2.6, 2.8, 2);
    lampLight.position.set(1.45, LAND_Y + 0.5, -8.35);
    this.add(lampLight);
    const pocketLight = new THREE.PointLight(0xffdcae, 8, 5.2, 1.8);
    pocketLight.position.set(0, 3.55, -7.5);
    this.add(pocketLight);

    // ---------- dark-state light: enough to lose your way by ----------
    this.add(new THREE.HemisphereLight(0x46506b, 0x181410, 1.7));
    const fills = [
      [0x56698e, 7.5, 11, 0, 2.3, 2.4],       // hall
      [0x4f628a, 7.5, 12, -4.5, 2.2, 0],      // sitting room
      [0x566d84, 6.5, 11, 4.5, 2.2, -1.2],    // kitchen
      [0x4a5a7a, 4.5, 8, 0, 3.2, -4.4],       // stairwell
    ];
    for (const [color, i, d, x, y, z] of fills) {
      const p = new THREE.PointLight(color, i, d, 2);
      p.position.set(x, y, z);
      this.add(p);
    }

    // ---------- the room bulbs, waiting for their switches ----------
    this._rooms = { kitchen: [], hall: [], sitting: [], yours: [] };
    this._anims = [];
    const addBulb = (room, x, z, target, { y = CEIL - 0.25, distance = 12 } = {}) => {
      const bulb = makeBulbLight({ y, intensity: 0, distance });
      bulb.position.set(x, 0, z);
      const glass = bulb.children[1];
      glass.material.emissiveIntensity = 0.04;
      this.add(bulb);
      this._rooms[room].push({ light: bulb.light, glass: glass.material, target });
      return bulb;
    };
    addBulb('kitchen', 4.2, -2.2, 9);
    addBulb('kitchen', 6.6, 0.3, 6, { distance: 9 });
    addBulb('hall', 0, 2.6, 7, { distance: 11 });
    addBulb('hall', 0, -0.6, 6, { distance: 10 });
    this._sittingBulb = addBulb('sitting', -4.5, 0.4, 8);
    addBulb('sitting', -6.2, -3.6, 5, { distance: 9 });
    addBulb('yours', 0, -4.6, 7, { y: 4.3, distance: 10 });
    const landingGlow = new THREE.PointLight(0xffdcae, 0, 7, 2);
    landingGlow.position.set(0, 3.3, -5.3);
    this.add(landingGlow);
    this._rooms.yours.push({ light: landingGlow, glass: null, target: 5 });
    this._rooms.yours.push({
      light: underdoor, glass: null, target: 3.4, base: 1.8,
      onK: (k) => { spillMat.emissiveIntensity = 1.15 + 1.2 * k; },
    });

    this.tick((dt) => {
      if (!this._anims.length) return;
      for (const a of this._anims) {
        a.p = Math.min(1, a.p + dt / 1.1);
        const k = a.p * a.p * (3 - 2 * a.p);
        if (a.e.light) a.e.light.intensity = (a.e.base ?? 0) + (a.e.target - (a.e.base ?? 0)) * k;
        if (a.e.glass) a.e.glass.emissiveIntensity = 0.04 + 2.3 * k;
        a.e.onK?.(k);
      }
      this._anims = this._anims.filter((a) => a.p < 1);
    });

    // ---------- windows, and the rain that owns them ----------
    const addWindow = (x, y, z, ry, w = 1.15, h = 1.3) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.07), trimMat);
      g.add(frame);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rainMat);
      pane.position.z = 0.045;
      g.add(pane);
      const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.02), trimMat);
      mullV.position.z = 0.055;
      const mullH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, 0.02), trimMat);
      mullH.position.z = 0.055;
      g.add(mullV, mullH);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.26, 0.05, 0.12), trimMat);
      sill.position.set(0, -h / 2 - 0.09, 0.03);
      g.add(sill);
      for (const cs of [-1, 1]) {
        const curtain = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, h + 0.34, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x5f5044, roughness: 1 })
        );
        curtain.position.set(cs * (w / 2 + 0.09), 0.05, 0.08);
        g.add(curtain);
      }
      g.position.set(x, y, z);
      g.rotation.y = ry;
      this.add(g);
      return g;
    };
    addWindow(-3.4, 1.7, FRONT - 0.13, Math.PI);
    addWindow(3.4, 1.7, FRONT - 0.13, Math.PI);
    const sitWindow = addWindow(-HW + 0.13, 1.7, -1.5, Math.PI / 2);
    addWindow(-HW + 0.13, 1.7, 2.6, Math.PI / 2);
    addWindow(-4.5, 1.7, BACK + 0.13, 0);
    addWindow(HW - 0.13, 1.75, -3.05, -Math.PI / 2, 1.0, 1.0);
    this.interact(sitWindow, {
      prompt: 'rain on the glass',
      onInteract: () => this.subtitle('It has rained here since the day you left. It never once let up.', 5),
    });

    // ---------- the front door (it only ever opens onto rain) ----------
    const frontDoor = makeDoor({ width: 1.0, color: '#4c3c2d', frameColor: '#3a2f24' });
    frontDoor.position.set(0, 0, FRONT);
    this.add(frontDoor);
    this.addCollider(frontDoor.panel);
    this.interact(frontDoor, {
      prompt: 'the front door',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('Locked. Beyond it there is only the rain, and the rain is old.', 5);
      },
    });

    // ---------- hall: mat, slippers, telephone, umbrellas ----------
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.025, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x4a4036, roughness: 1 })
    );
    mat.position.set(0, 0.013, 3.85);
    mat.receiveShadow = true;
    this.add(mat);

    const slippers = new THREE.Group();
    const slipMat = new THREE.MeshStandardMaterial({ color: 0x8a5a52, roughness: 0.95 });
    for (const [dx, rot] of [[-0.07, 0.1], [0.07, -0.06]]) {
      const slip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.24), slipMat);
      slip.position.set(0.62 + dx, 0.028, 3.72);
      slip.rotation.y = rot;
      slip.castShadow = true;
      slippers.add(slip);
    }
    this.add(slippers);
    this.interact(slippers, {
      prompt: 'the slippers by the mat',
      once: true,
      onInteract: () => {
        this.learnClue({
          id: 'l5-slippers',
          title: 'slippers — the hall',
          body: 'her slippers, side by side at the door mat.\nslippers lived in the hall.',
        });
        this.subtitle('By the mat, toes to the door, the way she always left them.', 5);
      },
    });

    const hallTable = makeTable({ w: 0.7, d: 0.36, h: 0.8 });
    hallTable.position.set(-1.12, 0, 2.5);
    this.add(hallTable);
    this.addCollider(hallTable);
    const phone = new THREE.Group();
    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.11, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.45 })
    );
    phoneBody.position.set(-1.12, 0.875, 2.5);
    phoneBody.castShadow = true;
    const handset = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, 0.05, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x232120, roughness: 0.4 })
    );
    handset.position.set(-1.12, 0.955, 2.44);
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.012, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a3835, roughness: 0.35, metalness: 0.3 })
    );
    dial.rotation.x = Math.PI / 2 - 0.5;
    dial.position.set(-1.12, 0.92, 2.56);
    phone.add(phoneBody, handset, dial);
    this.add(phone);
    this.interact(phone, {
      prompt: 'the telephone',
      onInteract: () => this.subtitle('You still know the number by heart. There is no one it would ring.', 5),
    });

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.09, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x4e4438, roughness: 0.8 })
    );
    stand.position.set(1.1, 0.25, 4.05);
    stand.castShadow = true;
    this.add(stand);
    for (const [lx, lz, tilt] of [[1.07, 4.02, 0.16], [1.14, 4.09, -0.1]]) {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.02, 0.85, 6),
        new THREE.MeshStandardMaterial({ color: 0x33302c, roughness: 0.9 })
      );
      stick.position.set(lx, 0.62, lz);
      stick.rotation.z = tilt;
      this.add(stick);
    }

    // ---------- sitting room: the wireless, chairs, the stopped clock ----------
    const radioTable = makeTable({ w: 0.66, d: 0.4, h: 0.72 });
    radioTable.position.set(-6.95, 0, 0.8);
    this.add(radioTable);
    this.addCollider(radioTable);

    const radio = new THREE.Group();
    const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.2), darkWoodMat);
    radioBody.position.y = 0.16;
    radioBody.castShadow = true;
    radio.add(radioBody);
    const dialMat = new THREE.MeshStandardMaterial({
      color: 0x2a2118, emissive: 0xffcf8a, emissiveIntensity: 0.3, roughness: 0.5,
    });
    const radioDial = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.08), dialMat);
    radioDial.position.set(0, 0.225, 0.101);
    radio.add(radioDial);
    const grille = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 1 })
    );
    grille.position.set(0, 0.1, 0.101);
    radio.add(grille);
    for (const kx of [-0.19, 0.19]) {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.025, 10),
        new THREE.MeshStandardMaterial({ color: 0xc9b98f, roughness: 0.4, metalness: 0.4 })
      );
      knob.rotation.x = Math.PI / 2;
      knob.position.set(kx, 0.225, 0.105);
      radio.add(knob);
    }
    radio.position.set(-6.95, 0.74, 0.8);
    radio.rotation.y = Math.PI / 2;
    this.add(radio);
    const radioLight = new THREE.PointLight(0xffc98a, 0, 1.8, 2);
    radioLight.position.set(-6.75, 1.05, 0.8);
    this.add(radioLight);
    this._rooms.sitting.push({
      light: radioLight, glass: null, target: 1.5,
      onK: (k) => { dialMat.emissiveIntensity = 0.3 + 0.9 * k; },
    });
    this.interact(radio, {
      prompt: 'the wireless',
      once: true,
      onInteract: () => {
        this.learnClue({
          id: 'l5-wireless',
          title: 'the wireless — the sitting room',
          body: 'the old radio set, dial keeping a little light.\nthe wireless kept the sitting room.',
        });
        this.subtitle('The dial holds a little light, even now. The evenings ended here.', 5);
      },
    });

    // armchairs turned toward where the fire never was
    const upholstery = makeMat('carpet', { base: '#5d5348', repeat: [1, 1] });
    const makeArmchair = () => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.36, 0.66), upholstery);
      seat.position.y = 0.18;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.55, 0.18), upholstery);
      back.position.set(0, 0.6, -0.24);
      for (const ax of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.66), upholstery);
        arm.position.set(ax * 0.4, 0.25, 0);
        g.add(arm);
      }
      g.add(seat, back);
      g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      return g;
    };
    const chairA = makeArmchair();
    chairA.position.set(-5.9, 0, 1.9);
    chairA.rotation.y = 2.4;
    this.add(chairA);
    this.addCollider(chairA);
    const chairB = makeArmchair();
    chairB.position.set(-5.7, 0, -0.5);
    chairB.rotation.y = 1.1;
    this.add(chairB);
    this.addCollider(chairB);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.7),
      makeMat('carpet', { base: '#59433f', repeat: [2, 1.4] })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-4.8, 0.012, 0.7);
    rug.receiveShadow = true;
    this.add(rug);

    // the grandfather clock, stopped
    const clock = new THREE.Group();
    const clockBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.1, 0.32), darkWoodMat);
    clockBody.position.y = 1.05;
    clockBody.castShadow = true;
    clock.add(clockBody);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.6 })
    );
    face.position.set(0, 1.72, 0.165);
    clock.add(face);
    const pendulumWin = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x0f0c08, roughness: 0.3 })
    );
    pendulumWin.position.set(0, 0.85, 0.165);
    clock.add(pendulumWin);
    clock.position.set(-7.2, 0, -3.6);
    clock.rotation.y = Math.PI / 2;
    this.add(clock);
    this.addCollider(clock);
    this.interact(clock, {
      prompt: 'the stopped clock',
      onInteract: () => this.subtitle('It stopped keeping time when there was no one left to keep it for.', 5),
    });

    // bookshelf against the back wall, spines gone grey
    const shelf = makeShelf({ w: 1.1, h: 1.7, shelves: 3 });
    shelf.position.set(-3.2, 0, -5.9);
    this.add(shelf);
    this.addCollider(shelf);
    const bookColors = ['#5d4a3a', '#4a5245', '#6a5a66', '#585043', '#43485a', '#6e5544'];
    for (let i = 0; i < 11; i++) {
      const bh = 0.2 + Math.random() * 0.08;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, bh, 0.16),
        new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length], roughness: 0.9 })
      );
      const level = i < 6 ? 0.585 : 1.118;
      book.position.set(-3.62 + (i % 6) * 0.055, level + bh / 2, -5.9);
      book.rotation.z = (Math.random() - 0.5) * 0.08;
      this.add(book);
    }

    // sofa under the back window
    const sofa = new THREE.Group();
    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.38, 0.75), upholstery);
    sofaBase.position.y = 0.19;
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.2), upholstery);
    sofaBack.position.set(0, 0.62, -0.27);
    sofa.add(sofaBase, sofaBack);
    for (const ax of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.75), upholstery);
      arm.position.set(ax * 0.86, 0.26, 0);
      sofa.add(arm);
    }
    sofa.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    sofa.position.set(-4.5, 0, 3.9);
    sofa.rotation.y = Math.PI;
    this.add(sofa);
    this.addCollider(sofa);

    // photographs nobody straightened
    const photoSpots = [
      [3, -HALL - 0.01, 1.75, 3.15, Math.PI / 2],     // hall side of the west partition
      [2, -HW + 0.14, 1.62, -0.2, Math.PI / 2],       // sitting room west wall
      [3, -1.7, 1.68, BACK + 0.14, 0],                // by the bookshelf
    ];
    for (const [figs, px, py, pz, ry] of photoSpots) {
      const frame = makePictureFrame({ texture: blurredPhotoTexture(figs), width: 0.4, height: 0.3 });
      frame.position.set(px, py, pz);
      frame.rotation.y = ry;
      this.add(frame);
    }

    // ---------- kitchen: counter, stove, the burnt pan, the table ----------
    const counterMat = makeMat('wood', { base: '#66513c', repeat: [3, 1] });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.88, 4.3), counterMat);
    counter.position.set(HW - 0.42, 0.44, -3.05);
    counter.castShadow = counter.receiveShadow = true;
    this.add(counter);
    this.addCollider(counter);
    const counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.04, 4.34),
      new THREE.MeshStandardMaterial({ color: 0xa8a294, roughness: 0.5 })
    );
    counterTop.position.set(HW - 0.42, 0.9, -3.05);
    counterTop.receiveShadow = true;
    this.add(counterTop);
    // sink and faucet
    const basin = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.03, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x4c4f4e, roughness: 0.35, metalness: 0.5 })
    );
    basin.position.set(HW - 0.42, 0.915, -3.05);
    this.add(basin);
    const faucet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b8f8c, roughness: 0.3, metalness: 0.8 })
    );
    faucet.position.set(HW - 0.2, 1.02, -3.05);
    this.add(faucet);

    // the stove, and supper's pan still on it
    const stove = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.9, 0.66),
      new THREE.MeshStandardMaterial({ color: 0xb5b0a3, roughness: 0.45, metalness: 0.2 })
    );
    stove.position.set(HW - 0.43, 0.45, 0.3);
    stove.castShadow = stove.receiveShadow = true;
    this.add(stove);
    this.addCollider(stove);
    for (const [bx, bz] of [[-0.15, -0.16], [0.15, -0.16], [-0.15, 0.16], [0.15, 0.16]]) {
      const burner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.015, 14),
        new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.8 })
      );
      burner.position.set(HW - 0.43 + bx, 0.91, 0.3 + bz);
      this.add(burner);
    }
    const pan = new THREE.Group();
    const panBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.11, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.9 })
    );
    panBody.position.set(HW - 0.58, 0.945, 0.14);
    panBody.castShadow = true;
    const panHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.02, 0.035),
      new THREE.MeshStandardMaterial({ color: 0x211d19, roughness: 0.8 })
    );
    panHandle.position.set(HW - 0.72, 0.955, 0.24);
    panHandle.rotation.y = 0.5;
    pan.add(panBody, panHandle);
    this.add(pan);
    this.interact(pan, {
      prompt: 'the pan on the stove',
      once: true,
      onInteract: () => {
        this.learnClue({
          id: 'l5-supper',
          title: 'supper — the kitchen',
          body: 'a pan burnt black, still on the stove.\nsupper happened here, in the kitchen.',
        });
        this.subtitle('Burnt to the pan, and never thrown away. Supper smelled of this once.', 5);
      },
    });

    // the fridge keeps humming in the corner
    const fridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 1.65, 0.68),
      new THREE.MeshStandardMaterial({ color: 0xa9ada2, roughness: 0.5 })
    );
    fridge.position.set(HW - 0.5, 0.825, -5.55);
    fridge.castShadow = fridge.receiveShadow = true;
    this.add(fridge);
    this.addCollider(fridge);
    const fridgeHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.5, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x6f7472, roughness: 0.4, metalness: 0.6 })
    );
    fridgeHandle.position.set(HW - 0.86, 1.0, -5.32);
    this.add(fridgeHandle);

    // the kitchen table, and the plate where small things were left
    const kitchenTable = makeTable({ w: 1.25, d: 0.8, h: 0.74 });
    kitchenTable.position.set(4.2, 0, -2.2);
    this.add(kitchenTable);
    this.addCollider(kitchenTable);
    for (const [cx, cz, cr] of [[3.6, -1.6, 2.4], [4.8, -2.8, -0.6]]) {
      const kchair = makeChair();
      kchair.position.set(cx, 0, cz);
      kchair.rotation.y = cr;
      this.add(kchair);
      this.addCollider(kchair);
    }
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.07, 0.014, 16),
      new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.5 })
    );
    plate.position.set(4.4, 0.767, -2.1);
    plate.receiveShadow = true;
    this.add(plate);

    const key = makeKeyProp();
    key.position.set(4.4, 0.785, -2.1);
    key.visible = false;
    this.add(key);
    this._keyProp = key;
    this._keyTaken = false;
    this._kitchenLit = false;
    this.interact(key, {
      prompt: 'the small key',
      once: true,
      onInteract: () => {
        key.visible = false;
        this._keyTaken = true;
        this.giveItem({ id: 'room-key', name: 'a small key, warm from the kitchen light' });
        this.subtitle('Small, and warm from the bulb — as if she had only just set it down.', 5);
        this.setObjective('the door at the top of the stairs');
      },
    });
    this.game.interaction.setEnabled(key, false);

    // ---------- the fuse box, its pilot light, and the note ----------
    const fuse = this._buildFusebox();
    fuse.position.set(4.6, 1.42, BACK + 0.155);
    this.add(fuse);
    this._fuse = fuse;
    this._step = 0;
    this._allOn = false;
    const labels = {
      kitchen: 'kitchen', hall: 'hall', sitting: 'sitting room', yours: 'your room', porch: 'porch',
    };
    for (const keyName of Object.keys(fuse.units)) {
      this.interact(fuse.units[keyName].unit, {
        prompt: 'the switch marked ' + labels[keyName],
        onInteract: () => this._flip(keyName),
      });
    }
    const pilot = new THREE.PointLight(0xffb066, 1.6, 3, 2);
    pilot.position.set(4.6, 1.7, BACK + 0.45);
    this.add(pilot);

    const noteShelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.22), darkWoodMat);
    noteShelf.position.set(5.5, 1.0, BACK + 0.23);
    this.add(noteShelf);
    const note = makeNoteProp();
    note.position.set(5.5, 1.022, BACK + 0.24);
    this.add(note);
    this._noteProp = note;
    this.interact(note, {
      prompt: 'a note by the pilot light',
      onInteract: () => {
        this.giveNote({
          id: 'l5-note',
          title: 'a note by the pilot light',
          body:
            'supper before slippers.\n' +
            'slippers before the wireless.\n' +
            'and yours always last,\n' +
            'so the dark never caught you.\n\n' +
            '— M.',
        });
        if (!this._readNote) {
          this._readNote = true;
          this.setObjective('the way the evening went: supper, slippers, the wireless, yours');
        }
      },
    });

    // ---------- dust in the still air ----------
    this.track(this.add(makeDust({ count: 110, box: [2.6, 2.3, 8.6], center: [0, 1.3, 0.6] })));
    this.track(this.add(makeDust({ count: 130, box: [5.6, 2.2, 9.6], center: [-4.5, 1.2, -0.8] })));
    this.track(this.add(makeDust({ count: 70, box: [2.6, 3.0, 4.2], center: [0, 2.4, -4.1] })));

    // ---------- the upstairs door: locked until the key comes home ----------
    this.interact(upDoor, {
      prompt: 'the door to your room',
      onInteract: () => {
        if (this._doorOpen) return;
        if (this.hasItem('room-key')) {
          this.playSound('unlock');
          this.removeItem('room-key');
          upDoor.setOpen(true, 1);
          this.removeColliderOf(upDoor.panel);
          this._doorOpen = true;
          this.game.interaction.remove(upDoor);
          this.setObjective('');
          this.subtitle('It opens on a room the dark never entered.', 4.5);
          this.playSound('door');
        } else {
          this.playSound('locked');
          this.subtitle(
            this._allOn
              ? 'Locked. The key will be where small things were always left — in the kitchen.'
              : 'Locked. Under the door, the light keeps its patience.',
            5
          );
        }
      },
    });

    // stepping through the doorway finishes the level
    this.tick(() => {
      if (this._doorOpen && !this.isCompleted) {
        const p = this.game.player.position;
        if (p.z < BACK - 0.7 && p.y > LAND_Y + 1.0) this.complete();
      }
    });

    // ---------- spawn & bounds ----------
    this.spawn.position.set(0, 0, 3.4);
    this.spawn.yaw = 0; // facing down the hall, toward the stairs
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-HW + 0.3, 0, -8.55),
      new THREE.Vector3(HW - 0.3, 5, FRONT - 0.2)
    );
    this.setObjective('home again, and the lights are out');
  }

  // ---------- builders ----------

  /** The fuse box: five labelled switches, one of them dead forever. */
  _buildFusebox() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x565a54, roughness: 0.45, metalness: 0.55 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.54, 0.06), metal);
    panel.castShadow = true;
    g.add(panel);
    const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.04), metal);
    conduit.position.set(-0.38, 0.8, -0.01);
    g.add(conduit);

    const plateMat = new THREE.MeshStandardMaterial({ color: 0x2f332e, roughness: 0.6, metalness: 0.3 });
    const leverMat = new THREE.MeshStandardMaterial({ color: 0xcfcabb, roughness: 0.35, metalness: 0.4 });
    const arrangement = ['hall', 'yours', 'kitchen', 'porch', 'sitting'];
    const labelText = {
      hall: 'hall', yours: 'your\nroom', kitchen: 'kitchen', porch: 'porch', sitting: 'sitting\nroom',
    };
    g.units = {};
    arrangement.forEach((keyName, i) => {
      const unit = new THREE.Group();
      unit.position.set(-0.35 + i * 0.175, 0, 0.032);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.26, 0.018), plateMat);
      plate.position.y = 0.07;
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.07, 0.03);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.105, 0.032), leverMat);
      pivot.add(lever);
      pivot.rotation.x = 0.55; // off
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.145, 0.068),
        new THREE.MeshStandardMaterial({
          map: textTexture({
            text: labelText[keyName], width: 160, height: 76,
            font: '26px Georgia', bg: '#23261f', color: '#cfd2bd',
          }),
          roughness: 0.8,
        })
      );
      label.position.set(0, -0.135, 0.012);
      unit.add(plate, pivot, label);
      g.add(unit);
      g.units[keyName] = { unit, pivot };
    });

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0xff9a4a, emissiveIntensity: 1.8 })
    );
    dome.position.set(0.41, 0.21, 0.04);
    g.add(dome);
    return g;
  }

  // ---------- the evening, in order ----------

  _flip(keyName) {
    const u = this._fuse.units[keyName];
    if (keyName === 'porch') {
      this.playSound('switch');
      u.pivot.rotation.x = -0.55;
      this.after(0.22, () => { u.pivot.rotation.x = 0.55; });
      this.subtitle('A dry click. The porch light has been dead since the year you left.', 5);
      return;
    }
    if (keyName === ORDER[this._step]) {
      u.pivot.rotation.x = -0.55;
      this._step++;
      this.playSound('switch');
      for (const e of this._rooms[keyName]) this._anims.push({ e, p: 0 });
      if (keyName === 'sitting' && !this._shadowOn) {
        this._shadowOn = true;
        this._sittingBulb.light.castShadow = true;
      }
      if (keyName === 'kitchen') {
        this._kitchenLit = true;
        this._updateKey();
      }
      this.subtitle(LIT_LINES[keyName], 4.5);
      if (this._step === ORDER.length) this._houseOn();
    } else {
      this.playSound('wrong');
      this._resetPower();
      this.subtitle('That was not how the evening went.', 5);
    }
  }

  _resetPower() {
    this._step = 0;
    this._anims = [];
    this._kitchenLit = false;
    this._updateKey();
    for (const room of ORDER) {
      this._fuse.units[room].pivot.rotation.x = 0.55;
      for (const e of this._rooms[room]) {
        if (e.light) e.light.intensity = e.base ?? 0;
        if (e.glass) e.glass.emissiveIntensity = 0.04;
        e.onK?.(0);
      }
    }
  }

  _houseOn() {
    this._allOn = true;
    this.playSound('tone', { freq: 330, gain: 0.2, decay: 2.4 });
    if (this._keyTaken) {
      this.setObjective('the door at the top of the stairs');
    } else {
      this.after(2.6, () => {
        if (!this._keyTaken) {
          this.subtitle('On the kitchen table, something small has caught the light.', 5);
          this.setObjective('the small thing the kitchen light found');
        }
      });
    }
  }

  _updateKey() {
    const show = this._kitchenLit && !this._keyTaken;
    this._keyProp.visible = show;
    this.game.interaction.setEnabled(this._keyProp, show);
  }

  async debugSolve() {
    // read the rhyme by the pilot light
    this.debugInteract(this._noteProp);
    await this.debugWait(0.35);
    this.game.ui.closeModal();
    await this.debugWait(0.2);
    // supper, slippers, the wireless, yours
    for (const keyName of ORDER) {
      this.debugInteract(this._fuse.units[keyName].unit);
      await this.debugWait(0.45);
    }
    // the key, findable now that the kitchen is lit
    this.debugInteract(this._keyProp);
    await this.debugWait(0.3);
    // up the stairs, through your door
    this.debugInteract(this._upDoor);
    await this.debugWait(0.7);
    this.game.player.teleport(0, -7.6, 0, LAND_Y);
    await this.debugWait(0.6);
  }
}
