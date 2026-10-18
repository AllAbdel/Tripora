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

## 9. Dans l'application

Claude Design a livré **Plumio** (`design/mascotte/`, voir `NOTES.md`). Il est
intégré.

- **Le composant** : `apps/web/src/components/mascotte/Mascotte.tsx`.
  - Il lit les poses et la feuille d'animations directement dans
    `design/mascotte/` : une retouche du dessin régénérée avec
    `outils/plumio.py` arrive telle quelle dans l'application.
  - Il se retourne en arabe.
  - Il suit parfois le pointeur des yeux, à la souris seulement, et jamais
    quand on a demandé moins de mouvement.
- **Le guide de démarrage** (`apps/web/src/components/guide/`) suit la
  version 2 des maquettes (`NOTES.md`, section 7) :
  - **l'accueil**, en grand : Plumio de face arrive, fait coucou et « parle »,
    « C'est parti » ou « Passer ». Il s'ouvre seul dans l'application et après
    une connexion ; sur le site public sans compte, une carte discrète le
    propose (pas d'interstitiel) ;
  - **la visite** montre seulement comment créer un voyage, sans bouton
    « Suivant » : Plumio montre le vrai bouton de l'aile, ou picore le vrai
    champ, et c'est la personne qui appuie ou remplit. L'étape suivante se
    déduit de l'écran et du brouillon (`etapesDeLaVisite.ts`, testé) ;
  - elle s'arrête sur « Créer le voyage » sans rien créer ; ce qui est saisi
    reste en brouillon ;
  - hors du chemin, elle se replie en « Reprendre la visite » ; clavier du
    téléphone ouvert, ou liste de suggestions sous le champ : la consigne
    tient en une ligne.
- **Ailleurs, une fois par écran au plus** :
  - `attend` sur les écrans vides (voyages, sondages, réservations) ;
  - `oups` sur la page introuvable et l'écran d'erreur ;
  - `notification` dans la proposition d'activer les notifications ;
  - `celebre` sur le bilan d'un voyage terminé.

**Ce qui a été tranché à l'intégration :**
- Aux questions « Avec qui ? », « Où ? » et « Quand ? », la réponse par défaut
  est déjà valide : la visite attend un vrai appui sur une carte.
- La version complète (huit étapes) est gardée ; « Parfait » n'est dit qu'au
  premier « Continuer ».
- Sur le site sans compte, la visite part du bouton « Créer un voyage » de
  l'accueil ; à la fin, la bulle dit que le bouton enregistre le voyage avec
  un compte gratuit.
- Les champs de date sont ceux du système : la bulle reste sous le champ.
- Le trajet d'une cible à l'autre n'est pas animé : Plumio atterrit à sa
  nouvelle place. Le geste (tapotement, picorement, contentement) se joue sur
  place, relancé toutes les 6 s, trois fois au plus.
- Le guide se relance depuis le profil, le pied de page et l'accueil public.
- **L'aile vise vraiment la cible.** La pose donne une direction (vers le bas,
  le haut, un côté) ; une fois la bulle posée, on mesure où tombe le bout de
  l'aile et on incline Plumio pour qu'elle pointe le point le plus proche de
  la cible, retourné en miroir si la cible est de l'autre côté, sans jamais
  dépasser 30° (au-delà, il a l'air de tomber). Dans le coin de la bulle, il se
  pose sur la bulle plutôt qu'au-delà (`orienterVers`, `placementDeLaBulle.ts`).
- **Il s'efface quand il cacherait ce qu'on lit.** Quand moins de 60 % de la
  cible reste à l'écran — on fait défiler la liste des envies jusqu'à
  « Insolite » —, la bulle et Plumio disparaissent ; la consigne reste
  annoncée aux lecteurs d'écran, et tout revient en remontant (`partVisible`).

**Les sons** (`apps/web/src/components/mascotte/`) :
- Les premiers bruitages imitaient un oiseau (ailes, pépiements, coups de
  bec) : jugés trop enfantins, ils ont été remplacés par quelques notes
  d'interface sobres. **Un son par moment au plus**, et la plupart des gestes
  n'en ont aucun :
  - une quinte douce qui monte quand il se pose (arrivée, atterrissage) ;
  - un tic feutré quand il montre une étape (pointer, tapoter, picorer) ;
  - trois notes d'un accord majeur quand c'est fait (content, célèbre) ;
  - deux notes qui descendent quand il s'en va ;
  - deux notes égales pour une notification, une tierce mineure pour « oups ».
  Rien quand il parle, salue, sautille, se retourne ou réfléchit ; rien au repos.
- `partitions.ts` dit quelle note tombe à quelle milliseconde, calée sur les
  images clés d'`animations.css` (un test relit les durées dans la feuille) ;
  `synthese.ts` les fabrique avec l'API Web Audio : des sinusoïdes douces et
  un partiel de verre discret, dans le médium (500 à 1 000 Hz). Aucun
  fichier, aucune licence.
- Actifs par défaut (réglage « Sons discrets » du profil), muets quand les
  retours sont sur « Rien », quand l'appareil demande moins d'animations, ou
  dans un onglet caché.
- Le navigateur refuse tout son avant le premier appui : le guide n'insiste
  pas, et se fait entendre dès le premier geste. L'application mobile
  (Capacitor autorise le son sans geste) et l'application installée jouent
  dès l'ouverture. Pour Safari, le contexte audio s'ouvre dans le premier
  appui qui suit l'apparition de Plumio.

Les textes arabes des maquettes ne sont pas repris : les bulles passent par
la traduction de l'application, comme le reste (voir `docs/TRADUCTIONS.md`).
À « Découvrir », les gestes ne s'inversent pas en arabe (la carte part à
droite pour « j'y vais » dans toutes les langues) : la consigne française
peut garder « à droite, à gauche ».
