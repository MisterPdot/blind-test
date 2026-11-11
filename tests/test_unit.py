"""Lance tests/unit.js dans le navigateur et vérifie chaque test."""
import pytest

from conftest import IPHONE

_cache = {}


def _results(browser, base_url):
    if "r" not in _cache:
        ctx = browser.new_context(**IPHONE)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"{base_url}/tests/unit.html")
        page.wait_for_function("window.__results", timeout=30000)
        _cache["r"] = page.evaluate("window.__results")
        _cache["errors"] = errors
        ctx.close()
    return _cache["r"]


def test_unit_suite(browser, base_url):
    res = _results(browser, base_url)
    assert not _cache["errors"], _cache["errors"]
    failed = [f"{r['name']} → {r['error']}" for r in res if not r["ok"]]
    for r in res:
        print(("  ✓ " if r["ok"] else "  ✗ ") + r["name"])
    assert len(res) >= 25
    assert not failed, "\n".join(failed)
