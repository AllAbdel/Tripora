# Plumio — notes de design

La mascotte de Tripora : une hirondelle dessinée à l’encre, foulard à la couleur
d’accent. Ce dossier contient tout ce qu’il faut pour l’intégrer ; rien n’est
encore branché dans `apps/`.

| Fichier | Contenu |
|---|---|
| `poses/<nom>.svg` | Vingt-trois poses, `viewBox` 96 × 96, de 2 à 5,5 Ko chacune (`face` contient aussi sa vue de profil) |
| `animations.css` | Couleurs (clair, sombre, une couleur), pivots, regard, gestes, vie au repos, passages de page, mouvement réduit |
| `planche.html` | Toutes les poses, en clair et en sombre, à 24, 48, 96 et 160 px. Gestes jouables au survol, case « Mouvement réduit », choix d’accent |
| `tutoriel/index.html` | Version 1 : les six étapes, téléphone et ordinateur, en clair, en sombre et en arabe |
| `tutoriel-v2/index.html` | Version 2 : l’accueil en grand, puis la création d’un voyage, faite par la personne (section 7) |
| `outils/` | Les scripts qui produisent les éléments ci-dessus |

Les pages s’ouvrent directement dans un navigateur, sans serveur ni
JavaScript. Elles chargent Fraunces et Inter Tight depuis
`apps/web/public/polices/` (même dépôt). Ouvertes ailleurs, elles prennent les
polices du système.

## 1. Le personnage

**Plumio**, l’hirondelle à l’encre (direction A).
- L’hirondelle part en groupe et revient chaque printemps, comme un groupe d’amis
  qui rouvre Tripora pour le voyage suivant.
- C’est la seule des trois directions qu’on reconnaît encore à 24 px, grâce à la
  queue en fourche.
- Elle montre les choses du bout de l’aile. Il n’y a pas de main, donc aucun
  geste culturellement marqué.
- Elle vole d’une page à l’autre pendant le tutoriel.

**De face** (pose `face`, pour l’accueil seulement) : deux yeux avec leur
reflet, le nœud du foulard au milieu, le ventre rond, les deux pointes de la
queue de part et d’autre des pattes. Même encre, même papier, même bec doré
que de profil ; on le reconnaît encore à 48 px. Toutes les autres poses sont de
profil, tournées vers la droite ; les variantes `-gauche` sont les mêmes,
retournées.

Prononciation : *plu-mi-o*. En arabe : بلوميو.

Pour mémoire, les deux directions écartées :
- **B. Le timbre dentelé.** Un timbre-poste vivant, cadre à la couleur d’accent.
  Il rappelle le passeport, mais réduit, il ressemble à une icône ordinaire et
  se prête mal aux poses.
- **C. Le petit carnet.** Un carnet en kraft, élastique à la couleur d’accent.
  C’est la direction la plus proche de l’identité « carnet », mais à 24 px elle
  ressemble à n’importe quelle icône de livre.

## 2. Les couleurs

Toutes viennent du `@theme` de `apps/web/src/index.css`. Un seul élément suit
l’accent de la personne : **le foulard**, peint en `currentColor`. La feuille
pose `color: var(--accent)` sur `.plumio`.

| Rôle | Clair | Sombre |
|---|---|---|
| Trait (`--plumio-trait`) | `ink-800` #2a251f | `paper-300` #e6ddcb |
| Dos, tête, ailes (`--plumio-dos`) | `ink-700` #3a342b | `ink-600` #524b3f |
| Ventre, blanc de l’œil (`--plumio-ventre`) | `paper-50` #fffdf8 | `paper-200` #f2ece0 |
| Bec, éclats (`--plumio-or`) | `gold-500` #c08a2e | `gold-400` #d4a656 |
| Pupille (`--plumio-vis`) | `ink-900` #1a1713 | `ink-900` #1a1713 |
| Valise (`--plumio-kraft`) | `gold-300` #e8c37a | `gold-400` #d4a656 |
| Épingle de la carte (`--plumio-lagon`) | `lagoon-500` #2f8f88 | `lagoon-300` #7ec6c2 |
| Lignes du carnet (`--plumio-ligne`) | `ink-300` #a79c8a | `ink-500` #6b6355 |
| Foulard | `--accent` (`brand-500`) | `--accent` (`brand-300`) |

- **Mode sombre.** Il s’applique tout seul sous `.dark`. Ailleurs, ajouter
  `.plumio--sombre`. En sombre, le trait devient clair et le dos s’éclaircit
  d’une nuance : le dessin reste lisible sur le papier brun très sombre.
- **Une seule couleur.** Avec `.plumio--mono`, tout prend `currentColor`, et le
  ventre et le blanc de l’œil prennent `--plumio-fond` (papier par défaut). À
  utiliser dans une pastille ou un tampon.

## 3. Tailles

| Usage | Taille | Classe |
|---|---|---|
| À côté d’une ligne de texte, dans un bandeau | 24 à 32 px | `plumio--petit` |
| Pastille | 40 à 56 px | `plumio--mono` si la pastille est colorée |
| Tutoriel, téléphone | 64 px (56 px perché sur un champ) | |
| Tutoriel, ordinateur | 80 px (64 px perché sur un champ) | |
| Accueil du tutoriel, de face | 168 px (téléphone) à 200 px (ordinateur) | |
| Écran vide, erreur, succès | 120 à 160 px | |

- Minimum : 24 px. En dessous de 40 px, `plumio--petit` retire les lignes des
  plumes et les points de « réfléchit ».
- Le dessin déborde un peu de son cadre quand il saute ou fait un pas
  (`overflow: visible`). Il faut prévoir 8 px d’air autour.

## 4. Où le mettre, où ne pas le mettre

**Oui, une fois par écran au plus :**

| Situation | Pose | Taille |
|---|---|---|
| Tutoriel du premier lancement | Voir la section 7 | 56 à 200 px |
| Écran vide (aucun voyage, aucun sondage…) | `attend` + `plumio--vie` | 120–160 px, au-dessus du titre de `EmptyState` |
| Hors ligne, écran entier | `hors-ligne` | 120 px |
| Bandeau hors ligne (`Banner tone="offline"`) | `hors-ligne` | 24 px, `plumio--petit`, au début du bandeau |
| Page d’erreur, page introuvable | `oups` | 120 px |
| Destination arrêtée, voyage terminé | `celebre`, joué une fois | 120 px |
| Explication du vote secret | `chut` | 48 px, à côté du texte |
| Demande d’activation des notifications | `notification` | 96 px |
| Jour du départ | `depart` | 96–120 px |
| Calcul de plus de 2 s (propositions, programme) | `reflechit` ; au-delà de 8 s, `attend` | 96 px |
| Accueil après une longue absence | `accueil` | 96 px |

**Non :**
- Jamais deux Plumio sur le même écran, ni dans une liste ou une carte répétée.
- Pas à côté d’une décision : boutons de vote, montant, bouton « Arrêter la
  destination », remboursement. Plumio ne doit pas influencer un choix.
- Pas dans les formulaires, les erreurs de champ ni les messages de validation.
  **Exception :** la visite guidée du premier lancement (section 7). Plumio y
  montre les champs de « Nouveau trip » ; il s’en va quand la visite se termine.
  Il ne commente jamais une valeur saisie et ne valide rien.
- Pas sur les pages légales ni dans le pied de page.
- Pas dans les notifications du système ni dans les e-mails. Si on veut
  l’image, utiliser le SVG fixe, sans animation.
- Il ne cache jamais le texte qu’il accompagne, ni l’élément qu’il montre.

## 5. Ce qui déclenche chaque animation

Les classes se posent sur le `<svg class="plumio …">`. Seuls `transform` et
`opacity` bougent. La courbe est `cubic-bezier(0.16, 1, 0.3, 1)`, sans rebond.

| Classe | Effet | Quand l’ajouter |
|---|---|---|
| `plumio--joue` | Le geste de la pose, une fois (≤ 1,2 s) | À la première apparition de la pose. Ne pas le rejouer à chaque rendu |
| `plumio--calme` | Souffle (4,2 s), clignement (5,3 s), foulard qui bouge à peine | En continu, pendant que la bulle du tutoriel est affichée |
| `plumio--vie` | `--calme` + une chorégraphie de 26 s : coup de queue, tête penchée, deux pas de côté, lissage des plumes, ébrouement, regard en l’air, retour | Écrans vides et attente longue, quand l’application ne pilote pas les gestes |
| `plumio--geste-<nom>` | Un geste, une fois : `cligne`, `lissage`, `ebroue`, `pas`, `regarde`, `penche`, `queue`, `pepie` | Voir « Gestes pilotés » ci-dessous. Retirer la classe à `animationend` |
| `plumio--geste-pepie` | Le bec s’ouvre deux fois | Quand une bulle apparaît, pour les poses au bec fermé (pas `accueil`, `celebre`, `au-revoir`) |
| `plumio--suit` | Les yeux suivent `--plumio-regard-x` et `--plumio-regard-y` (de -1 à 1) ; la tête s’incline un peu | Voir « Le regard » ci-dessous |
| `plumio--envol` / `plumio--atterrit` | Il part en haut à droite, ou arrive d’en haut à gauche (320 / 360 ms) | Changement de page sans trajet dessiné |
| `plumio--sort` | Il s’envole et disparaît (600 ms) | Après « Terminer », sur la pose `au-revoir` |
| `plumio--immobile` | Tout s’arrête | Si l’application a son propre réglage « réduire les animations » |
| `plumio--arrive`, `--salue`, `--parle`, `--se-tourne`, `--tapote`, `--picore`, `--sautille`, `--content` | Les gestes de la visite guidée, version 2 | Voir la section 7 |

Les poses `attend` et `hors-ligne` respirent et clignent sans classe. Les poses
en vol (`vol`, `depart`) battent des ailes tant qu’elles sont affichées.

**Mouvement réduit.** Sous `prefers-reduced-motion: reduce`, toutes les
animations et transitions s’arrêtent, et le regard ne bouge plus. La pose reste
affichée, fixe. L’application ne doit alors ni piloter de geste, ni poser les
variables du regard.

### Gestes pilotés (JavaScript, côté application)

`plumio--vie` suffit sans JavaScript. Pour un rendu plus naturel :
- tirer un geste au hasard toutes les 8 à 20 s : `cligne` deux fois plus souvent,
  `lissage`, `pas` et `ebroue` plus rarement ;
- jamais deux fois de suite le même ;
- aucun geste pendant les 2 s qui suivent l’apparition d’une bulle, ni pendant
  un trajet ;
- tout arrêter quand l’onglet est caché (`visibilitychange`) ou quand Plumio
  sort de l’écran (`IntersectionObserver`).

### Le regard

- `--plumio-regard-x` vaut -1 derrière lui et 1 devant son bec.
  `--plumio-regard-y` vaut -1 en haut et 1 en bas.
- Quand Plumio est retourné (`pointer-gauche`, arabe), inverser le signe de x.
- **Parfois seulement :** quand le pointeur bouge à moins de 320 px de Plumio,
  ajouter `plumio--suit` pour 2 à 4 s, puis le retirer. Il retourne alors à
  son regard de repos.
- Uniquement avec `(pointer: fine)`. Jamais au toucher, jamais en mouvement
  réduit.
- Poser les variables avec `element.style.setProperty()`, une fois par image
  (`requestAnimationFrame`). La CSP le permet : elle bloque l’attribut `style`
  écrit dans le HTML, pas le CSSOM.

## 6. Le tutoriel, version 1

Remplacée par la version 2 (section 7). Les maquettes sont dans
`tutoriel/index.html`. Les règles :

- **Placement.** Plumio se pose sur le bord haut de sa bulle, du côté de
  l’élément, et le montre de l’aile.
  - Téléphone : la bulle sous l’élément, ou au-dessus s’il est dans le tiers bas
    de l’écran.
  - Ordinateur : la bulle à côté de l’élément, côté fin de ligne ; sinon dessous.
  - Entre l’élément et la bulle, laisser la hauteur de Plumio : 58 px sur
    téléphone, 86 px sur ordinateur. Il ne cache jamais l’élément.
- **Bulle.**
  - Papier `--surface-raised`, filet `--border-fort`, rayon 12 px, ombre
    `--shadow-lift`.
  - Largeur fixe : 288 px sur téléphone, 320 px sur ordinateur. Marge
    intérieure : 16 px.
  - Une pointe de 14 px tournée vers l’élément.
  - En haut : « Étape n sur 6 » et six traits de progression. En bas :
    « Passer » (bouton discret) et « Suivant » (accent), ou « Terminer » à la
    dernière étape.
- **Projecteur.**
  - Un voile sur toute la page, sauf l’élément : encre à 52 % en clair, noir à
    50 % en sombre.
  - Autour de l’élément : 3 px de papier, puis 2 px d’accent, au rayon de
    l’élément.
  - Pas de voile à « Découvrir ».
  - L’élément reste cliquable, et l’utiliser fait avancer le tutoriel.
- **Mouvement.**
  - Au changement de page, la pose `vol` relie l’ancienne ancre à la nouvelle
    (360 à 600 ms). Puis la pose d’arrivée joue son geste (`plumio--joue`).
  - La bulle apparaît 120 ms plus tard : opacité, et 8 px de montée en 220 ms.
    Plumio pépie une fois.
  - Pendant la lecture : `plumio--calme` seulement.
- **Arabe.**
  - Toute la mise en page passe en miroir (propriétés logiques).
  - Plumio est retourné (`scaleX(-1)`).
  - Les montants restent écrits de gauche à droite.
- **Accessibilité.**
  - La bulle est un dialogue non modal, annoncé à chaque étape. Le focus va sur
    « Suivant ».
  - Échap équivaut à « Passer ». Les flèches mènent à l’étape précédente ou
    suivante.
  - Plumio est `aria-hidden` : tout ce qu’il « dit » est dans la bulle.

| # | Page | Élément | Voile | Plumio (téléphone / ordinateur) | Bulle (français) |
|---|---|---|---|---|---|
| 1 | `/voyages`, puis `/voyages/nouveau` | « Nouveau », puis l’invitation | Oui | `pointer-haut` / `pointer-haut` | Appuyez sur « Nouveau » pour créer votre voyage. Ensuite, envoyez le lien ou le code au groupe. |
| 2 | `/voyages/<id>` | « Mes envies », puis le vote | Oui | `pointer-haut` / `pointer-gauche` | Remplissez « Mes envies » : Tripora propose les destinations qui plaisent à tout le groupe. Ensuite, votez. |
| 3 | `/voyages/<id>/decouvrir` | La carte d’activité, les boutons | Non | `pointer-bas` / `pointer-gauche` | Glissez à droite : j’y vais. À gauche : pas pour moi. Les boutons font pareil. |
| 4 | `/voyages/<id>/itineraire` | Une journée, puis la carte | Oui | `pointer-haut` / `pointer-gauche` | Les activités qui ont plu sont rangées jour par jour. Touchez une journée pour la voir sur la carte. |
| 5 | `/voyages/<id>/coffre` | Le coffre, puis la valise et « Qui fait quoi » | Oui | `pointer-haut` / `pointer-gauche` | Codes, wifi, billets : tout est rangé dans le coffre, et reste lisible sans réseau. |
| 6 | `/voyages/<id>/budget` | « Nouvelle dépense », puis les remboursements | Oui | `pointer-bas` / `pointer-haut` | Ajoutez une dépense : qui a payé, combien, pour qui. Tripora calcule qui doit quoi. |

- Les textes arabes des maquettes sont des brouillons, à faire valider selon
  `docs/TRADUCTIONS.md`.
- Pour l’étape 3, la consigne arabe ne dit ni droite ni gauche : elle nomme
  les boutons. Il faut vérifier dans `Decouvrir.tsx` si les gestes
  s’inversent en arabe, puis aligner le texte français et le texte arabe.
- Le bouton s’appelle « Nouvelle dépense » dans l’application (le brief disait
  « Ajouter une dépense ») : les maquettes reprennent le libellé réel.

## 7. Le tutoriel, version 2

Les maquettes sont dans `tutoriel-v2/index.html` : chaque étape, accueil
compris, en téléphone (390 × 844) et en ordinateur (1280 × 800), en clair, en
sombre et en arabe (miroir), plus le clavier ouvert, la liste de suggestions
ouverte, la bulle repliée et la carte du site public.

**Le principe.** Plumio n’a pas de bouton « Suivant ». Il montre le vrai bouton
ou le vrai champ ; c’est la personne qui appuie, choisit ou tape, et l’étape
suivante vient d’elle-même. Il ne change jamais de page sans que la personne ait
appuyé. La visite montre seulement comment créer un voyage (ni Découvrir, ni
l’itinéraire, ni le coffre, ni le budget partagé) et ne valide rien à la place
de la personne : elle se termine sur « Créer le voyage », sans appuyer dessus.

### L’accueil

- **Dans l’application**, et sur le site **après une connexion** : il s’ouvre
  seul, une fois. Plein écran, centré sur le papier (`--surface-muted`).
- **Sur le site public, sans compte** : jamais à l’arrivée (Google pénalise les
  interstitiels). Une carte discrète sous les deux boutons de la page d’accueil :
  Plumio `attend` 44 px, « Découvrir Tripora avec Plumio », « Une minute, sans
  compte ». Un appui ouvre l’accueil en grand.
- Plumio `face`, 168 px sur téléphone, 200 px sur ordinateur. Titre en Fraunces
  (28 / 40 px) : « Bonjour, moi c’est Plumio ! ». Texte : « Bienvenue sur
  Tripora. Je vais vous montrer comment préparer un voyage entre amis. Une
  minute, promis. » Boutons « C’est parti » (accent) et « Passer » (discret).
- Fenêtre modale (`role="dialog"`, `aria-modal`), focus sur « C’est parti ».
  Échap = « Passer ».

| Temps | Classe sur la pose `face` | Durée |
|---|---|---|
| 0 | `plumio--arrive` : il descend en battant des ailes et se pose | 1 100 ms |
| 1 150 ms | `plumio--salue` : coucou de l’aile, tête penchée | 1 200 ms |
| 2 450 ms | `plumio--parle`, avec `--plumio-parle-fois: 2` : le bec bouge pendant la lecture | 2 × 1 100 ms |
| ensuite | `plumio--calme` | en continu |
| « C’est parti » | `plumio--se-tourne` (la vue de profil est déjà dans `face.svg`), puis pose `vol` vers la première cible | 520 ms, puis 360 à 600 ms |
| « Passer » | pose `au-revoir` + `plumio--joue`, puis `plumio--sort` ; la fenêtre se ferme à la fin | 1 100 + 600 ms |

Le titre et le texte apparaissent pendant l’arrivée (opacité, 8 px de montée,
220 ms, 200 ms de décalage) : on ne fait pas attendre la lecture.

### Les règles de placement

**Bouton ou option : l’aile.**
- Plumio (`pointer-haut`, `-bas`, `-gauche`, `-droite`, selon où est la cible)
  se pose sur le bord haut de sa bulle, côté cible. 64 px sur téléphone, 72 à
  80 px sur ordinateur.
- Entre la cible et la bulle : la hauteur de Plumio (50 à 64 px sur téléphone,
  86 px sur ordinateur). Il ne cache jamais la cible.
- Téléphone : la bulle sous la cible, ou au-dessus si la cible est dans le tiers
  bas de l’écran (« Continuer »). Ordinateur : à côté de la colonne de
  l’assistant, côté fin de ligne, à hauteur de la cible.
- Quand la bulle apparaît : `plumio--tapote` (l’aile tendue tapote l’air deux
  fois, 700 ms). Sans action, il recommence toutes les 6 s, trois fois au plus,
  puis reste `plumio--calme`.

**Champ : le bec.**
- Plumio (`picore-gauche`, ou `picore-droite` en arabe) se tient debout sur le
  bord haut du champ, côté fin de ligne, tourné vers le début : 56 px sur
  téléphone, 64 px sur ordinateur, à 10 à 20 px du bout du champ (52 px quand
  le champ affiche une unité, comme « € »).
- `plumio--picore` : trois coups de bec en 900 ms, une petite marque d’encre à
  chaque impact. Sans saisie, il recommence au bout de 6 s, trois fois au plus.
- Dès la première frappe (`input`), il s’arrête, se redresse et regarde ce qui
  est écrit : pose `regarde-gauche` (`regarde-droite` en arabe). Il ne picore
  plus tant que le champ n’est pas vidé.
- La bulle est sous le champ. **Dès que la liste de suggestions s’ouvre**
  (`aria-expanded="true"`), elle passe au-dessus du champ. Plumio ne cache jamais
  le texte saisi ni la liste.
- Champ de date : il ouvre le calendrier du système, pas le clavier ; la bulle
  reste sous le champ. Le bec passe au second champ quand le premier est rempli.

**Clavier ouvert (téléphone).**
- Détection : `visualViewport.height` < 75 % de `window.innerHeight`.
- La bulle devient une ligne collée au-dessus du clavier : Plumio
  `regarde-droite` en 30 px (`plumio--petit`), la consigne en une ligne,
  « Passer » au bout. Hauteur 48 px, marges 8 px.
- Position : `position: fixed`, `bottom` = `innerHeight − visualViewport.height
  − visualViewport.offsetTop`, mis à jour sur `visualViewport` `resize` et
  `scroll`.
- Elle ne se pose jamais sur la liste : l’application fait défiler le champ en
  haut de l’écran (`scrollIntoView({ block: 'start' })`) pour que la liste
  tienne dans la moitié qui reste.
- Elle reprend sa forme quand le clavier se ferme.

**Projecteur.** Comme la version 1 : voile (encre 52 % en clair, noir 50 % en
sombre), 3 px de papier puis 2 px d’accent autour de la cible. La cible reste
utilisable, et c’est en l’utilisant qu’on avance. À la dernière étape, ni voile
ni tapotement.

**La bulle.** 288 px sur téléphone, 300 px sur ordinateur (264 px à côté d’une
colonne). En haut : « Visite guidée », huit traits de progression, « Passer la
visite » (toujours là). Puis la consigne, 15 / 16 px. Pas de bouton, sauf
« Terminer la visite » à la fin. Apparition : opacité et 8 px de montée en
220 ms, 120 ms après l’arrivée de Plumio.

**Hors du chemin.** Un appui ailleurs que sur la cible ou la bulle, ou une
autre page : le voile s’en va et la bulle se replie en un rond de 56 px
(Plumio `attend` 34 px, `plumio--calme`), en bas côté fin de ligne, au-dessus
de la barre d’onglets, avec « Reprendre la visite ». Un appui reprend la visite
là où elle en était (et revient à sa page : c’est la personne qui a appuyé).

**Déplacements.** Le trajet est à l’application (`transform: translate()`,
`cubic-bezier(0.16, 1, 0.3, 1)`) ; les classes ne jouent que le geste sur place.
- Même page, moins de 160 px : pose `sautille` (un saut de 420 ms ; deux pour
  un trajet plus long) pendant la translation.
- Même page, plus loin : pose `vol`, 360 à 600 ms selon la distance.
- Autre page : seulement après l’appui de la personne. Pose `vol` depuis la
  dernière position connue jusqu’à la nouvelle cible, une fois la page
  affichée ; puis `plumio--atterrit`.
- Action réussie (une carte choisie, une ville prise dans la liste) :
  `plumio--content` (hochement, pépie, plumes gonflées, 640 ms), plus discret
  que `celebre`.

**Accessibilité.**
- La bulle n’est pas modale (`role="group"`, `aria-label="Visite guidée"`) ;
  sa consigne est annoncée par une région `aria-live="polite"` à chaque étape.
- Tab mène au vrai bouton, au vrai champ ; la bulle suit dans l’ordre du
  document, juste après la cible.
- Échap termine la visite, à toute étape.
- Plumio est `aria-hidden` : tout ce qu’il « dit » est écrit dans la bulle.
- Mouvement réduit : aucune classe de geste, aucun trajet animé (Plumio apparaît
  directement à sa place), poses fixes.

**Arabe.** Toute la page passe en miroir (propriétés logiques). Plumio est
retourné ; il picore et regarde de l’autre côté (`picore-droite`,
`regarde-droite`). Le clavier, lui, ne se retourne pas.

**Exception.** La règle « pas de Plumio dans les formulaires » (section 4) ne
vaut pas pour cette visite. Partout ailleurs, elle tient.

### Les étapes

| # | Page | Cible (`data-guide`) | Geste | Bulle | Ce qui fait avancer |
|---|---|---|---|---|---|
| 0 | Au premier lancement | — | `face` : arrive, salue, parle | « Bonjour, moi c’est Plumio ! » (voir plus haut) | « C’est parti » ou « Passer » |
| 1 | `/voyages` | `nouveau-voyage` (« Nouveau » ; « Créer un trip » si la liste est vide) | Aile, `pointer-haut` | Tout commence ici : appuyez sur « Nouveau ». (ou « Créer un trip ») | L’appui sur le bouton |
| 2 | `/voyages/nouveau`, question 1 | `avec-qui` (les quatre cartes) | Aile | Avec qui partez-vous ? Choisissez une réponse. | Un appui sur une carte, même « Entre amis », déjà cochée |
| — | Chaque question, réponse valide | `continuer` | `content`, puis `sautille` jusqu’au bouton, aile | Parfait. Appuyez sur « Continuer ». (la première fois ; ensuite, geste seul) | L’appui sur « Continuer » |
| 3 | Question 2 | `ville-depart` (« Chercher une ville de départ ») | Bec | Tapez votre ville, puis choisissez-la dans la liste. Liste ouverte : Choisissez votre ville dans la liste. | Une ville choisie dans la liste |
| 4 | Question 3 | `destination` (« Surprends-nous », « On sait déjà où aller ») ; puis `ville-destination` | Aile ; puis bec sur « Chercher n’importe quelle ville » | Vous avez une idée ? Sinon, « Surprends-nous » : Tripora proposera des destinations au groupe. | Un appui sur « Surprends-nous », ou une ville ajoutée |
| 5 | Question 4 | `quand` (les quatre façons) ; puis `dates` | Aile ; puis bec sur les champs de date | Choisissez une façon de dire quand. Plus c’est souple, moins ça coûte. Puis : Indiquez le départ et le retour. | Une façon choisie, puis des dates valides (ou un mois) |
| 6 | Question 5 | `budget-montant` | Bec | Combien par personne, tout compris ? | Un montant, ou « Le moins cher possible » |
| 7 | Question 6 | `envies` (le premier axe) | Aile | Choisissez au moins une envie. | Une envie autre que « Non merci » |
| 8 | Question 6 | `creer-le-voyage` | Aile, une fois, sans voile ni tapotement ; puis `au-revoir` | C’est tout ! Ce bouton crée le voyage ; ensuite, vous inviterez le groupe. Rien n’est créé tant que vous n’appuyez pas dessus. | « Terminer la visite » : `plumio--sort`. Ce qui est saisi reste |

Compte : huit traits de progression (étapes 1 à 8). À la bonne vitesse, une
minute environ.

**Version courte, si la visite paraît longue.** Garder les étapes 0, 1, 3, 6
et 8 (Nouveau, la ville de départ, le budget, la fin) : ce sont les seules où
l’on peut se tromper. Aux étapes 2, 4, 5 et 7, Plumio se tait : il attend près
de « Continuer » et sautille vers lui quand la réponse est valide. Regrouper le
budget et les envies demanderait de changer l’assistant, ce qui sort du
tutoriel.

### Notes d’intégration

- **Poses.** Ajouter à `PoseDeLaMascotte` : `face`, `picore-droite`,
  `picore-gauche`, `regarde-droite`, `regarde-gauche`, `sautille`, `content`.
  Les fichiers sont déjà dans `poses/` : `import.meta.glob` les trouve.
- **Gestes.** Poser la classe, puis la retirer à `animationend` (sur le `<svg>`,
  quand `event.animationName` est le dernier du geste) pour pouvoir la rejouer.
  Pour rejouer tout de suite : retirer, lire `getBoundingClientRect()`, remettre.
- **`sautille` et `content`** sont à la fois des poses et des classes : la pose
  joue son geste une fois, dès qu’elle s’affiche. La classe, elle, peut se
  poser sur n’importe quelle pose debout (`attend`, `pointer-*`).
- **`face`** contient sa vue de profil (pose `attend`, cachée). Après
  `plumio--se-tourne`, passer à la pose `vol` pour le trajet.
- **Le regard pendant la saisie.** Avec `regarde-*`, on peut ajouter
  `plumio--suit` et pousser `--plumio-regard-x` vers le curseur du champ ; pas
  au toucher, pas en mouvement réduit (même règle que le regard au pointeur).
- **Ancres.** Les étapes ciblent des attributs `data-guide`, comme la version
  1. `nouveau-voyage` existe déjà sur « Nouveau » dans `Trips.tsx` ; il faut le
  poser aussi sur « Créer un trip » de l’écran vide, puis `avec-qui`,
  `continuer`, `ville-depart`, `destination`, `ville-destination`, `quand`,
  `dates`, `budget-montant`, `envies` et `creer-le-voyage` dans
  `routes/create/`.
- **Avancer.** Lire l’état du brouillon (`stores/tripDraft.ts`) plutôt que les
  clics : `origin` rempli, `destinationIds` non vide, etc. Exception : aux
  étapes 2 et 4, la réponse est déjà valide par défaut (`groupType: 'friends'`,
  `destinationMode: 'suggest'`) ; il faut un appui réel sur une carte.
- **Mémoire.** La visite se joue une fois par compte (ou par appareil sans
  compte). « Passer », Échap et « Terminer la visite » la marquent comme vue.
  Elle se relance depuis le profil.
- **Tests utiles.** Au clavier de bout en bout sans « Suivant » ; Échap à
  chaque étape ; la bulle passe au-dessus du champ quand la liste s’ouvre ;
  rien n’est créé à la fin ; en mouvement réduit, `document.getAnimations()`
  est vide.

## 8. Intégration

- **Composants.**
  - Un composant par pose, à partir de `poses/<nom>.svg`. Garder toutes les
    classes (`plumio-*`, `p-*`) et les attributs `fill` / `stroke` : ce sont
    les couleurs de repli quand la feuille n’est pas chargée.
  - Retirer `xmlns` et donner la taille par `width` / `height`.
  - Un `id` unique par élément, si on en ajoute (aucune pose n’en a).
- **Feuille.** Importer `animations.css` une fois, en global. Elle ne dépend
  d’aucune autre feuille et n’utilise que `--accent`, avec un repli.
- **Piège.** Un groupe qui a un pivot CSS (les classes `plumio-*` de la section
  2 de la feuille) ne doit pas porter d’attribut `transform` : le pivot
  s’ajouterait à la rotation. Dans les poses, les transformations fixes sont
  sur un élément intérieur.
- **Retournement.** `pointer-gauche` est `pointer-droite` dans un groupe
  retourné. En arabe, retourner le `<svg>` entier avec `scaleX(-1)`.
- **Tests utiles.**
  - En mouvement réduit, `document.getAnimations()` est vide une fois Plumio
    affiché.
  - Le tutoriel passe au clavier de bout en bout.
  - La pose de chaque étape correspond à la position de la bulle.
- **Régénérer** après une retouche du dessin : modifier `outils/plumio.py`
  (les pièces du squelette et les poses), puis lancer ces trois commandes
  depuis la racine du dépôt :

  ```sh
  python3 design/mascotte/outils/plumio.py design/mascotte
  python3 design/mascotte/outils/planche.py design/mascotte
  python3 design/mascotte/outils/tutoriel.py design/mascotte
  python3 design/mascotte/outils/tutoriel_v2.py design/mascotte
  ```
