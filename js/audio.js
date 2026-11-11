// Lecture des extraits. Sur iPhone, le son doit être « débloqué » par un toucher :
// on joue un court silence lors du premier toucher, puis le même lecteur peut enchaîner les extraits.

let player = null;
let warm = null;
let unlocked = false;

function silentWavUrl() {
  const n = 800; // 0,1 s à 8 kHz
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

export function getPlayer() {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
    player.setAttribute("playsinline", "");
  }
  return player;
}

/** À appeler pendant un toucher de l'utilisateur. */
export function unlockAudio() {
  const p = getPlayer();
  if (unlocked) return;
  unlocked = true;
  try {
    p.src = silentWavUrl();
    const pr = p.play();
    if (pr && pr.catch) pr.catch(() => { unlocked = false; });
  } catch { unlocked = false; }
}

/** Lance un extrait. Résout true si la lecture a démarré, false si le navigateur l'a bloquée. */
export async function playTrack(url, { onPlaying, onError, onEnded } = {}) {
  const p = getPlayer();
  p.onplaying = onPlaying || null;
  p.onerror = onError ? () => onError() : null;
  p.onended = onEnded || null;
  p.src = url;
  p.currentTime = 0;
  try {
    await p.play();
    unlocked = true;
    return true;
  } catch (e) {
    if (e && e.name === "NotAllowedError") return false;
    if (onError) onError(e);
    return true;
  }
}

export function resume() {
  const p = getPlayer();
  return p.play().then(() => true, () => false);
}

export function stopAudio() {
  if (!player) return;
  player.onplaying = player.onerror = player.onended = null;
  player.pause();
}

export function isPlaying() {
  return !!player && !player.paused && !player.ended;
}

/** Précharge l'extrait suivant (mise en cache réseau) pour un démarrage instantané. */
export function preload(url) {
  if (!url) return;
  try {
    if (!warm) { warm = new Audio(); warm.preload = "auto"; warm.muted = true; }
    warm.src = url;
    warm.load();
  } catch { /* sans importance */ }
}
