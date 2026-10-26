# HANDOFF - Standalone Kino der Toten Zombies Build

Read this before changing the game. This folder (`cod-zombies-web/`) is a
**standalone Zombies game**. It is not a branch of `../bo2-web`; it does not
read or write anything in that folder. If you change a shared engine file
here, copy nothing back to `bo2-web`.

## Project

- Location: `cod-zombies-web/` (this folder).
- Stack: static HTML + ES6 + Three.js r149 UMD + Web Audio. No bundler, no ES
  modules, no build step.
- Entry: `codzom.html` -> **ZOMBIES** -> **KINO DER TOTEN**.
- Scope: one foyer, one theater, two barricaded windows, one point-gated door,
  one perk placeholder, one Mystery Box placeholder, one Pack-a-Punch anchor.
- The original BO2 survival project is a separate folder and is intentionally
  left in its pre-Zombies state.

## Isolation contract

- No imports, paths, or network calls reference `../bo2-web`.
- The engine is copied into this folder. The two games can be served, zipped,
  or edited independently.
- Survival-only UI is hidden in this build (`SINGLE PLAYER` and `MULTIPLAYER`
  stay in the DOM so shared `Menu` bindings do not break, but they are
  `display:none`).
- `Game.start()` always builds Kino and sets `Game.mode='zombies'`. A legacy
  call without opts cannot start a survival map by accident.
- The loadout killstreak row is hidden. The HUD suppresses survival
  score/streak panels in Zombies mode.
- `README.md` documents controls and the play loop for players; this file is
  for the next developer.

## Entry / state flow

1. Click boot screen -> `KinoGameState.MAIN_MENU`.
2. **ZOMBIES** -> `#zombies-menu`.
3. **KINO DER TOTEN** -> `MenuManager.startKino()` ->
   `Game.start({mode:'zombies'})`.
4. `Game.start()` disposes the previous map, calls `buildKinoDerToten()`,
   initializes effects/bots/streaks (engine plumbing), sets up the player,
   weapons, HUD, then initializes Zombies systems:
   `PointsEconomy`, `BarricadeSystem`, `InteractionSystem`, `RoundManager`.
5. Pause is `Game.pause()` -> `#kino-pause`. Resume re-locks the pointer.
6. Death shows `#kino-gameover` with round/points/kills/headshots. Restart
   calls `Game.start({mode:'zombies'})`; Main Menu calls `Game.quit()`.

`KinoGameState` is `BOOT / MAIN_MENU / LOADING / PLAYING / PAUSED / GAME_OVER`.

## Modules

| File | Contract |
|---|---|
| `js/state/kino-state.js` | `KinoGameState`: state machine + small event bus. |
| `js/ui/settings.js` | `SettingsManager`: fills defaults, persists, applies FOV/volume live. |
| `js/ui/keybinds.js` | `KeybindManager`: action registry, resolve/down/pressed/up, rebind UI. |
| `js/ui/menu.js` | `MenuManager`: Zombies submenu, pause, game-over, start/restart/quit. |
| `js/ui/kino-hud.js` | `KinoHUD`: points, round, threats, perk icons, prompt/hold bar, power-up timer. |
| `js/systems/points.js` | `PointsEconomy`: balance, awards, spend/purchase results. |
| `js/systems/round-manager.js` | `RoundManager`: round number, alive cap, spawn budget, health scale, intermission. |
| `js/systems/barricades.js` | `BarricadeSystem`: 0..6 board stacks under window anchors; tear/repair/nearest. |
| `js/systems/interaction.js` | `InteractionSystem`: centre-screen angle/distance picking for door/repair/perk/box/Pap. |
| `js/ai/zombie.js` | `Zombie` (pooled AI) + `Zombies` spawner, separation, power-up drop. |
| `js/maps/kino-der-toten.js` | `KinoMapDefinition` data + `KinoMapRuntime` builder/anchors + `buildKinoDerToten`. |

### Enemy interface

Zombies expose the same surface weapons expect from bots:

- `eye`, `chest`, `alive`
- `rayHit(origin, dir, maxDist)`
- `damage(amount, headshot)`

`Game.enemies()` returns `Zombies.zombies` in a Kino run. Weapon, melee, and
explosion code must use `Game.enemies()` rather than hard-coding
`BotManager.bots`.

### Zombie states

`SPAWNING -> BREACHING_BARRICADE -> CHASING -> ATTACKING -> DYING -> DESPAWN`

Non-lethal hits deliberately preserve `SPAWNING` and `BREACHING_BARRICADE`.
Do not force a damaged breacher into `CHASING`; it will walk into the wall and
stall the round.

## Map data and balance

`KinoMapDefinition` is the source of truth for rooms, windows, door, perk,
Mystery Box, Pack-a-Punch, economy, and player spawn.

- Foyer 22 x 20 m, 5.2 m ceiling; theater 24 x 20 m, 7 m ceiling, 0.44 m stage.
- Window sill 1.15 m: player cannot step/jump out; zombies outside remain
  visible and shootable through the opening.
- Zombies path `spawn -> approach` outside, tear boards, then teleport to
  `inside` and chase. There is no navmesh.
- Barricades: three pairs of side planks (six boards, all above the sill),
  central eye-height slot. Tear/repair still uses the 0..6 count.
- Door `door_theater` costs 750. `KinoMapRuntime.openDoor()` splices its
  collider from `MapData.colliders` and hides the mesh.
- Perk `ironhide` ("IRON HIDE", 500) sets `Game.zombiePerks.ironhide`,
  `maxHp=150`, `hp=150`. Health HUD receives `hp/maxHp*100`.
- Mystery Box `mystery_box` costs 950 (hold F), grants a random existing
  primary via `Game.giveWeapon()`. It does not mutate base weapon stats or
  camo definitions.
- Pack-a-Punch `pack_a_punch` is `available:false`; prompt is
  `UPGRADE STATION - OFFLINE`.
- Round formula: `maxAlive=min(4+round*2,14)`,
  `budget=min(6+round*4,30)`, `healthScale=1+(round-1)*0.28`,
  `spawnInterval=max(0.7,1.6-round*0.05)`. Round 1 = 10 budget / 6 alive;
  intermission 5 s; pool hard cap 14.
- Awards: hit 10, kill 60, headshot kill +100, board repair 10; start 500.

## Controls

| Action | Default |
|---|---|
| interact / use | **F** |
| repair barricade | **E** (hold) |
| swap weapon | **X** |
| reload / melee / frag / tactical | R / V / G / Q |
| pause | Escape |

`Input.down()` resolves through `KeybindManager`; `Input.up()` accepts an
action id or a raw `KeyboardEvent.code` because keyup stores raw codes.
`DEFAULT_BINDS` includes `interact`, `repair`, `weapon_swap`.

## Rendering / engine notes

- The engine is a copy of the pre-Zombies BO2 Web code plus the separate
  Zombies modules. Do not copy these files back to `../bo2-web`.
- `KinoMapRuntime.build()` must call `MapData.addSky/addLamp/addBarrels/addSun`
  (not `this.*`) and must assign `MapData.sun`, `MapData.hemi`, `MapData.amb`.
  `Main.applyQuality()` and `MapData.dispose()` depend on those properties.
- `BarricadeSystem.clear()` disposes/nulls its shared `_geo` and `_mat`;
  `init()` rebuilds them. Board meshes live under map anchors, so dispose
  before map teardown.
- `MapData.dispose()` must run in `Game.start()` before building a new map.
- Window openings are deliberate geometry, not holes in collision. Do not
  "fix" the sill or teleport without re-running the window LOS test.
- `Zombies.zombies` is the full 14-instance pool, including inactive/dead
  instances. `rayHit` returns null when inactive; `aliveCount()` and minimap
  filters use `active && alive`.
- `KinoHUD.show(true)` adds `.zombies` to `#hud`; `show(false)` must run when
  returning to the menu/engine.
- Zombies game over does not auto-respawn.

## Verification

All tests were run against this folder on a local server
(`http://127.0.0.1:8051/`) with rAF stubbed and `Game.update(0.05)` stepped.
Zero console/page/request errors.

| Script | Result |
|---|---|
| `tests/test_kino.py` | Menu -> Zombies -> Kino; Round 1; 14 pool; 6/6 boards; kill 500 -> 560; repair +10; door 2000 -> 1250 + collider gone; perk 150 HP; box 950 + weapon reroll; Pap offline prompt; death/restart; main menu idle; volume 0.33; 12 keybinds; standalone UI checks; bare `Game.start()` forces Kino. |
| `tests/test_zombie_flow.py` | Window LOS clear (`wall:null`, zombie head hit); 25 s idle run breaches, chases, attacks, kills player; Round 1 -> intermission -> Round 2. |
| `tests/test_kino_extra.py` | Non-lethal hit preserves `BREACHING_BARRICADE`; health bar 50% at 75/150; MAX AMMO 10 s timer/refill/HUD; rebind round-trip; pause/resume. |
| `tests/test_controls.py` | G cook/release throws and decrements frag; X swaps to secondary. |
| `tests/test_theater_path.py` | Three foyer zombies path through the open theater door and attack a 1000-HP probe player. |

Separate `bo2-web` smoke test (original build, served on 8050): all five maps
build, player is grounded, bots spawn, UAV and Hellstorm activate/clear, zero
page errors. That build was restored from its pre-Zombies snapshot; it has no
Zombies references.

## Don't reintroduce

- Kino builder calling `this.addLamp` (must be `MapData.addLamp`).
- Unassigned `MapData.sun/hemi/amb` (lights leak / quality ignores Kino).
- Damage forcing breachers into `CHASING` (strands zombies outside).
- Raw HP passed to `HUD.setHealth()` when max HP is 150.
- `BarricadeSystem` reusing disposed geometry/material across rebuilds.
- `Input.up()` keyed only by action id (keyup stores raw codes).
- `weapon_swap` listed but not read in the swap block.
- Mystery Box replacing the primary without cancelling the reload.
- Minimap drawing `MapRotation.get().name` directly instead of `HUD._mapName`.
- Barricade boards hiding the zombie or sitting inside the sill.
- Window spill lights removed (the outside zombie becomes too dark to read).

## Known limitations / optional next work

- Pack-a-Punch is a placeholder anchor only.
- IRON HIDE is the only perk and only adds max health.
- One adjacent room (theater); no full-map expansion yet.
- Mouse buttons are not rebindable (fire/ADS are hard-coded).
- No gamepad or touch controls.
- `Game.start()` still initializes the copied bot/killstreak managers for
  engine safety, but the `mode === 'zombies'` branch of `Game.update()` never
  ticks them. Survival is unreachable from the shipped UI and `Game.start()`
  always builds Kino; do not add a survival entry point without a deliberate
  feature decision.
