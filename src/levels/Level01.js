import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, textTexture } from '../core/textures.js';
import {
  makeDoor, makeWall, makeBulbLight, makeNoteProp, makeKeyProp,
  makeTable, makePictureFrame, makeDust, applyFog,
} from '../core/props.js';

// I — The Hallway
// Tutorial. A corridor from the building you grew up in, longer than it
// should be. Read the note, find the key where the flowers used to be,
// unlock the far door, walk through.

const LENGTH = 42;      // hallway runs from z=1 (back wall) to z=-LENGTH
const WIDTH = 2.7;
const HEIGHT = 3.0;

export default class Level01 extends LevelBase {
  static meta = {
    id: 1,
    numeral: 'I',
    title: 'The Hallway',
    mood: 'hallway',
    intro: 'This is the corridor of the building you grew up in. It is longer than it used to be.',
    outro:
      'The door at the end was never locked, back then.\n' +
      'Someone must have locked it after you left,\n' +
      'the way you close a book you don’t expect to read again.',
  };

  build() {
    const s = this;
    applyFog(this.scene, '#171310', 3, 30);

    // ---------- shell ----------
    const wallMat = makeMat('wallpaper', { base: '#b7a48e', stripe: '#a8927a', repeat: [6, 1.4] });
    const floorMat = makeMat('carpet', { base: '#6d5a58', repeat: [3, 24] });
    const ceilMat = makeMat('plaster', { base: '#b3aa97', repeat: [2, 16] });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a3d30, roughness: 0.7 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, LENGTH + 4), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -(LENGTH - 2) / 2);
    floor.receiveShadow = true;
    this.add(floor);
    this.addGround(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, LENGTH + 4), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, HEIGHT, -(LENGTH - 2) / 2);
    this.add(ceil);

    for (const side of [-1, 1]) {
      const wall = makeWall(0.2, HEIGHT, LENGTH + 4, wallMat);
      wall.position.set(side * (WIDTH / 2 + 0.1), HEIGHT / 2, -(LENGTH - 2) / 2);
      this.add(wall);
      this.addCollider(wall);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, LENGTH + 4), baseMat);
      skirt.position.set(side * (WIDTH / 2 - 0.02), 0.07, -(LENGTH - 2) / 2);
      this.add(skirt);
    }

    const backWall = makeWall(WIDTH + 0.4, HEIGHT, 0.2, wallMat);
    backWall.position.set(0, HEIGHT / 2, 1.1);
    this.add(backWall);
    this.addCollider(backWall);

    // end wall with doorway gap for the exit door
    const endZ = -LENGTH;
    for (const side of [-1, 1]) {
      const seg = makeWall((WIDTH - 1.0) / 2 + 0.2, HEIGHT, 0.2, wallMat);
      seg.position.set(side * (0.5 + ((WIDTH - 1.0) / 2 + 0.2) / 2), HEIGHT / 2, endZ);
      this.add(seg);
      this.addCollider(seg);
    }
    const lintel = makeWall(1.2, HEIGHT - 2.1, 0.2, wallMat);
    lintel.position.set(0, 2.1 + (HEIGHT - 2.1) / 2, endZ);
    this.add(lintel);

    // beyond the exit door: a dark landing that swallows you
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
    const landing = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), darkMat);
    landing.rotation.x = -Math.PI / 2;
    landing.position.set(0, 0, endZ - 4);
    this.add(landing);
    this.addGround(landing);
    this.addBlocker([-3.2, 0, endZ - 8.4], [3.2, 3, endZ - 8]);
    this.addBlocker([-3.2, 0, endZ - 8], [-2.8, 3, endZ]);
    this.addBlocker([2.8, 0, endZ - 8], [3.2, 3, endZ]);

    // ---------- lights ----------
    this.add(new THREE.HemisphereLight(0x8a7a66, 0x241d18, 0.5));
    for (let i = 0; i < 7; i++) {
      const z = -2 - i * 6;
      const bulb = makeBulbLight({ y: HEIGHT - 0.35, intensity: i === 5 ? 4 : 7, distance: 11 });
      bulb.position.set(0, 0, z);
      if (i === 2) bulb.light.castShadow = true;
      this.add(bulb);
      // the sixth bulb stutters — something is wrong down there
      if (i === 5) {
        let tNext = 0;
        this.tick((dt, t) => {
          if (t > tNext) {
            const on = Math.random() > 0.28;
            bulb.light.intensity = on ? 4 : 0.4;
            tNext = t + (on ? 0.15 + Math.random() * 1.8 : 0.04 + Math.random() * 0.14);
          }
        });
      }
    }

    this.add(makeDust({ count: 260, box: [2.4, 2.6, LENGTH], center: [0, 1.5, -LENGTH / 2] }));

    // ---------- decorative locked doors along the walls ----------
    const flavour = [
      'Locked. Behind it, water is running into a tub that never fills.',
      'Locked. You can hear a television playing a show you almost remember.',
      'Locked. Someone inside is humming the song your mother hummed.',
    ];
    let flavourIdx = 0;
    for (let i = 0; i < 5; i++) {
      for (const side of [-1, 1]) {
        if ((i + (side === 1 ? 0 : 1)) % 2) continue;
        const door = makeDoor({ color: i % 2 ? '#6a5340' : '#71583f' });
        door.position.set(side * (WIDTH / 2 - 0.02), 0, -5 - i * 7);
        door.rotation.y = side * Math.PI / 2;
        this.add(door);
        this.track(door);
        if (flavourIdx < flavour.length) {
          const line = flavour[flavourIdx++];
          this.interact(door, {
            prompt: 'try the door',
            onInteract: () => {
              this.playSound('locked');
              this.subtitle(line, 5);
            },
          });
        }
        // number plates
        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(0.13, 0.09),
          new THREE.MeshStandardMaterial({
            map: textTexture({
              text: String(203 + i * 2 + (side === 1 ? 0 : 1)),
              width: 128, height: 96, font: '44px Georgia', bg: '#8d7a55', color: '#2e2618',
            }),
            roughness: 0.5, metalness: 0.4,
          })
        );
        plate.position.set(side * (WIDTH / 2 - 0.13), 1.7, -5 - i * 7);
        plate.rotation.y = -side * Math.PI / 2;
        this.add(plate);
      }
    }

    // faded photographs between the doors
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 96;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 128, 96);
      g.addColorStop(0, '#9b9184');
      g.addColorStop(1, '#6e675c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 96);
      // figures too blurred to name
      ctx.fillStyle = 'rgba(60,55,48,0.55)';
      for (let f = 0; f < 2 + (i % 2); f++) {
        ctx.beginPath();
        ctx.ellipse(30 + f * 32, 52, 9, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(30 + f * 32, 32, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.filter = 'blur(2px)';
      ctx.drawImage(c, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const frame = makePictureFrame({ texture: tex, width: 0.42, height: 0.32 });
      const side = i % 2 ? 1 : -1;
      frame.position.set(side * (WIDTH / 2 - 0.04), 1.62, -8.5 - i * 8);
      frame.rotation.y = -side * Math.PI / 2;
      this.add(frame);
    }

    // ---------- the note ----------
    const table = makeTable({ w: 0.8, d: 0.42, h: 0.78 });
    table.position.set(-WIDTH / 2 + 0.35, 0, -4);
    this.add(table);
    this.addCollider(table);

    const note = makeNoteProp();
    note.position.set(-WIDTH / 2 + 0.35, 0.795, -4);
    this.add(note);
    this.interact(note, {
      prompt: 'read the note',
      onInteract: () => {
        this.giveNote({
          id: 'l1-note',
          title: 'a note in familiar handwriting',
          body:
            'We moved the spare key when you stopped visiting.\n\n' +
            'It’s where the flowers used to be.\n' +
            'You watered them every Sunday. Remember?\n\n' +
            '— M.',
        });
        this.setObjective('find the key, where the flowers used to be');
        this._readNote = true;
      },
    });

    // ---------- the pedestal with the dead flowers & key ----------
    const pedMat = makeMat('plaster', { base: '#9c937f', repeat: [1, 1] });
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.98, 0.34), pedMat);
    pedestal.position.set(WIDTH / 2 - 0.35, 0.49, -22);
    pedestal.castShadow = true;
    this.add(pedestal);
    this.addCollider(pedestal);

    // dry stems in a vase
    const vase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.045, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: 0x7e8894, roughness: 0.3 })
    );
    vase.position.set(WIDTH / 2 - 0.35, 1.06, -22);
    this.add(vase);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5c4f33, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.3, 5), stemMat);
      stem.position.set(
        WIDTH / 2 - 0.35 + (Math.random() - 0.5) * 0.06,
        1.25,
        -22 + (Math.random() - 0.5) * 0.06
      );
      stem.rotation.z = (Math.random() - 0.5) * 0.5;
      stem.rotation.x = (Math.random() - 0.5) * 0.5;
      this.add(stem);
    }

    const key = makeKeyProp();
    key.position.set(WIDTH / 2 - 0.38, 1.0, -21.8);
    this.add(key);
    this.interact(key, {
      prompt: 'take the brass key',
      once: true,
      onInteract: () => {
        key.visible = false;
        this.giveItem({ id: 'brass-key', name: 'a brass key, still warm' });
        this.setObjective('the door at the end of the hall');
        this.subtitle('It is warm, as if someone has just put it down.', 5);
      },
    });

    // ---------- the exit door ----------
    const exitDoor = makeDoor({ width: 1.0, color: '#4f3d2e', frameColor: '#3c2f24' });
    exitDoor.position.set(0, 0, endZ);
    this.add(exitDoor);
    this.track(exitDoor);
    this.addCollider(exitDoor.panel);
    this._exitDoor = exitDoor;
    this._exitOpen = false;

    this.interact(exitDoor, {
      prompt: 'the door at the end',
      onInteract: () => {
        if (this._exitOpen) return;
        if (this.hasItem('brass-key')) {
          this.playSound('unlock');
          this.removeItem('brass-key');
          exitDoor.setOpen(true, -1);
          this.removeColliderOf(exitDoor.panel);
          this._exitOpen = true;
          this.game.interaction.remove(exitDoor);
          this.setObjective('');
          this.subtitle('The lock remembers the key.', 4);
          this.playSound('door');
        } else {
          this.playSound('locked');
          this.subtitle(
            this._readNote
              ? 'Locked. The key is where the flowers used to be.'
              : 'Locked. There is a note on the table behind you.',
            5
          );
        }
      },
    });

    // walking through the open door finishes the level
    this.tick(() => {
      if (this._exitOpen && !this.isCompleted && this.game.player.position.z < endZ - 1.2) {
        this.complete();
      }
    });

    // ---------- spawn & bounds ----------
    this.spawn.position.set(0, 0, -1);
    this.spawn.yaw = 0; // facing down the hall (-z)
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-WIDTH / 2 + 0.3, 0, endZ - 8),
      new THREE.Vector3(WIDTH / 2 - 0.3, 3, 0.6)
    );

    this.setObjective('something is waiting at the end of the hall');
    this._note = note;
    this._key = key;
  }

  async debugSolve() {
    // read the note
    this.debugInteract(this._note);
    await this.debugWait(0.3);
    this.game.ui.closeModal();
    // take the key
    this.debugInteract(this._key);
    await this.debugWait(0.3);
    // unlock the door
    this.debugInteract(this._exitDoor);
    await this.debugWait(0.5);
    // walk through
    this.game.player.teleport(0, -LENGTH - 2, 0);
    await this.debugWait(0.5);
  }
}
