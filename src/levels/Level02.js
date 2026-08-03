import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeValve,
  makeWater, makeDust, makeBench, applyFog,
} from '../core/props.js';

// II — The Pool
// The pool under the house. The far door is chained behind a three-digit
// padlock; the depth markers say 1 and 2, and the deep end keeps its number
// underwater until the filter-room valve lets the water go. Shallow to
// deep: 124.

const HALL_W = 14;        // x: -7 .. 7
const HALL_H = 4.4;
const END_Z = -20;        // far wall; hall runs z=2 (back) to z=-20
const POOL_HW = 3.4;      // basin half-width; basin x: -3.4 .. 3.4
const POOL_Z0 = -3;       // shallow rim
const POOL_Z1 = -15;      // deep rim
const BASIN_Y = -1.85;    // basin floor
const WATER_HIGH = -0.35; // waterline before the valve
const WATER_LOW = -1.58;  // waterline after — a skin of water always remains
const DRAIN_SECS = 4.2;

export default class Level02 extends LevelBase {
  static meta = {
    id: 2,
    numeral: 'II',
    title: 'The Pool',
    mood: 'pool',
    intro: 'This is the pool under the house. Nobody swims here anymore, but the water waits anyway.',
    outro:
      'The water left the way summers did: all at once, and for good.\n' +
      'One, two, four — even the depths skipped a year.\n' +
      'She never missed a Sunday. You never once looked up.',
  };

  build() {
    applyFog(this.scene, '#0d1412', 2.5, 26);

    // ---------- materials ----------
    const deckNS = makeMat('tile', { tile: '#6e9b94', grout: '#c9cdbd', repeat: [8.75, 3.1] });
    const deckWE = makeMat('tile', { tile: '#6e9b94', grout: '#c9cdbd', repeat: [2.25, 7.5] });
    const basinFloorMat = makeMat('tile', { tile: '#8fc0bc', grout: '#d9dfd0', repeat: [4.25, 7.5] });
    const basinNS = makeMat('tile', { tile: '#8fc0bc', grout: '#d9dfd0', repeat: [4.25, 1.15] });
    const basinWE = makeMat('tile', { tile: '#8fc0bc', grout: '#d9dfd0', repeat: [7.75, 1.15] });
    const wallLong = makeMat('tile', { tile: '#587f7a', grout: '#b9c2b2', repeat: [14, 1.4] });
    const wallShort = makeMat('tile', { tile: '#587f7a', grout: '#b9c2b2', repeat: [9, 1.4] });
    const upperLong = makeMat('plaster', { base: '#75857b', repeat: [11, 1.1] });
    const upperShort = makeMat('plaster', { base: '#75857b', repeat: [7, 1.1] });
    const ceilMat = makeMat('plaster', { base: '#59675d', repeat: [7, 11] });
    const concMat = makeMat('concrete', { base: '#707870', repeat: [2, 1.5] });
    const concFloorMat = makeMat('concrete', { base: '#646c64', repeat: [2, 1.8] });
    const darkTile = makeMat('tile', { tile: '#1d2b26', grout: '#27352f', variation: 8, repeat: [1.5, 2.4] });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xaebcb8, roughness: 0.28, metalness: 0.9 });
    const copingMat = new THREE.MeshStandardMaterial({ color: 0xcfd3c2, roughness: 0.55 });
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x181a19, roughness: 0.9 });

    // ---------- decks (the walkable ring around the basin) ----------
    const deck = (mat, w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0, z);
      m.receiveShadow = true;
      this.add(m);
      this.addGround(m);
      return m;
    };
    deck(deckNS, HALL_W, 5, 0, -0.5);                  // shallow-end deck (spawn)
    deck(deckNS, HALL_W, 5, 0, -17.5);                 // deep-end deck
    deck(deckWE, 3.6, 12, -(POOL_HW + 1.8), -9);       // west deck
    deck(deckWE, 3.6, 12, POOL_HW + 1.8, -9);          // east deck

    // ---------- the basin ----------
    const basinFloor = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 12), basinFloorMat);
    basinFloor.rotation.x = -Math.PI / 2;
    basinFloor.position.set(0, BASIN_Y, -9);
    basinFloor.receiveShadow = true;
    this.add(basinFloor);

    const basinWall = (mat, w, d, x, z) => {
      const m = makeWall(w, -BASIN_Y, d, mat);
      m.position.set(x, BASIN_Y / 2, z);
      this.add(m);
      return m;
    };
    basinWall(basinNS, 6.8, 0.2, 0, POOL_Z0 + 0.1);    // under the shallow rim
    basinWall(basinNS, 6.8, 0.2, 0, POOL_Z1 - 0.1);    // under the deep rim
    basinWall(basinWE, 0.2, 12.4, -POOL_HW - 0.1, -9);
    basinWall(basinWE, 0.2, 12.4, POOL_HW + 0.1, -9);

    // pale coping stones around the rim
    for (const [w, d, x, z] of [
      [7.3, 0.16, 0, POOL_Z0 + 0.07], [7.3, 0.16, 0, POOL_Z1 - 0.07],
      [0.16, 12.3, -POOL_HW - 0.07, -9], [0.16, 12.3, POOL_HW + 0.07, -9],
    ]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), copingMat);
      c.position.set(x, 0.03, z);
      c.receiveShadow = true;
      this.add(c);
    }

    // the old waterline, stained into the tiles
    const stainMat = new THREE.MeshStandardMaterial({
      color: 0x14201c, transparent: true, opacity: 0.45, roughness: 1,
    });
    for (const [w, x, z, ry] of [
      [6.75, 0, POOL_Z0 - 0.008, Math.PI], [6.75, 0, POOL_Z1 + 0.008, 0],
      [11.95, -POOL_HW + 0.008, -9, Math.PI / 2], [11.95, POOL_HW - 0.008, -9, -Math.PI / 2],
    ]) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.09), stainMat);
      band.position.set(x, WATER_HIGH - 0.03, z);
      band.rotation.y = ry;
      this.add(band);
    }

    // depth markers — 1 and 2 above the water; 4 is down where the water is
    const markerMat = (text, px) => new THREE.MeshStandardMaterial({
      map: textTexture({
        text, width: px, height: px,
        font: `bold ${Math.round(px * 0.7)}px Georgia`,
        color: '#2a4a44', bg: '#dce1d1',
      }),
      roughness: 0.4,
    });
    const mk1 = markerMat('1', 128);
    const mk2 = markerMat('2', 128);
    const mk4 = markerMat('4', 128);
    const marker = (mat, size, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      this.add(m);
      return m;
    };
    for (const side of [-1, 1]) {
      const x = side * (POOL_HW - 0.012);
      const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      marker(mk1, 0.3, x, -0.17, -4.2, ry);
      marker(mk2, 0.3, x, -0.17, -9, ry);
      marker(mk4, 0.44, x, -0.95, -13.8, ry);          // drowned until the valve turns
    }
    marker(markerMat('4', 256), 0.66, 0, -1.0, POOL_Z1 + 0.012, 0); // the deep end itself

    // a tile missing from the deep end, and the drain that took the water
    const gap = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x101b17, roughness: 1 })
    );
    gap.rotation.x = -Math.PI / 2;
    gap.position.set(1.1, BASIN_Y + 0.006, -13.6);
    this.add(gap);
    const drain = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 20),
      new THREE.MeshStandardMaterial({ color: 0x0d1613, roughness: 0.9 })
    );
    drain.rotation.x = -Math.PI / 2;
    drain.position.set(0, BASIN_Y + 0.007, -14.2);
    this.add(drain);
    const drainRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.02, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x39443e, roughness: 0.5, metalness: 0.6 })
    );
    drainRim.rotation.x = -Math.PI / 2;
    drainRim.position.set(0, BASIN_Y + 0.02, -14.2);
    this.add(drainRim);

    // underwater lamps at the deep end — the pool keeps its own light on
    for (const lx of [-1.9, 1.9]) {
      const lamp = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 20),
        new THREE.MeshStandardMaterial({
          color: 0x1a1f1d, emissive: 0xbdf4e4, emissiveIntensity: 1.8,
        })
      );
      lamp.position.set(lx, -1.32, POOL_Z1 + 0.014);
      this.add(lamp);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 22), chrome);
      ring.position.set(lx, -1.32, POOL_Z1 + 0.02);
      this.add(ring);
    }
    const poolGlow = new THREE.PointLight(0x66d8c4, 5, 8, 1.8);
    poolGlow.position.set(0, -1.05, -13.4);
    this.add(poolGlow);

    // the water itself
    const water = makeWater({ width: 6.72, depth: 11.92, color: 0x265752, opacity: 0.9 });
    water.position.set(0, WATER_HIGH, -9);
    this.add(water);
    this.track(water);
    this._water = water;

    // chrome ladder at the shallow end, behind the rope
    for (const lx of [2.35, 2.85]) {
      const railUp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.86, 8), chrome);
      railUp.position.set(lx, 0.43, POOL_Z0 + 0.2);
      const bend = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), chrome);
      bend.rotation.x = Math.PI / 2;
      bend.position.set(lx, 0.86, POOL_Z0 + 0.04);
      const railDown = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.95, 8), chrome);
      railDown.position.set(lx, -0.11, POOL_Z0 - 0.12);
      this.add(railUp, bend, railDown);
    }
    for (const ry of [-0.15, -0.6, -1.05]) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.5, 8), chrome);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(2.6, ry, POOL_Z0 - 0.12);
      this.add(rung);
    }

    // ---------- hall shell ----------
    const lowWall = (mat, w, d, x, z) => {
      const m = makeWall(w, 2.2, d, mat);
      m.position.set(x, 1.1, z);
      this.add(m);
      this.addCollider(m);
      return m;
    };
    const highWall = (mat, w, d, x, z) => {
      const m = makeWall(w, HALL_H - 2.2, d, mat);
      m.position.set(x, 2.2 + (HALL_H - 2.2) / 2, z);
      this.add(m);
      return m;
    };
    // north (behind spawn) — solid
    lowWall(wallShort, HALL_W + 0.5, 0.24, 0, 2.12);
    highWall(upperShort, HALL_W + 0.5, 0.24, 0, 2.12);
    // south — doorway for the chained exit
    for (const side of [-1, 1]) {
      lowWall(wallShort, (HALL_W - 1.1) / 2, 0.24, side * (0.55 + (HALL_W - 1.1) / 4), END_Z - 0.12);
    }
    highWall(upperShort, HALL_W + 0.5, 0.24, 0, END_Z - 0.12);
    // east — archway to the changing room (z -4.6 .. -5.8)
    lowWall(wallLong, 0.24, 6.6, 7.12, -1.3);
    lowWall(wallLong, 0.24, 14.2, 7.12, -12.9);
    highWall(upperLong, 0.24, 22.5, 7.12, -9);
    // west — archway to the filter room (z -16.2 .. -17.8)
    lowWall(wallLong, 0.24, 18.2, -7.12, -7.1);
    lowWall(wallLong, 0.24, 2.2, -7.12, -18.9);
    highWall(upperLong, 0.24, 22.5, -7.12, -9);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W + 0.6, 22.6), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, HALL_H, -9);
    this.add(ceil);

    // ---------- lights ----------
    this.add(new THREE.HemisphereLight(0x9fd6c8, 0x232e28, 0.42));

    const dropCord = (x, z, topY, botY) => {
      const c = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, topY - botY, 6), cordMat
      );
      c.position.set(x, (topY + botY) / 2, z);
      this.add(c);
    };
    // east row still works
    for (const z of [-4.5, -9, -13.5]) {
      const bulb = makeBulbLight({ color: 0xd6efe0, intensity: 6, distance: 12, y: 3.55 });
      bulb.position.set(3.9, 0, z);
      if (z === -9) bulb.light.castShadow = true;
      this.add(bulb);
      dropCord(3.9, z, HALL_H, 3.7);
    }
    // west row went out years ago — one of them still tries
    for (const z of [-9, -13.5]) {
      const g = new THREE.Group();
      const dead = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x171c1a, roughness: 0.4 })
      );
      dead.position.y = 3.4;
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), cordMat);
      cord.position.y = 3.55;
      g.add(dead, cord);
      g.position.set(-3.9, 0, z);
      this.add(g);
      dropCord(-3.9, z, HALL_H, 3.7);
    }
    const dying = makeBulbLight({ color: 0xcfe8da, intensity: 1.4, distance: 8, y: 3.55 });
    dying.position.set(-3.9, 0, -4.5);
    this.add(dying);
    dropCord(-3.9, -4.5, HALL_H, 3.7);
    const dyingBulbMesh = dying.children[1];
    let tFlick = 0;
    this.tick((dt, t) => {
      if (t > tFlick) {
        const on = Math.random() > 0.62;
        dying.light.intensity = on ? 1.5 : 0.1;
        dyingBulbMesh.material.emissiveIntensity = on ? 2.2 : 0.15;
        tFlick = t + (on ? 0.06 + Math.random() * 0.5 : 0.1 + Math.random() * 1.6);
      }
    });
    // a dim lamp over the far door, so the way out reads through the fog
    const doorBulb = makeBulbLight({ color: 0xc2e4d4, intensity: 2.6, distance: 6.5, y: 3.1 });
    doorBulb.position.set(0, 0, -19.35);
    this.add(doorBulb);
    dropCord(0, -19.35, HALL_H, 3.25);
    // and one over the shallow-end deck, for the clock and the bench
    const deckBulb = makeBulbLight({ color: 0xd6efe0, intensity: 3.5, distance: 9, y: 3.55 });
    deckBulb.position.set(-0.8, 0, -0.9);
    this.add(deckBulb);
    dropCord(-0.8, -0.9, HALL_H, 3.7);

    this.add(makeDust({
      count: 320, box: [13.5, 4, 21.5], center: [0, 2.1, -9], color: 0xd8efe6,
    }));

    // ---------- rope ring — the pool is closed ----------
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x9c5a4e, roughness: 0.9 });
    const ropeSpan = (ax, az, bx, bz) => {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(ax, 0.82, az),
        new THREE.Vector3((ax + bx) / 2, 0.66, (az + bz) / 2),
        new THREE.Vector3(bx, 0.82, bz)
      );
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.016, 6), ropeMat);
      m.castShadow = true;
      this.add(m);
    };
    const post = (x, z) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.88, 10), chrome);
      pole.position.y = 0.44;
      pole.castShadow = true;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.03, 12), chrome);
      base.position.y = 0.015;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), chrome);
      cap.position.y = 0.89;
      g.add(pole, base, cap);
      g.position.set(x, 0, z);
      this.add(g);
    };
    const RX = POOL_HW + 0.32, RZ0 = POOL_Z0 + 0.32, RZ1 = POOL_Z1 - 0.32;
    for (const x of [-RX, 0, RX]) { post(x, RZ0); post(x, RZ1); }
    for (const z of [-5.85, -9, -12.15]) { post(-RX, z); post(RX, z); }
    ropeSpan(-RX, RZ0, 0, RZ0); ropeSpan(0, RZ0, RX, RZ0);
    ropeSpan(-RX, RZ1, 0, RZ1); ropeSpan(0, RZ1, RX, RZ1);
    for (const [za, zb] of [[RZ0, -5.85], [-5.85, -9], [-9, -12.15], [-12.15, RZ1]]) {
      ropeSpan(-RX, za, -RX, zb);
      ropeSpan(RX, za, RX, zb);
    }
    // nothing lets you fall in
    this.addBlocker([-3.85, 0, POOL_Z0 - 0.05], [3.85, 1.4, RZ0 + 0.08]);
    this.addBlocker([-3.85, 0, RZ1 - 0.08], [3.85, 1.4, POOL_Z1 + 0.05]);
    this.addBlocker([-RX - 0.08, 0, POOL_Z1 - 0.1], [-POOL_HW + 0.08, 1.4, POOL_Z0 + 0.1]);
    this.addBlocker([POOL_HW - 0.08, 0, POOL_Z1 - 0.1], [RX + 0.08, 1.4, POOL_Z0 + 0.1]);

    // ---------- the lifeguard's chair & the note ----------
    const chair = new THREE.Group();
    const chairMat = makeMat('wood', { base: '#9fb0a4', repeat: [1, 2] });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.95, 0.055), chairMat);
      leg.position.set(sx * 0.27, 0.975, sz * 0.24);
      leg.castShadow = true;
      chair.add(leg);
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.54), chairMat);
    platform.position.y = 1.95;
    platform.castShadow = platform.receiveShadow = true;
    chair.add(platform);
    for (const by of [2.25, 2.5]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.14, 0.04), chairMat);
      slat.position.set(0, by, -0.26);
      slat.castShadow = true;
      chair.add(slat);
    }
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.5), chairMat);
      arm.position.set(sx * 0.31, 2.2, 0);
      chair.add(arm);
      const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.04), chairMat);
      armPost.position.set(sx * 0.31, 2.08, 0.2);
      chair.add(armPost);
    }
    for (let i = 0; i < 4; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), chairMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.42 + i * 0.42, 0.26);
      chair.add(rung);
    }
    chair.position.set(5.75, 0, -9);
    chair.rotation.y = -Math.PI / 2; // facing the water
    this.add(chair);
    this.addCollider(chair);

    const note = makeNoteProp();
    note.position.set(5.72, 1.98, -9.04);
    note.rotation.y = -Math.PI / 2 + 0.2;
    this.add(note);
    this.interact(note, {
      prompt: 'read the note',
      onInteract: () => {
        this.giveNote({
          id: 'l2-note',
          title: 'a note on the lifeguard’s chair',
          body:
            'Nobody ever watched you swim but me.\n' +
            'Every Sunday, from up here. Counting your lengths.\n\n' +
            'The water is keeping something under.\n' +
            'The valve in the filter room still turns, if you ask it.\n\n' +
            '— M.',
        });
        this.setObjective('the valve in the filter room');
      },
    });

    // ---------- the filter room (west alcove) ----------
    const alcWall = (w, d, x, z) => {
      const m = makeWall(w, 2.5, d, concMat);
      m.position.set(x, 1.25, z);
      this.add(m);
      this.addCollider(m);
    };
    alcWall(3.3, 0.24, -8.66, -15.48);
    alcWall(3.3, 0.24, -8.66, -18.52);
    alcWall(0.24, 3.2, -10.32, -17);
    const alcFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.9), concFloorMat);
    alcFloor.rotation.x = -Math.PI / 2;
    alcFloor.position.set(-8.55, 0, -17);
    alcFloor.receiveShadow = true;
    this.add(alcFloor);
    this.addGround(alcFloor);
    const alcCeil = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.0), concMat);
    alcCeil.rotation.x = Math.PI / 2;
    alcCeil.position.set(-8.55, 2.5, -17);
    this.add(alcCeil);

    const filterSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.3),
      new THREE.MeshStandardMaterial({
        map: textTexture({
          text: 'FILTER ROOM', width: 512, height: 134,
          font: 'bold 58px Courier New', color: '#b6c6ba', bg: '#37453f',
        }),
        roughness: 0.8,
      })
    );
    filterSign.position.set(-6.98, 2.62, -17);
    filterSign.rotation.y = Math.PI / 2;
    this.add(filterSign);

    // pipes, the pump, and the valve that still turns
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3f, roughness: 0.8, metalness: 0.45 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.4, 18), pipeMat);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(-9.7, 0.5, -17);
    tank.castShadow = tank.receiveShadow = true;
    this.add(tank);
    this.addCollider(tank);
    const pipe = (r, len, x, y, z, axis) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), pipeMat);
      if (axis === 'x') p.rotation.z = Math.PI / 2;
      if (axis === 'z') p.rotation.x = Math.PI / 2;
      p.position.set(x, y, z);
      p.castShadow = true;
      this.add(p);
      return p;
    };
    pipe(0.06, 1.6, -9.7, 1.7, -16.35, 'y');        // riser off the tank
    pipe(0.05, 2.6, -10.05, 1.6, -17, 'z');         // run along the back wall
    pipe(0.05, 1.6, -10.05, 0.8, -16.1, 'y');
    pipe(0.045, 0.55, -9.42, 1.1, -17, 'x');        // stub out to the valve
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), pipeMat);
    elbow.position.set(-9.7, 1.1, -17);
    this.add(elbow);
    pipe(0.06, 0.55, -9.7, 0.95, -17, 'y');

    const valve = makeValve();
    valve.position.set(-9.12, 1.1, -17);
    valve.rotation.y = Math.PI / 2; // facing the doorway
    this.add(valve);
    this.track(valve);
    this._valve = valve;

    const drainTag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.13),
      new THREE.MeshStandardMaterial({
        map: textTexture({
          text: 'DRAIN', width: 256, height: 92,
          font: 'bold 52px Courier New', color: '#cdc6b8', bg: '#4a423a',
        }),
        roughness: 0.85,
      })
    );
    drainTag.position.set(-9.3, 0.78, -17);
    drainTag.rotation.y = Math.PI / 2;
    this.add(drainTag);

    // pressure gauge, needle resting on nothing
    const gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    const gx = gc.getContext('2d');
    gx.fillStyle = '#d8d5c6';
    gx.beginPath(); gx.arc(64, 64, 58, 0, Math.PI * 2); gx.fill();
    gx.strokeStyle = '#3a4038'; gx.lineWidth = 6;
    gx.beginPath(); gx.arc(64, 64, 55, 0, Math.PI * 2); gx.stroke();
    gx.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.75 + (i * 1.5) / 8);
      gx.beginPath();
      gx.moveTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
      gx.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52);
      gx.stroke();
    }
    gx.strokeStyle = '#8a4438'; gx.lineWidth = 3;
    const na = Math.PI * 0.78;
    gx.beginPath(); gx.moveTo(64, 64);
    gx.lineTo(64 + Math.cos(na) * 46, 64 + Math.sin(na) * 46);
    gx.stroke();
    const gaugeTex = new THREE.CanvasTexture(gc);
    gaugeTex.colorSpace = THREE.SRGBColorSpace;
    const gauge = new THREE.Mesh(
      new THREE.CircleGeometry(0.08, 20),
      new THREE.MeshStandardMaterial({ map: gaugeTex, transparent: true, roughness: 0.4 })
    );
    gauge.position.set(-9.62, 1.72, -16.35);
    gauge.rotation.y = Math.PI / 2;
    this.add(gauge);

    const alcoveBulb = makeBulbLight({ color: 0xcfe8d2, intensity: 3.5, distance: 6.5, y: 2.3 });
    alcoveBulb.position.set(-8.6, 0, -17);
    this.add(alcoveBulb);

    this.interact(valve, {
      prompt: 'turn the valve',
      once: true,
      distance: 2.6,
      onInteract: () => {
        this.playSound('switch');
        valve.spinBy(6.5);
        this.setObjective('watch the water go');
        this.subtitle('The old pipes clear their throat. Far away, the water starts to go.', 4.5);
        this.after(0.6, () => {
          this.playSound('splash');
          this._draining = true;
        });
      },
    });

    // ---------- changing room (east archway, just dark) ----------
    const recWall = (w, d, x, z) => {
      const m = makeWall(w, 2.2, d, darkTile);
      m.position.set(x, 1.1, z);
      this.add(m);
      this.addCollider(m);
    };
    recWall(1.44, 0.1, 7.64, -4.62);
    recWall(1.44, 0.1, 7.64, -5.78);
    recWall(0.1, 1.3, 8.26, -5.2);
    const recFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.34, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x0c1412, roughness: 1 })
    );
    recFloor.rotation.x = -Math.PI / 2;
    recFloor.position.set(7.62, 0, -5.2);
    this.add(recFloor);
    this.addGround(recFloor);
    const recCeil = new THREE.Mesh(
      new THREE.PlaneGeometry(1.34, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x0c1412, roughness: 1 })
    );
    recCeil.rotation.x = Math.PI / 2;
    recCeil.position.set(7.62, 2.2, -5.2);
    this.add(recCeil);
    this.addBlocker([7.4, 0, -5.9], [7.8, 2.3, -4.5]);

    const changingSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.28),
      new THREE.MeshStandardMaterial({
        map: textTexture({
          text: 'CHANGING', width: 460, height: 128,
          font: 'bold 54px Courier New', color: '#9fb0a3', bg: '#3a4740',
        }),
        roughness: 0.85,
      })
    );
    changingSign.position.set(6.98, 2.6, -5.2);
    changingSign.rotation.y = -Math.PI / 2;
    this.add(changingSign);

    // a towel on a hook by the doorway
    const towel = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.55, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xb6bcae, roughness: 0.95 })
    );
    towel.position.set(6.95, 1.42, -6.35);
    towel.rotation.x = 0.04;
    this.add(towel);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), chrome);
    hook.rotation.z = Math.PI / 2;
    hook.position.set(6.96, 1.72, -6.35);
    this.add(hook);
    this.interact(towel, {
      prompt: 'a towel on a hook',
      onInteract: () => {
        this.subtitle('Still damp. Nobody has been here in years, and it is still damp.', 5);
      },
    });

    // ---------- small true things ----------
    // the clock that stopped
    const cc = document.createElement('canvas');
    cc.width = cc.height = 256;
    const cx = cc.getContext('2d');
    cx.fillStyle = '#dde1d4';
    cx.beginPath(); cx.arc(128, 128, 120, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = '#2e352f'; cx.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      cx.beginPath();
      cx.moveTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104);
      cx.lineTo(128 + Math.cos(a) * 114, 128 + Math.sin(a) * 114);
      cx.stroke();
    }
    const hand = (angle, len, w) => {
      cx.lineWidth = w;
      cx.beginPath();
      cx.moveTo(128, 128);
      cx.lineTo(128 + Math.cos(angle) * len, 128 + Math.sin(angle) * len);
      cx.stroke();
    };
    hand(-Math.PI / 2 + (1.4 / 12) * Math.PI * 2, 58, 9);   // hour: just past one
    hand(-Math.PI / 2 + (24 / 60) * Math.PI * 2, 88, 5);    // minute: twenty-four
    cx.fillStyle = '#2e352f';
    cx.beginPath(); cx.arc(128, 128, 8, 0, Math.PI * 2); cx.fill();
    const clockTex = new THREE.CanvasTexture(cc);
    clockTex.colorSpace = THREE.SRGBColorSpace;
    const clock = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 36),
      new THREE.MeshStandardMaterial({ map: clockTex, transparent: true, roughness: 0.5 })
    );
    clock.position.set(0, 2.6, 1.87);
    clock.rotation.y = Math.PI;
    this.add(clock);
    const clockRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.028, 10, 36),
      new THREE.MeshStandardMaterial({ color: 0x2c332e, roughness: 0.5, metalness: 0.5 })
    );
    clockRim.position.set(0, 2.6, 1.9);
    this.add(clockRim);
    // a bench nobody sat on, under the clock
    const bench = makeBench();
    bench.position.set(-2.4, 0, 1.55);
    bench.rotation.y = Math.PI;
    this.add(bench);
    this.addCollider(bench);
    this.interact(clock, {
      prompt: 'the clock',
      onInteract: () => {
        this.subtitle('Stopped at twenty-four past one. A Sunday, probably.', 5);
      },
    });

    // the pool rules, one rule newer than the others
    const rc = document.createElement('canvas');
    rc.width = 256; rc.height = 300;
    const rx = rc.getContext('2d');
    rx.fillStyle = '#c9cfbc';
    rx.fillRect(0, 0, 256, 300);
    rx.strokeStyle = '#5a685c'; rx.lineWidth = 6;
    rx.strokeRect(10, 10, 236, 280);
    rx.fillStyle = '#3c4a40';
    rx.font = 'bold 28px Georgia';
    rx.textAlign = 'center';
    rx.fillText('NO RUNNING', 128, 84);
    rx.fillText('NO DIVING', 128, 148);
    rx.save();
    rx.globalAlpha = 0.4;
    rx.translate(128, 224);
    rx.rotate(-0.03);
    rx.fillText('NO GOING BACK', 0, 0);
    rx.restore();
    const rulesTex = new THREE.CanvasTexture(rc);
    rulesTex.colorSpace = THREE.SRGBColorSpace;
    const rules = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.66),
      new THREE.MeshStandardMaterial({ map: rulesTex, roughness: 0.85 })
    );
    rules.position.set(6.97, 1.75, -1.5);
    rules.rotation.y = -Math.PI / 2;
    this.add(rules);
    this.interact(rules, {
      prompt: 'the pool rules',
      onInteract: () => {
        this.subtitle('Someone added the third rule later, in a steadier hand.', 5);
      },
    });

    // lane ropes, coiled and put away
    const coil = new THREE.Group();
    const coilCols = [0xa05548, 0xcfcfc4, 0xa05548];
    [[0.42, 0.05], [0.36, 0.115], [0.4, 0.18]].forEach(([r, y], i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.032, 8, 26),
        new THREE.MeshStandardMaterial({ color: coilCols[i], roughness: 0.85 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = i * 0.4;
      ring.position.y = y;
      ring.castShadow = true;
      coil.add(ring);
    });
    coil.position.set(-5.5, 0, -4.6);
    this.add(coil);
    this.interact(coil, {
      prompt: 'the lane ropes',
      onInteract: () => {
        this.subtitle('Coiled and put away. The lanes stopped mattering years ago.', 5);
      },
    });

    // puddles that never dry
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x0e1a17, transparent: true, opacity: 0.55,
      roughness: 0.06, metalness: 0.3,
    });
    for (const [px, pz, s] of [
      [2.1, -1.7, 1], [-4.9, -11.4, 1.3], [6.1, -13.2, 0.8],
      [1.6, -17.4, 1.1], [-8.4, -16.3, 0.7],
    ]) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.4, 18), puddleMat);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = px + pz;
      p.scale.set(1.5 * s, s, 1);
      p.position.set(px, 0.007, pz);
      this.add(p);
    }

    // ---------- the chained door ----------
    const exitDoor = makeDoor({ width: 1.1, height: 2.1, color: '#3f4a44', frameColor: '#333b36' });
    exitDoor.position.set(0, 0, END_Z);
    this.add(exitDoor);
    this.track(exitDoor);
    this.addCollider(exitDoor.panel);
    this._exitDoor = exitDoor;
    this._exitOpen = false;

    const chain = new THREE.Group();
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x3f4649, roughness: 0.5, metalness: 0.75 });
    const strand = (ax, ay, bx, by) => {
      const n = 9;
      const angle = Math.atan2(by - ay, bx - ax);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.012, 6, 10), chainMat);
        link.position.set(ax + (bx - ax) * t, ay + (by - ay) * t, 0);
        link.rotation.z = angle;
        if (i % 2) link.rotation.y = Math.PI / 2.3;
        link.castShadow = true;
        chain.add(link);
      }
    };
    strand(-0.62, 1.52, 0.62, 0.78);
    strand(-0.62, 0.78, 0.62, 1.52);
    const lockBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.15, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x67707a, roughness: 0.3, metalness: 0.8 })
    );
    lockBody.position.set(0, 1.13, 0.01);
    lockBody.castShadow = true;
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 8, 14, Math.PI), chainMat);
    shackle.position.set(0, 1.21, 0.01);
    chain.add(lockBody, shackle);
    chain.position.set(0, 0, END_Z + 0.09);
    this.add(chain);
    this._chain = chain;

    this.interact(exitDoor, {
      prompt: 'try the padlock',
      onInteract: () => {
        if (this._exitOpen) return;
        this.game.ui.showKeypad({
          label: 'the padlock',
          length: 3,
          onSubmit: (code) => {
            if (code === '124') {
              this.playSound('unlock');
              chain.visible = false;
              this._exitOpen = true;
              exitDoor.setOpen(true, -1);
              this.removeColliderOf(exitDoor.panel);
              this.game.interaction.remove(exitDoor);
              this.setObjective('');
              this.subtitle('Shallow, then deep. The chain slips off, almost relieved.', 5);
              this.after(0.4, () => this.playSound('door'));
            } else {
              this.playSound('wrong');
              this.subtitle('Shallow end first. You always started at the shallow end.', 5);
            }
          },
        });
      },
    });

    // beyond the door: a dark landing that swallows you
    const landing = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 4.8),
      new THREE.MeshStandardMaterial({ color: 0x050705, roughness: 1 })
    );
    landing.rotation.x = -Math.PI / 2;
    landing.position.set(0, 0, END_Z - 2.4);
    this.add(landing);
    this.addGround(landing);
    this.addBlocker([-3.3, 0, END_Z - 4.9], [3.3, 3, END_Z - 4.4]);
    this.addBlocker([-3.4, 0, END_Z - 4.6], [-2.9, 3, END_Z + 0.1]);
    this.addBlocker([2.9, 0, END_Z - 4.6], [3.4, 3, END_Z + 0.1]);

    // ---------- the draining ----------
    this._draining = false;
    this._drainT = 0;
    this.tick((dt) => {
      if (!this._draining) return;
      this._drainT += dt;
      const s = Math.min(1, this._drainT / DRAIN_SECS);
      const e = s * s * (3 - 2 * s);
      water.position.y = WATER_HIGH + (WATER_LOW - WATER_HIGH) * e;
      if (s >= 1) {
        this._draining = false;
        this.playSound('splash');
        this.subtitle('The deep end shows its number, like something surfacing for air.', 5);
        this.learnClue({
          id: 'l2-depths',
          title: 'the depth markers',
          body: '1 at the shallow end. 2 partway along.\nAnd under where the water was: 4.',
        });
        this.setObjective('the padlock on the far door');
      }
    });

    // walking through the open door finishes the level
    this.tick(() => {
      if (this._exitOpen && !this.isCompleted && this.game.player.position.z < END_Z - 1.2) {
        this.complete();
      }
    });

    // ---------- spawn & bounds ----------
    this.spawn.position.set(1.2, 0, -0.35);
    this.spawn.yaw = 0.06; // facing down the length of the pool
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-10.05, 0, END_Z - 3.6),
      new THREE.Vector3(7.65, 5, 1.75)
    );

    this.setObjective('the far door is chained');
    this._note = note;
  }

  async debugSolve() {
    // read the note on the lifeguard's chair
    this.debugInteract(this._note);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    // ask the valve; wait for the water to go
    this.debugInteract(this._valve);
    await this.debugWait(5.6);
    // the padlock: shallow to deep
    this.debugInteract(this._exitDoor);
    await this.debugWait(0.4);
    this.game.ui.submitKeypad('124');
    await this.debugWait(0.8);
    // walk through
    this.game.player.teleport(0, END_Z - 1.6, 0);
    await this.debugWait(0.6);
  }
}
