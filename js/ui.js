/* ============================================================
   Territory Trails 3D — UI layer (premium pass)
   Zero emojis: full inline-SVG icon system, fluid transitions,
   coin counter bump, animated result count-up, minimap with
   obstacle rendering. Every button performs a real action.
   ============================================================ */
(function (global) {
  'use strict';
  const CFG = global.TT3D_CFG, Save = global.Save, AudioSys = global.AudioSys, ICON = global.ICON;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  const ic = (n, c) => ICON.ic(n, c);

  const UI = { handlers: {} };
  let curWorld = 0, curLevel = 0;

  UI.init = function () {
    buildMenu();
    buildLevels();
    buildSheets();
    buildHUD();
    buildResult();
    buildPause();
    buildToasts();
    wireGlobal();
    UI.showMenu();
  };

  // ---------------- main menu: clean, only PLAY + SKINS ----------------
  function buildMenu() {
    const m = el('div', 'screen', ''); m.id = 'menu';
    m.innerHTML = `
      <div class="topbar">
        <div class="pill coins" id="menuCoins">0</div>
      </div>
      <div class="menuMid">
        <div class="title">TERRITORY<br>TRAILS <span>3D</span></div>
        <div class="tag">DRAW · ENCLOSE · CONQUER</div>
      </div>
      <div class="menuBottom">
        <button class="bigbtn skins" id="btnSkins">SKINS</button>
        <button class="bigbtn play" id="btnPlay">PLAY ${ic('play')}</button>
      </div>`;
    document.body.appendChild(m);
    $('btnPlay').onclick = () => { AudioSys.sfx.click(); UI.handlers.play(); };
    $('btnSkins').onclick = () => { AudioSys.sfx.click(); openSheet('skins'); };
  }

  UI.refreshMenu = function () {
    $('menuCoins').innerHTML = fmt(Save.get().coins) + ' ' + ic('coin', 'gold');
  };

  // ---------------- level select: stacked cards ----------------
  function buildLevels() {
    const l = el('div', 'screen', ''); l.id = 'levels';
    l.innerHTML = `
      <div class="topbar">
        <button class="iconbtn" id="btnBack" aria-label="Back">${ic('back')}</button>
        <div class="pill coins" id="lvlCoins">0</div>
        <div class="spacer"></div>
        <button class="iconbtn" id="btnGift" aria-label="Daily reward">${ic('gift')}</button>
        <button class="iconbtn" id="btnMissions" aria-label="Missions">${ic('target')}</button>
        <button class="iconbtn" id="btnSettings" aria-label="Settings">${ic('gear')}</button>
      </div>
      <div class="worldWrap"><div class="worldRow" id="worldRow"></div></div>
      <div class="lvlStack" id="lvlStack"></div>`;
    document.body.appendChild(l);
    $('btnBack').onclick = () => { AudioSys.sfx.click(); UI.showMenu(); };
    $('btnSettings').onclick = () => { AudioSys.sfx.click(); openSheet('settings'); };
    $('btnMissions').onclick = () => { AudioSys.sfx.click(); openSheet('missions'); };
    $('btnGift').onclick = () => {
      AudioSys.sfx.click();
      if (Save.dailyClaimable()) {
        const r = Save.claimDaily();
        toast(`Daily reward, day ${r.day + 1}: +${r.reward} ${ic('coin', 'gold')}`);
        AudioSys.sfx.coin();
        refreshLevels();
      } else toast('Come back tomorrow for your daily reward');
    };
  }

  function refreshLevels() {
    const s = Save.get();
    $('lvlCoins').innerHTML = fmt(s.coins) + ' ' + ic('coin', 'gold');
    $('btnGift').classList.toggle('pulse', Save.dailyClaimable());
    const wr = $('worldRow'); wr.innerHTML = '';
    CFG.WORLDS.forEach((w, i) => {
      const unlocked = Save.worldUnlocked(i, CFG.WORLDS);
      const b = el('button', 'chip world' + (i === curWorld ? ' sel' : '') + (unlocked ? '' : ' lock'),
        (unlocked ? '' : ic('lock', 'dim')) + w.name);
      b.onclick = () => {
        if (!unlocked) { toast(`Earn ${w.unlockStars} stars to unlock ${w.name}`); return; }
        AudioSys.sfx.click(); curWorld = i; refreshLevels();
      };
      wr.appendChild(b);
    });
    const stack = $('lvlStack'); stack.innerHTML = '';
    for (let i = 0; i < CFG.LEVELS_PER_WORLD; i++) {
      const unlocked = Save.levelUnlocked(curWorld, i, CFG.WORLDS);
      const def = CFG.levelDef(curWorld, i);
      const st = s.stars[curWorld + '-' + i] || 0;
      const best = s.best[curWorld + '-' + i] || 0;
      let stars = '';
      for (let j = 0; j < 3; j++) stars += ic(j < st ? 'star' : 'starO', 'st' + (j < st ? ' on' : ''));
      const card = el('button', 'lvlCard' + (unlocked ? '' : ' lock'), `
        <div class="lcNum">${i + 1}</div>
        <div class="lcInfo">
          <div class="lcName">LEVEL ${i + 1}</div>
          <div class="lcMeta">TARGET ${def.target}% · BOTS ${def.bots} · ${['NORMAL', 'HARD', 'EXPERT'][def.tier]}</div>
          <div class="lcStars">${unlocked ? stars : ''}</div>
        </div>
        <div class="lcRight">
          ${unlocked
          ? `<div class="lcBest">BEST ${best.toFixed(1)}%</div><div class="lcPlay">${ic('play')}</div>`
          : ic('lock', 'dim bigLock')}</div>`);
      card.style.animationDelay = (i * 0.045) + 's';
      card.onclick = () => {
        if (!unlocked) { toast('Complete the previous level first'); return; }
        AudioSys.sfx.click();
        UI.handlers.startLevel(curWorld, i);
      };
      stack.appendChild(card);
    }
  }

  UI.showLevels = function () {
    hideAll();
    refreshLevels();
    $('levels').classList.add('on');
  };

  function firstPlayable(w) {
    for (let i = CFG.LEVELS_PER_WORLD - 1; i >= 0; i--) {
      if ((Save.get().stars[w + '-' + i] || 0) >= 1) return Math.min(i + 1, CFG.LEVELS_PER_WORLD - 1);
    }
    return 0;
  }

  UI.showMenu = function () {
    hideAll();
    UI.refreshMenu();
    $('menu').classList.add('on');
  };

  // ---------------- sheets ----------------
  let sheets = {};
  function buildSheets() {
    sheets.skins = sheet('skins', 'SKINS');
    sheets.settings = sheet('settings', 'SETTINGS');
    sheets.missions = sheet('missions', 'MISSIONS');
  }
  function sheet(id, title) {
    const s = el('div', 'sheet', `<div class="sheetCard"><h2>${title}</h2><div class="sheetBody" id="sb_${id}"></div><button class="bigbtn close" id="sc_${id}">CLOSE</button></div>`);
    s.id = 'sheet_' + id;
    document.body.appendChild(s);
    $('sc_' + id).onclick = () => { AudioSys.sfx.click(); closeSheets(); };
    return s;
  }
  function openSheet(id) {
    closeSheets();
    if (id === 'skins') fillSkins();
    if (id === 'settings') fillSettings();
    if (id === 'missions') fillMissions();
    sheets[id].classList.add('on');
  }
  function closeSheets() { for (const k in sheets) sheets[k].classList.remove('on'); }

  function fillSkins() {
    const body = $('sb_skins'); body.innerHTML = '';
    const s = Save.get();
    const grid = el('div', 'skinGrid');
    CFG.SKINS.forEach((sk) => {
      const owned = s.skins.includes(sk.id);
      const sel = s.skin === sk.id;
      const card = el('div', 'skinCard' + (sel ? ' sel' : ''));
      const sw = sk.color === 'rainbow' ? 'background:conic-gradient(#f33,#fa0,#ff0,#3c6,#0cf,#33f,#f33)' : `background:${sk.color}`;
      card.innerHTML = `<div class="skinPrev" style="${sw}">${ic(sk.model, 'skinIc')}</div>
        <div class="skinName">${sk.name}</div>
        <div class="skinCost">${owned ? (sel ? 'EQUIPPED' : 'EQUIP') : fmt(sk.cost) + ' ' + ic('coin', 'gold')}</div>`;
      card.onclick = () => {
        AudioSys.sfx.click();
        if (owned) { Save.selectSkin(sk.id); }
        else if (s.coins >= sk.cost) { Save.addCoins(-sk.cost); Save.unlockSkin(sk.id); Save.selectSkin(sk.id); AudioSys.sfx.power(); toast(`${sk.name} unlocked`); }
        else { toast('Not enough coins'); return; }
        fillSkins(); UI.refreshMenu(); UI.handlers.preview();
      };
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  function fillSettings() {
    const body = $('sb_settings'); body.innerHTML = '';
    const s = Save.get().settings;
    const row = (label, input) => { const r = el('div', 'setRow'); r.append(el('label', '', label), input); body.appendChild(r); };
    const slider = (val, cb) => { const i = el('input'); i.type = 'range'; i.min = 0; i.max = 100; i.value = val * 100; i.oninput = () => cb(i.value / 100); return i; };
    const toggle = (val, cb) => { const i = el('input'); i.type = 'checkbox'; i.checked = val; i.onchange = () => cb(i.checked); return i; };
    row('Music', slider(s.music, (v) => { Save.updateSettings({ music: v }); AudioSys.setVolumes(v, Save.get().settings.sfx); }));
    row('Sound FX', slider(s.sfx, (v) => { Save.updateSettings({ sfx: v }); AudioSys.setVolumes(Save.get().settings.music, v); }));
    row('Haptics', toggle(s.haptics, (v) => Save.updateSettings({ haptics: v })));
    row('Shadows', toggle(s.shadows, (v) => Save.updateSettings({ shadows: v })));
    row('High quality', toggle(s.quality === 'high', (v) => { Save.updateSettings({ quality: v ? 'high' : 'low' }); UI.handlers.quality(); }));
    const reset = el('button', 'bigbtn danger', 'RESET PROGRESS');
    reset.onclick = () => { if (confirm('Reset all progress?')) { Save.resetProgress(); UI.refreshMenu(); fillSettings(); toast('Progress reset'); } };
    body.appendChild(reset);
  }

  function fillMissions() {
    const body = $('sb_missions'); body.innerHTML = '';
    const s = Save.get();
    s.missions = s.missions || {};
    const defs = [
      { id: 'coins100', label: 'Collect 100 coins total', prog: Math.min(100, s.stats.coinsCollected), goal: 100, reward: 200 },
      { id: 'kills10', label: 'Defeat 10 bots', prog: Math.min(10, s.stats.kills), goal: 10, reward: 300 },
      { id: 'wins5', label: 'Win 5 levels', prog: Math.min(5, s.stats.wins), goal: 5, reward: 500 },
      { id: 'cap5000', label: 'Capture 5,000 cells cumulative', prog: Math.min(5000, s.stats.captures), goal: 5000, reward: 400 },
    ];
    defs.forEach((d) => {
      const done = d.prog >= d.goal;
      const claimed = s.missions[d.id];
      const r = el('div', 'missionRow');
      r.innerHTML = `<div class="mInfo"><div>${d.label}</div><div class="mProg">${d.prog} / ${d.goal}</div></div>`;
      const b = el('button', 'bigbtn claim' + (done && !claimed ? ' glow' : ''), claimed ? 'DONE' : done ? `+${d.reward} ${ic('coin', 'gold')}` : `${d.prog}/${d.goal}`);
      b.disabled = !done || claimed;
      b.onclick = () => { Save.addCoins(d.reward); s.missions[d.id] = 1; Save.persist(); AudioSys.sfx.coin(); toast(`+${d.reward} coins`); fillMissions(); UI.refreshMenu(); };
      r.appendChild(b);
      body.appendChild(r);
    });
  }

  // ---------------- HUD ----------------
  let mini = null, miniOff = null, miniImg = null, lastCoins = -1;
  function buildHUD() {
    const h = el('div', 'screen hud', ''); h.id = 'hud';
    h.innerHTML = `
      <div class="hudTop">
        <div class="hudLeft">
          <button class="iconbtn" id="btnPause" aria-label="Pause">${ic('pause')}</button>
          <div class="pill" id="hudCoins">0 ${ic('coin', 'gold')}</div>
          <div class="pill" id="hudKills">${ic('skull', 'dimw')} 0</div>
        </div>
        <div class="hudCenter">
          <div class="pctBig" id="hudPct">0.0%</div>
          <div class="bar target"><div class="fill" id="hudBar"></div></div>
          <div class="tiny" id="hudGoal"></div>
        </div>
        <div class="hudRight" id="hudLeader"></div>
      </div>
      <div class="hudBottom">
        <canvas id="minimap" width="150" height="150"></canvas>
        <div class="powerChips" id="powerChips"></div>
      </div>
      <div id="joyBase" class="joyBase"><div class="joyKnob" id="joyKnob"></div></div>
      <div id="touchLayer"></div>
      <div id="newBest" class="newBest">NEW BEST!</div>`;
    document.body.appendChild(h);
    mini = $('minimap');
    miniOff = document.createElement('canvas'); miniOff.width = CFG.GRID; miniOff.height = CFG.GRID;
    miniImg = miniOff.getContext('2d').createImageData(CFG.GRID, CFG.GRID);

    $('btnPause').onclick = () => { AudioSys.sfx.click(); UI.handlers.pause(); };
    wireJoystick();
  }

  let rgbCache = {};
  function hexRgb(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    const n = parseInt(hex.slice(1), 16);
    return (rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }

  UI.drawMinimap = function (state, entities) {
    const d = miniImg.data;
    for (let i = 0; i < state.owner.length; i++) {
      const o = state.owner[i];
      const j = i * 4;
      if (o === 255) { d[j + 3] = 0; continue; }
      if (o === 254) { d[j] = 70; d[j + 1] = 78; d[j + 2] = 92; d[j + 3] = 235; continue; } // obstacles
      const c = hexRgb(entities[o].color);
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 210;
    }
    miniOff.getContext('2d').putImageData(miniImg, 0, 0);
    const x = mini.getContext('2d'), S = 150, R = S / 2 - 3;
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath(); x.arc(S / 2, S / 2, R, 0, 7); x.clip();
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, 0, S, S);
    x.drawImage(miniOff, 0, 0, S, S);
    for (const e of entities) {
      if (!e.alive) continue;
      const px = (e.pos.x / CFG.GRID) * S, py = (e.pos.z / CFG.GRID) * S;
      x.beginPath(); x.arc(px, py, e.isBot ? 3.4 : 4.6, 0, 7);
      x.fillStyle = e.isBot ? e.color : '#ffffff'; x.fill();
      if (!e.isBot) { x.lineWidth = 2; x.strokeStyle = e.color; x.stroke(); }
    }
    x.restore();
    x.beginPath(); x.arc(S / 2, S / 2, R, 0, 7);
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.stroke();
  };

  UI.hud = function (d) {
    const coinEl = $('hudCoins');
    coinEl.innerHTML = fmt(d.runCoins) + ' ' + ic('coin', 'gold');
    if (lastCoins >= 0 && d.runCoins > lastCoins) {
      coinEl.classList.remove('bump'); void coinEl.offsetWidth; coinEl.classList.add('bump');
    }
    lastCoins = d.runCoins;
    $('hudKills').innerHTML = ic('skull', 'dimw') + ' ' + d.kills;
    $('hudPct').textContent = d.pct.toFixed(1) + '%';
    $('hudBar').style.width = Math.min(100, (d.pct / d.target) * 100) + '%';
    $('hudGoal').innerHTML = `${ic('coin', 'gold sm')} ${d.collected}/${d.coinGoal} for ${ic('star', 'gold sm')}${ic('star', 'gold sm')}`;
    const chips = [];
    if (d.shield) chips.push(ic('shield', 'cyan'));
    if (d.boost) chips.push(ic('bolt', 'gold'));
    if (d.magnet) chips.push(ic('magnet', 'purple'));
    $('powerChips').innerHTML = chips.join('');
  };

  UI.leader = function (rows) {
    $('hudLeader').innerHTML = rows.map((r, i) =>
      `<div class="lbRow${r.me ? ' me' : ''}" style="background:${r.color}">${i + 1} · ${r.pct.toFixed(1)}% ${r.name}</div>`).join('');
  };

  UI.newBest = function () {
    const nb = $('newBest');
    nb.classList.remove('on');
    void nb.offsetWidth;
    nb.classList.add('on');
    confetti(50);
  };

  UI.power = function (type) {
    const names = { speed: 'Speed Boost activated', shield: 'Shield equipped', magnet: 'Coin Magnet activated', 'shield-used': 'Shield saved you' };
    toast(names[type] || type);
  };

  UI.showHUD = function () { hideAll(); lastCoins = -1; $('hud').classList.add('on'); };

  // ---------------- joystick ----------------
  function wireJoystick() {
    const layer = $('touchLayer'), base = $('joyBase'), knob = $('joyKnob');
    let id = null, ox = 0, oy = 0;
    const R = 56;
    layer.addEventListener('touchstart', (e) => {
      if (id !== null) return;
      const t = e.changedTouches[0];
      id = t.identifier; ox = t.clientX; oy = t.clientY;
      base.style.left = ox + 'px'; base.style.top = oy + 'px';
      base.classList.add('on');
      e.preventDefault();
    }, { passive: false });
    layer.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        let dx = t.clientX - ox, dy = t.clientY - oy;
        const d = Math.hypot(dx, dy) || 1;
        const cl = Math.min(d, R);
        dx = dx / d * cl; dy = dy / d * cl;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        UI.handlers.input(dx / R, dy / R, true);
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        id = null;
        base.classList.remove('on');
        knob.style.transform = 'translate(0,0)';
        UI.handlers.input(0, 0, false);
      }
    };
    layer.addEventListener('touchend', end);
    layer.addEventListener('touchcancel', end);
  }

  // ---------------- pause ----------------
  function buildPause() {
    const p = el('div', 'screen overlay', ''); p.id = 'pause';
    p.innerHTML = `<div class="card"><h2>PAUSED</h2>
      <button class="bigbtn" id="pResume">RESUME</button>
      <button class="bigbtn" id="pRestart">RESTART</button>
      <button class="bigbtn" id="pQuit">QUIT TO MENU</button></div>`;
    document.body.appendChild(p);
    $('pResume').onclick = () => { AudioSys.sfx.click(); UI.handlers.resume(); };
    $('pRestart').onclick = () => { AudioSys.sfx.click(); UI.handlers.restart(); };
    $('pQuit').onclick = () => { AudioSys.sfx.click(); UI.handlers.quit(); };
  }
  UI.showPause = function () { $('pause').classList.add('on'); };
  UI.hidePause = function () { $('pause').classList.remove('on'); };

  // ---------------- result ----------------
  function buildResult() {
    const r = el('div', 'screen overlay', ''); r.id = 'result';
    r.innerHTML = `<div class="card result">
      <h2 id="rTitle">LEVEL COMPLETE!</h2>
      <div class="rStars" id="rStars"></div>
      <div class="rStats" id="rStats"></div>
      <button class="bigbtn play" id="rNext">NEXT LEVEL ${ic('play')}</button>
      <button class="bigbtn" id="rRetry">RETRY</button>
      <button class="bigbtn" id="rMenu">MENU</button></div>`;
    document.body.appendChild(r);
    $('rNext').onclick = () => { AudioSys.sfx.click(); UI.handlers.next(); };
    $('rRetry').onclick = () => { AudioSys.sfx.click(); UI.handlers.restart(); };
    $('rMenu').onclick = () => { AudioSys.sfx.click(); UI.handlers.quit(); };
  }

  UI.showResult = function (res, level) {
    hideAll();
    $('result').classList.add('on');
    $('rTitle').textContent = res.won ? 'LEVEL COMPLETE!' : 'RUN OVER';
    $('rTitle').style.color = res.won ? '#3ecb4f' : '#ff6b6b';
    $('rStars').innerHTML = res.won
      ? [1, 2, 3].map((i) => `<span class="starSlot${i <= res.stars ? ' got' : ''}" style="animation-delay:${i * 0.25}s">${ic(i <= res.stars ? 'star' : 'starO', 'bigStar')}</span>`).join('')
      : `<span class="starSlot got">${ic('skull', 'bigStar red')}</span>`;
    $('rStats').innerHTML = `
      <div class="rRow"><span>TERRITORY</span><b>${res.pct.toFixed(1)}%</b></div>
      <div class="rRow"><span>TARGET</span><b>${level.target}%</b></div>
      <div class="rRow"><span>COINS EARNED</span><b id="rCoins">+0 ${ic('coin', 'gold')}</b></div>
      <div class="rRow"><span>KILLS</span><b>${res.kills}</b></div>
      <div class="rRow"><span>COINS COLLECTED</span><b>${res.collected}</b></div>`;
    // animated coin count-up
    const elC = $('rCoins');
    const t0 = performance.now();
    (function tick(t) {
      const k = Math.min(1, (t - t0) / 900);
      const v = Math.round(res.coins * (1 - Math.pow(1 - k, 3)));
      elC.innerHTML = `+${fmt(v)} ${ic('coin', 'gold')}`;
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
    const hasNext = res.won && curLevel < CFG.LEVELS_PER_WORLD - 1;
    $('rNext').style.display = hasNext ? '' : 'none';
    if (res.won) confetti(80);
  };

  // ---------------- toasts & confetti ----------------
  let toastBox;
  function buildToasts() { toastBox = el('div', 'toasts'); document.body.appendChild(toastBox); }
  function toast(msg) {
    const t = el('div', 'toast', msg);
    toastBox.appendChild(t);
    setTimeout(() => t.classList.add('bye'), 2200);
    setTimeout(() => t.remove(), 2700);
  }
  function confetti(n) {
    for (let i = 0; i < n; i++) {
      const c = el('div', 'confetti');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = CFG.COLORS[i % CFG.COLORS.length];
      c.style.animationDelay = (Math.random() * 0.4) + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 2600);
    }
  }

  function hideAll() {
    ['menu', 'levels', 'hud', 'pause', 'result'].forEach((id) => $(id).classList.remove('on'));
    closeSheets();
  }

  function wireGlobal() {
    document.addEventListener('pointerdown', () => AudioSys.unlock());
  }

  function fmt(n) { return n >= 100000 ? (n / 1000).toFixed(0) + 'k' : n.toLocaleString(); }

  UI.fmt = fmt;
  UI.getSelection = () => ({ world: curWorld, level: curLevel });
  UI.setSelection = (w, l) => { curWorld = w; curLevel = l; };
  UI.toast = toast;
  UI.confetti = confetti;
  global.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
