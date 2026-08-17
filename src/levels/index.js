// Level registry. Levels register themselves by filename — Level01.js …
// Level15.js — so rooms can be authored independently without ever touching
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
  'The ceiling of your own room. Morning.\n' +
  'This time it stays.\n\n' +
  'Somewhere, in a house that is gone, someone turns off the last light —\n' +
  'the one that was left on for you —\n' +
  'and goes to bed.';
