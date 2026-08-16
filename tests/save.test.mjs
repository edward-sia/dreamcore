import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveSystem } from '../src/core/SaveSystem.js';

test('migrate unlocks the level after the highest completed one', () => {
  const s = new SaveSystem();
  s.data.completed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  s.data.unlocked = 10;
  s.migrate(15);
  assert.equal(s.data.unlocked, 11);
});

test('migrate never lowers unlocked and never exceeds the level count', () => {
  const s = new SaveSystem();
  s.data.completed = [1, 2, 3]; s.data.unlocked = 6;
  s.migrate(15);
  assert.equal(s.data.unlocked, 6);
  s.data.completed = Array.from({ length: 15 }, (_, i) => i + 1);
  s.migrate(15);
  assert.equal(s.data.unlocked, 15);
});

test('defaults include captions and seenPrologues; reset keeps captions', () => {
  const s = new SaveSystem();
  assert.equal(s.data.captions, false);
  assert.deepEqual(s.data.seenPrologues, []);
  s.data.captions = true;
  s.reset();
  assert.equal(s.data.captions, true);
});
