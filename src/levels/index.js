// Level registry. Levels register themselves by filename — Level01.js …
// Level10.js — so ten files can be authored independently without ever
// touching a shared file.

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
  'The ceiling of your own room. Morning, or nearly.\n' +
  'The house is gone. The pool, the field, the train.\n\n' +
  'You carry them anyway.\n' +
  'That is what carrying is for.';
