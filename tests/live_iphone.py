"""Vérification RÉELLE avec l'identité d'un iPhone (Safari iOS) : Apple doit répondre, sans rediriger
vers l'app Musique. Usage : python tests/live_iphone.py [adresse du site]"""
import sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
from conftest import IPHONE
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else None
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
    page.goto(url); page.wait_for_selector(".tile")
    page.click("[data-tab=epoques]"); page.click(".tile[data-cat='80s']"); page.wait_for_timeout(400)
    page.click("#play")
    page.wait_for_selector("#go, .error-card", timeout=30000)
    assert page.locator("#go").count(), "ÉCHEC : " + page.inner_text("main")
    page.click("#go"); page.wait_for_selector(".choice"); page.wait_for_timeout(3000)
    st = page.evaluate("import('./js/audio.js').then(m => ({paused: m.getPlayer().paused, t: m.getPlayer().currentTime}))")
    r = page.evaluate("({t: BT.game.current.track.title, a: BT.game.current.track.fullArtist})")
    print("Morceau :", r["t"], "—", r["a"], "| lecture :", "oui" if not st["paused"] and st["t"] > 1 else "NON", f"({st['t']:.1f} s)")
    assert not st["paused"] and st["t"] > 1
    assert not errs, errs
    print("OK : partie réelle lancée avec l'identité d'un iPhone sur", url)
    b.close()
