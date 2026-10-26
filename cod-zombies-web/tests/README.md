# Tests

These are Playwright smoke/regression scripts for the standalone Kino build.
They are not part of the game runtime.

## Prerequisites

- Python 3 with Playwright installed (`python -m pip install playwright`).
- Google Chrome installed at the default Windows path, or edit the launch
  options in each script.
- A server for this folder on port **8051**:

```bash
python -m http.server 8051
```

The scripts stub `window.requestAnimationFrame` and step `Game.update(0.05)`
manually, so they do not depend on real-time rendering speed.

## Run

From the `cod-zombies-web/` folder:

```bash
python tests/test_kino.py
python tests/test_zombie_flow.py
python tests/test_kino_extra.py
python tests/test_controls.py
python tests/test_theater_path.py
```

Each script exits non-zero if it records console errors, page errors, or
failed requests.

## Coverage

| Script | Covers |
|---|---|
| `test_kino.py` | Full menu -> Kino -> Round 1 chain, shooting/points, repair, door, perk, Mystery Box, Pack-a-Punch prompt, death/restart, main menu, volume, keybinds, standalone-only UI, forced-Kino `Game.start()`. |
| `test_zombie_flow.py` | Window line-of-sight, breach/chase/attack/death over 25 s, Round 1 -> intermission -> Round 2. |
| `test_kino_extra.py` | Breach-state preservation after a non-lethal hit, 150 HP health bar ratio, MAX AMMO power-up, rebind round-trip, pause/resume. |
| `test_controls.py` | Frag cook/release, X weapon swap. |
| `test_theater_path.py` | Zombies pathing through the purchased theater door and attacking inside. |

## Notes

- Headless Chrome uses SwiftShader, so frame times are not representative of
  real hardware. The scripts assert game state, not FPS.
- `ReadPixels` / software-WebGL driver warnings are filtered out; they are
  headless artifacts, not game errors.
- If pointer lock is refused in automation, the game may pause; the scripts
  set state/resume explicitly where needed.
