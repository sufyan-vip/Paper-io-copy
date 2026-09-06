/* ============================================================
   Territory Trails 3D — 3D world & asset builder (original art)
   High-end pass: 2K terrain w/ modern grid + vignette, standard
   materials, glossy water, fill light, anisotropy, starfield,
   contact shadows, obstacle meshes, themed props.
   ============================================================ */
(function (global) {
  'use strict';
  const CFG = global.TT3D_CFG;
  const GRID = CFG.GRID;

  const GEO = {}, MAT = {};
  function geo(key, fn) { if (!GEO[key]) GEO[key] = fn(); return GEO[key]; }
  function mat(color, opts) {
    const k = color + JSON.stringify(opts || {});
    if (!MAT[k]) MAT[k] = new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(color) }, opts || {}));
    return MAT[k];
  }
  function M(geom, material, x, y, z, parent, shadow) {
    const m = new THREE.Mesh(geom, material);
    m.position.set(x || 0, y || 0, z || 0);
    if (shadow !== false) m.castShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  // ---------------- high-quality terrain texture ----------------
  function makeTerrainCanvas(world) {
    const S = 2048, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const space = world.deco === 'space';
    x.fillStyle = world.ground; x.fillRect(0, 0, S, S);

    // soft macro shading
    for (let i = 0; i < 260; i++) {
      x.fillStyle = Math.random() < 0.5 ? world.groundAlt : world.ground;
      x.globalAlpha = rand(0.06, 0.18);
      x.beginPath();
      x.ellipse(rand(0, S), rand(0, S), rand(24, 110), rand(16, 70), rand(0, 3), 0, 7);
      x.fill();
    }
    // fine grain noise for matte finish
    x.globalAlpha = space ? 0.10 : 0.05;
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = Math.random() < 0.5 ? '#ffffff' : (space ? '#000000' : world.groundAlt);
      x.fillRect(rand(0, S), rand(0, S), 2, 2);
    }
    x.globalAlpha = 1;

    // modern grid layout (subtle tactical lines)
    const cell = S / GRID;
    x.strokeStyle = space ? 'rgba(90,220,255,0.20)' : 'rgba(20,60,110,0.025)';
    x.lineWidth = 1.4;
    x.beginPath();
    for (let i = 0; i <= GRID; i += 6) { x.moveTo(i * cell, 0); x.lineTo(i * cell, S); x.moveTo(0, i * cell); x.lineTo(S, i * cell); }
    x.stroke();
    x.strokeStyle = space ? 'rgba(120,240,255,0.34)' : 'rgba(20,60,110,0.05)';
    x.lineWidth = 2.2;
    x.beginPath();
    for (let i = 0; i <= GRID; i += 30) { x.moveTo(i * cell, 0); x.lineTo(i * cell, S); x.moveTo(0, i * cell); x.lineTo(S, i * cell); }
    x.stroke();

    // water / themed lakes with depth gradient + foam rim
    const lakes = world.deco === 'ocean' ? 6 : 4;
    for (let i = 0; i < lakes; i++) {
      const cx = rand(0, S), cy = rand(0, S), r = rand(70, 170);
      const path = () => {
        x.beginPath();
        for (let a = 0; a <= 22; a++) {
          const ang = (a / 22) * Math.PI * 2;
          const rr = r * rand(0.78, 1.12);
          const px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * 0.8;
          a ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.closePath();
      };
      path();
      const g = x.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.2);
      g.addColorStop(0, space ? '#1c2450' : lighten(world.water, 18));
      g.addColorStop(1, world.water);
      x.fillStyle = g; x.globalAlpha = 0.96; x.fill();
      x.globalAlpha = 0.55; x.strokeStyle = space ? 'rgba(120,240,255,0.5)' : '#ffffff'; x.lineWidth = 5; x.stroke();
      // gloss streaks
      x.globalAlpha = 0.25; x.strokeStyle = '#ffffff'; x.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        x.beginPath();
        const sy = cy + rand(-r * 0.5, r * 0.5);
        x.moveTo(cx - r * 0.5, sy); x.lineTo(cx + rand(-0.1, 0.5) * r, sy);
        x.stroke();
      }
    }
    x.globalAlpha = 1;

    // ambient vignette for clean depth falloff
    const v = x.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, space ? 'rgba(0,0,10,0.42)' : 'rgba(10,40,80,0.12)');
    x.fillStyle = v; x.fillRect(0, 0, S, S);
    return c;
  }
  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.min(255, v + amt);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // ---------------- props ----------------
  function palm(parent, x, z, tint) {
    const g = new THREE.Group();
    M(geo('trunk', () => new THREE.CylinderGeometry(0.12, 0.2, 2.2, 6)), mat(tint || '#a9744f'), 0, 1.1, 0, g);
    const leaf = geo('leaf', () => new THREE.ConeGeometry(0.28, 1.6, 4));
    for (let i = 0; i < 5; i++) {
      const l = M(leaf, mat(pick(['#3fbf62', '#35b258', '#49cf70'])), 0, 2.3, 0, g);
      l.rotation.set(rand(0.9, 1.3), 0, 0); l.rotation.order = 'YXZ'; l.rotation.y = (i / 5) * Math.PI * 2;
      l.position.set(Math.sin(l.rotation.y) * 0.6, 2.25, Math.cos(l.rotation.y) * 0.6);
    }
    g.position.set(x, 0, z); g.rotation.y = rand(0, 3); parent.add(g); return g;
  }
  function pine(parent, x, z) {
    const g = new THREE.Group();
    M(geo('trunkS', () => new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6)), mat('#8a5a3b'), 0, 0.4, 0, g);
    M(geo('pine1', () => new THREE.ConeGeometry(0.9, 1.4, 7)), mat(pick(['#2e9e5b', '#2a9152'])), 0, 1.4, 0, g);
    M(geo('pine2', () => new THREE.ConeGeometry(0.65, 1.1, 7)), mat('#eef8ff'), 0, 2.2, 0, g);
    g.position.set(x, 0, z); g.scale.setScalar(rand(0.8, 1.3)); parent.add(g); return g;
  }
  function deadTree(parent, x, z) {
    const g = new THREE.Group();
    const dark = mat('#2b2130');
    M(geo('dtrunk', () => new THREE.CylinderGeometry(0.09, 0.18, 2.6, 5)), dark, 0, 1.3, 0, g);
    for (let i = 0; i < 4; i++) {
      const b = M(geo('dbranch', () => new THREE.CylinderGeometry(0.03, 0.06, 1.2, 4)), dark, 0, 0, 0, g);
      b.position.set(rand(-0.4, 0.4), rand(1.6, 2.5), rand(-0.4, 0.4));
      b.rotation.set(rand(-0.9, 0.9), 0, rand(-0.9, 0.9));
    }
    g.position.set(x, 0, z); parent.add(g); return g;
  }
  function grave(parent, x, z) {
    const g = new THREE.Group();
    const stone = mat(pick(['#cfd4e2', '#c2c8da']));
    M(geo('gbase', () => new THREE.BoxGeometry(0.7, 1, 0.18)), stone, 0, 0.5, 0, g);
    const top = M(geo('gtop', () => new THREE.CylinderGeometry(0.35, 0.35, 0.18, 10)), stone, 0, 1, 0, g);
    top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2;
    g.rotation.y = rand(0, 3); g.position.set(x, 0, z); parent.add(g); return g;
  }
  function rock(parent, x, z, color, s) {
    const m = M(geo('rock', () => new THREE.DodecahedronGeometry(0.7, 0)), mat(color || '#9aa3ad'), x, 0.35 * (s || 1), z);
    m.scale.setScalar(s || rand(0.6, 1.6)); m.rotation.y = rand(0, 3); return m;
  }
  function iceberg(parent, x, z) {
    const m = M(geo('ice', () => new THREE.DodecahedronGeometry(1, 0)), mat('#eaf8ff'), x, 0.5, z);
    m.scale.set(rand(0.8, 2), rand(0.6, 1.4), rand(0.8, 2)); m.rotation.y = rand(0, 3); return m;
  }
  function lollipop(parent, x, z) {
    const g = new THREE.Group();
    M(geo('lpstick', () => new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6)), mat('#fff6f0'), 0, 0.7, 0, g);
    M(geo('lpcandy', () => new THREE.SphereGeometry(0.5, 14, 12)), mat(pick(['#ff6fae', '#ff9d5c', '#7ce08a', '#6db9ff'])), 0, 1.6, 0, g);
    g.position.set(x, 0, z); g.scale.setScalar(rand(0.8, 1.3)); parent.add(g); return g;
  }
  function gumdrop(parent, x, z) {
    const m = M(geo('gum', () => new THREE.SphereGeometry(0.55, 12, 10)), mat(pick(['#ff8fc4', '#ffd166', '#8ef0a2', '#9ad2ff'])), x, 0.3, z);
    m.scale.y = 0.75; return m;
  }
  function bush(parent, x, z) {
    const m = M(geo('bush', () => new THREE.SphereGeometry(0.7, 10, 8)), mat(pick(['#3fae5c', '#57c96f', '#2f9e50'])), x, 0.45, z);
    m.scale.set(rand(0.8, 1.6), rand(0.6, 1), rand(0.8, 1.6)); return m;
  }
  function crate(parent, x, z) {
    const m = M(geo('crate', () => new THREE.BoxGeometry(0.9, 0.9, 0.9)), mat('#f0954a'), x, 0.45, z);
    m.rotation.y = rand(0, 3); return m;
  }
  function crystal(parent, x, z) {
    const col = pick(['#5ae2ff', '#ff6fd8', '#8f7bff']);
    const m = M(geo('crys', () => new THREE.OctahedronGeometry(0.8, 0)),
      new THREE.MeshLambertMaterial({ color: col, emissive: new THREE.Color(col), emissiveIntensity: 0.5 }), x, 0.8, z);
    m.scale.set(rand(0.6, 1.2), rand(1, 1.8), rand(0.6, 1.2)); m.rotation.y = rand(0, 3); return m;
  }
  function asteroid(parent, x, z) {
    const m = M(geo('ast', () => new THREE.DodecahedronGeometry(0.9, 0)), mat('#3a3f66'), x, 0.5, z);
    m.scale.setScalar(rand(0.7, 1.6)); m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); return m;
  }

  function scatter(scene, world) {
    const g = new THREE.Group(); scene.add(g);
    const N = 46;
    for (let i = 0; i < N; i++) {
      const x = rand(4, GRID - 4), z = rand(4, GRID - 4);
      switch (world.deco) {
        case 'ocean': i % 3 ? palm(g, x, z) : (i % 2 ? rock(g, x, z, '#9aa3ad') : crate(g, x, z)); break;
        case 'snow': i % 3 ? pine(g, x, z) : iceberg(g, x, z); break;
        case 'candy': i % 2 ? lollipop(g, x, z) : gumdrop(g, x, z); break;
        case 'jungle': i % 3 ? palm(g, x, z, '#7b5233') : bush(g, x, z); break;
        case 'graveyard': i % 3 ? deadTree(g, x, z) : (i % 2 ? grave(g, x, z) : rock(g, x, z, '#6d5a86')); break;
        case 'space': i % 2 ? crystal(g, x, z) : asteroid(g, x, z); break;
        default: rock(g, x, z);
      }
    }
    const clouds = [];
    if (world.deco !== 'space') {
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Group();
        const cm = new THREE.MeshLambertMaterial({ color: 0xffffff });
        for (let j = 0; j < 3; j++) {
          const s = new THREE.Mesh(geo('cloud', () => new THREE.SphereGeometry(1.6, 10, 8)), cm);
          s.position.set(j * 1.8 - 1.8, rand(-0.2, 0.4), rand(-0.6, 0.6));
          s.scale.setScalar(rand(0.7, 1.3));
          c.add(s);
        }
        c.position.set(rand(0, GRID), rand(9, 12), rand(0, GRID));
        c.userData.v = rand(0.4, 1);
        scene.add(c); clouds.push(c);
      }
    }
    return { deco: g, clouds };
  }

  // ---------------- world scene ----------------
  function buildWorldScene(world, shadows, quality, maxAniso) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(world.sky);
    scene.fog = new THREE.Fog(world.fog, 60, 160);
    const aniso = maxAniso || 1;

    scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(world.groundAlt), 0.95));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.85);
    sun.position.set(30, 60, 20);
    if (shadows) {
      sun.castShadow = true;
      const res = quality === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(res, res);
      const sc = sun.shadow.camera;
      sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.far = 220;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.03;
    }
    scene.add(sun); scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.3);
    fill.position.set(-40, 30, -35);
    scene.add(fill);

    // glossy outer water plane
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(GRID * 4, GRID * 4),
      new THREE.MeshPhongMaterial({ color: new THREE.Color(world.water), shininess: world.deco === 'space' ? 30 : 90, specular: new THREE.Color(world.deco === 'space' ? 0x223366 : 0x99ccff) }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(GRID / 2, -0.2, GRID / 2);
    scene.add(outer);

    // terrain (matte PBR-ish)
    const terrainTex = new THREE.CanvasTexture(makeTerrainCanvas(world));
    terrainTex.anisotropy = aniso;
    terrainTex.encoding = THREE.sRGBEncoding;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID),
      new THREE.MeshStandardMaterial({ map: terrainTex, roughness: 0.96, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(GRID / 2, 0, GRID / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // territory overlay (crisp at grazing angles)
    const oc = document.createElement('canvas');
    oc.width = oc.height = 2048;
    const overlayTex = new THREE.CanvasTexture(oc);
    overlayTex.magFilter = THREE.LinearFilter;
    overlayTex.minFilter = THREE.LinearMipmapLinearFilter;
    overlayTex.generateMipmaps = true;
    overlayTex.anisotropy = aniso;
    overlayTex.encoding = THREE.sRGBEncoding;
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID),
      new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, depthWrite: false }));
    overlay.rotation.x = -Math.PI / 2; overlay.position.set(GRID / 2, 0.06, GRID / 2);
    scene.add(overlay);

    // starfield for space world
    if (world.deco === 'space') {
      const n = 400, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = rand(90, 170), th = rand(0, Math.PI * 2), ph = rand(0.15, 1.2);
        pos[i * 3] = GRID / 2 + Math.cos(th) * Math.sin(ph) * r;
        pos[i * 3 + 1] = Math.cos(ph) * r;
        pos[i * 3 + 2] = GRID / 2 + Math.sin(th) * Math.sin(ph) * r;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, transparent: true, opacity: 0.9 })));
    }

    const extras = scatter(scene, world);
    return { scene, sun, overlayCanvas: oc, overlayCtx: oc.getContext('2d'), overlayTex, clouds: extras.clouds };
  }

  // ---------------- obstacle meshes per theme ----------------
  function makeObstacleMesh(world) {
    switch (world.deco) {
      case 'snow': return iceberg(new THREE.Group(), 0, 0);
      case 'candy': return gumdropScaled();
      case 'space': return asteroid(new THREE.Group(), 0, 0);
      case 'jungle': return rock(new THREE.Group(), 0, 0, '#5d7a4a', 1.3);
      case 'graveyard': return rock(new THREE.Group(), 0, 0, '#54476b', 1.2);
      default: return rock(new THREE.Group(), 0, 0, '#8d99a6', 1.2);
    }
    function gumdropScaled() {
      const m = gumdrop(new THREE.Group(), 0, 0);
      m.scale.setScalar(1.7);
      return m;
    }
  }

  // ---------------- soft contact shadow ----------------
  let blobTex = null;
  function makeBlobShadow() {
    if (!blobTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 4, 32, 32, 30);
      g.addColorStop(0, 'rgba(0,0,20,0.4)'); g.addColorStop(1, 'rgba(0,0,20,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      blobTex = new THREE.CanvasTexture(c);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    s.scale.set(2.6, 1.4, 1);
    s.position.y = 0.05;
    return s;
  }

  // ---------------- skin models (original designs) ----------------
  function eyes(parent, y, z) {
    const e = geo('eye', () => new THREE.SphereGeometry(0.09, 8, 6));
    M(e, mat('#ffffff'), -0.18, y, z, parent);
    M(e, mat('#ffffff'), 0.18, y, z, parent);
    const p = geo('pupil', () => new THREE.SphereGeometry(0.045, 6, 6));
    M(p, mat('#222222'), -0.18, y, z - 0.07, parent);
    M(p, mat('#222222'), 0.18, y, z - 0.07, parent);
  }

  function makeSkinMesh(skinDef) {
    const g = new THREE.Group();
    const color = skinDef.color === 'rainbow' ? '#ff5fa2' : skinDef.color;
    const opts = skinDef.emissive ? { emissive: new THREE.Color(color), emissiveIntensity: 0.7 } : {};
    const bodyMat = mat(color, opts);
    switch (skinDef.model) {
      case 'boat': {
        M(geo('hull', () => new THREE.BoxGeometry(1.1, 0.5, 2)), bodyMat, 0, 0.35, 0, g);
        const bow = M(geo('bow', () => new THREE.ConeGeometry(0.55, 0.8, 4)), bodyMat, 0, 0.35, -1.3, g);
        bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4;
        M(geo('mast', () => new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6)), mat('#8a5a3b'), 0, 1.4, 0.1, g);
        M(geo('sail', () => new THREE.PlaneGeometry(1.2, 1.1)), mat('#fdfdf6', { side: THREE.DoubleSide }), 0, 1.6, 0.16, g, false);
        M(geo('flag', () => new THREE.ConeGeometry(0.16, 0.4, 4)), mat('#ffd93d'), 0, 2.45, 0.1, g);
        M(geo('cabin', () => new THREE.BoxGeometry(0.7, 0.4, 0.7)), mat('#ffd9a0'), 0, 0.75, 0.6, g);
        eyes(g, 0.5, -1.0);
        break;
      }
      case 'penguin': {
        const b = M(geo('pbody', () => new THREE.SphereGeometry(0.62, 14, 12)), bodyMat, 0, 0.62, 0, g);
        b.scale.set(0.85, 1, 0.85);
        const bel = M(geo('pbelly', () => new THREE.SphereGeometry(0.45, 12, 10)), mat('#ffffff'), 0, 0.55, -0.28, g);
        bel.scale.set(0.8, 1, 0.5);
        const beak = M(geo('beak', () => new THREE.ConeGeometry(0.12, 0.3, 4)), mat('#ff9d2e'), 0, 0.72, -0.62, g);
        beak.rotation.x = -Math.PI / 2;
        const fl = geo('flip', () => new THREE.BoxGeometry(0.12, 0.5, 0.3));
        M(fl, bodyMat, -0.55, 0.65, 0, g).rotation.z = 0.3;
        M(fl, bodyMat, 0.55, 0.65, 0, g).rotation.z = -0.3;
        eyes(g, 0.85, -0.5);
        break;
      }
      case 'robot': {
        M(geo('rbody', () => new THREE.BoxGeometry(0.9, 0.8, 0.8)), bodyMat, 0, 0.6, 0, g);
        M(geo('rhead', () => new THREE.BoxGeometry(0.65, 0.5, 0.6)), mat('#dfe8f2'), 0, 1.3, 0, g);
        M(geo('rant', () => new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5)), mat('#777777'), 0, 1.7, 0, g);
        M(geo('antip', () => new THREE.SphereGeometry(0.09, 8, 6)), mat('#ff4d4d', { emissive: new THREE.Color('#ff4d4d'), emissiveIntensity: 0.8 }), 0, 1.92, 0, g);
        M(geo('reye', () => new THREE.BoxGeometry(0.34, 0.1, 0.05)), mat('#39d0d8', { emissive: new THREE.Color('#39d0d8'), emissiveIntensity: 0.8 }), 0, 1.32, -0.31, g);
        break;
      }
      case 'ghost': {
        const gm = new THREE.MeshLambertMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.88 });
        const b = M(geo('gbody', () => new THREE.SphereGeometry(0.6, 14, 12)), gm, 0, 0.8, 0, g);
        b.scale.set(0.9, 1.05, 0.9);
        const t = M(geo('gtail', () => new THREE.ConeGeometry(0.55, 0.7, 10)), gm, 0, 0.25, 0, g);
        t.rotation.x = Math.PI;
        eyes(g, 0.95, -0.48);
        g.userData.float = true;
        break;
      }
      default: {
        M(geo('cube', () => new THREE.BoxGeometry(1, 1, 1)), bodyMat, 0, 0.55, 0, g);
        M(geo('cubeTop', () => new THREE.BoxGeometry(0.5, 0.18, 0.5)), mat('#ffffff', { transparent: true, opacity: 0.55 }), 0, 1.1, 0, g);
        eyes(g, 0.7, -0.51);
      }
    }
    if (skinDef.color === 'rainbow') g.userData.rainbow = true;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ---------------- coins & powerups ----------------
  function makeCoinMesh() {
    const m = new THREE.Mesh(geo('coin', () => new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16)),
      new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.3, metalness: 0.7 }));
    m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    return m;
  }
  const POWER_COLORS = { speed: '#ffd93d', shield: '#4dc3ff', magnet: '#c46bff' };
  function makePowerMesh(type) {
    const m = new THREE.Mesh(geo('power', () => new THREE.OctahedronGeometry(0.5, 0)),
      new THREE.MeshStandardMaterial({ color: POWER_COLORS[type], emissive: new THREE.Color(POWER_COLORS[type]), emissiveIntensity: 0.55, roughness: 0.4 }));
    m.castShadow = true;
    return m;
  }

  // ---------------- floating name label ----------------
  function makeLabel() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    spr.scale.set(5.2, 2.6, 1);
    spr.renderOrder = 10;
    function set(name, pctText, color, leader) {
      x.clearRect(0, 0, 256, 128);
      x.textAlign = 'center';
      x.font = '800 30px system-ui, sans-serif';
      x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 6; x.shadowOffsetY = 2;
      x.fillStyle = color;
      x.strokeStyle = 'rgba(255,255,255,0.92)'; x.lineWidth = 6;
      x.strokeText(name, 128, 34); x.fillText(name, 128, 34);
      x.font = '800 30px system-ui, sans-serif';
      const w = x.measureText(pctText).width + 44;
      x.shadowBlur = 4;
      x.fillStyle = color;
      roundRect(x, 128 - w / 2, 48, w, 46, 23); x.fill();
      x.shadowBlur = 0; x.shadowOffsetY = 0;
      x.fillStyle = '#ffffff';
      x.fillText(pctText, 128, 81);
      if (leader) drawCrown(x, 128, 116);
      tex.needsUpdate = true;
    }
    return { sprite: spr, set };
  }
  function roundRect(x, a, b, w, h, r) {
    x.beginPath();
    x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  function drawCrown(x, cx, cy) {
    x.fillStyle = '#ffd93d';
    x.strokeStyle = '#e0a400'; x.lineWidth = 3;
    x.beginPath();
    x.moveTo(cx - 22, cy); x.lineTo(cx - 22, cy - 16); x.lineTo(cx - 11, cy - 6); x.lineTo(cx, cy - 20);
    x.lineTo(cx + 11, cy - 6); x.lineTo(cx + 22, cy - 16); x.lineTo(cx + 22, cy); x.closePath();
    x.fill(); x.stroke();
  }

  // ---------------- menu preview scene ----------------
  function buildPreviewScene(world, skinDef) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(world.sky);
    scene.fog = new THREE.Fog(world.fog, 20, 60);
    scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(world.groundAlt), 1));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.9); sun.position.set(5, 10, 4); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.3); fill.position.set(-6, 4, -5); scene.add(fill);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.6, 28),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(world.groundAlt), roughness: 0.6 }));
    ped.position.y = -0.3; scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 8, 40),
      new THREE.MeshLambertMaterial({ color: 0xffd93d, emissive: new THREE.Color(0xffa400), emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.55; scene.add(ring);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshStandardMaterial({ color: new THREE.Color(world.ground), roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; scene.add(ground);
    const ch = makeSkinMesh(skinDef);
    scene.add(ch);
    if (world.deco === 'space') {
      const n = 200, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = rand(20, 45), th = rand(0, Math.PI * 2), ph = rand(0.1, 1.3);
        pos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
        pos[i * 3 + 1] = Math.cos(ph) * r;
        pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r - 10;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.9 })));
    }
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Group();
      const cm = new THREE.MeshLambertMaterial({ color: 0xffffff });
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Mesh(geo('cloud', () => new THREE.SphereGeometry(1.4, 8, 6)), cm);
        s.position.set(j * 1.6 - 1.6, 0, 0); c.add(s);
      }
      c.position.set(rand(-14, 14), rand(5, 8), rand(-14, -6));
      c.userData.v = rand(0.3, 0.8);
      scene.add(c);
    }
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 3.4, 7.4); cam.lookAt(0, 1, 0);
    return { scene, cam, character: ch };
  }

  global.W3D = { buildWorldScene, makeSkinMesh, makeCoinMesh, makePowerMesh, makeLabel, buildPreviewScene, makeObstacleMesh, makeBlobShadow, POWER_COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
