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

        res = await pg.evaluate("""() => {
            KinoMapRuntime.openDoor();
            Game.player.pos.set(0, 0, -20);
            Game.player.hp = Game.player.maxHp = 1000;   // survive long enough to observe pathing
            Game.player.eyeH = 1.62;
            const zs = Zombies.pool.filter(z=>!z.active).slice(0,3);
            const log=[];
            for (const z of zs) {
                z.activate(KinoMapDefinition.windows[0], 1, 1);
                z.feet.set(-8.4, 0.3, 0);
                z.group.position.copy(z.feet);
                z.state = 'CHASING';
                z.windowDef = KinoMapDefinition.windows[0];
            }
            for (let i=0;i<400;i++) {
                Game.update(0.05);
                if (i%100===0) log.push({t:(i*0.05).toFixed(1),
                    d:zs.map(z=>+Math.hypot(z.feet.x-Game.player.pos.x,z.feet.z-Game.player.pos.z).toFixed(1)),
                    states:zs.map(z=>z.state), hp:Math.round(Game.player.hp)});
                if (Game.state !== 'playing') break;
            }
            return {log, final:{hp:Game.player.hp, d:zs.map(z=>+Math.hypot(z.feet.x-Game.player.pos.x,z.feet.z-Game.player.pos.z).toFixed(1)),
                    states:zs.map(z=>z.state), state:Game.state}};
        }""")
        print("THEATER PATH:", json.dumps(res))
        await b.close()
    print("\nERRORS:")
    for e in errs:
        if 'ReadPixels' not in e and 'GL Driver Message' not in e:
            print(e)
asyncio.run(main())

