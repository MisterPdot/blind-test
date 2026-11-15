# Outil de préparation des thèmes « sélection » : cherche chaque morceau choisi à la main dans le
# catalogue Apple (FR) et note son identifiant. Résultat : tests/curated.json, puis tests/build_picks.py
# génère js/picks.js. Usage : python tests/curate.py [catégorie ...]
import json, sys, time, unicodedata, re, urllib.request, urllib.parse, os

def fold(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

JUNK = re.compile(r"karaok|tribute|made famous|in the style|cover|remix|\blive\b|en vivo|en direct|medley|8.?bit|lullaby|berceuse|re-?recorded|sped up|acoustic|version longue|extended|\bdub\b", re.I)

S = {}
def add(cat, rows):
    S.setdefault(cat, []).extend(rows)

# (titre, artiste, œuvre)
add("series", [
 ("I'll Be There for You", "The Rembrandts", "Friends"),
 ("Main Title", "Ramin Djawadi", "Game of Thrones"),
 ("Stranger Things", "Kyle Dixon & Michael Stein", "Stranger Things"),
 ("My Life Is Going On", "Cecilia Krull", "La Casa de Papel"),
 ("The Big Bang Theory Theme", "Barenaked Ladies", "The Big Bang Theory"),
 ("The Simpsons Main Title Theme", "Danny Elfman", "Les Simpson"),
 ("Teardrop", "Massive Attack", "Dr House"),
 ("I Don't Want to Wait", "Paula Cole", "Dawson"),
 ("How Soon Is Now", "Love Spit Love", "Charmed"),
 ("Who Are You", "The Who", "Les Experts"),
 ("Desperate Housewives Main Title", "Danny Elfman", "Desperate Housewives"),
 ("Twin Peaks Theme", "Angelo Badalamenti", "Twin Peaks"),
 ("The X-Files", "Mark Snow", "X-Files"),
 ("Woke Up This Morning", "Alabama 3", "Les Soprano"),
 ("Bad Things", "Jace Everett", "True Blood"),
 ("The Walking Dead Main Title", "Bear McCreary", "The Walking Dead"),
 ("Red Right Hand", "Nick Cave & The Bad Seeds", "Peaky Blinders"),
 ("The Fresh Prince of Bel-Air", "DJ Jazzy Jeff & The Fresh Prince", "Le Prince de Bel-Air"),
 ("Superman", "Lazlo Bane", "Scrubs"),
 ("Hey Beautiful", "The Solids", "How I Met Your Mother"),
 ("Boss of Me", "They Might Be Giants", "Malcolm"),
 ("Where You Lead", "Carole King", "Gilmore Girls"),
 ("Tuyo", "Rodrigo Amarante", "Narcos"),
 ("Downton Abbey", "John Lunn", "Downton Abbey"),
 ("Buffy the Vampire Slayer Theme", "Nerf Herder", "Buffy contre les vampires"),
 ("Sherlock", "David Arnold", "Sherlock"),
 ("Yakety Sax", "Boots Randolph", "Benny Hill"),
 ("The Persuaders", "John Barry", "Amicalement vôtre"),
 ("Mission: Impossible", "Lalo Schifrin", "Mission impossible"),
 ("Dallas", "Jerrold Immel", "Dallas"),
 ("Doctor Who Theme", "Murray Gold", "Doctor Who"),
 ("Breaking Bad Main Title Theme", "Dave Porter", "Breaking Bad"),
 ("The Office Theme", "Jay Ferguson", "The Office"),
 ("Bella Ciao", "Manu Pilas", "La Casa de Papel"),
 ("Kaamelott", "Alexandre Astier", "Kaamelott"),
 ("Wednesday Main Titles", "Danny Elfman", "Mercredi"),
 ("Succession Main Title Theme", "Nicholas Britell", "Succession"),
 ("Way Back Then", "Jung Jae Il", "Squid Game"),
])
add("cartoons", [
 ("Goldorak", "Noam", "Goldorak"),
 ("Albator", "Eric Charden", "Albator"),
 ("Capitaine Flam", "Jean-Jacques Debout", "Capitaine Flam"),
 ("Les mystérieuses cités d'or", "Noam", "Les Mystérieuses Cités d'or"),
 ("Candy", "Dorothée", "Candy"),
 ("Dragon Ball Z", "Bernard Minet", "Dragon Ball Z"),
 ("Les chevaliers du zodiaque", "Bernard Minet", "Les Chevaliers du Zodiaque"),
 ("Olive et Tom", "Bernard Minet", "Olive et Tom"),
 ("Bioman", "Bernard Minet", "Bioman"),
 ("Inspecteur Gadget", "Inspecteur Gadget", "Inspecteur Gadget"),
 ("Attrapez-les tous", "Pokémon", "Pokémon"),
 ("Un monde sans danger", "Julien Lamassonne", "Code Lyoko"),
 ("Ulysse 31", "Ulysse 31", "Ulysse 31"),
 ("Sailor Moon", "Dorothée", "Sailor Moon"),
 ("Il était une fois la vie", "Il était une fois", "Il était une fois… la vie"),
 ("Les Schtroumpfs", "Les Schtroumpfs", "Les Schtroumpfs"),
 ("The Pink Panther Theme", "Henry Mancini", "La Panthère rose"),
 ("Scooby-Doo, Where Are You", "Scooby-Doo", "Scooby-Doo"),
 ("Bob l'éponge", "Bob l'éponge", "Bob l'éponge"),
 ("Totally Spies", "Totally Spies", "Totally Spies"),
 ("Barbapapa", "Barbapapa", "Barbapapa"),
 ("Maya l'abeille", "Maya l'abeille", "Maya l'abeille"),
 ("Heidi", "Heidi", "Heidi"),
 ("Le tour du monde de Willy Fog", "Willy Fog", "Le Tour du monde de Willy Fog"),
 ("Jeanne et Serge", "Bernard Minet", "Jeanne et Serge"),
 ("Les Razmoket", "Les Razmoket", "Les Razmoket"),
 ("Spider-Man", "Spider-Man", "Spider-Man"),
 ("Les Tortues Ninja", "Tortues Ninja", "Les Tortues Ninja"),
 ("Dragon Ball", "Ariane", "Dragon Ball"),
 ("Nicky Larson", "Jean-Paul Césari", "Nicky Larson"),
 ("Princesse Sarah", "Princesse Sarah", "Princesse Sarah"),
 ("Les Minipouss", "Minipouss", "Les Minipouss"),
 ("Tom Sawyer", "Tom Sawyer", "Tom Sawyer"),
 ("Les Snorky", "Snorky", "Les Snorky"),
 ("Les Bisounours", "Bisounours", "Les Bisounours"),
 ("Rémi sans famille", "Rémi", "Rémi sans famille"),
])
add("cartoons_extra", [
 ("Jayce et les conquérants de la lumière", "Bernard Minet", "Jayce et les Conquérants de la lumière"),
 ("Cobra", "Bernard Minet", "Cobra"),
 ("Ken le survivant", "Ken", "Ken le survivant"),
 ("Les maîtres de l'univers", "Musclor", "Les Maîtres de l'univers"),
 ("Lady Oscar", "Anne Germain", "Lady Oscar"),
 ("Signé Cat's Eyes", "Cat's Eyes", "Cat's Eyes"),
 ("Clémentine", "Dorothée", "Clémentine"),
 ("Juliette je t'aime", "Juliette", "Juliette je t'aime"),
 ("Les Pierrafeu", "Flintstones", "Les Pierrafeu"),
 ("Denver le dernier dinosaure", "Denver", "Denver, le dernier dinosaure"),
 ("Il était une fois l'espace", "Il était une fois", "Il était une fois… l'Espace"),
 ("Les mondes engloutis", "Mondes engloutis", "Les Mondes engloutis"),
 ("Albator 84", "Albator", "Albator 84"),
 ("Le collège fou fou fou", "Bernard Minet", "Le Collège fou fou fou"),
 ("Rahan", "Rahan", "Rahan"),
 ("Mask", "Mask", "Mask"),
 ("Wingman", "Bernard Minet", "Wingman"),
 ("Tchou-Tchou", "Tchou Tchou", "Tchou-Tchou"),
 ("Prince Saphir", "Saphir", "Prince Saphir"),
 ("Bouba le petit ourson", "Bouba", "Bouba"),
 ("Lucky Luke", "Lucky Luke", "Lucky Luke"),
 ("Sous le signe des mousquetaires", "Mousquetaires", "Sous le signe des Mousquetaires"),
 ("Max et compagnie", "Max", "Max et Compagnie"),
 ("Creamy merveilleuse Creamy", "Creamy", "Creamy, merveilleuse Creamy"),
 ("Les aventures de Tintin", "Tintin", "Les Aventures de Tintin"),
 ("Pokémon", "Pokémon", "Pokémon"),
])
add("moviesongs", [
 ("My Heart Will Go On", "Céline Dion", "Titanic"),
 ("Eye of the Tiger", "Survivor", "Rocky III"),
 ("Take My Breath Away", "Berlin", "Top Gun"),
 ("Danger Zone", "Kenny Loggins", "Top Gun"),
 ("(I've Had) The Time of My Life", "Bill Medley", "Dirty Dancing"),
 ("Footloose", "Kenny Loggins", "Footloose"),
 ("Flashdance... What a Feeling", "Irene Cara", "Flashdance"),
 ("Ghostbusters", "Ray Parker Jr.", "SOS Fantômes"),
 ("I Will Always Love You", "Whitney Houston", "Bodyguard"),
 ("Misirlou", "Dick Dale", "Pulp Fiction"),
 ("Stayin' Alive", "Bee Gees", "La Fièvre du samedi soir"),
 ("Skyfall", "Adele", "Skyfall"),
 ("Lose Yourself", "Eminem", "8 Mile"),
 ("Axel F", "Harold Faltermeyer", "Le Flic de Beverly Hills"),
 ("The Power of Love", "Huey Lewis & The News", "Retour vers le futur"),
 ("Oh, Pretty Woman", "Roy Orbison", "Pretty Woman"),
 ("(Everything I Do) I Do It for You", "Bryan Adams", "Robin des Bois"),
 ("I Don't Want to Miss a Thing", "Aerosmith", "Armageddon"),
 ("Men in Black", "Will Smith", "Men in Black"),
 ("All Star", "Smash Mouth", "Shrek"),
 ("Happy", "Pharrell Williams", "Moi, moche et méchant 2"),
 ("Shallow", "Lady Gaga", "A Star Is Born"),
 ("Gonna Fly Now", "Bill Conti", "Rocky"),
 ("Unchained Melody", "The Righteous Brothers", "Ghost"),
 ("Born Slippy", "Underworld", "Trainspotting"),
 ("Bang Bang (My Baby Shot Me Down)", "Nancy Sinatra", "Kill Bill"),
 ("Hooked on a Feeling", "Blue Swede", "Les Gardiens de la Galaxie"),
 ("Purple Rain", "Prince", "Purple Rain"),
 ("Streets of Philadelphia", "Bruce Springsteen", "Philadelphia"),
 ("Over the Rainbow", "Judy Garland", "Le Magicien d'Oz"),
 ("Moon River", "Audrey Hepburn", "Diamants sur canapé"),
 ("Reality", "Richard Sanderson", "La Boum"),
 ("Vois sur ton chemin", "Les Petits Chanteurs de Saint-Marc", "Les Choristes"),
 ("Fame", "Irene Cara", "Fame"),
 ("Love Me Like You Do", "Ellie Goulding", "Cinquante nuances de Grey"),
 ("What Was I Made For?", "Billie Eilish", "Barbie"),
 ("She", "Elvis Costello", "Coup de foudre à Notting Hill"),
 ("Who Wants to Live Forever", "Queen", "Highlander"),
 ("The NeverEnding Story", "Limahl", "L'Histoire sans fin"),
 ("Goldfinger", "Shirley Bassey", "Goldfinger"),
 ("Kiss from a Rose", "Seal", "Batman Forever"),
 ("Don't You (Forget About Me)", "Simple Minds", "The Breakfast Club"),
 ("Mrs. Robinson", "Simon & Garfunkel", "Le Lauréat"),
 ("City of Stars", "Ryan Gosling", "La La Land"),
 ("Jai Ho", "A.R. Rahman", "Slumdog Millionaire"),
])
add("80sfr", [
 ("L'aventurier", "Indochine", ""), ("Un autre monde", "Téléphone", ""), ("Voyage voyage", "Desireless", ""),
 ("L'Aziza", "Daniel Balavoine", ""), ("Quand la musique est bonne", "Jean-Jacques Goldman", ""),
 ("Libertine", "Mylène Farmer", ""), ("Week-end à Rome", "Etienne Daho", ""), ("Toute première fois", "Jeanne Mas", ""),
 ("Capitaine abandonné", "Gold", ""), ("Les démons de minuit", "Images", ""), ("Partenaire particulier", "Partenaire Particulier", ""),
 ("Nuit de folie", "Début de Soirée", ""), ("Lambada", "Kaoma", ""), ("Joue pas", "François Feldman", ""),
 ("Marcia Baila", "Les Rita Mitsouko", ""), ("T'en va pas", "Elsa", ""), ("Casser la voix", "Patrick Bruel", ""),
 ("On va s'aimer", "Gilbert Montagné", ""), ("Besoin de rien, envie de toi", "Peter et Sloane", ""), ("Tropique", "Muriel Dacq", ""),
 ("Banana Split", "Lio", ""), ("L'amour à la plage", "Niagara", ""), ("Cargo", "Axel Bauer", ""),
 ("Mistral gagnant", "Renaud", ""), ("Aux sombres héros de l'amer", "Noir Désir", ""), ("Joe le taxi", "Vanessa Paradis", ""),
 ("Ella, elle l'a", "France Gall", ""), ("Confidence pour confidence", "Jean Schultheis", ""), ("Boule de flipper", "Corynne Charby", ""),
 ("Ouragan", "Stéphanie", ""), ("Trois nuits par semaine", "Indochine", ""), ("Plus près des étoiles", "Gold", ""),
 ("Femme que j'aime", "Jean-Luc Lahaye", ""), ("Le chanteur", "Daniel Balavoine", ""), ("Tous les cris les S.O.S.", "Daniel Balavoine", ""),
 ("Envole-moi", "Jean-Jacques Goldman", ""), ("Pour que tu m'aimes encore", "Céline Dion", ""),
 ("Il jouait du piano debout", "France Gall", ""), ("Quelque chose de Tennessee", "Johnny Hallyday", ""),
 ("Africa", "Rose Laurens", ""), ("Viens boire un p'tit coup à la maison", "Licence IV", ""), ("La danse des canards", "J.J. Lionel", ""),
 ("Pour le plaisir", "Herbert Léonard", ""), ("Mon mec à moi", "Patricia Kaas", ""), ("Elle a les yeux revolver", "Marc Lavoine", ""),
 ("Ville de lumière", "Gold", ""), ("Tombé pour la France", "Etienne Daho", ""), ("Désenchantée", "Mylène Farmer", ""),
 ("Sauver l'amour", "Daniel Balavoine", ""), ("Je te donne", "Jean-Jacques Goldman", ""),
])
add("80sint", [
 ("Billie Jean", "Michael Jackson", ""), ("Like a Virgin", "Madonna", ""), ("Take On Me", "a-ha", ""),
 ("Girls Just Want to Have Fun", "Cyndi Lauper", ""), ("I Wanna Dance with Somebody", "Whitney Houston", ""),
 ("Money for Nothing", "Dire Straits", ""), ("Everybody Wants to Rule the World", "Tears for Fears", ""),
 ("Sweet Dreams (Are Made of This)", "Eurythmics", ""), ("Hungry Like the Wolf", "Duran Duran", ""), ("The Final Countdown", "Europe", ""),
 ("Livin' on a Prayer", "Bon Jovi", ""), ("Never Gonna Give You Up", "Rick Astley", ""), ("Wake Me Up Before You Go-Go", "Wham!", ""),
 ("Karma Chameleon", "Culture Club", ""), ("Africa", "Toto", ""), ("Another One Bites the Dust", "Queen", ""),
 ("When Doves Cry", "Prince", ""), ("Just Can't Get Enough", "Depeche Mode", ""), ("Kids in America", "Kim Wilde", ""),
 ("Every Breath You Take", "The Police", ""), ("Total Eclipse of the Heart", "Bonnie Tyler", ""), ("Down Under", "Men at Work", ""),
 ("Tainted Love", "Soft Cell", ""), ("Venus", "Bananarama", ""), ("West End Girls", "Pet Shop Boys", ""),
 ("Bette Davis Eyes", "Kim Carnes", ""), ("In the Air Tonight", "Phil Collins", ""), ("With or Without You", "U2", ""),
 ("Sweet Child o' Mine", "Guns N' Roses", ""), ("Jump", "Van Halen", ""), ("Rebel Yell", "Billy Idol", ""),
 ("99 Luftballons", "Nena", ""), ("True", "Spandau Ballet", ""), ("All Night Long", "Lionel Richie", ""),
 ("Come On Eileen", "Dexys Midnight Runners", ""), ("Celebration", "Kool & The Gang", ""), ("Gloria", "Laura Branigan", ""),
 ("One Night in Bangkok", "Murray Head", ""), ("Such a Shame", "Talk Talk", ""), ("Live Is Life", "Opus", ""),
 ("You're My Heart, You're My Soul", "Modern Talking", ""), ("Boys (Summertime Love)", "Sabrina", ""), ("Tarzan Boy", "Baltimora", ""),
 ("I Like Chopin", "Gazebo", ""), ("Dolce Vita", "Ryan Paris", ""), ("Thriller", "Michael Jackson", ""), ("Like a Prayer", "Madonna", ""),
 ("Don't Stop Believin'", "Journey", ""), ("Here Comes the Rain Again", "Eurythmics", ""), ("Relax", "Frankie Goes to Hollywood", ""),
 ("Smalltown Boy", "Bronski Beat", ""), ("Enola Gay", "Orchestral Manoeuvres in the Dark", ""), ("Wonderful Life", "Black", ""),
])
add("eurovision", [
 ("Waterloo", "ABBA", ""), ("Ne partez pas sans moi", "Céline Dion", ""), ("Zitti e buoni", "Måneskin", ""),
 ("Euphoria", "Loreen", ""), ("Tattoo", "Loreen", ""), ("Hard Rock Hallelujah", "Lordi", ""), ("Rise Like a Phoenix", "Conchita Wurst", ""),
 ("Fairytale", "Alexander Rybak", ""), ("Toy", "Netta", ""), ("Arcade", "Duncan Laurence", ""), ("Heroes", "Måns Zelmerlöw", ""),
 ("Voilà", "Barbara Pravi", ""), ("The Code", "Nemo", ""), ("Hold Me Now", "Johnny Logan", ""), ("Satellite", "Lena", ""),
 ("Wild Dances", "Ruslana", ""), ("Diva", "Dana International", ""), ("Poupée de cire, poupée de son", "France Gall", ""),
 ("Non ho l'età", "Gigliola Cinquetti", ""), ("Making Your Mind Up", "Bucks Fizz", ""), ("Save Your Kisses for Me", "Brotherhood of Man", ""),
 ("L'oiseau et l'enfant", "Marie Myriam", ""), ("Stefania", "Kalush Orchestra", ""), ("Cha Cha Cha", "Käärijä", ""),
 ("Mon amour", "Slimane", ""), ("Soldi", "Mahmood", ""), ("Only Teardrops", "Emmelie de Forest", ""), ("My Number One", "Helena Paparizou", ""),
 ("Everyway That I Can", "Sertab Erener", ""), ("Dancing Lasha Tumbai", "Verka Serduchka", ""), ("J'ai cherché", "Amir", ""),
 ("1944", "Jamala", ""), ("Amar pelos dois", "Salvador Sobral", ""), ("Ein bißchen Frieden", "Nicole", ""), ("Dschinghis Khan", "Dschinghis Khan", ""),
 ("SloMo", "Chanel", ""), ("Europapa", "Joost Klein", ""), ("Rim Tim Tagi Dim", "Baby Lasagna", ""), ("Wasted Love", "JJ", ""),
 ("Tout l'univers", "Gjon's Tears", ""), ("Running Scared", "Ell & Nikki", ""), ("Molitva", "Marija Šerifović", ""),
])
add("suisse", [
 ("Déjeuner en paix", "Stephan Eicher", ""), ("Combien de temps", "Stephan Eicher", ""), ("Pas d'ami (comme toi)", "Stephan Eicher", ""),
 ("Heaven", "Gotthard", ""), ("Anytime Anywhere", "Gotthard", ""), ("Chihuahua", "DJ BoBo", ""), ("Somebody Dance with Me", "DJ BoBo", ""),
 ("W. Nuss vo Bümpliz", "Patent Ochsner", ""), ("Lucky", "Bastian Baker", ""), ("The Race", "Yello", ""), ("Oh Yeah", "Yello", ""),
 ("Alperose", "Polo Hofer", ""), ("Signal", "Bligg", ""), ("She Got Me", "Luca Hänni", ""), ("Du", "Nemo", ""), ("The Code", "Nemo", ""),
 ("Bring en hei", "Baschi", ""), ("Avenue", "Lovebugs", ""), ("Tout l'univers", "Gjon's Tears", ""), ("The Captain of Her Heart", "Double", ""),
 ("Fische versänke", "Züri West", ""), ("Mis Mami", "Kunz", ""), ("079", "Lo & Leduc", ""), ("Där Sündibock", "Sina", ""),
 ("Ne partez pas sans moi", "Céline Dion", ""), ("Eisbär", "Grauzone", ""), ("Hoch die Hände", "Bligg", ""),
 ("Hallelujah", "Bastian Baker", ""), ("Libertad", "Stress", ""), ("Grand Jour", "Stephan Eicher", ""),
 ("Sin ti", "Loco Escrito", ""), ("Hey Hey", "Marc Sway", ""), ("Screaming in the Night", "Krokus", ""),
 ("Lift U Up", "Gotthard", ""), ("Everybody", "DJ BoBo", ""), ("Le chien", "Henri Dès", ""), ("Le beau château", "Henri Dès", ""),
 ("Ich und mys Kafi", "Patent Ochsner", ""), ("Bälleli", "Lo & Leduc", ""), ("Fallin'", "Nemo", ""),
])

if __name__ == "__main__":
    only = sys.argv[1:] or list(S)
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "curated.json")
    out = json.load(open(out_path, encoding="utf-8")) if os.path.exists(out_path) else {}
    UA = "Mozilla/5.0 BlindTestCuration"
    for cat in only:
        res = out.get(cat, [])  # reprise : les morceaux déjà cherchés sont gardés
        done = {r["title"] for r in res}
        for title, artist, work in S[cat]:
            if title in done:
                continue
            q = f"{artist} {title}"
            url = "https://itunes.apple.com/search?" + urllib.parse.urlencode(
                {"term": q, "entity": "song", "country": "FR", "limit": "15"})
            data = {"results": []}
            for attempt in range(4):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": UA})
                    data = json.load(urllib.request.urlopen(req, timeout=20))
                    break
                except Exception as ex:
                    print("  (nouvel essai)", ex, flush=True)
                    time.sleep(30)
            ft, fa = fold(title), fold(artist).split()
            best = None
            for r in data.get("results", []):
                if not r.get("previewUrl"):
                    continue
                tn, an = fold(r.get("trackName")), fold(r.get("artistName"))
                blob = r.get("trackName", "") + " " + (r.get("collectionName") or "")
                if JUNK.search(blob):
                    continue
                if ft[:12] not in tn and tn[:12] not in ft:
                    continue
                score = 1 if (fa and fa[0] in an) else 0
                if best is None or score > best[0]:
                    best = (score, r)
            row = {"title": title, "artist": artist, "work": work}
            if best:
                r = best[1]
                row.update(id=r["trackId"], tn=r["trackName"], an=r["artistName"], cn=r.get("collectionName"),
                           y=(r.get("releaseDate") or "")[:4], amatch=best[0])
            res.append(row)
            print(cat, "|", title, "|", artist, "->",
                  f"{row.get('an')} | {row.get('tn')} | {row.get('cn')} | {row.get('y')} | a={row.get('amatch')}" if best else "INTROUVABLE",
                  flush=True)
            out[cat] = res
            json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            time.sleep(3.3)
