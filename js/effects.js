// Effets sonores des défis (hélium, ralenti, à l'envers…). L'extrait d'Apple est téléchargé, transformé sur
// le téléphone (Web Audio, rendu hors ligne), puis rejoué comme un fichier WAV par le lecteur habituel.

export const RATE = 32000; // fréquence du rendu (qualité suffisante, fichiers légers)

export const EFFECTS = {
  helium: { label: "Hélium", emoji: "🎈" },
  slow: { label: "Au ralenti", emoji: "🐢" },
  reverse: { label: "À l'envers", emoji: "⏪" },
  underwater: { label: "Sous l'eau", emoji: "🌊" },
  radio: { label: "Vieille radio", emoji: "📻" },
  karaoke: { label: "Sans la voix", emoji: "🎙️" },
  puzzle: { label: "Puzzle", emoji: "🧩" },
};

const OAC = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;
let decoderCtx = null;

function decode(arrayBuffer) {
  const tryCtx = (ctx) => new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(arrayBuffer.slice(0), resolve, reject); // forme « rappel » pour les vieux Safari
    if (p && p.then) p.then(resolve, reject);
  });
  try {
    return tryCtx(new (OAC())(2, 1, 44100)).catch(() => {
      decoderCtx = decoderCtx || new (window.AudioContext || window.webkitAudioContext)();
      return tryCtx(decoderCtx);
    });
  } catch {
    decoderCtx = decoderCtx || new (window.AudioContext || window.webkitAudioContext)();
    return tryCtx(decoderCtx);
  }
}

function rms(a) {
  let s = 0;
  for (let i = 0; i < a.length; i += 7) s += a[i] * a[i];
  return Math.sqrt(s / Math.ceil(a.length / 7));
}

/** Prépare le signal (mono) selon l'effet, avant les filtres. Retourne { data, effect }. */
export function shapeSignal(buffer, effect, random = Math.random) {
  const L = buffer.getChannelData(0);
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  const n = L.length;
  let out = new Float32Array(n);
  if (effect === "karaoke") {
    // La voix est en général au centre : gauche − droite l'efface.
    for (let i = 0; i < n; i++) out[i] = (L[i] - R[i]) * 0.9;
    const mid = new Float32Array(n);
    for (let i = 0; i < n; i++) mid[i] = (L[i] + R[i]) / 2;
    if (rms(out) < rms(mid) * 0.12) {
      // Enregistrement mono : impossible de retirer la voix, on passe « sous l'eau ».
      return { data: mid, effect: "underwater" };
    }
    return { data: out, effect };
  }
  for (let i = 0; i < n; i++) out[i] = (L[i] + R[i]) / 2;
  if (effect === "reverse") out.reverse();
  if (effect === "puzzle") {
    const size = Math.round(buffer.sampleRate * 2); // morceaux de 2 s
    const count = Math.floor(n / size);
    if (count >= 3) {
      const order = [...Array(count).keys()];
      do {
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      } while (order.every((v, i) => v === i));
      const mixed = new Float32Array(count * size);
      const fade = Math.round(buffer.sampleRate * 0.02);
      order.forEach((src, k) => {
        for (let i = 0; i < size; i++) {
          const g = Math.min(1, i / fade, (size - 1 - i) / fade);
          mixed[k * size + i] = out[src * size + i] * g;
        }
      });
      out = mixed;
    }
  }
  return { data: out, effect };
}

/** Rendu complet : données (Float32Array mono) + effet → AudioBuffer au format RATE. */
export async function renderSignal(data, sampleRate, effect) {
  const speed = effect === "helium" ? 1.45 : effect === "slow" ? 0.7 : 1;
  const length = Math.ceil((data.length / sampleRate / speed) * RATE);
  const ctx = new (OAC())(1, length, RATE);
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = speed;
  let node = src;
  const chain = (n) => { node.connect(n); node = n; return n; };
  if (effect === "underwater") {
    const lp = chain(ctx.createBiquadFilter()); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 0.9;
    const g = chain(ctx.createGain()); g.gain.value = 1.8;
  } else if (effect === "radio") {
    const hp = chain(ctx.createBiquadFilter()); hp.type = "highpass"; hp.frequency.value = 550;
    const lp = chain(ctx.createBiquadFilter()); lp.type = "lowpass"; lp.frequency.value = 2800;
    const ws = chain(ctx.createWaveShaper());
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(2.5 * x); }
    ws.curve = curve;
    // grésillement
    const noise = ctx.createBuffer(1, length, RATE);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < length; i++) nd[i] = (Math.random() * 2 - 1) * 0.025;
    const ns = ctx.createBufferSource(); ns.buffer = noise; ns.connect(ctx.destination); ns.start();
  } else if (effect === "karaoke") {
    const g = chain(ctx.createGain()); g.gain.value = 1.3;
  }
  node.connect(ctx.destination);
  src.start();
  const out = await new Promise((resolve, reject) => {
    ctx.oncomplete = (ev) => resolve(ev.renderedBuffer);
    const p = ctx.startRendering();
    if (p && p.then) p.then(resolve, reject);
  });
  return out;
}

/** Encode un AudioBuffer mono en WAV 16 bits. */
export function encodeWav(samples, sampleRate) {
  const n = samples.length;
  const view = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); view.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
  str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, n * 2, true);
  // normalisation douce pour éviter la saturation
  let peak = 0;
  for (let i = 0; i < n; i += 3) peak = Math.max(peak, Math.abs(samples[i]));
  const k = peak > 0.98 ? 0.98 / peak : 1;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] * k));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return view.buffer;
}

const cache = new Map(); // « url|effet » → Promise<{ url, effect }>

/**
 * Prépare la version transformée d'un extrait. Résout { url (blob WAV), effect (effet réellement appliqué) }.
 * En cas d'échec, la promesse est rejetée : le jeu rejoue alors l'extrait original.
 */
export function prepareEffect(previewUrl, effect, { fetchFn = fetch } = {}) {
  const key = `${previewUrl}|${effect}`;
  if (cache.has(key)) return cache.get(key);
  const job = (async () => {
    const res = await fetchFn(previewUrl);
    if (!res.ok) throw new Error(`Extrait ${res.status}`);
    const decoded = await decode(await res.arrayBuffer());
    const shaped = shapeSignal(decoded, effect);
    const rendered = await renderSignal(shaped.data, decoded.sampleRate, shaped.effect);
    const wav = encodeWav(rendered.getChannelData(0), RATE);
    return { url: URL.createObjectURL(new Blob([wav], { type: "audio/wav" })), effect: shaped.effect, duration: rendered.duration };
  })();
  job.catch(() => cache.delete(key));
  cache.set(key, job);
  return job;
}

/** Libère la mémoire des extraits transformés (fin de partie). */
export function clearEffects() {
  for (const job of cache.values()) job.then((r) => URL.revokeObjectURL(r.url), () => {});
  cache.clear();
}
