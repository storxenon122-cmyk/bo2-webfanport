import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader","--no-sandbox","--disable-gpu"])
        c = await b.new_context(viewport={"width":1280,"height":720})
        await c.add_init_script("window.requestAnimationFrame = () => 0;")
        pg = await c.new_page()
        errs=[]
        pg.on("console", lambda m: errs.append(f"[{m.type}] {m.text}"))
        pg.on("pageerror", lambda e: errs.append("PAGEERROR "+str(e)))
        await pg.goto("http://127.0.0.1:8051/", wait_until="domcontentloaded")
        await pg.wait_for_timeout(4000)
        await pg.click("#boot-screen"); await pg.wait_for_timeout(200)
        await pg.evaluate("Game.start({mode:'zombies'})")
        await pg.wait_for_timeout(300)

        # non-lethal hit must not cancel breaching
        st = await pg.evaluate("""() => {
            const z = Zombies.pool.find(z=>!z.active);
            z.activate(KinoMapDefinition.windows[0], 1, 1);
            z.state = 'BREACHING_BARRICADE';
            z.feet.set(-12.35, 0.3, 2);
            const hp0 = z.hp;
            z.damage(10, false);
            return {state:z.state, hp0, hp1:z.hp, alive:z.alive};
        }""")
        print("DAMAGE STATE:", json.dumps(st))

        # health bar uses maxHp
        hpbar = await pg.evaluate("""() => {
            Game.player.maxHp = 150;
            Game.player.hp = 75;
            HUD.setHealth((Game.player.hp / Game.player.maxHp) * 100);
            return {width: document.getElementById('health-fill').style.width};
        }""")
        print("HEALTH BAR:", json.dumps(hpbar))

        # power-up pickup + HUD timer
        pu = await pg.evaluate("""() => {
            Game.player.pos.set(0, 0, 4);
            Game.player.alive = true;
            Zombies._dropPowerup(new THREE.Vector3(0.4, 1.1, 4.2));
            const active0 = Zombies.powerup.active;
            Zombies._updatePowerup(0.05, Game);
            KinoHUD.update(0.05, Game);
            const el = document.getElementById('kino-powerup');
            return {active0, active1:Zombies.powerup.active, timer:Zombies.powerTimer,
                    label:Zombies.powerLabel, hidden:el.classList.contains('hidden'),
                    text:el.textContent.replace(/\\s+/g,' ').trim(),
                    reserve:Game.arms.primary.reserve, mag:Game.arms.primary.mag};
        }""")
        print("POWERUP:", json.dumps(pu))

        # keybind rebind changes the resolved key and restores
        kb = await pg.evaluate("""() => {
            const before = KeybindManager.resolve('interact');
            KeybindManager.setBind('interact', 'KeyG');
            const mid = KeybindManager.resolve('interact');
            KeybindManager.setBind('interact', before);
            return {before, mid, after:KeybindManager.resolve('interact')};
        }""")
        print("REBIND:", json.dumps(kb))

        # pause / resume state and panel visibility
        pause = await pg.evaluate("""() => {
            Game.pause();
            const p1 = {state:Game.state, kino:KinoGameState.state,
                        panel:!document.getElementById('kino-pause').classList.contains('hidden')};
            Game.resume();
            const p2 = {state:Game.state, kino:KinoGameState.state,
                        panel:!document.getElementById('kino-pause').classList.contains('hidden')};
            return {p1, p2};
        }""")
        print("PAUSE:", json.dumps(pause))

        await b.close()
    print("\nERRORS:")
    for e in errs:
        if 'ReadPixels' not in e and 'GL Driver Message' not in e:
            print(e)
asyncio.run(main())

