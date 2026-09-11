import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import {
  makeSky, makeDoor, makeWater, makeNoteProp, makeKeyProp, makeValve,
  makeDust, applyFog,
} from '../core/props.js';

// X — The Shore
// First light on a grey beach. The tide has carried in pieces of every
// room: a stretch of hallway wall, the pool ladder, two theater seats.
// Three acts: find the relics, bring them home to a door standing alone
// in the sand, and walk through it to the water.

const WATERLINE = -40;      // z where the sand meets the sea
const DOOR_Z = -24;         // the door that has no wall

export default class Level10 extends LevelBase {
  static meta = {
    id: 10,
    numeral: 'X',
    title: 'The Shore',
    mood: 'shore',
    intro: 'The sea has been waiting all night, the way it waits at the end of every dream.',
    outro:
      'None of the doors were ever really locked.\n' +
      'You were only asked to remember where things were left,\n' +
      'and you remembered. You remembered all of it.',
  };

  build() {
    const s = this;

    // ---------- sky, fog, first light ----------
    applyFog(this.scene, '#a89d94', 8, 105);
    this.add(makeSky({
      top: '#4a5570', mid: '#8a8398', bottom: '#c9b6a4',
      sun: { position: new THREE.Vector3(0.1, 0.055, -1), color: '#f2e0c2', size: 0.045 },
    }));

    this.add(new THREE.HemisphereLight(0x9097a8, 0x5c544a, 2.2));
    const dawn = new THREE.DirectionalLight(0xe8d5b8, 2.6);
    dawn.position.set(4, 10, -30);
    this.add(dawn);
    const counter = new THREE.DirectionalLight(0x7d8496, 1.4);
    counter.position.set(-6, 8, 26);
    this.add(counter);

    // ---------- the beach ----------
    const sandMat = makeMat('carpet', { base: '#968972', repeat: [122.35, 196.15] });
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(520, 300), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0, 109); // keep the shoreline at -41; extend behind and beyond the fog
    sand.receiveShadow = true;
    this.add(sand);
    this.addGround(sand);

    // low dunes at the edges of the walk
    const duneMat = makeMat('carpet', { base: '#8d8069', repeat: [6, 4] });
    for (const [x, z, r, h] of [
      [-18, 1, 4.5, 0.38], [16, -3, 4, 0.34], [-13, -17, 3.6, 0.3],
      [19, -15, 4.5, 0.36], [-23, -9, 4, 0.32], [10, 8, 3.5, 0.26],
    ]) {
      const dune = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), duneMat);
      dune.scale.set(1, h / r, 0.8);
      dune.position.set(x, -0.05, z);
      this.add(dune);
      this.addGround(dune);
    }

    // the sea — still, patient, faintly moving
    const water = makeWater({ width: 520, depth: 300, color: 0x39474a, opacity: 0.96 });
    water.position.set(0, -0.1, WATERLINE - 150.2);
    this.add(water);
    this.track(water);

    // a thin brighter line where the water meets the sand
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 2.4),
      new THREE.MeshStandardMaterial({
        color: 0xd8cfc0, roughness: 1, transparent: true, opacity: 0.65,
      })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.012, WATERLINE + 0.4);
    this.add(foam);

    // driftwood, half-claimed
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4e443a, roughness: 0.95 });
    for (const [x, z, len, rot, tilt] of [
      [-7, -2, 2.6, 0.7, 0.06], [12, -12, 1.8, -0.4, -0.05],
      [-14, -12, 3.1, 1.9, 0.04], [5, 3, 1.4, 2.6, 0],
    ]) {
      const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, len, 7), woodMat);
      wood.rotation.set(Math.PI / 2 + tilt, 0, rot);
      wood.position.set(x, 0.1, z);
      wood.castShadow = true;
      this.add(wood);
    }

    // blown sand on the wind
    this.add(this.track(makeDust({
      count: 240, box: [50, 3.5, 40], center: [0, 1.6, -18],
      color: 0xd8cbb2, size: 0.014,
    })));

    // ---------- act 1: the relics ----------

    // — the hallway, what the tide kept of it —
    const hallGroup = new THREE.Group();
    const wallMat = makeMat('wallpaper', { base: '#b7a48e', stripe: '#a8927a', repeat: [2.2, 1.3] });
    const frag1 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.5, 0.18), wallMat);
    frag1.position.set(0, 1.1, 0);
    frag1.rotation.z = 0.05;
    const frag2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.18), wallMat);
    frag2.position.set(1.95, 0.75, 0.12);
    frag2.rotation.z = -0.09;
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.14, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x4a3d30, roughness: 0.7 })
    );
    skirt.position.set(0, 0.12, 0.1);
    hallGroup.add(frag1, frag2, skirt);
    for (const m of [frag1, frag2]) { m.castShadow = m.receiveShadow = true; }
    hallGroup.position.set(-10, 0, -8);
    hallGroup.rotation.y = 0.55;
    this.add(hallGroup);
    this.addCollider(frag1);
    this.addCollider(frag2);

    // the pedestal that held the flowers, dry stems and all
    const ped = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.9, 0.34),
      makeMat('plaster', { base: '#9c937f', repeat: [1, 1] })
    );
    ped.position.set(-8.6, 0.45, -6.9);
    ped.rotation.y = 0.3;
    ped.castShadow = true;
    this.add(ped);
    this.addCollider(ped);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5c4f33, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.26, 5), stemMat);
      stem.position.set(-8.6 + (Math.random() - 0.5) * 0.07, 1.02, -6.9 + (Math.random() - 0.5) * 0.07);
      stem.rotation.z = (Math.random() - 0.5) * 0.6;
      this.add(stem);
    }

    const note = makeNoteProp();
    note.position.set(-8.6, 0.905, -6.9);
    this.add(note);
    this._note = note;
    this.interact(note, {
      prompt: 'the last note',
      onInteract: () => {
        this.giveNote({
          id: 'l10-note',
          title: 'a note, pinned where the flowers used to be',
          body:
            'You kept the hallway. I kept the flowers.\n\n' +
            'The key is yours now. It always was.\n' +
            'Don’t be long.\n\n' +
            '— M.',
        }, () => {
          this._keyReady = true;
          this.game.interaction.setEnabled(this._key, true);
        });
        this.setObjective('the tide left things for you');
      },
    });

    const key = makeKeyProp();
    key.position.set(-8.55, 0.94, -6.75);
    key.rotation.z = 0.4;
    this.add(key);
    this._key = key;
    this.interact(key, {
      prompt: 'take the brass key',
      once: true,
      enabled: false,
      onInteract: () => {
        key.visible = false;
        this.giveItem({ id: 'relic-key', name: 'a brass key, cold now' });
        this.subtitle('Cold. No one has put it down warm for a long time.', 5);
        this._checkRelics();
      },
    });

    // — the pool ladder, and what the sand gave back —
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xb9c4c6, roughness: 0.25, metalness: 0.9,
    });
    const ladder = new THREE.Group();
    for (const sx of [-0.26, 0.26]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 10), chrome);
      rail.position.set(sx, 0.62, 0);
      rail.rotation.x = -0.5;
      ladder.add(rail);
      const curve = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 12, Math.PI / 2), chrome);
      curve.position.set(sx, 1.36, -0.36);
      curve.rotation.y = Math.PI / 2;
      ladder.add(curve);
    }
    for (let i = 0; i < 3; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 8), chrome);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.28 + i * 0.42, 0.16 - i * 0.23);
      ladder.add(rung);
    }
    ladder.position.set(2, 0, -12.5);
    ladder.rotation.y = -0.35;
    ladder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.add(ladder);
    this.addCollider(ladder);

    // the mound of sand the valve lets go
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 10), duneMat);
    mound.scale.set(1, 0.42, 0.85);
    mound.position.set(3.2, 0, -13.2);
    this.add(mound);
    this._mound = mound;

    const valve = makeValve({ color: 0x7c5a44 });
    valve.position.set(1.35, 0.35, -13.6);
    valve.rotation.y = 0.8;
    valve.rotation.x = 0.35;
    this.add(valve);
    this.track(valve);
    this._valve = valve;
    this.interact(valve, {
      prompt: 'turn the small valve',
      once: true,
      onInteract: () => {
        valve.spinBy(7);
        this.playSound('switch');
        this.subtitle('Somewhere under the beach, something lets go of its breath.', 5);
        this._sinkMound = true;
        this.after(1.1, () => {
          this.playSound('splash');
          this._tile.visible = true;
          this.game.interaction.setEnabled(this._tile, true);
        });
      },
    });

    // the tile from the deep end — the 4 still on it
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.022, 0.16),
      new THREE.MeshStandardMaterial({
        map: textTexture({
          text: '4', width: 128, height: 128,
          font: 'bold 74px Georgia', color: '#33544e', bg: '#9fc4c9',
        }),
        roughness: 0.3,
      })
    );
    tile.position.set(3.2, 0.09, -13.15);
    tile.rotation.y = 0.5;
    tile.visible = false;
    this.add(tile);
    this._tile = tile;
    this.interact(tile, {
      prompt: 'take the tile from the deep end',
      once: true,
      enabled: false,
      onInteract: () => {
        tile.visible = false;
        this.giveItem({ id: 'relic-tile', name: 'a tile from the deep end' });
        this.subtitle('Still cool. Water keeps what it is given.', 5);
        this._checkRelics();
      },
    });

    // — two theater seats, still folded toward a screen that is gone —
    const seatGroup = new THREE.Group();
    const plush = new THREE.MeshStandardMaterial({ color: 0x5e3038, roughness: 0.9 });
    const seatFrame = new THREE.MeshStandardMaterial({ color: 0x2e2622, roughness: 0.6, metalness: 0.4 });
    const mkSeat = (x) => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.46), plush);
      seat.position.set(x, 0.46, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.09), plush);
      back.position.set(x, 0.78, -0.24);
      back.rotation.x = -0.08;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.4), seatFrame);
      legL.position.set(x - 0.27, 0.23, -0.02);
      const legR = legL.clone();
      legR.position.x = x + 0.27;
      g.add(seat, back, legL, legR);
      return g;
    };
    const seat7 = mkSeat(-0.3);
    const seat8 = mkSeat(0.32);
    seatGroup.add(seat7, seat8);
    // the row letter, worn but readable — F, of course
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.09),
      new THREE.MeshStandardMaterial({
        map: textTexture({ text: 'F', width: 96, height: 80, font: 'bold 46px Georgia', color: '#d8cdb4', bg: '#3a332c' }),
        roughness: 0.6,
      })
    );
    plate.position.set(-0.62, 0.62, 0.02);
    plate.rotation.y = Math.PI / 2;
    seatGroup.add(plate);
    seatGroup.position.set(10, 0, -8);
    seatGroup.rotation.y = -0.5;
    seatGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.add(seatGroup);
    this.addCollider(seatGroup);

    this._seat8 = seat8;
    this.interact(seat8, {
      prompt: 'the seat the stub named',
      once: true,
      onInteract: () => {
        this.giveItem({ id: 'relic-ticket', name: 'a ticket for a film you can’t remember' });
        this.playSound('paper');
        this.subtitle('Folded under the cushion, the way you always kept it through the good part.', 5.5);
        this._checkRelics();
      },
    });
    this.interact(seat7, {
      prompt: 'the other seat',
      onInteract: () => {
        this.subtitle('Someone sat here beside you. The seat still leans a little toward yours.', 5.5);
      },
    });

    // ---------- act 2: the door in the sand ----------
    const door = makeDoor({ width: 1.0, color: '#5a6068', frameColor: '#3f434b' });
    door.position.set(0, 0, DOOR_Z);
    this.add(door);
    this.track(door);
    this.addCollider(door.panel);
    this._door = door;
    this._doorOpen = false;

    // no wall — only air that will not let you pass
    this.addBlocker([-85, 0, DOOR_Z - 0.3], [-0.62, 3.2, DOOR_Z + 0.2]);
    this.addBlocker([0.62, 0, DOOR_Z - 0.3], [85, 3.2, DOOR_Z + 0.2]);

    // the threshold stone with three hollows
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.16, 0.8),
      makeMat('concrete', { base: '#7d776c', repeat: [2, 1] })
    );
    stone.position.set(0, 0.08, DOOR_Z + 0.75);
    stone.receiveShadow = true;
    this.add(stone);
    this._stone = stone;
    const hollowMat = new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 1 });
    this._hollowFills = [];
    for (let i = 0; i < 3; i++) {
      const hollow = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 14), hollowMat);
      hollow.position.set(-0.45 + i * 0.45, 0.165, DOOR_Z + 0.78);
      this.add(hollow);
    }

    const RELICS = [
      { id: 'relic-key', fill: () => { const k = makeKeyProp(); k.scale.setScalar(0.8); return k; }, line: 'The key settles, and the hallway settles with it.' },
      { id: 'relic-tile', fill: () => new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.13), tile.material), line: 'The tile settles, and somewhere water goes still.' },
      { id: 'relic-ticket', fill: () => new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.008, 0.055), new THREE.MeshStandardMaterial({ color: 0xe4dcc4, roughness: 0.9 })), line: 'The ticket settles. The film can end now.' },
    ];
    this._placed = 0;

    this.interact(stone, {
      prompt: 'the three hollows',
      distance: 2.4,
      onInteract: () => {
        const held = RELICS.find((r) => this.hasItem(r.id));
        if (!held) {
          this.subtitle(
            this._placed === 0
              ? 'Three hollows, worn smooth. Nothing you carry yet would fit them.'
              : 'The hollows wait for the rest.',
            5
          );
          return;
        }
        this.removeItem(held.id);
        const fill = held.fill();
        fill.position.set(-0.45 + this._placed * 0.45, 0.19, DOOR_Z + 0.78);
        this.add(fill);
        this.playSound('pickup');
        this.subtitle(held.line, 4.5);
        this._placed++;
        if (this._placed === 3) this._openTheDoor();
      },
    });

    this.interact(door, {
      prompt: 'the door with no wall',
      onInteract: () => {
        if (this._doorOpen) return;
        this.playSound('locked');
        this.subtitle('It has no wall, and still it will not open. Three hollows wait at its foot.', 5.5);
      },
    });

    // ---------- act 3: the walk to the water ----------
    this._act3 = false;
    this._saidLines = 0;
    this.tick((dt) => {
      if (this._sinkMound && mound.scale.y > 0.02) {
        mound.scale.y = Math.max(0.02, mound.scale.y - 0.36 * dt);
        mound.position.y -= 0.12 * dt;
      }
      const p = s.game.player.position;
      if (this._doorOpen && !this._act3 && p.z < DOOR_Z - 0.6) {
        this._act3 = true;
        this.setObjective('the sea');
        this.subtitle('The beach goes on without the dream now.', 6);
      }
      if (this._act3) {
        // the fog lifts as you walk the last stretch
        const f = this.scene.fog;
        f.far += (170 - f.far) * (1 - Math.exp(-0.482 * dt));
        f.color.lerp(new THREE.Color('#c9bcab'), 1 - Math.exp(-0.361 * dt));
        this.scene.background.copy(f.color);
        const span = Math.abs(WATERLINE - (DOOR_Z - 0.6));
        const gone = Math.min(1, Math.abs(p.z - (DOOR_Z - 0.6)) / span);
        if (gone > 0.45 && this._saidLines < 1) {
          this._saidLines = 1;
          this.subtitle('You can keep them all. That was never the question.', 6);
        }
        if (gone > 0.8 && this._saidLines < 2) {
          this._saidLines = 2;
          this.subtitle('The water is the morning. Step in.', 6);
        }
        if (!this.isCompleted && p.z < WATERLINE + 0.8) {
          this.playSound('splash');
          this.complete();
        }
      }
    });

    // ---------- spawn & bounds ----------
    this.spawn.position.set(0, 0, 7);
    this.spawn.yaw = 0; // facing the relics, the door, the sea
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-26, 0, WATERLINE + 0.5),
      new THREE.Vector3(26, 4, 10)
    );
    this.setObjective('the tide has been busy');
  }

  _checkRelics() {
    const have =
      ['relic-key', 'relic-tile', 'relic-ticket'].filter((id) => this.hasItem(id)).length;
    const placedOrHeld = have + this._placed;
    if (placedOrHeld === 3 && this._placed < 3) {
      this.setObjective('the door in the sand');
      this.subtitle('Three things, home again. The door will want them.', 5.5);
    }
  }

  _openTheDoor() {
    this._doorOpen = true;
    this.playSound('unlock');
    this._door.setOpen(true, -1);
    this.removeColliderOf(this._door.panel);
    this.game.interaction.remove(this._door);
    this.playSound('door');
    this.setObjective('through');
    this.subtitle('The door opens itself, the way doors do when you are expected.', 6);
    // the light beyond leans in
    const glow = new THREE.PointLight(0xf2e2c4, 9, 16, 1.8);
    glow.position.set(0, 2.1, DOOR_Z - 2.5);
    this.add(glow);
  }

  async debugSolve() {
    // the last note, then the key
    this.debugInteract(this._note);
    await this.debugWait(0.35);
    this.game.ui.closeModal();
    await this.debugWait(0.2);
    this.debugInteract(this._key);
    await this.debugWait(0.25);
    // the valve, the sand, the tile
    this.debugInteract(this._valve);
    await this.debugWait(1.5);
    this.debugInteract(this._tile);
    await this.debugWait(0.25);
    // the seat the stub named
    this.debugInteract(this._seat8);
    await this.debugWait(0.25);
    // three placements at the threshold stone
    this.debugInteract(this._stone);
    await this.debugWait(0.3);
    this.debugInteract(this._stone);
    await this.debugWait(0.3);
    this.debugInteract(this._stone);
    await this.debugWait(0.8);
    // through the door, down to the water
    this.game.player.teleport(0, DOOR_Z - 2, 0);
    await this.debugWait(0.5);
    this.game.player.teleport(0, WATERLINE + 0.3, 0);
    await this.debugWait(0.8);
  }
}
