// Règles du jeu : choix de la question, propositions, correction, points. Aucune dépendance au DOM.
import { fold, shuffle, levenshtein, random } from "./util.js";
import { promptFor } from "./categories.js";
import { challengeById, SURPRISE_EFFECTS, mixRate } from "./challenges.js";

/** Mode difficile : l'extrait s'arrête après ce nombre de secondes, et les points sont multipliés. */
export const HARD_CLIP = 5;
export const HARD_BONUS = 1.5;

export const PLAYER_COLORS = ["#ff4f8b", "#4fc3ff", "#ffd23f", "#7cff6b", "#b388ff", "#ff9f43"];

export function answerOf(track, kind) {
  if (kind === "title") return track.title;
  if (kind === "artist") return track.artist;
  if (kind === "work") return track.work;
  if (kind === "lyrics") return track.lyric ? track.lyric.answer : "";
  return "";
}

// Question posée pour ce morceau (titre, artiste ou œuvre selon la catégorie).
export function chooseKind(cat, track) {
  const kinds = (cat.ask || ["title", "artist"]).filter((k) => answerOf(track, k));
  if (!kinds.length) return "title";
  return kinds[Math.floor(random() * kinds.length)];
}

/** Quatre propositions (la bonne + trois crédibles), dans un ordre aléatoire. */
export function makeChoices(track, kind, pool, cat) {
  const correct = answerOf(track, kind);
  if (kind === "lyrics") return shuffle([correct, ...track.lyric.decoys.slice(0, 3)]);
  const key = fold(correct);
  const cands = new Map();
  const add = (v) => {
    const k = fold(v);
    if (v && k && k !== key && !cands.has(k) && !k.includes(key) && !key.includes(k)) cands.set(k, v);
  };
  // Priorité aux réponses du même univers (même catégorie), puis aux listes de la catégorie.
  shuffle(pool).forEach((t) => add(answerOf(t, kind)));
  if (kind === "artist" && cat.artists) shuffle(cat.artists).forEach(add);
  if (kind === "work") shuffle([...(cat.works || []), ...(cat.fallbackWorks || [])]).forEach(add);
  const wrong = [...cands.values()].slice(0, 3);
  return shuffle([correct, ...wrong]);
}

const ARTICLES = /^(the|le|la|les|l|un|une|a|an)\s+/;
function core(s) {
  return fold(s).replace(ARTICLES, "").trim();
}
function withoutParens(s) {
  return String(s || "").replace(/\s*[([][^)\]]*[)\]]/g, "").trim();
}

/** Réponse tapée : accents, majuscules, articles et petites fautes de frappe sont tolérés. */
export function isTypedCorrect(input, answers) {
  const b = core(input);
  if (b.length < 2) return false;
  for (const ans of [].concat(answers).filter(Boolean)) {
    for (const variant of [ans, withoutParens(ans)]) {
      const a = core(variant);
      if (!a) continue;
      if (a === b) return true;
      // « daft punk » pour « daft punk and julian casablancas » : début suffisant s'il est assez long
      if (a.startsWith(b) && b.length >= Math.min(a.length, 6) && b.length >= 3) return true;
      const dist = levenshtein(a, b);
      const tol = a.length <= 4 ? 0 : a.length <= 8 ? 1 : a.length <= 14 ? 2 : 3;
      if (dist <= tol) return true;
    }
  }
  return false;
}

export function acceptedAnswers(track, kind) {
  if (kind === "artist") return [track.artist, track.fullArtist];
  if (kind === "title") return [track.title];
  if (kind === "lyrics") return [track.lyric.answer];
  return [track.work];
}

/** Points : 100 pour une bonne réponse + jusqu'à 100 de bonus de rapidité + 50 dès 3 bonnes réponses de suite ;
 *  ×1,5 en mode difficile. */
export function scoreFor({ correct, elapsed, limit, streak, level = "normal" }) {
  if (!correct) return 0;
  const speed = Math.max(0, Math.min(1, 1 - elapsed / limit));
  const pts = 100 + Math.round(100 * speed) + (streak >= 3 ? 50 : 0);
  return level === "hard" ? Math.round(pts * HARD_BONUS) : pts;
}

/** Identifiant des records : catégorie seule, défi + catégorie, ou catégorie + niveau de défis surprise. */
export function recordIdFor(cat, challenge = null, mix = "off") {
  if (challenge) return `${challenge.id}-${cat.id}`;
  return mixRate(mix) ? `${cat.id}+${mix}` : cat.id;
}

export class Game {
  /**
   * mode : "solo" | "turns" (chacun son tour, on se passe le téléphone) | "party" (un animateur attribue les points)
   * answerMode : "choices" | "typing"
   */
  /**
   * mix : défis surprise glissés au hasard dans une partie normale ("off" | "some" | "lots").
   * lyricTracks : morceaux dont la question de paroles est prête (track.lyric), utilisables par le mix.
   */
  constructor({ cat, mode = "solo", players = [{ name: "Moi" }], duration = 20, answerMode = "choices", level = "normal", challenge = null,
    mix = "off", lyricTracks = [], tracks, extra = [] }) {
    this.cat = cat;
    this.challenge = challengeById(challenge);
    this.mix = this.challenge || !mixRate(mix) ? "off" : mix;
    this.level = level === "hard" ? "hard" : "normal";
    this.mode = mode;
    this.duration = duration;
    this.answerMode = mode === "party" ? "none" : answerMode;
    this.players = players.map((p, i) => ({
      name: p.name, color: p.color || PLAYER_COLORS[i % PLAYER_COLORS.length], score: 0, streak: 0, bestStreak: 0, good: 0,
    }));
    const pool = tracks.concat(extra);
    const ch = this.challenge;
    let lastFx = null;
    const pickFx = () => {
      const opts = SURPRISE_EFFECTS.filter((x) => x !== lastFx);
      return opts[Math.floor(random() * opts.length)];
    };
    // Mix : une part fixe des manches (au moins une) reçoit un défi, à des places tirées au hasard.
    // Les questions de paroles prêtes en font partie (au plus un tiers des défis), le reste en effets sonores.
    const mixed = new Map(); // index de manche -> "lyrics" | "fx"
    const rate = mixRate(this.mix);
    if (rate && tracks.length) {
      const want = Math.max(1, Math.round(rate * tracks.length));
      const lyricIdx = shuffle(tracks.map((t, i) => i).filter((i) => tracks[i].lyric && lyricTracks.includes(tracks[i])))
        .slice(0, Math.ceil(want / 3));
      lyricIdx.forEach((i) => mixed.set(i, "lyrics"));
      shuffle(tracks.map((t, i) => i).filter((i) => !mixed.has(i))).slice(0, want - mixed.size).forEach((i) => mixed.set(i, "fx"));
    }
    this.rounds = tracks.map((track, i) => {
      let kind;
      let effect = null;
      if (ch) {
        kind = ch.id === "lyrics" ? "lyrics" : chooseKind(cat, track);
        effect = ch.surprise ? pickFx() : ch.effect || null;
      } else if (mixed.get(i) === "lyrics") {
        kind = "lyrics";
      } else {
        kind = chooseKind(cat, track);
        if (mixed.get(i) === "fx") effect = pickFx();
      }
      if (effect) lastFx = effect;
      return {
        track, kind, effect, mixed: mixed.has(i),
        prompt: kind === "lyrics" ? "Complétez les paroles" : promptFor(cat, kind),
        choices: this.answerMode === "choices" ? makeChoices(track, kind, pool, cat) : null,
        player: mode === "turns" ? i % this.players.length : 0,
        result: null,
      };
    });
    this.index = 0;
  }

  /** Identifiant des records : catégorie seule, ou défi + catégorie. */
  get recordId() { return recordIdFor(this.cat, this.challenge, this.mix); }

  get current() { return this.rounds[this.index]; }
  get currentPlayer() { return this.players[this.current.player]; }
  get isLast() { return this.index >= this.rounds.length - 1; }
  get finished() { return this.index >= this.rounds.length; }

  /** Réponse du joueur (choix cliqué ou texte tapé ; null = temps écoulé / je passe). */
  answer(value, elapsed) {
    const r = this.current;
    if (r.result) return r.result;
    const p = this.currentPlayer;
    let correct = false;
    if (value != null && value !== "") {
      correct = this.answerMode === "choices"
        ? fold(value) === fold(answerOf(r.track, r.kind))
        : isTypedCorrect(value, acceptedAnswers(r.track, r.kind));
    }
    p.streak = correct ? p.streak + 1 : 0;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    const points = scoreFor({ correct, elapsed, limit: this.duration, streak: p.streak, level: this.level });
    p.score += points;
    if (correct) p.good++;
    r.result = { value, correct, points, elapsed, streak: p.streak };
    return r.result;
  }

  /** Mode soirée : l'animateur indique qui a trouvé (indices des joueurs). 1 point chacun. */
  award(winners) {
    const r = this.current;
    if (r.result) return r.result;
    const set = new Set(winners);
    this.players.forEach((p, i) => {
      if (set.has(i)) { p.score += 1; p.good++; p.streak++; } else p.streak = 0;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
    });
    r.result = { winners: [...set], correct: set.size > 0, points: 1 };
    return r.result;
  }

  /** Extrait impossible à lire : manche annulée, sans pénalité. */
  skip() {
    const r = this.current;
    if (!r.result) r.result = { skipped: true, correct: false, points: 0, winners: [] };
    return r.result;
  }

  next() {
    if (!this.finished) this.index++;
    return !this.finished;
  }

  ranking() {
    return this.players.map((p, i) => ({ ...p, index: i })).sort((a, b) => b.score - a.score || b.good - a.good);
  }
}
