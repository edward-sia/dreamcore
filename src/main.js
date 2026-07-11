import { Engine } from './core/Engine.js';
import { Player } from './core/Player.js';
import { Interaction } from './core/Interaction.js';
import { UI } from './core/UI.js';
import { AudioEngine } from './core/AudioEngine.js';
import { SaveSystem } from './core/SaveSystem.js';
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

player.sensitivity = save.data.sensitivity;
audio.volume = save.data.volume;
engine.setBloomEnabled(save.data.bloom);
player.onFootstep = (run) => audio.sfx('step', { run });

const game = { engine, player, ui, audio, interaction, save, onLevelComplete: null };

let currentLevel = null;
let playing = false;
let transitioning = false;

// ---------- audio unlock on first gesture ----------
const unlock = () => { audio.unlockFromGesture(); };
document.addEventListener('mousedown', unlock, { once: false });
document.addEventListener('keydown', unlock, { once: false });

// ---------- modal focus handling ----------
ui.onModalChange = (open) => {
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
  if (window.__TEST_MODE__) return;
  const locked = document.pointerLockElement === engine.renderer.domElement;
  if (!locked && playing && !transitioning && !ui.modalOpen) {
    pauseEl.classList.remove('hidden');
    player.frozen = true;
  }
});
document.getElementById('btn-resume').addEventListener('click', () => {
  pauseEl.classList.add('hidden');
  player.frozen = false;
  player.requestLock();
});
document.getElementById('btn-quit').addEventListener('click', async () => {
  pauseEl.classList.add('hidden');
  await exitToMenu();
});

// ---------- main loop ----------
engine.onUpdate((dt, t) => {
  player.update(dt);
  interaction.update();
  currentLevel?.update(dt, t);
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

  await ui.fadeToBlack();
  disposeLevel();
  ui.clearClues();
  ui.setItems([]);

  currentLevel = new LevelClass(game);
  currentLevel.init();
  engine.setScene(currentLevel.scene);
  player.spawnAt(currentLevel.spawn.position, currentLevel.spawn.yaw);

  const meta = LevelClass.meta;
  audio.setAmbience(meta.mood);
  ui.showHUD(true);
  ui.setObjective('');

  if (!skipCard && !window.__TEST_MODE__) {
    await ui.showTitleCard(meta.numeral, meta.title);
  }
  await ui.fadeIn(true);

  transitioning = false;
  playing = true;
  player.enabled = true;
  interaction.enabled = true;
  if (!window.__TEST_MODE__) player.requestLock();
  if (meta.intro) ui.subtitle(meta.intro, 7);

  window.dispatchEvent(new CustomEvent('hiraeth:levelstart', { detail: { id } }));
}

game.onLevelComplete = async () => {
  const meta = currentLevel.constructor.meta;
  save.completeLevel(meta.id, LEVELS.length);
  window.dispatchEvent(new CustomEvent('hiraeth:levelcomplete', { detail: { id: meta.id } }));

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
    await ui.showInterlude('H I R A E T H\n\na dream in ten rooms\n\nthank you for staying asleep with me');
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
  buildMenu();
  menuEl.classList.remove('hidden');
  await ui.fadeIn();
  transitioning = false;
}

// ---------- menu ----------

const menuEl = document.getElementById('menu');
const levelsGrid = document.getElementById('menu-levels');
const settingsBox = document.getElementById('menu-settings');
const buttonsBox = document.getElementById('menu-buttons');

function buildMenu() {
  const anyProgress = save.data.completed.length > 0 || save.data.unlocked > 1;
  document.getElementById('btn-continue').disabled = !anyProgress;

  levelsGrid.innerHTML = '';
  for (const L of LEVELS) {
    const m = L.meta;
    const cell = document.createElement('div');
    const unlocked = m.id <= save.data.unlocked;
    const done = save.data.completed.includes(m.id);
    cell.className = 'level-cell' + (unlocked ? '' : ' locked') + (done ? ' done' : '');
    cell.innerHTML = `<div class="lc-num">${m.numeral}</div><div class="lc-name">${unlocked ? m.title : '· · ·'}</div>`;
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
});
document.getElementById('btn-settings').addEventListener('click', () => {
  settingsBox.classList.toggle('hidden');
  levelsGrid.classList.add('hidden');
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
  player, ui, audio, interaction, engine, save,
  loadLevel: (id) => startLevel(id, { skipCard: true }),
  solve: () => currentLevel?.debugSolve(),
  levels: LEVELS.map((L) => L.meta),
};
