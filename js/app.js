// Interface du blind test : écrans d'accueil, réglages, manches, révélation, résultats.
import { GROUPS, CATEGORIES, categoryById } from "./categories.js";
import { buildPlaylist } from "./music.js";
import { Game, HARD_CLIP, answerOf, recordIdFor } from "./game.js";
import { CHALLENGES, NO_LYRICS, challengeById, mixRate } from "./challenges.js";
import { EFFECTS, prepareEffect, clearEffects } from "./effects.js";
import { attachLyrics } from "./lyrics.js";
import { escapeHtml as e, shuffle } from "./util.js";
import * as audio from "./audio.js";
import { loadSettings, saveSettings, getRecord, submitRecord } from "./storage.js";

const app = document.getElementById("app");
const sheetRoot = document.getElementById("sheet-root");
const toastEl = document.getElementById("toast");

let settings = loadSettings();
let tab = "genres";
let game = null;
let loadToken = 0;
let round = {};
let recapPlaying = -1;

// Accès pour les tests automatisés (lecture seule).
window.BT = { get game() { return game; }, get settings() { return settings; } };

const $ = (sel, root = app) => root.querySelector(sel);
const $$ = (sel, root = app) => [...root.querySelectorAll(sel)];
const grad = (cat) => `linear-gradient(135deg, ${cat.colors[0]}, ${cat.colors[1]})`;
const initial = (name) => e((name.trim()[0] || "?").toUpperCase());
const eq = (n) => `<span class="eq" aria-hidden="true">${"<i></i>".repeat(n)}</span>`;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function show(html, cls = "") {
  app.innerHTML = `<section class="screen ${cls}">${html}</section>`;
  window.scrollTo(0, 0);
}

function save() { saveSettings(settings); }

// ═════════════════════════ Accueil ═════════════════════════
function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function isStandalone() { return window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches; }

function renderHome() {
  stopRound();
  audio.stopAudio();
  clearEffects();
  game = null;
  let installHint = false;
  try { installHint = isIos() && !isStandalone() && !localStorage.getItem("bt-hint-closed"); } catch { /* */ }

  const tiles = tab === "defis" ? CHALLENGES.map((c) => `<button class="tile" data-challenge="${c.id}" style="--g:${grad(c)}">
        <span class="tile-emoji">${c.emoji}</span>
        <span class="tile-name">${e(c.name)}</span>
      </button>`).join("") : CATEGORIES.filter((c) => c.group === tab).map((c) => {
    const rec = settings.audience === "solo" ? getRecord(recordIdFor(c, null, settings.surprise), settings.rounds, settings.level) : null;
    return `<button class="tile" data-cat="${c.id}" style="--g:${grad(c)}">
        <span class="tile-emoji">${c.emoji}</span>
        <span class="tile-name">${e(c.name)}</span>
        ${rec ? `<span class="tile-rec">🏆 ${rec.score}</span>` : ""}
      </button>`;
  }).join("");

  show(`
    <header class="hero">
      <div class="logo">${eq(5)}<h1>Blind <span>Mike</span> Test</h1></div>
      <p class="tagline">Écoute. Devine. Gagne.</p>
    </header>
    ${installHint ? `<div class="hint" id="install-hint">
        <span>📲 <b>Installez le jeu</b> : touchez <b>Partager</b> <span class="share-ico">⬆︎</span> puis
        <b>« Sur l'écran d'accueil »</b>.</span><button class="hint-x" aria-label="Fermer">✕</button></div>` : ""}
    <div class="seg audience" role="tablist" aria-label="Joueurs">
      <button role="tab" data-audience="solo" class="${settings.audience === "solo" ? "on" : ""}">🎧 Solo</button>
      <button role="tab" data-audience="friends" class="${settings.audience === "friends" ? "on" : ""}">🎉 Entre amis</button>
    </div>
    <nav class="tabs" role="tablist" aria-label="Catégories">
      ${GROUPS.map((g) => `<button role="tab" data-tab="${g.id}" class="${tab === g.id ? "on" : ""}">${g.label}</button>`).join("")}
      <button role="tab" data-tab="defis" class="${tab === "defis" ? "on" : ""}">Défis 🎭</button>
    </nav>
    ${tab === "defis" ? `<p class="tab-intro">Des façons de jouer pour pimenter la partie, avec la musique de votre choix.</p>` : ""}
    <div class="grid">${tiles}</div>
    <footer class="foot">Extraits de 30 s fournis par Apple&nbsp;Music · Internet nécessaire pour jouer</footer>
  `, "home");

  $$("[data-cat]").forEach((b) => b.addEventListener("click", () => openSetup(categoryById(b.dataset.cat))));
  $$("[data-challenge]").forEach((b) => b.addEventListener("click", () => openSetup(null, challengeById(b.dataset.challenge))));
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; renderHome(); }));
  $$("[data-audience]").forEach((b) => b.addEventListener("click", () => {
    settings.audience = b.dataset.audience; save(); renderHome();
  }));
  const hint = $("#install-hint .hint-x");
  if (hint) hint.addEventListener("click", () => {
    try { localStorage.setItem("bt-hint-closed", "1"); } catch { /* */ }
    $("#install-hint").remove();
  });
}

// ═════════════════════════ Réglages de la partie ═════════════════════════
function seg(key, value, options) {
  return `<div class="seg small" data-key="${key}">${options.map(([v, label]) =>
    `<button data-val="${v}" class="${String(value) === String(v) ? "on" : ""}">${label}</button>`).join("")}</div>`;
}

function field(label, control, help = "") {
  return `<div class="field"><label>${label}</label>${control}${help ? `<p class="help">${help}</p>` : ""}</div>`;
}

// Catégorie de musique d'un défi (gardée dans les réglages).
function challengeCat(ch) {
  let c = categoryById(settings.challengeCat) || categoryById("mix");
  if (ch.id === "lyrics" && NO_LYRICS.has(c.id)) c = categoryById("mix");
  return c;
}

function musicField(ch) {
  const cur = challengeCat(ch).id;
  const opts = GROUPS.map((g) => `<optgroup label="${e(g.label)}">${CATEGORIES
    .filter((c) => c.group === g.id && !(ch.id === "lyrics" && NO_LYRICS.has(c.id)))
    .map((c) => `<option value="${c.id}" ${c.id === cur ? "selected" : ""}>${c.emoji} ${e(c.name)}</option>`).join("")}</optgroup>`).join("");
  return field("Musique", `<select id="challenge-cat" class="select" aria-label="Musique">${opts}</select>`,
    ch.id === "lyrics" ? "Les paroles viennent de la base libre LRCLIB : les morceaux sans paroles sont passés." : "");
}

// Défis glissés au hasard dans une partie normale (genres, époques, thèmes).
const SURPRISE_LABELS = { off: "Aucun", some: "Quelques-uns", lots: "Beaucoup" };
function surpriseField(cat) {
  const what = NO_LYRICS.has(cat.id) ? "hélium, ralenti, à l'envers, karaoké…" : "hélium, à l'envers, karaoké, paroles manquantes…";
  return field("Défis surprise 🎲", seg("surprise", settings.surprise, Object.entries(SURPRISE_LABELS)),
    settings.surprise === "off" ? "Uniquement les extraits normaux."
      : `${settings.surprise === "lots" ? "Plus de la moitié" : "Environ un tiers"} des morceaux arrivent avec un défi : ${what}`);
}

function sheetBody(cat, ch = null) {
  if (ch) cat = challengeCat(ch);
  const recId = recordIdFor(cat, ch, settings.surprise);
  const friends = settings.audience === "friends";
  const times = [[10, "10 s"], [20, "20 s"], [30, "30 s"]];
  const answers = [["choices", "4 propositions"], ["typing", "Je tape"]];
  const level = field("Difficulté", seg("level", settings.level, [["normal", "Normal"], ["hard", "Difficile 🔥"]]),
    settings.level === "hard"
      ? `L'extrait s'arrête après ${HARD_CLIP} secondes, mais le chrono continue.${settings.audience === "friends" && settings.friendsMode === "party" ? "" : " Points ×1,5."}`
      : "On entend l'extrait pendant tout le temps de réponse.");
  const music = ch ? musicField(ch) : surpriseField(cat);
  if (!friends) {
    const rec = getRecord(recId, settings.rounds, settings.level);
    return music + field("Nombre de morceaux", seg("rounds", settings.rounds, [[10, "10"], [15, "15"], [20, "20"]]))
      + field("Temps pour répondre", seg("duration", settings.duration, times))
      + level
      + field("Réponses", seg("answerMode", settings.answerMode, answers),
        settings.answerMode === "typing" ? "Les fautes de frappe et les accents oubliés sont tolérés." : "")
      + `<p class="record">${rec ? `🏆 Record : <b>${rec.score} pts</b>` : "Pas encore de record : à vous de jouer !"}</p>`;
  }
  const party = settings.friendsMode === "party";
  const players = settings.players.map((n, i) => `
    <div class="player-row">
      <span class="avatar" style="--c:var(--p${i})">${initial(n || `J${i + 1}`)}</span>
      <input class="player-name" data-i="${i}" value="${e(n)}" maxlength="16" placeholder="Joueur ${i + 1}"
             autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Nom du joueur ${i + 1}">
      ${settings.players.length > 1 ? `<button class="icon-btn" data-remove="${i}" aria-label="Retirer">✕</button>` : ""}
    </div>`).join("");
  return music + field("Mode", seg("friendsMode", settings.friendsMode, [["turns", "Chacun son tour"], ["party", "Soirée"]]),
      party ? "Une personne tient le téléphone : tout le monde écoute, le premier qui crie la bonne réponse marque un point."
            : "Chacun répond à son tour : on se passe le téléphone.")
    + field("Joueurs", `<div class="players">${players}</div>
        ${settings.players.length < 6 ? `<button class="ghost add-player" id="add-player">＋ Ajouter un joueur</button>` : ""}`)
    + (party
      ? field("Nombre de morceaux", seg("rounds", settings.rounds, [[10, "10"], [15, "15"], [20, "20"]]))
      : field("Morceaux par joueur", seg("perPlayer", settings.perPlayer, [[3, "3"], [5, "5"], [8, "8"]])))
    + field("Temps pour répondre", seg("duration", settings.duration, times))
    + level
    + (party ? "" : field("Réponses", seg("answerMode", settings.answerMode, answers)));
}

function openSetup(cat, ch = null) {
  const head = ch || cat;
  sheetRoot.innerHTML = `
    <div class="backdrop" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${e(head.name)}">
      <div class="grabber"></div>
      <div class="sheet-head" style="--g:${grad(head)}">
        <span class="tile-emoji">${head.emoji}</span>
        <div><h2>${e(head.name)}</h2><p>${settings.audience === "friends" ? "Entre amis" : "Solo"}</p></div>
        <button class="icon-btn" data-close aria-label="Fermer">✕</button>
      </div>
      ${ch ? `<p class="sheet-desc">${e(ch.desc)}</p>` : ""}
      <div class="sheet-body" id="sheet-body">${sheetBody(cat, ch)}</div>
      <button class="cta" id="play">▶&nbsp; Jouer</button>
    </div>`;
  requestAnimationFrame(() => sheetRoot.classList.add("open"));
  const body = $("#sheet-body", sheetRoot);
  const refresh = () => { body.innerHTML = sheetBody(cat, ch); };

  sheetRoot.onclick = (ev) => {
    const t = ev.target;
    if (t.closest("[data-close]")) return closeSheet();
    const b = t.closest(".seg [data-val]");
    if (b) {
      const key = b.parentElement.dataset.key;
      const v = b.dataset.val;
      settings[key] = /^\d+$/.test(v) ? Number(v) : v;
      save(); refresh(); return;
    }
    const rm = t.closest("[data-remove]");
    if (rm) { settings.players.splice(Number(rm.dataset.remove), 1); save(); refresh(); return; }
    if (t.closest("#add-player")) {
      settings.players.push(`Joueur ${settings.players.length + 1}`); save(); refresh();
      const inputs = $$(".player-name", sheetRoot);
      const last = inputs[inputs.length - 1];
      if (last) { last.focus(); last.select(); }
      return;
    }
    if (t.closest("#play")) return play(ch ? challengeCat(ch) : cat, ch);
  };
  sheetRoot.onchange = (ev) => {
    if (ev.target.id !== "challenge-cat") return;
    settings.challengeCat = ev.target.value;
    save(); refresh();
  };
  sheetRoot.oninput = (ev) => {
    const inp = ev.target.closest(".player-name");
    if (!inp) return;
    settings.players[Number(inp.dataset.i)] = inp.value;
    const av = inp.parentElement.querySelector(".avatar");
    av.textContent = (inp.value.trim()[0] || "?").toUpperCase();
    save();
  };
}

function closeSheet() {
  sheetRoot.classList.remove("open");
  setTimeout(() => { if (!sheetRoot.classList.contains("open")) sheetRoot.innerHTML = ""; }, 300);
}

function play(cat, ch = null) {
  if (settings.audience === "friends") {
    settings.players = settings.players.map((n, i) => n.trim() || `Joueur ${i + 1}`);
    if (settings.friendsMode === "turns" && settings.players.length < 2) {
      toast("Ajoutez au moins 2 joueurs (ou jouez en Solo).");
      return;
    }
    save();
  }
  audio.unlockAudio(); // pendant le toucher : indispensable sur iPhone
  closeSheet();
  startGame(cat, ch);
}

// ═════════════════════════ Préparation ═════════════════════════
async function startGame(cat, ch = null) {
  if (typeof ch === "string") ch = challengeById(ch);
  clearEffects();
  const mode = settings.audience === "solo" ? "solo" : settings.friendsMode;
  const players = mode === "solo" ? [{ name: "Moi" }] : settings.players.map((n) => ({ name: n }));
  const count = mode === "turns" ? settings.perPlayer * players.length : settings.rounds;
  const token = ++loadToken;

  show(`
    <div class="loading" style="--g:${grad(cat)}">
      <div class="disc spinning big"><div class="disc-label"><span>${cat.emoji}</span></div></div>
      <h2 id="load-title">On prépare la playlist…</h2>
      <p class="muted">${ch ? `${ch.emoji} ${e(ch.name)} · ` : ""}${e(cat.name)} · ${count} morceaux</p>
      <button class="ghost" id="cancel">Annuler</button>
    </div>`, "center");
  $("#cancel").addEventListener("click", () => { loadToken++; renderHome(); });

  try {
    let { tracks, extra } = await buildPlaylist(cat, ch && ch.id === "lyrics" ? count + 12 : count);
    if (token !== loadToken) return;
    const mix = ch ? "off" : settings.surprise;
    let lyricTracks = [];
    if (mixRate(mix) && !NO_LYRICS.has(cat.id)) {
      // Défis surprise : quelques questions de paroles (au plus un tiers des défis), sans faire attendre plus de ~10 s.
      const want = Math.ceil(Math.max(1, Math.round(mixRate(mix) * count)) / 3);
      const title = $("#load-title");
      if (title) title.textContent = "On prépare les défis…";
      const deadline = Date.now() + 10000;
      lyricTracks = await attachLyrics(shuffle(tracks).slice(0, want + 3), want, {
        isCancelled: () => token !== loadToken || Date.now() > deadline,
      }).catch(() => []);
      if (token !== loadToken) return;
    }
    if (ch && ch.id === "lyrics") {
      const all = tracks.concat(extra);
      const title = $("#load-title");
      if (title) title.textContent = "On cherche les paroles…";
      const ready = await attachLyrics(all, count, {
        isCancelled: () => token !== loadToken,
        onProgress: (n) => { const t = $("#load-title"); if (t) t.textContent = `On cherche les paroles… ${n}/${count}`; },
      });
      if (token !== loadToken) return;
      if (ready.length < Math.min(count, 3)) throw Object.assign(new Error(), { code: "nolyrics" });
      tracks = ready;
      extra = all.filter((t) => !ready.includes(t));
    }
    if (mode === "turns") {
      const fair = Math.floor(tracks.length / players.length) * players.length;
      if (fair < players.length) throw Object.assign(new Error(), { code: "empty" });
      extra = extra.concat(tracks.slice(fair));
      tracks = tracks.slice(0, fair);
    }
    if (tracks.length < count) toast(`Seulement ${tracks.length} extraits trouvés pour ce thème.`);
    game = new Game({ cat, mode, players, duration: settings.duration, answerMode: settings.answerMode, level: settings.level,
      challenge: ch && ch.id, mix, lyricTracks, tracks, extra });
    if (game.rounds[0].effect) {
      // Premier extrait transformé à l'avance (les suivants pendant la partie).
      const title = $("#load-title");
      if (title) title.textContent = "On transforme les extraits…";
      await Promise.race([prepareRound(game.rounds[0]), new Promise((ok) => setTimeout(ok, 12000))]);
      if (token !== loadToken) return;
      if (game.rounds[1]) prepareRound(game.rounds[1]);
    }
    showIntro();
  } catch (err) {
    if (token !== loadToken) return;
    renderError(err, cat, ch);
  }
}

/** Prépare l'extrait transformé d'une manche (r.fx = { url, effect } ou null si impossible). */
function prepareRound(r) {
  if (!r.effect) return Promise.resolve(null);
  if (!r.fxJob) {
    r.fxJob = prepareEffect(r.track.preview, r.effect).then(
      (fx) => { r.fx = fx; return fx; },
      () => { r.fx = null; r.fxFailed = true; return null; });
  }
  return r.fxJob;
}

function renderError(err, cat, ch = null) {
  const code = err && err.code;
  const msg = code === "busy"
    ? "Beaucoup de parties lancées d'affilée : le service musical demande une petite pause. Réessayez dans une minute."
    : code === "empty"
      ? "Pas assez d'extraits trouvés pour ce thème. Essayez-en un autre !"
      : code === "nolyrics"
        ? "Pas assez de paroles trouvées pour cette musique. Essayez une autre catégorie (par exemple Pop française ou Années 80) !"
      : "Impossible de joindre le service musical. Vérifiez votre connexion Internet.";
  show(`
    <div class="error-card">
      <div class="huge">${code === "busy" ? "⏳" : code === "empty" || code === "nolyrics" ? "🤷" : "📡"}</div>
      <h2>Oups…</h2>
      <p>${msg}</p>
      <button class="cta" id="retry">Réessayer</button>
      <button class="ghost" id="home">Retour à l'accueil</button>
    </div>`, "center");
  $("#retry").addEventListener("click", () => { audio.unlockAudio(); startGame(cat, ch); });
  $("#home").addEventListener("click", renderHome);
}

// ═════════════════════════ Manches ═════════════════════════
function topbar() {
  const n = game.rounds.length;
  const pct = Math.round((game.index / n) * 100);
  let pill;
  if (game.mode === "solo") pill = `<b id="score">${game.players[0].score}</b> pts`;
  else if (game.mode === "turns") {
    const p = game.currentPlayer;
    pill = `<span class="dot" style="--c:${p.color}"></span>${e(p.name)} · <b id="score">${p.score}</b>`;
  } else pill = `${game.index + 1} / ${n}`;
  return `<header class="topbar">
      <button class="icon-btn" id="quit" aria-label="Quitter la partie">✕</button>
      <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <div class="pill">${pill}</div>
    </header>`;
}

function bindQuit() {
  $("#quit").addEventListener("click", () => {
    sheetRoot.innerHTML = `
      <div class="backdrop" data-close></div>
      <div class="sheet small" role="dialog" aria-modal="true" aria-label="Quitter">
        <h2>Quitter la partie ?</h2>
        <p class="muted">Le score de cette partie sera perdu.</p>
        <button class="cta danger" id="confirm-quit">Quitter</button>
        <button class="ghost" data-close>Continuer à jouer</button>
      </div>`;
    requestAnimationFrame(() => sheetRoot.classList.add("open"));
    sheetRoot.onclick = (ev) => {
      if (ev.target.closest("#confirm-quit")) { closeSheet(); renderHome(); }
      else if (ev.target.closest("[data-close]")) closeSheet();
    };
    sheetRoot.oninput = null;
  });
}

function showIntro() {
  const turns = game.mode === "turns";
  if (!turns && game.index > 0) return beginRound();
  const p = game.currentPlayer;
  const body = turns
    ? `<span class="avatar xl" style="--c:${p.color}">${initial(p.name)}</span>
       <p class="muted">Manche ${game.index + 1} / ${game.rounds.length}</p>
       <h2>Au tour de <span class="hl">${e(p.name)}</span></h2>
       <p class="muted">Passe-lui le téléphone 📱</p>`
    : `<div class="huge">${game.challenge ? game.challenge.emoji : game.cat.emoji}</div>
       <h2>${e(game.challenge ? game.challenge.name : game.cat.name)}</h2>
       ${game.challenge ? `<p class="muted">${e(game.cat.emoji)} ${e(game.cat.name)}</p><p class="small">${e(game.challenge.desc)}</p>` : ""}
       <p class="muted">${game.rounds.length} morceaux · ${game.duration} s pour répondre</p>
       ${game.mix !== "off" ? `<p class="small">🎲 Défis surprise : ${game.rounds.filter((x) => x.mixed).length} morceaux vous réservent un défi !</p>` : ""}
       ${game.level === "hard" ? `<p class="hard-badge">🔥 Difficile : extraits de ${HARD_CLIP} s</p>` : ""}
       ${game.mode === "party"
         ? `<div class="chips">${game.players.map((q) => `<span class="chip"><span class="dot" style="--c:${q.color}"></span>${e(q.name)}</span>`).join("")}</div>
            <p class="muted small">Tout le monde écoute. Le premier qui crie la bonne réponse gagne le point !</p>`
         : `<p class="muted small">Plus vous répondez vite, plus vous gagnez de points.</p>`}`;
  show(`${topbar()}<div class="intro-card" style="--g:${grad(game.cat)}">${body}
      <button class="cta" id="go">${turns ? "C'est parti !" : "Je suis prêt !"}</button></div>`, "intro");
  bindQuit();
  $("#go").addEventListener("click", beginRound);
}

function answersHtml(r) {
  if (game.answerMode === "choices") {
    return `<div class="choices">${r.choices.map((c, i) =>
      `<button class="choice" data-choice="${i}" style="--d:${i * 60}ms">${e(c)}</button>`).join("")}</div>`;
  }
  if (game.answerMode === "typing") {
    return `<form class="typed" id="typed" autocomplete="off">
        <input id="guess" type="text" placeholder="Votre réponse…" autocomplete="off" autocorrect="off"
               autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Votre réponse">
        <button class="cta small" type="submit">OK</button>
      </form>
      <button class="ghost" id="pass">Je passe</button>`;
  }
  return `<p class="muted center small">Le premier qui crie la bonne réponse gagne !</p>
    <button class="cta" id="reveal-btn">Révéler la réponse</button>`;
}

function lyricCard(r, done = false) {
  const q = r.track.lyric;
  const line = done
    ? e(q.line).replace("____", `<mark>${e(q.answer)}</mark>`)
    : e(q.line).replace("____", `<span class="blank">${"_".repeat(Math.max(4, Math.min(10, q.answer.length)))}</span>`);
  return `<div class="lyric-card" id="lyric-card">
      <p class="lyric-song">🎵 ${e(r.track.title)} — ${e(r.track.artist)}</p>
      ${q.before ? `<p class="lyric-before">${e(q.before)}</p>` : ""}
      <p class="lyric-line">${line}</p>
    </div>`;
}

function beginRound() {
  const r = game.current;
  stopRound();
  round = { started: false, start: 0, raf: 0, done: false, blocked: false, fallback: 0, cut: false };
  const p = game.currentPlayer;
  show(`${topbar()}
    <div class="stage${r.kind === "lyrics" ? " compact" : ""}" style="--g:${grad(game.cat)}">
      ${r.effect ? `<div class="fx-badge" id="fx-badge">${r.mixed ? "🎲 Défi : " : ""}${EFFECTS[r.effect].emoji} ${e(EFFECTS[r.effect].label)}</div>`
        : r.mixed ? `<div class="fx-badge" id="fx-badge">🎲 Défi : 🎤 Paroles manquantes</div>` : ""}
      <div class="disc-wrap" id="disc-wrap">
        <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-bg" cx="60" cy="60" r="56"/>
          <circle class="ring-fg" id="ring" cx="60" cy="60" r="56" pathLength="100"/>
        </svg>
        <div class="disc spinning" id="disc"><div class="disc-label"><span>${game.cat.emoji}</span></div></div>
        <div class="time" id="time">${game.duration}</div>
      </div>
      ${eq(9).replace("eq", "eq wide")}
      <p class="round-num">Manche ${game.index + 1} / ${game.rounds.length}${game.mode === "turns" ? ` · <span class="dot" style="--c:${p.color}"></span>${e(p.name)}` : ""}</p>
      <h2 class="prompt">${e(r.prompt)}</h2>
      ${r.kind === "lyrics" ? lyricCard(r) : ""}
    </div>
    <div class="answers" id="answers">${answersHtml(r)}</div>
    <div class="tap-play" id="tap-play" hidden><button class="cta">▶&nbsp; Touchez pour écouter</button></div>`, "round");
  bindQuit();

  $$(".choice").forEach((b) => b.addEventListener("click", () => submit(r.choices[Number(b.dataset.choice)], b)));
  const form = $("#typed");
  if (form) {
    const guess = $("#guess");
    guess.focus();
    form.addEventListener("submit", (ev) => { ev.preventDefault(); if (guess.value.trim()) submit(guess.value.trim()); else guess.focus(); });
    $("#pass").addEventListener("click", () => submit(null));
  }
  const rv = $("#reveal-btn");
  if (rv) rv.addEventListener("click", () => partyReveal());

  const tap = $("#tap-play");
  tap.querySelector("button").addEventListener("click", () => {
    audio.resume().then((ok) => { if (ok) { tap.hidden = true; round.blocked = false; startTimer(); } });
  });

  const start = (src) => {
    audio.playTrack(src, {
      onPlaying: startTimer,
      onError: () => onAudioError(),
    }).then((ok) => {
      if (!ok) { round.blocked = true; tap.hidden = false; }
    });
    // Réseau lent : on démarre le chrono quand même au bout de 3 s.
    round.fallback = setTimeout(() => { if (!round.blocked) startTimer(); }, 3000);
  };
  if (r.effect) {
    const myRound = round;
    const go = () => {
      if (myRound !== round || round.done) return;
      if (r.fx) {
        if (r.fx.effect !== r.effect) {
          const b = $("#fx-badge");
          if (b) b.textContent = `${r.mixed ? "🎲 Défi : " : ""}${EFFECTS[r.fx.effect].emoji} ${EFFECTS[r.fx.effect].label}`;
        }
        start(r.fx.url);
      } else {
        const b = $("#fx-badge");
        if (b) b.textContent = "Effet indisponible : extrait normal";
        start(r.track.preview);
      }
    };
    if (r.fx || r.fxFailed) go(); else prepareRound(r).then(go);
  } else {
    start(r.track.preview);
  }

  const nxt = game.rounds[game.index + 1];
  if (nxt) { if (nxt.effect) prepareRound(nxt); else audio.preload(nxt.track.preview); }
}

function startTimer() {
  if (round.started || round.done) return;
  round.started = true;
  round.start = performance.now();
  const ring = $("#ring");
  const time = $("#time");
  const wrap = $("#disc-wrap");
  const tick = () => {
    if (round.done) return;
    const left = Math.max(0, game.duration - elapsed());
    if (ring) ring.style.strokeDashoffset = String(100 - (left / game.duration) * 100);
    if (time) time.textContent = String(Math.ceil(left));
    if (wrap && left <= 5) wrap.classList.add("urgent");
    if (game.level === "hard" && !round.cut && audio.getPlayer().currentTime >= HARD_CLIP) cutClip();
    if (left <= 0) return timeUp();
    round.raf = requestAnimationFrame(tick);
  };
  tick();
}

// Mode difficile : on coupe le son, le chrono continue.
function cutClip() {
  round.cut = true;
  audio.getPlayer().pause();
  const disc = $("#disc");
  if (disc) disc.classList.remove("spinning");
  const eqEl = $(".eq.wide");
  if (eqEl) eqEl.classList.add("muted-eq");
  const wrap = $("#disc-wrap");
  if (wrap) wrap.insertAdjacentHTML("beforeend", `<div class="clip-over">🤫 Fin de l'extrait</div>`);
}

function elapsed() {
  return round.started ? (performance.now() - round.start) / 1000 : 0;
}

function stopRound() {
  if (round.raf) cancelAnimationFrame(round.raf);
  if (round.fallback) clearTimeout(round.fallback);
  round.done = true;
}

function timeUp() {
  if (game.mode === "party") partyReveal();
  else submit(null, null, true);
}

function onAudioError() {
  if (round.done) return;
  stopRound();
  game.skip();
  reveal({ skipped: true });
}

function submit(value, button = null, timeout = false) {
  if (round.done) return;
  const t = elapsed();
  stopRound();
  const res = game.answer(value, t);
  const r = game.current;
  if (game.answerMode === "choices") {
    $$(".choice").forEach((b) => {
      const c = r.choices[Number(b.dataset.choice)];
      b.disabled = true;
      if (isRight(c)) b.classList.add("right");
      else if (b === button) b.classList.add("wrong");
      else b.classList.add("dim");
    });
    setTimeout(() => reveal({ ...res, timeout }), 900);
  } else {
    reveal({ ...res, timeout });
  }
  const score = $("#score");
  if (score) score.textContent = game.currentPlayer.score;
}

function isRight(choice) {
  const r = game.current;
  return choice === answerOf(r.track, r.kind);
}

function partyReveal() {
  if (round.done) return;
  stopRound();
  reveal({ party: true });
}

function reveal(res) {
  const r = game.current;
  const t = r.track;
  const disc = $("#disc");
  if (disc) {
    disc.classList.remove("spinning");
    disc.outerHTML = `<div class="cover-wrap"><img class="cover" src="${e(t.art)}" alt="Pochette : ${e(t.title)}"></div>`;
  }
  const eqEl = $(".eq.wide");
  if (eqEl) eqEl.classList.add("calm");
  const wrap = $("#disc-wrap");
  if (wrap) wrap.classList.add("revealed");
  const over = $(".clip-over");
  if (over) over.remove();
  // Défi à effet : on fait entendre la version originale. Mode difficile : la suite de l'extrait.
  const fxPlayed = r.effect && r.fx && !res.skipped;
  if (fxPlayed) audio.playTrack(t.preview);
  else if (round.cut && !res.skipped) audio.resume();
  const badge = $("#fx-badge");
  if (badge && fxPlayed) badge.textContent = "🎧 Version originale";
  if (r.kind === "lyrics") { const card = $("#lyric-card"); if (card) card.outerHTML = lyricCard(r, true); }

  let verdict;
  if (res.skipped) verdict = `<div class="verdict warn">⚠️ Extrait indisponible : manche annulée</div>`;
  else if (res.party) verdict = "";
  else if (res.correct) {
    verdict = `<div class="verdict ok">✓ Bonne réponse !<b class="pts">+${res.points}</b></div>
      ${res.streak >= 3 ? `<div class="streak">🔥 ${res.streak} d'affilée · bonus +50</div>` : ""}`;
  } else if (res.timeout) verdict = `<div class="verdict ko">⏱ Temps écoulé !</div>`;
  else if (res.value == null) verdict = `<div class="verdict ko">Passé…</div>`;
  else verdict = `<div class="verdict ko">✗ Raté…${game.answerMode === "typing" ? ` <span class="said">« ${e(res.value)} »</span>` : ""}</div>`;

  const meta = [t.work && r.kind !== "work" ? t.work : "", t.year || ""].filter(Boolean).join(" · ");
  const answerLine = r.kind === "work" ? `<p class="work-line">${e(t.work)}</p>`
    : r.kind === "lyrics" ? `<p class="work-line">« ${e(t.lyric.answer)} »</p>` : "";
  const partyBlock = res.party ? `
    <p class="who">Qui a trouvé ?</p>
    <div class="winners">${game.players.map((p, i) =>
      `<button class="winner" data-w="${i}" style="--c:${p.color}"><span class="avatar">${initial(p.name)}</span>${e(p.name)}</button>`).join("")}</div>` : "";

  $("#answers").innerHTML = `
    <div class="reveal">
      ${verdict}
      <div class="track-info">
        ${answerLine}
        <h3>${e(t.title)}</h3>
        <p class="artist">${e(t.fullArtist || t.artist)}</p>
        ${meta ? `<p class="muted small">${e(meta)}</p>` : ""}
      </div>
      ${partyBlock}
      <button class="cta" id="next">${game.isLast ? "Voir les résultats 🏁" : "Morceau suivant →"}</button>
    </div>`;
  const tap = $("#tap-play");
  if (tap) tap.hidden = true;

  const prompt = $(".prompt");
  if (prompt) prompt.textContent = res.party ? "La réponse était…" : "C'était…";

  const winners = new Set();
  $$(".winner").forEach((b) => b.addEventListener("click", () => {
    const i = Number(b.dataset.w);
    if (winners.has(i)) winners.delete(i); else winners.add(i);
    b.classList.toggle("on", winners.has(i));
  }));
  $("#next").addEventListener("click", () => {
    if (res.party) game.award([...winners]);
    audio.stopAudio();
    if (game.next()) showIntro(); else renderResults();
  });
}

// ═════════════════════════ Résultats ═════════════════════════
function renderResults() {
  stopRound();
  audio.stopAudio();
  recapPlaying = -1;
  const cat = game.cat;
  const ch = game.challenge;
  const ranking = game.ranking();
  const n = game.rounds.length;
  let head;
  let celebrate = false;

  if (game.mode === "solo") {
    const p = game.players[0];
    const prev = getRecord(game.recordId, n, game.level);
    const isRecord = n === settings.rounds && submitRecord(game.recordId, n, p.score, game.level);
    celebrate = isRecord;
    const pct = p.good / n;
    const mood = pct >= 0.9 ? "Incroyable ! 🤩" : pct >= 0.7 ? "Bravo ! 🎉" : pct >= 0.4 ? "Pas mal ! 👍" : "On s'entraîne encore ? 💪";
    head = `
      <p class="muted">${ch ? `${ch.emoji} ${e(ch.name)} · ` : ""}${e(cat.emoji)} ${e(cat.name)}${game.mix !== "off" ? ` · 🎲 ${SURPRISE_LABELS[game.mix].toLowerCase()} défis` : ""}</p>
      <h2 class="mood">${mood}</h2>
      <div class="big-score"><span id="final-score">${p.score}</span><small>points</small></div>
      ${isRecord ? `<div class="badge-record">🏆 Nouveau record !</div>` : prev ? `<p class="muted small">Record : ${prev.score} pts</p>` : ""}
      <div class="stats">
        <div><b>${p.good}/${n}</b><span>bonnes réponses</span></div>
        <div><b>${p.bestStreak}</b><span>meilleure série</span></div>
      </div>`;
  } else {
    celebrate = true;
    const top = ranking[0];
    const tie = ranking.length > 1 && ranking[1].score === top.score && ranking[1].good === top.good;
    head = `
      <p class="muted">${ch ? `${ch.emoji} ${e(ch.name)} · ` : ""}${e(cat.emoji)} ${e(cat.name)}${game.mix !== "off" ? ` · 🎲 ${SURPRISE_LABELS[game.mix].toLowerCase()} défis` : ""}</p>
      <h2 class="mood">${tie ? "Égalité ! 🤝" : `${e(top.name)} gagne ! 👑`}</h2>
      <ol class="podium">${ranking.map((p, i) => `
        <li class="rank r${i + 1}" style="--c:${p.color}">
          <span class="place">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
          <span class="avatar">${initial(p.name)}</span>
          <span class="pname">${e(p.name)}</span>
          <span class="pscore">${p.score}<small>${game.mode === "party" ? " pt" + (p.score > 1 ? "s" : "") : " pts"}</small></span>
        </li>`).join("")}</ol>`;
  }

  const recap = game.rounds.map((r, i) => {
    const res = r.result || {};
    const mark = res.skipped ? "–" : game.mode === "party"
      ? (res.winners && res.winners.length ? res.winners.map((w) => `<span class="dot" style="--c:${game.players[w].color}"></span>`).join("") : "✗")
      : res.correct ? "✓" : "✗";
    const cls = res.skipped ? "" : (game.mode === "party" ? (res.winners && res.winners.length ? "ok" : "ko") : res.correct ? "ok" : "ko");
    return `<li class="recap-row" data-i="${i}">
        <button class="recap-play" data-play="${i}" aria-label="Écouter ${e(r.track.title)}">
          <img src="${e(r.track.art)}" alt="" loading="lazy"><span class="play-ico">▶</span>
        </button>
        <div class="recap-text"><b>${e(r.track.title)}</b><span>${e(r.track.fullArtist || r.track.artist)}</span></div>
        <span class="mark ${cls}">${mark}</span>
        ${r.track.link ? `<a class="am" href="${e(r.track.link)}" target="_blank" rel="noopener" aria-label="Ouvrir dans Apple Music">♫</a>` : ""}
      </li>`;
  }).join("");

  show(`
    <div class="results" style="--g:${grad(ch || cat)}">
      ${head}
      <div class="actions">
        <button class="cta" id="again">🔁 Rejouer</button>
        <button class="ghost" id="home">Accueil</button>
      </div>
      <h3 class="recap-title">Les morceaux de la partie</h3>
      <ul class="recap">${recap}</ul>
    </div>`, "results-screen");

  $("#again").addEventListener("click", () => { audio.unlockAudio(); startGame(cat, ch); });
  $("#home").addEventListener("click", renderHome);
  $$("[data-play]").forEach((b) => b.addEventListener("click", () => toggleRecap(Number(b.dataset.play))));
  if (celebrate) confetti();
}

function toggleRecap(i) {
  $$(".recap-row").forEach((row) => row.classList.remove("playing"));
  if (recapPlaying === i && audio.isPlaying()) { audio.stopAudio(); recapPlaying = -1; return; }
  recapPlaying = i;
  const row = $(`.recap-row[data-i="${i}"]`);
  row.classList.add("playing");
  audio.playTrack(game.rounds[i].track.preview, {
    onEnded: () => { row.classList.remove("playing"); recapPlaying = -1; },
    onError: () => { row.classList.remove("playing"); toast("Extrait indisponible."); },
  });
}

function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.className = "confetti";
  const colors = ["#ff4f8b", "#4fc3ff", "#ffd23f", "#7cff6b", "#b388ff", "#ff9f43"];
  for (let i = 0; i < 80; i++) {
    const s = document.createElement("i");
    s.style.left = `${Math.random() * 100}%`;
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    s.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    s.style.setProperty("--x", `${(Math.random() - 0.5) * 160}px`);
    s.style.setProperty("--r", `${Math.random() * 720}deg`);
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4500);
}

// ═════════════════════════ Démarrage ═════════════════════════
renderHome();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* hors ligne non disponible : sans gravité */ });
}
