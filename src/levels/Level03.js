import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import { makeSky, makeDoor, makeKeyProp, makeDust, applyFog } from '../core/props.js';

// III — The Street
// The cul-de-sac at the hour the streetlights come on. Three lamps hum
// awake; the one outside number 11 refuses. The flag is up on the dark
// house's mailbox, one stone on its path doesn't match, and under it
// the house key has gone cold. Unlock the door, step into the hall.

const ROAD_HALF = 2.8;   // asphalt half-width
const FACE_X = 8.6;      // facades stand at ±FACE_X, looking at the road
const BULB_Z = -28.6;    // centre of the turning bulb
const BULB_R = 8.4;
const HOUSE_W = 6.6;
const HOUSE_H = 5.0;
const HOUSE_D = 4.2;
const GABLE = 1.8;

export default class Level03 extends LevelBase {
  static meta = {
    id: 3,
    numeral: 'III',
    title: 'The Street',
    mood: 'dusk',
    intro: 'This is the street where you lived. The lamps are coming on — all but one.',
    outro:
      'They never fixed the lamp outside number 11.\n' +
      'M. said she didn’t mind. You could see the stars from the porch, she said.\n' +
      'You believed her. You always believed her.',
  };

  build() {
    const s = this;
    applyFog(this.scene, '#665672', 7, 60);
    this.add(makeSky({
      top: '#232742', mid: '#5a4a63', bottom: '#c98d6a',
      sun: { position: new THREE.Vector3(-0.35, 0.07, -1), color: '#e8b27a', size: 0.05 },
    }));

    // ---------- ground: lawns, road, sidewalks ----------
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(190, 190),
      makeMat('grass', { base: '#4c5340', repeat: [95, 95] })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(0, 0, -14);
    lawn.receiveShadow = true;
    this.add(lawn);
    this.addGround(lawn);

    // the road and the turning bulb, joined as one poured shape
    const cy = -BULB_Z; // bulb centre in shape space (shape y = -world z)
    const dy = Math.sqrt(BULB_R * BULB_R - ROAD_HALF * ROAD_HALF);
    const roadShape = new THREE.Shape();
    roadShape.moveTo(-ROAD_HALF, -8);
    roadShape.lineTo(-ROAD_HALF, cy - dy);
    roadShape.absarc(0, cy, BULB_R, Math.atan2(-dy, -ROAD_HALF), Math.atan2(-dy, ROAD_HALF), true);
    roadShape.lineTo(ROAD_HALF, -8);
    roadShape.closePath();
    const road = new THREE.Mesh(
      new THREE.ShapeGeometry(roadShape, 48),
      makeMat('asphalt', { base: '#3f4046', repeat: [0.5, 0.5] }) // shape UVs are metres
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.02;
    road.receiveShadow = true;
    this.add(road);
    this.addGround(road);

    const walkMat = makeMat('concrete', { base: '#7b756b', repeat: [1, 20] });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x5e5b55, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 28.6), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(side * 3.5, 0.03, -5.9);
      walk.receiveShadow = true;
      this.add(walk);
      this.addGround(walk);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 28.6), curbMat);
      curb.position.set(side * 2.86, 0.045, -5.9);
      curb.receiveShadow = true;
      this.add(curb);
    }

    // a faded centre line, repainted by no one
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x7e7a6c, roughness: 0.9 });
    for (let z = 3; z > -19; z -= 4) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.5), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.035, z);
      this.add(dash);
    }

    // ---------- light: the last of the sun, and the lamps ----------
    this.add(new THREE.HemisphereLight(0x6b6390, 0x463a31, 2.3));
    // the east going grey — enough fill that the unlit sides keep their shape
    // (physical light units: small directional intensities vanish entirely)
    const eastAsh = new THREE.DirectionalLight(0x7c7899, 2.4);
    eastAsh.position.set(18, 14, 12);
    this.add(eastAsh);
    const northAsh = new THREE.DirectionalLight(0x5c5a74, 1.7);
    northAsh.position.set(-4, 10, -28); // shines southward, onto faces that look back up the street
    this.add(northAsh);
    const westGlow = new THREE.PointLight(0xc98d6a, 3.5, 40, 2);
    westGlow.position.set(-6, 7, BULB_Z - 4);
    this.add(westGlow);

    // ---------- the four houses ----------
    const homes = [
      { number: '7', side: -1, z: -6, base: '#7d7469', door: '#5d5148', wins: ['tv', 'dark', 'dark'] },
      { number: '9', side: 1, z: -6, base: '#6f6d75', door: '#564d4a', wins: ['dark', 'dark', 'warm'], chimney: true },
      { number: '11', side: -1, z: -20, base: '#77706b', door: '#5a4a3c', wins: ['dark', 'dark', 'dark'], hollow: true, chimney: true },
      { number: '13', side: 1, z: -20, base: '#736c6e', door: '#4f4a45', wins: ['warm', 'warm', 'dark'] },
    ];
    const doorLines = {
      '7': 'Locked. Inside, a television talks softly to no one.',
      '9': 'Locked. Somewhere upstairs a bath is running, and has been for a long time.',
      '13': 'Locked. Someone is humming behind the door — a tune you can almost place.',
    };
    const mailLines = {
      '7': 'Circulars, addressed to someone who spells your name wrong.',
      '9': 'A postcard with no message. Just the sea, and a bent corner.',
      '13': 'Empty, except for the cold.',
    };

    for (const h of homes) {
      const built = this._house(h);
      built.group.position.set(h.side * FACE_X, 0, h.z);
      built.group.rotation.y = -h.side * Math.PI / 2;
      this.add(built.group);
      for (const wall of built.colliders) this.addCollider(wall);
      for (const g of built.grounds) this.addGround(g);
      this.track(built.door);

      // the television in number 7 changes channels for no one
      if (built.tvMat) {
        const tv = built.tvMat;
        let tvNext = 0;
        this.tick((dt, t) => {
          if (t > tvNext) {
            tv.emissiveIntensity = 0.3 + Math.random() * 0.65;
            tvNext = t + 0.09 + Math.random() * 0.5;
          }
        });
      }

      // front doors
      if (h.hollow) {
        this._door11 = built.door;
        this.addCollider(built.door.panel);
        this.interact(built.door, {
          prompt: 'your front door',
          onInteract: () => {
            if (this._unlocked) return;
            if (this.hasItem('house-key')) {
              this.playSound('unlock');
              this.removeItem('house-key');
              built.door.setOpen(true, 1);
              this.removeColliderOf(built.door.panel);
              this._unlocked = true;
              this.game.interaction.remove(built.door);
              this.setObjective('the dark hall');
              this.subtitle('The key turns like no time has passed at all.', 4);
              this.playSound('door');
            } else {
              this.playSound('locked');
              this.subtitle(
                this._readNote
                  ? 'Locked. The stone that doesn’t match — it will still be there.'
                  : 'You lived here. The door doesn’t remember you yet.',
                5
              );
            }
          },
        });
      } else {
        this.interact(built.door, {
          prompt: 'the door of number ' + h.number,
          onInteract: () => {
            this.playSound('locked');
            this.subtitle(doorLines[h.number], 5);
          },
        });
      }

      // the front path: plain slabs, except the one laid with stones
      if (h.hollow) {
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x67635a, roughness: 0.95 });
        const paleMat = new THREE.MeshStandardMaterial({ color: 0xa79e8b, roughness: 0.9 });
        const jz = [-0.06, 0.07, -0.04, 0.06, -0.07];
        const jr = [0.14, -0.2, 0.09, -0.12, 0.18];
        for (let i = 0; i < 5; i++) {
          const isPale = i === 3;
          const stone = new THREE.Mesh(
            new THREE.BoxGeometry(isPale ? 0.66 : 0.6, 0.07, isPale ? 0.54 : 0.48),
            isPale ? paleMat : stoneMat
          );
          stone.position.set(h.side * (4.5 + i * 0.76), 0.065, h.z + jz[i]);
          stone.rotation.y = jr[i];
          stone.castShadow = stone.receiveShadow = true;
          this.add(stone);
          this.addGround(stone);
          if (isPale) this._paleStone = stone;
        }
        const key = makeKeyProp();
        key.position.set(h.side * (4.5 + 3 * 0.76) + 0.06, 0.05, h.z + jz[3]);
        key.visible = false;
        this.add(key);
        this._key = key;
        this.interact(this._paleStone, {
          prompt: 'look under the pale stone',
          once: true,
          onInteract: () => {
            this._paleStone.position.y += 0.16;
            this._paleStone.position.x += h.side * 0.2; // slid aside, toward the house
            this._paleStone.rotation.z += 0.55;
            this.playSound('switch');
            key.visible = true;
            this.subtitle('It gives the way it always gave. Dry earth, and a shape you know.', 5);
            this.setObjective('take the key beneath the stone');
          },
        });
        this.interact(key, {
          prompt: 'take the house key',
          once: true,
          onInteract: () => {
            key.visible = false;
            this.giveItem({ id: 'house-key', name: 'the house key, cold from the ground' });
            this.setObjective('the door under the dead lamp');
            this.subtitle('Cold. It has been waiting a long time.', 5);
          },
        });
      } else {
        const path = new THREE.Mesh(
          new THREE.PlaneGeometry(4.7, 0.95),
          makeMat('concrete', { base: '#807a6f', repeat: [4, 1] })
        );
        path.rotation.x = -Math.PI / 2;
        path.position.set(h.side * 6.45, 0.028, h.z);
        path.receiveShadow = true;
        this.add(path);
        this.addGround(path);
      }

      // the streetlamp by each path — three hum on; one refuses
      const lamp = this._lamp(!h.hollow);
      lamp.position.set(h.side * 3.55, 0, h.z - 1.6);
      this.add(lamp);
      this.addCollider(lamp.pole);
      if (h.number === '9') lamp.light.castShadow = true;
      if (h.hollow) {
        this._deadLamp = lamp;
      } else {
        this.track(this.add(makeDust({
          count: 60, box: [2.6, 3.2, 2.6],
          center: [h.side * 3.55, 2.1, h.z - 1.6],
          color: 0xffe6b8, size: 0.013,
        })));
      }

      // the letterbox at the path's mouth
      const box = this._mailbox(h.number, h.hollow);
      box.position.set(h.side * 4.55, 0, h.z + 0.95);
      this.add(box);
      this.addCollider(box);
      if (h.hollow) {
        this._mailbox11 = box;
        this.interact(box, {
          prompt: 'the flag is up',
          onInteract: () => {
            this.giveNote({
              id: 'l3-note',
              title: 'a note folded into the mailbox',
              body:
                'The porch light is out again.\n' +
                'I left the key where we always leave it —\n' +
                'under the stone that doesn’t match.\n\n' +
                'You could find it in the dark, once.\n\n' +
                '— M.',
            });
            this._readNote = true;
            if (!this.hasItem('house-key') && !this._unlocked) this.setObjective(this._key.visible ? 'take the key beneath the stone' : 'the stone that doesn’t match');
          },
        });
      } else {
        this.interact(box, {
          prompt: 'the mailbox of number ' + h.number,
          onInteract: () => {
            this.playSound('paper');
            this.subtitle(mailLines[h.number], 5);
          },
        });
      }
    }

    // the dead lamp remembers being a lamp, sometimes
    {
      const dead = this._deadLamp;
      let gaspAt = 4 + Math.random() * 5;
      let gaspEnd = 0;
      let flickNext = 0;
      this.tick((dt, t) => {
        if (t > gaspAt) {
          gaspEnd = t + 0.3 + Math.random() * 0.35;
          gaspAt = t + 6 + Math.random() * 7;
        }
        if (t < gaspEnd) {
          if (t > flickNext) {
            const on = Math.random() > 0.4;
            dead.light.intensity = on ? 1.4 : 0;
            dead.lanternMat.emissiveIntensity = on ? 0.9 : 0.04;
            flickNext = t + 0.04 + Math.random() * 0.08;
          }
        } else if (dead.light.intensity > 0) {
          dead.light.intensity = 0;
          dead.lanternMat.emissiveIntensity = 0.04;
        }
      });
    }

    // noticing the dark lamp is the way in
    let sawLamp = false;
    this.tick(() => {
      if (sawLamp) return;
      const p = s.game.player.position;
      if (Math.hypot(p.x + 3.55, p.z + 21.6) < 5.5) {
        sawLamp = true;
        this.learnClue({
          id: 'l3-lamp',
          title: 'the lamp that stays dark',
          body:
            'Three lamps came on at dusk. The one outside number 11 didn’t.\n' +
            'The dark house is the one that knows you.',
        });
        this.subtitle('The others hum. This one gave up the year you left.', 5);
      }
    });

    // walking into the dark hall finishes the level
    this.tick(() => {
      if (this._unlocked && !this.isCompleted) {
        const p = s.game.player.position;
        if (p.x < -(FACE_X + 1.0) && Math.abs(p.z + 20) < 1.2) this.complete();
      }
    });

    // ---------- what closes the evening in ----------
    const hedgeMat = makeMat('grass', { base: '#5b6547', repeat: [7, 1] });
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.16 + (0.68 * i) / 5);
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.9, 1.1), hedgeMat);
      hedge.position.set(Math.cos(a) * (BULB_R + 2.6), 0.95, BULB_Z - Math.sin(a) * (BULB_R + 2.6));
      hedge.rotation.y = a + Math.PI / 2;
      this.add(hedge);
    }
    const backHedge = new THREE.Mesh(new THREE.BoxGeometry(34, 1.7, 1.2), hedgeMat);
    backHedge.position.set(0, 0.85, 12.5);
    this.add(backHedge);

    // the next streets over, already asleep
    const silMat = new THREE.MeshStandardMaterial({ color: 0x262a36, roughness: 1 });
    const sils = [
      [-20, -9, 7, 6.2, 0.2], [21, -13, 8, 5.4, -0.15], [-22, -25, 9, 5.8, -0.1],
      [20, -27, 7, 6.6, 0.25], [-12, 21, 8, 5.6, 0.1], [11, 22, 7, 6.0, -0.2],
    ];
    for (const [x, z, w, ht, rot] of sils) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, ht, 6), silMat);
      m.position.set(x, ht / 2 - 0.2, z);
      m.rotation.y = rot;
      this.add(m);
    }

    // ---------- spawn & bounds ----------
    this.spawn.position.set(0, 0, 4.5);
    this.spawn.yaw = 0; // facing down the street (-z)
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-13.4, 0, -36.8),
      new THREE.Vector3(13.4, 4, 6.2)
    );
    this.setObjective('one of these houses was yours');
  }

  // ---------- builders ----------

  /** A near-identical suburban facade; the hollow one hides a dark hall. */
  _house({ number, base, door: doorColor, wins = ['dark', 'dark', 'dark'], hollow = false, chimney = false }) {
    const group = new THREE.Group();
    const colliders = [];
    const grounds = [];

    const siding = makeMat('wood', { base, repeat: [3.3, 2.5] });
    const gableMat = makeMat('wood', { base, repeat: [0.5, 0.5] }); // extrude UVs are metres
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x322d2b, roughness: 0.92 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.8 });

    if (hollow) {
      // the front wall parts around a real doorway; the rest encloses a hall
      const parts = [
        [2.78, HOUSE_H, 0.24, 1.91, HOUSE_H / 2, -0.12],
        [2.78, HOUSE_H, 0.24, -1.91, HOUSE_H / 2, -0.12],
        [1.04, HOUSE_H - 2.14, 0.24, 0, 2.14 + (HOUSE_H - 2.14) / 2, -0.12],
        [0.24, HOUSE_H, HOUSE_D, 3.18, HOUSE_H / 2, -HOUSE_D / 2],
        [0.24, HOUSE_H, HOUSE_D, -3.18, HOUSE_H / 2, -HOUSE_D / 2],
        [HOUSE_W, HOUSE_H, 0.24, 0, HOUSE_H / 2, -HOUSE_D + 0.12],
      ];
      for (const [w, ht, d, x, y, z] of parts) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), siding);
        wall.position.set(x, y, z);
        wall.castShadow = wall.receiveShadow = true;
        group.add(wall);
        colliders.push(wall);
      }
      // the hall itself: a black pocket the evening cannot reach
      const dark = new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 1 });
      const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.9), dark);
      hallFloor.rotation.x = -Math.PI / 2;
      hallFloor.position.set(0, 0.02, -2.05);
      group.add(hallFloor);
      grounds.push(hallFloor);
      const hallCeil = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 2.5), dark);
      hallCeil.position.set(0, 3.0, -1.25);
      group.add(hallCeil);
      const divider = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.6, 0.12), dark);
      divider.position.set(0, 2.3, -2.35);
      group.add(divider);
      colliders.push(divider);
      for (const sx of [-1, 1]) {
        const liner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.6, 2.3), dark);
        liner.position.set(sx * 1.72, 2.3, -1.2);
        group.add(liner);
        colliders.push(liner);
      }
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W, HOUSE_H, HOUSE_D), siding);
      body.position.set(0, HOUSE_H / 2, -HOUSE_D / 2);
      body.castShadow = body.receiveShadow = true;
      group.add(body);
      colliders.push(body);
    }

    // foundation line, so the house sits into the lawn
    const found = new THREE.Mesh(
      new THREE.BoxGeometry(HOUSE_W + 0.3, 0.24, HOUSE_D + 0.3),
      new THREE.MeshStandardMaterial({ color: 0x55514a, roughness: 1 })
    );
    found.position.set(0, 0.12, -HOUSE_D / 2);
    found.receiveShadow = true;
    group.add(found);

    // gable roof: a triangle extruded the depth of the house
    const tri = new THREE.Shape();
    tri.moveTo(-HOUSE_W / 2 - 0.25, 0);
    tri.lineTo(HOUSE_W / 2 + 0.25, 0);
    tri.lineTo(0, GABLE);
    tri.closePath();
    const roof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(tri, { depth: HOUSE_D + 0.5, bevelEnabled: false }),
      [gableMat, roofMat]
    );
    roof.position.set(0, HOUSE_H, -HOUSE_D - 0.25);
    roof.castShadow = true;
    group.add(roof);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W + 0.5, 0.14, 0.12), trimMat);
    fascia.position.set(0, HOUSE_H - 0.02, 0.08);
    group.add(fascia);

    if (chimney) {
      const chim = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.7, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x4e3a33, roughness: 0.95 })
      );
      chim.position.set(1.9, HOUSE_H + 0.7, -2.9);
      chim.castShadow = true;
      group.add(chim);
    }

    // the front door on its shallow porch
    const door = makeDoor({ width: 1.0, height: 2.1, color: doorColor, frameColor: '#3a332c' });
    door.position.set(0, 0, hollow ? 0.03 : 0.06);
    group.add(door);
    const porch = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.09, 1.3),
      makeMat('concrete', { base: '#6e6960', repeat: [2, 1] })
    );
    porch.position.set(0, 0.045, 0.62);
    porch.receiveShadow = true;
    group.add(porch);
    grounds.push(porch);

    // number plaque beside the door
    const plaqueTex = textTexture({
      text: number, width: 128, height: 96,
      font: 'bold 60px Georgia', bg: '#43403a', color: '#e6d9b8',
    });
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.18),
      new THREE.MeshStandardMaterial({
        map: plaqueTex, roughness: 0.5, metalness: 0.3,
        emissive: 0xfff2cf, emissiveIntensity: 0.32, emissiveMap: plaqueTex,
      })
    );
    plaque.position.set(0.74, 2.02, 0.05);
    group.add(plaque);

    // windows: warm where someone still is, dark where no one waits
    const winDark = new THREE.MeshStandardMaterial({
      color: 0x11141c, roughness: 0.25, metalness: 0.35,
      emissive: 0x46506b, emissiveIntensity: 0.12,
    });
    let tvMat = null;
    const winMat = (kind) => {
      if (kind === 'warm') {
        return new THREE.MeshStandardMaterial({
          color: 0x1c150e, roughness: 0.5, emissive: 0xffd9a0, emissiveIntensity: 0.9,
        });
      }
      if (kind === 'tv') {
        tvMat = new THREE.MeshStandardMaterial({
          color: 0x10131a, roughness: 0.4, emissive: 0xaebfd8, emissiveIntensity: 0.55,
        });
        return tvMat;
      }
      return winDark;
    };
    this._window(group, trimMat, -2.05, 1.72, 0, 1.15, 1.35, winMat(wins[0]));
    this._window(group, trimMat, 2.05, 1.72, 0, 1.15, 1.35, winMat(wins[1]));
    this._window(group, trimMat, 0, HOUSE_H + 0.78, 0.25, 0.72, 0.92, winMat(wins[2]));

    return { group, colliders, grounds, door, tvMat };
  }

  /** Sash window with frame, mullions and a sill. */
  _window(group, trimMat, x, y, z, w, h, glassMat) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.08), trimMat);
    frame.position.set(x, y, z);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    glass.position.set(x, y, z + 0.05);
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.02), trimMat);
    mullV.position.set(x, y, z + 0.06);
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, 0.02), trimMat);
    mullH.position.set(x, y, z + 0.06);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.06, 0.14), trimMat);
    sill.position.set(x, y - h / 2 - 0.1, z + 0.02);
    group.add(frame, glass, mullV, mullH, sill);
  }

  /** A residential streetlamp. Lit ones hum steady and warm. */
  _lamp(lit) {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.6, metalness: 0.7 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.7, 10), metal);
    pole.position.y = 1.85;
    pole.castShadow = true;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10), metal);
    collar.position.y = 0.08;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.24), metal);
    plate.position.y = 3.72;
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0x1c1712, emissive: 0xffd9a4, emissiveIntensity: lit ? 2.6 : 0.04,
    });
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.26, 0.17), lanternMat);
    lantern.position.y = 3.88;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 4), metal);
    cap.position.y = 4.06;
    cap.rotation.y = Math.PI / 4;
    const light = new THREE.PointLight(0xffc88e, lit ? 13 : 0, 16, 1.8);
    light.position.y = 3.82;
    g.add(pole, collar, plate, lantern, cap, light);
    g.light = light;
    g.pole = pole;
    g.lanternMat = lanternMat;
    return g;
  }

  /** A tin letterbox on a wooden post. The flag is up where mail waits. */
  _mailbox(number, flagUp) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
    const tin = new THREE.MeshStandardMaterial({ color: 0x565a5e, roughness: 0.45, metalness: 0.6 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.09), wood);
    post.position.y = 0.5;
    post.castShadow = true;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.24), tin);
    body.position.y = 1.13;
    body.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.26), tin);
    lid.position.y = 1.28;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.11),
      new THREE.MeshStandardMaterial({
        map: textTexture({
          text: number, width: 128, height: 88,
          font: 'bold 52px Georgia', bg: '#3a372f', color: '#d8d0bd',
        }),
        roughness: 0.6,
      })
    );
    plate.position.set(0, 1.13, 0.125);
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.2, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x93392f, roughness: 0.7 })
    );
    if (flagUp) {
      flag.position.set(0.24, 1.34, 0.1);
    } else {
      flag.rotation.z = Math.PI / 2;
      flag.position.set(0.19, 1.2, 0.1);
    }
    g.add(post, body, lid, plate, flag);
    return g;
  }

  async debugSolve() {
    // read M.'s note in the mailbox under the dead lamp
    this.debugInteract(this._mailbox11);
    await this.debugWait(0.4);
    this.game.ui.closeModal();
    await this.debugWait(0.2);
    // tip the pale stone, take the key beneath it
    this.debugInteract(this._paleStone);
    await this.debugWait(0.4);
    this.debugInteract(this._key);
    await this.debugWait(0.3);
    // unlock the front door and step into the dark hall
    this.debugInteract(this._door11);
    await this.debugWait(0.7);
    this.game.player.teleport(-10.6, -20);
    await this.debugWait(0.6);
  }
}
