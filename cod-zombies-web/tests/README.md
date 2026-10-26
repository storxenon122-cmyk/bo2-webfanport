# Run checks and find errors

From the `cod-zombies-web/` folder, start the local server:

```powershell
py -m http.server 8051
```

Open <http://127.0.0.1:8051/codzom.html> to play. Keep the server running while using the game or running checks. If `py` is unavailable, use `python -m http.server 8051`.

## Run the checks

In a second terminal, also from `cod-zombies-web/`, run:

```powershell
py tests/test_kino.py
py tests/test_zombie_flow.py
py tests/test_kino_extra.py
py tests/test_controls.py
py tests/test_theater_path.py
```

The checks cover the menu and round flow, shooting and points, barricade repair, door and shop interactions, perk and Mystery Box behavior, death and restart, zombie spawning and pathing, controls, pause/resume, and keybinds. A failing check prints an error and exits with a non-zero status; a successful check completes without a failure. The tests require Python with Playwright installed and Google Chrome.

To check errors while playing, press **F12** in the browser and open the **Console** tab. Look for red error messages. You do not need to run the checks unless you are troubleshooting or want to verify a change.
