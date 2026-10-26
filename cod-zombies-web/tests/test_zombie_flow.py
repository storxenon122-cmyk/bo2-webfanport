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

        # ---- window line of fire check ----
        vis = await pg.evaluate("""() => {
            const w = KinoMapDefinition.windows[0];
            const z = Zombies.pool.find(z=>!z.active);
            z.activate(w, 1, 1);
            z.state='BREACHING_BARRICADE';
            z.feet.set(w.approach.x, 0, w.approach.z);
            z.group.position.copy(z.feet);
            const origin = new THREE.Vector3(0, 1.62, 4);
            const target = z.eye;
            const dir = target.clone().sub(origin).normalize();
            const hit = MapData.rayTest(origin, dir, 20);
            const ray = z.rayHit(origin, dir, 20);
            const sillHit = MapData.rayTest(new THREE.Vector3(0,1.20,4), new THREE.Vector3(-1,0,0), 20);
            return {wall:hit ? {d:hit.dist, metal:hit.collider.metal} : null,
                    zombie:ray, eyeY:target.y,
                    horizontalSillHit:sillHit ? sillHit.dist : null};
        }""")
        print("WINDOW LOS:", json.dumps(vis))

        # ---- let zombies play for 25s: should breach, chase, damage ----
        play = await pg.evaluate("""() => {
            const log=[];
            for (let i=0;i<500;i++) {
                Game.update(0.05);
                if (i%100===0) log.push({t:(i*0.05).toFixed(1), hp:Math.round(Game.player.hp),
                    alive:Zombies.aliveCount(), states:[...new Set(Zombies.zombies.filter(z=>z.active).map(z=>z.state))],
                    boards:KinoMapDefinition.windows.map(w=>BarricadeSystem.boards(w.id))});
                if (Game.state !== 'playing') break;
            }
            return {log, state:Game.state, hp:Game.player.hp, killed:Game.kills,
                    pts:PointsEconomy.total, kino:KinoGameState.state,
                    goVisible: !document.getElementById('kino-gameover').classList.contains('hidden')};
        }""")
        print("PLAY 25s:", json.dumps(play))

        # ---- restart then simulate round clear / round 2 ----
        await pg.click("#btn-kino-go-restart") if await pg.is_visible("#btn-kino-go-restart") else None
        await pg.evaluate("Game.start({mode:'zombies'})")
        await pg.wait_for_timeout(300)
        rounds = await pg.evaluate("""() => {
            // spend the whole budget immediately and kill anything alive
            RoundManager.spawnBudget = 0;
            for (const z of Zombies.zombies) if (z.active && z.alive) { z.alive=false; z.state='DYING'; Zombies.onKill(z, false, 'test'); }
            RoundManager.update(0.1);
            const ended = {round:RoundManager.round, intermission:RoundManager.intermission,
                           state:KinoGameState.state};
            for (let i=0;i<60;i++) RoundManager.update(0.1);   // 6s intermission
            return {ended, next:{round:RoundManager.round, budget:RoundManager.spawnBudget,
                                 maxAlive:RoundManager.maxAlive, active:RoundManager.active,
                                 zombiesActive:Zombies.active, interval:RoundManager.spawnInterval}};
        }""")
        print("ROUNDS:", json.dumps(rounds))

        await b.close()
    print("\nERRORS:")
    for e in errs:
        if 'ReadPixels' not in e and 'GL Driver Message' not in e:
            print(e)
asyncio.run(main())

