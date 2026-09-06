/* ============================================================
   Territory Trails 3D — bootstrap / app controller
   Renderer, main loop, menu preview, input, screen flow.
   ============================================================ */
(function () {
  'use strict';
  const CFG = window.TT3D_CFG, Save = window.Save, AudioSys = window.AudioSys, W3D = window.W3D, UI = window.UI;

  let renderer, session = null, preview = null, mode = 'menu';
  let keys = {};
  let lastT = 0;

  function applyQuality() {
    const s = Save.get().settings;
    renderer.setPixelRatio(s.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !!s.shadows;
  }

  function buildPreview() {
    const sel = UI.getSelection();
    const s = Save.get();
    const skinDef = CFG.SKINS.find((k) => k.id === s.skin) || CFG.SKINS[0];
    preview = W3D.buildPreviewScene(CFG.WORLDS[sel.world], skinDef);
    preview.cam.aspect = window.innerWidth / window.innerHeight;
    preview.cam.updateProjectionMatrix();
  }

  function currentLevelDef() {
    const sel = UI.getSelection();
    return CFG.levelDef(sel.world, sel.level);
  }

  function startGame() {
    const sel = UI.getSelection();
    const s = Save.get();
    const skinDef = CFG.SKINS.find((k) => k.id === s.skin) || CFG.SKINS[0];
    const level = CFG.levelDef(sel.world, sel.level);
    session = new GameSession(renderer, {
      onHud: (d) => UI.hud(d),
      onLeader: (r) => UI.leader(r),
      onMinimap: (st, en) => UI.drawMinimap(st, en),
      onNewBest: () => UI.newBest(),
      onPower: (t) => UI.power(t),
      onEnd: (res) => {
        Save.recordResult(sel.world, sel.level, {
          stars: res.stars, pct: res.pct, coins: res.coins,
          kills: res.kills, captures: res.captures,
          coinsCollected: res.collected, won: res.won,
        });
        setTimeout(() => UI.showResult(res, level, sel.world), 1000);
      },
    });
    session.start({
      world: CFG.WORLDS[sel.world],
      level,
      skinDef,
      settings: s.settings,
      playerName: 'You',
      bestAtStart: s.best[sel.world + '-' + sel.level] || 0,
    });
    session.aspect(window.innerWidth / window.innerHeight);
    mode = 'game';
    UI.showHUD();
    AudioSys.startMusic();
  }

  function toMenu() {
    session = null;
    mode = 'menu';
    buildPreview();
    UI.showMenu();
  }

  function boot() {
    Save.load();
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;                 // correct color space
    renderer.toneMapping = THREE.ACESFilmicToneMapping;           // filmic high-end response
    renderer.toneMappingExposure = 1.08;
    applyQuality();
    document.getElementById('gl').appendChild(renderer.domElement);

    AudioSys.setVolumes(Save.get().settings.music, Save.get().settings.sfx);

    UI.init();
    UI.handlers = {
      play: () => UI.showLevels(),
      startLevel: (w, l) => { UI.setSelection(w, l); startGame(); },
      preview: () => { if (mode === 'menu') buildPreview(); },
      input: (x, z, a) => { if (session) session.setInput(x, z, a); },
      pause: () => { if (session && !session.over) { session.setPaused(true); UI.showPause(); } },
      resume: () => { if (session) session.setPaused(false); UI.hidePause(); },
      restart: () => { UI.hidePause(); startGame(); },
      quit: () => toMenu(),
      next: () => {
        const sel = UI.getSelection();
        UI.setSelection(sel.world, Math.min(sel.level + 1, CFG.LEVELS_PER_WORLD - 1));
        startGame();
      },
      quality: () => applyQuality(),
    };
    buildPreview();

    // keyboard steering (desktop testing)
    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape' && mode === 'game' && session && !session.over) UI.handlers.pause();
      kb();
    });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; kb(); });
    function kb() {
      if (!session) return;
      let x = 0, z = 0;
      if (keys['arrowleft'] || keys['a']) x -= 1;
      if (keys['arrowright'] || keys['d']) x += 1;
      if (keys['arrowup'] || keys['w']) z -= 1;
      if (keys['arrowdown'] || keys['s']) z += 1;
      if (x || z) session.setInput(x, z, true);
      else if (!touchActive) session.setInput(0, 0, false);
    }
    let touchActive = false;
    const origInput = UI.handlers.input;
    UI.handlers.input = (x, z, a) => { touchActive = a; origInput(x, z, a); };

    window.addEventListener('resize', () => {
      applyQuality();
      if (session) session.aspect(window.innerWidth / window.innerHeight);
      if (preview) { preview.cam.aspect = window.innerWidth / window.innerHeight; preview.cam.updateProjectionMatrix(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && mode === 'game' && session && !session.over) UI.handlers.pause();
    });

    // service worker (offline-first for PWA / Play Store wrapper)
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (mode === 'menu' && preview) {
      preview.character.rotation.y += dt * 0.8;
      if (preview.character.userData.float) preview.character.position.y = Math.sin(t / 400) * 0.15;
      preview.scene.traverse((o) => { if (o.userData && o.userData.v) { o.position.x += o.userData.v * dt; if (o.position.x > 20) o.position.x = -20; } });
      renderer.render(preview.scene, preview.cam);
    } else if (mode === 'game' && session) {
      session.update(dt);
      session.render();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
