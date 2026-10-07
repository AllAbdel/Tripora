# Brief : la mascotte de Tripora

Ce document s'adresse à **Claude Design** (ou à toute personne qui dessine la
mascotte). Il dit ce qu'est Tripora, ce qu'on attend du personnage, les
contraintes de l'application, et ce qu'il faut livrer. Le code, lui, sera
écrit par Claude Code à partir de ces livrables.

## 1. Tripora en bref

Tripora aide un **groupe d'amis à organiser un voyage ensemble** :
- choisir la destination à plusieurs, à partir des envies et du budget de chacun ;
- voter, de façon anonyme ;
- composer le programme jour par jour ;
- se repérer sur la carte ;
- faire les comptes (« qui doit quoi ») ;
- et aussi : sondages, coffre (codes, billets), valise à cocher, journal photo, notifications.

Côté produit :
- **Plateformes :** une seule base de code pour le site (PWA), Android et iOS
  (Capacitor), en React 19, Vite et Tailwind 4.
- **Modèle :** gratuit, sans publicité.
- **Public :** des groupes d'amis de 18 à 35 ans, francophones d'abord.
- **Langues :** quatorze, dont l'arabe, qui se lit de droite à gauche.
- **Site en ligne :** https://tripora-3rg.pages.dev
- **Dépôt :** `AllAbdel/Tripora`, branche `main`.

## 2. L'identité à respecter

Tripora ressemble à un **carnet de voyage** : papier crème, encre brune, filets fins, léger grain. La référence complète est dans `.claude/skills/tripora-interface/SKILL.md`. À lire aussi :

| Fichier | Ce qu'il montre |
|---|---|
| `apps/web/src/index.css` (bloc `@theme`) | La palette : `ink-*` (encre), `paper-*` (papier), `gold-*` (or), `lagoon-*` (turquoise), `brand-*` (l'accent) |
| `apps/web/src/components/Logo.tsx` | Le logo : une épingle, un soleil doré, du bleu |
| `apps/web/src/components/PageGlyphs.tsx` et `Pastille.tsx` | Les pictogrammes dessinés à la main des outils du voyage : **le style graphique le plus proche de ce qu'on veut pour la mascotte** |

Quelques repères de couleur :
- encre : `#1a1713` à `#6b6355` ;
- papier : `#fffdf8`, `#faf6ed` ;
- or : `#c08a2e` ;
- turquoise : `#2f8f88`.

Principes :
- **Retenue.** Presque pas d'ombre, pas de dégradé violet-bleu, pas d'effet
  « 3D brillante ». Le personnage est dessiné, pas rendu.
- **Un accent choisi par la personne.** Chacun règle la couleur d'accent de
  l'application dans son profil. Un seul élément du personnage (un foulard, un
  bandeau, une étiquette…) prend cet accent : il doit être peint en
  `currentColor` ou `var(--accent)`. Tout le reste reste dans les couleurs fixes
  ci-dessus, sans aucune couleur hors palette.
- **Clair et sombre.** En mode sombre, le fond est un papier brun très sombre,
  pas un gris bleuté. Le personnage doit rester lisible sur les deux, avec au
  besoin une variante sombre (trait plus clair).
- **Mouvement.** Courbe vive au départ, arrêt net, **sans rebond** (« le papier
  ne rebondit pas ») : `cubic-bezier(0.16, 1, 0.3, 1)`, de 160 à 360 ms pour un
  geste. Les préférences « mouvement réduit » coupent tout.

## 3. Ce qu'on veut

Un **petit personnage propre à Tripora**, qui donne une identité au site et à
l'application et qui accompagne les gens :

1. **Le tutoriel du premier lancement, sur les vraies pages.** Aujourd'hui, le
   guide de démarrage est un diaporama de texte (`apps/web/src/components/guide/`).
   À la place, le personnage emmène la personne de page en page. Sur chacune,
   il apparaît à côté de l'élément concerné, avec une bulle (« Appuyez sur
   *Nouveau* pour créer votre voyage »), puis on passe à la page suivante.
2. **Ailleurs, avec parcimonie :**
   - un écran vide (aucun voyage, aucun sondage) ;
   - hors ligne ;
   - une erreur ;
   - un succès (destination arrêtée, voyage terminé) ;
   - le vote secret (« chut ») ;
   - l'activation des notifications ;
   - une attente longue.

Il ne doit jamais gêner la lecture ni une décision. Il accompagne, il ne fait
pas le spectacle.

## 4. Le personnage

**Proposer trois directions**, les comparer, et en recommander une. Quelques
pistes, à prendre ou à laisser :
- **une hirondelle** dessinée à l'encre : l'oiseau du voyage, qui vole en groupe
  et revient toujours ;
- **un tampon de passeport vivant**, au bord dentelé : il rappelle le
  passeport et les tampons que l'application donne déjà ;
- **un petit carnet ou une valise** avec un visage.

Contraintes :
- **Lisible de 24 px** (dans une pastille, à côté d'un texte) **à 160 px** (écran
  vide). Silhouette reconnaissable même en une seule couleur.
- **Aucun texte dans le dessin.** Tout ce qu'il « dit » passe par une bulle
  écrite par l'application, traduite en quatorze langues.
- **International.** Pas de geste de la main culturellement marqué (pouce
  levé, « OK », V de la victoire). Pas genré.
- **Retournable.** En arabe, l'interface est en miroir : chaque pose qui pointe
  ou regarde d'un côté doit fonctionner retournée horizontalement, sans
  détail qui casse le miroir (pas de texte, pas de montre au poignet gauche…).
- **Original.** Il ne doit ressembler à aucune mascotte connue (Duolingo,
  Booking, Tripadvisor, Airbnb…).
- **Un nom.** Proposer trois noms courts, faciles à prononcer en français,
  anglais, espagnol et arabe, sans sens gênant dans ces langues.

## 5. La planche de poses

- **accueil** : il salue ;
- **pointer** : vers le haut, le bas, la gauche, la droite. C'est le plus important, il sert au tutoriel ;
- **explique** : il montre quelque chose qu'il tient (une carte, le carnet) ;
- **réfléchit** ;
- **célèbre** : destination arrêtée, voyage réussi ;
- **attend** : écran vide, respiration lente ;
- **hors ligne** : sans réseau, serein, pas inquiet ;
- **oups** : une erreur, embarrassé mais pas triste ;
- **chut** : vote secret, personne ne saura qui a voté quoi ;
- **notification** : il apporte une lettre ou fait tinter une cloche ;
- **départ** : avec sa valise ;
- **au revoir** : fin du tutoriel.

## 6. Les animations

- **Courtes :** 1,2 s au plus, jouées une fois. Seule « attend » boucle, en
  respiration très douce.
- **Technique :**
  - SVG et animations CSS (`@keyframes`) sur des groupes nommés du SVG ;
  - uniquement `transform` et `opacity` ;
  - pas de JavaScript, pas de Lottie, pas de GIF ni de vidéo.
- **Rien d'externe.** Aucune police, image ou script venu d'ailleurs.
  L'application a une politique de sécurité stricte et fonctionne hors ligne.
- **Léger :** moins de 6 Ko par pose (SVG minifié).
- **Mouvement réduit :** quand la personne a demandé de réduire les
  animations (`prefers-reduced-motion: reduce`), la pose est fixe.

## 7. Le tutoriel sur les vraies pages

Les six étapes actuelles (`apps/web/src/components/guide/etapesDuGuide.ts`) et
la page où chacune s'affichera :

| Étape | Page | Élément montré |
|---|---|---|
| Créer le voyage, inviter le groupe | `/voyages` puis `/voyages/nouveau` | le bouton « Nouveau », puis l'invitation (lien, code) |
| Chacun dit ses envies, le groupe vote | `/voyages/<id>` | « Mes envies », une proposition, les boutons de vote |
| Les activités, d'un glissement | `/voyages/<id>/decouvrir` | la carte d'activité et les gestes |
| Le programme se compose tout seul | `/voyages/<id>/itineraire` | une journée, la carte |
| Tout sous la main, même sans réseau | `/voyages/<id>/coffre` | le coffre, puis la valise et « Qui fait quoi » |
| Qui doit quoi, sans calculatrice | `/voyages/<id>/budget` | « Ajouter une dépense », les remboursements |

Pour chaque étape, une maquette qui montre :
- où se place le personnage par rapport à l'élément ;
- la bulle : sa forme, sa pointe vers l'élément, sa largeur maximale ;
- si le reste de la page s'assombrit (projecteur sur l'élément) ou non ;
- les boutons « Suivant » et « Passer », et la progression (étape 2 sur 6).

Formats :
- téléphone (390 × 844) et ordinateur (1280 × 800) ;
- mode clair et mode sombre ;
- **une version arabe** (miroir).

Les textes des bulles reprennent ceux de l'application. On peut les raccourcir, sans en changer le sens. Ton : vouvoiement, casse de phrase (« Créer un voyage »), guillemets « » avec espaces.

## 8. Les livrables

**Sur une branche à part, `design/mascotte`, et uniquement dans le dossier
`design/mascotte/`.** Ne pas modifier `apps/` : Claude Code intègre.

1. **`planche.html`** : une page autonome qui présente toutes les poses, en clair
   et en sombre, à 24, 48, 96 et 160 px. Les animations y sont jouables, avec
   une case « mouvement réduit ». Elle s'ouvre directement dans un navigateur,
   sans serveur.
2. **`poses/<nom>.svg`** : un fichier par pose, `viewBox` carré, optimisé. Les
   groupes à animer portent un `id` ou une `class` explicite (`aile-gauche`,
   `tete`…). L'élément d'accent est en `currentColor`.
3. **`animations.css`** : les `@keyframes`, préfixées `mascotte-`, avec leur
   variante « mouvement réduit ».
4. **`tutoriel/`** : les maquettes des six étapes, en images ou en page HTML.
5. **`NOTES.md`** :
   - le nom retenu et la direction choisie (avec les deux autres, pour mémoire) ;
   - les jetons de couleur utilisés ;
   - les tailles minimales ;
   - où mettre le personnage et où **ne pas** le mettre ;
   - ce qui déclenche chaque animation.

Ensuite, ouvrir une pull request vers `main`, en brouillon si besoin.

## 9. Ce que fait déjà l'application, et ce que fera Claude Code

**Le moteur du tutoriel est en place**, sans personnage. Pour le voir :
- se connecter (ou « Découvrir en mode local » sur l'écran de connexion) ;
- puis Profil › À propos › « Revoir le guide de démarrage ».

Ce qu'il fait déjà :
- les redirections de page en page ;
- un voile sombre, percé autour du vrai élément, avec un liseré de la couleur d'accent ;
- une bulle de 352 px au plus, sous l'élément (ou au-dessus s'il n'y a pas la place), avec une pointe vers lui ;
- le clavier, les lecteurs d'écran, « Passer », la reprise après la création du premier voyage, le rappel depuis le profil.

Le code :
- les étapes, leurs textes et la pose prévue pour chacune : `apps/web/src/components/guide/arretsDeLaVisite.ts` ;
- la bulle : `VisiteGuidee.tsx`, dans le même dossier.

**La place du personnage est réservée.** Elle est au début de la bulle, à gauche (à droite en arabe), à la taille d'une pastille de 44 px.
- C'est `apps/web/src/components/mascotte/Mascotte.tsx`, qui reçoit la pose et la direction du geste :
  - `haut` : la bulle est sous l'élément ;
  - `bas` : elle est au-dessus.
- En attendant, il affiche la pastille de l'écran.
- Les maquettes peuvent proposer une autre place : à côté de la bulle, qui déborde du cadre, ou plus grand. L'intégration suivra.

Ce que fera Claude Code :
- **L'intégration :**
  - les SVG en composants React ;
  - les bulles traduites ;
  - le personnage dans les écrans vides, les erreurs et le mode hors ligne.
- **Les tests :** unitaires et parcours dans un navigateur.

Côté design, donc, **pas de logique à écrire** : l'apparence, le mouvement et
les règles d'usage.
