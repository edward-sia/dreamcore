import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeSign, makeTable,
  makeShelf, makeBench, makePictureFrame, makeDust, applyFog,
} from '../core/props.js';

// VIII — The Theater
// The cinema where you saw the film you can't remember. A torn stub in the
// ticket booth names row F, seat 8 — but the rows have lost most of their
// letters, so you count in the dark. Under the cushion, the relief
// projectionist's key. The posters kept the years; the stub kept only the
// tail of a title. Mount the right summer and the screen fills with silver,
// and the fire exit beside it finally lets go of its bar.

const LOBBY_W = 14, LOBBY_H = 3.2;              // lobby: z in [-1, -9]
const AUD_W = 11, AUD_H = 4.6, AUD_END = -26;   // auditorium: z in [-9, -26]
const ROWS = 'ABCDEFGH';                        // A by the screen … H at the back
const ROW_DEPTH = 1.5, ROW_DROP = 0.35;
const SEAT_W = 0.55, AISLE = 0.8;               // center aisle half-width
const BOOTH_Y = 2.45;                           // mezzanine floor height

const rowBackZ = (i) => -10.8 - (7 - i) * ROW_DEPTH;  // i: 0=A … 7=H
const rowY = (i) => -ROW_DROP * (7 - i);
const rowSeatZ = (i) => rowBackZ(i) - 0.35;
const seatX = (s) => s <= 5
  ? AISLE + (5 - s + 0.5) * SEAT_W
  : -(AISLE + (s - 6 + 0.5) * SEAT_W);

export default class Level08 extends LevelBase {
  static meta = {
    id: 8,
    numeral: 'VIII',
    title: 'The Theater',
    mood: 'theater',
    intro: 'This is the cinema where you saw the film you can’t remember seeing.',
    outro:
      'The reel runs on with nobody watching.\n' +
      'Somewhere the summer is still playing,\n' +
      'and the seat beside yours is still folded down.',
  };

  build() {
    applyFog(this.scene, '#0e0b09', 3, 38);

    this._busy = false;      // reel sequence in progress
    this._running = false;   // 1974 mounted, projector alive
    this._proj = 0;          // 0..1 projection ramp
    this._rattleT = 0;       // wrong-reel grey-leader timer
    this._reelSpeed = 0;
    this._wrongs = 0;
    this._exitOpen = false;
    this._folds = new Set();

    // ---------- materials ----------
    const lobbyWallMat = makeMat('wallpaper', { base: '#96725a', stripe: '#876450', repeat: [7, 1.6] });
    const lobbyFloorMat = makeMat('carpet', { base: '#5c3134', repeat: [7, 4] });
    const lobbyCeilMat = makeMat('ceiling', { base: '#b0a48e', repeat: [7, 4] });
    const drapeMat = makeMat('wallpaper', { base: '#472125', stripe: '#3a181c', stripeW: 20, repeat: [10, 2.2] });
    const audFloorMat = makeMat('carpet', { base: '#3f2629', repeat: [6, 1] });
    const audCeilMat = makeMat('plaster', { base: '#332a28', repeat: [5, 8] });
    const woodDark = makeMat('wood', { base: '#3a2b1d', repeat: [2, 1] });
    const fabricMat = makeMat('carpet', { base: '#57292c', repeat: [1, 1] });
    const cushionMat = makeMat('carpet', { base: '#653235', repeat: [1, 1] });

    // ---------- lobby shell ----------
    const lobbyFloor = new THREE.Mesh(new THREE.PlaneGeometry(LOBBY_W, 8.2), lobbyFloorMat);
    lobbyFloor.rotation.x = -Math.PI / 2;
    lobbyFloor.position.set(0, 0, -5);
    lobbyFloor.receiveShadow = true;
    this.add(lobbyFloor);
    this.addGround(lobbyFloor);

    const lobbyCeil = new THREE.Mesh(new THREE.PlaneGeometry(LOBBY_W, 8.2), lobbyCeilMat);
    lobbyCeil.rotation.x = Math.PI / 2;
    lobbyCeil.position.set(0, LOBBY_H, -5);
    this.add(lobbyCeil);

    // poster wall (behind the spawn), side walls
    const backWall = makeWall(LOBBY_W + 0.4, LOBBY_H + 0.3, 0.24, lobbyWallMat);
    backWall.position.set(0, LOBBY_H / 2, -0.98);
    this.add(backWall);
    this.addCollider(backWall);
    for (const side of [-1, 1]) {
      const wall = makeWall(0.24, LOBBY_H + 0.3, 8.4, lobbyWallMat);
      wall.position.set(side * (LOBBY_W / 2 + 0.1), LOBBY_H / 2, -5);
      this.add(wall);
      this.addCollider(wall);
    }

    // wall between lobby and auditorium, with the doorway to screen 1
    for (const side of [-1, 1]) {
      const seg = makeWall(5.8, 4.8, 0.24, lobbyWallMat);
      seg.position.set(side * (1.2 + 2.9), 2.4, -9);
      this.add(seg);
      this.addCollider(seg);
    }
    const lintel = makeWall(2.4, 2.6, 0.24, lobbyWallMat);
    lintel.position.set(0, 2.2 + 1.3, -9);
    this.add(lintel);

    const screenSign = makeSign({
      text: 'SCREEN 1', width: 1.1, height: 0.28,
      font: '600 44px Georgia', bg: '#3a2c22', color: '#d8c49a',
    });
    screenSign.position.set(0, 2.56, -8.86);
    this.add(screenSign);

    // drawn-back curtains just inside the doorway
    for (const side of [-1, 1]) {
      const curtain = makeWall(0.34, 2.6, 0.3, drapeMat);
      curtain.position.set(side * 1.38, 1.3, -9.3);
      this.add(curtain);
    }

    // ---------- the posters (four films, four years) ----------
    const films = [
      { lines: ['HARVEST', 'MOON'], year: '1962', top: '#77603f', bottom: '#463726', motif: 'moon',
        say: 'Harvest Moon, 1962. Before your time. Somebody else’s evening.' },
      { lines: ['THE TIN', 'ORCHARD'], year: '1968', top: '#67705e', bottom: '#3b4237', motif: 'orchard',
        say: 'The Tin Orchard, 1968. You remember the smell of the lobby, not the film.' },
      { lines: ['THE LONG', 'SUMMER'], year: '1974', top: '#b1996a', bottom: '#6f5a2e', motif: 'sun',
        say: 'You saw this one. You know you saw this one. The rest of it is gone.' },
      { lines: ['WINTER', 'SISTERS'], year: '1981', top: '#67717d', bottom: '#3a414a', motif: 'peaks',
        say: 'Winter Sisters, 1981. By then you had stopped coming.' },
    ];
    const posterX = [3.9, 1.35, -1.35, -3.9]; // chronological, read left to right
    const posterTilt = [0.02, -0.014, 0.022, -0.018];
    films.forEach((film, i) => {
      const frame = makePictureFrame({ texture: this._posterTexture(film), width: 0.64, height: 0.94 });
      frame.position.set(posterX[i], 1.72, -1.1);
      frame.rotation.y = Math.PI;
      frame.rotation.z = posterTilt[i];
      this.add(frame);
      this.interact(frame, {
        prompt: 'the poster',
        onInteract: () => {
          this.subtitle(film.say, 5);
          if (film.year === '1974' && !this._posterClue) {
            this._posterClue = true;
            this.learnClue({
              id: 'l8-poster',
              title: 'the poster you stopped at',
              body: '“The Long Summer” — 1974.\nyou saw this one. you know you saw it.\nthe rest is gone.',
            });
          }
        },
      });
    });
    const nowShowing = makeSign({
      text: 'NOW SHOWING', width: 1.7, height: 0.32,
      font: 'italic 44px Georgia', bg: '#5a4030', color: '#e0cba0',
    });
    nowShowing.position.set(0, 2.72, -1.11);
    nowShowing.rotation.y = Math.PI;
    this.add(nowShowing);

    // ---------- the ticket booth & the stub ----------
    const booth = new THREE.Group();
    const counterMat = makeMat('wood', { base: '#5c4128', repeat: [2, 1] });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.05, 0.75), counterMat);
    counter.position.y = 0.525;
    counter.castShadow = counter.receiveShadow = true;
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.85), woodDark);
    counterTop.position.y = 1.075;
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.06),
      new THREE.MeshStandardMaterial({
        color: 0xbfd0cd, transparent: true, opacity: 0.16, roughness: 0.08, metalness: 0.2,
        side: THREE.DoubleSide,
      })
    );
    glass.position.set(0, 1.68, 0.12);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.09, 0.9), woodDark);
    roof.position.y = 2.28;
    booth.add(counter, counterTop, glass, roof);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.24, 0.06), woodDark);
      post.position.set(sx * 0.86, 1.66, 0.12);
      booth.add(post);
    }
    const ticketsSign = makeSign({
      text: 'TICKETS', width: 0.9, height: 0.24,
      font: '600 46px Georgia', bg: '#6b1f22', color: '#e8d3a0',
    });
    ticketsSign.position.set(0, 2.14, 0.46);
    booth.add(ticketsSign);
    booth.position.set(-4.7, 0, -4.6);
    booth.rotation.y = 1.45;
    this.add(booth);
    this.addCollider(booth);

    const stub = makeNoteProp();
    stub.scale.set(0.55, 1, 0.5);
    stub.position.set(0.25, 1.11, 0.2);
    stub.rotation.y = 0.4;
    booth.add(stub);
    this.interact(stub, {
      prompt: 'the ticket stub',
      onInteract: () => {
        this.giveNote({
          id: 'l8-stub',
          title: 'a ticket stub, torn',
          body:
            'ADMIT ONE — EVENING\n' +
            'ROW F · SEAT 8\n\n' +
            'above the tear, the tail of a title:\n' +
            '“…g summer”',
        });
        if (!this.hasItem('booth-key') && !this._boothOpen) this.setObjective('your seat is still down there in the dark');
      },
    });
    this._stub = stub;

    // ---------- concession corner ----------
    const popcorn = new THREE.Group();
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.8, 0.58),
      new THREE.MeshStandardMaterial({ color: 0x6e2226, roughness: 0.5 })
    );
    cabinet.position.y = 0.4;
    cabinet.castShadow = true;
    const caseGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.56, 0.52),
      new THREE.MeshStandardMaterial({
        color: 0xcfd8d2, transparent: true, opacity: 0.14, roughness: 0.06,
      })
    );
    caseGlass.position.y = 1.08;
    const caseTop = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.6), woodDark);
    caseTop.position.y = 1.39;
    const kettle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.35, metalness: 0.8 })
    );
    kettle.position.y = 1.16;
    const popcornSign = makeSign({
      text: 'POP CORN', width: 0.5, height: 0.14,
      font: '600 40px Georgia', bg: '#6b1f22', color: '#e8d3a0',
    });
    popcornSign.position.set(0, 0.62, 0.3);
    popcorn.add(cabinet, caseGlass, caseTop, kettle, popcornSign);
    popcorn.position.set(5.95, 0, -4.4);
    popcorn.rotation.y = -Math.PI / 2;
    this.add(popcorn);
    this.addCollider(popcorn);
    this.interact(popcorn, {
      prompt: 'the popcorn machine',
      onInteract: () => this.subtitle('Cold glass. The smell stayed anyway. It always stays.', 4.5),
    });

    for (const bz of [-2.5, -6.3]) {
      const bench = makeBench();
      bench.position.set(6.15, 0, bz);
      bench.rotation.y = -Math.PI / 2;
      this.add(bench);
      this.addCollider(bench);
    }

    // ---------- lobby lights ----------
    const pendant = makeBulbLight({ y: 2.9, intensity: 7.5, distance: 13 });
    pendant.position.set(0, 0, -3.4);
    pendant.light.castShadow = true;
    this.add(pendant);
    const pendant2 = makeBulbLight({ y: 2.9, intensity: 6, distance: 11 });
    pendant2.position.set(0, 0, -7.5);
    this.add(pendant2);

    const posterLight = new THREE.PointLight(0xffd9a8, 6, 9, 1.5);
    posterLight.position.set(0, 2.6, -2.0);
    this.add(posterLight);

    for (const side of [-1, 1]) {
      for (const sz of [-2.6, -6.8]) {
        const sconce = new THREE.Group();
        const shade = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.05, 0.17, 10, 1, true),
          new THREE.MeshStandardMaterial({
            color: 0x3a2a1c, emissive: 0xffd9a4, emissiveIntensity: 1.1, side: THREE.DoubleSide,
          })
        );
        sconce.add(shade);
        if (sz === -6.8) {
          const pl = new THREE.PointLight(0xffd6a0, 4.2, 6.5, 1.8);
          pl.position.y = 0.14;
          sconce.add(pl);
          // the sconce by the concession stutters
          if (side === 1) {
            let tNext = 0;
            this.tick((dt, t) => {
              if (t > tNext) {
                const on = Math.random() > 0.3;
                pl.intensity = on ? 4.2 : 0.5;
                shade.material.emissiveIntensity = on ? 1.1 : 0.2;
                tNext = t + (on ? 0.2 + Math.random() * 2.2 : 0.05 + Math.random() * 0.15);
              }
            });
          }
        }
        sconce.position.set(side * 6.78, 2.3, sz);
        this.add(sconce);
      }
    }

    // ---------- auditorium shell ----------
    // raked floor: a landing at lobby level, then eight stepped platforms
    const landing = new THREE.Mesh(new THREE.BoxGeometry(AUD_W, 2.9, 1.8), audFloorMat);
    landing.position.set(0, -1.45, -9.9);
    landing.receiveShadow = true;
    this.add(landing);
    this.addGround(landing);

    for (let i = 7; i >= 0; i--) {
      const depth = i === 0 ? (rowBackZ(0) - AUD_END) : ROW_DEPTH;
      const h = rowY(i) + 2.9;
      const plat = new THREE.Mesh(new THREE.BoxGeometry(AUD_W, h, depth), audFloorMat);
      plat.position.set(0, (rowY(i) - 2.9) / 2, rowBackZ(i) - depth / 2);
      plat.receiveShadow = true;
      this.add(plat);
      this.addGround(plat);
    }

    for (const side of [-1, 1]) {
      const wall = makeWall(0.24, 7.5, 17.2, drapeMat);
      wall.position.set(side * (AUD_W / 2 + 0.12), 0.85, -17.5);
      this.add(wall);
      this.addCollider(wall);
    }
    const audCeil = new THREE.Mesh(new THREE.PlaneGeometry(AUD_W, 17), audCeilMat);
    audCeil.rotation.x = Math.PI / 2;
    audCeil.position.set(0, AUD_H, -17.5);
    this.add(audCeil);

    // ---------- the screen ----------
    const frontMat = makeMat('plaster', { base: '#241d1c', repeat: [5, 3] });
    for (const [x0, x1] of [[-5.62, 4.3], [5.3, 5.62]]) {
      const seg = makeWall(x1 - x0, 7.5, 0.24, frontMat);
      seg.position.set((x0 + x1) / 2, 0.85, AUD_END);
      this.add(seg);
      this.addCollider(seg);
    }
    const doorLintel = makeWall(1.0, 4.95, 0.24, frontMat);
    doorLintel.position.set(4.8, -0.35 + 2.475, AUD_END);
    this.add(doorLintel);

    const masking = new THREE.Mesh(
      new THREE.PlaneGeometry(8.3, 5.9),
      new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: 1 })
    );
    masking.position.set(0, 1.05, -25.88);
    this.add(masking);

    this._screenMat = new THREE.MeshStandardMaterial({
      color: '#b9b7ae', emissive: '#dad8cd', emissiveIntensity: 0.28, roughness: 0.95,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 5.5), this._screenMat);
    screen.position.set(0, 1.2, -25.85);
    this.add(screen);

    for (const side of [-1, 1]) {
      const drape = makeWall(0.36, 6.6, 0.3, drapeMat);
      drape.position.set(side * 4.32, 0.55, -25.8);
      this.add(drape);
    }

    // faint spill so the room reads even before the reel takes
    const spill = new THREE.PointLight(0xc9ced2, 4.5, 16, 1.7);
    spill.position.set(0, 1.0, -24.5);
    this.add(spill);

    // dying house lights, just enough for the rows to be shapes
    for (const hz of [-13, -17.5, -22]) {
      const house = new THREE.PointLight(0x9a8064, 2.4, 9, 1.7);
      house.position.set(0, 4.15, hz);
      this.add(house);
    }

    // ---------- the fire exit, and the light behind it ----------
    const fireDoor = makeDoor({ width: 1.0, height: 2.1, color: '#3d4a3f', frameColor: '#2c342d' });
    fireDoor.position.set(4.8, -2.45, -25.95);
    this.add(fireDoor);
    this.track(fireDoor);
    this.addCollider(fireDoor.panel);
    this._fireDoor = fireDoor;
    this.interact(fireDoor, {
      prompt: 'the fire exit',
      onInteract: () => {
        if (this._exitOpen) return;
        this.playSound('locked');
        this.subtitle('Locked. The bar doesn’t move. The film hasn’t ended.', 4.5);
      },
    });

    const exitSign = makeSign({
      text: 'FIRE EXIT', width: 0.7, height: 0.22,
      font: '600 40px Georgia', bg: '#12301c', color: '#b9f4cd',
    });
    exitSign.material.emissive = new THREE.Color('#6fd18c');
    exitSign.material.emissiveMap = exitSign.material.map;
    exitSign.material.emissiveIntensity = 0.7;
    exitSign.position.set(4.8, -0.06, -25.85);
    this.add(exitSign);
    const exitGlow = new THREE.PointLight(0x8fe6a8, 1.5, 3.5, 1.8);
    exitGlow.position.set(4.8, -0.4, -25.4);
    this.add(exitGlow);

    // the white pocket beyond — walking into light, not darkness
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xefece4, emissive: 0xfff6e6, emissiveIntensity: 0.5, roughness: 0.9,
    });
    const pocketFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.9), whiteMat);
    pocketFloor.rotation.x = -Math.PI / 2;
    pocketFloor.position.set(4.9, -2.44, -27.95);
    this.add(pocketFloor);
    this.addGround(pocketFloor);
    const pocketCeil = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.9), whiteMat);
    pocketCeil.rotation.x = Math.PI / 2;
    pocketCeil.position.set(4.9, 0.9, -27.95);
    this.add(pocketCeil);
    for (const [w, h, d, x, y, z] of [
      [0.2, 3.4, 4.0, 3.5, -0.75, -28],
      [0.2, 3.4, 4.0, 6.3, -0.75, -28],
      [3.2, 3.4, 0.2, 4.9, -0.75, -29.9],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), whiteMat);
      wall.position.set(x, y, z);
      this.add(wall);
      this.addCollider(wall);
    }
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.9),
      new THREE.MeshStandardMaterial({
        color: 0xfffdf6, emissive: 0xfffdf4, emissiveIntensity: 1.7, fog: false,
      })
    );
    glow.position.set(4.9, -0.95, -29.78);
    this.add(glow);
    for (const [y, z, it] of [[-0.7, -27.3, 9], [-1.0, -29.1, 7]]) {
      const pl = new THREE.PointLight(0xfff8ec, it, 7, 1.8);
      pl.position.set(4.9, y, z);
      this.add(pl);
    }

    // ---------- the seats ----------
    this._buildSeats(fabricMat, cushionMat, woodDark);

    // aisle footlights, low along the center aisle
    const markMat = new THREE.MeshStandardMaterial({
      color: 0x332015, emissive: 0xffb677, emissiveIntensity: 1.35,
    });
    for (let i = 6; i >= 0; i--) {
      const edgeZ = rowBackZ(i);
      for (const side of [-1, 1]) {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), markMat);
        marker.position.set(side * 0.72, rowY(i) + 0.055, edgeZ - 0.07);
        this.add(marker);
      }
      if (i % 2 === 0) {
        const fl = new THREE.PointLight(0xffc27a, 1.7, 3.0, 1.8);
        fl.position.set((i % 4 === 0 ? 1 : -1) * 0.72, rowY(i) + 0.16, edgeZ - 0.1);
        this.add(fl);
      }
    }

    // ---------- the projection booth (mezzanine at the back) ----------
    this._buildBooth(woodDark, drapeMat);

    // ---------- air & ambient ----------
    this._hemi = new THREE.HemisphereLight(0x5a4c42, 0x14100e, 0.65);
    this.add(this._hemi);
    this.track(this.add(makeDust({ count: 240, box: [9.5, 4.2, 15.5], center: [0, 0.7, -17.6] })));
    this.track(this.add(makeDust({ count: 110, box: [12.5, 2.7, 7.4], center: [0, 1.5, -5] })));

    // ---------- living parts ----------
    // seat cushions folding down, and staying down
    this.tick((dt) => {
      for (const pivot of this._folds) {
        pivot.rotation.x += (pivot.userData.target - pivot.rotation.x) * Math.min(1, 6 * dt);
        if (Math.abs(pivot.rotation.x - pivot.userData.target) < 0.01) this._folds.delete(pivot);
      }
    });

    // the projector, the screen, the warmth
    this.tick((dt, t) => {
      if (this._reelSpeed > 0 && this._reelA) {
        this._reelA.rotation.y += dt * this._reelSpeed;
        this._reelB.rotation.y -= dt * this._reelSpeed * 0.8;
      }
      if (this._rattleT > 0) {
        this._rattleT -= dt;
        this._screenMat.emissiveIntensity = 0.3 + Math.random() * 0.32;
        if (this._rattleT <= 0) this._screenMat.emissiveIntensity = 0.28;
      }
      if (this._running) {
        this._proj = Math.min(1, this._proj + dt / 2.4);
        const p = this._proj;
        const flick = 1 + (Math.sin(t * 46) + Math.sin(t * 29.3)) * 0.022 * p;
        this._screenMat.emissiveIntensity = (0.28 + 1.45 * p) * flick;
        this._beamMat.opacity = 0.095 * p;
        this._washLight.intensity = 8 * p;
        this._lensLight.intensity = 3.2 * p;
        this._lensMat.emissiveIntensity = 2.5 * p;
        this._hemi.intensity = 0.65 + 0.3 * p;
        this._reelSpeed = 1 + 5 * p;
      }
    });

    // walking into the light behind the fire exit finishes the level
    this.tick(() => {
      const p = this.game.player.position;
      if (this._exitOpen && !this.isCompleted && p.z < -27.4 && p.x > 3.4) {
        this.complete();
      }
    });

    // ---------- spawn & bounds ----------
    this.spawn.position.set(0, 0, -5.2);
    this.spawn.yaw = 0; // facing the doors to screen 1
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-6.75, -5, -29.6),
      new THREE.Vector3(6.75, 8, -1.25)
    );

    this.setObjective('the ticket booth kept something of yours');
  }

  // ---------- seats: eight rows, ten seats, most of the letters gone ----------

  _buildSeats(fabricMat, cushionMat, woodDark) {
    const backGeo = new THREE.BoxGeometry(0.5, 0.62, 0.1);
    const backs = new THREE.InstancedMesh(backGeo, fabricMat, 80);
    backs.castShadow = backs.receiveShadow = true;
    const armGeo = new THREE.BoxGeometry(0.09, 0.62, 0.5);
    const arms = new THREE.InstancedMesh(armGeo, woodDark, 96);
    arms.castShadow = arms.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    let bi = 0, ai = 0;

    const seatLines = [
      'The seat folds down, and stays down, as if someone is sitting there.',
      'A spring sighs. Dust rises, and hangs, and does not settle.',
      'The velvet is worn through to the weave. Somebody loved this one.',
      'It folds down without a sound. Nobody takes it.',
    ];
    let lineIdx = 0;

    const stripRight = this._numberStrip(['1', '2', '3', '4', '5']);
    const stripLeft = this._numberStrip(['6', '7', '8', '9', '10']);
    const legible = { 0: 'A', 2: 'C', 4: 'E', 7: 'H' };

    for (let i = 0; i < 8; i++) {
      const y = rowY(i), z = rowSeatZ(i);

      for (let s = 1; s <= 10; s++) {
        const x = seatX(s);
        m4.makeTranslation(x, y + 0.72, z + 0.14);
        backs.setMatrixAt(bi++, m4);

        // the cushion, folded up, on its own hinge
        const pivot = new THREE.Group();
        pivot.position.set(x, y + 0.42, z - 0.02);
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.11), cushionMat);
        cushion.position.set(0, 0.2, 0);
        cushion.castShadow = true;
        pivot.add(cushion);
        this.add(pivot);

        const isTheSeat = (ROWS[i] === 'F' && s === 8);
        this.interact(pivot, {
          prompt: 'the seat',
          once: true,
          onInteract: () => {
            this._foldSeat(pivot);
            if (isTheSeat) {
              this.giveItem({ id: 'booth-key', name: 'a key tagged “relief projectionist”' });
              this.subtitle('Taped under the cushion: a small key. The tag reads, relief projectionist.', 5.5);
              this.setObjective('the booth above the back row');
            } else {
              this.playSound('switch');
              this.subtitle(seatLines[lineIdx++ % seatLines.length], 4);
            }
          },
        });
        if (isTheSeat) this._seatF8 = pivot;
      }

      // armrests at every seat boundary
      for (const side of [-1, 1]) {
        for (let k = 0; k <= 5; k++) {
          m4.makeTranslation(side * (AISLE + k * SEAT_W), y + 0.31, z + 0.02);
          arms.setMatrixAt(ai++, m4);
        }
      }

      // worn seat numbers along the top rails, readable only up close
      for (const [cx, tex] of [[2.175, stripRight], [-2.175, stripLeft]]) {
        const strip = new THREE.Mesh(
          new THREE.PlaneGeometry(2.75, 0.13),
          new THREE.MeshStandardMaterial({
            map: tex, roughness: 0.9,
            emissive: 0xfff2d8, emissiveMap: tex, emissiveIntensity: 0.24,
          })
        );
        strip.position.set(cx, y + 0.955, z + 0.082);
        strip.rotation.y = Math.PI;
        this.add(strip);
      }

      // row-end letter plates on the aisle armrests — most worn blank
      const plateTex = this._rowPlate(legible[i] ?? null);
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(0.13, 0.1),
          new THREE.MeshStandardMaterial({
            map: plateTex, roughness: 0.55, metalness: 0.3,
            emissive: 0xffe9c0, emissiveMap: plateTex, emissiveIntensity: 0.55,
          })
        );
        plate.position.set(side * 0.748, y + 0.5, z + 0.02);
        plate.rotation.y = -side * Math.PI / 2;
        this.add(plate);
      }

      // one long collider per seat block
      this.addBlocker([0.76, y, z - 0.28], [3.6, y + 0.95, z + 0.3]);
      this.addBlocker([-3.6, y, z - 0.28], [-0.76, y + 0.95, z + 0.3]);
    }

    backs.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
    this.add(backs);
    this.add(arms);
  }

  _foldSeat(pivot) {
    pivot.userData.target = -1.42;
    this._folds.add(pivot);
  }

  // ---------- the booth: stair, door, projector, canisters ----------

  _buildBooth(woodDark, drapeMat) {
    const boothWallMat = makeMat('plaster', { base: '#6d6154', repeat: [3, 1.5] });

    // mezzanine slab over the entry, parapet with the projection slot
    const mezz = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 2.4), woodDark);
    mezz.position.set(0, BOOTH_Y - 0.125, -10.2);
    mezz.receiveShadow = true;
    this.add(mezz);
    this.addGround(mezz);

    const parapet = new THREE.Mesh(new THREE.BoxGeometry(6, 0.75, 0.15), boothWallMat);
    parapet.position.set(0, BOOTH_Y + 0.375, -11.4);
    this.add(parapet);
    this.addCollider(parapet);
    const header = new THREE.Mesh(new THREE.BoxGeometry(6, 0.7, 0.15), boothWallMat);
    header.position.set(0, 4.25, -11.4);
    this.add(header);

    // lamplight leaking from the projection slot onto the booth's face
    const slotLeak = new THREE.PointLight(0xffe2b8, 1.6, 4, 1.8);
    slotLeak.position.set(0, 3.5, -11.8);
    this.add(slotLeak);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.15, 2.4), boothWallMat);
    westWall.position.set(-3, BOOTH_Y + 1.075, -10.2);
    this.add(westWall);
    this.addCollider(westWall);
    const eastSeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.15, 1.4), boothWallMat);
    eastSeg.position.set(3, BOOTH_Y + 1.075, -10.7);
    this.add(eastSeg);
    this.addCollider(eastSeg);
    const eastLintel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.8), boothWallMat);
    eastLintel.position.set(3, BOOTH_Y + 2.05, -9.6);
    this.add(eastLintel);

    // the stair up, boxed in behind a tall panel — treads wider than the
    // player's radius so every next step's ground is unambiguous
    const rise = BOOTH_Y / 5;
    for (let k = 1; k <= 5; k++) {
      const top = k * rise;
      const x0 = k === 5 ? 3.0 : 3.6 + (4 - k) * 0.45;
      const x1 = k === 5 ? 3.6 : x0 + 0.45;
      const step = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, top, 0.925), woodDark);
      step.position.set((x0 + x1) / 2, top / 2, -9.5875);
      step.castShadow = step.receiveShadow = true;
      this.add(step);
      this.addCollider(step, { alsoGround: true });
    }
    const stairPanel = new THREE.Mesh(new THREE.BoxGeometry(1.75, 3.4, 0.1), drapeMat);
    stairPanel.position.set(3.875, 1.7, -10.1);
    this.add(stairPanel);
    this.addCollider(stairPanel);

    // a bare bulb over the stair's foot, so the way up can be found
    const stairBulb = makeBulbLight({ y: 2.65, intensity: 3.2, distance: 5.5 });
    stairBulb.position.set(5.05, 0, -10.6);
    this.add(stairBulb);

    // the booth door — locked until the relief projectionist's key
    const boothDoor = makeDoor({ width: 0.85, height: 1.95, color: '#5a4632', frameColor: '#41332a' });
    boothDoor.position.set(3, BOOTH_Y, -9.6);
    boothDoor.rotation.y = Math.PI / 2;
    this.add(boothDoor);
    this.track(boothDoor);
    this.addCollider(boothDoor.panel);
    const stencil = makeSign({
      text: 'PROJECTION', width: 0.5, height: 0.12,
      font: '600 36px Georgia', bg: '#4d3c2c', color: '#2a2018',
    });
    stencil.position.set(0, 0.42, 0.032);
    boothDoor.panel.add(stencil);
    this._boothDoor = boothDoor;
    this._boothOpen = false;
    this.interact(boothDoor, {
      prompt: 'the projection booth',
      onInteract: () => {
        if (this._boothOpen) return;
        if (this.hasItem('booth-key')) {
          this.playSound('unlock');
          this.removeItem('booth-key');
          boothDoor.setOpen(true, 1);
          this.removeColliderOf(boothDoor.panel);
          this._boothOpen = true;
          this.game.interaction.remove(boothDoor);
          this.playSound('door');
          this.subtitle('The relief projectionist never came. You let yourself in.', 4.5);
          this.setObjective('the reels only remember years');
        } else {
          this.playSound('locked');
          this.subtitle('Locked. PROJECTION, stencilled at eye height. Someone kept the key.', 4.5);
        }
      },
    });

    // the work lamp
    const lampTable = makeTable({ w: 0.5, d: 0.5, h: 0.85 });
    lampTable.position.set(1.9, BOOTH_Y, -10.4);
    this.add(lampTable);
    this.addCollider(lampTable);
    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.12, 0.14, 10, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x2e3a2c, emissive: 0xffd9a0, emissiveIntensity: 1.4, side: THREE.DoubleSide,
      })
    );
    lampShade.position.set(1.9, BOOTH_Y + 1.02, -10.4);
    this.add(lampShade);
    const lampLight = new THREE.PointLight(0xffd9a0, 4.5, 5.5, 1.8);
    lampLight.position.set(1.9, BOOTH_Y + 0.95, -10.4);
    this.add(lampLight);

    // the projector
    const projTable = makeTable({ w: 0.95, d: 0.62, h: 0.8 });
    projTable.position.set(0, BOOTH_Y, -10.55);
    this.add(projTable);
    this.addCollider(projTable);

    const metal = new THREE.MeshStandardMaterial({ color: 0x4c4a46, roughness: 0.4, metalness: 0.8 });
    const proj = new THREE.Group();
    const projBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.6), metal);
    projBase.position.y = 0.07;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.56), metal);
    body.position.y = 0.31;
    body.castShadow = true;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12), metal);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.33, -0.42);
    this._lensMat = new THREE.MeshStandardMaterial({
      color: 0x1a1917, emissive: 0xfff4da, emissiveIntensity: 0,
    });
    const lensFace = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), this._lensMat);
    lensFace.rotation.x = Math.PI / 2;
    lensFace.position.set(0, 0.33, -0.575);
    const pilot = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.025, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x220808, emissive: 0xff3b2a, emissiveIntensity: 1.6 })
    );
    pilot.position.set(0.18, 0.38, -0.1);
    proj.add(projBase, body, lens, lensFace, pilot);

    for (const rz of [-0.18, 0.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), metal);
      post.position.set(0, 0.62, rz);
      proj.add(post);
      const reelGroup = new THREE.Group();
      reelGroup.position.set(0, 0.78, rz);
      reelGroup.rotation.z = Math.PI / 2;
      const inner = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), metal);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.016, 8, 22), metal);
      rim.rotation.x = Math.PI / 2;
      inner.add(hub, rim);
      for (let sp = 0; sp < 3; sp++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.014, 0.026), metal);
        spoke.rotation.y = sp * Math.PI / 3;
        inner.add(spoke);
      }
      reelGroup.add(inner);
      proj.add(reelGroup);
      if (rz < 0) this._reelA = inner; else this._reelB = inner;
    }
    proj.position.set(0, BOOTH_Y + 0.82, -10.55);
    this.add(proj);
    this.interact(proj, {
      prompt: 'the projector',
      onInteract: () => {
        if (this._running) return;
        this.subtitle('Threaded, oiled, patient. It only wants a reel.', 4);
      },
    });
    this._projGroup = proj;

    // the lamp inside the lens, and the beam it will throw
    this._lensLight = new THREE.PointLight(0xfff2dc, 0, 6, 1.8);
    this._lensLight.position.set(0, BOOTH_Y + 1.15, -11.3);
    this.add(this._lensLight);

    const from = new THREE.Vector3(0, 3.6, -11.15);
    const to = new THREE.Vector3(0, 1.2, -25.85);
    const dir = to.clone().sub(from);
    const len = dir.length();
    this._beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff7e2, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 0.08, len, 16, 1, true), this._beamMat);
    beam.position.copy(from).add(to).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    beam.visible = false;
    this.add(beam);
    this._beam = beam;

    // the wash the screen throws back when it is full
    this._washLight = new THREE.PointLight(0xfff3dc, 0, 17, 1.7);
    this._washLight.position.set(0, 1.1, -24.2);
    this.add(this._washLight);

    // the shelf of canisters, labelled by year only
    const shelf = makeShelf({ w: 1.7, h: 1.35, d: 0.34, shelves: 2 });
    shelf.position.set(-1.6, BOOTH_Y, -9.33);
    shelf.rotation.y = Math.PI; // open side toward the room
    this.add(shelf);
    this.addCollider(shelf);
    const shelfTube = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.03, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x33291c, emissive: 0xffe0ae, emissiveIntensity: 1.4 })
    );
    shelfTube.position.set(-1.6, BOOTH_Y + 1.42, -9.55);
    this.add(shelfTube);
    const shelfLight = new THREE.PointLight(0xffd9a0, 2.6, 3.6, 1.8);
    shelfLight.position.set(-1.6, BOOTH_Y + 1.35, -9.8);
    this.add(shelfLight);

    const canMat = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.35, metalness: 0.85 });
    const years = ['1962', '1968', '1974', '1981'];
    this._canisters = [];
    years.forEach((year, i) => {
      const can = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 20), canMat);
      disc.rotation.x = Math.PI / 2;
      disc.castShadow = true;
      const tagTex = textTexture({
        text: year, width: 128, height: 80,
        font: '600 44px Georgia', bg: '#c9bfa4', color: '#2e2618',
      });
      const tag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.17, 0.1),
        new THREE.MeshStandardMaterial({
          map: tagTex, roughness: 0.8,
          emissive: 0xfff2d8, emissiveMap: tagTex, emissiveIntensity: 0.2,
        })
      );
      tag.position.z = -0.032;
      tag.rotation.y = Math.PI;
      can.add(disc, tag);
      can.position.set(-2.2 + i * 0.4, BOOTH_Y + 0.9, -9.31);
      this.add(can);
      this._canisters.push(can);
      if (year === '1974') this._can1974 = can;
      this.interact(can, {
        prompt: `the canister marked ${year}`,
        onInteract: () => {
          if (this._busy || this._running) return;
          if (year === '1974') this._startProjector(can);
          else this._rattle();
        },
      });
    });
  }

  // ---------- reels ----------

  _rattle() {
    this._busy = true;
    this._reelSpeed = 10;
    this._rattleT = 1.3;
    this.playSound('switch');
    this.subtitle('Grey leader rattles through the gate.', 2.2);
    this.after(1.3, () => {
      this._reelSpeed = 0;
      this._busy = false;
      this.playSound('wrong');
      this.subtitle('That wasn’t the summer.', 4);
      this._wrongs++;
      if (this._wrongs === 2) {
        this.after(4.2, () => {
          if (!this._running) {
            this.subtitle('The stub kept the end of the title. The posters kept the years.', 5);
          }
        });
      }
    });
  }

  _startProjector(can) {
    this._running = true;
    this._busy = true;
    can.visible = false; // carried to the projector
    for (const c of this._canisters) this.game.interaction.setEnabled(c, false);
    this.game.interaction.remove(this._projGroup);
    this._beam.visible = true;
    this.playSound('switch');
    this.playSound('tone', { freq: 34, gain: 0.4, decay: 2.2 });
    this.subtitle('The projector clatters to life. The reel takes.', 3.5);
    this.after(1.1, () => {
      this.playSound('unlock');
      this._exitOpen = true;
      this._fireDoor.setOpen(true, 1);
      this.removeColliderOf(this._fireDoor.panel);
      this.game.interaction.remove(this._fireDoor);
      this.setObjective('walk into the light');
      this.after(1.4, () => {
        this.subtitle('Beside the screen, a bar gives way. The fire exit stands open on white.', 5);
      });
    });
  }

  // ---------- canvas art ----------

  _posterTexture({ lines, year, top, bottom, motif }) {
    const c = document.createElement('canvas');
    c.width = 340; c.height = 500;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 500);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 340, 500);

    if (motif === 'sun') {
      ctx.fillStyle = 'rgba(242,226,188,0.5)';
      ctx.beginPath(); ctx.arc(170, 330, 62, 0, Math.PI * 2); ctx.fill();
    } else if (motif === 'moon') {
      ctx.fillStyle = 'rgba(232,232,220,0.42)';
      ctx.beginPath(); ctx.arc(238, 120, 30, 0, Math.PI * 2); ctx.fill();
    } else if (motif === 'orchard') {
      ctx.strokeStyle = 'rgba(30,32,26,0.4)';
      ctx.lineWidth = 5;
      for (let x = 40; x < 340; x += 44) {
        ctx.beginPath(); ctx.moveTo(x, 480); ctx.lineTo(x + 8, 250); ctx.stroke();
      }
    } else if (motif === 'peaks') {
      ctx.fillStyle = 'rgba(226,230,235,0.30)';
      ctx.beginPath(); ctx.moveTo(30, 460); ctx.lineTo(150, 260); ctx.lineTo(250, 460); ctx.fill();
      ctx.beginPath(); ctx.moveTo(140, 460); ctx.lineTo(250, 290); ctx.lineTo(330, 460); ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(28,22,16,0.82)';
    ctx.font = '600 44px Georgia';
    lines.forEach((line, i) => ctx.fillText(line, 170, 84 + i * 52));
    ctx.font = 'italic 30px Georgia';
    ctx.fillStyle = 'rgba(244,236,218,0.8)';
    ctx.fillText(year, 170, 462);
    ctx.strokeStyle = 'rgba(40,30,20,0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(9, 9, 322, 482);

    // age
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,250,240' : '20,16,10'},${0.03 + Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * 340, Math.random() * 500, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _numberStrip(labels) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#42282a';
    ctx.fillRect(0, 0, 1024, 64);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labels.forEach((label, i) => {
      const alpha = 0.3 + ((i * 7) % 4) * 0.05;
      ctx.font = '30px Georgia';
      ctx.fillStyle = `rgba(206,176,122,${alpha})`;
      ctx.fillText(label, ((i + 0.5) / labels.length) * 1024, 33);
    });
    // wear
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(30,18,16,${0.05 + Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 64, 20 + Math.random() * 80, 3 + Math.random() * 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _rowPlate(letter) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#43331f';
    ctx.fillRect(0, 0, 128, 96);
    ctx.strokeStyle = 'rgba(20,14,8,0.6)';
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, 122, 90);
    if (letter) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 56px Georgia';
      ctx.fillStyle = 'rgba(219,188,126,0.82)';
      ctx.fillText(letter, 64, 52);
    } else {
      // worn blank — a smudge where a letter was
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(190,164,118,0.07)';
        ctx.beginPath();
        ctx.ellipse(50 + Math.random() * 30, 40 + Math.random() * 20, 16 + Math.random() * 12, 12, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 96, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---------- automated playtest ----------

  async debugSolve() {
    // the stub in the ticket booth
    this.debugInteract(this._stub);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    // row F, seat 8 — the cushion gives up the key
    this.debugInteract(this._seatF8);
    await this.debugWait(0.3);
    // up the back stair, through the booth door
    this.game.player.teleport(3.3, -9.6, Math.PI / 2, BOOTH_Y);
    this.debugInteract(this._boothDoor);
    await this.debugWait(0.4);
    this.game.player.teleport(1.2, -9.9, Math.PI / 2, BOOTH_Y);
    // mount the summer
    this.debugInteract(this._can1974);
    await this.debugWait(1.5);
    // walk into the light
    this.game.player.teleport(4.9, -28.2, 0, -2.45);
    await this.debugWait(0.8);
  }
}
