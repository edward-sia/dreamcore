import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeFluorescent, makeNoteProp,
  makeSign, makeBench, makeDust, applyFog,
} from '../core/props.js';

// VII — The Platform
// A rural station at night, fog closing over the tracks in both directions.
// In the waiting room, a torn ticket: the time and destination smudged, but
// carriage 3, seat 41 still legible. The departures board knows which train
// is yours; the staff gate under the tracks wants carriage, then seat. On
// platform 2 the 23:47 comes — and passes without stopping, the way the
// years did. Then the board lets go, and the far gate stands open.

// world axes: tracks run along X; the crossing is in Z.
const PLEN = 34;                   // platforms span x −34..34
const P1 = { z0: 1, z1: 7 };       // platform 1 (spawn side), top y = 0
const P2 = { z0: -11, z1: -5 };    // platform 2, top y = 0
const BED_Y = -0.9;                // track bed floor
const TRACK_A = -0.85;             // near line (platform 1)
const TRACK_B = -3.25;             // through line (platform 2) — the 23:47's
const U = {                        // the underpass
  x0: 8.4, x1: 12.0,               //   flights descend eastward, drop 3.3
  cx0: 12.0, cx1: 13.6,            //   corridor strip
  floor: -3.3, ceil: -1.2,
  s1z0: 2.6, s1z1: 4.2,            //   flight strip, platform 1
  s2z0: -7.4, s2z1: -5.8,          //   flight strip, platform 2
};
const BLD = { x0: -10, x1: -1, z0: 4.7, z1: 9.7, h: 3.2 };  // station building
const GATE_X = -31;                // the exit gate across platform 2
const TRAIN = { enter: 78, gone: -150, speed: 34, cars: 7, pitch: 15.9 };

// the departures board — five services, four of them lying about coming.
// canon: only the 23:47 HARBECK matches both torn fragments (23:4— and H——);
// HOLLOW BECK is the trap that matches the H but not the time.
const SERVICES = [
  ['23:12', 'ASHFELD',     '1', 'DELAYED'],
  ['23:31', 'HOLLOW BECK', '1', 'DELAYED'],
  ['23:47', 'HARBECK',     '2', 'ON TIME'],
  ['23:58', 'ASHFELD',     '1', 'DELAYED'],
  ['00:06', 'MOORCROFT',   '1', 'DELAYED'],
];

function boardTexture(cancelled) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, 1024, 512);
  // tired display: faint horizontal banding
  for (let y = 0; y < 512; y += 4) {
    ctx.fillStyle = 'rgba(255,190,110,0.016)';
    ctx.fillRect(0, y, 1024, 1);
  }
  ctx.strokeStyle = 'rgba(214,164,96,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 1004, 492);
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,160,64,0.85)';
  ctx.shadowBlur = 12;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#caa06a';
  ctx.font = '34px "Courier New", monospace';
  ctx.fillText('D E P A R T U R E S', 512, 56);
  ctx.textAlign = 'left';
  ctx.font = '24px "Courier New", monospace';
  ctx.fillStyle = '#7d6440';
  ctx.fillText('time', 56, 112);
  ctx.fillText('destination', 250, 112);
  ctx.fillText('plat', 652, 112);
  ctx.font = 'bold 42px "Courier New", monospace';
  SERVICES.forEach(([time, dest, plat, status], i) => {
    const y = 172 + i * 62;
    ctx.fillStyle = cancelled ? '#a87f4e' : '#ffb45c';
    ctx.fillText(time, 56, y);
    ctx.fillStyle = cancelled ? '#7a5d3c' : '#ffb45c';
    ctx.fillText(dest, 250, y);
    ctx.fillText(plat, 668, y);
    if (cancelled) {
      ctx.fillStyle = '#e8927a';
      ctx.fillText('CANCELLED', 762, y);
    } else {
      ctx.fillStyle = status === 'ON TIME' ? '#ffd9a2' : '#c07a48';
      ctx.fillText(status, 762, y);
    }
  });
  ctx.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// a resort poster gone soft — the name blurred past reading
function posterTexture({ top, mid, low, sand, name }) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 352;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 352);
  g.addColorStop(0, top);
  g.addColorStop(0.45, mid);
  g.addColorStop(0.46, low);
  g.addColorStop(0.72, low);
  g.addColorStop(0.73, sand);
  g.addColorStop(1, sand);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 352);
  // a pale sun, already setting
  const sun = ctx.createRadialGradient(190, 70, 4, 190, 70, 46);
  sun.addColorStop(0, 'rgba(255,244,214,0.85)');
  sun.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 256, 352);
  // figures too far gone to name
  ctx.fillStyle = 'rgba(70,70,66,0.4)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(60 + i * 58, 262 + (i % 2) * 14, 6, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = 'rgba(46,44,40,0.9)';
  ctx.font = 'bold 34px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 322);
  ctx.filter = 'blur(2px)';
  ctx.drawImage(c, 0, 0);
  ctx.filter = 'none';
  // creases where it was folded, light where it peeled
  ctx.strokeStyle = 'rgba(255,255,244,0.16)';
  ctx.lineWidth = 2;
  for (const y of [88, 200]) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 6); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the waiting-room clock, stopped at sixteen minutes to midnight
function clockTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d1bd';
  ctx.beginPath(); ctx.arc(128, 128, 120, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#57503f';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(128, 128, 116, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#4a4436';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
    ctx.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108);
    ctx.stroke();
  }
  const hand = (a, len, w) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
    ctx.stroke();
  };
  hand(((11 + 44 / 60) / 12) * Math.PI * 2, 62, 9);   // 23:44 — almost time,
  hand((44 / 60) * Math.PI * 2, 92, 5);               // for years now
  ctx.fillStyle = '#4a4436';
  ctx.beginPath(); ctx.arc(128, 128, 8, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// roller shutter over the ticket window, down a long time
function shutterTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#767b81';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 18) {
    ctx.fillStyle = 'rgba(24,26,30,0.5)';
    ctx.fillRect(0, y, 256, 3);
    ctx.fillStyle = 'rgba(235,240,246,0.14)';
    ctx.fillRect(0, y + 4, 256, 2);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 14 + Math.random() * 34;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(112,74,42,0.22)');
    g.addColorStop(1, 'rgba(112,74,42,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the station's own name, weathered past recall
function totemTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#27303f';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = 'rgba(222,228,236,0.55)';
  ctx.lineWidth = 5;
  ctx.strokeRect(9, 9, 494, 110);
  // ghosts of letters, none of them left whole
  ctx.filter = 'blur(9px)';
  ctx.fillStyle = 'rgba(214,220,228,0.30)';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(56 + i * 50 + (Math.random() - 0.5) * 8, 40 + (Math.random() - 0.5) * 8,
      26 + Math.random() * 10, 48);
  }
  ctx.filter = 'none';
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// a strip of carriage windows, most of them lit for nobody
function windowStripTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(0, 0, 512, 64);
  for (let x = 10; x < 490; x += 44) {
    if (Math.random() < 0.8) {
      ctx.fillStyle = `rgba(206,216,232,${0.55 + Math.random() * 0.4})`;
      ctx.fillRect(x, 15, 27, 34);
    } else {
      ctx.fillStyle = 'rgba(60,66,78,0.6)';
      ctx.fillRect(x, 15, 27, 34);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A swinging metal bar gate; pivot sits at the hinge end. Track it. */
function makeBarGate({ span = 1.48, height = 1.9, bars = 5, color = 0x3d434b } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.75 });
  const pivot = new THREE.Group();
  for (const zl of [0.04, span - 0.04]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, 0.06), mat);
    v.position.set(0, height / 2, zl);
    v.castShadow = true;
    pivot.add(v);
  }
  for (const yl of [0.28, height * 0.55, height - 0.08]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, span), mat);
    h.position.set(0, yl, span / 2);
    pivot.add(h);
  }
  for (let i = 1; i <= bars; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.032, height - 0.42, 0.032), mat);
    b.position.set(0, (height - 0.42) / 2 + 0.28, (span / (bars + 1)) * i);
    pivot.add(b);
  }
  let target = 0, angle = 0;
  pivot.setOpen = (open, dir = 1) => { target = open ? dir * Math.PI / 2.05 : 0; };
  pivot.update = (dt) => {
    angle += (target - angle) * Math.min(1, 2.4 * dt);
    pivot.rotation.y = angle;
  };
  return pivot;
}

export default class Level07 extends LevelBase {
  static meta = {
    id: 7,
    numeral: 'VII',
    title: 'The Platform',
    mood: 'train',
    intro: 'The last station of the evening. You have stood here before, holding a ticket you never used.',
    outro:
      'It passed the way the years pass — all light and wind, and gone.\n' +
      'Carriage 3, seat 41: somewhere it is still riding through the fog,\n' +
      'your seat kept empty, the little lamp above it burning.',
  };

  build() {
    applyFog(this.scene, '#0b0e13', 4, 40);   // the fog is the night; no sky

    // ---------- materials ----------
    const platMat = makeMat('concrete', { base: '#716c63', repeat: [24, 2] });
    const stairMat = makeMat('concrete', { base: '#645f56', repeat: [1, 1] });
    const bedMat = makeMat('asphalt', { base: '#312e2a', repeat: [48, 2] });
    const wallMat = makeMat('plaster', { base: '#968b7b', repeat: [5, 1.6] });
    const tileMat = makeMat('tile', { tile: '#75877b', grout: '#454741', tileSize: 64, repeat: [7, 1.4] });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3d434b, roughness: 0.5, metalness: 0.75 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x39322a, roughness: 0.95 });

    // ---------- platforms (raised slabs; the shafts are real holes) ----------
    const slab = (x0, x1, z0, z1) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, 1.0, z1 - z0), platMat
      );
      m.position.set((x0 + x1) / 2, -0.5, (z0 + z1) / 2);
      m.receiveShadow = true;
      this.add(m);
      this.addGround(m);
      return m;
    };
    // platform 1, cut around the stair shaft
    slab(-PLEN, U.x0, P1.z0, P1.z1);
    slab(U.x1, PLEN, P1.z0, P1.z1);
    slab(U.x0, U.x1, P1.z0, U.s1z0);
    slab(U.x0, U.x1, U.s1z1, P1.z1);
    slab(BLD.x0 - 0.3, BLD.x1 + 0.3, P1.z1, 10);     // under the building's back half
    // platform 2, cut around its shaft
    slab(-PLEN, U.x0, P2.z0, P2.z1);
    slab(U.x1, PLEN, P2.z0, P2.z1);
    slab(U.x0, U.x1, U.s2z1, P2.z1);
    slab(U.x0, U.x1, P2.z0, U.s2z0);

    // painted edge lines, repainted for no one
    const paint = (z, w, len, cx, glow) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.014, w),
        new THREE.MeshStandardMaterial({
          color: 0xb9b4a2, roughness: 0.9,
          emissive: 0xfff2d8, emissiveIntensity: glow,
        })
      );
      m.position.set(cx, 0.008, z);
      this.add(m);
      return m;
    };
    paint(P1.z0 - 0.09, 0.18, 2 * PLEN, 0, 0.05);
    paint(P2.z1 + 0.09, 0.18, 2 * PLEN, 0, 0.05);
    // the waiting line on platform 2
    paint(-6.05, 0.2, 8.5, 2, 0.16);
    const stencil = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.38),
      new THREE.MeshStandardMaterial({
        map: textTexture({ text: 'WAIT HERE', width: 512, height: 128, font: 'bold 72px Georgia', color: '#cfc9b6' }),
        transparent: true, roughness: 0.9,
      })
    );
    stencil.rotation.x = -Math.PI / 2;
    stencil.rotation.z = Math.PI;
    stencil.position.set(2, 0.017, -6.6);
    this.add(stencil);

    // ---------- the tracks ----------
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(140, 6), bedMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(0, BED_Y, -2);
    bed.receiveShadow = true;
    this.add(bed);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x83878d, roughness: 0.36, metalness: 0.85,
      emissive: 0x9fb4c8, emissiveIntensity: 0,
    });
    this._railMat = railMat;
    for (const tz of [TRACK_A, TRACK_B]) {
      for (const off of [-0.72, 0.72]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(140, 0.12, 0.07), railMat);
        rail.position.set(0, -0.73, tz + off);
        this.add(rail);
      }
    }
    const nSleep = 131;
    const sleepers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.24, 0.1, 2.1), darkWood, nSleep * 2
    );
    const m4 = new THREE.Matrix4();
    let sk = 0;
    for (const tz of [TRACK_A, TRACK_B]) {
      for (let i = 0; i < nSleep; i++) {
        m4.setPosition(-45.5 + i * 0.7, -0.84, tz);
        sleepers.setMatrixAt(sk++, m4);
      }
    }
    sleepers.instanceMatrix.needsUpdate = true;
    this.add(sleepers);

    // nobody walks onto the tracks — the edges hold, full length
    this.addBlocker([-PLEN, -1, 0.5], [PLEN, 1.8, 0.95]);
    this.addBlocker([-PLEN, -1, -4.95], [PLEN, 1.8, -4.5]);

    // ---------- back fences & bounds ----------
    const fencePost = (x, z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), metalMat);
      p.position.set(x, 0.55, z);
      this.add(p);
    };
    const fenceRail = (x0, x1, z, y) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.05), metalMat);
      r.position.set((x0 + x1) / 2, y, z);
      this.add(r);
    };
    for (let x = -33; x <= -11; x += 3.2) fencePost(x, 7.02);
    for (let x = 0.4; x <= 33; x += 3.2) fencePost(x, 7.02);
    fenceRail(-PLEN, BLD.x0 - 0.2, 7.02, 0.98);
    fenceRail(-PLEN, BLD.x0 - 0.2, 7.02, 0.52);
    fenceRail(BLD.x1 + 0.2, PLEN, 7.02, 0.98);
    fenceRail(BLD.x1 + 0.2, PLEN, 7.02, 0.52);
    for (let x = -33; x <= 33; x += 3.3) fencePost(x, -10.55);
    fenceRail(-PLEN, PLEN, -10.55, 0.98);
    fenceRail(-PLEN, PLEN, -10.55, 0.52);
    this.addBlocker([-PLEN, 0, 6.9], [BLD.x0 - 0.2, 1.8, 7.2]);
    this.addBlocker([BLD.x1 + 0.2, 0, 6.9], [PLEN, 1.8, 7.2]);
    this.addBlocker([-PLEN, 0, -10.75], [PLEN, 1.8, -10.42]);
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-33.6, -5, -10.8),
      new THREE.Vector3(33.6, 5, 9.8)
    );

    // ---------- lighting ----------
    this.add(new THREE.HemisphereLight(0x33405a, 0x191410, 2.15));
    const lampPost = (x, z, armDir) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.0, 8), metalMat);
      pole.position.set(x, 1.5, z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.6), metalMat);
      arm.position.set(x, 2.92, z + armDir * 0.3);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.1, 0.16),
        new THREE.MeshStandardMaterial({
          color: 0x2c2f33, roughness: 0.5, metalness: 0.6,
          emissive: 0xff9e4a, emissiveIntensity: 1.6,
        })
      );
      head.position.set(x, 2.88, z + armDir * 0.58);
      const light = new THREE.PointLight(0xff9e4a, 11, 14, 1.6);
      light.position.set(x, 2.78, z + armDir * 0.58);
      g.add(pole, arm, head, light);
      this.add(g);
      return g;
    };
    for (const lx of [-27, -15, 7, 14, 27]) lampPost(lx, 6.1, -1);
    for (const lx of [-28, -16, -4, 8]) lampPost(lx, -9.6, 1);

    // platform number plates, readable across the fog
    const platePlate = (text, x, z, face) => {
      const s = makeSign({
        text, width: 0.95, height: 0.24, font: 'bold 44px Georgia',
        bg: '#232c3e', color: '#dfe4ec', doubleSided: true,
      });
      s.position.set(x, 2.3, z + face * 0.06);
      if (face < 0) s.rotation.y = Math.PI;
      this.add(s);
    };
    platePlate('platform 1', -15, 6.1, -1);
    platePlate('platform 1', 14, 6.1, -1);
    platePlate('platform 2', -16, -9.6, 1);
    platePlate('platform 2', 8, -9.6, 1);

    this.track(this.add(makeDust({ count: 200, box: [46, 3.2, 13], center: [0, 1.55, -1] })));

    // ---------- the station building & waiting room ----------
    const w = (bw, bh, bd, x, y, z) => {
      const seg = makeWall(bw, bh, bd, wallMat);
      seg.position.set(x, y, z);
      this.add(seg);
      this.addCollider(seg);
      return seg;
    };
    // front wall, doorway at x −8.6
    w(0.85, BLD.h, 0.3, -9.575, 1.6, 4.85);
    w(7.05, BLD.h, 0.3, -4.525, 1.6, 4.85);
    const lintel = makeWall(1.1, 1.1, 0.3, wallMat);
    lintel.position.set(-8.6, 2.65, 4.85);
    this.add(lintel);
    w(9, BLD.h, 0.3, -5.5, 1.6, 9.55);          // back
    w(0.3, BLD.h, 5.0, -9.85, 1.6, 7.2);        // west
    w(0.3, BLD.h, 5.0, -1.15, 1.6, 7.2);        // east

    const roomFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 4.4),
      makeMat('wood', { base: '#6b5a42', repeat: [5, 3] })
    );
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(-5.5, 0.02, 7.2);
    roomFloor.receiveShadow = true;
    this.add(roomFloor);
    this.addGround(roomFloor);

    const roomCeil = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 4.4),
      makeMat('plaster', { base: '#7c7466', repeat: [4, 2] })
    );
    roomCeil.rotation.x = Math.PI / 2;
    roomCeil.position.set(-5.5, 3.0, 7.2);
    this.add(roomCeil);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.16, 5.6),
      new THREE.MeshStandardMaterial({ color: 0x2e2b27, roughness: 0.95 })
    );
    roof.position.set(-5.5, 3.28, 7.2);
    this.add(roof);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), wallMat);
    chimney.position.set(-2.4, 3.75, 8.7);
    this.add(chimney);

    // canopy over the platform side, holding a pool of warm light
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(9.4, 0.08, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x33302a, roughness: 0.9 })
    );
    canopy.position.set(-5.5, 2.86, 4.05);
    this.add(canopy);
    for (const px of [-9.2, -1.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.82, 0.09), metalMat);
      post.position.set(px, 1.41, 3.55);
      post.castShadow = true;
      this.add(post);
      this.addCollider(post);
    }
    const canopyBulb = makeBulbLight({ y: 2.72, intensity: 6, distance: 9, color: 0xffcf9c });
    canopyBulb.position.set(-3.4, 0, 3.95);
    this.add(canopyBulb);

    // the waiting room door stands open, warm light behind it
    const door = makeDoor({ width: 1.1, color: '#5c4a38', frameColor: '#453a2e' });
    door.position.set(-8.6, 0, 4.85);
    this.add(door);
    this.track(door);
    door.setOpen(true, -1);
    const doorSign = makeSign({
      text: 'waiting room', width: 0.78, height: 0.2,
      font: 'italic 40px Georgia', bg: '#3a3f35', color: '#d6d2c2',
    });
    doorSign.position.set(-8.6, 2.32, 4.66);
    doorSign.rotation.y = Math.PI;
    this.add(doorSign);

    const roomBulb = makeBulbLight({ y: 2.72, intensity: 7.5, distance: 10, color: 0xffdcae });
    roomBulb.position.set(-5.4, 0, 7.0);
    roomBulb.light.castShadow = true;
    this.add(roomBulb);
    // warmth spilling through the open door onto the platform
    const spill = new THREE.PointLight(0xffd9a8, 2.5, 4.5, 1.7);
    spill.position.set(-8.6, 1.7, 5.4);
    this.add(spill);
    this.track(this.add(makeDust({ count: 70, box: [7.6, 2.4, 4], center: [-5.5, 1.4, 7.2] })));

    // benches along the back wall; the stub waits on one of them
    for (const bx of [-7.7, -4.8]) {
      const bench = makeBench();
      bench.position.set(bx, 0.02, 9.0);
      bench.rotation.y = Math.PI;
      this.add(bench);
      this.addCollider(bench);
    }
    const stub = makeNoteProp({ tilt: 0.35 });
    stub.position.set(-7.5, 0.51, 8.95);
    this.add(stub);
    this._stub = stub;
    this.interact(stub, {
      prompt: 'the torn ticket',
      onInteract: () => {
        this.giveNote({
          id: 'l7-stub',
          title: 'a torn ticket, kept a long time',
          body:
            'SINGLE — standard class\n' +
            'ticket No. 1147\n\n' +
            'dep 23:4—      dest H————\n' +
            'CARRIAGE 3 · SEAT 41\n\n' +
            'fare 2.35\n\n' +
            'the date is worn to nothing. the fold\n' +
            'is soft, like it rode in a pocket for years.',
        }, () => {
          if (!this._stubRead) {
            this._stubRead = true;
            this.setObjective('one train tonight is still yours');
            this.subtitle('Only one train tonight would answer to it.', 4.5);
          }
        });
      },
    });

    // the shuttered ticket window, east wall
    const shutFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.35, 1.7), darkWood);
    shutFrame.position.set(-1.34, 1.62, 6.6);
    this.add(shutFrame);
    const shutter = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.15),
      new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.6, metalness: 0.35 })
    );
    shutter.position.set(-1.39, 1.6, 6.6);
    shutter.rotation.y = -Math.PI / 2;
    this.add(shutter);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 1.8), darkWood);
    sill.position.set(-1.5, 0.98, 6.6);
    this.add(sill);
    const closedSign = makeSign({
      text: 'closed', width: 0.26, height: 0.14,
      font: 'italic 44px Georgia', bg: '#d8d0ba', color: '#5a5244',
    });
    closedSign.position.set(-1.41, 1.72, 6.35);
    closedSign.rotation.y = -Math.PI / 2;
    closedSign.rotation.z = -0.06;
    this.add(closedSign);
    this.interact(shutter, {
      prompt: 'the ticket window',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('Shuttered. Behind the grille, a stool pushed back mid-shift, years ago.', 5);
      },
    });

    // the staff notice, sun-bleached, pinned beside the window — stage 2's key
    const notice = makeSign({
      text: 'STAFF NOTICE\n\ngate code is carriage,\nthen seat, of the last\nservice you rode.',
      width: 0.56, height: 0.46, font: 'bold 30px Georgia',
      bg: '#c7bda6', color: '#4c4638',
    });
    notice.position.set(-1.4, 1.62, 8.2);
    notice.rotation.y = -Math.PI / 2;
    notice.rotation.z = 0.03;
    this.add(notice);
    this._notice = notice;
    this.interact(notice, {
      prompt: 'a sun-bleached notice',
      onInteract: () => {
        this.learnClue({
          id: 'l7-notice',
          title: 'staff notice, sun-bleached',
          body: 'gate code is carriage, then seat,\nof the last service you rode.',
        });
        this.subtitle('The last service you rode. The stub has been in your pocket all along.', 5);
      },
    });

    // the stopped clock
    const clockBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.06, 20),
      darkWood
    );
    clockBody.rotation.z = Math.PI / 2;
    clockBody.position.set(-1.36, 2.55, 6.6);
    this.add(clockBody);
    const clockFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.38),
      new THREE.MeshStandardMaterial({ map: clockTexture(), transparent: true, roughness: 0.8 })
    );
    clockFace.position.set(-1.395, 2.55, 6.6);
    clockFace.rotation.y = -Math.PI / 2;
    this.add(clockFace);
    this.interact(clockFace, {
      prompt: 'the station clock',
      onInteract: () =>
        this.subtitle('Sixteen minutes to midnight. It has been sixteen minutes to midnight for years.', 5.5),
    });

    // peeling posters — resorts whose names the sun took back
    const posterA = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.85),
      new THREE.MeshStandardMaterial({
        map: posterTexture({ top: '#7a9ec2', mid: '#cfd8d4', low: '#5e7a8a', sand: '#c8b490', name: 'SILVERSTRAND' }),
        roughness: 0.9,
      })
    );
    posterA.position.set(-9.68, 1.75, 6.3);
    posterA.rotation.y = Math.PI / 2;
    posterA.rotation.z = 0.03;
    this.add(posterA);
    this.interact(posterA, {
      prompt: 'the peeling poster',
      onInteract: () =>
        this.subtitle('A seaside with a name the sun has taken back. Everyone in it is a smear of light.', 5.5),
    });
    const posterB = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.85),
      new THREE.MeshStandardMaterial({
        map: posterTexture({ top: '#8a87a8', mid: '#d8cfc4', low: '#6a7a6a', sand: '#a8a284', name: 'GREENHOLME' }),
        roughness: 0.9,
      })
    );
    posterB.position.set(-9.68, 1.75, 8.1);
    posterB.rotation.y = Math.PI / 2;
    posterB.rotation.z = -0.04;
    this.add(posterB);

    // ---------- the departures board (stage 1) ----------
    const boardTex = boardTexture(false);
    this._cancelTex = boardTexture(true);
    const boardMat = new THREE.MeshStandardMaterial({
      map: boardTex, emissive: 0xffffff, emissiveMap: boardTex,
      emissiveIntensity: 0.85, roughness: 0.7,
    });
    this._boardMat = boardMat;
    const boardBack = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.55, 0.1), metalMat);
    // The station wall's front is z=4.7. Mount the whole casing ahead of it;
    // a coplanar front face breaks into flickering blocks during mouse-look.
    boardBack.position.set(-3.4, 1.95, 4.64);
    this.add(boardBack);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.35), boardMat);
    board.position.set(-3.4, 1.95, boardBack.position.z - 0.07);
    board.rotation.y = Math.PI;
    this.add(board);
    this._board = board;
    this.interact(board, {
      prompt: 'read the departures board',
      distance: 4,
      onInteract: () => {
        this.learnClue({
          id: 'l7-board',
          title: 'departures — tonight',
          body:
            '23:12  ASHFELD      pl 1   delayed\n' +
            '23:31  HOLLOW BECK  pl 1   delayed\n' +
            '23:47  HARBECK      pl 2   on time\n' +
            '23:58  ASHFELD      pl 1   delayed\n' +
            '00:06  MOORCROFT    pl 1   delayed',
        });
        this.subtitle('Delayed, delayed, delayed. Only one of them still means to come.', 5);
        if (!this._gateOpen) this.setObjective('the way to platform 2 runs under the tracks');
      },
    });

    // a bench outside beneath the board, and the nameless station sign
    const outBench = makeBench();
    outBench.position.set(-6.35, 0, 4.25);
    outBench.rotation.y = Math.PI;
    this.add(outBench);
    this.addCollider(outBench);

    const totem = new THREE.Group();
    for (const tz of [5.85, 5.95]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.06), metalMat);
      post.position.set(4.5 + (tz - 5.9) * 14, 1.15, 5.9);
      totem.add(post);
    }
    const totemPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 0.52),
      new THREE.MeshStandardMaterial({ map: totemTexture(), roughness: 0.75 })
    );
    totemPanel.position.set(4.5, 2.0, 5.87);
    totemPanel.rotation.y = Math.PI;
    totem.add(totemPanel);
    this.add(totem);
    this.interact(totem, {
      prompt: 'the station sign',
      onInteract: () => this.subtitle('The name has weathered off the sign. You never needed it.', 5),
    });

    // ---------- the underpass ----------
    const buildFlight = (z0, z1) => {
      const zc = (z0 + z1) / 2;
      for (let i = 0; i < 12; i++) {
        const top = -0.275 * (i + 1);
        const h = top + 3.42;
        const tread = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 1.36), stairMat);
        tread.position.set(U.x0 + 0.3 * i + 0.15, top - h / 2, zc);
        tread.receiveShadow = true;
        this.add(tread);
        this.addGround(tread);
      }
      // shaft side walls below ground, railings above
      for (const sz of [z0 + 0.06, z1 - 0.06]) {
        const sw = makeWall(3.6, 3.42, 0.12, stairMat);
        sw.position.set((U.x0 + U.x1) / 2, -1.71, sz);
        this.add(sw);
        this.addCollider(sw);
      }
      for (const rz of [z0 - 0.06, z1 + 0.06]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.07, 0.06), metalMat);
        bar.position.set(10.25, 0.92, rz);
        this.add(bar);
        this.addCollider(bar);
        const mid = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.05, 0.05), metalMat);
        mid.position.set(10.25, 0.5, rz);
        this.add(mid);
        for (const px of [8.35, 10.25, 12.15]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.05), metalMat);
          post.position.set(px, 0.475, rz);
          this.add(post);
        }
      }
      const endBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, z1 - z0 + 0.24), metalMat);
      endBar.position.set(12.18, 0.92, zc);
      this.add(endBar);
      this.addCollider(endBar);
      // header sealing the sliver between shaft mouth and corridor ceiling
      const header = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, z1 - z0), stairMat);
      header.position.set(12.06, -1.1, zc);
      this.add(header);
    };
    buildFlight(U.s1z0, U.s1z1);
    buildFlight(U.s2z0, U.s2z1);

    // corridor under the tracks
    const cor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 11.6),
      makeMat('concrete', { base: '#57534b', repeat: [1.4, 10] })
    );
    cor.rotation.x = -Math.PI / 2;
    cor.position.set(12.8, U.floor, -1.6);
    cor.receiveShadow = true;
    this.add(cor);
    this.addGround(cor);
    const corCeil = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 11.6),
      makeMat('concrete', { base: '#49453f', repeat: [1.4, 10] })
    );
    corCeil.rotation.x = Math.PI / 2;
    corCeil.position.set(12.8, U.ceil, -1.6);
    this.add(corCeil);

    const cwWest = makeWall(0.12, 2.1, 8.4, tileMat);
    cwWest.position.set(12.06, -2.25, -1.6);
    this.add(cwWest);
    this.addCollider(cwWest);
    const cwEast = makeWall(0.12, 2.1, 11.6, tileMat);
    cwEast.position.set(13.54, -2.25, -1.6);
    this.add(cwEast);
    this.addCollider(cwEast);
    const cwNorth = makeWall(1.6, 2.1, 0.12, tileMat);
    cwNorth.position.set(12.8, -2.25, 4.26);
    this.add(cwNorth);
    this.addCollider(cwNorth);
    const cwSouth = makeWall(1.6, 2.1, 0.12, tileMat);
    cwSouth.position.set(12.8, -2.25, -7.46);
    this.add(cwSouth);
    this.addCollider(cwSouth);

    const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 11.4), metalMat);
    conduit.position.set(13.46, -1.5, -1.6);
    this.add(conduit);

    // one fluorescent, arguing with the dark
    const flTube = makeFluorescent({ length: 1.2, intensity: 5, flicker: 0.5 });
    flTube.position.set(12.8, -1.32, -1.6);
    this.add(flTube);
    this.track(flTube);
    for (const [lz, fz] of [[3.3, 3.35], [-6.5, -6.55]]) {
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.06, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0x2c2f33, emissive: 0xffc07a, emissiveIntensity: 1.2, roughness: 0.5,
        })
      );
      fixture.position.set(12.14, -1.5, fz);
      this.add(fixture);
      const wl = new THREE.PointLight(0xffc07a, 3, 7, 1.8);
      wl.position.set(12.5, -1.7, lz);
      this.add(wl);
    }

    const wayOut = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.3),
      new THREE.MeshStandardMaterial({
        map: textTexture({
          text: '← platform 2', width: 512, height: 140,
          font: 'bold 54px Georgia', bg: '#27303f', color: '#dfe4ec',
        }),
        roughness: 0.75,
      })
    );
    wayOut.position.set(12.8, -2.0, -7.39);
    this.add(wayOut);

    // the plate at the top of the far stairs
    const p2Post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), metalMat);
    p2Post.position.set(8.05, 1.1, -6.6);
    this.add(p2Post);
    const p2Plate = makeSign({
      text: 'platform 2', width: 0.85, height: 0.22,
      font: 'bold 40px Georgia', bg: '#232c3e', color: '#dfe4ec', doubleSided: true,
    });
    p2Plate.position.set(8.05, 2.0, -6.6);
    p2Plate.rotation.y = Math.PI / 2;
    this.add(p2Plate);

    // ---------- the staff gate & keypad (stage 2) ----------
    for (const gz of [U.s1z0 - 0.05, U.s1z1 + 0.05]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.05, 0.1), metalMat);
      post.position.set(8.3, 1.025, gz);
      post.castShadow = true;
      this.add(post);
    }
    const gate = makeBarGate({ span: 1.48, height: 1.9 });
    gate.position.set(8.3, 0, U.s1z0 + 0.06);
    this.add(gate);
    this.track(gate);
    this.addCollider(gate);
    this._gate = gate;
    this._gateOpen = false;

    const gatePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.13),
      new THREE.MeshStandardMaterial({
        map: textTexture({
          text: 'staff gate', width: 256, height: 92,
          font: 'bold 40px Georgia', bg: '#4a4f55', color: '#c9cdd2',
        }),
        roughness: 0.6, metalness: 0.3,
      })
    );
    gatePlate.position.set(-0.06, 1.42, 0.74);
    gatePlate.rotation.y = -Math.PI / 2;
    gate.add(gatePlate);

    const keypad = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.13, 0.09),
      new THREE.MeshStandardMaterial({
        color: 0x494c4a, roughness: 0.45, metalness: 0.3,
        emissive: 0x2a4432, emissiveIntensity: 0.6,
      })
    );
    keypad.position.set(8.24, 1.22, 4.02);
    this.add(keypad);

    this.interact(gate, {
      prompt: 'the staff gate',
      distance: 2.6,
      onInteract: () => {
        if (this._gateOpen) return;
        this.game.ui.showKeypad({
          label: 'staff gate',
          length: 3,
          onSubmit: (code) => {
            if (code === '341') {           // carriage 3 · seat 41
              this._gateOpen = true;
              this.playSound('unlock');
              gate.setOpen(true, 1);
              this.removeColliderOf(gate);
              this.game.interaction.remove(gate);
              this.playSound('door');
              this.subtitle('Unlocked. Under the tracks, the air is colder.', 4.5);
              this.setObjective('platform 2 — stand behind the line');
            } else {
              this.playSound('wrong');
              this.subtitle('That number never mattered.', 4.5);
            }
          },
        });
      },
    });

    // ---------- platform 2 dressing ----------
    const case1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.6, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.85 })
    );
    case1.position.set(4.7, 0.3, -6.9);
    case1.rotation.y = 0.25;
    case1.castShadow = true;
    this.add(case1);
    this.addCollider(case1);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.04), darkWood);
    handle.position.set(4.7, 0.64, -6.9);
    handle.rotation.y = 0.25;
    this.add(handle);
    this.interact(case1, {
      prompt: 'the suitcase',
      onInteract: () => this.subtitle('It is packed. It has been packed for years.', 5),
    });

    // ---------- the exit gate (stage 3's door) ----------
    for (const gz of [-6.7, -8.3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.1), metalMat);
      post.position.set(GATE_X, 1.05, gz);
      post.castShadow = true;
      this.add(post);
    }
    const fencePanel = (z0, z1) => {
      for (const y of [0.55, 1.35]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, z1 - z0), metalMat);
        r.position.set(GATE_X, y, (z0 + z1) / 2);
        this.add(r);
      }
      const n = Math.max(2, Math.floor((z1 - z0) / 0.42));
      for (let i = 1; i < n; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.7, 0.04), metalMat);
        p.position.set(GATE_X, 0.9, z0 + ((z1 - z0) / n) * i);
        this.add(p);
      }
      this.addBlocker([GATE_X - 0.08, 0, z0], [GATE_X + 0.08, 1.9, z1]);
    };
    fencePanel(P2.z0 + 0.25, -8.3);
    fencePanel(-6.7, P2.z1);

    const exitGate = makeBarGate({ span: 1.6, height: 1.9, bars: 4 });
    exitGate.position.set(GATE_X, 0, -8.3);
    this.add(exitGate);
    this.track(exitGate);
    this.addCollider(exitGate);
    this._exitGate = exitGate;
    this._exitOpen = false;
    this.interact(exitGate, {
      prompt: 'the far gate',
      onInteract: () => {
        if (this._exitOpen) return;
        this.playSound('locked');
        this.subtitle('It holds fast. Something has not passed yet.', 5);
      },
    });

    const headerBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), metalMat);
    headerBar.position.set(GATE_X, 2.12, -7.5);
    this.add(headerBar);
    const outSign = makeSign({
      text: 'way out', width: 0.66, height: 0.2,
      font: 'italic 40px Georgia', bg: '#2c3242', color: '#cfd4dc',
    });
    outSign.position.set(GATE_X + 0.06, 1.98, -7.5);
    outSign.rotation.y = Math.PI / 2;
    this.add(outSign);

    // ---------- the 23:47 (stage 3) ----------
    this._buildTrain();
    this._phase = 'idle';
    this._standT = 0;
    this._seq = 0;
    this._singIdx = 0;
    this._nextRumble = 0;
    this._hornDone = false;
    this._steppedOut = false;

    const SING = [[0.05, 172], [0.5, 214], [0.95, 258], [1.4, 312], [1.75, 378]];
    this.tick((dt) => {
      const p = this.game.player.position;
      if (this._phase === 'idle') {
        if (!this._gateOpen) return;
        const onP2 = p.x < 6.8 && p.z < -5.2 && p.z > -10.6 && p.y > 0.5;
        if (onP2 && !this._steppedOut) {
          this._steppedOut = true;
          this.subtitle('Platform 2. The line is where it always was.', 4.5);
        }
        this._standT = onP2 ? this._standT + dt : 0;
        if (this._standT > 1.5) {
          this._phase = 'run';
          this._seq = 0;
          this.subtitle('The rails have begun to sing.', 4);
        }
      } else if (this._phase === 'run') {
        this._seq += dt;
        const t = this._seq;
        while (this._singIdx < SING.length && t >= SING[this._singIdx][0]) {
          this.playSound('tone', {
            freq: SING[this._singIdx][1],
            gain: 0.06 + 0.012 * this._singIdx,
            decay: 1.7,
          });
          this._singIdx++;
        }
        this._railMat.emissiveIntensity =
          Math.min(0.22, t * 0.09) * (0.75 + 0.25 * Math.sin(t * 9));
        const drive = t - 1.7;
        if (drive >= 0) {
          if (!this._train.visible) this._train.visible = true;
          const nose = TRAIN.enter - TRAIN.speed * drive;
          this._train.position.x = nose;
          if (!this._hornDone && nose < 46) {
            this._hornDone = true;
            this.playSound('tone', { freq: 288, gain: 0.2, decay: 2.4 });
            this.playSound('tone', { freq: 242, gain: 0.16, decay: 2.4 });
          }
          if (nose < 70 && nose > -130 && t > this._nextRumble) {
            this._nextRumble = t + 0.36;
            this.playSound('tone', { freq: 38 + Math.random() * 26, gain: 0.19, decay: 0.75 });
            if (Math.random() < 0.3) {
              this.playSound('tone', { freq: 900 + Math.random() * 700, gain: 0.02, decay: 0.4 });
            }
          }
          if (nose < TRAIN.gone) {
            this._phase = 'after';
            this._train.visible = false;
            this.after(0.6, () => {
              this._boardMat.map = this._cancelTex;
              this._boardMat.emissiveMap = this._cancelTex;
              this._boardMat.needsUpdate = true;
              this.playSound('switch');
              this.subtitle('It did not stop. It was never going to stop.', 5.5);
            });
            this.after(2.6, () => {
              this._exitOpen = true;
              this.playSound('unlock');
              exitGate.setOpen(true, -1);
              this.removeColliderOf(exitGate);
              this.game.interaction.remove(exitGate);
              this.subtitle('At the far end of the platform, something lets go.', 5);
              this.setObjective('the far gate stands open');
            });
          }
        }
      } else if (this._phase === 'after') {
        this._railMat.emissiveIntensity = Math.max(0, this._railMat.emissiveIntensity - dt * 0.3);
      }
    });

    // walking out through the far gate finishes the level
    this.tick(() => {
      if (this._exitOpen && !this.isCompleted) {
        const p = this.game.player.position;
        if (p.x < GATE_X - 1.2 && p.z < -5.2) this.complete();
      }
    });

    // ---------- spawn & objective ----------
    this.spawn.position.set(-3.4, 0, 2.05);
    this.spawn.yaw = Math.PI;   // facing the board and the waiting room's light
    this.setObjective('the waiting room kept its light on');
  }

  // the long train that does not stop — dark carriages, lit for nobody
  _buildTrain() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x14161b, roughness: 0.8, metalness: 0.25,
    });
    const stripTex = windowStripTexture();
    const stripMat = new THREE.MeshStandardMaterial({
      map: stripTex, emissive: 0xffffff, emissiveMap: stripTex,
      emissiveIntensity: 0.55, roughness: 0.6,
    });
    for (let i = 0; i < TRAIN.cars; i++) {
      const cx = 7.6 + i * TRAIN.pitch;
      const body = new THREE.Mesh(new THREE.BoxGeometry(15.2, 3.4, 2.9), bodyMat);
      body.position.set(cx, 1.3, 0);
      g.add(body);
      for (const s of [-1, 1]) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(14.2, 0.55), stripMat);
        strip.position.set(cx, 2.05, s * 1.46);
        if (s < 0) strip.rotation.y = Math.PI;
        g.add(strip);
      }
    }
    const lamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 16),
      new THREE.MeshStandardMaterial({
        color: 0x222222, emissive: 0xffedc8, emissiveIntensity: 5,
      })
    );
    lamp.position.set(-0.02, 1.5, 0);
    lamp.rotation.y = -Math.PI / 2;
    g.add(lamp);
    const head = new THREE.PointLight(0xffe9c4, 120, 60, 1.5);
    head.position.set(-1.2, 1.6, 0);
    g.add(head);
    const tail = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 12),
      new THREE.MeshStandardMaterial({
        color: 0x220808, emissive: 0xff3826, emissiveIntensity: 3,
      })
    );
    tail.position.set(TRAIN.cars * TRAIN.pitch - 0.65, 1.5, 0);
    tail.rotation.y = Math.PI / 2;
    g.add(tail);
    g.position.set(TRAIN.enter, 0, TRACK_B);
    g.visible = false;
    this.add(g);
    this._train = g;
  }

  async debugSolve() {
    // the stub on the waiting-room bench
    this.debugInteract(this._stub);
    await this.debugWait(0.35);
    this.game.ui.closeModal();
    // the staff notice, then the board — the cross-reference
    this.debugInteract(this._notice);
    await this.debugWait(0.25);
    this.debugInteract(this._board);
    await this.debugWait(0.25);
    // the staff gate: carriage 3, then seat 41
    this.game.player.teleport(7.4, 3.4, -Math.PI / 2);
    await this.debugWait(0.2);
    this.debugInteract(this._gate);
    await this.debugWait(0.35);
    this.game.ui.submitKeypad('341');
    await this.debugWait(0.8);
    // stand behind the line on platform 2; let the 23:47 come and go.
    // Headless renders run far below real-time and the engine clamps dt,
    // so lean on timeScale while the sequence plays — the handlers stay real.
    this.game.player.teleport(2.5, -6.4, 0, 0);
    this.game.engine.timeScale = 9;
    for (let i = 0; i < 60 && !this._exitOpen; i++) await this.debugWait(0.4);
    this.game.engine.timeScale = 1;
    // walk out through the far gate
    this.game.player.teleport(GATE_X - 2, -7.6, Math.PI / 2, 0);
    await this.debugWait(0.8);
  }
}
