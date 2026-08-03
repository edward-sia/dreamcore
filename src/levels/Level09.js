import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import {
  makeTable, makeShelf, makeNoteProp, makeBulbLight, makeDust, applyFog,
} from '../core/props.js';

// IX — The Archive
// A records basement that has been keeping files on the dream itself.
// Eight boxes, one for every room you have walked — but the filing is
// imperfect: two cards have swapped boxes, two boxes sit too high, one
// card has slipped behind the shelving. The vault door wants four
// figures the records agree on: 4 · 2 · 3 · 6.

const ROOM_W = 19;      // x: -9.5 .. 9.5
const ROOM_D = 15;      // z: -7.5 .. 7.5 (vault in the -z wall)
const CEIL = 2.9;

export default class Level09 extends LevelBase {
  static meta = {
    id: 9,
    numeral: 'IX',
    title: 'The Archive',
    mood: 'archive',
    intro: 'Someone has been keeping records of you, and they have kept them badly.',
    outro:
      'The records were never for you. They were how the dream\n' +
      'reminded itself, every night, which rooms to rebuild —\n' +
      'in case you came back. You always came back.',
  };

  build() {
    const s = this;
    applyFog(this.scene, '#131009', 2.5, 24);

    // ---------- shell ----------
    const floorMat = makeMat('concrete', { base: '#6e6a60', repeat: [9, 7] });
    const wallMat = makeMat('plaster', { base: '#8d8371', repeat: [8, 1.4] });
    const ceilMat = makeMat('concrete', { base: '#57534a', repeat: [8, 6] });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.add(floor);
    this.addGround(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = CEIL;
    this.add(ceil);

    const mkWall = (w, h, d, x, y, z) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      wall.position.set(x, y, z);
      wall.castShadow = wall.receiveShadow = true;
      this.add(wall);
      this.addCollider(wall);
      return wall;
    };
    mkWall(ROOM_W + 0.4, CEIL, 0.2, 0, CEIL / 2, ROOM_D / 2 + 0.1);        // back (+z)
    mkWall(0.2, CEIL, ROOM_D + 0.4, -ROOM_W / 2 - 0.1, CEIL / 2, 0);       // west
    mkWall(0.2, CEIL, ROOM_D + 0.4, ROOM_W / 2 + 0.1, CEIL / 2, 0);        // east
    // vault wall (-z) with a doorway gap
    mkWall((ROOM_W - 1.3) / 2 + 0.2, CEIL, 0.2, -(0.65 + ((ROOM_W - 1.3) / 2 + 0.2) / 2), CEIL / 2, -ROOM_D / 2 - 0.1);
    mkWall((ROOM_W - 1.3) / 2 + 0.2, CEIL, 0.2, 0.65 + ((ROOM_W - 1.3) / 2 + 0.2) / 2, CEIL / 2, -ROOM_D / 2 - 0.1);
    mkWall(1.5, CEIL - 2.15, 0.2, 0, 2.15 + (CEIL - 2.15) / 2, -ROOM_D / 2 - 0.1);

    // ---------- light: sparse bulbs, one green pool at the table ----------
    this.add(new THREE.HemisphereLight(0x6b6552, 0x191510, 1.1));
    for (const [x, z, on] of [[-4.5, 3.2, true], [4.5, 3.2, true], [0, -3.4, true], [-4.5, -3.4, false]]) {
      const bulb = makeBulbLight({ y: CEIL - 0.32, intensity: on ? 5 : 0.4, distance: 9, color: 0xf2ddb0 });
      bulb.position.set(x, 0, z);
      this.add(bulb);
      if (!on) {
        // the dead corner gasps at long intervals, like the hallway's sixth bulb
        let tNext = 6;
        this.tick((dt, t) => {
          if (t > tNext) {
            bulb.light.intensity = bulb.light.intensity > 1 ? 0.4 : 2.2;
            tNext = t + (bulb.light.intensity > 1 ? 0.22 : 7 + Math.random() * 9);
          }
        });
      }
    }
    this.add(this.track(makeDust({ count: 240, box: [16, 2.4, 12], center: [0, 1.4, 0] })));

    // ---------- shelving: three runs, boxes of rooms ----------
    // runs along x, aisles between; unit shelves from props scaled deep
    const runs = [
      { z: 4.6, dir: 1 },    // against back wall area
      { z: 1.0, dir: -1 },
      { z: -2.6, dir: 1 },
    ];
    for (const run of runs) {
      for (let i = 0; i < 3; i++) {
        const unit = makeShelf({ w: 2.3, h: 2.45, d: 0.5, shelves: 4 });
        unit.position.set(-3.45 + i * 3.45, 0, run.z);
        this.add(unit);
      }
      const blocker = new THREE.Mesh(
        new THREE.BoxGeometry(10.4, 2.45, 0.5),
        new THREE.MeshStandardMaterial({ visible: false })
      );
      blocker.position.set(0, 1.22, run.z);
      this.add(blocker);
      this.addCollider(blocker);
    }

    // anonymous stock: rows of cardboard boxes filling shelf levels
    const cardMat = new THREE.MeshStandardMaterial({ color: 0x9a8663, roughness: 0.9 });
    const cardMatDark = new THREE.MeshStandardMaterial({ color: 0x83714f, roughness: 0.95 });
    let alt = false;
    for (const run of runs) {
      for (let x = -4.7; x <= 4.7; x += 0.62) {
        for (const y of [0.35, 0.93, 1.51, 2.09]) {
          if (Math.random() < 0.28) continue;
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.4), (alt = !alt) ? cardMat : cardMatDark);
          b.position.set(x + (Math.random() - 0.5) * 0.05, y, run.z + (Math.random() - 0.5) * 0.04);
          b.rotation.y = (Math.random() - 0.5) * 0.1;
          this.add(b);
        }
      }
    }

    // ---------- the eight boxes that matter ----------
    // facts the vault wants: pool 4 · supermarket 2 · platform 3 · theater F=6
    // (card texts live in _takeCard)
    // which box LABEL holds which CARD — the pool and the theater are swapped
    const FILING = [
      { label: 'the hallway', card: 'hallway', run: 0, x: -4.2, y: 0.93 },
      { label: 'the pool', card: 'theater', run: 1, x: -2.4, y: 1.51 },       // misfiled
      { label: 'the street', card: 'street', run: 0, x: 1.9, y: 1.51 },
      { label: 'the supermarket', card: 'supermarket', run: 2, x: -0.6, y: 0.93 },
      { label: 'the house', card: 'house', run: 1, x: 3.3, y: 0.35 },
      { label: 'the field', card: 'field', run: 2, x: 4.1, y: 1.51, slipped: true },
      { label: 'the platform', card: 'platform', run: 0, x: -1.2, y: 2.09, high: true },
      { label: 'the theater', card: 'pool', run: 2, x: 2.1, y: 2.09, high: true },  // misfiled
    ];

    const labelMatFor = (text) => new THREE.MeshStandardMaterial({
      map: textTexture({
        text, width: 256, height: 96, font: 'italic 30px Georgia',
        color: '#33291c', bg: '#cbbc9d',
      }),
      roughness: 0.85,
    });

    this._ladderAt = null;    // label of the high box the ladder serves, or null
    this._readCards = new Set();
    const boxRefs = {};

    for (const f of FILING) {
      const run = runs[f.run];
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.42), cardMat);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.44), cardMatDark);
      lid.position.y = 0.2;
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), labelMatFor(f.label));
      tag.position.set(0, 0.02, run.dir * 0.222);
      if (run.dir < 0) tag.rotation.y = Math.PI;
      g.add(body, lid, tag);
      g.position.set(f.x, f.y + 0.18, run.z - run.dir * 0.02);
      this.add(g);
      boxRefs[f.label] = g;
      this._boxRefs = boxRefs;

      if (f.slipped) {
        // the box is EMPTY — its card slipped behind the shelving
        this.interact(g, {
          prompt: `open “${f.label}”`,
          onInteract: () => {
            this.playSound('paper');
            this.subtitle('Empty. Torn tissue paper, and the shape where a card used to lie.', 5);
            this._fieldBoxOpened = true;
            if (!this._slipTaken) this.setObjective('one card has gone somewhere cards go');
          },
        });
        continue;
      }

      this.interact(g, {
        prompt: `open “${f.label}”`,
        onInteract: () => {
          if (f.high && this._ladderAt !== f.label) {
            this.playSound('locked');
            this.subtitle('Two shelves too high. The ladder still rolls, somewhere.', 4.5);
            return;
          }
          this._takeCard(f.card, f.label);
        },
      });
    }

    // the slipped card: visible through the gap behind run 2's shelving
    const slipCard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.16),
      new THREE.MeshStandardMaterial({
        color: 0xe6dcc2, roughness: 0.9,
        emissive: 0xfff6dc, emissiveIntensity: 0.12,
      })
    );
    slipCard.position.set(4.78, 0.07, runs[2].z - 0.14);
    slipCard.rotation.set(-Math.PI / 2 + 0.25, 0, 0.5);
    this.add(slipCard);
    this.interact(slipCard, {
      prompt: 'something pale, down behind the shelf',
      distance: 3.4,
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('You can see it. Your arm has been too big for this gap since you were nine.', 5);
      },
    });
    // ...retrieved from the run's end, at floor level
    const reachSpot = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.06, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 1 })
    );
    reachSpot.position.set(5.55, 0.03, runs[2].z - 0.1);
    this.add(reachSpot);
    this.interact(reachSpot, {
      prompt: 'reach in from the end of the run',
      once: true,
      onInteract: () => {
        this._slipTaken = true;
        slipCard.visible = false;
        this.game.interaction.remove(slipCard);
        this._takeCard('field', 'the gap behind the shelves');
        this.subtitle('Dust to the elbow. But your fingers close on card.', 4.5);
      },
    });

    // ---------- the rolling ladder ----------
    const ladder = new THREE.Group();
    const rSideMat = new THREE.MeshStandardMaterial({ color: 0x6a4c30, roughness: 0.8 });
    for (const sx of [-0.28, 0.28]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 0.05), rSideMat);
      rail.position.set(sx, 1.25, 0);
      rail.rotation.x = 0.18;
      ladder.add(rail);
    }
    for (let i = 0; i < 7; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 8), rSideMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.3 + i * 0.33, 0.055 * (3 - i) * 0.18);
      ladder.add(rung);
    }
    ladder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this._ladder = ladder;
    this._ladderHomes = {
      'the platform': { x: -1.2, z: runs[0].z - 0.62, group: null },
      'the theater': { x: 2.1, z: runs[2].z - 0.62 },
    };
    ladder.position.set(-5.6, 0, runs[0].z - 0.62);
    this.add(ladder);
    this.addCollider(ladder);
    this._ladderTarget = null;
    this.interact(ladder, {
      prompt: 'roll the ladder',
      onInteract: () => {
        // slide it to whichever high box is still unread; alternate otherwise
        const order = ['the platform', 'the theater'];
        const next =
          order.find((l) => this._ladderAt !== l &&
            !this._readCards.has(FILING.find((f) => f.label === l).card)) ??
          order.find((l) => this._ladderAt !== l);
        if (!next) return;
        const home = this._ladderHomes[next];
        this._ladderTarget = { ...home, label: next };
        this.playSound('switch');
        this.subtitle('The castors remember their rails. It rolls like it weighs nothing.', 4);
      },
    });
    this.tick((dt) => {
      const t = this._ladderTarget;
      if (!t) return;
      const dx = t.x - ladder.position.x;
      const dz = t.z - ladder.position.z;
      const step = 2.2 * dt;
      if (Math.hypot(dx, dz) < 0.05) {
        ladder.position.set(t.x, 0, t.z);
        this._ladderAt = t.label;
        this._ladderTarget = null;
        this.playSound('clue');
      } else {
        ladder.position.x += Math.sign(dx) * Math.min(Math.abs(dx), step);
        ladder.position.z += Math.sign(dz) * Math.min(Math.abs(dz), step * 0.6);
      }
    });

    // ---------- the reading table, the green lamp, the master card ----------
    const table = makeTable({ w: 1.5, d: 0.8, h: 0.76 });
    table.position.set(0, 0, 6.4);
    this.add(table);
    this.addCollider(table);

    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a7433, roughness: 0.4, metalness: 0.8 })
    );
    lampBase.position.set(-0.42, 0.79, 6.5);
    const lampStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8),
      lampBase.material
    );
    lampStem.position.set(-0.42, 0.95, 6.5);
    lampStem.rotation.x = 0.35;
    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.19, 0.13, 14, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x1f4d33, roughness: 0.35,
        emissive: 0x2f7a4a, emissiveIntensity: 0.7, side: THREE.DoubleSide,
      })
    );
    lampShade.position.set(-0.42, 1.09, 6.44);
    lampShade.rotation.x = 0.3;
    const lampLight = new THREE.PointLight(0xcfe8b8, 6, 5.5, 1.8);
    lampLight.position.set(-0.42, 1.02, 6.4);
    lampLight.castShadow = true;
    this.add(lampBase, lampStem, lampShade, lampLight);

    const master = makeNoteProp();
    master.position.set(0.15, 0.785, 6.4);
    this.add(master);
    this._master = master;
    this.interact(master, {
      prompt: 'the card left out on the table',
      onInteract: () => {
        this.giveNote({
          id: 'l9-master',
          title: 'what the records agree on',
          body:
            'the dream files everything under one number.\n' +
            'four figures, always the same four:\n\n' +
            '— how deep the water finally went\n' +
            '— the aisle that faced the sun\n' +
            '— the carriage you always chose\n' +
            '— your row, counted on your fingers',
        });
        if (!this._objSet) {
          this._objSet = true;
          this.setObjective('the records disagree with the labels');
        }
      },
    });

    // a card catalogue, for flavour
    const cat = new THREE.Group();
    const catBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.35, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x5d452c, roughness: 0.7 })
    );
    catBody.position.y = 0.675;
    cat.add(catBody);
    const knobM = new THREE.MeshStandardMaterial({ color: 0xb9a05c, metalness: 0.8, roughness: 0.35 });
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), knobM);
        knob.position.set(-0.33 + c * 0.33, 0.28 + r * 0.31, 0.26);
        cat.add(knob);
      }
    }
    cat.position.set(-8.7, 0, 5.6);
    cat.rotation.y = Math.PI / 2 - 0.15;
    cat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.add(cat);
    this.addCollider(cat);
    this.interact(cat, {
      prompt: 'the card catalogue',
      onInteract: () => {
        this.playSound('paper');
        this.subtitle('Every drawer is labelled in your handwriting, at different ages.', 5);
      },
    });

    // ---------- the vault ----------
    const vaultMat = new THREE.MeshStandardMaterial({
      color: 0x4a4d52, roughness: 0.45, metalness: 0.8,
    });
    const vault = new THREE.Mesh(new THREE.BoxGeometry(1.24, 2.1, 0.14), vaultMat);
    vault.position.set(0, 1.05, -ROOM_D / 2 - 0.02);
    vault.castShadow = true;
    this.add(vault);
    this.addCollider(vault);
    this._vault = vault;
    // hinges and a wheel
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 10, 22), vaultMat);
    wheel.position.set(-0.25, 1.1, -ROOM_D / 2 + 0.09);
    this.add(wheel);
    this._wheel = wheel;
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.22),
      new THREE.MeshStandardMaterial({
        map: textTexture({ text: '· · · ·', width: 96, height: 128, font: '26px Georgia', color: '#c8e0c8', bg: '#242a26' }),
        roughness: 0.5,
      })
    );
    pad.position.set(0.42, 1.25, -ROOM_D / 2 + 0.08);
    this.add(pad);

    this._vaultOpen = false;
    this.interact(vault, {
      prompt: 'the records room',
      onInteract: () => {
        if (this._vaultOpen) return;
        this.game.ui.showKeypad({
          label: 'the records room',
          length: 4,
          onSubmit: (code) => {
            if (code === '4236') {
              this._vaultOpen = true;
              this.playSound('unlock');
              this.removeColliderOf(vault);
              this.game.interaction.remove(vault);
              this._vaultSlide = true;
              this.playSound('door');
              this.setObjective('what they kept of you');
              this.subtitle('The four figures. Of course. They were never a secret — only scattered.', 6);
            } else {
              this.playSound('wrong');
              this.subtitle('The records don’t lie. Read them again.', 5);
            }
          },
        });
      },
    });
    this.tick((dt) => {
      if (this._vaultSlide && vault.position.x > -1.35) {
        vault.position.x -= dt * 0.9;
        wheel.position.x = vault.position.x - 0.25;
        wheel.rotation.z += dt * 2.2;
      }
    });

    // ---------- beyond the vault ----------
    const cell = new THREE.Group();
    const cellMat = makeMat('concrete', { base: '#5a564c', repeat: [3, 3] });
    const cellFloor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.6), cellMat);
    cellFloor.rotation.x = -Math.PI / 2;
    cellFloor.position.set(0, 0.01, -ROOM_D / 2 - 2.4);
    this.add(cellFloor);
    this.addGround(cellFloor);
    this.addBlocker([-2.3, 0, -ROOM_D / 2 - 4.9], [2.3, 3, -ROOM_D / 2 - 4.6]);
    this.addBlocker([-2.4, 0, -ROOM_D / 2 - 4.9], [-2.1, 3, -ROOM_D / 2]);
    this.addBlocker([2.1, 0, -ROOM_D / 2 - 4.9], [2.4, 3, -ROOM_D / 2]);
    const cellCeil = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.6), cellMat);
    cellCeil.rotation.x = Math.PI / 2;
    cellCeil.position.set(0, CEIL - 0.3, -ROOM_D / 2 - 2.4);
    this.add(cellCeil);
    this.add(cell);
    const cellBulb = makeBulbLight({ y: CEIL - 0.55, intensity: 4.5, distance: 7, color: 0xf6e8c8 });
    cellBulb.position.set(0, 0, -ROOM_D / 2 - 2.4);
    this.add(cellBulb);

    const yourBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.46), cardMat);
    yourBox.position.set(-0.5, 0.2, -ROOM_D / 2 - 2.9);
    yourBox.rotation.y = 0.3;
    yourBox.castShadow = true;
    this.add(yourBox);
    const yourTag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.11),
      labelMatFor('yours')
    );
    yourTag.position.set(-0.42, 0.42, -ROOM_D / 2 - 2.67);
    yourTag.rotation.set(-0.5, 0.3, 0);
    this.add(yourTag);
    this.interact(yourBox, {
      prompt: 'the box with your name',
      onInteract: () => {
        this.playSound('clue');
        this.subtitle('You could open it. You will, one day. Not tonight.', 6);
      },
    });

    // walking deep into the records room completes the level
    this.tick(() => {
      if (this._vaultOpen && !this.isCompleted) {
        const p = s.game.player.position;
        if (p.z < -ROOM_D / 2 - 1.6) this.complete();
      }
    });

    // a floor plan of the dream, pinned to the west wall
    const plan = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.62),
      new THREE.MeshStandardMaterial({
        map: textTexture({
          text: 'floor plan — ten rooms\ndrawn from memory\n(not to scale. nothing is.)',
          width: 512, height: 352, font: 'italic 34px Georgia',
          color: '#3a3226', bg: '#cfc2a4',
        }),
        roughness: 0.85,
      })
    );
    plan.position.set(-ROOM_W / 2 + 0.12, 1.55, -0.8);
    plan.rotation.y = Math.PI / 2;
    this.add(plan);
    this.interact(plan, {
      prompt: 'the floor plan',
      onInteract: () => {
        this.subtitle('Ten rooms, drawn in pencil, corrected in pen, corrected again in something shakier.', 6);
      },
    });

    // ---------- spawn ----------
    this.spawn.position.set(-6.9, 0, -0.8);
    this.spawn.yaw = -Math.PI / 2; // down the middle aisle, faces of boxes both sides
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-ROOM_W / 2 + 0.3, 0, -ROOM_D / 2 - 4.7),
      new THREE.Vector3(ROOM_W / 2 - 0.3, 3, ROOM_D / 2 - 0.3)
    );
    this.setObjective('the stacks were expecting you');
  }

  _takeCard(cardKey, from) {
    this._readCards.add(cardKey);
    const cardDefs = {
      hallway: {
        title: 'index — the hallway',
        body: 'doors 203 to 212, and one at the end that finally opened.\nthe spare key waited where the flowers used to be.\nshe watered them every Sunday. you remembered.',
      },
      pool: {
        title: 'index — the pool',
        body: 'nobody ever watched you swim but her.\nwhen the water was let go at last, the deep end\nshowed its number: it had been 4 all along.',
      },
      street: {
        title: 'index — the street',
        body: 'three lamps came on at dusk. the one outside\nnumber 11 refused, and that was how you knew the house.\nthe key was under the stone that didn’t match.',
      },
      supermarket: {
        title: 'index — the supermarket',
        body: 'milk, bread, apples. and the sunflowers — the Sunday kind —\nstanding in a grey bucket in aisle 2,\nfacing the doors as if the sun might come in for them.',
      },
      house: {
        title: 'index — the house',
        body: 'supper before slippers. slippers before the wireless.\nand your room always last, so the dark never caught you.\nthe porch light was already gone by then.',
      },
      field: {
        title: 'index — the field',
        body: 'from the dead tree toward the fallen star,\npast where the horses drank. thirteen posts, then look down.\nthe ribbon in the tin was hers.',
      },
      platform: {
        title: 'index — the platform',
        body: 'the 23:47, and it did not stop.\nyou always chose the same place on every train:\ncarriage 3, seat 41. you memorised it so you wouldn’t look.',
      },
      theater: {
        title: 'index — the theater',
        body: 'the long summer, 1974. row F, seat 8.\nif you ever forget what F is worth,\ncount your way to it on your fingers.',
      },
    };
    const def = cardDefs[cardKey];
    const misfiled = (cardKey === 'pool' && from === 'the theater') ||
      (cardKey === 'theater' && from === 'the pool');
    this.giveNote({ id: `l9-${cardKey}`, title: def.title, body: def.body });
    if (misfiled && !this._saidMisfiled) {
      this._saidMisfiled = true;
      this.after(0.4, () =>
        this.subtitle('Filed under the wrong room. Whoever keeps these was tired, or crying.', 5.5));
    }
  }

  async debugSolve() {
    const byLabel = this._boxRefs;
    const ladderTo = async (label) => {
      this.debugInteract(this._ladder);
      // headless renders run below real time; hurry the roll, keep the handlers real
      this.game.engine.timeScale = 8;
      for (let i = 0; i < 40 && this._ladderAt !== label; i++) await this.debugWait(0.3);
      this.game.engine.timeScale = 1;
    };
    // the master card names the four figures
    this.debugInteract(this._master);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    // reachable facts first: sunflowers (aisle 2) and the misfiled
    // theater card sitting in "the pool"'s box (row F → 6)
    this.debugInteract(byLabel['the supermarket']);
    await this.debugWait(0.25);
    this.game.ui.closeModal();
    this.debugInteract(byLabel['the pool']);
    await this.debugWait(0.25);
    this.game.ui.closeModal();
    // the high shelves: first the nudge, then the ladder does its work
    this.debugInteract(byLabel['the platform']);   // too high — the nudge line
    await this.debugWait(0.2);
    await ladderTo('the platform');
    this.debugInteract(byLabel['the platform']);   // carriage 3
    await this.debugWait(0.25);
    this.game.ui.closeModal();
    await ladderTo('the theater');
    this.debugInteract(byLabel['the theater']);    // the pool's 4, misfiled
    await this.debugWait(0.25);
    this.game.ui.closeModal();
    // the vault: 4 (deep end) · 2 (sunflowers) · 3 (carriage) · 6 (row F)
    this.game.player.teleport(0, -ROOM_D / 2 + 1.6, Math.PI);
    await this.debugWait(0.2);
    this.debugInteract(this._vault);
    await this.debugWait(0.3);
    this.game.ui.submitKeypad('4236');
    await this.debugWait(1.0);
    this.game.player.teleport(0, -ROOM_D / 2 - 2.6, 0);
    await this.debugWait(0.7);
  }
}
