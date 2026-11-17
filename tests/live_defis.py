"""Vérification RÉELLE des défis (vrais extraits Apple, vraies paroles LRCLIB) avec l'identité d'un iPhone.
Usage : python tests/live_defis.py [adresse du site | -] [défi/catégorie ...]"""
import sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
from conftest import IPHONE
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "-" else None
if not url:
    import functools, socketserver, threading
    from conftest import Quiet, ROOT
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/"

PLAN = [(a.split("/")[0], a.split("/")[1]) for a in sys.argv[2:]] or [
    ("lyrics", "80sint"), ("lyrics", "popfr"), ("lyrics", "rapfr"), ("karaoke", "80sfr"), ("puzzle", "pop"),
    ("underwater", "rock"), ("slow", "2000s")]

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", args=["--autoplay-policy=no-user-gesture-required"])
    page = b.new_context(**IPHONE).new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    for ch, music in PLAN:
        page.goto(url); page.wait_for_selector(".tile")
        page.click("[data-tab=defis]"); page.click(f".tile[data-challenge='{ch}']"); page.wait_for_timeout(400)
        page.select_option("#challenge-cat", music)
        page.click("#play")
        page.wait_for_selector("#go, .error-card", timeout=90000)
        assert page.locator("#go").count(), f"ÉCHEC {ch}/{music} : " + page.inner_text("main")
        page.click("#go")
        page.wait_for_selector(".choice")
        for _ in range(30):
            page.wait_for_timeout(500)
            st = page.evaluate("import('./js/audio.js').then(m => ({paused: m.getPlayer().paused, t: m.getPlayer().currentTime, src: m.getPlayer().src.slice(0, 5)}))")
            if not st["paused"] and st["t"] > 1:
                break
        info = page.evaluate("""(() => { const g = BT.game; return {
            n: g.rounds.length,
            fx: g.rounds.map(r => r.fx ? r.fx.effect : (r.fxFailed ? 'ÉCHEC' : '…')),
            q: g.rounds.filter(r => r.track.lyric).map(r => `${r.track.title} — ${r.track.artist} : « ${r.track.lyric.full} » → ${r.track.lyric.answer} / ${r.track.lyric.decoys.join(', ')}`) }; })()""")
        print(f"\n[{ch} · {music}] {info['n']} manches | lecture : {'oui' if not st['paused'] and st['t'] > 1 else 'NON'} ({st['src']}, {st['t']:.1f} s)")
        if ch != "lyrics":
            print("  effets préparés :", info["fx"][:3])
            badge = page.inner_text("#fx-badge")
            print("  bandeau :", badge)
        for q in info["q"]:
            print("  ", q)
        assert not st["paused"] and st["t"] > 1, ch
    assert not errs, errs
    print("\nOK : défis réels vérifiés")
    b.close()
