/* ============================================================
   Territory Trails 3D — logical territory engine (pure logic)
   Grid-based capture with flood-fill loop closing (spec §5).
   No rendering dependencies; unit-testable in Node.
   ============================================================ */
(function (global) {
  'use strict';
  const NONE = 255;
  const BLOCKED = 254; // impassable obstacle cell (never ownable)

  function makeState(n, players) {
    return {
      n,
      owner: new Uint8Array(n * n).fill(NONE),
      trail: new Uint8Array(n * n).fill(NONE),
      counts: new Int32Array(players),
    };
  }

  // Grant a starter disc of territory around (cx, cy)
  function seed(state, p, cx, cy, r) {
    const n = state.n;
    const x0 = Math.max(0, cx - r), x1 = Math.min(n - 1, cx + r);
    const y0 = Math.max(0, cy - r), y1 = Math.min(n - 1, cy + r);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const i = y * n + x;
        const o = state.owner[i];
        if (o === p || o === BLOCKED) continue;
        if (o !== NONE) state.counts[o]--;
        state.owner[i] = p;
        state.trail[i] = NONE;
        state.counts[p]++;
      }
    }
  }

  function hasTrail(state, p) { return state.trail.indexOf(p) !== -1; }

  // Called when player p enters cell (cx, cy).
  // Returns events: killed (trail owner killed), captured {changed,gained}, trailed
  function stepOn(state, p, cx, cy) {
    const n = state.n;
    const i = cy * n + cx;
    const ev = { killed: -1, captured: null, trailed: false, wall: false };
    const t = state.trail[i];
    const o = state.owner[i];
    if (o === BLOCKED) { ev.wall = true; return ev; }
    // Stepping on an exposed enemy trail eliminates its owner (forgiving: only trails, spec §4)
    if (t !== NONE && t !== p && o !== p) ev.killed = t;
    if (o === p) {
      if (hasTrail(state, p)) ev.captured = capture(state, p);
    } else if (t !== p) {
      state.trail[i] = p;
      ev.trailed = true;
    }
    return ev;
  }

  // Flood fill from map border; everything unreachable & not owned/trail becomes p's.
  function capture(state, p) {
    const n = state.n, owner = state.owner, trail = state.trail;
    const visited = new Uint8Array(n * n);
    const queue = new Int32Array(n * n);
    let qh = 0, qt = 0;
    const push = (i) => {
      if (!visited[i] && owner[i] !== p && trail[i] !== p) { visited[i] = 1; queue[qt++] = i; }
    };
    for (let x = 0; x < n; x++) {
      push(x);                      // top row
      push((n - 1) * n + x);        // bottom row
      push(x * n);                  // left col
      push(x * n + n - 1);          // right col
    }
    while (qh < qt) {
      const i = queue[qh++];
      const x = i % n, y = (i - x) / n;
      if (x > 0) push(i - 1);
      if (x < n - 1) push(i + 1);
      if (y > 0) push(i - n);
      if (y < n - 1) push(i + n);
    }
    const changed = [];
    let gained = 0;
    for (let i = 0; i < n * n; i++) {
      if (visited[i]) continue;
      const o = owner[i], t = trail[i];
      if (o !== p && o !== BLOCKED) {
        if (o !== NONE) state.counts[o]--;
        owner[i] = p;
        state.counts[p]++;
        gained++;
        changed.push(i);
      }
      if (t === p) { trail[i] = NONE; changed.push(i); }
    }
    return { changed, gained };
  }

  // Remove every trail cell of p (used on death / after capture cleanup).
  function clearTrail(state, p) {
    const cells = [];
    const trail = state.trail;
    for (let i = 0; i < trail.length; i++) {
      if (trail[i] === p) { trail[i] = NONE; cells.push(i); }
    }
    return cells;
  }

  function pct(state, p) { return (state.counts[p] / (state.n * state.n)) * 100; }

  function setBlocked(state, cx, cy) {
    const i = cy * state.n + cx;
    state.owner[i] = BLOCKED;
    state.trail[i] = NONE;
  }
  function isBlocked(state, cx, cy) {
    if (cx < 0 || cy < 0 || cx >= state.n || cy >= state.n) return true;
    return state.owner[cy * state.n + cx] === BLOCKED;
  }

  const Logic = { NONE, BLOCKED, makeState, seed, stepOn, capture, clearTrail, hasTrail, pct, setBlocked, isBlocked };
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  global.Logic = Logic;
})(typeof window !== 'undefined' ? window : globalThis);
