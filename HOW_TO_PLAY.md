# How to Play

This repository contains two separate desktop FPS games. Pick one, start its local server (or open its HTML file), and use its own menu. Controls below are the defaults; settings and keybind screens may let you customize them.

## Start a game

1. Choose [BO2: Web Edition](bo2-web/README.md) or [Zombies: Kino der Toten](cod-zombies-web/README.md).
2. Start a local server from that game's folder:
   - BO2: `python -m http.server 8000`, then open <http://localhost:8000/bo2.html>.
   - Zombies: `python -m http.server 8051`, then open <http://localhost:8051/codzom.html>.
3. Click the game's start/menu screen. Click inside the game when prompted to capture the mouse. Press **Esc** to pause and release the mouse.

The browser needs WebGL and an internet connection to load Three.js from its CDN. These games are designed for desktop keyboard and mouse; touch and gamepad controls are not available.

## BO2: Web Edition

### What to do

Choose **Single Player**, select a class and one of the five original maps, then survive against continuously spawning enemy bots. Move through the map, aim and fire, watch your health and ammunition, and earn score to unlock scorestreaks. Customize classes, attachments, settings, and controls from the menus. Multiplayer is not implemented.

### Default controls

| Action | Control |
|---|---|
| Move | **W A S D** |
| Look | **Mouse** |
| Sprint (while moving forward) | **Shift** |
| Fire | **Left mouse button** |
| Aim down sights | **Right mouse button** |
| Reload | **R** |
| Jump | **Space** |
| Crouch / prone | **Left Ctrl** / **Z** |
| Melee | **V** |
| Lethal / tactical equipment | **G** / **Q** |
| Switch weapon | **1 / 2** or mouse wheel |
| Inspect weapon | **B** |
| Pause | **Esc** |

**Scorestreaks and number keys:** the number keys also deploy a ready scorestreak. If no streak is ready for that key, it switches weapons. Check the on-screen streak slots for readiness. Keybinds can be changed in Settings.

### Tips

- Start with the map and class that suit you; the game has no online multiplayer.
- Keep moving, use buildings and map cover, and reload between encounters.
- Enemies appear on the minimap when they fire; a UAV reveals them.
- Bots drop ammunition and grenade supplies. Pick them up as needed.
- Quality, sensitivity, field of view, and other options are available in Settings.

More features and setup details: [BO2 Web Edition README](bo2-web/README.md).

## Zombies: Kino der Toten Web Edition

### What to do

From the main menu choose **ZOMBIES**, then **KINO DER TOTEN**. Survive successive zombie rounds in the foyer. Shoot zombies to earn points, repair the two barricades to earn a little extra, and use points to open the theater door. The theater has a perk and Mystery Box; use the on-screen interaction prompts to purchase or use available objects.

You begin with **500 points**. The theater door costs **750**, so earn more before trying to open it. Hits and kills award points; headshot kills give a bonus. Zombies become more challenging as rounds progress. If you are overwhelmed and die, choose **RESTART** or return to the main menu.

### Default controls

| Action | Control |
|---|---|
| Move | **W A S D** |
| Look | **Mouse** |
| Sprint | **Shift** |
| Fire / aim | **Left mouse button** / **Right mouse button** |
| Reload | **R** |
| Melee | **V** |
| Interact (doors, perk, Mystery Box) | **F** |
| Repair a barricade | **Hold E** near it |
| Swap weapon | **X** (also **1 / 2** or mouse wheel) |
| Lethal / tactical equipment | **G** / **Q** |
| Pause / release mouse | **Esc** |

The game includes a **KEYBINDS** screen for rebinding Zombies actions. Follow the HUD prompts when near a door or object; some interactions require holding the key.

### First-round plan

1. Stay in the foyer and locate the boarded windows. Zombies approach through them.
2. Shoot enemies to build points. Repair boards when there is a safe opportunity; each repaired board awards points.
3. When you have enough, interact with the theater door and enter the next room.
4. The **IRON HIDE** perk increases maximum health. The **Mystery Box** gives a random primary weapon.
5. The Pack-a-Punch is currently an offline placeholder; it cannot upgrade weapons yet.

### Current limitations

This is an early, compact Zombies mode—not a complete recreation of the original map. It currently has a foyer and one theater room, one purchasable door, one perk, a Mystery Box, and a Pack-a-Punch placeholder. Touch/gamepad controls and online co-op are not implemented.

More details: [Zombies project README](cod-zombies-web/README.md).
