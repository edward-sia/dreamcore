import * as THREE from 'three';
import { woodTexture, textTexture, noiseMap } from './textures.js';

// Shared prop builders. Objects that animate expose .update(dt, t) and are
// registered on a level with this.track(prop).

// ---------- environment ----------

/** Gradient sky dome with an optional soft sun/moon glow. */
export function makeSky({
  top = '#33395c', mid = '#7d6f8e', bottom = '#c7a793',
  sun = null, // { position: Vector3-like, color, size }
  radius = 320,
} = {}) {
  const uniforms = {
    uTop: { value: new THREE.Color(top) },
    uMid: { value: new THREE.Color(mid) },
    uBottom: { value: new THREE.Color(bottom) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(sun?.color ?? '#f2d5b0') },
    uSunSize: { value: sun ? (sun.size ?? 0.06) : 0.0 },
  };
  if (sun?.position) uniforms.uSunDir.value.copy(sun.position).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uBottom, uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunSize;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -1.0, 1.0);
        vec3 col = h > 0.0
          ? mix(uMid, uTop, pow(h, 0.75))
          : mix(uMid, uBottom, pow(-h, 0.6));
        if (uSunSize > 0.0) {
          float d = distance(normalize(vDir), uSunDir);
          float disc = smoothstep(uSunSize, uSunSize * 0.55, d);
          float halo = smoothstep(uSunSize * 9.0, 0.0, d) * 0.35;
          col += uSunColor * (disc * 0.9 + halo);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), mat);
  mesh.name = 'sky';
  return mesh;
}

/** Fog + matching background color in one call. */
export function applyFog(scene, color, near, far) {
  scene.fog = new THREE.Fog(color, near, far);
  scene.background = new THREE.Color(color);
}

// ---------- architectural ----------

const knobMat = new THREE.MeshStandardMaterial({ color: 0xa8925e, roughness: 0.3, metalness: 0.9 });

/**
 * A door in a frame. group.position is the floor-center of the doorway.
 * door.setOpen(true) swings it; door.locked toggles behaviour handled by levels.
 * Register with level.track(door) so the swing animates.
 */
export function makeDoor({
  width = 1.0, height = 2.1, color = '#6e5940', frameColor = '#4c4034',
  knob = true, thickness = 0.05,
} = {}) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.8 });
  const fw = 0.09;
  const jambL = new THREE.Mesh(new THREE.BoxGeometry(fw, height + fw, fw * 2), frameMat);
  jambL.position.set(-width / 2 - fw / 2, (height + fw) / 2, 0);
  const jambR = jambL.clone();
  jambR.position.x = width / 2 + fw / 2;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + fw * 2, fw, fw * 2), frameMat);
  lintel.position.set(0, height + fw / 2, 0);
  group.add(jambL, jambR, lintel);

  const pivot = new THREE.Group();
  pivot.position.set(-width / 2, 0, 0);
  const panelMat = new THREE.MeshStandardMaterial({
    map: woodTexture({ base: color, plankW: 200, repeat: [1, 1] }),
    roughness: 0.75,
    bumpMap: noiseMap({ size: 128 }),
    bumpScale: 0.6,
  });
  panelMat.color.set(color);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), panelMat);
  panel.position.set(width / 2, height / 2, 0);
  panel.castShadow = panel.receiveShadow = true;
  pivot.add(panel);

  if (knob) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), knobMat);
    k.position.set(width - 0.09, 1.02, thickness / 2 + 0.03);
    const k2 = k.clone();
    k2.position.z = -thickness / 2 - 0.03;
    pivot.add(k, k2);
  }
  group.add(pivot);

  const door = group;
  door.userData.isDoor = true;
  let target = 0, angle = 0;
  door.setOpen = (open, dir = 1) => { target = open ? dir * Math.PI / 1.9 : 0; };
  door.setAngle = (rad) => { target = rad; };
  door.isOpen = () => Math.abs(target) > 0.01;
  door.update = (dt) => {
    angle += (target - angle) * Math.min(1, 2.6 * dt);
    pivot.rotation.y = angle;
  };
  door.panel = panel;
  return door;
}

/** Simple wall segment helper (a box) with proper shadows. */
export function makeWall(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- lights ----------

/** Warm ceiling bulb with visible fixture. */
export function makeBulbLight({ color = 0xffe2bc, intensity = 5.5, distance = 14, y = 2.6 } = {}) {
  const group = new THREE.Group();
  const light = new THREE.PointLight(color, intensity, distance, 1.8);
  light.position.y = y - 0.15;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    new THREE.MeshStandardMaterial({ emissive: color, emissiveIntensity: 3.5, color: 0x222222 })
  );
  bulb.position.y = y - 0.15;
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  );
  cord.position.y = y;
  group.add(light, bulb, cord);
  group.light = light;
  return group;
}

/** Fluorescent tube; flickers if flicker > 0. Register with level.track(). */
export function makeFluorescent({ length = 1.4, color = 0xdfe8e4, intensity = 5, flicker = 0 } = {}) {
  const group = new THREE.Group();
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0x333333, emissive: color, emissiveIntensity: 2.6,
  });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, length, 10), tubeMat);
  tube.rotation.z = Math.PI / 2;
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(length + 0.12, 0.06, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x8b8f8c, roughness: 0.5, metalness: 0.6 })
  );
  housing.position.y = 0.05;
  const pl = new THREE.PointLight(color, intensity, 9, 1.6);
  pl.position.y = -0.1;
  group.add(tube, housing, pl);
  group.light = pl;
  let tNext = 0;
  group.update = (dt, t) => {
    if (!flicker) return;
    if (t > tNext) {
      const on = Math.random() > flicker * 0.5;
      pl.intensity = on ? intensity * (0.7 + Math.random() * 0.5) : intensity * 0.12;
      tubeMat.emissiveIntensity = on ? 2.6 : 0.35;
      tNext = t + (on ? 0.08 + Math.random() * 2.2 : 0.03 + Math.random() * 0.12);
    }
  };
  return group;
}

// ---------- interactive props ----------

/** A folded paper note lying flat; slightly luminous so it draws the eye. */
export function makeNoteProp({ tilt = 0.12 } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe9e2cf, roughness: 0.85,
    emissive: 0xfff8e0, emissiveIntensity: 0.14,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.005, 0.29), mat);
  m.rotation.y = tilt;
  m.castShadow = true;
  return m;
}

/** Small brass key. */
export function makeKeyProp() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9a54e, roughness: 0.32, metalness: 0.95,
    emissive: 0x332200, emissiveIntensity: 0.25,
  });
  const g = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 8, 18), mat);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.11, 8), mat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.075;
  const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.03, 0.012), mat);
  tooth1.position.set(0.115, -0.02, 0);
  const tooth2 = tooth1.clone();
  tooth2.position.x = 0.095;
  g.add(bow, shaft, tooth1, tooth2);
  g.rotation.x = -Math.PI / 2;
  return g;
}

/** Industrial valve wheel. spinBy(radians) animates. Register with level.track(). */
export function makeValve({ color = 0x8a3f34 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.7 });
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 10, 22), mat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), mat);
  hub.rotation.x = Math.PI / 2;
  g.add(rim, hub);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), mat);
    spoke.rotation.z = (i / 3) * Math.PI;
    g.add(spoke);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), mat);
  stem.rotation.x = Math.PI / 2;
  stem.position.z = -0.07;
  g.add(stem);
  let spin = 0, spinTarget = 0;
  g.spinBy = (rad) => { spinTarget += rad; };
  g.update = (dt) => {
    spin += (spinTarget - spin) * Math.min(1, 3 * dt);
    g.rotation.z = spin;
  };
  return g;
}

/** Wall/standing sign with canvas text. */
export function makeSign({
  text, width = 1.0, height = 0.5, font = 'italic 40px Georgia',
  color = '#33302a', bg = '#d8cfba', doubleSided = false,
} = {}) {
  const tex = textTexture({
    text, font, color, bg,
    width: 512, height: Math.round(512 * (height / width)),
  });
  const mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.85,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  m.castShadow = false;
  return m;
}

/**
 * A clock face: a disc with twelve ticks and two hands, facing +Z.
 * clock.setTime(h, m, animate) turns the hands (clockwise, the short way
 * forward) over `animate` seconds; register with level.track(clock).
 * Rooms wrap it in a case.
 */
export function makeClockFace({ radius = 0.16, face = '#e8e2d3', hands = '#2a2622' } = {}) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshStandardMaterial({ color: face, emissive: face, emissiveIntensity: 0.12, roughness: 0.6 })
  );
  g.add(disc);
  const dark = new THREE.MeshStandardMaterial({ color: hands, roughness: 0.6 });
  for (let i = 0; i < 12; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.04, radius * 0.12, 0.004), dark);
    const a = (i / 12) * Math.PI * 2;
    tick.position.set(Math.sin(a) * radius * 0.86, Math.cos(a) * radius * 0.86, 0.003);
    tick.rotation.z = -a;
    g.add(tick);
  }
  const hand = (len, w) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.004), dark);
    m.position.y = len / 2 - w;
    pivot.add(m);
    pivot.position.z = 0.006;
    g.add(pivot);
    return pivot;
  };
  const hour = hand(radius * 0.55, radius * 0.07);
  const minute = hand(radius * 0.85, radius * 0.05);
  g._hour = hour; g._minute = minute;

  let ah = 0, am = 0;                 // current angles, clockwise from 12
  let fh = 0, fm = 0, th = 0, tm = 0; // from / to
  let animT = 0, animDur = 0;
  const apply = () => { hour.rotation.z = -ah; minute.rotation.z = -am; };
  const forward = (a, b, e) => { let d = b - a; while (d < 0) d += Math.PI * 2; return a + d * e; };
  g.setTime = (h, m, animate = 1.6) => {
    fh = ah; fm = am;
    th = (((h % 12) + m / 60) / 12) * Math.PI * 2;
    tm = (m / 60) * Math.PI * 2;
    animDur = Math.max(0, animate); animT = 0;
    if (animDur === 0) { ah = th; am = tm; apply(); }
  };
  g.update = (dt) => {
    if (animT >= animDur) return;
    animT = Math.min(animDur, animT + dt);
    const k = animDur ? animT / animDur : 1;
    const e = 1 - Math.pow(1 - k, 3);
    ah = forward(fh, th, e);
    am = forward(fm, tm, e);
    if (k >= 1) { ah = th; am = tm; }
    apply();
  };
  apply();
  return g;
}

/** Framed picture with any texture (use textTexture or a small drawn canvas). */
export function makePictureFrame({ texture, width = 0.5, height = 0.38 } = {}) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x54432f, roughness: 0.6 });
  const bw = 0.03;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + bw * 2, height + bw * 2, 0.03), frameMat);
  const img = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 })
  );
  img.position.z = 0.017;
  g.add(frame, img);
  return g;
}

// ---------- furniture ----------

export function makeTable({ w = 1.1, d = 0.65, h = 0.74, mat = null } = {}) {
  const m = mat ?? new THREE.MeshStandardMaterial({
    map: woodTexture({ base: '#6b5138', repeat: [1, 1] }), roughness: 0.7,
  });
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), m);
  top.position.y = h;
  top.castShadow = top.receiveShadow = true;
  g.add(top);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05), m);
    leg.position.set(sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06));
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

export function makeChair({ mat = null } = {}) {
  const m = mat ?? new THREE.MeshStandardMaterial({
    map: woodTexture({ base: '#5f4a35', repeat: [1, 1] }), roughness: 0.75,
  });
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), m);
  seat.position.y = 0.45;
  seat.castShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.04), m);
  back.position.set(0, 0.72, -0.19);
  back.castShadow = true;
  g.add(seat, back);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.45, 0.035), m);
    leg.position.set(sx * 0.18, 0.225, sz * 0.18);
    g.add(leg);
  }
  return g;
}

export function makeShelf({ w = 0.9, h = 1.8, d = 0.3, shelves = 4, mat = null } = {}) {
  const m = mat ?? new THREE.MeshStandardMaterial({
    map: woodTexture({ base: '#5a4630', repeat: [1, 2] }), roughness: 0.8,
  });
  const g = new THREE.Group();
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, d), m);
  sideL.position.set(-w / 2, h / 2, 0);
  const sideR = sideL.clone();
  sideR.position.x = w / 2;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), m);
  back.position.set(0, h / 2, -d / 2 + 0.01);
  g.add(sideL, sideR, back);
  for (let i = 0; i <= shelves; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.028, d), m);
    p.position.y = 0.05 + (i * (h - 0.1)) / shelves;
    p.receiveShadow = true;
    g.add(p);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makeBench({ mat = null } = {}) {
  const m = mat ?? new THREE.MeshStandardMaterial({
    map: woodTexture({ base: '#7a6248', repeat: [2, 1] }), roughness: 0.85,
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3d4045, roughness: 0.45, metalness: 0.8 });
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.035, 0.09), m);
    slat.position.set(0, 0.46, -0.12 + i * 0.12);
    slat.castShadow = true;
    g.add(slat);
  }
  for (let i = 0; i < 2; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.09, 0.035), m);
    slat.position.set(0, 0.62 + i * 0.14, -0.24);
    g.add(slat);
  }
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.4), metal);
    leg.position.set(sx * 0.7, 0.23, 0);
    g.add(leg);
  }
  return g;
}

// ---------- water ----------

/** Still, faintly moving water. Register with level.track(). */
export function makeWater({ width = 10, depth = 10, color = 0x2e5a5e, opacity = 0.82 } = {}) {
  const bump = noiseMap({ size: 256, strength: 26, repeat: [width / 3, depth / 3] });
  const mat = new THREE.MeshStandardMaterial({
    color, transparent: true, opacity,
    roughness: 0.12, metalness: 0.35,
    bumpMap: bump, bumpScale: 1.6,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth, 1, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.update = (dt, t) => {
    bump.offset.x = Math.sin(t * 0.05) * 0.3 + t * 0.008;
    bump.offset.y = Math.cos(t * 0.043) * 0.3;
  };
  return m;
}

// ---------- dust ----------

/** Slow drifting dust motes — sells the "air" of a space. Register with level.track(). */
export function makeDust({ count = 220, box = [12, 4, 12], center = [0, 2, 0], size = 0.011, color = 0xfff3da } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (Math.random() - 0.5) * box[0];
    pos[i * 3 + 1] = center[1] + (Math.random() - 0.5) * box[1];
    pos[i * 3 + 2] = center[2] + (Math.random() - 0.5) * box[2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // A soft round mote instead of the default square point sprite.
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4;
    const radius = Math.hypot((x + 0.5 - 16) / 16, (y + 0.5 - 16) / 16);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - radius), 1.5));
  }
  const sprite = new THREE.DataTexture(pixels, 32, 32);
  sprite.needsUpdate = true;
  sprite.magFilter = THREE.LinearFilter;
  const mat = new THREE.PointsMaterial({
    color, size, map: sprite, transparent: true, opacity: 0.22, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  const speeds = Array.from({ length: count }, () => 0.05 + Math.random() * 0.12);
  pts.update = (dt, t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) - speeds[i] * dt;
      const minY = center[1] - box[1] / 2;
      if (y < minY) y = center[1] + box[1] / 2;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * 0.048 * dt);
    }
    p.needsUpdate = true;
  };
  return pts;
}
