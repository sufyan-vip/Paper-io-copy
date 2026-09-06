/* ============================================================
   Territory Trails 3D — data-driven configuration
   6 worlds x 12 levels = 72 levels, scalable mechanics:
   obstacle fields, ring walls, clusters, shrinking starts.
   ============================================================ */
(function (global) {
  'use strict';

  const GRID = 120;
  const MAX_PLAYERS = 10;         // player + 9 bots max

  const COLORS = ['#ff5fa2', '#3fa4ff', '#7ed957', '#ffb03a', '#a06bff', '#ff6b4a', '#35d0d8', '#f2e05a', '#ff8fd0', '#9dff57'];

  const WORLDS = [
    { id: 'ocean',     name: 'Ocean Playground', sky: 0x5ec1e8, fog: 0x9adcf0, ground: '#eef8fc', groundAlt: '#d8eef7', water: '#3f9be0', deco: 'ocean',     unlockStars: 0  },
    { id: 'snow',      name: 'Snow World',       sky: 0x9fd8f0, fog: 0xd6ecf7, ground: '#f6fbff', groundAlt: '#e0f0fa', water: '#bfe4f5', deco: 'snow',      unlockStars: 8  },
    { id: 'candy',     name: 'Candy World',      sky: 0xffc9dd, fog: 0xffe0ec, ground: '#ffdcea', groundAlt: '#ffc7dd', water: '#ff9ec6', deco: 'candy',     unlockStars: 18 },
    { id: 'jungle',    name: 'Jungle World',     sky: 0x8fdcf0, fog: 0xc4ecdf, ground: '#b9e39b', groundAlt: '#a2d886', water: '#4fc3e8', deco: 'jungle',    unlockStars: 30 },
    { id: 'graveyard', name: 'Graveyard World',  sky: 0x8a7bb8, fog: 0xb3a6d6, ground: '#c9b2e4', groundAlt: '#b493da', water: '#8f6cc9', deco: 'graveyard', unlockStars: 44 },
    { id: 'space',     name: 'Space World',      sky: 0x0b1030, fog: 0x1a2150, ground: '#232a4d', groundAlt: '#2c3560', water: '#10142b', deco: 'space',     unlockStars: 60 },
  ];

  const SKINS = [
    { id: 'cube-pink',  name: 'Pink Cube',  model: 'cube',    color: '#ff5fa2', cost: 0    },
    { id: 'cube-blue',  name: 'Blue Cube',  model: 'cube',    color: '#3fa4ff', cost: 0    },
    { id: 'boat',       name: 'Tiny Boat',  model: 'boat',    color: '#e2574c', cost: 250  },
    { id: 'penguin',    name: 'Penguin',    model: 'penguin', color: '#3d4a5c', cost: 500  },
    { id: 'robot',      name: 'Robot',      model: 'robot',   color: '#9fb2c8', cost: 800  },
    { id: 'ghost',      name: 'Ghost',      model: 'ghost',   color: '#eaf6ff', cost: 1200 },
    { id: 'neon',       name: 'Neon Cube',  model: 'cube',    color: '#00ffc8', cost: 1600, emissive: true },
    { id: 'rainbow',    name: 'Rainbow',    model: 'cube',    color: 'rainbow', cost: 2500 },
  ];

  const BOT_NAMES = ['Mango', 'Zippy', 'Nova', 'Pickle', 'Turbo', 'Willow', 'Bolt', 'Pixel', 'Echo', 'Rocket', 'Waffle', 'Comet'];

  const PERSONALITIES = {
    passive:   { expand: 12, hunt: 0.0, speed: 6.5, turn: 3.2 },
    explorer:  { expand: 22, hunt: 0.1, speed: 7.5, turn: 3.6 },
    aggressive:{ expand: 18, hunt: 0.5, speed: 8.0, turn: 4.0 },
    hunter:    { expand: 16, hunt: 0.8, speed: 8.4, turn: 4.2 },
    champion:  { expand: 26, hunt: 0.4, speed: 8.8, turn: 4.4 },
  };

  const ECONOMY = {
    coinPerCell: 0.35,
    coinPickup: 5,
    killBonus: 25,
    starBonus: [0, 50, 75, 100],
  };

  // Scalable level definition: difficulty curve + mechanic unlocks.
  // Mechanics introduced progressively:
  //   pillars  (world>=1, lvl>=4)  scattered impassable rocks
  //   ring     (world>=2, lvl>=6) gapped ring wall around arena center
  //   clusters (world>=3, lvl>=2) dense 3x3 obstacle blocks
  //   space    asteroids from the start + ring from lvl 4
  function levelDef(worldIdx, levelIdx) {
    const target = Math.min(18 + worldIdx * 3 + levelIdx * 5, 96);
    const bots = Math.min(2 + Math.floor((worldIdx * 12 + levelIdx) / 4), 9);
    const tier = levelIdx < 4 ? 0 : levelIdx < 8 ? 1 : 2;
    const obstacles = [];
    if (worldIdx >= 1 && levelIdx >= 4) obstacles.push({ type: 'pillars', count: 5 + levelIdx });
    if (worldIdx >= 2 && levelIdx >= 6) obstacles.push({ type: 'ring' });
    if (worldIdx >= 3 && levelIdx >= 2) obstacles.push({ type: 'clusters', count: levelIdx > 6 ? 4 : 3 });
    if (worldIdx === 5) { obstacles.length = 0; obstacles.push({ type: 'pillars', count: 8 + levelIdx }); if (levelIdx >= 4) obstacles.push({ type: 'ring' }); }
    return {
      world: worldIdx,
      level: levelIdx,
      target,
      bots,
      tier,
      coins: 22 + levelIdx * 2,
      coinGoal: 10 + levelIdx,
      speed: 8.6 + worldIdx * 0.2,
      seedR: levelIdx >= 9 ? 2 : 3,          // expert levels: shrinking start
      obstacles,
    };
  }

  const LEVELS_PER_WORLD = 12;

  global.TT3D_CFG = { GRID, MAX_PLAYERS, COLORS, WORLDS, SKINS, BOT_NAMES, PERSONALITIES, ECONOMY, levelDef, LEVELS_PER_WORLD };
})(typeof window !== 'undefined' ? window : globalThis);
