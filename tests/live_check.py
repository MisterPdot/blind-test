"""Vérification RÉELLE (Internet) : chaque catégorie fournit-elle assez d'extraits jouables ?
Lent exprès (l'API d'Apple limite à ~20 requêtes/minute). Usage : python tests/live_check.py [ids…]"""
import functools, http.server, json, socketserver, sys, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Q.extensions_map = {**Q.extensions_map, ".js": "text/javascript"}
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{srv.server_address[1]}/tests/unit.html?live"

JS = """async (id) => {
  const { buildPlaylist } = await import('/js/music.js');
  const { categoryById } = await import('/js/categories.js');
  const { Game } = await import('/js/game.js');
  let n = 0; const f = (u, o) => { n++; return fetch(u, o); };
  const t0 = performance.now();
  try {
    const cat = categoryById(id);
    const { tracks, extra } = await buildPlaylist(cat, 10, { fetchFn: f });
    const g = new Game({ cat, tracks, extra });
    const short = g.rounds.filter(r => r.choices.length < 4).length;
    return { id, ok: true, count: tracks.length, extra: extra.length, requests: n, ms: Math.round(performance.now() - t0),
             fewChoices: short,
             sample: g.rounds.slice(0, 5).map(r => `${r.track.title} — ${r.track.fullArtist}${r.track.work ? ' ['+r.track.work+']' : ''} (${r.track.year}) Q:${r.kind} → ${r.choices.join(' | ')}`) };
  } catch (e) { return { id, ok: false, code: e.code, msg: String(e.message), requests: n }; }
}"""

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    page = b.new_page()
    page.goto(url)
    page.evaluate("localStorage.clear()")
    ids = sys.argv[1:] or page.evaluate("import('/js/categories.js').then(m => m.CATEGORIES.map(c => c.id))")
    report = []
    for i, cid in enumerate(ids):
        r = page.evaluate(JS, cid)
        if not r["ok"] and r.get("code") == "busy":
            print(f"  {cid}: saturé, pause 70 s puis nouvel essai", flush=True)
            time.sleep(70)
            page.evaluate("localStorage.clear()")
            r = page.evaluate(JS, cid)
        report.append(r)
        if r["ok"]:
            print(f"{'OK ' if r['count'] >= 10 else 'BAS'} {cid}: {r['count']} morceaux (+{r['extra']} réserve), {r['requests']} requêtes, {r['ms']} ms, choix<4: {r['fewChoices']}", flush=True)
            for s in r["sample"]: print("      ", s, flush=True)
        else:
            print(f"ERR {cid}: {r.get('code')} {r.get('msg')} ({r['requests']} requêtes)", flush=True)
        if i < len(ids) - 1:
            time.sleep(max(15, r.get("requests", 8) * 3.2))
    (ROOT / "tests" / "live_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    b.close()
