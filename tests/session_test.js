// Headless runtime test: executes the REAL world3d + game session code
// with stubbed 2D-canvas/DOM APIs (no WebGL rendering).
const assert = require('assert');

// ---- minimal 2D context stub ----
function makeCtx() {
  const special = {
    measureText: () => ({ width: 42 }),
    createRadialGradient: () => ({ addColorStop() { } }),
    createLinearGradient: () => ({ addColorStop() { } }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  };
  return new Proxy({}, {
    get(t, prop) {
      if (prop in special) return special[prop];
      if (prop in t) return t[prop];
      return () => { };
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
global.document = {
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => makeCtx() }),
  addEventListener() { },
};
global.navigator = { vibrate() { } };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } };

global.THREE = require('../js/three.min.js');
require('../js/config.js');
require('../js/logic.js');
require('../js/save.js');
require('../js/audio.js');
require('../js/world3d.js');
require('../js/game.js');

const CFG = global.TT3D_CFG, Logic = global.Logic, GameSession = global.GameSession, W3D = global.W3D;

// ---- skin/prop builder sweep: every model must construct ----
for (const sk of CFG.SKINS) {
  const g = W3D.makeSkinMesh(sk);
  assert.ok(g.isGroup || g.isObject3D, 'skin builds: ' + sk.id);
}
for (const w of CFG.WORLDS) {
  const ws = W3D.buildWorldScene(w, false);
  assert.ok(ws.scene.children.length > 5, 'world builds: ' + w.id);
}

// ---- run a full session with a scripted player ----
const events = { hud: 0, leader: 0, mini: 0, end: null };
const sess = new GameSession({ render() { } }, {
  onHud: () => events.hud++,
  onLeader: () => events.leader++,
  onMinimap: () => events.mini++,
  onNewBest: () => { },
  onPower: () => { },
  onEnd: (r) => { events.end = r; },
});
const level = CFG.levelDef(0, 0);
sess.start({
  world: CFG.WORLDS[0], level,
  skinDef: CFG.SKINS[0],
  settings: { shadows: false, haptics: false, quality: 'low' },
  playerName: 'Tester', bestAtStart: 0,
});
assert.strictEqual(sess.entities.length, level.bots + 1, 'bots spawned');

const home = sess.player.home;
const waypoints = [
  { x: home.x + 16, z: home.z + 2 },
  { x: home.x + 16, z: home.z + 16 },
  { x: home.x + 2, z: home.z + 16 },
  { x: home.x, z: home.z },
];
let wp = 0;
const startPct = Logic.pct(sess.state, 0);
const DT = 1 / 60;
let capturedAt = -1;
for (let t = 0; t < 60 * 40; t++) {
  if (wp < waypoints.length) {
    const w = waypoints[wp];
    const dx = w.x - sess.player.pos.x, dz = w.z - sess.player.pos.z;
    if (dx * dx + dz * dz < 2) wp++;
    const d = Math.hypot(dx, dz) || 1;
    sess.setInput(dx / d, dz / d, true);
  }
  sess.update(DT);
  if (capturedAt < 0 && Logic.pct(sess.state, 0) > startPct + 0.5) capturedAt = t;
  if (sess.over) break;
}
assert.ok(capturedAt >= 0, 'player captured territory via closed loop (pct ' + Logic.pct(sess.state, 0).toFixed(2) + ')');
assert.ok(events.hud > 10, 'HUD ticks fired');
assert.ok(events.leader > 3, 'leaderboard ticks fired');
assert.ok(events.mini > 3, 'minimap ticks fired');

// bots must expand on their own
const botGrowth = sess.entities.slice(1).some((e) => sess.state.counts[e.idx] > 13);
assert.ok(botGrowth, 'at least one bot captured territory');

// no NaN anywhere
for (const e of sess.entities) {
  assert.ok(Number.isFinite(e.pos.x) && Number.isFinite(e.pos.z), 'finite positions');
  assert.ok(e.pos.x >= 1 && e.pos.x <= CFG.GRID - 1, 'inside bounds');
}

// run longer with free roaming to exercise kills/powerups/pickups
sess.setInput(0.6, -0.8, true);
for (let t = 0; t < 60 * 60; t++) { sess.update(DT); if (sess.over) break; }
console.log('session time ok; over=', sess.over, 'end=', events.end && events.end.won);

// pause must freeze the sim
if (!sess.over) {
  const before = sess.time;
  sess.setPaused(true);
  for (let t = 0; t < 60; t++) sess.update(DT);
  assert.strictEqual(sess.time, before, 'pause freezes simulation');
}

// ---- obstacle-field level (jungle world, level 7): mechanics + slide collision ----
const lvl2 = CFG.levelDef(3, 6);
assert.ok(lvl2.obstacles.length >= 2, 'high level defines obstacle mechanics');
const sess2 = new GameSession({ render() { } }, { onHud() { }, onLeader() { }, onMinimap() { }, onEnd() { } });
sess2.start({
  world: CFG.WORLDS[3], level: lvl2, skinDef: CFG.SKINS[1],
  settings: { shadows: false, haptics: false, quality: 'low' }, bestAtStart: 0,
});
let blockedCount = 0;
for (let i = 0; i < sess2.state.owner.length; i++) if (sess2.state.owner[i] === Logic.BLOCKED) blockedCount++;
assert.ok(blockedCount > 20, 'obstacle field generated: ' + blockedCount);
for (let t = 0; t < 60 * 20; t++) {
  sess2.setInput(Math.sin(t / 40), Math.cos(t / 55), true);
  sess2.update(DT);
  if (sess2.over) break;
}
for (const e of sess2.entities) {
  if (e.alive) assert.ok(!Logic.isBlocked(sess2.state, e.pos.x | 0, e.pos.z | 0), 'no entity inside obstacle');
  assert.ok(Number.isFinite(e.pos.x) && Number.isFinite(e.pos.z), 'finite positions w/ obstacles');
}

console.log('ALL SESSION TESTS PASSED');
