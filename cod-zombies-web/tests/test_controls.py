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

        frag = await pg.evaluate("""() => {
            Game.throwables.frag = 2;
            Game.cooking = false; Game.cookT = 0;
            Input.keys.KeyG = true;
            Game.update(0.05);
            const held = {cooking:Game.cooking, cookT:Game.cookT, frag:Game.throwables.frag};
            Input.keys.KeyG = false;
            Input._upEdges.KeyG = true;
            Game.update(0.05);
            return {held, released:{cooking:Game.cooking, frag:Game.throwables.frag,
                    nades:Game.nades.length, cookT:Game.cookT}};
        }""")
        print("FRAG:", json.dumps(frag))

        swap = await pg.evaluate("""() => {
            Game.swapT = 0; Game.slot = 'primary';
            Input.edges.weapon_swap = true;
            Game.update(0.05);
            return {slot:Game.slot, swapT:Game.swapT, viewmodel:Viewmodel.weaponId};
        }""")
        print("SWAP:", json.dumps(swap))

        await b.close()
    print("\nERRORS:")
    for e in errs:
        if 'ReadPixels' not in e and 'GL Driver Message' not in e:
            print(e)
asyncio.run(main())

