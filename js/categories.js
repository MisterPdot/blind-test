// Catégories du blind test.
//  - kind "artist" (défaut) : on cherche les morceaux les plus populaires de chaque artiste.
//  - kind "work"  : on cherche les chansons d'une œuvre (film, comédie musicale…) ; la réponse est l'œuvre.
//  - kind "score" : musiques de films par compositeur ; la réponse est le film (tiré du nom de l'album).
//  - kind "pick"  : morceaux choisis un par un (liste dans js/picks.js, préparée avec tests/curate.py).
// minYear / maxYear : filtre sur l'année de sortie (seulement pour les époques récentes, car les vieux
// tubes sont souvent ressortis en « remaster » avec une date récente).

export const GROUPS = [
  { id: "genres", label: "Genres" },
  { id: "epoques", label: "Époques" },
  { id: "themes", label: "Thèmes" },
];

export const CATEGORIES = [
  // ───────────── Genres ─────────────
  {
    id: "pop", group: "genres", name: "Pop", emoji: "🎤", colors: ["#ff4fa3", "#ff8a5c"],
    artists: ["Taylor Swift", "Dua Lipa", "Ed Sheeran", "Adele", "Bruno Mars", "The Weeknd", "Harry Styles",
      "Billie Eilish", "Lady Gaga", "Katy Perry", "Rihanna", "Ariana Grande", "Coldplay", "Justin Bieber",
      "Miley Cyrus", "Shakira", "Sia", "Maroon 5"],
  },
  {
    id: "rock", group: "genres", name: "Rock", emoji: "🎸", colors: ["#ff3b3b", "#8b1e3f"],
    artists: ["Queen", "AC/DC", "The Rolling Stones", "Nirvana", "Foo Fighters", "Red Hot Chili Peppers", "Muse",
      "U2", "Guns N' Roses", "Arctic Monkeys", "The Beatles", "Led Zeppelin", "Oasis", "Green Day",
      "The Killers", "Deep Purple", "The White Stripes", "Bon Jovi"],
  },
  {
    id: "rapfr", group: "genres", name: "Rap français", emoji: "🎙️", colors: ["#2b6bff", "#00d4ff"],
    artists: ["IAM", "Suprême NTM", "MC Solaar", "Booba", "PNL", "Orelsan", "Nekfeu", "Jul", "Ninho", "Damso",
      "SCH", "Gims", "Soprano", "Bigflo & Oli", "Lomepal", "Diam's", "Sexion d'Assaut", "Gazo"],
  },
  {
    id: "rapus", group: "genres", name: "Rap US", emoji: "🧢", colors: ["#f7b500", "#ff5e3a"],
    artists: ["Eminem", "Kanye West", "JAY-Z", "Drake", "Kendrick Lamar", "50 Cent", "Snoop Dogg", "Dr. Dre",
      "Travis Scott", "Nicki Minaj", "Outkast", "The Notorious B.I.G.", "2Pac", "Post Malone", "Cardi B",
      "Lil Wayne", "Coolio"],
  },
  {
    id: "electro", group: "genres", name: "Électro", emoji: "🎧", colors: ["#7a2bff", "#00e0c6"],
    artists: ["Daft Punk", "David Guetta", "Avicii", "Calvin Harris", "Martin Garrix", "Justice", "Kygo",
      "The Chemical Brothers", "Bob Sinclar", "Swedish House Mafia", "Disclosure", "Moby", "Deadmau5",
      "Fatboy Slim", "Kavinsky", "The Prodigy", "Robin Schulz"],
  },
  {
    id: "chanson", group: "genres", name: "Chanson française", emoji: "🥖", colors: ["#2d5bff", "#ff4d6d"],
    artists: ["Édith Piaf", "Jacques Brel", "Charles Aznavour", "Serge Gainsbourg", "Georges Brassens", "Barbara",
      "France Gall", "Michel Sardou", "Johnny Hallyday", "Jean-Jacques Goldman", "Francis Cabrel", "Renaud",
      "Alain Souchon", "Véronique Sanson", "Michel Berger", "Daniel Balavoine", "Joe Dassin", "Claude François"],
  },
  {
    id: "popfr", group: "genres", name: "Pop française", emoji: "🇫🇷", colors: ["#ff6fb5", "#6a5cff"],
    artists: ["Stromae", "Angèle", "Indochine", "Zaz", "Christine and the Queens", "Louane", "Vianney",
      "Kendji Girac", "Clara Luciani", "Julien Doré", "Calogero", "M. Pokora", "Amir", "Slimane",
      "Juliette Armanet", "Aya Nakamura", "Mylène Farmer", "Pomme"],
  },
  {
    id: "rnb", group: "genres", name: "R&B & Soul", emoji: "💜", colors: ["#a83cff", "#ff6a88"],
    artists: ["Beyoncé", "Alicia Keys", "Usher", "Aretha Franklin", "Marvin Gaye", "Stevie Wonder",
      "Whitney Houston", "Mariah Carey", "Destiny's Child", "John Legend", "Amy Winehouse", "Ray Charles",
      "Otis Redding", "SZA", "Frank Ocean", "Lauryn Hill"],
  },
  {
    id: "jazz", group: "genres", name: "Jazz", emoji: "🎷", colors: ["#c78b2a", "#3a2a1a"],
    artists: ["Louis Armstrong", "Ella Fitzgerald", "Miles Davis", "Nina Simone", "Frank Sinatra",
      "Duke Ellington", "John Coltrane", "Billie Holiday", "Chet Baker", "Norah Jones", "Dave Brubeck",
      "Michael Bublé", "Diana Krall", "Count Basie", "Etta James"],
  },
  {
    id: "reggae", group: "genres", name: "Reggae", emoji: "🌴", colors: ["#1fa64a", "#f2c500"],
    artists: ["Bob Marley", "Peter Tosh", "UB40", "Jimmy Cliff", "Alpha Blondy", "Tiken Jah Fakoly", "Sean Paul",
      "Shaggy", "Damian Marley", "Toots and the Maytals", "Inner Circle", "Gregory Isaacs", "Dennis Brown"],
  },
  {
    id: "metal", group: "genres", name: "Métal", emoji: "🤘", colors: ["#444a55", "#b3001b"],
    artists: ["Metallica", "Iron Maiden", "Black Sabbath", "Slipknot", "System of a Down", "Linkin Park",
      "Rammstein", "Gojira", "Megadeth", "Pantera", "Korn", "Avenged Sevenfold", "Motörhead", "Judas Priest",
      "Rage Against the Machine"],
  },
  {
    id: "disco", group: "genres", name: "Disco & Funk", emoji: "🪩", colors: ["#ff9a00", "#ff2fd6"],
    artists: ["Bee Gees", "ABBA", "Donna Summer", "Earth, Wind & Fire", "Chic", "Gloria Gaynor", "Kool & The Gang",
      "James Brown", "Prince", "Village People", "Boney M.", "Jamiroquai", "Sister Sledge", "Michael Jackson",
      "Cerrone"],
  },
  {
    id: "classique", group: "genres", name: "Classique", emoji: "🎻", colors: ["#d9b26f", "#5a3e2b"],
    ask: ["artist"], prompts: { artist: "Qui est le compositeur ?" },
    artists: ["Mozart", "Beethoven", "Bach", "Vivaldi", "Chopin", "Tchaikovsky", "Debussy", "Ravel", "Satie",
      "Grieg", "Dvořák", "Verdi", "Bizet", "Schubert", "Rachmaninov"],
  },
  {
    id: "kpop", group: "genres", name: "K-pop", emoji: "💖", colors: ["#ff5fd2", "#5fd3ff"],
    artists: ["BTS", "BLACKPINK", "TWICE", "Stray Kids", "NewJeans", "EXO", "BIGBANG", "PSY", "Red Velvet",
      "SEVENTEEN", "aespa", "ITZY", "LE SSERAFIM", "ROSÉ", "Jung Kook"],
  },

  // ───────────── Époques ─────────────
  {
    id: "60s", group: "epoques", name: "Années 60", emoji: "🌼", colors: ["#ffb347", "#ff6f91"],
    artists: ["The Beatles", "Elvis Presley", "The Beach Boys", "The Supremes", "Johnny Hallyday",
      "Françoise Hardy", "Sylvie Vartan", "Claude François", "Otis Redding", "The Kinks", "The Doors",
      "Jimi Hendrix", "Simon & Garfunkel", "The Mamas & The Papas", "Jacques Dutronc", "The Animals"],
  },
  {
    id: "70s", group: "epoques", name: "Années 70", emoji: "🕺", colors: ["#ff7e29", "#a0522d"],
    artists: ["ABBA", "Bee Gees", "Queen", "Pink Floyd", "David Bowie", "Elton John", "Fleetwood Mac", "Eagles",
      "Michel Sardou", "Joe Dassin", "Supertramp", "Boney M.", "Donna Summer", "Gloria Gaynor", "Plastic Bertrand",
      "Village People"],
  },
  {
    id: "80s", group: "epoques", name: "Années 80", emoji: "📼", colors: ["#ff00a8", "#00e5ff"],
    artists: ["Michael Jackson", "Madonna", "Whitney Houston", "Prince", "a-ha", "Cyndi Lauper", "Duran Duran",
      "Depeche Mode", "Eurythmics", "Indochine", "Téléphone", "Jean-Jacques Goldman", "Daniel Balavoine",
      "Desireless", "Tears for Fears", "Rick Astley", "Mylène Farmer", "Europe"],
  },
  {
    id: "80sfr", group: "epoques", name: "Spécial 80's français", emoji: "📻", colors: ["#ff2e93", "#2d5bff"],
    kind: "pick",
  },
  {
    id: "80sint", group: "epoques", name: "Spécial 80's international", emoji: "🕹️", colors: ["#00e5ff", "#ff00a8"],
    kind: "pick",
  },
  {
    id: "90s", group: "epoques", name: "Années 90", emoji: "💿", colors: ["#00c6ff", "#7b2ff7"],
    artists: ["Nirvana", "Spice Girls", "Backstreet Boys", "Britney Spears", "Oasis", "Céline Dion", "TLC",
      "Ace of Base", "Eiffel 65", "Alanis Morissette", "No Doubt", "Fugees", "Haddaway", "Las Ketchup",
      "Mylène Farmer", "IAM", "MC Solaar", "Robbie Williams", "Cranberries"],
  },
  {
    id: "2000s", group: "epoques", name: "Années 2000", emoji: "📱", colors: ["#00d084", "#0066ff"],
    minYear: 2000, maxYear: 2012,
    artists: ["Eminem", "Beyoncé", "Shakira", "Black Eyed Peas", "Amy Winehouse", "Outkast", "Coldplay",
      "Linkin Park", "Christina Aguilera", "Justin Timberlake", "Kylie Minogue", "Diam's", "Corneille", "Alizée",
      "Nelly Furtado", "Gorillaz", "Britney Spears", "Rihanna", "Lady Gaga"],
  },
  {
    id: "2010s", group: "epoques", name: "Années 2010", emoji: "🔥", colors: ["#ff512f", "#dd2476"],
    minYear: 2010, maxYear: 2019,
    artists: ["Adele", "Bruno Mars", "Stromae", "Pharrell Williams", "Lorde", "Imagine Dragons", "Major Lazer",
      "LMFAO", "Gotye", "Gims", "Ed Sheeran", "Sia", "Avicii", "Christine and the Queens", "Katy Perry",
      "Daft Punk", "Ariana Grande", "Mark Ronson"],
  },
  {
    id: "2020s", group: "epoques", name: "Années 2020", emoji: "✨", colors: ["#8e2de2", "#ff6ec4"],
    minYear: 2020,
    artists: ["Dua Lipa", "The Weeknd", "Olivia Rodrigo", "Harry Styles", "Doja Cat", "Miley Cyrus", "Billie Eilish",
      "Angèle", "Aya Nakamura", "Måneskin", "Lil Nas X", "Sabrina Carpenter", "Gazo", "Tiakola", "Benson Boone",
      "Chappell Roan", "Taylor Swift", "Bad Bunny"],
  },

  // ───────────── Thèmes ─────────────
  {
    id: "mix", group: "themes", name: "Mix surprise", emoji: "🎲", colors: ["#ff0080", "#7928ca"], mix: true,
  },
  {
    id: "disney", group: "themes", name: "Disney", emoji: "🏰", colors: ["#3a7bd5", "#a26bff"],
    kind: "work", ask: ["work", "title"], prompts: { work: "De quel film ?" },
    works: ["La Reine des neiges", "Le Roi lion", "Aladdin", "La Petite Sirène", "Vaiana", "Encanto", "Raiponce",
      "Le Livre de la jungle", "La Belle et la Bête", "Hercule", "Mulan", "Toy Story", "Pocahontas", "Coco",
      "Les Aventures de Winnie l'ourson", "La Princesse et la Grenouille", "Tarzan", "Wish"],
  },
  {
    id: "films", group: "themes", name: "Musiques de films", emoji: "🎬", colors: ["#232526", "#c9a227"],
    kind: "score", ask: ["work"], prompts: { work: "De quel film ?" },
    artists: ["Hans Zimmer", "John Williams", "Ennio Morricone", "Vangelis", "Howard Shore", "Danny Elfman",
      "Alan Silvestri", "Yann Tiersen", "Vladimir Cosma", "James Horner", "Ludwig Göransson", "Alexandre Desplat",
      "Michael Giacchino", "Klaus Badelt", "Ramin Djawadi"],
    fallbackWorks: ["Titanic", "Star Wars", "Gladiator", "Inception", "Le Seigneur des anneaux", "Retour vers le futur",
      "Pirates des Caraïbes", "Jurassic Park", "Harry Potter", "Le Bon, la Brute et le Truand", "Interstellar",
      "Indiana Jones", "Le Fabuleux Destin d'Amélie Poulain", "Avatar", "Les Dents de la mer"],
  },
  {
    id: "musicals", group: "themes", name: "Comédies musicales", emoji: "🎭", colors: ["#b31217", "#e52d27"],
    kind: "work", ask: ["work", "title"], prompts: { work: "De quel spectacle ?" },
    works: ["Notre-Dame de Paris", "Les Dix Commandements", "Le Roi Soleil", "Mozart l'opéra rock", "Starmania",
      "Grease", "Mamma Mia", "The Greatest Showman", "La La Land", "Les Misérables", "Hamilton", "Roméo et Juliette",
      "Les Demoiselles de Rochefort", "Les Parapluies de Cherbourg", "West Side Story", "Chicago"],
  },
  {
    id: "summer", group: "themes", name: "Tubes de l'été", emoji: "🏖️", colors: ["#f7971e", "#ffd200"],
    artists: ["Los Del Rio", "Lou Bega", "Kaoma", "Las Ketchup", "Luis Fonsi", "Daddy Yankee", "Gipsy Kings",
      "Bob Sinclar", "Magic System", "Pitbull", "Enrique Iglesias", "Inner Circle", "Shakira", "Kungs",
      "Mika", "Major Lazer", "OMI", "Alvaro Soler"],
  },
  {
    id: "series", group: "themes", name: "Séries TV", emoji: "📺", colors: ["#e50914", "#3a0ca3"],
    kind: "pick", ask: ["work"], prompts: { work: "De quelle série ?" },
  },
  {
    id: "cartoons", group: "themes", name: "Dessins animés", emoji: "🧸", colors: ["#ffb703", "#fb5607"],
    kind: "pick", ask: ["work"], prompts: { work: "De quel dessin animé ?" },
  },
  {
    id: "moviesongs", group: "themes", name: "Chansons de films", emoji: "🍿", colors: ["#ff006e", "#ffbe0b"],
    kind: "pick", ask: ["work", "title"], prompts: { work: "De quel film ?" },
  },
  {
    id: "eurovision", group: "themes", name: "Eurovision", emoji: "🎆", colors: ["#7209b7", "#f72585"],
    kind: "pick",
  },
  {
    id: "suisse", group: "themes", name: "Chansons suisses", emoji: "🇨🇭", colors: ["#d52b1e", "#ff7a6b"],
    kind: "pick",
  },
];

export const PROMPTS = {
  title: "Quel est le titre ?",
  artist: "Qui est l'artiste ?",
  work: "De quelle œuvre ?",
};

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id);
}

export function promptFor(cat, kind) {
  return (cat.prompts && cat.prompts[kind]) || PROMPTS[kind];
}
