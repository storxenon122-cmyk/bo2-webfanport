# Run the games

From the repository folder, start the server for the game you want:

**BO2 Web Edition**

```powershell
cd bo2-web
py -m http.server 8000
```

Open <http://localhost:8000/> in your browser.

**Zombies Web Edition**

In a second terminal, from the repository folder:

```powershell
cd cod-zombies-web
py -m http.server 8051
```

Open <http://localhost:8051/> in your browser. Keep the server terminal open while playing; press Ctrl+C to stop it. If `py` is unavailable, use `python` instead.

## Check for errors

If something appears broken, open the browser developer tools (usually **F12**) and check the **Console** for red error messages. For the Zombies game, you can also run its optional Playwright checks; they report console errors, page errors, or failed requests and cover menu/game flow, rounds, controls, interactions, and gameplay paths. See the [test setup and coverage guide](cod-zombies-web/tests/README.md). You do not need to run tests just to play.
