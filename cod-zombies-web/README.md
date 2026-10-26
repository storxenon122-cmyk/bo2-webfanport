# ZOMBIES: KINO DER TOTEN - Web Edition

A standalone, fan-made, browser-based round-based Zombies game built with
**HTML5 + JavaScript (ES6) + Three.js + Web Audio API + Pointer Lock API**.

For the repository overview and the player-facing controls/objectives guide, see
the [root README](../README.md) and [How to Play](../HOW_TO_PLAY.md).

This folder is a **separate game**. It does not load, import, write to, or
require anything from `../bo2-web`. The original BO2 Web survival project was
left in its pre-Zombies state and is not modified by this build.

- All assets are original and procedurally generated (Three.js primitives,
  canvas textures, Web Audio synthesis). No copyrighted files are included.
- The only external dependency is the Three.js CDN.
- Desktop only: keyboard + mouse with pointer lock.

---

## 1. RUN

From this folder:

```bash
python -m http.server 8051
```

Open **http://127.0.0.1:8051/codzom.html**.

Or use the no-cache helper while developing:

```bash
python serve_nocache.py
```

Open **http://127.0.0.1:8001/**.

You can also double-click `codzom.html`; plain `<script>` tags are used, so
`file://` works. An internet connection is needed once for the Three.js CDN.

### Controls

| Action | Default |
|---|---|
| Move / look | WASD / mouse |
| Sprint | Shift |
| Fire / aim | Left click / right click |
| Reload | R |
| Melee | V |
| Lethal / tactical | G / Q |
| Interact (door, perk, Mystery Box, Pack-a-Punch) | **F** |
| Repair barricade (hold) | **E** |
| Swap weapon | **X** (1/2 and mouse wheel also work) |
| Pause / release mouse | Esc |

All Zombies actions can be rebound from the **KEYBINDS** screen.

---

## 2. PLAY LOOP

1. Main menu -> **ZOMBIES** -> **KINO DER TOTEN**.
2. Survive Round 1 in the foyer. Zombies come through two barricaded windows.
3. Shoot zombies for points, or repair boards for +10 each.
4. Buy the theater door for 750 points.
5. In the theater, buy the **IRON HIDE** perk (500) for 150 max health.
6. Use the **Mystery Box** (950, hold F) for a random primary weapon.
7. Inspect the **Pack-a-Punch** anchor (offline placeholder).
8. Die -> `GAME OVER` -> **RESTART** or **MAIN MENU**.

Round 1 starts with 500 points and 6/6 boards on both windows.

### Economy

| Event | Points |
|---|---|
| Hit | +10 |
| Kill | +60 |
| Headshot kill bonus | +100 |
| Board repaired | +10 |
| Starting balance | 500 |
| Theater door | -750 |
| IRON HIDE perk | -500 |
| Mystery Box | -950 |

### Rounds

- `maxAlive = min(4 + round*2, 14)`
- `budget = min(6 + round*4, 30)`
- `healthScale = 1 + (round-1)*0.28`
- 5 second intermission between rounds
- Hard cap of 14 pooled zombies

---

## 3. BUILD LAYOUT

```
cod-zombies-web/
  codzom.html                page shell, menus, HUD, script order
  css/style.css              dark/orange UI + Zombies HUD
  serve_nocache.py           dev server (no-store cache headers)
  js/
    config.js                weapons, perks, settings, loadouts
    state/kino-state.js      KinoGameState state machine + event bus
    audio.js                 synthesized audio + live master volume
    input.js                 input/pointer lock + KeybindManager resolution
    ui/settings.js           persisted settings wrapper
    ui/keybinds.js           rebindable Zombies action registry
    effects.js               pooled muzzle/tracer/blood/decal effects
    weapons.js               procedural viewmodels, attachments, camos
    map.js                   shared map helpers + legacy survival maps
    maps/kino-der-toten.js   Kino data definition + runtime builder
    systems/points.js        point economy
    systems/round-manager.js rounds, spawn budget, health scaling
    systems/barricades.js    six-board window stacks
    systems/interaction.js   centre-screen door/perk/box/Pap picking
    ai/zombie.js             pooled zombie AI + spawner
    hud.js                   shared HUD, minimap, killfeed
    ui/kino-hud.js           Zombies HUD skin (points, round, prompts)
    game.js                  engine loop + Zombies mode
    menu.js                  shared engine menu plumbing
    ui/menu.js               Zombies menu / pause / game-over flow
    main.js                  renderer, loop, quality, pause-on-blur
  tests/                     Playwright smoke tests (see tests/README.md)
  HANDOFF.md                 technical handoff and invariants
  README.md
```

The shared engine files (renderer, weapons, effects, input, HUD, menu
plumbing) are a **copy** kept inside this folder for a self-contained game.
The survival-only screens are hidden, and `Game.start()` always builds Kino.
The legacy bot and killstreak modules remain available to the engine but are
not reachable from the shipped UI.

---

## 4. DATA-DRIVEN KINO MAP

`js/maps/kino-der-toten.js` is the single source of truth:

- rooms, spawn points, window anchors, door, perk, Mystery Box, Pack-a-Punch
- economy values and player spawn
- `KinoMapDefinition` (data) + `KinoMapRuntime` (builder/anchors/door removal)

To extend the map, add data and builder geometry there instead of scattering
constants through gameplay code.

### Map facts

- Foyer: 22 x 20 m, 5.2 m ceiling.
- Theater: 24 x 20 m, 7 m ceiling, 0.44 m stage.
- Two windows with 1.15 m sills. Zombies are visible/shootable through the
  opening, then teleport inside after the boards fall.
- Barricades are three pairs of side planks (six boards) with a central
  eye-height slot.
- Door collider is removed when the theater door is purchased.

---

## 5. TESTING

The `tests/` folder contains Playwright scripts used to verify this build.
They expect a server on **http://127.0.0.1:8051/** and use headless Chrome
with `window.requestAnimationFrame` stubbed so `Game.update(dt)` can be
stepped deterministically.

```bash
python -m http.server 8051
python tests/test_kino.py
python tests/test_zombie_flow.py
python tests/test_kino_extra.py
python tests/test_controls.py
python tests/test_theater_path.py
```

See `tests/README.md` for what each script covers.

---

## 6. PLACEHOLDERS / NON-GOALS

- IRON HIDE is a placeholder perk (+50 max health).
- The Mystery Box grants a random existing primary; it does not build new
  weapon stats or camo definitions.
- Pack-a-Punch is an anchor only and shows `UPGRADE STATION - OFFLINE`.
- No external models, textures, audio, logos, or copyrighted assets.
- No mobile/touch controls.

This is a fan project, not affiliated with Activision or Treyarch.
