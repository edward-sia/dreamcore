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

test('migrate ignores junk in completed instead of locking every level', () => {
  const s = new SaveSystem();
  s.data.completed = [1, 2, 'three', null, NaN];
  s.data.unlocked = 3;
  s.migrate(15);
  assert.equal(s.data.unlocked, 3);
  assert.deepEqual(s.data.completed, [1, 2]);
});

test('each save gets its own arrays, not the defaults', () => {
  const a = new SaveSystem();
  a.completeLevel(1, 15);
  a.completeLevel(2, 15);
  a.data.seenPrologues.push(11);
  const b = new SaveSystem();
  assert.deepEqual(b.data.completed, []);
  assert.deepEqual(b.data.seenPrologues, []);
  assert.notEqual(a.data.completed, b.data.completed);
  assert.notEqual(a.data.seenPrologues, b.data.seenPrologues);
});

test('reset clears progress, and a later migrate does not bring it back', () => {
  const s = new SaveSystem();
  s.completeLevel(1, 15);
  s.completeLevel(2, 15);
  s.data.seenPrologues.push(11);
  s.recordTime(1, 42);
  assert.equal(s.data.unlocked, 3);

  s.reset();
  assert.deepEqual(s.data.completed, []);
  assert.deepEqual(s.data.seenPrologues, []);
  assert.equal(s.data.unlocked, 1);
  assert.equal(s.bestTime(1), 42);   // times are records; reset keeps them

  s.migrate(15);                      // what the next page load does
  assert.equal(s.data.unlocked, 1);
  assert.deepEqual(s.data.completed, []);
});

test('defaults include captions and seenPrologues; reset keeps captions', () => {
  const s = new SaveSystem();
  assert.equal(s.data.captions, false);
  assert.deepEqual(s.data.seenPrologues, []);
  s.data.captions = true;
  s.reset();
  assert.equal(s.data.captions, true);
});
