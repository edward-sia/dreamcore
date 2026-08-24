// Level registry. Levels register themselves by filename — Level01.js …
// Level20.js — so rooms can be authored independently without ever touching
// a shared file.

const modules = import.meta.glob('./Level*.js', { eager: true });

export const LEVELS = Object.keys(modules)
  .sort()
  .map((k) => modules[k].default)
  .filter(Boolean)
  .sort((a, b) => a.meta.id - b.meta.id);

export function levelClass(id) {
  return LEVELS.find((L) => L.meta.id === id) ?? null;
}

export const PROLOGUE =
  'You fell asleep somewhere familiar.\n\n' +
  'The house is gone now — sold, or burned, or simply far away.\n' +
  'But at night it rebuilds itself, room by room,\n' +
  'and it leaves the lights on for you.';

export const EPILOGUE =
  'You open your eyes.\n\n' +
  'Morning. It stays.\n' +
  'Across the landing, a door you locked and a light you left on,\n' +
  'and somebody small behind it, not yet awake,\n' +
  'who will not remember any of this.\n\n' +
  'You go down, and put the kettle on, and leave the light on.';
