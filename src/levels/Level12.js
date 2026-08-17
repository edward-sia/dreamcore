import * as THREE from 'three';
import { LevelBase } from '../core/LevelBase.js';
import { makeMat, chalkTexture } from '../core/textures.js';
import { makeDoor, makeWall, makeBulbLight, makeSign, makeDust, applyFog } from '../core/props.js';

// XII — The Stairwell
// A dog-leg fire stair that repeats −1, −2, −3. Footsteps one flight below
// that stop when you stop. Chalk on the −2 landing: a tally, and "wait for
// me". Stand still long enough and it comes up the last flight, and a door
// opens, and there is nobody there.
// Design: docs/superpowers/specs/2026-08-16-rooms-xi-xv-design.md §5.2

const FLOOR_H = 2.72, HALF_H = 1.36, RISE = 0.17, RUN = 0.28, STEPS = 8;
const X0 = -3.2, X1 = 3.2, MAIN_X1 = -1.0, HALF_X0 = 1.24, ZW = 1.3;   // shaft plan

const LANDINGS = [
  { label: '2', y: 0 }, { label: '1', y: -2.72 }, { label: 'G', y: -5.44 },
  { label: '−1', y: -8.16 }, { label: '−2', y: -10.88 }, { label: '−3', y: -13.6 },
  { label: '−1', y: -16.32 }, { label: '−2', y: -19.04 },
];
const LAST = LANDINGS.length - 1;

const LOOP_Y = -20.5;            // foot height that teleports you up three floors
const LOOP_DY = 3 * FLOOR_H;
const STUB_X0 = -8.2;            // west end of a stub corridor
const STUB_END_X = -7.7;         // threshold inside an opened stub
const SHAFT_TOP = 3.1, SHAFT_BOT = -24.7;
// makeDoor tints its wood map with `color` and then multiplies the material
// colour by it again, so a hex goes on twice. These are the square roots of
// the spec's '#4f5a5e' and a warm wardrobe brown — they render as those.
const DOOR_COLOR = '#8f979b', BACK_COLOR = '#917759';
const GRADE = { vignette: 1.3, grain: 0.038, desat: 0.2, lift: 0.02, fringe: 0.0007 };

export default class Level12 extends LevelBase {
  static meta = {
    id: 12,
    numeral: 'XII',
    title: 'The Stairwell',
    mood: 'stairwell',
    grade: GRADE,
    intro: 'The stairs go down further than the building does.',
    outro:
      'You stopped, and it caught up,\n' +
      'and nothing happened, except that a door opened.\n' +
      'That was all it ever wanted: for you to stop.',
  };

  build() {
    applyFog(this.scene, '#0c0c0f', 1, 12);

    this._concrete = makeMat('concrete', { base: '#7a766f', repeat: [2, 2] });
    this._shaftMat = makeMat('concrete', { base: '#726e68', repeat: [3, 10] });
    this._floorMat = makeMat('concrete', { base: '#5e5b55', repeat: [1, 1] });
    this._stepMat = makeMat('concrete', { base: '#6f6b63', repeat: [1, 1] });
    // painted steel, not bare metal: there is no environment map in this room,
    // so anything with a high metalness renders black
    this._railMat = new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.42, metalness: 0.18 });
    this._lockerMat = new THREE.MeshStandardMaterial({ color: 0x79817f, roughness: 0.6, metalness: 0.2 });

    // puzzle state (never `this._loops` — LevelBase keeps its audio loops there)
    this._loopCount = 0;
    this._pleaded = 0;
    this._doors = [];
    this._stubLights = [];
    this._bulbs = [];
    this._gated = [];
    this._seenOffs = [];
    this._chalk = chalkTexture({ tally: 1, lines: ['wait for me'] });
    this._chalkClue = {
      id: 'l12-chalk',
      title: 'chalk on the −2 landing',
      body: '1 stroke. and, underneath: wait for me.',
    };

    this.add(new THREE.HemisphereLight(0x5c6068, 0x16181c, 0.6));
    // the air of the shaft: motes that only show where a bulb reaches
    const dust = makeDust({
      count: 420, size: 0.013,
      box: [6.2, SHAFT_TOP - SHAFT_BOT, 2.4],
      center: [0, (SHAFT_TOP + SHAFT_BOT) / 2, 0],
    });
    this.add(dust);
    this.track(dust);

    LANDINGS.forEach((L, i) => this._buildFloor(i, L));

    // Below the last landing the shaft keeps going, unlit, so nothing bottoms
    // out in view. The loop catches the player long before they get down here.
    this._buildFlights(LANDINGS[LAST].y);
    this._landingSlab(LANDINGS[LAST].y - FLOOR_H);
    this._buildFlights(LANDINGS[LAST].y - FLOOR_H);
    this._landingSlab(LANDINGS[LAST].y - 2 * FLOOR_H);
    // and a blocker across the north flight below the last half-landing, for
    // after the loop is switched off. It sits west of where the loop fires.
    this.addBlocker([-1.1, LANDINGS[LAST].y - 2.9, -0.05], [0.5, LANDINGS[LAST].y + 0.04, ZW + 0.1]);

    this._buildShell();
    this._updateWindowLights();
    this._wireLightBudget();
    this._wirePuzzle();

    this.spawn.position.set(-2.1, 0, 0);
    this.spawn.yaw = -Math.PI / 2;                       // facing +X, down the first flight
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-8.4, SHAFT_BOT, -1.5),
      new THREE.Vector3(3.4, SHAFT_TOP, 1.5)
    );
    this.setObjective('down');
  }

  // ---------- geometry helpers ----------

  _box(w, h, d, mat, x, y, z, { collide = true, ground = false } = {}) {
    const m = makeWall(w, h, d, mat);
    m.position.set(x, y, z);
    this.add(m);
    if (collide) this.addCollider(m, { alsoGround: ground });
    else if (ground) this.addGround(m);
    return m;
  }

  /** The main (west) landing slab whose top face is at `y`. */
  _landingSlab(y) {
    return this._box(MAIN_X1 - X0, 0.2, ZW * 2, this._floorMat,
      (X0 + MAIN_X1) / 2, y - 0.1, 0, { ground: true });
  }

  /**
   * A sloped handrail 0.95 m over one flight's nosings. Visual only — the
   * well is closed by a blocker. On the well side it stands on balusters; on
   * the wall side (`wall` = the direction of the wall) it hangs off brackets.
   * These rails are the only part of a flight that a standing player sees
   * without looking down, so they are what says "stairs" from a landing.
   */
  _handrail(xa, ya, xb, yb, z, { wall = 0 } = {}) {
    const len = Math.hypot(xb - xa, yb - ya) + 0.1;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), this._railMat);
    rail.position.set((xa + xb) / 2, (ya + yb) / 2 + 0.95, z);
    rail.rotation.z = Math.atan2(yb - ya, xb - xa);
    this.add(rail);
    const n = wall ? 2 : 3;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const stay = new THREE.Mesh(
        wall ? new THREE.BoxGeometry(0.035, 0.035, 0.18) : new THREE.BoxGeometry(0.035, 0.95, 0.035),
        this._railMat
      );
      stay.position.set(
        xa + (xb - xa) * f,
        ya + (yb - ya) * f + (wall ? 0.95 : 0.475),
        z + wall * 0.09
      );
      this.add(stay);
    }
  }

  /** The two half-flights below a main landing at `y`, around an east half-landing. */
  _buildFlights(y) {
    // south flight (z −1.3..0): eight steps east and down, main landing → half-landing
    for (let k = 0; k < STEPS; k++) {
      const top = y - RISE * (k + 1);
      this._box(RUN, 0.6, ZW, this._stepMat,
        MAIN_X1 + RUN * (k + 0.5), top - 0.3, -ZW / 2, { ground: true });
    }
    // the half-landing on the east
    this._box(X1 - HALF_X0, 0.2, ZW * 2, this._floorMat,
      (X1 + HALF_X0) / 2, y - HALF_H - 0.1, 0, { ground: true });
    // north flight (z 0..1.3): eight steps west and down, half-landing → next landing
    for (let k = 0; k < STEPS; k++) {
      const top = y - HALF_H - RISE * (k + 1);
      this._box(RUN, 0.6, ZW, this._stepMat,
        HALF_X0 - RUN * (k + 0.5), top - 0.3, ZW / 2, { ground: true });
    }
    // handrails down both edges of each flight: the well side and the wall
    this._handrail(MAIN_X1, y, HALF_X0, y - HALF_H, -0.07);
    this._handrail(HALF_X0, y - HALF_H, MAIN_X1, y - FLOOR_H, 0.07);
    this._handrail(MAIN_X1, y, HALF_X0, y - HALF_H, -ZW + 0.09, { wall: -1 });
    this._handrail(HALF_X0, y - HALF_H, MAIN_X1, y - FLOOR_H, ZW - 0.09, { wall: 1 });
    // the well between the flights stays open, the way a dog-leg stair's is —
    // it is how you see the stairs continue. _buildShell puts an invisible
    // sheet down it so you cannot step across.
  }

  /** Outer walls, ceiling, and the west wall above and below the labelled floors. */
  _buildShell() {
    const height = SHAFT_TOP - SHAFT_BOT, midY = (SHAFT_TOP + SHAFT_BOT) / 2;
    this._box(0.2, height, ZW * 2 + 0.4, this._shaftMat, X1 + 0.1, midY, 0);                 // east
    this._box(X1 - X0 + 0.4, height, 0.2, this._shaftMat, 0, midY, ZW + 0.1);                // north
    this._box(X1 - X0 + 0.4, height, 0.2, this._shaftMat, 0, midY, -ZW - 0.1);               // south
    this._box(X1 - X0 + 0.4, 0.2, ZW * 2 + 0.4, this._concrete, 0, SHAFT_TOP - 0.1, 0, { collide: false });
    // west wall above the top landing and below the last one — the per-floor
    // pieces cover everything between
    const topCap = SHAFT_TOP - (LANDINGS[0].y + FLOOR_H);
    this._box(0.2, topCap, ZW * 2, this._concrete, X0 - 0.1, LANDINGS[0].y + FLOOR_H + topCap / 2, 0);
    const botH = LANDINGS[LAST].y - SHAFT_BOT;
    this._box(0.2, botH, ZW * 2, this._concrete, X0 - 0.1, LANDINGS[LAST].y - botH / 2, 0);
    // the well: you can see down it, you cannot step across it
    this.addBlocker([MAIN_X1 + 0.05, SHAFT_BOT, -0.06], [HALF_X0 - 0.05, SHAFT_TOP, 0.06]);
  }

  // ---------- one floor ----------

  _buildFloor(i, L) {
    const y = L.y;
    this._landingSlab(y);
    if (i < LAST) this._buildFlights(y);

    // west wall around a door opening 0.95 wide, 2.1 high, centred on z 0
    const wallX = X0 - 0.1, jamb = ZW - 0.475;
    this._box(0.2, FLOOR_H, jamb, this._concrete, wallX, y + FLOOR_H / 2, -(0.475 + jamb / 2));
    this._box(0.2, FLOOR_H, jamb, this._concrete, wallX, y + FLOOR_H / 2, (0.475 + jamb / 2));
    this._box(0.2, FLOOR_H - 2.1, 0.95, this._concrete, wallX, y + 2.1 + (FLOOR_H - 2.1) / 2, 0);

    // floor label on the north wall
    const label = makeSign({
      text: L.label, width: 0.5, height: 0.5,
      bg: '#4a4844', color: '#d9d4c8', font: 'bold 160px Georgia',
    });
    label.position.set(-2.1, y + 1.5, ZW - 0.005);
    label.rotation.y = Math.PI;
    this.add(label);

    // the fire plan beside the door
    const plan = makeSign({
      text: 'IN THE EVENT OF FIRE\ndo not use the lifts\ndo not run\nassembly point: the playground',
      width: 0.4, height: 0.5, bg: '#d8cfba', color: '#33302a', font: 'italic 30px Georgia',
    });
    plan.position.set(X0 + 0.005, y + 1.6, -0.95);
    plan.rotation.y = Math.PI / 2;
    this.add(plan);
    this.interact(plan, { prompt: 'the fire plan', onInteract: () => this.subtitle('do not run.', 3) });

    // caged bulb over the landing, a dimmer one over the half-landing
    const bulb = makeBulbLight({ color: 0xd8dcd0, intensity: 3.2, distance: 7, y: 2.45 });
    bulb.position.set(-2.1, y, 0);
    if (i === 3) {
      // the shaft's one shadow-caster. A point light draws the scene six times
      // for its cube map, so keep the map small — fog and grade hide the edges.
      bulb.light.castShadow = true;
      bulb.light.shadow.mapSize.set(256, 256);
      bulb.light.shadow.bias = -0.004;
      bulb.light.shadow.normalBias = 0.04;
    }
    this.add(bulb);
    this._bulbs[i] = this._gate(bulb.light, 3.2, 4.8, -2.1, y + 2.3, 0);
    if (i === 2 || i === 6) this._stutter(this._bulbs[i]);
    if (i < LAST) {
      // the spec's 1.4 left the far half of the shaft unreadable from a
      // landing — 2.6 over 8 m keeps it dimmer than the landing bulb and
      // still puts a floor under the half-landing
      const half = makeBulbLight({ color: 0xd8dcd0, intensity: 2.6, distance: 8, y: 2.3 });
      half.position.set((X1 + HALF_X0) / 2, y - HALF_H, 0);
      this.add(half);
      this._gate(half.light, 2.6, 5.4, (X1 + HALF_X0) / 2, y - HALF_H + 2.15, 0);
    }

    if (i === 0) { this._buildWardrobeBack(y); return; }

    // the fire door in the west wall
    const door = makeDoor({ width: 0.95, height: 2.1, color: DOOR_COLOR, frameColor: '#4b5356' });
    door.position.set(X0, y, 0);
    door.rotation.y = Math.PI / 2;
    this.add(door);
    this.track(door);
    this.addCollider(door.panel);
    this._doors[i] = door;

    // wire glass, which is only ever as bright as the corridor behind it
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d20, transparent: true, opacity: 0.55, roughness: 0.1,
      emissive: 0xfff1d6, emissiveIntensity: 0,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.5), glassMat);
    glass.position.set(0.5, 1.55, 0.031);
    door.panel.parent.add(glass);

    if (i <= 2) {
      // nothing behind these but a dark room and a locked handle
      this._box(0.2, 2.4, 1.6, this._concrete, X0 - 0.45, y + 1.2, 0, { collide: false });
      const line = i === 1
        ? 'Locked. Through the glass, a corridor with every light off.'
        : 'Locked. Someone has stacked chairs against the other side.';
      this.interact(door, {
        prompt: 'the fire door',
        onInteract: () => { this.playSound('locked'); this.subtitle(line, 5); },
      });
      return;
    }

    this._buildStub(i, L, glassMat);
    this.interact(door, {
      prompt: 'the fire door',
      onInteract: () => {
        if (this._exitIdx === i) return;
        this.playSound('locked');
        this.subtitle('Locked. Through the glass, lockers, and a light a long way down.', 5);
      },
    });
    this._seenOffs.push(this.whenSeen(glass, () => {
      if (this._loopCount >= 1 && this._stubLights[i].rec.on && !this._saidWindow) {
        this._saidWindow = true;
        for (const off of this._seenOffs) off();
        this.subtitle('A light on in the corridor beyond. One door closer than it was.', 5);
      }
    }, { once: false, maxDist: 6 }));

    if (L.label === '−2') this._buildChalk(y);
  }

  /** L0's door is the back of the wardrobe you came out of: wood, and no handle. */
  _buildWardrobeBack(y) {
    const back = makeDoor({ width: 0.95, height: 2.1, color: BACK_COLOR, frameColor: '#4b5356', knob: false });
    back.position.set(X0, y, 0);
    back.rotation.y = Math.PI / 2;
    this.add(back);
    this.track(back);
    this.addCollider(back.panel);
    this._box(0.2, 2.4, 1.6, this._concrete, X0 - 0.45, y + 1.2, 0, { collide: false });
    this.interact(back, {
      prompt: 'the way you came',
      onInteract: () => {
        this.playSound('locked');
        this.subtitle('It shut behind you. Wood, from this side, and no handle.', 5);
      },
    });
  }

  /** The corridor behind a fire door: lockers, and a light a long way down. */
  _buildStub(i, L, glassMat) {
    const y = L.y, mid = (STUB_X0 + X0) / 2, len = X0 - STUB_X0;
    this._box(len, 0.2, 1.4, this._floorMat, mid, y - 0.1, 0, { ground: true });
    this._box(len, 2.6, 0.2, this._concrete, mid, y + 1.3, -0.8);
    this._box(len, 2.6, 0.2, this._concrete, mid, y + 1.3, 0.8);
    this._box(0.2, 2.6, 1.8, this._concrete, STUB_X0 - 0.1, y + 1.3, 0);
    this._box(len, 0.2, 1.8, this._concrete, mid, y + 2.7, 0, { collide: false });
    for (let k = 0; k < 4; k++) {
      this._box(0.36, 1.7, 0.4, this._lockerMat, -4.2 - k * 0.42, y + 0.85, -0.5);
    }

    // the light itself: a lit panel on the end wall, its lamp at x −7.7
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff1d6, emissiveIntensity: 0 })
    );
    glow.position.set(STUB_X0 + 0.011, y + 1.5, 0);
    glow.rotation.y = Math.PI / 2;                       // facing back up the corridor
    this.add(glow);
    const light = new THREE.PointLight(0xfff1d6, 0, 6, 1.8);
    light.position.set(STUB_END_X, y + 2.0, 0);
    this.add(light);
    const rec = this._gate(light, 2.2, 9, STUB_END_X, y + 2.0, 0);
    rec.on = 0;
    this._stubLights[i] = { glow, light, glassMat, rec, label: L.label };
  }

  /** Chalk on the south wall of a −2 landing. Both planes share one texture. */
  _buildChalk(y) {
    const chalk = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.35),
      new THREE.MeshStandardMaterial({ map: this._chalk, roughness: 1 })
    );
    chalk.position.set(-2.1, y + 1.2, -ZW + 0.005);
    this.add(chalk);
    this.interact(chalk, { prompt: 'chalk', onInteract: () => this._readChalk() });
    return chalk;
  }

  /**
   * The journal entry counts what is on the wall now, so it has to be the same
   * object every time — ui.addClue keeps the first one it is given for an id.
   */
  _readChalk() {
    const n = Math.min(this._loopCount + 1, 12);
    this._chalkClue.body = `${n} ${n === 1 ? 'stroke' : 'strokes'}. and, underneath: wait for me.`;
    this.playSound('clue');
    this.game.ui.addClue(this._chalkClue);
  }

  /**
   * Register a point light with the budget below. A shaft with a bulb over
   * every landing and half-landing is more lights than a fragment shader
   * should carry, and the fog eats everything past a couple of floors, so
   * each light is only switched on while the player is near enough for it to
   * reach them. `dim`, `flick` and `on` are the puzzle's own factors.
   */
  _gate(light, base, radius, x, y, z) {
    const rec = { light, base, radius, x, y, z, dim: 1, flick: 1, on: 1, k: 0 };
    light.visible = false;
    this._gated.push(rec);
    return rec;
  }

  _wireLightBudget() {
    let primed = false;
    this.tick((dt) => {
      const p = this.game.player.position;
      for (const g of this._gated) {
        const want = Math.hypot(p.x - g.x, p.y - g.y, p.z - g.z) < g.radius ? 1 : 0;
        g.k = primed ? g.k + (want - g.k) * Math.min(1, 5 * dt) : want;
        if (Math.abs(want - g.k) < 0.01) g.k = want;
        const v = g.base * g.dim * g.flick * g.on * g.k;
        g.light.visible = v > 0.01;
        if (g.light.visible) g.light.intensity = v;
      }
      primed = true;
    });
  }

  _stutter(rec) {
    let tNext = 0;
    this.tick((dt, t) => {
      if (t > tNext) {
        const on = Math.random() > 0.28;
        rec.flick = on ? 1 : 0.1;
        tNext = t + (on ? 0.15 + Math.random() * 1.8 : 0.04 + Math.random() * 0.14);
      }
    });
  }

  /** One label's stubs are lit per loop count: −3, then −2, then −1. */
  _updateWindowLights() {
    const lit = this._loopCount === 0 ? '−3' : this._loopCount === 1 ? '−2' : '−1';
    for (const s of this._stubLights) {
      if (!s) continue;
      const on = s.label === lit;
      s.rec.on = on ? 1 : 0;
      s.light.color.set(0xfff1d6);
      s.glow.material.emissiveIntensity = on ? 1.2 : 0;
      s.glassMat.emissiveIntensity = on ? 0.7 : 0;
    }
  }

  _redrawChalk() {
    const lines = ['wait for me'];
    if (this._pleaded >= 1) lines.push('please');
    if (this._pleaded >= 2) lines.push('you always did this');
    this._chalk.redraw({ tally: Math.min(this._loopCount + 1, 12), lines });
  }

  // ---------- the loop, the footsteps, the stillness, the approach ----------

  _wirePuzzle() {
    this._loopOn = true;
    this._still = 0;
    this._stepAcc = 0;
    this._wasMoving = false;
    this._approach = null;
    this._toldOnce = false;
    this._done = false;
    this._exitIdx = null;
    this.dread(0.15);

    this.tick((dt) => {
      const pl = this.game.player;
      const footY = pl.position.y - 1.62;
      const v = Math.hypot(pl.velocity.x, pl.velocity.z);

      // the loop: below the last half-landing, back up three floors, same heading
      if (this._loopOn && footY < LOOP_Y) {
        pl.teleport(pl.position.x, pl.position.z, pl.yaw, footY + LOOP_DY);
        this._loopCount++;
        this._redrawChalk();
        this._updateWindowLights();
        this.dread(Math.min(0.75, 0.15 + 0.15 * this._loopCount));
        return;
      }

      if (this._done) {
        if (this._exitIdx !== null && !this.isCompleted &&
            pl.position.x < STUB_END_X &&
            Math.abs(footY - LANDINGS[this._exitIdx].y) < 1.0) this.complete();
        return;
      }

      if (this._approach) { this._runApproach(dt, v); return; }

      // footsteps one flight below while you walk; one more when you stop
      if (v > 0.5) {
        this._wasMoving = true;
        this._stepAcc += dt;
        if (this._stepAcc > 0.62) { this._stepAcc = 0; this._stepBelow(); }
      } else if (this._wasMoving) {
        this._wasMoving = false;
        this.after(0.5, () => { if (!this._approach && !this._done) this._stepBelow(); });
      }

      // stillness
      if (v < 0.05 && !this.game.ui.modalOpen) this._still += dt; else this._still = 0;
      if (this._still >= 8) {
        this._still = 0;
        if (footY > -8.0) {
          if (!this._toldOnce) {
            this._toldOnce = true;
            this.subtitle('Below you, the footsteps stop too. They are waiting to see what you do.', 6);
          }
        } else {
          this._startApproach();
        }
      }
    });
  }

  _stepBelow() {
    const pl = this.game.player;
    const j = () => (Math.random() - 0.5) * 0.6;
    const pos = { x: pl.position.x + j(), y: pl.position.y - 1.62 - 2.9, z: pl.position.z + j() };
    this.playSoundAt('stepOther', pos);
    if (!this._cuedSteps) { this._cuedSteps = true; this.cue('footsteps, below', pos); }
  }

  /** k = 0 → 2.9 m below the player; k = 1 → 0.5 m behind them, at floor level. */
  _approachPos(k) {
    const pl = this.game.player, yaw = pl.yaw;
    const bx = Math.sin(yaw) * 0.5, bz = Math.cos(yaw) * 0.5;      // behind = (sin yaw, 0, cos yaw)
    return {
      x: pl.position.x + bx * k,
      y: pl.position.y - 1.62 - 2.9 * (1 - k) + 0.2,
      z: pl.position.z + bz * k,
    };
  }

  /** A point `offset` metres to the player's left, at ear height. */
  _sidePos(offset) {
    const pl = this.game.player, yaw = pl.yaw;
    return {
      x: pl.position.x - Math.cos(yaw) * offset,
      y: pl.position.y,
      z: pl.position.z + Math.sin(yaw) * offset,
    };
  }

  /** The landing at or nearest below the player, among the ones with stubs. */
  _nearestLandingBelow() {
    const footY = this.game.player.position.y - 1.62;
    let idx = 3, bestY = -Infinity;
    LANDINGS.forEach((L, i) => {
      if (i >= 3 && L.y <= footY + 0.3 && L.y > bestY) { bestY = L.y; idx = i; }
    });
    return idx;
  }

  _startApproach() {
    this._approach = { t: 0, i: 0, breath: false, done: false, landing: this._nearestLandingBelow() };
  }

  _runApproach(dt, v) {
    const a = this._approach;
    a.t += dt;
    if (v > 0.3 && a.t < 6.0) { this._retreat(); return; }

    while (a.i < 10 && a.t >= a.i * 0.6) {
      const k = a.i / 9;
      this.playSoundAt('stepOther', this._approachPos(k));
      this.dread(0.35 + 0.65 * k);
      a.i++;
    }
    this._bulbs[a.landing].dim = 1 - 0.8 * Math.min(1, a.t / 6);

    if (!a.breath && a.t >= 6.0) {
      a.breath = true;
      const p = this._sidePos(0.35);
      this.playSoundAt('breath', p);
      this.cue('a breath', p);
      this.hush(3);
      this.flinch({ flash: 0 });
    }
    if (!a.done && a.t >= 6.5) {
      a.done = true;
      this._approach = null;
      this._openDoor(a.landing);
    }
  }

  /** You moved. It goes back down, and waits, and the chalk gains a word. */
  _retreat() {
    const a = this._approach;
    this._approach = null;
    this._pleaded++;
    this._still = 0;
    this.dread(0.4);
    this._bulbs[a.landing].dim = 1;
    for (let i = 0; i < 6; i++) {
      this.after(i * 0.6, () => {
        if (!this._done) this.playSoundAt('stepOther', this._approachPos(Math.max(0, 1 - i / 5)));
      });
    }
    this.subtitle('It goes back down. It will wait as long as you make it.', 5);
  }

  _openDoor(idx) {
    const door = this._doors[idx];
    this._exitIdx = idx;
    this._loopOn = false;
    this._done = true;
    this.playSound('unlock');
    door.setOpen(true, 1);                       // swings out of the shaft, into the stub
    this.removeColliderOf(door.panel);
    this.game.interaction.remove(door);
    const s = this._stubLights[idx];
    s.rec.base = 4;
    s.rec.on = 1;
    s.light.color.set(0xffd9a8);
    s.glow.material.emissiveIntensity = 1.4;
    s.glassMat.emissiveIntensity = 1.1;
    this._bulbs[idx].dim = 1;
    this.dread(0.5);
    this.setObjective('through');
    this.subtitle('The door beside you clicks, and swings, and there is nobody on the stairs at all.', 6);
  }

  // ---------- playtest ----------

  async debugSolve() {
    const pl = this.game.player;
    // walk down to the −1 landing and stand there
    pl.teleport(-2.1, 0, pl.yaw, LANDINGS[3].y);
    await this.debugWait(0.4);
    await this.debugWait(8.8);      // eight seconds still, and it starts up the flight
    await this.debugWait(7.0);      // it arrives; the −1 door clicks and swings
    // through the door, down the corridor, past the light
    pl.teleport(-5.0, 0, pl.yaw);
    await this.debugWait(0.4);
    pl.teleport(-7.85, 0, pl.yaw);
    await this.debugWait(0.8);
  }
}
