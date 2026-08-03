import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture, noiseMap } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeFluorescent, makeNoteProp,
  makeSign, makeTable, makeChair, makeDust, applyFog,
} from '../core/props.js';

// IV — The Supermarket
// An hour after closing. Five runs of shelves under the fluorescent hum,
// freezers keeping their vigil along the west wall, one checkout lane still
// lit. M.'s list waits at lane three: milk, bread, apples, sunflowers. The
// aisles remember where everything is; the staff door wants the aisle
// numbers back in the order she wrote them.

const W = 26;                      // interior width  (x −13 .. +13)
const D = 20;                      // interior depth  (z −10 back .. +10 front)
const H = 4.2;
const RUN_X = [-8, -4, 0, 4, 8];   // five gondola runs → four aisles between
const RUN_Z = -2.5;                // run centers; each run is 10 m (z −7.5 .. 2.5)
const AISLES = [                   // canon: milk 3 · bread 1 · apples 4 · sunflowers 2
  { n: 1, x: -6, dept: 'bakery' },
  { n: 2, x: -2, dept: 'flowers' },
  { n: 3, x: 2, dept: 'dairy' },
  { n: 4, x: 6, dept: 'produce' },
];
const STOCK_COLORS = [
  '#8c5c4a', '#5f6d78', '#7a7154', '#94836a',
  '#586150', '#7d5f66', '#9c8f78', '#515c66',
];

// hanging aisle sign face: big numeral over a small department word
function aisleSignTexture(num, dept) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#36423b';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = 'rgba(226,222,206,0.45)';
  ctx.lineWidth = 5;
  ctx.strokeRect(11, 11, 490, 234);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ece8d8';
  ctx.font = 'bold 158px Georgia';
  ctx.fillText(String(num), 256, 92);
  ctx.fillStyle = '#c2bda6';
  ctx.font = 'italic 46px Georgia';
  ctx.fillText(dept, 256, 204);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the office rota: a full week of shifts, every one crossed out
function rotaTexture() {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 300;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d7d0bc';
  ctx.fillRect(0, 0, 384, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a463a';
  ctx.font = 'bold 26px Georgia';
  ctx.fillText('STAFF ROTA', 192, 34);
  ctx.textAlign = 'left';
  ctx.font = '21px Georgia';
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  days.forEach((d, i) => {
    const y = 74 + i * 31;
    ctx.fillStyle = '#57523f';
    ctx.fillText(d, 30, y);
    ctx.fillText('08 — close', 226, y);
    // struck through, week after week, in the same red pen
    ctx.strokeStyle = 'rgba(120,42,32,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, y - 7 + (Math.random() - 0.5) * 5);
    ctx.lineTo(356, y - 9 + (Math.random() - 0.5) * 7);
    ctx.stroke();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * One double-sided gondola run with sparse, tired stock. The group sits at
 * (x, 0, RUN_Z); shelf surfaces are at SHELF_Y. `skip` reserves slots
 * ({s: ±1, lvl, z} in run-local coords) so the list items get their shelf.
 */
const SHELF_Y = [0.3, 0.638, 1.158, 1.678];
function makeRun(shelfMat, skip = []) {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 10), shelfMat);
  plinth.position.y = 0.15;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 10), shelfMat);
  back.position.y = 0.95;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.04, 10.04), shelfMat);
  top.position.y = 1.9;
  g.add(plinth, back, top);
  for (const y of [0.62, 1.14, 1.66]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.036, 10), shelfMat);
    board.position.y = y;
    board.receiveShadow = true;
    g.add(board);
  }
  for (const e of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.9, 0.06), shelfMat);
    cap.position.set(0, 0.95, e * 5);
    g.add(cap);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

  // sparse stock: a dozen quiet clusters per run
  const slots = [];
  for (const s of [-1, 1]) {
    for (let lvl = 0; lvl < 4; lvl++) {
      for (const z of [-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2]) slots.push({ s, lvl, z });
    }
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  let placed = 0;
  for (const slot of slots) {
    if (placed >= 12) break;
    if (skip.some((r) => r.s === slot.s && r.lvl === slot.lvl && Math.abs(r.z - slot.z) < 1.3)) continue;
    const y0 = SHELF_Y[slot.lvl];
    const color = STOCK_COLORS[Math.floor(Math.random() * STOCK_COLORS.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
    if (Math.random() < 0.25) {
      // a short row of tins
      for (let k = 0; k < 3; k++) {
        const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.19, 10), mat);
        tin.position.set(slot.s * 0.22, y0 + 0.095, slot.z - 0.15 + k * 0.15);
        tin.castShadow = true;
        g.add(tin);
      }
    } else {
      const h = 0.16 + Math.random() * 0.17;
      const len = 0.5 + Math.random() * 0.6;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, len), mat);
      box.position.set(slot.s * 0.22, y0 + h / 2, slot.z + (Math.random() - 0.5) * 0.2);
      box.castShadow = true;
      g.add(box);
    }
    placed++;
  }
  return g;
}

/** A chest freezer with a faintly lit lid, humming to itself. */
function makeFreezer(bodyMat, lidMat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 1.9), bodyMat);
  body.position.y = 0.425;
  body.castShadow = body.receiveShadow = true;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 1.72), lidMat);
  lid.position.y = 0.87;
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.04, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x9a9d98, roughness: 0.4, metalness: 0.6 })
  );
  handle.position.set(0.36, 0.83, 0);
  g.add(body, lid, handle);
  return g;
}

/** Checkout lane: counter, belt, dead register, numbered pole sign. */
function makeLane(n, lit) {
  const g = new THREE.Group();
  const counterMat = new THREE.MeshStandardMaterial({
    color: 0x7d8279, roughness: 0.55, metalness: 0.1,
    bumpMap: noiseMap({ size: 128 }), bumpScale: 0.4,
  });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.92, 2.6), counterMat);
  counter.position.y = 0.46;
  counter.castShadow = counter.receiveShadow = true;
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.05, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6 })
  );
  belt.position.set(0, 0.955, 0.35);
  const register = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.26, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x8e8b82, roughness: 0.5 })
  );
  register.position.set(0, 1.05, -0.85);
  register.castShadow = true;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x101312, roughness: 0.3 })
  );
  screen.position.set(0, 1.12, -0.7);
  screen.rotation.x = -0.35;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x6f7472, roughness: 0.4, metalness: 0.7 })
  );
  pole.position.set(0.25, 1.47, 1.14);
  const signBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x2c2f30, roughness: 0.6 })
  );
  signBox.position.set(0.25, 2.12, 1.14);
  g.add(counter, belt, register, screen, pole, signBox);
  const numTex = textTexture({
    text: String(n), width: 160, height: 160, font: 'bold 112px Georgia',
    bg: lit ? '#f0d6a2' : '#3a3d3f', color: lit ? '#54431f' : '#75797b',
  });
  for (const f of [-1, 1]) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.26),
      new THREE.MeshStandardMaterial({
        map: numTex,
        emissive: 0xffffff, emissiveMap: numTex,
        emissiveIntensity: lit ? 0.8 : 0.02,
        roughness: 0.6,
      })
    );
    face.position.set(0.25, 2.12, 1.14 + f * 0.034);
    if (f < 0) face.rotation.y = Math.PI;
    g.add(face);
  }
  return g;
}

export default class Level04 extends LevelBase {
  static meta = {
    id: 4,
    numeral: 'IV',
    title: 'The Supermarket',
    mood: 'store',
    intro: 'The supermarket, an hour after closing. They left one lane lit, as if they knew you still had shopping to do.',
    outro:
      'Milk, bread, apples, sunflowers — nothing forgotten, this once.\n' +
      'You went out the way the mornings used to come in.\n' +
      'Somewhere a kitchen is keeping Sunday open for you.',
  };

  build() {
    applyFog(this.scene, '#0f1114', 4, 32);

    // ---------- shell ----------
    const floorMat = makeMat('checker', { a: '#cbc3ae', b: '#8e8e84', repeat: [13, 10] });
    const ceilMat = makeMat('ceiling', { base: '#c2beb2', repeat: [13, 10] });
    const wallMat = makeMat('plaster', { base: '#aeaca0', repeat: [10, 2] });
    const wallMatNarrow = makeMat('plaster', { base: '#a8a294', repeat: [2.5, 1.5] });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26.4, 20.2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.1);
    floor.receiveShadow = true;
    this.add(floor);
    this.addGround(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(26.4, 20.4), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, H, 0.05);
    this.add(ceil);

    for (const side of [-1, 1]) {          // west / east walls
      const wall = makeWall(0.24, H, D + 0.4, wallMat);
      wall.position.set(side * (W / 2 + 0.12), H / 2, 0);
      this.add(wall);
      this.addCollider(wall);
    }

    // front wall (+z) with dark glass and the way in
    const front = makeWall(W + 0.4, H, 0.24, wallMat);
    front.position.set(0, H / 2, D / 2 + 0.12);
    this.add(front);
    this.addCollider(front);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f12, roughness: 0.16, metalness: 0.55,
    });
    for (const gx of [-9.9, -6.6, -3.3, 3.3, 6.6, 9.9]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.6), glassMat);
      pane.position.set(gx, 1.5, D / 2 - 0.02);
      pane.rotation.y = Math.PI;
      this.add(pane);
    }
    const entrance = new THREE.Group();
    for (const dx of [-0.64, 0.64]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 2.6), glassMat);
      pane.position.set(dx, 1.5, 0);
      pane.rotation.y = Math.PI;
      entrance.add(pane);
    }
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x707476, roughness: 0.45, metalness: 0.6 });
    for (const mx of [-1.3, 0, 1.3]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.7, 0.06), mullionMat);
      mullion.position.set(mx, 1.35, 0.01);
      entrance.add(mullion);
    }
    entrance.position.set(0, 0, D / 2 - 0.04);
    this.add(entrance);
    this.interact(entrance, {
      prompt: 'the way in',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('Locked. The car park beyond the glass is a still black lake.', 5);
      },
    });

    // a hand-written apology, taped to the glass a long time ago
    const fiveSign = makeSign({
      text: 'back in\nfive minutes', width: 0.36, height: 0.3,
      font: 'italic 44px Georgia', bg: '#ded6c1', color: '#4a4438',
    });
    fiveSign.position.set(0.66, 1.42, D / 2 - 0.07);
    fiveSign.rotation.y = Math.PI;
    fiveSign.rotation.z = 0.05;
    this.add(fiveSign);
    this.interact(fiveSign, {
      prompt: 'read the sign',
      onInteract: () => this.subtitle('It has been longer than five minutes.', 4.5),
    });

    // back wall (−z) with the staff doorway near the east corner
    const backL = makeWall(21.73, H, 0.24, wallMat);
    backL.position.set(-2.255, H / 2, -D / 2 - 0.12);
    this.add(backL);
    this.addCollider(backL);
    const backR = makeWall(3.23, H, 0.24, wallMatNarrow);
    backR.position.set(11.505, H / 2, -D / 2 - 0.12);
    this.add(backR);
    this.addCollider(backR);
    const backLintel = makeWall(1.28, 1.94, 0.24, wallMatNarrow);
    backLintel.position.set(9.25, 3.23, -D / 2 - 0.12);
    this.add(backLintel);

    // ---------- lights ----------
    this.add(new THREE.HemisphereLight(0x9fb2b8, 0x2a2c26, 0.55));
    for (const fx of [-6, -2, 2, 6]) {
      for (const fz of [2.2, -3.8, -7.6]) {
        const flicker = (fx === 6 && fz === -3.8) ? 0.55 : 0; // the bad tube, back right
        const fl = makeFluorescent({ length: 2, intensity: 6, flicker });
        fl.position.set(fx, 4.1, fz);
        fl.rotation.y = Math.PI / 2;
        if (fx === 2 && fz === 2.2) fl.light.castShadow = true;
        this.add(fl);
        this.track(fl);
      }
    }
    const entranceLight = makeFluorescent({ length: 1.8, intensity: 4.5 });
    entranceLight.position.set(0, 4.1, 7.5);
    this.add(entranceLight);
    this.track(entranceLight);
    this.track(this.add(makeDust({ count: 240, box: [24, 3.4, 18], center: [0, 1.9, 0] })));

    // ---------- aisles: runs, signs, stock ----------
    const shelfMat = new THREE.MeshStandardMaterial({
      color: 0x938f84, roughness: 0.6, metalness: 0.15,
      bumpMap: noiseMap({ size: 128 }), bumpScale: 0.5,
    });
    for (const rx of RUN_X) {
      const skip = [];
      if (rx === -4) skip.push({ s: -1, lvl: 1, z: 0.5 });   // the bread's shelf (aisle 1 side)
      if (rx === 4) skip.push({ s: -1, lvl: 2, z: -1.5 });   // the milk's shelf (aisle 3 side)
      const run = makeRun(shelfMat, skip);
      run.position.set(rx, 0, RUN_Z);
      this.add(run);
      this.addCollider(run);
    }

    const rodMat = new THREE.MeshStandardMaterial({ color: 0x3c3e3d, roughness: 0.5, metalness: 0.6 });
    for (const a of AISLES) {
      const tex = aisleSignTexture(a.n, a.dept);
      const signMat = new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, roughness: 0.8,
      });
      for (const f of [-1, 1]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), signMat);
        face.position.set(a.x, 2.95, 1.6 + f * 0.005);
        if (f < 0) face.rotation.y = Math.PI;
        this.add(face);
      }
      for (const rx of [-0.55, 0.55]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.88, 6), rodMat);
        rod.position.set(a.x + rx, 3.76, 1.6);
        this.add(rod);
      }
    }

    // a box that fell and was never picked up
    const fallen = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.18, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x7a5f4e, roughness: 0.9 })
    );
    fallen.position.set(-2.2, 0.09, -3.4);
    fallen.rotation.y = 0.7;
    fallen.castShadow = true;
    this.add(fallen);

    // sale cards taped to the middle end caps
    for (const sx of [0, 4]) {
      const card = makeSign({
        text: 'sale', width: 0.24, height: 0.3,
        font: 'italic 54px Georgia', bg: '#e0d8c2', color: '#8a3f34',
      });
      card.position.set(sx + 0.1, 1.22, RUN_Z + 5.04);
      card.rotation.z = (sx === 0 ? -1 : 1) * 0.05;
      this.add(card);
    }

    // the community board by the east windows: little futures, still pinned up
    const board = new THREE.Group();
    const cork = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.8, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x9a7c58, roughness: 0.9 })
    );
    cork.position.set(12.86, 1.6, 6.2);
    board.add(cork);
    for (let i = 0; i < 5; i++) {
      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xded7c4, roughness: 0.85 })
      );
      paper.position.set(12.83, 1.42 + (i % 2) * 0.34, 5.8 + (i * 0.19));
      paper.rotation.y = -Math.PI / 2;
      paper.rotation.z = (Math.random() - 0.5) * 0.24;
      board.add(paper);
    }
    this.add(board);
    this.interact(board, {
      prompt: 'the noticeboard',
      onInteract: () => this.subtitle('Piano lessons. A lost cat. A room to let. All the little futures, still pinned up.', 5.5),
    });

    // hand baskets nested by the windows
    const basketMat = new THREE.MeshStandardMaterial({ color: 0x565e66, roughness: 0.7 });
    for (let i = 0; i < 3; i++) {
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.32), basketMat);
      basket.position.set(12.3, 0.065 + i * 0.11, 7.3);
      basket.rotation.y = (i % 2) * 0.16;
      basket.castShadow = true;
      this.add(basket);
    }

    // ---------- the four things on the list ----------
    const logged = new Set();
    const logItem = (key, clue, line) => {
      if (logged.has(key)) return;
      logged.add(key);
      this.learnClue(clue);
      this.subtitle(line, 4.5);
      if (logged.size === 4) {
        this.after(4.8, () => {
          this.subtitle('The office will want the list in order.', 5);
          this.setObjective('the staff door, in the order she wrote them');
        });
      }
    };

    // milk — aisle 3 (dairy shelf of the fourth run, west face)
    const milk = new THREE.Group();
    const milkMat = new THREE.MeshStandardMaterial({ color: 0xe4e1d6, roughness: 0.55 });
    for (let i = 0; i < 4; i++) {
      const carton = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.1), milkMat);
      carton.position.set(3.78, 1.278, -4.32 + i * 0.13);
      carton.castShadow = true;
      milk.add(carton);
    }
    const leaning = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.1), milkMat);
    leaning.position.set(3.7, 1.278, -3.72);
    leaning.rotation.y = 0.35;
    milk.add(leaning);
    this.add(milk);
    this.interact(milk, {
      prompt: 'the milk',
      once: true,
      onInteract: () => logItem('milk',
        { id: 'l4-milk', title: 'milk — aisle 3', body: 'a white carton from the dairy cooler.\nstill cold. aisle 3.' },
        'Still cold, as if someone might yet come home and pour it.'),
    });

    // bread — aisle 1 (bakery shelf of the second run, west face)
    const bread = new THREE.Group();
    const breadMat = new THREE.MeshStandardMaterial({ color: 0xc39a63, roughness: 0.92 });
    for (let i = 0; i < 3; i++) {
      const loaf = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.14), breadMat);
      loaf.position.set(-4.24, 0.693, -2.32 + i * 0.17);
      loaf.rotation.y = (Math.random() - 0.5) * 0.15;
      loaf.castShadow = true;
      bread.add(loaf);
    }
    const topLoaf = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.14), breadMat);
    topLoaf.position.set(-4.24, 0.8, -2.1);
    topLoaf.rotation.y = 0.4;
    topLoaf.rotation.z = 0.08;
    bread.add(topLoaf);
    this.add(bread);
    this.interact(bread, {
      prompt: 'the bread',
      once: true,
      onInteract: () => logItem('bread',
        { id: 'l4-bread', title: 'bread — aisle 1', body: 'loaves going quietly stale under the bakery sign.\naisle 1.' },
        'Yesterday’s bread. The mornings here stopped arriving.'),
    });

    // apples — aisle 4 (a floor crate against the fourth run, east face)
    const apples = new THREE.Group();
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x6b543a, roughness: 0.85 })
    );
    crate.position.set(4.95, 0.11, -5.2);
    crate.castShadow = crate.receiveShadow = true;
    apples.add(crate);
    const appleMat = new THREE.MeshStandardMaterial({ color: 0xa63b30, roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), appleMat);
      apple.position.set(
        4.95 - 0.17 + (i % 4) * 0.115 + (Math.random() - 0.5) * 0.02,
        0.245,
        -5.2 - 0.08 + Math.floor(i / 4) * 0.16 + (Math.random() - 0.5) * 0.02
      );
      apple.castShadow = true;
      apples.add(apple);
    }
    this.add(apples);
    this.interact(apples, {
      prompt: 'the apples',
      once: true,
      onInteract: () => logItem('apples',
        { id: 'l4-apples', title: 'apples — aisle 4', body: 'a crate of red apples, polished by nobody.\naisle 4.' },
        'She would polish one on her sleeve before handing it over.'),
    });

    // sunflowers — aisle 2 (a bucket against the second run, east face)
    const sunflowers = new THREE.Group();
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.115, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x6d7276, roughness: 0.35, metalness: 0.5 })
    );
    bucket.position.set(-3.1, 0.15, 0.6);
    bucket.castShadow = true;
    sunflowers.add(bucket);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f5c33, roughness: 0.9 });
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xd9a92e, roughness: 0.75 });
    const heartMat = new THREE.MeshStandardMaterial({ color: 0x4a3a22, roughness: 0.95 });
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const lean = 0.14 + Math.random() * 0.1;
      const hx = -3.1 + Math.cos(ang) * lean;
      const hz = 0.6 + Math.sin(ang) * lean * 0.7;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.55, 6), stemMat);
      stem.position.set(-3.1 + Math.cos(ang) * lean * 0.5, 0.42, 0.6 + Math.sin(ang) * lean * 0.35);
      stem.rotation.z = Math.cos(ang) * 0.28;
      stem.rotation.x = -Math.sin(ang) * 0.2;
      sunflowers.add(stem);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), petalMat);
      head.position.set(hx, 0.68 + (Math.random() - 0.5) * 0.05, hz);
      head.rotation.x = Math.PI / 2 - 0.5 - Math.sin(ang) * 0.2;
      head.rotation.z = -Math.cos(ang) * 0.3;
      sunflowers.add(head);
      const heart = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), heartMat);
      heart.position.copy(head.position);
      sunflowers.add(heart);
    }
    this.add(sunflowers);
    this.interact(sunflowers, {
      prompt: 'the sunflowers',
      once: true,
      onInteract: () => logItem('sunflowers',
        { id: 'l4-sunflowers', title: 'sunflowers — aisle 2', body: 'cut sunflowers in a bucket of grey water.\naisle 2. the Sunday kind.' },
        'Sunflowers. She bought them every Sunday, even the Sundays you didn’t come.'),
    });

    // ---------- freezers along the west wall ----------
    const freezerBodyMat = new THREE.MeshStandardMaterial({
      color: 0xdfe0da, roughness: 0.5, bumpMap: noiseMap({ size: 128 }), bumpScale: 0.3,
    });
    const freezerLidMat = new THREE.MeshStandardMaterial({
      color: 0x9fb8b4, roughness: 0.25, metalness: 0.2,
      emissive: 0xb8d6d2, emissiveIntensity: 0.55,
    });
    let midFreezer = null;
    for (let i = 0; i < 5; i++) {
      const fz = makeFreezer(freezerBodyMat, freezerLidMat);
      fz.position.set(-12.46, 0, -6.8 + i * 2.2);
      this.add(fz);
      this.addCollider(fz);
      if (i === 2) midFreezer = fz;
    }
    this.interact(midFreezer, {
      prompt: 'rest a hand on the freezer',
      onInteract: () => this.subtitle('Still humming. The cold has outlasted whatever it was keeping.', 5),
    });

    // ---------- checkouts & the list ----------
    for (const [n, lx] of [[1, -4], [2, 0], [3, 4]]) {
      const lane = makeLane(n, n === 3);
      lane.position.set(lx, 0, 5.4);
      this.add(lane);
      this.addCollider(lane);
    }
    const laneLamp = new THREE.PointLight(0xffd9a2, 5, 6.5, 1.7);
    laneLamp.position.set(4.3, 2.2, 6.9);
    this.add(laneLamp);

    const list = makeNoteProp();
    list.position.set(4, 0.985, 5.75);
    this.add(list);
    this.interact(list, {
      prompt: 'read the list',
      onInteract: () => {
        this.giveNote({
          id: 'l4-list',
          title: 'her list, left at lane three',
          body:
            'milk\n' +
            'bread\n' +
            'apples\n' +
            'sunflowers\n\n' +
            'for Sunday. don’t forget again.\n\n' +
            '— M.',
        });
        if (!this._readList) {
          this._readList = true;
          if (logged.size < 4) this.setObjective('find what she sent you for');
        }
      },
    });

    // ---------- the staff office ----------
    const officeFloorMat = makeMat('carpet', { base: '#5f5852', repeat: [4, 3] });
    const officeFloor = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.5), officeFloorMat);
    officeFloor.rotation.x = -Math.PI / 2;
    officeFloor.position.set(9.5, 0, -12.25);
    officeFloor.receiveShadow = true;
    this.add(officeFloor);
    this.addGround(officeFloor);

    const officeCeil = new THREE.Mesh(new THREE.PlaneGeometry(6.24, 4.5), makeMat('plaster', { base: '#b0aa9a', repeat: [3, 2] }));
    officeCeil.rotation.x = Math.PI / 2;
    officeCeil.position.set(9.5, 2.9, -12.37);
    this.add(officeCeil);

    for (const ox of [6.5, 12.5]) {      // office west / east walls
      const wall = makeWall(0.24, 2.9, 4.26, wallMatNarrow);
      wall.position.set(ox, 1.45, -12.37);
      this.add(wall);
      this.addCollider(wall);
    }
    for (const [cx, cw] of [[7.62, 2.48], [11.38, 2.48]]) {  // south wall around the delivery door
      const wall = makeWall(cw, 2.9, 0.24, wallMatNarrow);
      wall.position.set(cx, 1.45, -14.38);
      this.add(wall);
      this.addCollider(wall);
    }
    const southLintel = makeWall(1.28, 0.64, 0.24, wallMatNarrow);
    southLintel.position.set(9.5, 2.58, -14.38);
    this.add(southLintel);

    const officeBulb = makeBulbLight({ y: 2.75, intensity: 4.5, distance: 8, color: 0xffdfb4 });
    officeBulb.position.set(9.7, 0, -12.5);
    this.add(officeBulb);
    this.track(this.add(makeDust({ count: 60, box: [5, 2.4, 4], center: [9.5, 1.3, -12.3] })));

    const desk = makeTable({ w: 1.3, d: 0.7, h: 0.76 });
    desk.position.set(7.6, 0, -13.3);
    desk.rotation.y = 0.12;
    this.add(desk);
    this.addCollider(desk);

    const chair = makeChair();
    chair.position.set(8.4, 0, -12.7);
    chair.rotation.y = -2.4;
    this.add(chair);
    this.addCollider(chair);

    // a cold cup of coffee, still waiting on the desk
    const cup = new THREE.Group();
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.033, 0.09, 12),
      new THREE.MeshStandardMaterial({ color: 0xcfc8bc, roughness: 0.4 })
    );
    mug.position.set(7.35, 0.825, -13.5);
    mug.castShadow = true;
    const coffee = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.004, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e2018, roughness: 0.25 })
    );
    coffee.position.set(7.35, 0.868, -13.5);
    cup.add(mug, coffee);
    this.add(cup);
    this.interact(cup, {
      prompt: 'touch the mug',
      onInteract: () => this.subtitle('Cold to the touch. Whoever poured it meant to come back.', 5),
    });

    const rota = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.48),
      new THREE.MeshStandardMaterial({ map: rotaTexture(), roughness: 0.85 })
    );
    rota.position.set(12.36, 1.62, -12.6);
    rota.rotation.y = -Math.PI / 2;
    this.add(rota);
    this.interact(rota, {
      prompt: 'read the rota',
      onInteract: () => this.subtitle('Every shift crossed out, week after week, in the same tired hand.', 5),
    });

    // ---------- the staff door & keypad ----------
    const officeDoor = makeDoor({ width: 1.0, color: '#777b76', frameColor: '#565a55' });
    officeDoor.position.set(9.25, 0, -D / 2 - 0.12);
    this.add(officeDoor);
    this.track(officeDoor);
    this.addCollider(officeDoor.panel);
    this._officeDoor = officeDoor;
    this._officeOpen = false;

    const staffSign = makeSign({
      text: 'STAFF ONLY', width: 0.6, height: 0.17,
      font: 'bold 44px Georgia', bg: '#9aa39b', color: '#3f463f',
    });
    staffSign.position.set(9.25, 2.62, -D / 2 + 0.02);
    this.add(staffSign);

    const keypadBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.13, 0.03),
      new THREE.MeshStandardMaterial({
        color: 0x494c4a, roughness: 0.45, metalness: 0.3,
        emissive: 0x2a4432, emissiveIntensity: 0.5,
      })
    );
    keypadBox.position.set(8.35, 1.25, -D / 2 + 0.01);
    this.add(keypadBox);

    this.interact(officeDoor, {
      prompt: 'staff only',
      onInteract: () => {
        if (this._officeOpen) return;
        this.game.ui.showKeypad({
          label: 'staff only',
          length: 4,
          onSubmit: (code) => {
            if (code === '3142') {
              this._officeOpen = true;
              this.playSound('unlock');
              officeDoor.setOpen(true, -1);
              this.removeColliderOf(officeDoor.panel);
              this.game.interaction.remove(officeDoor);
              this.playSound('door');
              this.subtitle('It opens on the first try, as if it had been waiting to.', 4.5);
              this.setObjective('through the office, out the back');
            } else {
              this.playSound('wrong');
              this.subtitle('The list knows the order.', 4.5);
            }
          },
        });
      },
    });

    // ---------- the delivery door & the dark beyond ----------
    const deliveryDoor = makeDoor({ width: 1.0, color: '#5d6058', frameColor: '#43463f' });
    deliveryDoor.position.set(9.5, 0, -14.38);
    this.add(deliveryDoor);
    this.track(deliveryDoor);
    this.addCollider(deliveryDoor.panel);
    this._deliveryDoor = deliveryDoor;
    this._deliveryOpen = false;

    this.interact(deliveryDoor, {
      prompt: 'the delivery door',
      onInteract: () => {
        if (this._deliveryOpen) return;
        this._deliveryOpen = true;
        this.playSound('door');
        deliveryDoor.setOpen(true, -1);
        this.removeColliderOf(deliveryDoor.panel);
        this.game.interaction.remove(deliveryDoor);
        this.subtitle('The night behind the store smells of rain on concrete.', 4.5);
        this.setObjective('');
      },
    });

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
    const landing = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.2), darkMat);
    landing.rotation.x = -Math.PI / 2;
    landing.position.set(9.5, 0, -16.6);
    this.add(landing);
    this.addGround(landing);
    this.addBlocker([6.3, 0, -18.9], [12.7, 3, -18.5]);
    this.addBlocker([6.3, 0, -18.9], [6.6, 3, -14.5]);
    this.addBlocker([12.4, 0, -18.9], [12.7, 3, -14.5]);

    // walking out through the open delivery door finishes the level
    this.tick(() => {
      if (this._deliveryOpen && !this.isCompleted && this.game.player.position.z < -15.6) {
        this.complete();
      }
    });

    // ---------- spawn & bounds ----------
    this.spawn.position.set(2.0, 0, 7.6);
    this.spawn.yaw = 0; // facing down the aisles (−z), lane three at hand
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-12.7, 0, -18.3),
      new THREE.Vector3(12.7, 3.2, 9.7)
    );

    this.setObjective('one lane is still lit');
    this._list = list;
    this._milk = milk;
    this._bread = bread;
    this._apples = apples;
    this._sunflowers = sunflowers;
  }

  async debugSolve() {
    // read the list at lane three
    this.debugInteract(this._list);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    // tick off the four things, aisle by aisle
    for (const item of [this._milk, this._bread, this._apples, this._sunflowers]) {
      this.debugInteract(item);
      await this.debugWait(0.25);
    }
    // the staff door: aisle numbers in list order
    this.debugInteract(this._officeDoor);
    await this.debugWait(0.4);
    this.game.ui.submitKeypad('3142');
    await this.debugWait(0.6);
    // through the office, out the back
    this.debugInteract(this._deliveryDoor);
    await this.debugWait(0.5);
    this.game.player.teleport(9.5, -16.6);
    await this.debugWait(0.6);
  }
}
