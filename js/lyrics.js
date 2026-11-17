// Défi « Paroles manquantes » : paroles de la base libre LRCLIB (lrclib.net), une ligne avec un mot à trouver.
import { fold, shuffle, random } from "./util.js";

const API = "https://lrclib.net/api";
const CACHE_KEY = "bt-lyrics-v1";
const CACHE_MAX = 200;

// Petits mots qu'on ne fait ni deviner ni proposer (trop vagues). Écrits sans accents (comparés après fold).
const STOP = new Set(("le la les l un une des de du d et ou a au aux en dans sur sous par pour pas ne n plus que qu qui quoi " +
  "je j tu il elle on nous vous ils elles me m te t se s moi toi lui leur leurs mon ma mes ton ta tes son sa ses notre nos votre vos " +
  "ce c ces cet cette ca y est suis es sont ai as ont avoir etre oh ah eh hey yeah ouh na da " +
  "mais dont avec comme trop tout tous toute toutes rien bien tres sans quand alors aussi cela ceci celui celle " +
  "etait avait fait faire dire peut veux vais va vas ait allait sera serai etais avais quel quelle quels " +
  "the a an and or of to in on at by for with from is are was were be been am i you he she it we they me my your his her its our " +
  "their them us this that these those do does did not no yes so but if as up ooh baby gonna wanna got get " +
  "all own would could should will well now can just like what when where there here how one too out don won ain let " +
  "say said know go come every some any more than then back down off over into only gotta cause lyrics nan wow hmm he hein ouais").split(" "));

function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; } }
function saveCache(c) {
  try {
    const keys = Object.keys(c);
    if (keys.length > CACHE_MAX) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - CACHE_MAX).forEach((k) => delete c[k]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* stockage plein : tant pis */ }
}

/** Nettoie une ligne de paroles : repères [Refrain], (chœurs), espaces. */
export function cleanLine(l) {
  return String(l || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const WORD = /[\p{L}\p{N}'’-]+/gu;
const ELISION = /^(qu|[ldjmtsnc])['’](?=\p{L})/iu;
function words(line) { return line.match(WORD) || []; }
/** Découpe « d'été, » en { pre: "d'", core: "été" } : on fait deviner le mot sans l'élision. */
function parts(w) {
  const lead = w.match(/^['’-]*/)[0];
  let rest = w.slice(lead.length);
  const tail = rest.match(/['’-]*$/)[0];
  rest = rest.slice(0, rest.length - tail.length);
  const el = rest.match(ELISION);
  const pre = lead + (el ? el[0] : "");
  return { pre, core: el ? rest.slice(el[0].length) : rest, post: tail };
}
function bare(w) { return parts(w).core; }
function isGood(w, min = 3) {
  const b = bare(w);
  const f = fold(b);
  // un mot simple : pas « aujourd'hui », pas « tel-ho »
  return b.length >= min && !/['’-]/.test(b) && !STOP.has(f) && !/^\d+$/.test(f);
}

/**
 * Fabrique la question à partir des paroles. Retourne null si les paroles ne s'y prêtent pas.
 * { before, line (avec ____), answer, full, decoys }
 */
export function makeLyricQuestion(plain, rnd = random) {
  if (!plain) return null;
  const lines = plain.split(/\r?\n/).map(cleanLine).filter(Boolean);
  if (lines.length < 6) return null;
  const counts = new Map();
  lines.forEach((l) => counts.set(fold(l), (counts.get(fold(l)) || 0) + 1));
  const cands = [];
  lines.forEach((l, i) => {
    const ws = words(l);
    if (ws.length < 4 || ws.length > 13 || l.length < 16 || l.length > 80) return;
    // lignes qui répètent les mêmes mots (« cro, cro, cro ») : réponse trop évidente
    const folded = ws.map((w) => fold(bare(w)));
    if (new Set(folded).size < folded.length * 0.7) return;
    // mot caché : le dernier mot « plein » de la ligne (comme la rime), sinon le plus long
    let target = null;
    for (let k = ws.length - 1; k >= Math.max(0, ws.length - 3); k--) if (isGood(ws[k], k === ws.length - 1 ? 3 : 4)) { target = k; break; }
    if (target == null) {
      const good = ws.map((w, k) => [w, k]).filter(([w]) => isGood(w, 4)).sort((a, b) => bare(b[0]).length - bare(a[0]).length);
      if (!good.length) return;
      target = good[0][1];
    }
    if (folded.filter((f) => f === folded[target]).length > 1) return;
    cands.push({ i, line: l, target, score: (counts.get(fold(l)) || 1) });
  });
  if (!cands.length) return null;
  // Priorité aux lignes répétées (refrain), avec un peu de hasard.
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0].score;
  const pool = cands.filter((c) => c.score === best);
  const c = pool[Math.floor(rnd() * pool.length)];
  const ws = words(c.line);
  const answer = bare(ws[c.target]);
  // Remplace la n-ième occurrence de mot par le trou
  let idx = -1;
  const holed = c.line.replace(WORD, (m) => {
    idx++;
    if (idx !== c.target) return m;
    const pp = parts(m);
    return `${pp.pre}____${pp.post}`;
  });
  const prev = c.i > 0 ? lines[c.i - 1] : "";
  const key = fold(answer);
  const vocab = new Map();
  for (const l of lines) for (const w of words(l)) {
    const b = bare(w);
    const f = fold(b);
    if (isGood(w, Math.min(4, answer.length)) && f !== key && !vocab.has(f) && Math.abs(b.length - answer.length) <= 3) vocab.set(f, b);
  }
  const decoys = shuffle([...vocab.values()]).slice(0, 3).map((w) => matchCase(w, answer));
  return { before: prev && fold(prev) !== fold(c.line) ? prev : "", line: holed, answer, full: c.line, decoys };
}

function matchCase(w, model) {
  if (model[0] === model[0].toUpperCase() && model[0] !== model[0].toLowerCase()) return w[0].toUpperCase() + w.slice(1);
  return w[0].toLowerCase() + w.slice(1);
}

const FILLERS = ["amour", "toujours", "soleil", "cœur", "nuit", "jamais", "monde", "temps", "vie", "rêve", "love", "night", "heart",
  "time", "dance", "world", "feel", "tonight"];

/** Complète les leurres s'il en manque (paroles courtes). */
export function decoysFor(q) {
  const out = [...q.decoys];
  const key = fold(q.answer);
  for (const f of shuffle(FILLERS)) {
    if (out.length >= 3) break;
    if (fold(f) !== key && !out.some((d) => fold(d) === fold(f))) out.push(matchCase(f, q.answer));
  }
  return out.slice(0, 3);
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// LRCLIB refuse les rafales (429) : on attend le délai demandé, puis on réessaie.
async function getJson(url, fetchFn, timeout, wait = sleep) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
    let res;
    try {
      res = await fetchFn(url, ctrl ? { signal: ctrl.signal } : undefined);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (res.status === 404) return null;
    if (res.status === 429 && attempt < 3) {
      const ra = Number(res.headers && res.headers.get ? res.headers.get("retry-after") : NaN);
      await wait(Math.min(8000, (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500 * (attempt + 1))));
      continue;
    }
    if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
    return res.json();
  }
}

/** Paroles brutes d'un morceau (ou null). */
export async function fetchLyrics(track, { fetchFn = fetch, timeout = 8000, wait } = {}) {
  const cache = loadCache();
  const hit = cache[track.id];
  if (hit) return hit.p;
  const artist = track.fullArtist || track.artist;
  const qs = new URLSearchParams({ artist_name: artist, track_name: track.title });
  let plain = null;
  // Une erreur (réseau, refus répétés) n'est PAS gardée en cache : on retentera à la prochaine partie.
  const got = await getJson(`${API}/get?${qs}`, fetchFn, timeout, wait);
  if (got && !got.instrumental && got.plainLyrics) plain = got.plainLyrics;
  if (!plain) {
    const list = await getJson(`${API}/search?${qs}`, fetchFn, timeout, wait);
    const want = fold(track.artist).split(" ")[0];
    const m = (list || []).find((r) => r.plainLyrics && !r.instrumental && fold(r.artistName).includes(want));
    if (m) plain = m.plainLyrics;
  }
  const fresh = loadCache(); // relu : d'autres recherches ont pu écrire entre-temps
  fresh[track.id] = { t: Date.now(), p: plain };
  saveCache(fresh);
  return plain;
}

/**
 * Ajoute une question de paroles à chaque morceau qui en a (track.lyric). Retourne les morceaux retenus, dans l'ordre.
 * onProgress(n) : nombre de morceaux prêts.
 */
export async function attachLyrics(tracks, count, { fetchFn = fetch, onProgress, isCancelled, wait } = {}) {
  const ready = [];
  for (let i = 0; i < tracks.length && ready.length < count; i += 3) {
    if (isCancelled && isCancelled()) return ready;
    const batch = tracks.slice(i, i + 3); // 3 à la fois : LRCLIB n'aime pas les rafales
    const plains = await Promise.all(batch.map((t) => fetchLyrics(t, { fetchFn, wait }).catch(() => null)));
    batch.forEach((t, k) => {
      const q = makeLyricQuestion(plains[k]);
      if (q && ready.length < count) { t.lyric = { ...q, decoys: decoysFor(q) }; ready.push(t); }
    });
    if (onProgress) onProgress(ready.length);
  }
  return ready;
}
