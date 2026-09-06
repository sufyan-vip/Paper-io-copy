# Territory Trails 3D — Play Store Packaging Guide

A complete, original, offline-first 3D territory-capture game (web engine + PWA),
ready to wrap for Google Play with Capacitor. **No copyrighted assets** — all art is
procedural low-poly, all audio is synthesized, all code original.

## Play it right now
The game runs from any static server (see the live preview). Desktop: steer with
WASD / arrow keys. Mobile: drag anywhere to steer (floating joystick).

## What's implemented (all functional, no mockups)
- **Core loop** — move → leave trail → close loop → capture territory → % updates
  (grid engine with flood-fill loop closing, diagonal-leak proof, unit-tested).
- **Combat** — crossing an enemy trail eliminates them; deaths, kills, respawning bots.
- **Bots** — 5 personalities (passive/explorer/aggressive/hunter/champion), difficulty
  tiers per level, same rules as the player.
- **6 worlds** (Ocean, Snow, Candy, Jungle, Graveyard, Space) with unique palettes,
  props, starfield/neon treatment and unlock gates by stars.
- **72 levels** (12/world) with targets, bot counts, 3-star scoring, sequential unlocks,
  and progressive mechanics: obstacle pillars, gapped ring walls, 3x3 clusters,
  shrinking expert starts.
- **Premium rendering** — ACES filmic tone mapping, sRGB pipeline, 2K terrain with
  tactical grid + vignette, anisotropic 1K territory overlay, glossy water, fill light,
  contact shadows, banking tilt, capture shock-rings, dynamic camera zoom.
- **Zero-emoji UI** — full inline-SVG icon system (coins, skull, gear, gift, target,
  lock, pause, stars, powerups, skin glyphs), fluid screen/card transitions,
  animated coin count-up and counter bumps.
- **8 skins** (cube/boat/penguin/robot/ghost + neon/rainbow) purchasable with coins.
- **Economy & save** — coins, daily reward (7-day cycle), missions, versioned
  localStorage save that survives restarts, corrupt-save safe.
- **HUD** — percentage + target bar, coin/kill pills, top-3 leaderboard, circular
  minimap, floating name/crown labels, NEW BEST banner + confetti.
- **Powerups** — Speed / Shield / Magnet with chips + toasts.
- **Screens** — animated main menu with rotating 3D skin preview, skins shop,
  settings (music/SFX/haptics/shadows/quality/reset), pause, result (stars/coins).
- **Audio** — original synthesized SFX + generative music loop (WebAudio).
- **Mobile** — portrait, one-handed drag steering, haptics, fullscreen PWA manifest,
  offline service worker, DPR cap + shadow toggle for mid-range devices.

## Wrap for Google Play (Capacitor)
Requires Node 18+ and Android Studio on your machine (this sandbox has no Android SDK,
so the AAB must be built on your machine — everything else is ready):

```bash
cd <this folder's parent>
npm init -y
npm i @capacitor/core
npm i -D @capacitor/cli
npx cap init "Territory Trails 3D" com.territorytrails.game3d --web-dir=game
# copy capacitor.config.json from game/ to project root (already provided)
npx cap add android
npx cap copy android          # after every web change
npx cap open android          # opens Android Studio
```

In Android Studio: **Build → Generate Signed Bundle / APK → AAB**, create your keystore,
set versionName/versionCode, and upload the `.aab` to Play Console.

Recommended Play Console setup:
- Portrait locked (manifest already requests portrait).
- Content rating: Everyone (no violence beyond cartoon eliminations).
- Data safety: local-only storage, no identifiers, no network calls.

## Roadmap (interfaces kept open)
Rewarded ads / IAP behind a MonetizationService stub, online multiplayer transport
interface, more skin models, extra control modes. The session engine
(`game.js`) is isolated from UI/rendering so a network layer can be added later
without rewriting gameplay.

## Verified in this workspace
- `tests/logic_test.js` — capture/kill/percentage engine assertions (passing).
- `tests/session_test.js` — headless run of the real session: scripted loop capture,
  bot expansion, bot-vs-player kills, pause freeze, bounds/NaN checks (passing).
- All modules pass `node --check`.
