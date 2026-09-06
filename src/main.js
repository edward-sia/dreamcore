import { Engine } from './core/Engine.js';
import { Player } from './core/Player.js';
import { Interaction } from './core/Interaction.js';
import { TouchControls } from './core/TouchControls.js';
import { UI } from './core/UI.js';
import { AudioEngine } from './core/AudioEngine.js';
import { SaveSystem } from './core/SaveSystem.js';
import { Leaderboard, formatTime } from './core/Leaderboard.js';
import { LEVELS, levelClass, PROLOGUE, EPILOGUE } from './levels/index.js';

// ---------- test / debug flags (must be set before subsystems construct) ----------
const params = new URLSearchParams(location.search);
if (params.get('test') === '1') window.__TEST_MODE__ = true;
const directLevel = params.get('level') ? parseInt(params.get('level'), 10) : null;

// ---------- subsystems ----------
const container = document.getElementById('app');
const engine = new Engine(container);
const ui = new UI();
const audio = new AudioEngine();
const player = new Player(engine.camera, engine.renderer.domElement);
const interaction = new Interaction(engine.camera, ui);
const save = new SaveSystem();
save.migrate(LEVELS.length);
const leaderboard = new Leaderboard(save);

player.sensitivity = save.data.sensitivity;
audio.volume = save.data.volume;
engine.setBloomEnabled(save.data.bloom);
player.onFootstep = (run) => audio.sfx('step', { run });

const game = { engine, player, ui, audio, interaction, save, onLevelComplete: null };

let currentLevel = null;
let playing = false;
let transitioning = false;
let paused = false;
let levelElapsed = 0; // active seconds in the current room (pause excluded)
let touch = null;     // TouchControls, once touch mode is on (see below)
let orientationHeld = false; // the rotate card is holding the room (spec §5.3)

// ---------- audio unlock on first gesture ----------
const unlock = () => { audio.unlockFromGesture(); };
document.addEventListener('mousedown', unlock, { once: false });
document.addEventListener('keydown', unlock, { once: false });

// ---------- modal focus handling ----------
ui.onModalChange = (open) => {
  touch?.reset();
  player.frozen = open;
  if (window.__TEST_MODE__) return;
  if (open && ui.modalKind === 'keypad') {
    document.exitPointerLock?.();
  } else if (!open && playing) {
    player.requestLock();
  }
};

// ---------- pause on pointer-lock loss ----------
const pauseEl = document.getElementById('pause');
document.addEventListener('pointerlockchange', () => {
  if (window.__TEST_MODE__ || player.touchMode) return;
  const locked = document.pointerLockElement === engine.renderer.domElement;
  if (!locked && playing && !transitioning && !ui.modalOpen) {
    pauseEl.classList.remove('hidden');
    player.frozen = true;
    paused = true;
  }
});
document.getElementById('btn-resume').addEventListener('click', () => {
  pauseEl.classList.add('hidden');
  player.frozen = false;
  paused = false;
  player.requestLock();
});
document.getElementById('btn-quit').addEventListener('click', async () => {
  pauseEl.classList.add('hidden');
  paused = false;
  await exitToMenu();
});

// ---------- portrait hold (spec §5.3) ----------
const rotateEl = document.getElementById('rotate');
const portraitMq = window.matchMedia('(orientation: portrait)');
function updateRotateCard() {
  const hold = !!touch && portraitMq.matches && (playing || transitioning);
  const changed = hold !== orientationHeld;
  orientationHeld = hold;
  rotateEl.classList.toggle('hidden', !hold);
  if (hold) {
    // re-asserted on every call, so a room that starts while the phone is
    // upright cannot begin unfrozen behind the card
    touch?.reset();
    player.frozen = true;
  } else if (changed && !paused && !ui.modalOpen) {
    player.frozen = false;
  }
}
portraitMq.addEventListener?.('change', updateRotateCard);

// ---------- touch mode (spec §2) ----------
function enterTouchMode() {
  if (touch || window.__TEST_MODE__) return;
  document.body.classList.add('touch');
  document.getElementById('touch-hud').classList.remove('hidden');
  player.touchMode = true;
  // The fallback path can arrive after startLevel already took a lock (spec §2:
  // in touch mode no lock is held). touchMode is set first, so letting it go
  // does not trip the pause-on-lock-loss handler.
  document.exitPointerLock?.();
  ui.setTouchMode(true);
  touch = new TouchControls({ player, interaction, ui, app: container });
  document.getElementById('prompt').addEventListener('click', () => {
    if (playing && !paused) interaction.trigger();
  });
  document.getElementById('btn-remember').addEventListener('click', () => {
    if (playing && !paused) ui.toggleJournal();
  });
  document.getElementById('btn-surface').addEventListener('click', () => {
    if (!playing || paused || ui.modalOpen) return;
    touch?.reset();
    pauseEl.classList.remove('hidden');
    player.frozen = true;
    paused = true;
  });
  updateRotateCard();
}
if (window.matchMedia?.('(pointer: coarse)').matches) enterTouchMode();
window.addEventListener('touchstart', enterTouchMode, { once: true, capture: true });
document.addEventListener('touchstart', unlock);

// ---------- main loop ----------
let lastTick = performance.now();
engine.onUpdate((dt, t) => {
  touch?.update();          // the stick feeds the player every frame it lives
  player.update(dt);
  audio.updateListener(engine.camera);
  interaction.update();
  currentLevel?.update(dt, t);
  // Room timer: wall-clock seconds, so slow machines aren't under-billed by
  // the engine's dt clamp. Capped per frame so a suspended tab isn't billed,
  // frozen while paused, immune to debug timeScale.
  const now = performance.now();
  const realDt = Math.min((now - lastTick) / 1000, 0.5);
  lastTick = now;
  if (playing && !paused && !orientationHeld) levelElapsed += realDt;
});
engine.start();

// ---------- level flow ----------

async function startLevel(id, { skipCard = false } = {}) {
  const LevelClass = levelClass(id);
  if (!LevelClass) { console.error(`no level ${id}`); return; }
  transitioning = true;
  playing = false;
  player.enabled = false;
  interaction.enabled = false;
  touch?.reset();

  await ui.fadeToBlack();
  disposeLevel();
  ui.clearClues();
  ui.setItems([]);

  const meta = LevelClass.meta;
  engine.setGrade(meta.grade ?? null);
  if (meta.prologue && !skipCard && !window.__TEST_MODE__ && !save.data.seenPrologues.includes(id)) {
    save.data.seenPrologues.push(id);
    save.save();
    await ui.showInterlude(meta.prologue);
  }

  // Before init(), which runs the room's build(): setDread does nothing while
  // there is no ambience, and setAmbience resets dread to 0 — so a room that
  // opens with this.dread(...) only keeps it if its ambience is already up.
  audio.setAmbience(meta.mood);
  ui.setObjective('');            // clear the last room's line before this one's build() writes its own
  currentLevel = new LevelClass(game);
  currentLevel.init();
  engine.setScene(currentLevel.scene);
  player.spawnAt(currentLevel.spawn.position, currentLevel.spawn.yaw);
  ui.showHUD(true);

  if (!skipCard && !window.__TEST_MODE__) {
    await ui.showTitleCard(meta.numeral, meta.title);
  }
  await ui.fadeIn(true);

  transitioning = false;
  paused = false;
  // A room always begins unfrozen. Without this, pausing and then waking to the
  // menu leaves `frozen` set and the next room cannot be walked in — on touch,
  // *surface* → *wake to menu* is the only way out of a room, so it is the
  // common path, not a corner.
  player.frozen = false;
  levelElapsed = 0;
  playing = true;
  player.enabled = true;
  interaction.enabled = true;
  if (!window.__TEST_MODE__) player.requestLock();
  if (meta.intro) ui.subtitle(meta.intro, 7);
  updateRotateCard();

  window.dispatchEvent(new CustomEvent('hiraeth:levelstart', { detail: { id } }));
}

game.onLevelComplete = async () => {
  const meta = currentLevel.constructor.meta;
  const timeTaken = levelElapsed;
  save.completeLevel(meta.id, LEVELS.length);
  if (!window.__TEST_MODE__) {
    save.recordTime(meta.id, timeTaken);
    leaderboard.submit().catch(() => {});
  }
  window.dispatchEvent(new CustomEvent('hiraeth:levelcomplete', { detail: { id: meta.id, time: timeTaken } }));

  if (window.__TEST_MODE__) return; // playtests assert on the event; no transition

  playing = false;
  player.enabled = false;
  interaction.enabled = false;
  audio.sfx('complete');

  await ui.fadeToBlack(true);
  ui.showHUD(false);
  audio.setAmbience('menu');
  document.exitPointerLock?.();

  if (meta.outro) await ui.showInterlude(meta.outro);

  const nextId = meta.id + 1;
  if (levelClass(nextId)) {
    await startLevel(nextId);
  } else {
    await ui.showInterlude(EPILOGUE);
    await ui.showInterlude('H I R A E T H\n\na dream in twenty rooms\n\nthank you for leaving the light on');
    await exitToMenu();
  }
};

function disposeLevel() {
  if (currentLevel) {
    currentLevel.dispose();
    currentLevel = null;
  }
}

async function exitToMenu() {
  transitioning = true;
  playing = false;
  player.enabled = false;
  interaction.enabled = false;
  await ui.fadeToBlack();
  disposeLevel();
  ui.showHUD(false);
  ui.hideInterlude();
  audio.setAmbience('menu');
  if (touch && document.fullscreenElement) document.exitFullscreen()?.catch?.(() => {});
  buildMenu();
  menuEl.classList.remove('hidden');
  await ui.fadeIn();
  transitioning = false;
  updateRotateCard();
}

// ---------- menu ----------

const menuEl = document.getElementById('menu');
const levelsGrid = document.getElementById('menu-levels');
const settingsBox = document.getElementById('menu-settings');
const dreamersBox = document.getElementById('menu-dreamers');
const buttonsBox = document.getElementById('menu-buttons');
leaderboard.attach();

function buildMenu() {
  const anyProgress = save.data.completed.length > 0 || save.data.unlocked > 1;
  document.getElementById('btn-continue').disabled = !anyProgress;
  const done = save.data.completed;
  document.getElementById('menu-sub').textContent = done.includes(15)
    ? 'a dream in ten rooms · the five beneath · the five above'
    : done.includes(10)
      ? 'a dream in ten rooms · and the five beneath'
      : 'a dream in ten rooms';
  document.getElementById('set-captions').checked = save.data.captions;

  levelsGrid.innerHTML = '';
  for (const L of LEVELS) {
    const m = L.meta;
    const cell = document.createElement('div');
    const unlocked = m.id <= save.data.unlocked;
    const done = save.data.completed.includes(m.id);
    cell.className = 'level-cell' + (unlocked ? '' : ' locked') + (done ? ' done' : '');
    const best = save.bestTime(m.id);
    cell.innerHTML = `<div class="lc-num">${m.numeral}</div><div class="lc-name">${unlocked ? m.title : '· · ·'}</div>`
      + (done && best !== null ? `<div class="lc-time">${formatTime(best)}</div>` : '');
    if (unlocked) cell.addEventListener('click', () => beginFromMenu(m.id));
    levelsGrid.appendChild(cell);
  }

  document.getElementById('set-sens').value = save.data.sensitivity;
  document.getElementById('set-vol').value = save.data.volume;
  document.getElementById('set-quality').checked = save.data.bloom;
}

async function beginFromMenu(id, isNew = false) {
  menuEl.classList.add('hidden');
  audio.unlockFromGesture();
  if (touch) {
    try {
      const fs = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      fs?.then?.(() => screen.orientation?.lock?.('landscape'))?.catch?.(() => {});
    } catch { /* a browser that refuses either is fine — §5.3 catches it */ }
  }
  if ((isNew || !save.data.sawPrologue) && id === 1) {
    save.data.sawPrologue = true;
    save.save();
    await ui.fadeToBlack();
    await ui.showInterlude(PROLOGUE);
  }
  await startLevel(id);
}

document.getElementById('btn-continue').addEventListener('click', () => {
  const next = Math.min(save.data.unlocked, LEVELS.length);
  const firstUnfinished = LEVELS.find((L) => !save.data.completed.includes(L.meta.id));
  beginFromMenu(firstUnfinished ? Math.min(firstUnfinished.meta.id, next) : next);
});
document.getElementById('btn-new').addEventListener('click', () => {
  save.reset();
  beginFromMenu(1, true);
});
document.getElementById('btn-levels').addEventListener('click', () => {
  levelsGrid.classList.toggle('hidden');
  settingsBox.classList.add('hidden');
  dreamersBox.classList.add('hidden');
});
document.getElementById('btn-settings').addEventListener('click', () => {
  settingsBox.classList.toggle('hidden');
  levelsGrid.classList.add('hidden');
  dreamersBox.classList.add('hidden');
});
document.getElementById('btn-dreamers').addEventListener('click', () => {
  const opening = dreamersBox.classList.contains('hidden');
  dreamersBox.classList.toggle('hidden');
  levelsGrid.classList.add('hidden');
  settingsBox.classList.add('hidden');
  if (opening) leaderboard.refresh();
});
document.getElementById('btn-back').addEventListener('click', () => {
  settingsBox.classList.add('hidden');
});
document.getElementById('set-sens').addEventListener('input', (e) => {
  save.data.sensitivity = parseFloat(e.target.value);
  player.sensitivity = save.data.sensitivity;
  save.save();
});
document.getElementById('set-vol').addEventListener('input', (e) => {
  save.data.volume = parseFloat(e.target.value);
  audio.setVolume(save.data.volume);
  save.save();
});
document.getElementById('set-quality').addEventListener('change', (e) => {
  save.data.bloom = e.target.checked;
  engine.setBloomEnabled(save.data.bloom);
  save.save();
});
document.getElementById('set-captions').addEventListener('change', (e) => {
  save.data.captions = e.target.checked;
  save.save();
});

// ---------- boot ----------

if (directLevel) {
  menuEl.classList.add('hidden');
  ui.showHUD(true);
  startLevel(directLevel, { skipCard: true });
} else {
  buildMenu();
  audio.setAmbience('menu');
  ui.fadeIn();
}

// ---------- debug / playtest API ----------

window.__game = {
  get level() { return currentLevel; },
  get playing() { return playing; },
  get levelElapsed() { return levelElapsed; },
  player, ui, audio, interaction, engine, save, leaderboard,
  loadLevel: (id) => startLevel(id, { skipCard: true }),
  solve: () => currentLevel?.debugSolve(),
  levels: LEVELS.map((L) => L.meta),
};
