// Tests unitaires de la logique (exécutés dans le navigateur par tests/test_unit.py).
import { fold, shuffle, setRandom, seeded, escapeHtml, levenshtein } from "../js/util.js";
import { cleanTitle, cleanWork, tracksFromResults, buildPlaylist, searchItunes, MusicError } from "../js/music.js";
import { Game, makeChoices, isTypedCorrect, scoreFor, answerOf } from "../js/game.js";
import { CATEGORIES, categoryById } from "../js/categories.js";
import { submitRecord, getRecord } from "../js/storage.js";
import { PICKS } from "../js/picks.js";
import { makeLyricQuestion, cleanLine, attachLyrics, decoysFor } from "../js/lyrics.js";
import { shapeSignal, renderSignal, encodeWav, prepareEffect, RATE } from "../js/effects.js";
import { CHALLENGES, SURPRISE_EFFECTS } from "../js/challenges.js";

const results = [];
function test(name, fn) { results.push({ name, fn }); }
function eq(a, b, msg = "") {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg} attendu ${B}, obtenu ${A}`);
}
function ok(v, msg = "condition fausse") { if (!v) throw new Error(msg); }

const pop = categoryById("pop");
const raw = (o) => ({
  kind: "song", trackId: Math.floor(Math.random() * 1e9), previewUrl: "https://x/p.m4a", artworkUrl100: "https://a/100x100bb.jpg",
  trackViewUrl: "https://m", releaseDate: "2015-01-01T00:00:00Z", collectionName: "Album", ...o,
});

// ───── util
test("fold enlève accents, majuscules, ponctuation", () => {
  eq(fold("Édith Piaf"), "edith piaf");
  eq(fold("AC/DC"), "ac dc");
  eq(fold("Guns N' Roses"), "guns n roses");
  eq(fold("Måneskin"), "maneskin");
  eq(fold("Earth, Wind & Fire"), "earth wind and fire");
  eq(fold("Motörhead"), "motorhead");
});
test("shuffle conserve les éléments", () => {
  setRandom(seeded(1));
  const s = shuffle([1, 2, 3, 4, 5]);
  eq([...s].sort(), [1, 2, 3, 4, 5]);
  setRandom(null);
});
test("escapeHtml", () => eq(escapeHtml(`<b a="x">'&`), "&lt;b a=&quot;x&quot;&gt;&#39;&amp;"));
test("levenshtein", () => { eq(levenshtein("chat", "chats"), 1); eq(levenshtein("", "abc"), 3); eq(levenshtein("kitten", "sitting"), 3); });

// ───── nettoyage
test("cleanTitle retire remaster/feat/live mais garde les vraies parenthèses", () => {
  eq(cleanTitle("Bohemian Rhapsody (Remastered 2011)"), "Bohemian Rhapsody");
  eq(cleanTitle("Get Lucky (feat. Pharrell Williams & Nile Rodgers)"), "Get Lucky");
  eq(cleanTitle("Wonderwall - Remastered"), "Wonderwall");
  eq(cleanTitle("(I Can't Get No) Satisfaction"), "(I Can't Get No) Satisfaction");
  eq(cleanTitle("Libérée, délivrée - De \"La Reine des neiges\""), "Libérée, délivrée");
  eq(cleanTitle("Stayin' Alive [From \"Saturday Night Fever\"]"), "Stayin' Alive");
  eq(cleanTitle("Alors on danse - Radio Edit"), "Alors on danse");
  eq(cleanTitle("La Belle et la Bête (Duo) [De \"La Belle et la Bête\"]"), "La Belle et la Bête");
  eq(cleanTitle("Notre dame de Paris (Symphonique, orch. Samuel Pegg)"), "Notre dame de Paris");
});
test("cleanWork tire le nom du film de l'album", () => {
  eq(cleanWork("Interstellar (Original Motion Picture Soundtrack)"), "Interstellar");
  eq(cleanWork("Gladiator: Music from the Motion Picture"), "Gladiator");
  eq(cleanWork("Le fabuleux destin d'Amélie Poulain (Bande originale du film)"), "Le fabuleux destin d'Amélie Poulain");
  eq(cleanWork("Pirates of the Caribbean: The Curse of the Black Pearl (Original Soundtrack)"), "Pirates of the Caribbean: The Curse of the Black Pearl");
});

// ───── filtrage des résultats
test("tracksFromResults : bon artiste, pas de karaoké/live/remix, pas de doublon", () => {
  const src = { type: "artist", name: "Adele", cat: pop };
  const out = tracksFromResults([
    raw({ trackName: "Hello", artistName: "Adele" }),
    raw({ trackName: "Hello (Live at the BBC)", artistName: "Adele" }),
    raw({ trackName: "Hello", artistName: "Adele", collectionName: "Hello - Single" }),
    raw({ trackName: "Someone Like You (Karaoke Version)", artistName: "Karaoke Stars" }),
    raw({ trackName: "Rolling in the Deep (Remix)", artistName: "Adele" }),
    raw({ trackName: "Skyfall", artistName: "Adele" }),
    raw({ trackName: "Easy On Me", artistName: "Tribute Band" }),
    raw({ trackName: "Set Fire", artistName: "Adele", previewUrl: undefined }),
  ], src);
  eq(out.map((t) => t.title), ["Hello", "Skyfall"]);
  eq(out[0].artist, "Adele");
  ok(out[0].art.includes("600x600bb"), "pochette en grand");
});
test("tracksFromResults : filtre d'années (époques récentes)", () => {
  const cat = categoryById("2020s");
  const out = tracksFromResults([
    raw({ trackName: "Levitating", artistName: "Dua Lipa", releaseDate: "2020-03-27T07:00:00Z" }),
    raw({ trackName: "New Rules", artistName: "Dua Lipa", releaseDate: "2017-06-02T07:00:00Z" }),
  ], { type: "artist", name: "Dua Lipa", cat });
  eq(out.map((t) => t.title), ["Levitating"]);
});
test("tracksFromResults : musiques de films (bande originale uniquement, pas de compilation)", () => {
  const cat = categoryById("films");
  const out = tracksFromResults([
    raw({ trackName: "Time", artistName: "Hans Zimmer", collectionName: "Inception (Music from the Motion Picture)" }),
    raw({ trackName: "Cornfield Chase", artistName: "Hans Zimmer", collectionName: "Interstellar (Original Motion Picture Soundtrack)" }),
    raw({ trackName: "Now We Are Free", artistName: "Hans Zimmer", collectionName: "The Essential Hans Zimmer" }),
    raw({ trackName: "Live Concert", artistName: "Hans Zimmer", collectionName: "Live in Prague" }),
  ], { type: "score", name: "Hans Zimmer", cat });
  eq(out.map((t) => t.work), ["Inception", "Interstellar"]);
});
test("tracksFromResults : œuvres (Disney) filtrées sur l'album", () => {
  const cat = categoryById("disney");
  const out = tracksFromResults([
    raw({ trackName: "Libérée, délivrée", artistName: "Anaïs Delva", collectionName: "La Reine des neiges (Bande Originale Française du Film)" }),
    raw({ trackName: "Autre chanson", artistName: "X", collectionName: "Compilation été" }),
  ], { type: "work", name: "La Reine des neiges", cat });
  eq(out.length, 1);
  eq(out[0].work, "La Reine des neiges");
});

test("tracksFromResults : mots entiers (Bach ≠ Ofenbach), pas d'interlude", () => {
  const cl = categoryById("classique");
  const out = tracksFromResults([
    raw({ trackName: "Be Mine", artistName: "Ofenbach" }),
    raw({ trackName: "Air", artistName: "Johann Sebastian Bach" }),
    raw({ trackName: "Prelude No. 1", artistName: "Johann Sebastian Bach & Glenn Gould" }),
  ], { type: "artist", name: "Bach", cat: cl });
  eq(out.map((t) => t.title), ["Air", "Prelude No. 1"], "le classique garde ses préludes");
  const rap = tracksFromResults([
    raw({ trackName: "Interlude", artistName: "IAM" }),
    raw({ trackName: "Xxplosive (Instrumental)", artistName: "IAM" }),
    raw({ trackName: "Intro", artistName: "IAM" }),
    raw({ trackName: "Je danse le mia", artistName: "IAM" }),
  ], { type: "artist", name: "IAM", cat: categoryById("rapfr") });
  eq(rap.map((t) => t.title), ["Je danse le mia"]);
});

// ───── propositions & réponses tapées
test("makeChoices : 4 propositions uniques dont la bonne", () => {
  const pool = ["A", "B", "C", "D", "E", "F"].map((x, i) => ({ title: `Titre ${x}`, artist: pop.artists[i], work: "" }));
  for (let k = 0; k < 30; k++) {
    for (const kind of ["title", "artist"]) {
      const c = makeChoices(pool[0], kind, pool, pop);
      eq(c.length, 4, kind);
      eq(new Set(c.map(fold)).size, 4, "uniques");
      ok(c.includes(answerOf(pool[0], kind)), "contient la bonne réponse");
    }
  }
});
test("makeChoices : complète avec la liste d'artistes même si le pool est petit", () => {
  const pool = [{ title: "Hello", artist: "Adele" }];
  const c = makeChoices(pool[0], "artist", pool, pop);
  eq(c.length, 4);
});
test("makeChoices : œuvres complétées par la liste de secours (films)", () => {
  const films = categoryById("films");
  const t = { title: "Time", artist: "Hans Zimmer", work: "Inception" };
  const c = makeChoices(t, "work", [t], films);
  eq(c.length, 4);
  ok(c.includes("Inception"));
});
test("isTypedCorrect tolère accents, casse, articles, fautes", () => {
  ok(isTypedCorrect("edith piaf", ["Édith Piaf"]));
  ok(isTypedCorrect("beatles", ["The Beatles"]));
  ok(isTypedCorrect("Bohemian rapsody", ["Bohemian Rhapsody"]));
  ok(isTypedCorrect("daft punk", ["Daft Punk & Julian Casablancas"]));
  ok(isTypedCorrect("satisfaction", ["(I Can't Get No) Satisfaction"]));
  ok(isTypedCorrect("reine des neiges", ["La Reine des neiges"]));
  ok(!isTypedCorrect("abba", ["Queen"]));
  ok(!isTypedCorrect("a", ["Adele"]));
  ok(!isTypedCorrect("", ["Adele"]));
  ok(!isTypedCorrect("hey", ["Hello"]));
  ok(!isTypedCorrect("U3", ["U2"]));
});
test("mode difficile : points ×1,5 et records séparés", () => {
  eq(scoreFor({ correct: true, elapsed: 20, limit: 20, streak: 1, level: "hard" }), 150);
  eq(scoreFor({ correct: true, elapsed: 0, limit: 20, streak: 3, level: "hard" }), 375);
  eq(scoreFor({ correct: false, elapsed: 0, limit: 20, streak: 0, level: "hard" }), 0);
  localStorage.removeItem("bt-records-v1");
  ok(submitRecord("pop", 10, 500));
  ok(submitRecord("pop", 10, 300, "hard"), "record difficile indépendant");
  eq(getRecord("pop", 10).score, 500);
  eq(getRecord("pop", 10, "hard").score, 300);
  localStorage.removeItem("bt-records-v1");
  const g = new Game({ cat: categoryById("pop"), level: "hard", tracks: fakeTracks(3) });
  eq(g.level, "hard");
  const r = g.answer(g.current.track.title, 0);
  ok(!r.correct || r.points >= 150);
});
test("scoreFor : base + rapidité + série", () => {
  eq(scoreFor({ correct: false, elapsed: 1, limit: 20, streak: 0 }), 0);
  eq(scoreFor({ correct: true, elapsed: 0, limit: 20, streak: 1 }), 200);
  eq(scoreFor({ correct: true, elapsed: 10, limit: 20, streak: 1 }), 150);
  eq(scoreFor({ correct: true, elapsed: 25, limit: 20, streak: 1 }), 100);
  eq(scoreFor({ correct: true, elapsed: 20, limit: 20, streak: 3 }), 150);
});

// ───── déroulement d'une partie
function fakeTracks(n) {
  return Array.from({ length: n }, (_, i) => ({ id: i, title: `Chanson ${i}`, artist: pop.artists[i % pop.artists.length], fullArtist: pop.artists[i % pop.artists.length], work: "", preview: `p${i}` }));
}
test("Game solo : points, série, fin", () => {
  const g = new Game({ cat: pop, tracks: fakeTracks(4), duration: 20 });
  const good = () => answerOf(g.current.track, g.current.kind);
  eq(g.answer(good(), 0).points, 200); g.next();
  eq(g.answer(good(), 10).points, 150); g.next();
  eq(g.answer(good(), 20).points, 150, "3e d'affilée : bonus 50"); g.next();
  eq(g.answer("Mauvaise", 1).points, 0);
  eq(g.players[0].score, 500);
  eq(g.players[0].bestStreak, 3);
  eq(g.players[0].good, 3);
  ok(g.isLast);
  eq(g.next(), false);
  ok(g.finished);
});
test("Game : répondre deux fois ne compte qu'une fois", () => {
  const g = new Game({ cat: pop, tracks: fakeTracks(2) });
  const a = answerOf(g.current.track, g.current.kind);
  g.answer(a, 0); g.answer(a, 0);
  eq(g.players[0].score, 200);
});
test("Game chacun son tour : joueurs en alternance", () => {
  const g = new Game({ cat: pop, mode: "turns", players: [{ name: "Léa" }, { name: "Tom" }, { name: "Zoé" }], tracks: fakeTracks(6) });
  const names = [];
  do { names.push(g.currentPlayer.name); g.answer(answerOf(g.current.track, g.current.kind), 0); } while (g.next());
  eq(names, ["Léa", "Tom", "Zoé", "Léa", "Tom", "Zoé"]);
  eq(g.players.map((p) => p.score), [400, 400, 400]);
});
test("Game soirée : l'animateur attribue les points", () => {
  const g = new Game({ cat: pop, mode: "party", players: [{ name: "A" }, { name: "B" }], tracks: fakeTracks(3) });
  eq(g.answerMode, "none");
  eq(g.current.choices, null);
  g.award([0, 1]); g.next();
  g.award([1]); g.next();
  g.award([]);
  eq(g.players.map((p) => p.score), [1, 2]);
  eq(g.ranking()[0].name, "B");
});
test("Game : réponse tapée avec faute acceptée", () => {
  const g = new Game({ cat: categoryById("classique"), answerMode: "typing", tracks: [{ id: 1, title: "Symphonie n°5", artist: "Beethoven", fullArtist: "Ludwig van Beethoven", work: "" }] });
  eq(g.current.kind, "artist");
  ok(g.answer("betoven", 2).correct);
});
test("Game : extrait illisible = manche annulée sans casser la série", () => {
  const g = new Game({ cat: pop, tracks: fakeTracks(3) });
  g.answer(answerOf(g.current.track, g.current.kind), 0); g.next();
  g.skip(); g.next();
  eq(g.players[0].streak, 1);
  eq(g.rounds[1].result.skipped, true);
});

// ───── construction de la playlist (API simulée)
function fakeFetch(handler) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const r = handler(u);
    if (r instanceof Error) throw r;
    if (typeof r === "number") return { ok: false, status: r, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ results: r }) };
  };
  fn.calls = calls;
  return fn;
}
const songsFor = (term, n = 12) => Array.from({ length: n }, (_, i) => raw({ trackId: fold(term).length * 1000 + i + Math.floor(Math.random() * 1e6) * 100, trackName: `${term} hit ${i}`, artistName: term }));

test("buildPlaylist : bon nombre, plusieurs artistes, quelques requêtes seulement", async () => {
  localStorage.removeItem("bt-cache-v1");
  const f = fakeFetch((u) => songsFor(u.searchParams.get("term")));
  const { tracks, extra } = await buildPlaylist(pop, 10, { fetchFn: f });
  eq(tracks.length, 10);
  ok(new Set(tracks.map((t) => t.artist)).size >= 3, "variété d'artistes");
  ok(f.calls.length <= 10, `requêtes : ${f.calls.length}`);
  ok(extra.length > 0, "réserve pour les mauvaises réponses");
  ok(f.calls.every((c) => c.includes("country=FR")), "catalogue français");
  ok(f.calls.every((c) => !c.includes("media=")), "pas de media=music (redirection sur iPhone)");
});
test("buildPlaylist : 20 morceaux sans doublon", async () => {
  localStorage.removeItem("bt-cache-v1");
  const f = fakeFetch((u) => songsFor(u.searchParams.get("term")));
  const { tracks } = await buildPlaylist(categoryById("rock"), 20, { fetchFn: f });
  eq(tracks.length, 20);
  eq(new Set(tracks.map((t) => t.id)).size, 20);
});
test("buildPlaylist : Mix surprise pioche dans plusieurs catégories", async () => {
  localStorage.removeItem("bt-cache-v1");
  const f = fakeFetch((u) => songsFor(u.searchParams.get("term")));
  const { tracks } = await buildPlaylist(categoryById("mix"), 10, { fetchFn: f });
  eq(tracks.length, 10);
  ok(new Set(tracks.map((t) => t.catId)).size >= 4, "plusieurs catégories");
});
test("buildPlaylist : sources pauvres → vagues supplémentaires", async () => {
  localStorage.removeItem("bt-cache-v1");
  const f = fakeFetch((u) => songsFor(u.searchParams.get("term"), 1));
  const { tracks } = await buildPlaylist(pop, 10, { fetchFn: f });
  eq(tracks.length, 10);
  ok(f.calls.length >= 10);
});
test("buildPlaylist : erreurs claires (saturé, réseau, vide)", async () => {
  for (const [resp, code] of [[403, "busy"], [new TypeError("Failed to fetch"), "network"], [[], "empty"]]) {
    localStorage.removeItem("bt-cache-v1");
    let err = null;
    try { await buildPlaylist(pop, 10, { fetchFn: fakeFetch(() => resp) }); } catch (e) { err = e; }
    ok(err instanceof MusicError, `erreur MusicError pour ${code}`);
    eq(err.code, code);
  }
});
test("searchItunes : la 2e demande identique vient du cache", async () => {
  localStorage.removeItem("bt-cache-v1");
  const f = fakeFetch(() => [raw({ trackName: "X", artistName: "Y" })]);
  await searchItunes({ term: "Y" }, { fetchFn: f });
  await searchItunes({ term: "Y" }, { fetchFn: f });
  eq(f.calls.length, 1);
});
test("thèmes sélection : une seule requête, infos écrites à la main, pas deux fois la même œuvre", async () => {
  localStorage.removeItem("bt-cache-v1");
  const cat = categoryById("series");
  const f = fakeFetch((u) => u.searchParams.get("id").split(",").map((id) =>
    raw({ trackId: Number(id), trackName: "Nom Apple (Remastered)", artistName: "Artiste Apple" })));
  const { tracks, extra } = await buildPlaylist(cat, 10, { fetchFn: f });
  eq(f.calls.length, 1);
  ok(f.calls[0].startsWith("https://itunes.apple.com/lookup?"), "recherche par identifiants");
  ok(!f.calls[0].includes("media="), "pas de media=");
  eq(tracks.length, 10);
  eq(new Set(tracks.map((t) => fold(t.work))).size, 10);
  const pick = PICKS.series.find((p) => p[0] === tracks[0].id);
  eq([tracks[0].title, tracks[0].artist, tracks[0].work], [pick[1], pick[2], pick[3]]);
  eq(tracks[0].fullArtist, "Artiste Apple");
  ok(extra.length > 0, "réserve pour les mauvaises réponses");
  const g = new Game({ cat, tracks, extra });
  ok(g.rounds.every((r) => r.kind === "work" && r.choices.length === 4 && r.prompt === "De quelle série ?"));
  // 2e partie : la sélection vient du cache
  await buildPlaylist(cat, 10, { fetchFn: f });
  eq(f.calls.length, 1);
});
test("thèmes sélection : extraits retirés par Apple ignorés", async () => {
  localStorage.removeItem("bt-cache-v1");
  const ids = PICKS.eurovision.map((p) => p[0]);
  const f = fakeFetch(() => ids.slice(0, 5).map((id) => raw({ trackId: id, trackName: "x", artistName: "y" })));
  const { tracks } = await buildPlaylist(categoryById("eurovision"), 10, { fetchFn: f });
  eq(tracks.length, 5);
  ok(tracks.every((t) => ids.slice(0, 5).includes(t.id)));
});
test("toutes les sélections sont fournies et sans doublon", () => {
  for (const c of CATEGORIES.filter((c) => c.kind === "pick")) {
    const list = PICKS[c.id];
    ok(list && list.length >= 20, `${c.id} : au moins 20 morceaux (${list && list.length})`);
    eq(new Set(list.map((p) => p[0])).size, list.length, `${c.id} : identifiants uniques`);
    ok(list.every((p) => Number.isInteger(p[0]) && p[1] && p[2]), `${c.id} : titre et artiste`);
    if ((c.ask || []).includes("work")) ok(list.every((p) => p[3]), `${c.id} : œuvre`);
    ok(list.length <= 150, `${c.id} : une seule requête`);
  }
});
test("toutes les catégories sont valides", () => {
  const ids = new Set();
  for (const c of CATEGORIES) {
    ok(!ids.has(c.id), `id unique ${c.id}`); ids.add(c.id);
    ok(c.name && c.emoji && c.colors.length === 2, c.id);
    if (!c.mix && c.kind !== "pick") {
      const list = c.kind === "work" ? c.works : c.artists;
      ok(list && list.length >= 12, `${c.id} : au moins 12 sources (${list && list.length})`);
    }
  }
  ok(CATEGORIES.length >= 20);
});


// ───── défis : paroles
const SONG = `[Couplet 1]
Je marche seul dans la ville endormie
Les lumières dansent au fond de ma nuit
Et je repense à ton joli sourire
[Refrain]
Oh viens danser sous la pluie d'été
Toute la nuit on va chanter
Oh viens danser sous la pluie d'été
Toute la nuit on va chanter (encore)
Je garde en moi ce parfum de liberté
Oh viens danser sous la pluie d'été`;
test("paroles : ligne du refrain, dernier mot plein caché, leurres crédibles", () => {
  setRandom(seeded(3));
  const q = makeLyricQuestion(SONG);
  setRandom(null);
  ok(q, "question fabriquée");
  eq(q.full, "Oh viens danser sous la pluie d'été", "le refrain (ligne la plus répétée)");
  eq(q.answer, "été");
  ok(q.line.includes("____") && !q.line.includes("été"), q.line);
  eq(q.line, "Oh viens danser sous la pluie d'____");
  eq(q.decoys.length, 3);
  ok(q.decoys.every((d) => fold(d) !== "ete" && !d.includes("'")), q.decoys.join());
  eq(cleanLine("  [Refrain] Toute la nuit (encore)  "), "Toute la nuit");
  eq(makeLyricQuestion(""), null);
  eq(makeLyricQuestion("Hey\nHo"), null);
  eq(decoysFor({ answer: "Soleil", decoys: [] }).length, 3);
});
test("paroles : recherche exacte puis élargie, morceaux sans paroles écartés", async () => {
  localStorage.removeItem("bt-lyrics-v1");
  const tracks = [1, 2, 3, 4].map((i) => ({ id: 900 + i, title: `Titre ${i}`, artist: "Groupe", fullArtist: "Groupe" }));
  const f = fakeFetch(() => null);
  const fn = async (url) => {
    f.calls.push(url);
    const u = new URL(url);
    const t = u.searchParams.get("track_name");
    if (u.pathname.endsWith("/get")) {
      if (t === "Titre 1") return { ok: true, status: 200, json: async () => ({ plainLyrics: SONG, instrumental: false }) };
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (t === "Titre 2") return { ok: true, status: 200, json: async () => ([{ artistName: "Groupe", plainLyrics: SONG }]) };
    if (t === "Titre 3") return { ok: true, status: 200, json: async () => ([{ artistName: "Autre", plainLyrics: SONG }]) };
    return { ok: true, status: 200, json: async () => ([]) };
  };
  const ready = await attachLyrics(tracks, 10, { fetchFn: fn });
  eq(ready.map((t) => t.id), [901, 902]);
  ok(ready.every((t) => t.lyric && t.lyric.decoys.length === 3));
  ok(f.calls.every((c) => c.startsWith("https://lrclib.net/api/")), "base LRCLIB");
  const n = f.calls.length;
  await attachLyrics(tracks.map((t) => ({ ...t })), 10, { fetchFn: fn });
  eq(f.calls.length, n, "2e fois : paroles gardées en cache");
  localStorage.removeItem("bt-lyrics-v1");
});
test("paroles : refus LRCLIB (429) → attente puis nouvel essai, jamais gardé comme « sans paroles »", async () => {
  localStorage.removeItem("bt-lyrics-v1");
  const waits = [];
  let n = 0;
  const fn = async () => {
    n++;
    if (n <= 2) return { ok: false, status: 429, headers: { get: () => "1" }, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ plainLyrics: SONG }) };
  };
  const ready = await attachLyrics([{ id: 1, title: "A", artist: "B" }], 1, { fetchFn: fn, wait: async (ms) => waits.push(ms) });
  eq(ready.length, 1);
  eq(waits, [1000, 1000]);
  localStorage.removeItem("bt-lyrics-v1");
  const down = async () => ({ ok: false, status: 429, headers: { get: () => null }, json: async () => ({}) });
  const none = await attachLyrics([{ id: 2, title: "A", artist: "B" }], 1, { fetchFn: down, wait: async () => {} });
  eq(none.length, 0);
  ok(!(JSON.parse(localStorage.getItem("bt-lyrics-v1") || "{}"))[2], "le refus n'est pas mis en cache");
});
test("paroles : pas de ligne répétitive ni de petits mots en leurres", () => {
  const txt = ["Ah les cro cro cro les cro cro cro", "Mais avec toi tout est comme avant", "Je cherche encore la lumière du matin",
    "Je cherche encore la lumière du matin", "Personne ne voit le chemin de traverse", "Nous irons danser sur la montagne",
    "Le soleil brille sur la rivière", "La ville dort sous un ciel orange"].join("\n");
  for (let i = 0; i < 10; i++) {
    const q = makeLyricQuestion(txt);
    eq(q.full, "Je cherche encore la lumière du matin");
    eq(q.answer, "matin");
    ok(q.decoys.every((d) => !["mais", "avec", "tout", "comme", "cro"].includes(fold(d))), q.decoys.join());
  }
});
test("défi Paroles : questions « Complétez les paroles », propositions avec la bonne réponse", () => {
  const tracks = fakeTracks(3).map((t) => ({ ...t, lyric: { answer: "été", decoys: ["nuit", "ville", "sourire"], line: "x ____" } }));
  const g = new Game({ cat: pop, tracks, challenge: "lyrics" });
  ok(g.rounds.every((r) => r.kind === "lyrics" && r.prompt === "Complétez les paroles" && r.choices.includes("été") && r.choices.length === 4));
  ok(g.answer("été", 0).correct, "bonne proposition");
  const g2 = new Game({ cat: pop, tracks, challenge: "lyrics", answerMode: "typing" });
  ok(g2.answer("ete", 1).correct, "réponse tapée : accent oublié toléré");
  eq(g2.recordId, "lyrics-pop");
  eq(new Game({ cat: pop, tracks: fakeTracks(2) }).recordId, "pop");
});
test("défis surprise dans une partie normale : nombre fixe, paroles prêtes utilisées, records à part", () => {
  setRandom(seeded(4));
  const tracks = fakeTracks(10);
  tracks[2].lyric = { answer: "été", decoys: ["nuit", "ville", "sourire"], line: "x ____" };
  tracks[5].lyric = { answer: "soir", decoys: ["nuit", "ville", "matin"], line: "y ____" };
  const g = new Game({ cat: pop, tracks, mix: "some", lyricTracks: [tracks[2], tracks[5]] });
  const l = new Game({ cat: pop, tracks: fakeTracks(10), mix: "lots" });
  const off = new Game({ cat: pop, tracks, mix: "off", lyricTracks: [tracks[2]] });
  const ch = new Game({ cat: pop, tracks: fakeTracks(10), challenge: "helium", mix: "lots" });
  setRandom(null);
  eq(g.rounds.filter((r) => r.mixed).length, 3);
  eq(g.rounds.filter((r) => r.kind === "lyrics").length, 1, "au plus un tiers des défis en paroles");
  ok(g.rounds.filter((r) => r.kind === "lyrics").every((r) => r.mixed && [2, 5].includes(g.rounds.indexOf(r)) && r.choices.length === 4));
  ok(g.rounds.every((r) => r.mixed === (r.kind === "lyrics" || SURPRISE_EFFECTS.includes(r.effect))));
  ok(g.rounds.filter((r) => !r.mixed).every((r) => !r.effect && r.kind !== "lyrics"));
  eq(l.rounds.filter((r) => r.mixed && r.effect).length, 6, "sans paroles : que des effets");
  ok(off.rounds.every((r) => !r.mixed && !r.effect && r.kind !== "lyrics"), "désactivé : partie normale");
  ok(ch.rounds.every((r) => r.effect === "helium" && !r.mixed), "un défi choisi ignore le mix");
  eq(g.recordId, "pop+some");
  eq(l.recordId, "pop+lots");
  eq(off.recordId, "pop");
  eq(ch.recordId, "helium-pop");
  eq(new Game({ cat: pop, tracks: fakeTracks(2), mix: "some" }).rounds.filter((r) => r.mixed).length, 1, "au moins un défi");
});
test("défi surprise : un effet par manche, jamais deux fois le même d'affilée", () => {
  setRandom(seeded(9));
  const g = new Game({ cat: pop, tracks: fakeTracks(20), challenge: "surprise" });
  setRandom(null);
  ok(g.rounds.every((r) => SURPRISE_EFFECTS.includes(r.effect)));
  ok(g.rounds.every((r, i) => i === 0 || r.effect !== g.rounds[i - 1].effect));
  ok(new Set(g.rounds.map((r) => r.effect)).size >= 4, "variété");
  const h = new Game({ cat: pop, tracks: fakeTracks(3), challenge: "helium" });
  ok(h.rounds.every((r) => r.effect === "helium" && r.kind !== "lyrics"));
  eq(CHALLENGES.length, 9);
});

// ───── défis : effets sonores
function fakeBuffer(L, R, sampleRate = 8000) {
  return { sampleRate, length: L.length, numberOfChannels: R ? 2 : 1, getChannelData: (c) => (c === 0 ? L : R) };
}
test("effets : karaoké (gauche − droite), repli si enregistrement mono, envers, puzzle", () => {
  const n = 8000 * 10;
  const voice = Float32Array.from({ length: n }, (_, i) => Math.sin(i / 5));
  const guitar = Float32Array.from({ length: n }, (_, i) => Math.sin(i / 13));
  const L = voice.map((v, i) => v + guitar[i]);
  const R = voice.map((v, i) => v - guitar[i]);
  const k = shapeSignal(fakeBuffer(L, R), "karaoke");
  eq(k.effect, "karaoke");
  ok(Math.abs(k.data[1234] - 0.9 * 2 * guitar[1234]) < 1e-5, "la voix (au centre) disparaît");
  eq(shapeSignal(fakeBuffer(L, L), "karaoke").effect, "underwater", "mono : on passe sous l'eau");
  const ramp = Float32Array.from({ length: n }, (_, i) => i / n);
  const rev = shapeSignal(fakeBuffer(ramp), "reverse").data;
  ok(rev[0] > 0.99 && rev[n - 1] < 0.01, "à l'envers");
  setRandom(seeded(4));
  const pz = shapeSignal(fakeBuffer(ramp), "puzzle", Math.random).data;
  setRandom(null);
  eq(pz.length, n);
  const firsts = [0, 1, 2, 3, 4].map((c) => Math.round(pz[c * 16000 + 8000] * 10));
  ok(firsts.some((v, i) => v !== 2 * i + 1), `morceaux mélangés : ${firsts}`);
});
test("effets : hélium plus court, ralenti plus long, WAV valide", async () => {
  const n = 8000 * 4;
  const data = Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin(i / 3));
  const h = await renderSignal(data, 8000, "helium");
  const sl = await renderSignal(data, 8000, "slow");
  const no = await renderSignal(data, 8000, "underwater");
  ok(Math.abs(h.duration - 4 / 1.45) < 0.05, `hélium ${h.duration}`);
  ok(Math.abs(sl.duration - 4 / 0.7) < 0.05, `ralenti ${sl.duration}`);
  ok(Math.abs(no.duration - 4) < 0.05);
  eq(h.sampleRate, RATE);
  const wav = new DataView(encodeWav(h.getChannelData(0), RATE));
  eq(String.fromCharCode(wav.getUint8(0), wav.getUint8(1), wav.getUint8(2), wav.getUint8(3)), "RIFF");
  eq(wav.getUint32(24, true), RATE);
  eq(wav.byteLength, 44 + h.length * 2);
});
test("effets : de l'extrait au fichier jouable (téléchargement, décodage, rendu)", async () => {
  const sr = 16000;
  const src = Float32Array.from({ length: sr * 3 }, (_, i) => 0.4 * Math.sin(i / 4));
  const wav = encodeWav(src, sr);
  const calls = [];
  const fetchFn = async (u) => { calls.push(u); return { ok: true, status: 200, arrayBuffer: async () => wav.slice(0) }; };
  const a = await prepareEffect("https://x.test/a.wav", "slow", { fetchFn });
  ok(a.url.startsWith("blob:"), a.url);
  ok(Math.abs(a.duration - 3 / 0.7) < 0.1, `durée ${a.duration}`);
  await prepareEffect("https://x.test/a.wav", "slow", { fetchFn });
  eq(calls.length, 1, "même extrait + même effet : préparé une seule fois");
  const k = await prepareEffect("https://x.test/a.wav", "karaoke", { fetchFn });
  eq(k.effect, "underwater", "extrait mono : karaoké impossible, repli");
  let err = null;
  try { await prepareEffect("https://x.test/b.wav", "helium", { fetchFn: async () => ({ ok: false, status: 404 }) }); } catch (x) { err = x; }
  ok(err, "extrait introuvable : erreur (le jeu rejoue l'original)");
});

// ───── records
test("records : seul un meilleur score remplace l'ancien", () => {
  localStorage.removeItem("bt-records-v1");
  ok(submitRecord("pop", 10, 800));
  ok(!submitRecord("pop", 10, 700));
  ok(submitRecord("pop", 10, 900));
  eq(getRecord("pop", 10).score, 900);
  eq(getRecord("pop", 15), null);
  ok(!submitRecord("pop", 10, 0));
  localStorage.removeItem("bt-records-v1");
});

// ───── exécution
(async () => {
  const out = [];
  for (const t of results) {
    try { await t.fn(); out.push({ name: t.name, ok: true }); }
    catch (e) { out.push({ name: t.name, ok: false, error: String(e && e.message || e) }); }
  }
  window.__results = out;
})();
