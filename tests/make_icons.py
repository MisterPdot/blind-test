"""Génère les icônes PNG à partir de icons/icon.svg (via le navigateur Edge)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
svg = (ROOT / "icons" / "icon.svg").read_text(encoding="utf-8")
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
        pg = b.new_page(viewport={"width": size, "height": size})
        pg.set_content(f'<html><body style="margin:0">{svg.replace("<svg ", f"<svg width={size} height={size} ", 1)}</body></html>')
        pg.screenshot(path=str(ROOT / "icons" / name))
        pg.close()
    b.close()
print("icônes OK")
