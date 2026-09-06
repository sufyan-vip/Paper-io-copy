// Node unit test for the territory engine
const Logic = require('../js/logic.js');
const assert = require('assert');

const N = 20;
const s = Logic.makeState(N, 2);
Logic.seed(s, 0, 5, 5, 2);
Logic.seed(s, 1, 15, 15, 2);
assert.strictEqual(s.counts[0], 13, 'seed disc count p0'); // r=2 disc = 13 cells
assert.strictEqual(s.counts[1], 13, 'seed disc count p1');

// Player 0 draws a loop: right, down, left, back home
const path = [];
for (let x = 6; x <= 12; x++) path.push([x, 7]);
for (let y = 8; y <= 12; y++) path.push([12, y]);
for (let x = 11; x >= 5; x--) path.push([x, 12]);
for (let y = 11; y >= 7; y--) path.push([5, y]);

let captured = null;
for (const [x, y] of path) {
  const ev = Logic.stepOn(s, 0, x, y);
  if (ev.captured) captured = ev.captured;
}
assert.ok(captured, 'loop closing triggers capture');
// enclosed interior: x6..11, y8..11 = 24 cells + trail cells converted
assert.ok(captured.gained >= 24, 'captured at least the interior, got ' + captured.gained);
// outside cell untouched
assert.strictEqual(s.owner[5], 255, 'far cell still unowned');
// player 1 territory untouched
assert.strictEqual(s.counts[1], 13, 'p1 keeps territory');
// trail cleared after capture
assert.strictEqual(Logic.hasTrail(s, 0), false, 'trail cleared after capture');

// Kill rule: p1 draws trail, p0 steps on it
const s2 = Logic.makeState(N, 2);
Logic.seed(s2, 0, 3, 3, 2);
Logic.seed(s2, 1, 15, 3, 2);
Logic.stepOn(s2, 1, 10, 3); // p1 trails
const ev2 = Logic.stepOn(s2, 0, 10, 3);
assert.strictEqual(ev2.killed, 1, 'stepping on enemy trail kills owner');
const cleared = Logic.clearTrail(s2, 1);
assert.ok(cleared.length >= 0, 'clearTrail runs');

// pct sanity
const s3 = Logic.makeState(10, 1);
Logic.seed(s3, 0, 5, 5, 1); // 5 cells
assert.ok(Math.abs(Logic.pct(s3, 0) - 5) < 0.01, 'pct = 5%');

// Obstacles: blocked cells are walls, never trailable, never ownable
const s4 = Logic.makeState(N, 1);
Logic.seed(s4, 0, 5, 5, 2);
Logic.setBlocked(s4, 9, 9);
assert.ok(Logic.isBlocked(s4, 9, 9), 'blocked set');
const evW = Logic.stepOn(s4, 0, 9, 9);
assert.ok(evW.wall, 'stepping on blocked reports wall');
assert.strictEqual(s4.trail[9 * N + 9], Logic.NONE, 'no trail on blocked');
const path4 = [];
for (let x = 6; x <= 12; x++) path4.push([x, 7]);
for (let y = 8; y <= 12; y++) path4.push([12, y]);
for (let x = 11; x >= 5; x--) path4.push([x, 12]);
for (let y = 11; y >= 7; y--) path4.push([5, y]);
let cap4 = null;
for (const [x, y] of path4) { const ev = Logic.stepOn(s4, 0, x, y); if (ev.captured) cap4 = ev.captured; }
assert.ok(cap4, 'capture with obstacle inside closes');
assert.strictEqual(s4.owner[9 * N + 9], Logic.BLOCKED, 'blocked cell never captured');

console.log('ALL LOGIC TESTS PASSED');
