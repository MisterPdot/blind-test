// Récupération des extraits (API publique iTunes Search : extraits officiels de 30 s, gratuits).
import { CATEGORIES } from "./categories.js";
import { fold, shuffle } from "./util.js";

const API = "https://itunes.apple.com/search";
const CACHE_KEY = "bt-cache-v1";
const CACHE_TTL = 3 * 24 * 3600 * 1000; // 3 jours
const CACHE_MAX = 120; // requêtes gardées
const TOP = 7; // on pioche parmi les 7 morceaux les plus populaires de chaque artiste

export class MusicError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ───────────── Nettoyage des titres ─────────────
const NOISE = /feat\.?|ft\.|remaster|version|edit\b|\blive\b|mono|stereo|from |bande originale|soundtrack|\bmix\b|deluxe|bonus|radio|single|explicit|original|b\.o|anniversary|demo|acoustic|\b(19|20)\d\d\b|reprise|extended|with |\bduo\b|orch\.|symphonique|^\s*(de|du|des|d'|tir[ée]|issu)\b/i;

export function cleanTitle(t) {
  if (!t) return "";
  let s = t.replace(/\s*[([]([^)\]]*)[)\]]/g, (m, inner) => (NOISE.test(inner) ? "" : m));
  s = s.replace(/\s+[-–]\s+(.*)$/, (m, g) => (NOISE.test(g) ? "" : m));
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || t.trim();
}

const WORK_NOISE = /\s*[([][^)\]]*[)\]]|\s*[:–-]\s*(music from|original|bande originale|the original|musique|motion picture|soundtrack|b\.o).*$/gi;
export function cleanWork(album) {
  if (!album) return "";
  let s = album.replace(WORK_NOISE, "");
  s = s.replace(/\b(original motion picture soundtrack|original soundtrack|soundtrack|ost|bande originale( du film)?|original score|b\.o\.?)\b/gi, "");
  s = s.replace(/\s{2,}/g, " ").replace(/[\s:–-]+$/, "").trim();
  return s;
}

const JUNK = /karaok|instrumental version|tribute|made famous|in the style|originally performed|cover version|8.?bit|lullaby|berceuse|piano version|workout|kids version|remix|\blive\b|medley|interview|commentary|a cappella|sped up|slowed/i;
// Pistes qui ne sont pas de « vraies » chansons (gardées en classique et musiques de films).
const NOT_A_SONG = /\binstrumental\b|\binterlude\b|^intro\b|\bintro\)|\boutro\b|\bskit\b|\bhistoire\b|\bpr[ée]lude\b|\bprologue\b/i;
const SOUNDTRACK = /soundtrack|motion picture|bande originale|original score|b\.o\.|music from|from the film|du film/i;
const COMPILATION = /best of|essential|greatest|collection|anthology|compil|the very best|hits|classics|plays|presents|story of/i;

// « Bach » doit trouver « Johann Sebastian Bach », pas « Ofenbach ».
function hasWords(text, wanted) {
  return ` ${fold(text)} `.includes(` ${wanted} `);
}

function art(url) {
  return url ? url.replace(/\/\d+x\d+bb\./, "/600x600bb.") : "";
}

function year(d) {
  const y = d ? parseInt(String(d).slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
}

// ───────────── Cache local des réponses ─────────────
function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; }
}
function saveCache(c) {
  try {
    const keys = Object.keys(c);
    if (keys.length > CACHE_MAX) {
      keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - CACHE_MAX).forEach((k) => delete c[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* stockage plein ou bloqué : on s'en passe */ }
}

// Garde seulement les champs utiles (cache plus léger).
function slim(r) {
  return {
    trackId: r.trackId, trackName: r.trackName, artistName: r.artistName, collectionName: r.collectionName,
    previewUrl: r.previewUrl, artworkUrl100: r.artworkUrl100, trackViewUrl: r.trackViewUrl,
    releaseDate: r.releaseDate, kind: r.kind,
  };
}

export async function searchItunes(params, { fetchFn = fetch, timeout = 10000 } = {}) {
  const qs = new URLSearchParams({ media: "music", entity: "song", country: "FR", lang: "fr_fr", ...params });
  const url = `${API}?${qs}`;
  const cache = loadCache();
  const hit = cache[url];
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.r;

  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  let res;
  try {
    res = await fetchFn(url, ctrl ? { signal: ctrl.signal } : undefined);
  } catch (e) {
    throw new MusicError("network", "Pas de connexion Internet ?");
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 403 || res.status === 429) throw new MusicError("busy", "Le service musical est saturé.");
  if (!res.ok) throw new MusicError("http", `Erreur ${res.status}`);
  let data;
  try { data = await res.json(); } catch { throw new MusicError("http", "Réponse illisible"); }
  const results = (data.results || []).filter((r) => r.kind === "song" && r.previewUrl).map(slim);
  cache[url] = { t: Date.now(), r: results };
  saveCache(cache);
  return results;
}

// ───────────── Sources d'une catégorie ─────────────
function sourcesOf(cat) {
  if (cat.mix) {
    const pool = [];
    CATEGORIES.filter((c) => !c.mix && (c.kind || "artist") === "artist").forEach((c) =>
      c.artists.forEach((a) => pool.push({ type: "artist", name: a, cat: c })));
    // un artiste par catégorie au maximum, pour varier
    const seen = new Set();
    return shuffle(pool).filter((s) => {
      if (seen.has(s.cat.id) || seen.has(fold(s.name))) return false;
      seen.add(s.cat.id); seen.add(fold(s.name));
      return true;
    });
  }
  const kind = cat.kind || "artist";
  if (kind === "work") return shuffle(cat.works.map((w) => ({ type: "work", name: w, cat })));
  return shuffle(cat.artists.map((a) => ({ type: kind, name: a, cat })));
}

// Transforme les résultats bruts d'une source en morceaux jouables (les plus populaires d'abord).
export function tracksFromResults(results, source) {
  const cat = source.cat;
  const wanted = fold(source.name);
  const out = [];
  const seenTitles = new Set();
  for (const r of results) {
    if (!r.previewUrl || !r.trackName) continue;
    const blob = `${r.trackName} ${r.collectionName || ""}`;
    if (JUNK.test(blob)) continue;
    if (cat.id !== "classique" && source.type !== "score" && NOT_A_SONG.test(r.trackName)) continue;
    const y = year(r.releaseDate);
    if (cat.minYear && (!y || y < cat.minYear)) continue;
    if (cat.maxYear && (!y || y > cat.maxYear)) continue;

    let work = "";
    if (source.type === "artist") {
      if (!hasWords(r.artistName, wanted)) continue;
    } else if (source.type === "score") {
      if (!hasWords(r.artistName, wanted)) continue;
      if (!SOUNDTRACK.test(r.collectionName || "") || COMPILATION.test(r.collectionName || "")) continue;
      work = cleanWork(r.collectionName);
      if (work.length < 2 || work.length > 45) continue;
    } else if (source.type === "work") {
      if (!fold(r.collectionName).includes(wanted) && !fold(r.trackName).includes(wanted)) continue;
      work = source.name;
    }

    const title = cleanTitle(r.trackName);
    const key = fold(title);
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
    out.push({
      id: r.trackId,
      title,
      artist: source.type === "artist" ? source.name : r.artistName,
      fullArtist: r.artistName,
      album: r.collectionName || "",
      work,
      year: y,
      preview: r.previewUrl,
      art: art(r.artworkUrl100),
      link: r.trackViewUrl || "",
      catId: cat.id,
      source: source.name,
    });
  }
  return out;
}

async function fetchSource(source, opts) {
  const params = source.type === "work"
    ? { term: source.name, limit: "40" }
    : { term: source.name, attribute: "artistTerm", limit: source.type === "score" ? "60" : "30" };
  const results = await searchItunes(params, opts);
  return tracksFromResults(results, source);
}

/**
 * Prépare la liste des morceaux d'une partie.
 * Retourne { tracks, extra } : `tracks` (exactement `count` si possible) et `extra`
 * (morceaux restants, utiles pour fabriquer des mauvaises réponses crédibles).
 */
export async function buildPlaylist(cat, count, opts = {}) {
  const sources = sourcesOf(cat);
  const perSource = Math.max(2, Math.ceil(count / Math.min(sources.length, 8)) + 1);
  const buckets = [];
  let cursor = 0;
  let lastError = null;

  const total = () => buckets.reduce((n, b) => n + Math.min(b.length, perSource), 0);

  // Par vagues, pour ne pas lancer trop de requêtes à la fois.
  while (cursor < sources.length && (buckets.length === 0 || total() < count)) {
    const need = Math.max(4, Math.ceil((count - total()) / perSource) + 2);
    const wave = sources.slice(cursor, cursor + Math.min(need, 10));
    cursor += wave.length;
    const settled = await Promise.allSettled(wave.map((s) => fetchSource(s, opts)));
    for (const s of settled) {
      if (s.status === "fulfilled") {
        if (s.value.length) buckets.push(s.value);
      } else {
        lastError = s.reason;
      }
    }
    if (lastError && lastError.code === "busy" && total() < count && buckets.length === 0) break;
  }

  // Les plus populaires de chaque source (l'API les classe par popularité), mélangés ; quelques-uns par source.
  const chosen = [];
  const extra = [];
  const ids = new Set();
  const titles = new Set();
  for (const b of buckets) {
    const top = shuffle(b.slice(0, TOP));
    let taken = 0;
    for (const t of top) {
      const tk = fold(t.title) + "|" + fold(t.artist);
      if (ids.has(t.id) || titles.has(tk)) continue;
      ids.add(t.id); titles.add(tk);
      if (taken < perSource) { chosen.push(t); taken++; } else extra.push(t);
    }
    b.slice(TOP).forEach((t) => { if (!ids.has(t.id)) extra.push(t); });
  }
  // Répartition équilibrée entre artistes, puis ordre aléatoire.
  const interleaved = shuffle(chosen);
  if (interleaved.length < count) {
    // Pas assez : on complète avec les morceaux en réserve.
    const more = shuffle(extra).splice(0, count - interleaved.length);
    more.forEach((t) => { interleaved.push(t); extra.splice(extra.indexOf(t), 1); });
  }
  const tracks = interleaved.slice(0, count);
  const rest = interleaved.slice(count).concat(extra);

  if (tracks.length < Math.min(count, 3)) {
    if (lastError) throw lastError;
    throw new MusicError("empty", "Aucun extrait trouvé pour ce thème.");
  }
  return { tracks: shuffle(tracks), extra: rest };
}
