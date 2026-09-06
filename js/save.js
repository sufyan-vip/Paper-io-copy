/* ============================================================
   Territory Trails 3D — versioned local save system (spec §29)
   Handles corrupted saves safely.
   ============================================================ */
(function (global) {
  'use strict';
  const KEY = 'tt3d_save_v1';

  function defaults() {
    return {
      v: 1,
      coins: 0,
      skins: ['cube-pink', 'cube-blue'],
      skin: 'cube-pink',
      stars: {},          // "worldIdx-levelIdx" -> 0..3
      best: {},           // "worldIdx-levelIdx" -> best pct
      settings: { music: 0.7, sfx: 0.8, haptics: true, shadows: true, quality: 'high' },
      stats: { kills: 0, runs: 0, captures: 0, coinsCollected: 0, wins: 0 },
      daily: { day: 0, last: 0 },
    };
  }

  let data = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.v === 1) {
          data = Object.assign(defaults(), parsed);
          data.settings = Object.assign(defaults().settings, parsed.settings || {});
          data.stats = Object.assign(defaults().stats, parsed.stats || {});
          return data;
        }
      }
    } catch (e) { /* corrupted save -> fresh start (spec §29) */ }
    data = defaults();
    return data;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked */ }
  }

  function get() { if (!data) load(); return data; }

  function addCoins(n) { data.coins = Math.max(0, data.coins + n); persist(); }
  function unlockSkin(id) { if (!data.skins.includes(id)) data.skins.push(id); persist(); }
  function selectSkin(id) { if (data.skins.includes(id)) { data.skin = id; persist(); } }

  function totalStars() { let s = 0; for (const k in data.stars) s += data.stars[k]; return s; }

  function worldUnlocked(worldIdx, WORLDS) { return totalStars() >= (WORLDS[worldIdx].unlockStars || 0); }

  function levelUnlocked(worldIdx, levelIdx, WORLDS) {
    if (!worldUnlocked(worldIdx, WORLDS)) return false;
    if (levelIdx === 0) return true;
    return (data.stars[worldIdx + '-' + (levelIdx - 1)] || 0) >= 1;
  }

  // Returns { newBest } and applies coins/stars/unlocks
  function recordResult(worldIdx, levelIdx, res) {
    const key = worldIdx + '-' + levelIdx;
    const prevBest = data.best[key] || 0;
    const newBest = res.pct > prevBest;
    if (newBest) data.best[key] = res.pct;
    data.stars[key] = Math.max(data.stars[key] || 0, res.stars || 0);
    data.coins += res.coins || 0;
    data.stats.runs++;
    if (res.won) data.stats.wins++;
    data.stats.kills += res.kills || 0;
    data.stats.captures += res.captures || 0;
    data.stats.coinsCollected += res.coinsCollected || 0;
    persist();
    return { newBest };
  }

  function resetProgress() { data = defaults(); persist(); }

  function updateSettings(patch) { Object.assign(data.settings, patch); persist(); }

  // 7-day daily reward (spec §31)
  function dailyClaimable() {
    const now = Date.now();
    const DAY = 86400000;
    return (now - (data.daily.last || 0)) > DAY * 0.9;
  }
  function claimDaily() {
    const seq = [100, 150, 200, 250, 300, 400, 600];
    const day = (Date.now() - data.daily.last > 86400000 * 1.9) ? 0 : data.daily.day;
    const reward = seq[day % 7];
    data.coins += reward;
    data.daily = { day: (day + 1) % 7, last: Date.now() };
    persist();
    return { day: day % 7, reward };
  }

  const Save = { load, get, persist, addCoins, unlockSkin, selectSkin, totalStars, worldUnlocked, levelUnlocked, recordResult, resetProgress, updateSettings, dailyClaimable, claimDaily };
  if (typeof module !== 'undefined' && module.exports) module.exports = Save;
  global.Save = Save;
})(typeof window !== 'undefined' ? window : globalThis);
