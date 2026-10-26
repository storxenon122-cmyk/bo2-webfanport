# BLACK OPS II: WEB EDITION

A fan-made, browser-based FPS inspired by *Call of Duty: Black Ops 2* — built with
**HTML5 + JavaScript (ES6) + Three.js + Web Audio API + Pointer Lock API**.
All assets are **original and procedurally generated** (no copyrighted files, no
base64 blobs, no external downloads besides the Three.js CDN).

For the repository overview and the player-facing controls/objectives guide, see
the [root README](../README.md) and [How to Play](../HOW_TO_PLAY.md).

---

## 1. PROJECT FILE TREE

```
bo2-web/
├── bo2.html            # page shell: menu overlays, HUD, script includes
├── css/
│   └── style.css       # Black Ops 2-style dark/orange UI + HUD styling
└── js/
    ├── config.js       # weapons, perks, killstreaks, settings + loadout persistence
    ├── audio.js        # Web Audio sound synthesis (gunshots, reloads, ocean, explosions)
    ├── input.js        # keyboard/mouse/pointer-lock input
    ├── effects.js      # muzzle flash, tracers, sparks, decals, shells, explosions
    ├── weapons.js      # procedural first-person weapon viewmodels + animations
    ├── map.js          # 5 custom maps + colliders, lighting, water, sky
    ├── bots.js         # enemy AI bots (patrol/hunt/engage, LOS, bursts, drops)
    ├── killstreaks.js  # UAV, Hunter Killer, Care Package, Chopper, Hellstorm, Lodestar, VTOL, Nuke
    ├── hud.js          # minimap radar, ammo/health panels, killfeed, announcer
    ├── game.js         # player controller, firing, grenades, waves, scoring, perks
    ├── menu.js         # main menu / loadout / settings / pause / game-over wiring
    └── main.js         # renderer, game loop, resize, quality, boot
```

---

## 2. HOW TO RUN

### Option A — Local server (recommended)
```bash
cd bo2-web
python -m http.server 8000
```
Open **http://localhost:8000/bo2.html** in Chrome / Firefox / Edge / Safari.

No Python? Use any static server, e.g.:
```bash
npx serve .          # Node.js
php -S localhost:8000 # PHP
```

### Option B — Double-click
Just open **bo2.html** directly in a browser.
(Only regular `<script>` tags are used — no ES modules — so `file://` works.
An internet connection is needed once to fetch Three.js from the CDN.)

### Option C — Deploy free
- **GitHub Pages**: deploy this repository from the root using the included
  Pages workflow → open `https://<user>.github.io/<repo>/bo2-web/bo2.html`
- **Netlify**: drag-and-drop the `bo2-web/` folder at https://app.netlify.com/drop
- **itch.io**: zip the folder and upload as an HTML game

No build step, no bundler, no Makefile required.

---

## 3. CONTROLS (Default)

| Action | Key | Action | Key |
|---|---|---|---|
| Move | **W A S D** | Sprint | **Shift** (hold, forward) |
| Look | **Mouse** | Fire | **Left Click** |
| ADS (aim) | **Right Click** | Reload | **R** |
| Jump | **Space** | Crouch | **Left Ctrl** |
| Prone | **Z** | Melee | **V** |
| Lethal grenade | **G** | Tactical (flash/stun) | **Q** |
| Weapon 1 / 2 | **1 / 2** (or mouse wheel) | Inspect | **B** |
| **Killstreaks** | **1 / 2 / 3** (when ready) | Pause | **Esc** |

> Digit keys are smart: if a killstreak is earned it deploys the streak,
> otherwise it switches weapons. All keys are remappable in SETTINGS
> (presets: Default / Tactical / Southpaw).

> Desktop build — keyboard + mouse (pointer lock). No touch/on-screen
> controls and no tilt/gyro aiming.

---

## 4. WHAT'S IN THE GAME

- **Main menu** — Single Player, Multiplayer ("Coming Soon"), Loadout, Settings, Exit
- **Create-a-Class** — 8 classes (saved to localStorage): Assault, Runner,
  Support, Recon, Breacher, Marksman, Gunner, Wildcard — each with primary,
  secondary, lethal, tactical, 3 perks, 3 killstreaks, and Gunsmith camo/attachments.
- **Boat map "Cargo 17"** — hull deck, container corridors, bridge tower with
  roof access stairs, interior mess cabin, cranes, crates, animated ocean,
  night sky, warm deck lamps, shadows
- **City map "Downtown"** — dusk city block with four enterable multi-story
  brick/panel buildings (real interiors, staircases to 2nd floors + roofs),
  central plaza with fountain, parked cars, street lamps, dumpsters, awnings
- **Military map "Blacksite"** — night compound: large open hangar (with truck
  + crates inside), two enterable bunker blocks, four watchtowers with stairs
  + beacon lights, container maze, sandbag emplacements, chain-link fences,
  floodlights, cold moonlight
- **Desert map "Mirage"** — sunlit sandstone town: four multi-story buildings
  with interiors + roofs, central well, market stalls with colored awnings,
  stone archways, palm trees, bright blue sky
- **Suburb map "Nuketown"** — bright afternoon test-housing block: two facing
  two-story houses (full interiors, stairs, roof access), attached garages +
  driveways, central street with a jumpable school bus and box truck for cover,
  junked cars, fenced backyards with sheds, hedges, basketball hoops,
  mailboxes, porch + street lamps, symmetric 16-spawn layout
- **Killstreaks (9)** — UAV, Hunter Killer, Care Package, Sentry, **Hellstorm
  Missile** (mouse-guided chase-cam missile that splits into cluster bomblets),
  Attack Chopper, **Lodestar** (25 s orbiting gunship camera, click-fired
  missile strikes), **VTOL Warship** (autonomous chain-gun gunship), and the
  Tactical Nuke — camera streaks use a dedicated HUD overlay (vignette,
  brackets, reticle, countdown) and hand the camera back cleanly when done
- **Procedural textures** — every map surface, bot uniform, and weapon camo
  uses canvas-generated textures (wood plank, concrete, corrugated metal, rust,
  asphalt, tile, brick, sandstone, stucco, sand, gravel, grass, chain-link,
  camouflage patterns) — no binary assets.
- **Weapon camos** — Default, Woodland, Desert, Digital, Gold (polished engraved
  metal), Diamond (faceted reflective), Dark Matter (fully animated BO3-style
  nebula: the texture UV-scrolls and pulses every frame). All are seamless 512²
  canvas textures generated at boot; the painted ones are matte near-dielectric
  so they read as paint, while Gold/Diamond/Dark Matter are true metals lit by a
  small procedural sky/ground reflection probe built just for the gun.
- **Continuous survival** — AI bots spawn on an endless, difficulty-scaled timer;
  they patrol/hunt/engage with line-of-sight checks, strafing, burst fire,
  and they drop **ammo boxes** and **grenade crates** (Scavenger improves this)
- **Full FPS feel** — sprint, ADS with FOV zoom, crouch, prone, jump, auto
  step-up on stairs, head bob, weapon sway, recoil patterns + recovery,
  bloom spread, reload/ADS/sprint/melee/inspect animations, sprint-to-fire
- **Gun FX** — muzzle flash with dynamic light, tracers, shell casings,
  impact sparks, bullet-hole decals, smoke, explosions with screen shake
- **Sound (all synthesized)** — positional gunshots with tails (quieter,
  bass-reduced report through a suppressor), reload clicks,
  footsteps, ocean + engine ambience, explosions, hit/kill markers, streak chimes
- **HUD** — minimap radar (enemies appear when firing, or always with UAV),
  ammo panel, regenerating health bar, killfeed, announcer, killstreak slots
- **Settings** — sensitivity, FOV, brightness, motion-blur, quality
  (Low/Medium/High: pixel ratio + shadow toggle), presets, full key remapping

---

## 5. NOTES

- Fan project — not affiliated with Activision/Treyarch; all models, sounds,
  and UI are original approximations of the style.
- Performance: ~460–480 draw calls per frame on Medium/High (that's the whole
  world **plus** the sun's shadow pass), ~9 k–14 k triangles — light geometry,
  so the cost is fragment-side, not geometry-side. Quality=LOW drops shadows
  and caps resolution at 1× for weaker devices. Two things keep the frame budget
  in check on mid-range hardware: the sun's shadow map is refreshed on alternate
  frames (~30 Hz, imperceptible, and it removes a full extra scene pass), and
  every per-frame HUD write is change-detected, so the DOM is only touched when
  a value actually moves.
- Save data lives in `localStorage` (`bo2web_*` keys) — clearing site data
  resets classes/settings.
