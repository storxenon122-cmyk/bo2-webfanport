"""End-to-end test for the Kino der Toten vertical slice.

Loads the page with rAF disabled so every step is deterministic, then drives
the real menu / Game / Zombies / interaction systems.
"""
import asyncio
import json
import sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8051/codzom.html"

async def main():
    console = []
    page_errors = []
    failed = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--use-gl=swiftshader", "--no-sandbox", "--disable-gpu"],
        )
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        # stop the real loop so tests are deterministic (Main.boot's loop runs once)
        await ctx.add_init_script("window.requestAnimationFrame = () => 0;")
        page = await ctx.new_page()
        page.on("console", lambda m: console.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("requestfailed", lambda r: failed.append(f"{r.url} -> {r.failure}"))

        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)
        print("THREE:", await page.evaluate("typeof THREE !== 'undefined'"))
        print("globals:", await page.evaluate(
            "() => ({game:typeof Game!=='undefined', kino:typeof KinoGameState!=='undefined',"
            " z:typeof Zombies!=='undefined', hud:typeof KinoHUD!=='undefined',"
            " mm:typeof MenuManager!=='undefined', kb:typeof KeybindManager!=='undefined'})"))

        # boot
        await page.click("#boot-screen")
        await page.wait_for_timeout(300)
        print("state after boot:", await page.evaluate("KinoGameState.state"))
        print("main menu visible:", await page.is_visible("#main-menu"))
        print("zombies button:", await page.is_visible("#btn-zombies"))

        # main -> zombies -> kino
        await page.click("#btn-zombies")
        await page.wait_for_timeout(200)
        print("zombies submenu:", await page.is_visible("#zombies-menu"))
        await page.click("#btn-zombies-kino")
        await page.wait_for_timeout(1200)

        info = await page.evaluate("""() => ({
            state: Game.state, mode: Game.mode, kino: KinoGameState.state,
            round: RoundManager.round, points: PointsEconomy.total,
            pool: Zombies.pool.length, map: HUD.el['wave-info'] ? 'ok' : 'no',
            player: {x:Game.player.pos.x,y:Game.player.pos.y,z:Game.player.pos.z},
            doorOpen: KinoMapRuntime.doorOpen,
            boards: KinoMapDefinition.windows.map(w => BarricadeSystem.boards(w.id)),
            colliders: MapData.colliders.length,
            kinoHud: !document.getElementById('kino-hud').classList.contains('hidden')
        })""")
        print("KINO START:", json.dumps(info))

        # step 3 seconds: should spawn zombies near the windows
        await page.evaluate("() => { for (let i=0;i<60;i++) Game.update(0.05); }")
        info = await page.evaluate("""() => ({
            state: Game.state,
            alive: Zombies.aliveCount(),
            active: Zombies.zombies.filter(z=>z.active).length,
            states: Zombies.zombies.filter(z=>z.active).map(z=>z.state),
            boards: KinoMapDefinition.windows.map(w => BarricadeSystem.boards(w.id)),
            roundRemaining: RoundManager.remaining()
        })""")
        print("AFTER 3s:", json.dumps(info))

        # ---- shooting: put one live zombie directly in front of the player ----
        shoot = await page.evaluate("""() => {
            const z = Zombies.zombies.find(z => z.active && z.alive);
            if (!z) return {error:'no live zombie'};
            z.deactivate();
            z.activate(KinoMapDefinition.windows[0], 1, 1);
            z.state = 'CHASING';
            z.feet.set(-0.0, 0, 0.0);
            z.group.position.copy(z.feet);
            Game.player.pos.set(0, 0, 3);
            Game.camera.position.set(0, 1.62, 3);
            Game.camera.lookAt(0, 1.15, 0);
            Game.camera.updateMatrixWorld(true);
            const before = {hp:z.hp, pts:PointsEconomy.total};
            const def = Game.curWeapon().def;
            for (let i=0;i<12 && z.alive;i++) {
              Game.bloom = 0;
              Game._hitscan(def);
            }
            return {before, after:{hp:z.hp, alive:z.alive, pts:PointsEconomy.total},
                    kills:Game.kills, heads:Game.headshots};
        }""")
        print("SHOOT:", json.dumps(shoot))

        # ---- repair barricade: stand at west window, hold F ----
        repair = await page.evaluate("""() => {
            const w = KinoMapDefinition.windows[0];
            BarricadeSystem.tear(w.id);
            BarricadeSystem.tear(w.id);
            const before = BarricadeSystem.boards(w.id);
            Game.player.pos.set(w.inside.x + 1.2, 0, w.inside.z);
            Game.camera.position.set(Game.player.pos.x, 1.62, Game.player.pos.z);
            const a = KinoMapRuntime.anchors['repair:' + w.id];
            const p = a.getWorldPosition(new THREE.Vector3());
            Game.camera.lookAt(p);
            Game.camera.updateMatrixWorld(true);
            Input.keys.KeyE = true;
            InteractionSystem.update(0.05, Game);   // acquire target
            const pts0 = PointsEconomy.total;
            for (let i=0;i<8;i++) InteractionSystem.update(0.2, Game);
            Input.keys.KeyE = false;
            return {before, after:BarricadeSystem.boards(w.id),
                    pts0, pts1:PointsEconomy.total,
                    target: InteractionSystem.target ? InteractionSystem.target.id : null,
                    prompt: KinoHUD._lc.prompt};
        }""")
        print("REPAIR:", json.dumps(repair))

        # ---- buy door: stand in foyer facing the door ----
        door = await page.evaluate("""() => {
            PointsEconomy.total = 2000;
            const before = PointsEconomy.total;
            Game.player.pos.set(0, 0, -7.5);
            Game.camera.position.set(0, 1.62, -7.5);
            const a = KinoMapRuntime.anchors[KinoMapDefinition.door.id];
            const p = a.getWorldPosition(new THREE.Vector3());
            Game.camera.lookAt(p);
            Game.camera.updateMatrixWorld(true);
            InteractionSystem.update(0.05, Game);
            Input.edges.interact = true;
            InteractionSystem.update(0.05, Game);
            return {before, after:PointsEconomy.total, open:KinoMapRuntime.doorOpen,
                    colliderGone: !MapData.colliders.some(c => c.mesh === KinoMapRuntime.doorMesh),
                    target: InteractionSystem.target ? InteractionSystem.target.id : null};
        }""")
        print("DOOR:", json.dumps(door))

        # ---- buy perk ----
        perk = await page.evaluate("""() => {
            const P = KinoMapDefinition.perk;
            PointsEconomy.total = 2000;
            Game.player.pos.set(P.x, 0, P.z + 1.8);
            Game.camera.position.set(P.x, 1.62, P.z + 1.8);
            const a = KinoMapRuntime.anchors[P.id];
            const p = a.getWorldPosition(new THREE.Vector3());
            Game.camera.lookAt(p);
            Game.camera.updateMatrixWorld(true);
            InteractionSystem.update(0.05, Game);
            Input.edges.interact = true;
            InteractionSystem.update(0.05, Game);
            return {owned:!!Game.zombiePerks.ironhide, hp:Game.player.hp, maxHp:Game.player.maxHp,
                    pts:PointsEconomy.total,
                    target: InteractionSystem.target ? InteractionSystem.target.id : null};
        }""")
        print("PERK:", json.dumps(perk))

        # ---- mystery box (hold F) ----
        box = await page.evaluate("""() => {
            const B = KinoMapDefinition.mysteryBox;
            PointsEconomy.total = 2000;
            const beforeWeapon = Game.arms.primary.def.id;
            Game.player.pos.set(B.x, 0, B.z + 1.8);
            Game.camera.position.set(B.x, 1.62, B.z + 1.8);
            const a = KinoMapRuntime.anchors[B.id];
            const p = a.getWorldPosition(new THREE.Vector3());
            Game.camera.lookAt(p);
            Game.camera.updateMatrixWorld(true);
            Input.keys.KeyF = true;
            InteractionSystem.update(0.05, Game);
            for (let i=0;i<12;i++) InteractionSystem.update(0.15, Game);
            Input.keys.KeyF = false;
            return {beforeWeapon, afterWeapon:Game.arms.primary.def.id,
                    pts:PointsEconomy.total, target: InteractionSystem.target ? InteractionSystem.target.id : null};
        }""")
        print("BOX:", json.dumps(box))

        # ---- Pap anchor prompt (offline) ----
        pap = await page.evaluate("""() => {
            const K = KinoMapDefinition.packAPunch;
            Game.player.pos.set(K.x, 0.44, K.z + 2.0);
            Game.camera.position.set(K.x, 2.0, K.z + 2.0);
            const a = KinoMapRuntime.anchors[K.id];
            const p = a.getWorldPosition(new THREE.Vector3());
            Game.camera.lookAt(p);
            Game.camera.updateMatrixWorld(true);
            InteractionSystem.update(0.05, Game);
            return {target: InteractionSystem.target ? InteractionSystem.target.id : null,
                    prompt: KinoHUD._lc.prompt};
        }""")
        print("PAP:", json.dumps(pap))

        # ---- death / game over ----
        death = await page.evaluate("""() => {
            Game.onPlayerHit(999, Game.player.eye, false);
            return {state:Game.state, kino:KinoGameState.state,
                    goVisible: !document.getElementById('kino-gameover').classList.contains('hidden'),
                    round:document.getElementById('kino-go-round').textContent,
                    points:document.getElementById('kino-go-points').textContent};
        }""")
        print("DEATH:", json.dumps(death))

        # ---- restart ----
        await page.click("#btn-kino-go-restart")
        await page.wait_for_timeout(800)
        restart = await page.evaluate("""() => ({
            state:Game.state, kino:KinoGameState.state, round:RoundManager.round,
            points:PointsEconomy.total, boards:KinoMapDefinition.windows.map(w=>BarricadeSystem.boards(w.id)),
            doorOpen:KinoMapRuntime.doorOpen, alive:Zombies.aliveCount(),
            kinoHud: !document.getElementById('kino-hud').classList.contains('hidden')
        })""")
        print("RESTART:", json.dumps(restart))

        # ---- die again then main menu ----
        await page.evaluate("() => Game.onPlayerHit(999, Game.player.eye, false)")
        await page.wait_for_timeout(100)
        await page.click("#btn-kino-go-menu")
        await page.wait_for_timeout(400)
        menu = await page.evaluate("""() => ({
            gameState:Game.state, mode:Game.mode, menu:Menu.current,
            kino:KinoGameState.state,
            mainVisible: !document.getElementById('main-menu').classList.contains('hidden'),
            hudHidden: document.getElementById('hud').classList.contains('hidden')
        })""")
        print("MAIN MENU:", json.dumps(menu))

        # ---- settings volume live ----
        await page.click("#btn-settings")
        await page.wait_for_timeout(200)
        vol = await page.evaluate("""() => {
            const el = document.getElementById('set-vol');
            el.value = '0.33';
            el.dispatchEvent(new Event('input', {bubbles:true}));
            return {data:Settings.data.volume, audio:AudioFX.volume, label:document.getElementById('val-vol').textContent};
        }""")
        print("VOLUME:", json.dumps(vol))
        await page.click("#btn-set-back")
        await page.wait_for_timeout(200)

        # ---- keybinds screen ----
        await page.click("#btn-keybinds")
        await page.wait_for_timeout(200)
        keys = await page.evaluate("""() => ({
            visible: !document.getElementById('keybinds-screen').classList.contains('hidden'),
            rows: document.querySelectorAll('#keybind-list .keybind').length,
            actions: [...document.querySelectorAll('#keybind-list .keybind')].map(b=>b.dataset.action)
        })""")
        print("KEYBINDS:", json.dumps(keys))

        # ---- standalone build: survival entry points hidden ----
        await page.evaluate("Menu.show('main-menu')")
        await page.wait_for_timeout(150)
        standalone = await page.evaluate("""() => ({
            title: document.title,
            singleplayerHidden: getComputedStyle(document.getElementById('btn-singleplayer')).display === 'none',
            multiplayerHidden: getComputedStyle(document.getElementById('btn-multiplayer')).display === 'none',
            killstreakRowHidden: getComputedStyle(document.getElementById('lo-streak1').closest('.lo-slot')).display === 'none',
            zombiesVisible: getComputedStyle(document.getElementById('btn-zombies')).display !== 'none'
        })""")
        print("STANDALONE UI:", json.dumps(standalone))

        # ---- bare Game.start() must still build Kino, never survival ----
        forced = await page.evaluate("""() => {
            Menu.show(null);
            MapRotation.set('nuketown');
            Game.start();
            for (let i=0;i<80;i++) Game.update(0.05);
            return {
                state:Game.state, mode:Game.mode,
                mapName:HUD._mapName,
                kino:!document.getElementById('kino-hud').classList.contains('hidden'),
                hudZombies:document.getElementById('hud').classList.contains('zombies'),
                pool:Zombies.pool.length,
                bots:BotManager.alive().length
            };
        }""")
        print("FORCED KINO:", json.dumps(forced))

        await browser.close()

    real_console = [e for e in console if 'ReadPixels' not in e and 'GL Driver Message' not in e
                    and 'Automatic fallback to software WebGL' not in e]
    print("\n=== CONSOLE (%d) ===" % len(real_console))
    for e in real_console[:80]:
        print(e)
    print("\n=== PAGE ERRORS (%d) ===" % len(page_errors))
    for e in page_errors[:20]:
        print(e)
    print("\n=== FAILED REQUESTS (%d) ===" % len(failed))
    for e in failed[:20]:
        print(e)
    sys.exit(1 if (real_console or page_errors or failed) else 0)

asyncio.run(main())
