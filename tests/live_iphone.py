"""Vérification RÉELLE avec l'identité d'un iPhone (Safari iOS) : Apple doit répondre, sans rediriger
vers l'app Musique. Usage : python tests/live_iphone.py [adresse du site] [catégorie ...]"""
import sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
from conftest import IPHONE
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "-" else None
CATS = sys.argv[2:] or ["80s"]
if not url:
    import functools, http.server, socketserver, threading
    from conftest import Quiet, ROOT
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/"
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", args=["--autoplay-policy=no-user-gesture-required"])
    page = b.new_context(**IPHONE).new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    for cat in CATS:
        page.goto(url); page.wait_for_selector(".tile")
        group = page.evaluate("(id) => import('./js/categories.js').then(m => m.categoryById(id).group)", cat)
        page.click(f"[data-tab={group}]"); page.click(f".tile[data-cat='{cat}']"); page.wait_for_timeout(400)
        page.click("#play")
        page.wait_for_selector("#go, .error-card", timeout=30000)
        assert page.locator("#go").count(), f"ÉCHEC {cat} : " + page.inner_text("main")
        page.click("#go"); page.wait_for_selector(".choice")
        for _ in range(20):  # jusqu'à 10 s pour que l'extrait démarre (réseau lent)
            page.wait_for_timeout(500)
            st = page.evaluate("import('./js/audio.js').then(m => ({paused: m.getPlayer().paused, t: m.getPlayer().currentTime}))")
            if not st["paused"] and st["t"] > 1:
                break
        r = page.evaluate("({t: BT.game.current.track.title, a: BT.game.current.track.artist, w: BT.game.current.track.work, q: BT.game.current.prompt, c: BT.game.current.choices})")
        print(f"[{cat}] {r['q']} → {r['w'] or r['t']} ({r['t']} — {r['a']}) | choix : {r['c']} | lecture :",
              "oui" if not st["paused"] and st["t"] > 1 else "NON", f"({st['t']:.1f} s)")
        assert not st["paused"] and st["t"] > 1, cat
    assert not errs, errs
    print("OK : parties réelles lancées avec l'identité d'un iPhone sur", url, "—", ", ".join(CATS))
    b.close()
