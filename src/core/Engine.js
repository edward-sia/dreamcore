import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Final grade: vignette, film grain, subtle chromatic fringe and a faded,
// slightly desaturated lift — the "old photograph" cast the whole game leans on.
const DreamGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 1.15 },
    uGrain: { value: 0.026 },
    uDesat: { value: 0.16 },
    uLift: { value: 0.025 },
    uFringe: { value: 0.00045 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uDesat, uLift, uFringe;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);

      // chromatic fringe, stronger at edges
      vec2 off = centered * uFringe * (1.0 + r2 * 5.0);
      float cr = texture2D(tDiffuse, vUv + off).r;
      vec4 base = texture2D(tDiffuse, vUv);
      float cb = texture2D(tDiffuse, vUv - off).b;
      vec3 col = vec3(cr, base.g, cb);

      // faded film: lift blacks, pull saturation
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(luma), uDesat);
      col = col * (1.0 - uLift) + uLift;
      // cool the shadows, warm the mids very slightly
      col += (0.5 - luma) * vec3(-0.012, -0.004, 0.02);

      // vignette
      float vig = smoothstep(0.95, 0.28, r2 * uVignette);
      col *= mix(0.62, 1.0, vig);

      // animated grain
      float g = hash(vUv * vec2(1441.0, 907.0) + fract(uTime * 13.7));
      col += (g - 0.5) * uGrain;

      gl_FragColor = vec4(col, base.a);
    }
  `,
};

const BASE_GRADE = { vignette: 1.15, grain: 0.026, desat: 0.16, lift: 0.025, fringe: 0.00045 };

export class Engine {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    // Coarse pointers are phones: half the pixels of a modern phone screen is
    // plenty for this game and keeps the bloom/grade passes affordable (spec §6).
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 600);

    this.scene = new THREE.Scene();

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.22, 0.6, 0.85
    );
    this.composer.addPass(this.bloomPass);

    this.composer.addPass(new OutputPass());

    this.gradePass = new ShaderPass(DreamGradeShader);
    this.composer.addPass(this.gradePass);

    this._grade = { ...BASE_GRADE };
    this._pulse = null;

    this._clock = new THREE.Clock();
    this._updaters = new Set();
    this._running = false;
    this.timeScale = 1;

    window.addEventListener('resize', () => this._onResize());
  }

  setScene(scene) {
    this.scene = scene;
    this.renderPass.scene = scene;
  }

  setBloomEnabled(on) {
    this.bloomPass.enabled = on;
  }

  /** Per-level grade override (partial keys: vignette grain desat lift fringe). null → base. */
  setGrade(partial) {
    this._grade = { ...BASE_GRADE, ...(partial || {}) };
    this._applyGrade(this._grade);
  }

  _applyGrade(g) {
    const u = this.gradePass.uniforms;
    u.uVignette.value = g.vignette;
    u.uGrain.value = g.grain;
    u.uDesat.value = g.desat;
    u.uLift.value = g.lift;
    u.uFringe.value = g.fringe;
  }

  /** A one-blink spike of grain / fringe / desaturation that eases back over `duration` seconds. */
  pulseGrade({ grain = 0.3, fringe = 0.008, desat = 0.6, duration = 0.35 } = {}) {
    this._pulse = { t: 0, duration, grain, fringe, desat };
  }

  onUpdate(fn) {
    this._updaters.add(fn);
    return () => this._updaters.delete(fn);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._clock.start();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  stop() {
    this._running = false;
    this.renderer.setAnimationLoop(null);
  }

  _frame() {
    const dt = Math.min(this._clock.getDelta(), 0.05) * this.timeScale;
    const t = this._clock.elapsedTime;
    if (this._pulse) {
      const p = this._pulse;
      p.t += dt;
      const k = Math.min(1, p.t / p.duration);
      const e = 1 - Math.pow(1 - k, 3);          // ease-out cubic
      const u = this.gradePass.uniforms, g = this._grade;
      u.uGrain.value = p.grain + (g.grain - p.grain) * e;
      u.uFringe.value = p.fringe + (g.fringe - p.fringe) * e;
      u.uDesat.value = p.desat + (g.desat - p.desat) * e;
      if (k >= 1) { this._pulse = null; this._applyGrade(g); }
    }
    this.gradePass.uniforms.uTime.value = t;
    for (const fn of this._updaters) fn(dt, t);
    this.composer.render();
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }
}
