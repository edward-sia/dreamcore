import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat } from '../core/textures.js';
import { makeSky, makeNoteProp, makeDust, applyFog } from '../core/props.js';

// VI — The Field
// The field behind the last houses, at night. One dead tree, a rusted
// bathtub the horses drank from, a wire fence holding nothing back.
// M.'s rhyme waits in the scarecrow's coat pocket; walking it — tree,
// star, tub, thirteen posts along the wire — finds the tin you buried
// together. The small key inside opens the padlocked gate, and the
// dark past the fence does the rest.

const FENCE_Z = -30;                       // the wire runs along this line
const STILE_X = 3;                         // where the walked line meets the fence
const POST_GAP = 2;                        // a post every two metres
const GATE_X = 35.35;                      // centre of the gate opening
const MOUND_X = STILE_X + 13 * POST_GAP;   // post thirteen, toward the star
const TREE = new THREE.Vector3(-14, 0, 2);
const TUB = new THREE.Vector3(-4.65, 0, -15.6);   // on the tree→star line
const STAR = new THREE.Vector3(9.1, 0.95, -41.5); // the line, extended past the wire

export default class Level06 extends LevelBase {
  static meta = {
    id: 6,
    numeral: 'VI',
    title: 'The Field',
    mood: 'field',
    intro: 'This is the field behind the last houses. The summer you were eight, it went on forever.',
    outro:
      'The rhyme was hers. She made it so you couldn’t forget.\n' +
      'You forgot anyway. The field kept it for you —\n' +
      'thirteen posts along the wire, all these years.',
  };

  build() {
    applyFog(this.scene, '#282e44', 7, 58);
    this.add(makeSky({
      top: '#0f1428', mid: '#282e44', bottom: '#3e3e54',
      // no sun, no moon disc — the only star that matters fell years ago
    }));

    // ---------- night light ----------
    this.add(new THREE.HemisphereLight(0x63739c, 0x232720, 2.4));
    const moon = new THREE.DirectionalLight(0xa9bcdd, 3.2);
    moon.position.set(-26, 30, 4);
    this.add(moon);
    const counter = new THREE.DirectionalLight(0x3f4660, 1.4);
    counter.position.set(24, 12, 20);
    this.add(counter);

    // ---------- ground ----------
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 180),
      makeMat('grass', { base: '#39412f', repeat: [110, 90] })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(2, 0, -10);
    grass.receiveShadow = true;
    this.add(grass);
    this.addGround(grass);

    // tall grass — knee-high tufts leaning with a wind you can almost hear
    const bare = [
      [23, FENCE_Z + 0.58], [27, FENCE_Z + 0.58], [MOUND_X, FENCE_Z + 0.58],
      [31, FENCE_Z + 0.58], [-23, FENCE_Z + 0.58],
      [-19, -13], [13, -4], [-1, -25],
    ];
    this.add(this._tuftField(700, 0x36402b, bare));
    this.add(this._tuftField(520, 0x2f3726, bare));

    // fireflies, low over the grass
    const flies = makeDust({
      count: 90, box: [56, 1.5, 40], center: [4, 0.85, -8],
      size: 0.03, color: 0xffd98c,
    });
    flies.material.opacity = 0.5;
    this.add(flies);
    this.track(flies);
    this.tick((dt, t) => {
      flies.material.opacity = 0.38 + 0.18 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
    });

    // ---------- the last houses, asleep behind you ----------
    const silMat = new THREE.MeshStandardMaterial({ color: 0x272c3a, roughness: 1 });
    const houses = [
      [-18, 30.5, 7, 5.0, 5, 0.06, 0x2a3240],   // a cold window, television-blue
      [-2, 32.5, 8, 5.6, 5.5, -0.04, 0xffd9a2], // one window still warm — someone sitting up late
      [14, 29.5, 6.5, 4.7, 5, 0.1, 0x232a36],   // dark glass, nobody home
    ];
    for (const [x, z, w, h, d, rot, winColor] of houses) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), silMat);
      m.position.set(x, h / 2 - 0.2, z);
      m.rotation.y = rot;
      this.add(m);
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.75),
        new THREE.MeshStandardMaterial({
          color: 0x14110c, roughness: 0.5,
          emissive: winColor, emissiveIntensity: winColor === 0xffd9a2 ? 0.9 : 0.35,
        })
      );
      win.position.set(x - 0.6, 2.7, z - d / 2 - 0.09);
      win.rotation.y = Math.PI;
      this.add(win);
    }
    const winGlow = new THREE.PointLight(0xffd9a2, 2.2, 9, 2);
    winGlow.position.set(-2.6, 2.7, 29.2);
    this.add(winGlow);

    // hedgerows closing the field in east and west
    const hedgeMat = makeMat('grass', { base: '#333c2b', repeat: [8, 1] });
    const hedges = [
      [-26.5, -24, 14, 0.12], [-26.8, -6, 13, -0.08], [-26.4, 10, 12, 0.05],
      [42, -18, 15, -0.1], [42.3, 0, 13, 0.07], [42, 12, 11, -0.05],
    ];
    for (const [x, z, len, rot] of hedges) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, len), hedgeMat);
      h.position.set(x, 0.85, z);
      h.rotation.y = rot;
      this.add(h);
    }
    // a barn two fields over, keeping its own dark
    const barn = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 6.5), silMat);
    barn.position.set(-28.5, 1.5, -18);
    barn.rotation.y = 0.28;
    this.add(barn);

    // ---------- the dead tree ----------
    const tree = this._deadTree();
    tree.position.copy(TREE);
    this.add(tree);
    this.addCollider(tree.trunk);
    this.interact(tree, {
      prompt: 'the dead tree',
      onInteract: () => {
        if (!this._sawTree) {
          this._sawTree = true;
          this.learnClue({
            id: 'l6-tree',
            title: 'the tree that died',
            body:
              'From the dead tree, the fallen star hangs low past the fence,\n' +
              'and the horses’ bathtub lies along the way.\n' +
              'The rhyme is a line you can walk.',
          });
        }
        this.subtitle('It died the summer you were eight. From its foot, the fallen star sits low past the wire.', 6);
      },
    });

    // ---------- the scarecrow, and the rhyme ----------
    const scare = this._scarecrow();
    scare.position.set(1.2, 0, 5.5);
    scare.rotation.y = 0.35;
    this.add(scare);
    this.addCollider(scare);
    this.tick((dt, t) => { scare.rotation.z = 0.03 + 0.018 * Math.sin(t * 0.8); });
    this._scare = scare;
    this.interact(scare, {
      prompt: 'the coat pocket',
      onInteract: () => {
        this.giveNote({
          id: 'l6-rhyme',
          title: 'a rhyme in the coat pocket',
          body:
            'from the tree that died the summer you were eight,\n' +
            'toward the star that fell,\n' +
            'past where the horses drank,\n' +
            'then thirteen posts along the wire,\n' +
            'and look down.\n\n' +
            '— M.',
        });
        this._readRhyme = true;
        this.setObjective('the rhyme, walked');
      },
    });

    // ---------- the bathtub the horses drank from ----------
    const tub = this._bathtub();
    tub.position.copy(TUB);
    tub.rotation.y = Math.atan2(TREE.z - FENCE_Z, STILE_X - TREE.x); // lying on the walked line
    this.add(tub);
    this.addCollider(tub);
    this.interact(tub, {
      prompt: 'the bathtub',
      onInteract: () => {
        this.subtitle('Rainwater, black in the rust. The horses drank here, when there were horses.', 6);
      },
    });

    // ---------- the fence: posts, wire, stile ----------
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5d5348, roughness: 0.95 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x4b4f55, roughness: 0.5, metalness: 0.7 });
    for (let x = -27; x <= 41; x += POST_GAP) {
      if (x === STILE_X || x === 35) continue; // the stile, and the gate, keep their own posts
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.12, 0.09), postMat);
      post.position.set(x, 0.56, FENCE_Z);
      post.rotation.z = (Math.random() - 0.5) * 0.07;
      post.rotation.x = (Math.random() - 0.5) * 0.07;
      post.castShadow = post.receiveShadow = true;
      this.add(post);
    }
    for (const y of [0.44, 0.76, 1.05]) {
      const left = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 61.55, 5), wireMat);
      left.rotation.z = Math.PI / 2;
      left.position.set(3.775, y, FENCE_Z);
      this.add(left);
      const right = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 4.85, 5), wireMat);
      right.rotation.z = Math.PI / 2;
      right.position.set(38.575, y, FENCE_Z);
      this.add(right);
    }
    // nothing crosses the wire but the gate; the fence is one long refusal
    this.addBlocker([-28, 0, FENCE_Z - 0.18], [34.75, 1.5, FENCE_Z + 0.18]);
    this.addBlocker([35.95, 0, FENCE_Z - 0.18], [42, 1.5, FENCE_Z + 0.18]);

    // the stile, where the walked line meets the wire
    const stile = this._stile();
    stile.position.set(STILE_X, 0, FENCE_Z);
    this.add(stile);
    this.addCollider(stile);
    this.interact(stile, {
      prompt: 'the broken stile',
      onInteract: () => {
        this.subtitle('Rotted soft years ago. Nobody crossed here but you two.', 5);
      },
    });
    this.tick(() => {
      if (this._sawStile) return;
      const p = this.game.player.position;
      if (Math.hypot(p.x - STILE_X, p.z - FENCE_Z) < 5.5) {
        this._sawStile = true;
        this.learnClue({
          id: 'l6-stile',
          title: 'where the line meets the wire',
          body:
            'The line from the dead tree meets the fence at the rotten stile.\n' +
            'Thirteen posts on from here, toward the star. Then look down.',
        });
        this.subtitle('The walked line meets the wire at the broken stile. The counting starts here.', 6);
      }
    });

    // ---------- the star that fell ----------
    const starTex = this._glowTexture();
    const starMat = new THREE.SpriteMaterial({
      map: starTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const star = new THREE.Sprite(starMat);
    star.scale.set(3.8, 2.5, 1);
    star.position.copy(STAR);
    this.add(star);
    const starLight = new THREE.PointLight(0xffb26a, 9, 30, 1.8);
    starLight.position.set(STAR.x, 1.6, STAR.z);
    this.add(starLight);
    this.tick((dt, t) => {
      starMat.opacity = 0.82 + 0.12 * Math.sin(t * 1.9) + 0.04 * Math.sin(t * 5.3);
      starLight.intensity = 8.5 + 1.5 * Math.sin(t * 1.3);
    });

    // ---------- digging: mounds, patches, and the one that matters ----------
    const dirtMat = makeMat('carpet', { base: '#42372a', repeat: [1, 1], roughness: 1 });

    // bare mounds at the feet of posts — most of them are miscounts
    const wrongPosts = [23, 27, 31, -23]; // ten, twelve, fourteen — and thirteen counted the wrong way
    for (const x of wrongPosts) {
      const m = this._mound(dirtMat);
      m.position.set(x, 0, FENCE_Z + 0.58);
      this.add(m);
      this.interact(m, {
        prompt: 'dig',
        once: true,
        onInteract: () => {
          m.scale.y = 0.07;
          this.playSound('wrong');
          this.subtitle('You counted wrong. Or the field did.', 5);
        },
      });
    }

    // bare patches out in the grass — only earth
    for (const [x, z] of [[-19, -13], [13, -4], [-1, -25]]) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), dirtMat);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = Math.random() * Math.PI;
      p.scale.x = 1.15;
      p.position.set(x, 0.015, z);
      p.receiveShadow = true;
      this.add(p);
      this.interact(p, {
        prompt: 'dig',
        once: true,
        onInteract: () => {
          p.position.y = 0.005;
          this.playSound('switch');
          this.subtitle('Only earth, and the smell of rain.', 5);
        },
      });
    }

    // the true mound, at the foot of the thirteenth post. nothing marks it.
    const mound = this._mound(dirtMat);
    mound.position.set(MOUND_X, 0, FENCE_Z + 0.58);
    this.add(mound);
    this._mound13 = mound;

    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), dirtMat);
    heap.scale.set(1, 0.4, 0.8);
    heap.position.set(MOUND_X + 0.5, 0, FENCE_Z + 0.9);
    heap.visible = false;
    this.add(heap);

    const tin = this._tin();
    tin.position.set(MOUND_X, 0.07, FENCE_Z + 0.58);
    tin.rotation.y = 0.5;
    tin.rotation.z = 0.08;
    tin.visible = false;
    this.add(tin);
    this._tin = tin;

    this.interact(mound, {
      prompt: 'dig',
      once: true,
      onInteract: () => {
        mound.scale.y = 0.07;
        heap.visible = true;
        tin.visible = true;
        this.playSound('switch');
        this.subtitle('The earth gives easily, as if it had been waiting. A corner of rusted tin.', 6);
      },
    });

    this.interact(tin, {
      prompt: 'open the tin',
      once: true,
      onInteract: () => {
        tin.openLid();
        this.giveItem({ id: 'small-key', name: 'a small key, cold from the earth' });
        this.learnClue({
          id: 'l6-ribbon',
          title: 'a ribbon, blue once',
          body:
            'Folded under the key, out of the weather.\n' +
            'Hers. You put it back the way she folded it,\n' +
            'under where the key had been.',
        });
        this.subtitle('A small key. And a ribbon — hers. You wind it once around your finger, and put it back.', 7);
        this.setObjective('the gate in the wire');
      },
    });

    // ---------- the gate, and the dark past it ----------
    const gate = this._gate();
    gate.position.set(GATE_X, 0, FENCE_Z);
    this.add(gate);
    this.track(gate);
    this.addCollider(gate.pivot);
    this._gate = gate;
    this._gateOpen = false;

    this.interact(gate, {
      prompt: 'the padlocked gate',
      onInteract: () => {
        if (this._gateOpen) return;
        if (this.hasItem('small-key')) {
          this.playSound('unlock');
          this.removeItem('small-key');
          this.removeColliderOf(gate.pivot);
          gate.dropLock();
          gate.setOpen();
          this._gateOpen = true;
          this.game.interaction.remove(gate);
          this.setObjective('through the gate, into the dark');
          this.subtitle('The gate never kept anything in.', 5);
          this.playSound('door');
        } else {
          this.playSound('locked');
          this.subtitle(
            this._readRhyme
              ? 'Locked. The rhyme knows where the key sleeps.'
              : 'Locked. A padlock, rusted into its patience.',
            5
          );
        }
      },
    });

    // beyond the gate: a dark lane between hedges, going nowhere you can see
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
    const pocket = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.4), darkMat);
    pocket.rotation.x = -Math.PI / 2;
    pocket.position.set(GATE_X, 0.004, -33.55);
    this.add(pocket);
    this.addGround(pocket);
    const laneMat = new THREE.MeshStandardMaterial({ color: 0x20261c, roughness: 1 });
    for (const sx of [-1, 1]) {
      const laneHedge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 7), laneMat);
      laneHedge.position.set(GATE_X + sx * 2.75, 0.9, -33.5);
      this.add(laneHedge);
    }
    const farHedge = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.5, 1.2), laneMat);
    farHedge.position.set(GATE_X, 0.75, -36.9);
    this.add(farHedge);
    this.addBlocker([31.8, 0, -36.8], [33.3, 3, -29.9]);
    this.addBlocker([37.4, 0, -36.8], [38.9, 3, -29.9]);

    // walking through the open gate finishes the level
    this.tick(() => {
      if (this._gateOpen && !this.isCompleted) {
        const p = this.game.player.position;
        if (p.z < -31.8 && Math.abs(p.x - GATE_X) < 2.3) this.complete();
      }
    });

    // ---------- spawn & bounds ----------
    this.spawn.position.set(-2, 0, 14);
    this.spawn.yaw = 0; // facing out across the field (-z)
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-25, 0, -36.5),
      new THREE.Vector3(40, 4, 15.5)
    );
    this.setObjective('the scarecrow still wears the old coat');
  }

  // ---------- builders ----------

  /** Knee-high grass as one instanced sheaf of leaning blades. */
  _tuftField(count, color, exclude) {
    // a single tapering blade; instanced by the hundreds it reads as tall grass
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.05, 0, 0, 0.05, 0, 0, 0, 0.48, 0,
    ], 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 40) {
      const x = -36 + Math.random() * 82;
      const z = -40 + Math.random() * 56;
      if (x > 30.2 && z < -29.5) continue; // the dark past the gate stays bare
      if (exclude.some(([ex, ez]) => (x - ex) ** 2 + (z - ez) ** 2 < 1.1)) continue;
      p.set(x, 0, z);
      e.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      q.setFromEuler(e);
      sc.set(0.8 + Math.random() * 0.6, 0.55 + Math.random() * 0.9, 1);
      m.compose(p, q, sc);
      mesh.setMatrixAt(placed++, m);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** The tree that died the summer you were eight. */
  _deadTree() {
    const g = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({ color: 0x27221c, roughness: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.38, 3.4, 9), bark);
    trunk.position.y = 1.7;
    trunk.castShadow = trunk.receiveShadow = true;
    g.add(trunk);
    g.trunk = trunk;
    const branch = (y, yaw, tilt, len, r0, r1) => {
      const geo = new THREE.CylinderGeometry(r1, r0, len, 6);
      geo.translate(0, len / 2, 0);
      const b = new THREE.Mesh(geo, bark);
      b.position.set(0, y, 0);
      b.rotation.y = yaw;
      b.rotateZ(tilt);
      b.castShadow = true;
      g.add(b);
      return b;
    };
    branch(2.2, 0.3, 0.85, 1.9, 0.10, 0.03);
    branch(2.6, 2.4, 0.72, 1.7, 0.09, 0.025);
    branch(1.9, 4.2, 1.0, 1.5, 0.09, 0.03);
    branch(3.0, 5.3, 0.55, 1.5, 0.08, 0.02);
    branch(3.3, 1.5, 0.22, 1.3, 0.07, 0.02);
    branch(2.9, 3.4, 0.95, 1.1, 0.05, 0.015);
    // root flares, knuckling out of the grass
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const root = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.55), bark);
      root.position.set(Math.cos(a) * 0.42, 0.05, Math.sin(a) * 0.42);
      root.rotation.y = -a + Math.PI / 2;
      root.rotation.x = 0.18;
      g.add(root);
    }
    return g;
  }

  /** A scarecrow in an old coat, keeping nothing off the field. */
  _scarecrow() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x3d342a, roughness: 0.95 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x463a2f, roughness: 1 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.5, 8), wood);
    pole.position.y = 1.25;
    pole.castShadow = true;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), wood);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.72;
    const coat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.26), cloth);
    coat.position.y = 1.28;
    coat.castShadow = coat.receiveShadow = true;
    g.add(pole, bar, coat);
    for (const sx of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.18), cloth);
      sleeve.position.set(sx * 0.55, 1.7, 0);
      sleeve.rotation.z = sx * -0.12;
      sleeve.castShadow = true;
      g.add(sleeve);
    }
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a795d, roughness: 1 })
    );
    head.position.y = 2.02;
    head.castShadow = true;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 12), wood);
    brim.position.y = 2.14;
    brim.rotation.z = 0.1;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.17, 12), wood);
    crown.position.set(-0.012, 2.23, 0);
    crown.rotation.z = 0.1;
    g.add(head, brim, crown);
    // the pocket, and the note peeking from it
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.02), cloth);
    flap.position.set(0.11, 1.22, 0.14);
    g.add(flap);
    const note = makeNoteProp();
    note.rotation.x = Math.PI / 2 - 0.28;
    note.position.set(0.11, 1.34, 0.13);
    g.add(note);
    return g;
  }

  /** The rusted bathtub the horses drank from, half sunk in the grass. */
  _bathtub() {
    const g = new THREE.Group();
    const shellMat = makeMat('plaster', { base: '#8a877d', repeat: [2, 1], roughness: 0.75 });
    shellMat.side = THREE.DoubleSide;
    // a trough: a cylinder missing its top quarter, so the night can get in
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.34, 1.62, 16, 1, false, Math.PI * 0.75, Math.PI * 1.5),
      shellMat
    );
    shell.rotation.z = Math.PI / 2;
    shell.position.y = 0.3;
    shell.castShadow = shell.receiveShadow = true;
    g.add(shell);
    const rust = new THREE.MeshStandardMaterial({ color: 0x6e4c34, roughness: 0.8, metalness: 0.3 });
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.022, 8, 18), rust);
      rim.rotation.y = Math.PI / 2;
      rim.position.set(sx * 0.81, 0.3, 0);
      g.add(rim);
    }
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0e141b, roughness: 0.12, metalness: 0.5,
        emissive: 0x141c26, emissiveIntensity: 0.3,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.scale.set(0.72, 0.24, 1);
    water.position.y = 0.5;
    g.add(water);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), rust);
      foot.position.set(sx * 0.55, 0.02, sz * 0.26);
      g.add(foot);
    }
    return g;
  }

  /** The stile that used to cross the wire, gone soft with rot. */
  _stile() {
    const g = new THREE.Group();
    const pale = new THREE.MeshStandardMaterial({ color: 0x6b6152, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.35, 0.07), pale);
        leg.position.set(sx * 0.3, 0.62, sz * 0.1);
        leg.rotation.x = sz * -0.38;
        leg.castShadow = true;
        g.add(leg);
      }
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.045, 0.26), pale);
    top.position.y = 1.18;
    top.rotation.x = 0.08;
    top.castShadow = true;
    g.add(top);
    const stepNear = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.045, 0.24), pale);
    stepNear.position.set(0.02, 0.4, 0.5); // fallen at one end — the rot won
    stepNear.rotation.z = 0.5;
    stepNear.rotation.x = 0.1;
    g.add(stepNear);
    const stepFar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.045, 0.24), pale);
    stepFar.position.set(0, 0.52, -0.5);
    g.add(stepFar);
    return g;
  }

  /** A low mound of turned earth. They all look the same. That is the point. */
  _mound(dirtMat) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 9), dirtMat);
    m.scale.set(1, 0.27, 0.78);
    m.rotation.y = Math.random() * Math.PI;
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /** The rusted tin. Inside, the key — and the ribbon that stays. */
  _tin() {
    const g = new THREE.Group();
    const rust = new THREE.MeshStandardMaterial({ color: 0x6e4c34, roughness: 0.62, metalness: 0.55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.22), rust);
    body.position.y = 0.06;
    body.castShadow = true;
    g.add(body);
    const lidGeo = new THREE.BoxGeometry(0.34, 0.018, 0.22);
    lidGeo.translate(0, 0.009, 0.11);
    const lid = new THREE.Mesh(lidGeo, rust);
    lid.position.set(0, 0.12, -0.11);
    lid.castShadow = true;
    g.add(lid);
    const ribbon = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.014, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x5c6d80, roughness: 0.9 })
    );
    ribbon.rotation.x = Math.PI / 2;
    ribbon.scale.set(1, 1, 0.5);
    ribbon.position.set(-0.06, 0.075, 0.02);
    ribbon.visible = false;
    g.add(ribbon);
    g.openLid = () => {
      lid.rotation.x = -2.2;
      ribbon.visible = true;
    };
    return g;
  }

  /** The gate: two heavy posts, a frame of rails, and a padlock outliving its reasons. */
  _gate() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a4136, roughness: 0.9 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x54504a, roughness: 0.45, metalness: 0.8 });
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.35, 0.16), wood);
      post.position.set(sx * 0.8, 0.675, 0);
      post.castShadow = post.receiveShadow = true;
      g.add(post);
    }
    const pivot = new THREE.Group();
    pivot.position.set(-0.8, 0, 0);
    const rail = (y) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.07, 0.05), wood);
      r.position.set(0.8, y, 0);
      r.castShadow = true;
      pivot.add(r);
    };
    rail(1.0);
    rail(0.64);
    rail(0.28);
    for (const x of [0.08, 0.8, 1.52]) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 0.05), wood);
      v.position.set(x, 0.63, 0);
      v.castShadow = true;
      pivot.add(v);
    }
    const diag = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.055, 0.04), wood);
    diag.position.set(0.8, 0.63, 0.015);
    diag.rotation.z = 0.44;
    pivot.add(diag);
    // the padlock, and the hasp it holds shut
    const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.03), iron);
    hasp.position.set(1.5, 0.82, 0.035);
    pivot.add(hasp);
    const padlock = new THREE.Group();
    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.045), iron);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 8, 14), iron);
    shackle.position.y = 0.07;
    padlock.add(lockBody, shackle);
    padlock.position.set(1.5, 0.72, 0.05);
    pivot.add(padlock);
    g.add(pivot);
    g.pivot = pivot;

    let angle = 0, target = 0;
    g.setOpen = () => { target = Math.PI / 1.75; };
    g.dropLock = () => {
      g.add(padlock); // slips off the hasp into the grass
      padlock.position.set(0.62, 0.055, 0.34);
      padlock.rotation.set(Math.PI / 2, 0, 0.7);
    };
    g.update = (dt) => {
      angle += (target - angle) * Math.min(1, 2.4 * dt);
      pivot.rotation.y = angle;
    };
    return g;
  }

  /** Soft radial glow for the fallen star. */
  _glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,232,190,1)');
    grad.addColorStop(0.25, 'rgba(255,190,120,0.55)');
    grad.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  async debugSolve() {
    // read the rhyme in the scarecrow's pocket
    this.debugInteract(this._scare);
    await this.debugWait(0.35);
    this.game.ui.closeModal();
    await this.debugWait(0.2);
    // walk the rhyme: dig at the thirteenth post
    this.debugInteract(this._mound13);
    await this.debugWait(0.35);
    // open the tin, take the key, leave the ribbon
    this.debugInteract(this._tin);
    await this.debugWait(0.35);
    // unlock the gate
    this.debugInteract(this._gate);
    await this.debugWait(0.7);
    // walk through, into the dark
    this.game.player.teleport(GATE_X, -33.6);
    await this.debugWait(0.6);
  }
}
