"""Parties complètes jouées dans un « iPhone » simulé (Edge, écran 390×844, tactile).
L'API Apple et les extraits audio sont simulés : tests rapides, sans Internet."""
import io
import json
import math
import re
import struct
import wave
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from conftest import IPHONE, ROOT

SHOTS = ROOT / "tests" / "screens"
SHOTS.mkdir(exist_ok=True)
WORDS = ["Lumière", "Minuit", "Danse", "Océan", "Étoile", "Rêve", "Feu", "Paradis", "Tempête", "Soleil", "Liberté",
         "Cœur", "Nuit blanche", "Horizon", "Vertige", "Saturne"]


def _wav(seconds=8.0, rate=8000):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(3000 * math.sin(2 * math.pi * 440 * i / rate)))
                               for i in range(int(seconds * rate))))
    return buf.getvalue()


WAV = _wav()
PNG = (ROOT / "icons" / "icon-512.png").read_bytes()


def _songs(term):
    out = []
    for i, w in enumerate(WORDS):
        tid = abs(hash((term, i))) % 10**9
        out.append({
            "kind": "song", "trackId": tid, "trackName": f"{w} {term.split()[0]}" if i % 3 else w,
            "artistName": term, "collectionName": f"{term} (Original Motion Picture Soundtrack)",
            "previewUrl": f"https://audio.test/{tid}.wav", "artworkUrl100": f"https://art.test/{tid}/100x100bb.jpg",
            "trackViewUrl": "https://music.apple.com/fr/x", "releaseDate": "2021-05-01T07:00:00Z",
        })
    return out


def _lookup(ids):
    return [{
        "kind": "song", "trackId": int(tid), "trackName": "Nom Apple", "artistName": "Artiste Apple",
        "collectionName": "Album", "previewUrl": f"https://audio.test/{tid}.wav",
        "artworkUrl100": f"https://art.test/{tid}/100x100bb.jpg", "trackViewUrl": "https://music.apple.com/fr/x",
        "releaseDate": "2011-05-01T07:00:00Z",
    } for tid in ids]


def _new_page(browser, base_url, api="ok", audio_ok=True):
    ctx = browser.new_context(**IPHONE)
    page = ctx.new_page()
    problems = []
    page.on("pageerror", lambda e: problems.append(f"pageerror: {e}"))
    page.on("console", lambda m: problems.append(f"console: {m.text}") if m.type == "error" else None)
    calls = []

    def itunes(route):
        calls.append(route.request.url)
        if api == "busy":
            return route.fulfill(status=403, body="")
        if api == "down":
            return route.abort()
        if api == "hang":
            return  # ne répond jamais : chargement interminable
        q = parse_qs(urlparse(route.request.url).query)
        results = _lookup(q["id"][0].split(",")) if "id" in q else _songs(q["term"][0])
        route.fulfill(status=200, content_type="text/javascript",
                      headers={"Access-Control-Allow-Origin": "*"},
                      body=json.dumps({"resultCount": len(results), "results": results}))

    ctx.route("https://itunes.apple.com/**", itunes)
    ctx.route("https://audio.test/**", lambda r: r.fulfill(status=200, content_type="audio/wav", body=WAV)
              if audio_ok else r.fulfill(status=404, body=""))
    ctx.route("https://art.test/**", lambda r: r.fulfill(status=200, content_type="image/png", body=PNG))
    page.goto(base_url + "/")
    page.wait_for_selector(".tile")
    page.problems = problems
    page.api_calls = calls
    return ctx, page


def _no_problems(page):
    # Les 404 d'extraits volontaires génèrent un message console du navigateur : on les ignore.
    real = [p for p in page.problems if "Failed to load resource" not in p]
    assert not real, real


def _correct(page):
    return page.evaluate("""(() => { const r = BT.game.current;
        return r.kind === 'title' ? r.track.title : r.kind === 'artist' ? r.track.artist : r.track.work; })()""")


def _audio_playing(page):
    return page.evaluate("import('/js/audio.js').then(m => !m.getPlayer().paused && m.getPlayer().src.includes('audio.test'))")


def _open(page, cat):
    group = page.evaluate("(id) => import('/js/categories.js').then(m => m.categoryById(id).group)", cat)
    page.click(f"[data-tab={group}]")
    page.click(f".tile[data-cat='{cat}']")
    page.wait_for_selector("#sheet-root.open .sheet")
    page.wait_for_timeout(350)


def _set(page, key, val):
    page.click(f"#sheet-root [data-key={key}] [data-val='{val}']")


# ───────────────────────────────────────────────────────────────────────────────
def test_accueil_et_categories(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    page.screenshot(path=str(SHOTS / "01-accueil.png"))
    assert page.locator(".tile").count() == 14  # Genres
    page.click("[data-tab=epoques]")
    assert page.locator(".tile").count() == 9
    page.click("[data-tab=themes]")
    assert page.locator(".tile").count() == 10
    page.screenshot(path=str(SHOTS / "02-themes.png"))
    # l'invite « installer sur l'iPhone » s'affiche (Safari iOS simulé) et se ferme
    assert page.locator("#install-hint").is_visible()
    page.click("#install-hint .hint-x")
    page.reload(); page.wait_for_selector(".tile")
    assert page.locator("#install-hint").count() == 0
    # pas de défilement horizontal sur un écran d'iPhone
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    _no_problems(page)
    ctx.close()


def test_themes_selection_series_et_80s(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    for cat, prompt in [("series", "De quelle série ?"), ("80sfr", None)]:
        _open(page, cat)
        page.click("#play")
        page.wait_for_selector("#go")
        page.click("#go")
        for i in range(3):
            page.wait_for_selector(".choice")
            if prompt:
                assert prompt in page.inner_text(".prompt")
            good = _correct(page)
            page.locator(".choice", has_text=good).first.click()
            page.wait_for_selector(".verdict.ok")
            if i == 0:
                page.screenshot(path=str(SHOTS / f"15-{cat}.png"))
            page.click("#next")
        page.goto(base_url + "/")
        page.wait_for_selector(".tile")
    lookups = [c for c in page.api_calls if "/lookup?" in c]
    assert len(lookups) == 2 and len(page.api_calls) == 2, page.api_calls
    _no_problems(page)
    ctx.close()


def test_partie_solo_complete(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    _open(page, "pop")
    page.screenshot(path=str(SHOTS / "03-reglages-solo.png"))
    assert "Pas encore de record" in page.inner_text(".record")
    page.click("#play")
    page.wait_for_selector("#go")
    page.screenshot(path=str(SHOTS / "04-intro.png"))
    page.click("#go")
    assert page.evaluate("BT.game.rounds.length") == 10
    total = 0
    for i in range(10):
        page.wait_for_selector(".choice")
        assert page.locator(".choice").count() == 4
        page.wait_for_function("!document.querySelector('#time') || document.querySelector('#time').textContent !== ''")
        if i == 0:
            page.wait_for_function("document.querySelector('#time').textContent !== '20'", timeout=5000)
            assert _audio_playing(page), "l'extrait doit être en lecture"
            page.screenshot(path=str(SHOTS / "05-manche.png"))
        good = _correct(page)
        texts = page.locator(".choice").all_inner_texts()
        assert good in texts
        if i == 3:  # une erreur volontaire
            wrong = next(t for t in texts if t != good)
            page.locator(".choice", has_text=wrong).first.click()
            page.wait_for_selector(".choice.wrong")
            assert page.locator(".choice.wrong").count() == 1 and page.locator(".choice.right").count() == 1
            page.wait_for_selector(".verdict.ko")
        else:
            page.locator(".choice", has_text=good).first.click()
            page.wait_for_selector(".verdict.ok")
            pts = int(re.search(r"\+(\d+)", page.inner_text(".verdict")).group(1))
            assert 100 <= pts <= 250
            total += pts
        if i == 0:
            page.wait_for_selector(".cover")
            page.screenshot(path=str(SHOTS / "06-revelation.png"))
        assert int(page.inner_text("#score")) == total
        page.click("#next")
    page.wait_for_selector(".big-score")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "07-resultats-solo.png"), full_page=True)
    assert int(page.inner_text("#final-score")) == total
    assert "9/10" in page.inner_text(".stats")
    assert page.locator(".badge-record").is_visible()
    assert page.locator(".recap-row").count() == 10
    # réécouter un extrait du récapitulatif
    page.click(".recap-row[data-i='2'] .recap-play")
    page.wait_for_timeout(500)
    assert _audio_playing(page)
    assert page.locator(".recap-row.playing").count() == 1
    # record affiché sur la tuile à l'accueil
    page.click("#home")
    page.wait_for_selector(".tile")
    assert str(total) in page.inner_text(".tile[data-cat='pop'] .tile-rec")
    assert len(page.api_calls) <= 10, f"{len(page.api_calls)} requêtes pour une partie"
    _no_problems(page)
    ctx.close()


def test_mode_difficile_extrait_coupe(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    _open(page, "rock")
    _set(page, "level", "hard")
    _set(page, "duration", "20")
    assert "5 secondes" in page.inner_text("#sheet-root")
    page.click("#play")
    page.wait_for_selector("#go")
    assert "Difficile" in page.inner_text(".hard-badge")
    page.click("#go")
    page.wait_for_selector(".choice")
    assert _audio_playing(page)
    # après 5 s d'écoute, le son s'arrête mais le chrono continue
    page.wait_for_selector(".clip-over", timeout=9000)
    page.screenshot(path=str(SHOTS / "16-difficile.png"))
    assert page.evaluate("import('/js/audio.js').then(m => m.getPlayer().paused)")
    left = int(page.inner_text("#time"))
    assert 8 <= left <= 15, left
    page.wait_for_timeout(1200)
    assert int(page.inner_text("#time")) < left
    good = _correct(page)
    page.locator(".choice", has_text=good).first.click()
    page.wait_for_selector(".verdict.ok")
    pts = int(re.search(r"\+(\d+)", page.inner_text(".verdict")).group(1))
    assert 150 <= pts <= 375, pts  # points ×1,5
    page.wait_for_timeout(400)
    assert _audio_playing(page), "la suite de l'extrait est jouée après la réponse"
    assert page.locator(".clip-over").count() == 0
    _no_problems(page)
    ctx.close()


def test_reponses_tapees(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    _open(page, "rock")
    _set(page, "answerMode", "typing")
    assert "fautes de frappe" in page.inner_text("#sheet-body")
    page.click("#play")
    page.click("#go")
    page.wait_for_selector("#guess")
    assert page.evaluate("document.activeElement.id") == "guess", "le clavier s'ouvre tout seul"
    # bonne réponse tapée en minuscules, sans accents, avec une faute
    good = _correct(page)
    typed = page.evaluate("(s) => import('/js/util.js').then(m => m.fold(s))", good)
    if len(typed) > 9:
        typed = typed[:4] + typed[5:]  # une lettre oubliée
    page.fill("#guess", typed)
    page.screenshot(path=str(SHOTS / "08-reponse-tapee.png"))
    page.press("#guess", "Enter")
    page.wait_for_selector(".verdict.ok")
    page.click("#next")
    page.fill("#guess", "n'importe quoi")
    page.press("#guess", "Enter")
    page.wait_for_selector(".verdict.ko")
    assert "« n'importe quoi »" in page.inner_text(".verdict")
    page.click("#next")
    page.click("#pass")
    page.wait_for_selector(".verdict.ko")
    assert "Passé" in page.inner_text(".verdict")
    _no_problems(page)
    ctx.close()


def test_entre_amis_chacun_son_tour(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    page.click("[data-audience=friends]")
    _open(page, "80s")
    page.fill(".player-name[data-i='0']", "Léa")
    page.fill(".player-name[data-i='1']", "Tom")
    _set(page, "perPlayer", 3)
    page.screenshot(path=str(SHOTS / "09-reglages-amis.png"))
    page.click("#play")
    names = []
    for i in range(6):
        page.wait_for_selector("#go")
        h2 = page.inner_text(".intro-card h2")
        names.append(h2.replace("Au tour de", "").strip())
        if i == 0:
            page.screenshot(path=str(SHOTS / "10-au-tour-de.png"))
        page.click("#go")
        page.wait_for_selector(".choice")
        if names[-1] == "Léa":
            page.locator(".choice", has_text=_correct(page)).first.click()
        else:
            good = _correct(page)
            page.locator(".choice").filter(has_not_text=good).first.click()
        page.wait_for_selector(".verdict")
        page.click("#next")
    assert names == ["Léa", "Tom", "Léa", "Tom", "Léa", "Tom"]
    page.wait_for_selector(".podium")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "11-podium.png"), full_page=True)
    assert "Léa gagne" in page.inner_text(".mood")
    ranks = page.locator(".rank .pname").all_inner_texts()
    assert ranks == ["Léa", "Tom"]
    # les noms sont mémorisés pour la prochaine fois
    page.click("#home")
    _open(page, "80s")
    assert page.input_value(".player-name[data-i='0']") == "Léa"
    _no_problems(page)
    ctx.close()


def test_mode_soiree(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    page.click("[data-audience=friends]")
    _open(page, "disco")
    _set(page, "friendsMode", "party")
    page.click("#add-player")
    page.fill(".player-name[data-i='2']", "Zoé")
    _set(page, "rounds", 10)
    page.click("#play")
    page.wait_for_selector("#go")
    assert page.locator(".intro-card .chip").count() == 3
    page.click("#go")
    for i in range(10):
        page.wait_for_selector("#reveal-btn")
        assert page.locator(".choice").count() == 0
        page.click("#reveal-btn")
        page.wait_for_selector(".winner")
        page.click(".winner[data-w='2']")          # Zoé trouve à chaque fois
        if i % 2 == 0:
            page.click(".winner[data-w='0']")      # Joueur 1 une fois sur deux
        if i == 0:
            page.screenshot(path=str(SHOTS / "12-soiree-qui-a-trouve.png"))
        page.click("#next")
    page.wait_for_selector(".podium")
    assert page.locator(".rank .pname").all_inner_texts() == ["Zoé", "Joueur 1", "Joueur 2"]
    assert page.locator(".rank .pscore").first.inner_text().startswith("10")
    _no_problems(page)
    ctx.close()


def test_temps_ecoule(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    _open(page, "jazz")
    _set(page, "duration", 10)
    page.click("#play")
    page.click("#go")
    page.wait_for_selector(".choice")
    page.wait_for_selector("#disc-wrap.urgent", timeout=9000)
    page.wait_for_selector(".verdict.ko", timeout=9000)
    assert "Temps écoulé" in page.inner_text(".verdict")
    assert page.evaluate("BT.game.players[0].score") == 0
    _no_problems(page)
    ctx.close()


def test_extrait_illisible(browser, base_url):
    ctx, page = _new_page(browser, base_url, audio_ok=False)
    _open(page, "pop")
    page.click("#play")
    page.click("#go")
    page.wait_for_selector(".verdict.warn", timeout=8000)
    assert "indisponible" in page.inner_text(".verdict")
    page.click("#next")
    page.wait_for_selector(".verdict.warn", timeout=8000)
    _no_problems(page)
    ctx.close()


@pytest.mark.parametrize("api,expected", [("busy", "petite pause"), ("down", "connexion Internet")])
def test_erreurs_service(browser, base_url, api, expected):
    ctx, page = _new_page(browser, base_url, api=api)
    _open(page, "pop")
    page.click("#play")
    page.wait_for_selector(".error-card")
    assert expected in page.inner_text(".error-card")
    if api == "down":
        page.screenshot(path=str(SHOTS / "13-erreur.png"))
    page.click("#home")
    page.wait_for_selector(".tile")
    _no_problems(page)
    ctx.close()


def test_quitter_et_annuler(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    _open(page, "pop")
    page.click("#play")
    page.click("#go")
    page.wait_for_selector(".choice")
    page.click("#quit")
    page.wait_for_selector("#confirm-quit")
    page.click("#sheet-root [data-close].ghost")  # « Continuer à jouer »
    page.wait_for_timeout(400)
    assert page.locator(".choice").count() == 4
    page.click("#quit")
    page.click("#confirm-quit")
    page.wait_for_selector(".tile")
    page.wait_for_timeout(300)
    assert not _audio_playing(page), "la musique s'arrête en quittant"
    ctx.close()
    # Annuler pendant un chargement qui traîne
    ctx, page = _new_page(browser, base_url, api="hang")
    _open(page, "rock")
    page.click("#play")
    page.click("#cancel")
    page.wait_for_selector(".tile")
    page.wait_for_timeout(500)
    assert page.locator(".tile").count() > 0 and page.locator("#go").count() == 0
    _no_problems(page)
    ctx.close()


def test_noms_de_joueurs_html_inoffensifs(browser, base_url):
    ctx, page = _new_page(browser, base_url)
    page.click("[data-audience=friends]")
    _open(page, "pop")
    page.fill(".player-name[data-i='0']", "<img src=x onerror=alert(1)>")
    page.click("#play")
    page.wait_for_selector("#go")
    assert page.locator(".intro-card img").count() == 0
    assert "<img" in page.inner_text(".intro-card h2")
    _no_problems(page)
    ctx.close()


def test_pwa_installable(base_url):
    man = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    assert man["display"] == "standalone"
    for icon in man["icons"]:
        assert (ROOT / icon["src"]).exists()
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert 'apple-mobile-web-app-capable' in html and 'apple-touch-icon' in html and "viewport-fit=cover" in html
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    for f in re.findall(r'"([^"]+\.(?:js|css|png|html|webmanifest))"', sw):
        assert (ROOT / f).exists(), f"fichier du cache absent : {f}"
