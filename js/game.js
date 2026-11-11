// Règles du jeu : choix de la question, propositions, correction, points. Aucune dépendance au DOM.
import { fold, shuffle, levenshtein, random } from "./util.js";
import { promptFor } from "./categories.js";

export const PLAYER_COLORS = ["#ff4f8b", "#4fc3ff", "#ffd23f", "#7cff6b", "#b388ff", "#ff9f43"];

export function answerOf(track, kind) {
  if (kind === "title") return track.title;
  if (kind === "artist") return track.artist;
  if (kind === "work") return track.work;
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
  return [track.work];
}

/** Points : 100 pour une bonne réponse + jusqu'à 100 de bonus de rapidité + 50 dès 3 bonnes réponses de suite. */
export function scoreFor({ correct, elapsed, limit, streak }) {
  if (!correct) return 0;
  const speed = Math.max(0, Math.min(1, 1 - elapsed / limit));
  return 100 + Math.round(100 * speed) + (streak >= 3 ? 50 : 0);
}

export class Game {
  /**
   * mode : "solo" | "turns" (chacun son tour, on se passe le téléphone) | "party" (un animateur attribue les points)
   * answerMode : "choices" | "typing"
   */
  constructor({ cat, mode = "solo", players = [{ name: "Moi" }], duration = 20, answerMode = "choices", tracks, extra = [] }) {
    this.cat = cat;
    this.mode = mode;
    this.duration = duration;
    this.answerMode = mode === "party" ? "none" : answerMode;
    this.players = players.map((p, i) => ({
      name: p.name, color: p.color || PLAYER_COLORS[i % PLAYER_COLORS.length], score: 0, streak: 0, bestStreak: 0, good: 0,
    }));
    const pool = tracks.concat(extra);
    this.rounds = tracks.map((track, i) => {
      const kind = chooseKind(cat, track);
      return {
        track, kind,
        prompt: promptFor(cat, kind),
        choices: this.answerMode === "choices" ? makeChoices(track, kind, pool, cat) : null,
        player: mode === "turns" ? i % this.players.length : 0,
        result: null,
      };
    });
    this.index = 0;
  }

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
    const points = scoreFor({ correct, elapsed, limit: this.duration, streak: p.streak });
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
