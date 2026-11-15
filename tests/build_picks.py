# Génère js/picks.js à partir de tests/curated.json (résultat de tests/curate.py), après relecture.
# EXCLUDE : morceaux à écarter (mauvaise version trouvée, introuvable…), par (catégorie, titre).
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE = {
    # Séries : reprise / mauvaise version
    ("series", "How Soon Is Now"), ("series", "Dallas"), ("series", "Kaamelott"),
    # Dessins animés : reprises (métal, lofi, rap…) ou autre chanson
    ("cartoons", "Capitaine Flam"), ("cartoons", "Attrapez-les tous"), ("cartoons", "Il était une fois la vie"),
    ("cartoons", "Scooby-Doo, Where Are You"), ("cartoons", "Bob l'éponge"), ("cartoons", "Totally Spies"),
    ("cartoons", "Barbapapa"), ("cartoons", "Maya l'abeille"), ("cartoons", "Heidi"), ("cartoons", "Olive et Tom"),
    ("cartoons", "Jeanne et Serge"), ("cartoons", "Les Razmoket"), ("cartoons", "Spider-Man"),
    ("cartoons", "Les Tortues Ninja"), ("cartoons", "Princesse Sarah"), ("cartoons", "Tom Sawyer"),
    ("cartoons", "Les Snorky"), ("cartoons", "Les Bisounours"), ("cartoons", "Rémi sans famille"),
    # 80's français : remix récent, version acoustique ou réenregistrée, morceau hors des années 80
    ("80sfr", "Toute première fois"), ("80sfr", "Marcia Baila"), ("80sfr", "Besoin de rien, envie de toi"),
    ("80sfr", "Pour que tu m'aimes encore"), ("80sfr", "Désenchantée"), ("80sfr", "Le chanteur"),
    ("80sfr", "Quelque chose de Tennessee"), ("80sfr", "Africa"),
    # Génériques supplémentaires : reprises ou autre chanson
    ("cartoons", "Ken le survivant"), ("cartoons", "Signé Cat's Eyes"), ("cartoons", "Denver le dernier dinosaure"),
    ("cartoons", "Albator 84"), ("cartoons", "Mask"), ("cartoons", "Tchou-Tchou"), ("cartoons", "Bouba le petit ourson"),
    ("cartoons", "Lucky Luke"), ("cartoons", "Sous le signe des mousquetaires"), ("cartoons", "Max et compagnie"),
    ("cartoons", "Creamy merveilleuse Creamy"), ("cartoons", "Les aventures de Tintin"), ("cartoons", "Pokémon"),
    # 80's international : version piano, remix
    ("80sint", "Never Gonna Give You Up"), ("80sint", "Another One Bites the Dust"),
    # Eurovision : autre version que celle du concours
    ("eurovision", "Arcade"), ("eurovision", "Everyway That I Can"), ("eurovision", "1944"),
    ("eurovision", "Dschinghis Khan"),
    # Suisse : mauvais artiste, autre chanson, nouvelle version
    ("suisse", "Avenue"), ("suisse", "Fallin'"), ("suisse", "Signal"),
}
# Réponse corrigée : (catégorie, titre) -> champs remplacés
OVERRIDE = {
    ("moviesongs", "Eye of the Tiger"): {"work": "Rocky"},
}
# Listes complémentaires fusionnées dans une catégorie
MERGE = {"cartoons_extra": "cartoons"}
# Catégories où l'artiste saisi dans curate.py n'est qu'un mot-clé de recherche : on affiche l'interprète d'Apple.
APPLE_ARTIST = {"cartoons"}

data = json.loads((ROOT / "tests" / "curated.json").read_text(encoding="utf-8"))
lines = ["// Morceaux choisis à la main pour les thèmes « sélection » : [identifiant Apple, titre, artiste, œuvre].",
         "// Fichier généré par tests/build_picks.py (ne pas modifier à la main).", "export const PICKS = {"]
merged = {}
for cat, rows in data.items():
    merged.setdefault(MERGE.get(cat, cat), []).extend(rows)
for cat, rows in merged.items():
    seen, items = set(), []
    for r in rows:
        if "id" not in r or (cat, r["title"]) in EXCLUDE or r["id"] in seen:
            continue
        seen.add(r["id"])
        r = {**r, **({"artist": r["an"]} if cat in APPLE_ARTIST else {}), **OVERRIDE.get((cat, r["title"]), {})}
        items.append(json.dumps([r["id"], r["title"], r["artist"], r["work"]], ensure_ascii=False))
    lines.append(f"  {json.dumps(cat)}: [")
    lines += [f"    {it}," for it in items]
    lines.append("  ],")
    print(cat, len(items))
lines.append("};")
(ROOT / "js" / "picks.js").write_text("\n".join(lines) + "\n", encoding="utf-8")
