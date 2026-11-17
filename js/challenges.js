// Défis : façons originales de jouer, sur n'importe quelle catégorie de musique.
export const CHALLENGES = [
  {
    id: "lyrics", name: "Paroles manquantes", emoji: "🎤", colors: ["#ff3d8b", "#ffb23f"],
    desc: "Une ligne de la chanson s'affiche avec un mot en moins : trouvez-le !",
  },
  {
    id: "karaoke", name: "Karaoké", emoji: "🎙️", colors: ["#00c6ff", "#a24bff"], effect: "karaoke",
    desc: "La voix est retirée : reconnaissez la chanson rien qu'à la musique.",
  },
  {
    id: "helium", name: "Hélium", emoji: "🎈", colors: ["#ff6ec4", "#7873f5"], effect: "helium",
    desc: "Extraits accélérés, voix de petit écureuil !",
  },
  {
    id: "slow", name: "Au ralenti", emoji: "🐢", colors: ["#11998e", "#38ef7d"], effect: "slow",
    desc: "Extraits ralentis, voix de géant.",
  },
  {
    id: "reverse", name: "À l'envers", emoji: "⏪", colors: ["#f7971e", "#ff3d3d"], effect: "reverse",
    desc: "L'extrait est joué à l'envers. Bon courage !",
  },
  {
    id: "underwater", name: "Sous l'eau", emoji: "🌊", colors: ["#0052d4", "#65c7f7"], effect: "underwater",
    desc: "On entend la musique comme la tête sous l'eau.",
  },
  {
    id: "radio", name: "Vieille radio", emoji: "📻", colors: ["#8e6e53", "#d9a066"], effect: "radio",
    desc: "Son nasillard et grésillant, comme sur un vieux poste.",
  },
  {
    id: "puzzle", name: "Puzzle", emoji: "🧩", colors: ["#7f00ff", "#e100ff"], effect: "puzzle",
    desc: "L'extrait est découpé en morceaux de 2 secondes, mélangés.",
  },
  {
    id: "surprise", name: "Défis surprise", emoji: "🎲", colors: ["#ff0080", "#ff8c00"], surprise: true,
    desc: "Un effet différent à chaque morceau : hélium, ralenti, à l'envers…",
  },
];

/** Catégories sans paroles (instrumentaux) : écartées du défi « Paroles manquantes ». */
export const NO_LYRICS = new Set(["classique", "films", "series", "cartoons"]);

export const SURPRISE_EFFECTS = ["helium", "slow", "reverse", "underwater", "radio", "karaoke", "puzzle"];

export function challengeById(id) {
  return CHALLENGES.find((c) => c.id === id) || null;
}
