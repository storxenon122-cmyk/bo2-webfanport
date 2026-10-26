# BO2 Web Fan Port

A small collection of two independent, browser-playable first-person games inspired by the Call of Duty universe. They run directly from static HTML, CSS, and JavaScript—there is no build step or package installation needed. Three.js is loaded from a CDN, so an internet connection is needed when the game first loads.

> **Fan-made project:** This repository is not affiliated with, endorsed by, or sponsored by Activision or Treyarch. The games use original, procedurally generated graphics and synthesized audio; they do not include official game assets.

## Choose a game

| Project | What it is | Start here |
|---|---|---|
| **BO2: Web Edition** | A solo, continuous-survival FPS with five original maps, enemy bots, customizable classes, weapons, and scorestreaks. | [Play BO2 online](https://storxenon122-cmyk.github.io/bo2-webfanport/bo2-web/bo2.html) · [Project details](bo2-web/README.md) |
| **Zombies: Kino der Toten Web Edition** | A separate, round-based Zombies game. Defend the foyer, earn points, repair barricades, and unlock the theater. | [Play Zombies online](https://storxenon122-cmyk.github.io/bo2-webfanport/cod-zombies-web/codzom.html) · [Project details](cod-zombies-web/README.md) |

These are **separate games** in separate folders. Starting or editing one does not start or change the other. The Zombies game is a compact work in progress: it currently includes the foyer and theater, with several shop/perk features still marked as placeholders.

## How to play

Read the [How to Play guide](HOW_TO_PLAY.md) for setup, objectives, controls, and first-match tips for both games.

Both games are designed for desktop keyboard and mouse, including mouse capture (Pointer Lock). Touch controls and gamepad support are not implemented.

## Run locally

You can open either game's HTML file directly, or use a local web server (recommended):

**BO2 Web Edition** — in a terminal, change to `bo2-web/` and run:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000/bo2.html>.

**Zombies Web Edition** — change to `cod-zombies-web/` and run:

```bash
python -m http.server 8051
```

Then visit <http://localhost:8051/codzom.html>.

If `python` is not recognized on Windows, try `py -m http.server 8000` or `py -m http.server 8051` from the appropriate game folder. Keep the server terminal open while playing; stop it with Ctrl+C when finished. Each game also has its own no-cache development server—see its project README.

## Repository map

- `bo2-web/` — BO2-inspired continuous-survival game.
- `cod-zombies-web/` — standalone round-based Kino Zombies game and its browser smoke tests.
- `HOW_TO_PLAY.md` — player-facing setup and control guide for both games.

## Development and tests

There is no build or bundling step. The code uses regular script tags and Three.js r149 from a CDN. See each game's README for its file layout and implementation notes. The Zombies Playwright smoke tests and their prerequisites are documented in [cod-zombies-web/tests/README.md](cod-zombies-web/tests/README.md).
