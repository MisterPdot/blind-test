// Réglages et records, gardés sur l'appareil.
const SETTINGS = "bt-settings-v1";
const RECORDS = "bt-records-v1";

export const DEFAULTS = {
  audience: "solo",       // "solo" | "friends"
  friendsMode: "turns",   // "turns" | "party"
  rounds: 10,             // solo et soirée
  perPlayer: 5,           // chacun son tour
  duration: 20,           // secondes pour répondre
  answerMode: "choices",  // "choices" | "typing"
  level: "normal",        // "normal" | "hard" (extrait coupé après quelques secondes)
  players: ["Joueur 1", "Joueur 2"],
  challengeCat: "mix",     // musique des défis
  surprise: "some",       // défis glissés au hasard dans les parties normales : "off" | "some" | "lots"
};

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* navigation privée : tant pis */ }
}

export function loadSettings() {
  const s = { ...DEFAULTS, ...(read(SETTINGS) || {}) };
  if (!Array.isArray(s.players) || !s.players.length) s.players = DEFAULTS.players.slice();
  return s;
}
export function saveSettings(s) { write(SETTINGS, s); }

export function recordKey(catId, rounds, level = "normal") {
  return level === "hard" ? `${catId}|${rounds}|hard` : `${catId}|${rounds}`;
}

export function getRecord(catId, rounds, level) {
  const all = read(RECORDS) || {};
  return all[recordKey(catId, rounds, level)] || null;
}

/** Enregistre le score s'il bat le record. Retourne true si c'est un nouveau record. */
export function submitRecord(catId, rounds, score, level) {
  const all = read(RECORDS) || {};
  const k = recordKey(catId, rounds, level);
  if (score <= 0 || (all[k] && all[k].score >= score)) return false;
  all[k] = { score, date: new Date().toISOString().slice(0, 10) };
  write(RECORDS, all);
  return true;
}
