/* ============================================================
   Territory Trails 3D — game session engine (upgraded)
   Obstacle fields, slide collision, bot avoidance, capture
   rings, banking tilt, dynamic camera zoom, contact shadows,
   1K anisotropic overlay, particles, minimap, leaderboard.
   ============================================================ */
(function (global) {
  'use strict';
  const CFG = global.TT3D_CFG, Logic = global.Logic, W3D = global.W3D;
  const GRID = CFG.GRID;

  let sparkTex = null;
  function getSparkTex() {
    if (sparkTex) return sparkTex;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    sparkTex = new THREE.CanvasTexture(c);
    return sparkTex;
  }

  const normAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class Particles {
    constructor(scene, color) {
      this.max = 220;
      this.pos = new Float32Array(this.max * 3);
      this.vel = new Float32Array(this.max * 3);
      this.life = new Float32Array(this.max);
      for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -50;
      this.head = 0;
      this.geo = new THREE.BufferGeometry();
      this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      this.mat = new THREE.PointsMaterial({ size: 0.8, map: getSparkTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(color) });
      this.pts = new THREE.Points(this.geo, this.mat);
      this.pts.frustumCulled = false;
      scene.add(this.pts);
    }
    spawn(x, y, z, n, spread, up) {
      for (let k = 0; k < n; k++) {
        const i = this.head = (this.head + 1) % this.max;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = (Math.random() - 0.5) * spread;
        this.vel[i * 3 + 1] = Math.random() * (up || 2);
        this.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
        this.life[i] = 0.6 + Math.random() * 0.5;
      }
    }
    update(dt) {
      for (let i = 0; i < this.max; i++) {
        if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -50; continue; }
        this.life[i] -= dt;
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      }
      this.geo.attributes.position.needsUpdate = true;
    }
  }

  class GameSession {
    constructor(renderer, hooks) {
      this.renderer = renderer;
      this.hooks = hooks;
      this.input = { x: 0, z: 0, active: false };
      this.paused = false;
      this.over = false;
      this.maxAniso = renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 1;
    }

    start(opts) {
      const { world, level, skinDef, settings } = opts;
      this.world = world; this.level = level; this.settings = settings;
      this.time = 0;
      this.over = false; this.paused = false;
      this.runCoins = 0; this.collected = 0; this.deaths = 0; this.captures = 0;
      this.newBestShown = false;
      this.bestAtStart = opts.bestAtStart || 0;
      this.shake = 0;
      this.rings = [];

      this.state = Logic.makeState(GRID, CFG.MAX_PLAYERS);
      const w = W3D.buildWorldScene(world, settings.shadows, settings.quality, this.maxAniso);
      this.scene = w.scene; this.sun = w.sun;
      this.octx = w.overlayCtx; this.otex = w.overlayTex;
      this.oS = w.overlayCanvas.width / GRID;
      // low-res territory buffer, upscaled with bilinear smoothing (no boxy cells)
      this.low = document.createElement('canvas');
      this.low.width = GRID; this.low.height = GRID;
      this.lowCtx = this.low.getContext('2d');
      this.lowImg = this.lowCtx.createImageData(GRID, GRID);
      this.rgb = {};
      this.clouds = w.clouds;
      this.cam = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
      this.camH = 23.5;

      // ---- entities (homes first so obstacles avoid them) ----
      this.entities = [];
      const botCount = level.bots;
      const names = CFG.BOT_NAMES.slice().sort(() => Math.random() - 0.5);
      const tiers = [
        ['passive', 'explorer'],
        ['explorer', 'aggressive', 'hunter'],
        ['aggressive', 'hunter', 'champion'],
      ][level.tier];
      const homes = [];
      for (let i = 0; i <= botCount; i++) {
        const angle = (i / (botCount + 1)) * Math.PI * 2 + 0.7;
        homes.push({
          x: Math.round(GRID / 2 + Math.cos(angle) * GRID * 0.34),
          z: Math.round(GRID / 2 + Math.sin(angle) * GRID * 0.34),
        });
      }
      this.spawnObstacles(level, homes);

      for (let i = 0; i <= botCount; i++) {
        const isPlayer = i === 0;
        const hx = homes[i].x, hz = homes[i].z;
        const color = isPlayer ? (skinDef.color === 'rainbow' ? CFG.COLORS[0] : skinDef.color) : CFG.COLORS[i % CFG.COLORS.length];
        const pers = CFG.PERSONALITIES[isPlayer ? 'explorer' : tiers[(Math.random() * tiers.length) | 0]];
        const e = {
          idx: i, isBot: !isPlayer,
          name: isPlayer ? (opts.playerName || 'You') : names[i % names.length],
          color,
          pos: new THREE.Vector3(hx + 0.5, 0, hz + 0.5),
          heading: Math.random() * 6.28,
          speed: isPlayer ? level.speed : pers.speed * (0.9 + Math.random() * 0.2),
          turn: isPlayer ? 5.2 : pers.turn,
          alive: true, trailPts: [], lastCell: -1,
          home: { x: hx + 0.5, z: hz + 0.5 },
          kills: 0, steer: 0,
          shield: false, boostUntil: 0, magnetUntil: 0, invUntil: 0, respawnAt: 0,
          ai: { state: 'expand', timer: 1 + Math.random() * 2, angle: Math.random() * 6.28, pers, side: 1, stuckT: 0.7, lx: 0, lz: 0 },
          label: W3D.makeLabel(),
        };
        const sd = isPlayer ? skinDef : { model: ['cube', 'boat', 'penguin', 'robot', 'ghost'][(Math.random() * 5) | 0], color };
        e.mesh = W3D.makeSkinMesh(sd);
        e.mesh.rotation.order = 'YXZ';
        e.mesh.position.copy(e.pos);
        e.blob = W3D.makeBlobShadow();
        e.blob.position.set(e.pos.x, 0.05, e.pos.z);
        this.scene.add(e.mesh); this.scene.add(e.blob);
        e.label.sprite.position.set(e.pos.x, 3.6, e.pos.z);
        this.scene.add(e.label.sprite);
        Logic.seed(this.state, i, hx, hz, level.seedR);
        this.entities.push(e);
      }
      this.player = this.entities[0];

      // ---- coins ----
      this.coins = [];
      const coinMeshBase = W3D.makeCoinMesh();
      for (let i = 0; i < level.coins; i++) {
        const m = coinMeshBase.clone();
        const p = this.randPos();
        m.position.set(p.x, 0.7, p.z);
        this.scene.add(m);
        this.coins.push({ x: p.x, z: p.z, mesh: m });
      }
      this.powers = [];
      this.powerTimer = 6;

      this.particles = new Particles(this.scene, this.player.color);
      this.ringGeo = new THREE.RingGeometry(0.6, 0.78, 40);

      this.redrawOverlay();
      this.hudTimer = 0; this.leaderTimer = 0; this.labelTimer = 0; this.miniTimer = 0;
      this.hooks.onStart && this.hooks.onStart();
    }

    randPos() {
      for (let t = 0; t < 20; t++) {
        const x = 4 + Math.random() * (GRID - 8), z = 4 + Math.random() * (GRID - 8);
        if (!Logic.isBlocked(this.state, x | 0, z | 0)) return { x, z };
      }
      return { x: GRID / 2, z: GRID / 2 };
    }

    // ---------------- obstacle field generation ----------------
    spawnObstacles(level, homes) {
      const nearHome = (x, z) => homes.some((h) => (h.x - x) * (h.x - x) + (h.z - z) * (h.z - z) < 90);
      const put = (x, z) => {
        x |= 0; z |= 0;
        if (x < 3 || z < 3 || x > GRID - 4 || z > GRID - 4) return;
        if (nearHome(x, z)) return;
        const i = z * GRID + x;
        if (this.state.owner[i] !== Logic.NONE) return;
        Logic.setBlocked(this.state, x, z);
        const m = W3D.makeObstacleMesh(this.world);
        m.position.set(x + 0.5, 0, z + 0.5);
        m.scale.multiplyScalar(0.9 + Math.random() * 0.35);
        this.scene.add(m);
      };
      for (const ob of level.obstacles) {
        if (ob.type === 'pillars') {
          for (let i = 0; i < ob.count; i++) put(8 + Math.random() * (GRID - 16), 8 + Math.random() * (GRID - 16));
        } else if (ob.type === 'ring') {
          const R = 34, C = GRID / 2;
          const steps = 96;
          for (let i = 0; i < steps; i++) {
            if (i % 12 < 4) continue; // gate gaps
            const a = (i / steps) * Math.PI * 2;
            put(C + Math.cos(a) * R, C + Math.sin(a) * R);
          }
        } else if (ob.type === 'clusters') {
          for (let cI = 0; cI < ob.count; cI++) {
            const cx = 15 + Math.random() * (GRID - 30), cz = 15 + Math.random() * (GRID - 30);
            for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(cx + dx, cz + dz);
          }
        }
      }
    }

    // ---------------- overlay painting (smooth, not boxy) ----------------
    hexRgb(hex) {
      if (this.rgb[hex]) return this.rgb[hex];
      const n = parseInt(hex.slice(1), 16);
      return (this.rgb[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    }

    redrawOverlay() {
      const x = this.octx, S = this.oS * GRID, s = this.oS;
      // 1) territory: one pixel per cell, then bilinear upscale -> soft smooth blobs
      const d = this.lowImg.data;
      const owner = this.state.owner;
      for (let i = 0; i < owner.length; i++) {
        const o = owner[i];
        const j = i * 4;
        if (o === 255 || o === 254) { d[j + 3] = 0; continue; }
        const c = this.hexRgb(this.entities[o].color);
        d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 212;
      }
      this.lowCtx.putImageData(this.lowImg, 0, 0);
      x.clearRect(0, 0, S, S);
      x.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in x) x.imageSmoothingQuality = 'high';
      x.drawImage(this.low, 0, 0, S, S);
      // 2) trails: smooth vector polyline through REAL movement positions
      for (const e of this.entities) {
        if (e.trailPts.length < 1) continue;
        x.globalAlpha = 0.95;
        x.strokeStyle = e.color; x.lineWidth = s * 0.9; x.lineCap = 'round'; x.lineJoin = 'round';
        x.shadowColor = e.color; x.shadowBlur = 12;
        x.beginPath();
        x.moveTo(e.trailPts[0][0] * s, e.trailPts[0][1] * s);
        for (let i = 1; i < e.trailPts.length; i++) x.lineTo(e.trailPts[i][0] * s, e.trailPts[i][1] * s);
        x.lineTo(e.pos.x * s, e.pos.z * s);
        x.stroke();
        x.shadowBlur = 0;
      }
      x.globalAlpha = 1;
      this.otex.needsUpdate = true;
    }

    paintTrailSeg(e, prev, cur) {
      const x = this.octx, s = this.oS;
      x.globalAlpha = 0.95;
      x.strokeStyle = e.color; x.lineWidth = s * 0.9; x.lineCap = 'round';
      x.shadowColor = e.color; x.shadowBlur = 12;
      x.beginPath();
      x.moveTo(prev[0] * s, prev[1] * s);
      x.lineTo(cur[0] * s, cur[1] * s);
      x.stroke();
      x.shadowBlur = 0; x.globalAlpha = 1;
      this.otex.needsUpdate = true;
    }

    spawnRing(x, z, color) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(color), transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.12, z);
      this.scene.add(m);
      this.rings.push({ m, t: 0 });
    }

    // ---------------- gameplay ----------------
    logicStep(e, cx, cy, prevIdx) {
      const ev = Logic.stepOn(this.state, e.idx, cx, cy);
      if (ev.killed >= 0 && this.entities[ev.killed]) this.kill(this.entities[ev.killed], e);
      if (ev.trailed) {
        const prevCell = prevIdx >= 0 ? [prevIdx % GRID, Math.floor(prevIdx / GRID)] : null;
        const prevPos = e.trailPts.length ? e.trailPts[e.trailPts.length - 1] : [e.pos.x, e.pos.z];
        if (prevCell && prevCell[0] !== cx && prevCell[1] !== cy) {
          // keep the logical boundary leak-proof on diagonals (visual trail stays smooth)
          const mi = prevCell[1] * GRID + cx;
          if (this.state.owner[mi] !== e.idx && this.state.trail[mi] !== e.idx && this.state.owner[mi] !== Logic.BLOCKED) {
            this.state.trail[mi] = e.idx;
          }
        }
        e.trailPts.push([e.pos.x, e.pos.z]);
        this.paintTrailSeg(e, prevPos, [e.pos.x, e.pos.z]);
        if (!e.isBot && e.trailPts.length === 1) AudioSys.sfx.trail();
      }
      if (ev.captured) this.applyCapture(e, ev.captured);
    }

    applyCapture(e, cap) {
      e.trailPts = [];
      this.redrawOverlay();
      this.captures++;
      if (cap.changed.length) {
        let ax = 0, az = 0, n = 0;
        for (let i = 0; i < cap.changed.length; i += 7) {
          const [cx, cy] = [cap.changed[i] % GRID, (cap.changed[i] / GRID) | 0];
          ax += cx; az += cy; n++;
        }
        e.home = { x: ax / n + 0.5, z: az / n + 0.5 };
      }
      if (!e.isBot) {
        this.runCoins += Math.floor(cap.gained * CFG.ECONOMY.coinPerCell);
        this.shake = Math.min(1, this.shake + 0.5);
        this.spawnRing(e.pos.x, e.pos.z, e.color);
        this.particles.spawn(e.pos.x, 1, e.pos.z, 26, 6, 3);
        AudioSys.sfx.capture();
        this.haptics(30);
        const pct = Logic.pct(this.state, 0);
        if (!this.newBestShown && pct > this.bestAtStart && this.bestAtStart > 0) {
          this.newBestShown = true;
          AudioSys.sfx.newbest();
          this.hooks.onNewBest && this.hooks.onNewBest();
        }
        if (pct >= this.level.target) { this.endRun(true); return; }
      } else {
        this.spawnRing(e.pos.x, e.pos.z, e.color);
      }
    }

    kill(victim, killer) {
      if (!victim.alive) return;
      if (victim.invUntil > this.time) return;
      if (!victim.isBot && victim.shield) {
        victim.shield = false;
        Logic.clearTrail(this.state, victim.idx);
        victim.trailPts = [];
        this.redrawOverlay();
        this.respawn(victim);
        AudioSys.sfx.power();
        this.hooks.onPower && this.hooks.onPower('shield-used');
        return;
      }
      Logic.clearTrail(this.state, victim.idx);
      victim.trailPts = [];
      victim.alive = false;
      victim.mesh.visible = false;
      victim.blob.visible = false;
      victim.label.sprite.visible = false;
      this.redrawOverlay();
      this.particles.spawn(victim.pos.x, 1, victim.pos.z, 40, 8, 4);
      this.spawnRing(victim.pos.x, victim.pos.z, victim.color);
      if (killer) {
        killer.kills++;
        if (!killer.isBot) { this.runCoins += CFG.ECONOMY.killBonus; AudioSys.sfx.kill(); this.haptics(40); }
      }
      if (!victim.isBot) {
        this.deaths++;
        AudioSys.sfx.death();
        this.haptics([60, 40, 60]);
        this.endRun(false);
      } else {
        victim.respawnAt = this.time + 2.5;
      }
    }

    respawn(e) {
      e.alive = true;
      e.pos.set(e.home.x, 0, e.home.z);
      e.heading = Math.random() * 6.28;
      e.trailPts = [];
      e.lastCell = -1;
      e.invUntil = this.time + 2;
      e.mesh.visible = true;
      e.blob.visible = true;
      e.label.sprite.visible = true;
    }

    endRun(won) {
      if (this.over) return;
      this.over = true;
      const pct = Logic.pct(this.state, 0);
      let stars = 0;
      if (won) {
        stars = 1;
        if (this.collected >= this.level.coinGoal) stars++;
        if (this.deaths === 0 && pct >= Math.min(100, this.level.target + 10)) stars++;
      }
      const coins = this.runCoins + this.collected * CFG.ECONOMY.coinPickup + CFG.ECONOMY.starBonus[stars];
      if (won) AudioSys.sfx.win(); else AudioSys.sfx.lose();
      this.hooks.onEnd({ won, pct, stars, coins, kills: this.player.kills, collected: this.collected, captures: this.captures, time: this.time });
    }

    haptics(pattern) {
      if (this.settings.haptics && global.navigator && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { } }
    }

    setInput(x, z, active) { this.input.x = x; this.input.z = z; this.input.active = active; }
    setPaused(v) { this.paused = v; }

    // ---------------- AI ----------------
    botDesired(e, dt) {
      const ai = e.ai, p = this.player;
      const px = e.pos.x, pz = e.pos.z;
      if (px < 7 || px > GRID - 7 || pz < 7 || pz > GRID - 7) {
        return Math.atan2(GRID / 2 - px, -(GRID / 2 - pz));
      }
      // obstacle probe: steer around what's ahead
      const fx = Math.sin(e.heading), fz = -Math.cos(e.heading);
      if (Logic.isBlocked(this.state, (px + fx * 2.2) | 0, (pz + fz * 2.2) | 0)) {
        if (Math.random() < 0.2) ai.side = -ai.side;
        return normAng(e.heading + ai.side * 1.0);
      }
      if (ai.state === 'expand') {
        ai.timer -= dt;
        if (ai.timer <= 0 || e.trailPts.length > ai.pers.expand) {
          ai.state = 'return';
        } else {
          if (ai.pers.hunt > 0 && Math.random() < ai.pers.hunt * 0.02 && p.alive) {
            ai.angle = Math.atan2(p.pos.x - px, -(p.pos.z - pz));
          }
          return ai.angle;
        }
      }
      const dx = e.home.x - px, dz = e.home.z - pz;
      if (dx * dx + dz * dz < 4 && e.trailPts.length === 0) {
        ai.state = 'expand';
        ai.timer = 2 + Math.random() * 3;
        ai.angle = Math.random() * 6.28;
      }
      return Math.atan2(dx, -dz) + Math.sin(this.time * 2.2 + e.idx) * 0.25;
    }

    // ---------------- main update ----------------
    update(dt) {
      if (this.paused || this.over) return;
      this.time += dt;
      const now = this.time;

      for (const e of this.entities) {
        if (!e.alive) {
          if (e.isBot && e.respawnAt && now >= e.respawnAt) { e.respawnAt = 0; this.respawn(e); }
          continue;
        }
        let desired;
        if (!e.isBot) {
          if (this.input.active && (Math.abs(this.input.x) > 0.12 || Math.abs(this.input.z) > 0.12)) {
            desired = Math.atan2(this.input.x, -this.input.z);
          } else desired = e.heading;
        } else {
          desired = this.botDesired(e, dt);
          // stuck detection
          const ai = e.ai;
          ai.stuckT -= dt;
          if (ai.stuckT <= 0) {
            const moved = Math.hypot(e.pos.x - ai.lx, e.pos.z - ai.lz);
            if (moved < 0.5) { ai.angle = Math.random() * 6.28; ai.state = 'expand'; ai.timer = 2; }
            ai.lx = e.pos.x; ai.lz = e.pos.z; ai.stuckT = 0.7;
          }
        }
        const diff = normAng(desired - e.heading);
        const maxTurn = e.turn * dt;
        const applied = clamp(diff, -maxTurn, maxTurn);
        e.heading = normAng(e.heading + applied);
        e.steer += (applied / Math.max(maxTurn, 1e-4) - e.steer) * Math.min(1, dt * 10);

        const boost = (!e.isBot && now < e.boostUntil) ? 1.45 : 1;
        const step = e.speed * boost * dt;
        const nx = e.pos.x + Math.sin(e.heading) * step;
        const nz = e.pos.z - Math.cos(e.heading) * step;
        // slide collision against obstacles & bounds
        if (!Logic.isBlocked(this.state, nx | 0, e.pos.z | 0)) e.pos.x = clamp(nx, 1.5, GRID - 1.5);
        if (!Logic.isBlocked(this.state, e.pos.x | 0, nz | 0)) e.pos.z = clamp(nz, 1.5, GRID - 1.5);

        const cx = e.pos.x | 0, cy = e.pos.z | 0;
        const ci = cy * GRID + cx;
        if (ci !== e.lastCell) { const prev = e.lastCell; e.lastCell = ci; this.logicStep(e, cx, cy, prev); if (this.over) return; }

        const bobY = e.mesh.userData.float ? 0.4 + Math.sin(now * 2.4 + e.idx) * 0.15 : Math.sin(now * 3 + e.idx) * 0.08 + 0.05;
        e.mesh.position.set(e.pos.x, bobY, e.pos.z);
        e.mesh.rotation.y = -e.heading;
        e.mesh.rotation.z = clamp(-e.steer * 0.28, -0.3, 0.3); // banking tilt
        if (e.mesh.userData.rainbow) {
          const hue = (now * 0.35 + e.idx * 0.1) % 1;
          e.mesh.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHSL(hue, 1, 0.5); });
        }
        e.blob.position.set(e.pos.x, 0.05, e.pos.z);
        if (!e.isBot && e.trailPts.length) this.particles.spawn(e.pos.x, 0.4, e.pos.z, 1, 1.5, 1.5);
        e.label.sprite.position.set(e.pos.x, 3.6 + Math.sin(now * 2 + e.idx) * 0.1, e.pos.z);
      }

      this.updatePickups(dt);
      this.updatePowers(dt);
      this.particles.update(dt);

      // capture rings
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.t += dt;
        const k = r.t / 0.7;
        r.m.scale.setScalar(1 + k * 12);
        r.m.material.opacity = 0.9 * (1 - k);
        if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); }
      }

      for (const c of this.clouds) {
        c.position.x += c.userData.v * dt;
        if (c.position.x > GRID + 20) c.position.x = -20;
      }

      // camera: damped follow + dynamic zoom
      const p = this.player.pos;
      const k = 1 - Math.exp(-dt * 3.2);
      const targetH = 23.5 + (now < this.player.boostUntil ? 2.5 : 0);
      this.camH += (targetH - this.camH) * Math.min(1, dt * 2);
      this.cam.position.x += (p.x - this.cam.position.x) * k;
      this.cam.position.z += (p.z + 15 - this.cam.position.z) * k;
      this.cam.position.y += (this.camH - this.cam.position.y) * k;
      if (this.shake > 0.01) {
        this.cam.position.x += (Math.random() - 0.5) * this.shake;
        this.cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
        this.shake *= Math.exp(-dt * 4);
      }
      this.cam.lookAt(p.x, 0, p.z - 3);
      this.sun.position.set(p.x + 30, 60, p.z + 20);
      this.sun.target.position.set(p.x, 0, p.z);
      this.sun.target.updateMatrixWorld();

      this.hudTimer -= dt;
      if (this.hudTimer <= 0) { this.hudTimer = 0.2; this.pushHud(); }
      this.leaderTimer -= dt;
      if (this.leaderTimer <= 0) { this.leaderTimer = 1; this.pushLeader(); }
      this.labelTimer -= dt;
      if (this.labelTimer <= 0) {
        this.labelTimer = 1;
        const sorted = this.sorted();
        for (let i = 0; i < sorted.length; i++) {
          const e = sorted[i];
          e.label.set(e.name, Logic.pct(this.state, e.idx).toFixed(1) + '%', e.color, i === 0);
        }
      }
      this.miniTimer -= dt;
      if (this.miniTimer <= 0) { this.miniTimer = 0.25; this.hooks.onMinimap && this.hooks.onMinimap(this.state, this.entities); }
    }

    sorted() {
      return this.entities.slice().sort((a, b) => this.state.counts[b.idx] - this.state.counts[a.idx]);
    }

    pushHud() {
      const p = this.player;
      this.hooks.onHud({
        pct: Logic.pct(this.state, 0),
        target: this.level.target,
        runCoins: this.runCoins + this.collected * CFG.ECONOMY.coinPickup,
        collected: this.collected,
        coinGoal: this.level.coinGoal,
        kills: p.kills,
        shield: p.shield,
        boost: this.time < p.boostUntil,
        magnet: this.time < p.magnetUntil,
      });
    }

    pushLeader() {
      const sorted = this.sorted();
      const rows = sorted.slice(0, 3).map((e) => ({ name: e.name, pct: Logic.pct(this.state, e.idx), color: e.color, me: !e.isBot }));
      if (!rows.some((r) => r.me)) rows.push({ name: this.player.name, pct: Logic.pct(this.state, 0), color: this.player.color, me: true });
      this.hooks.onLeader(rows);
    }

    updatePickups(dt) {
      const p = this.player;
      if (!p.alive) return;
      const magnet = this.time < p.magnetUntil;
      for (const c of this.coins) {
        if (!c.mesh.visible) continue;
        c.mesh.rotation.y += dt * 3;
        let dx = p.pos.x - c.x, dz = p.pos.z - c.z;
        const d2 = dx * dx + dz * dz;
        if (magnet && d2 < 49) {
          const d = Math.sqrt(d2) || 1;
          c.x += (dx / d) * 14 * dt; c.z += (dz / d) * 14 * dt;
          c.mesh.position.set(c.x, 0.7, c.z);
        }
        if (d2 < 1.2) {
          c.mesh.visible = false;
          this.collected++;
          AudioSys.sfx.coin();
          this.haptics(15);
          this.particles.spawn(c.x, 1, c.z, 8, 3, 2.5);
          const np = this.randPos();
          c.x = np.x; c.z = np.z;
          setTimeout(() => { c.mesh.visible = true; c.mesh.position.set(c.x, 0.7, c.z); }, 4000);
        }
      }
    }

    updatePowers(dt) {
      const p = this.player;
      this.powerTimer -= dt;
      if (this.powerTimer <= 0 && this.powers.length < 3) {
        this.powerTimer = 10;
        const type = ['speed', 'shield', 'magnet'][(Math.random() * 3) | 0];
        const pos = this.randPos();
        const m = W3D.makePowerMesh(type);
        m.position.set(pos.x, 0.9, pos.z);
        this.scene.add(m);
        this.powers.push({ type, x: pos.x, z: pos.z, mesh: m });
      }
      for (let i = this.powers.length - 1; i >= 0; i--) {
        const pw = this.powers[i];
        pw.mesh.rotation.y += dt * 2;
        pw.mesh.position.y = 0.9 + Math.sin(this.time * 3 + i) * 0.15;
        if (!p.alive) continue;
        const dx = p.pos.x - pw.x, dz = p.pos.z - pw.z;
        if (dx * dx + dz * dz < 1.3) {
          if (pw.type === 'speed') p.boostUntil = this.time + 5;
          if (pw.type === 'shield') p.shield = true;
          if (pw.type === 'magnet') p.magnetUntil = this.time + 8;
          AudioSys.sfx.power();
          this.haptics(20);
          this.hooks.onPower && this.hooks.onPower(pw.type);
          this.scene.remove(pw.mesh);
          this.powers.splice(i, 1);
        }
      }
    }

    render() { this.renderer.render(this.scene, this.cam); }
    aspect(a) { if (this.cam) { this.cam.aspect = a; this.cam.updateProjectionMatrix(); } }
  }

  global.GameSession = GameSession;
})(typeof window !== 'undefined' ? window : globalThis);
