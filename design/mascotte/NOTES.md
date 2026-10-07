# Plumio — notes de design

La mascotte de Tripora : une hirondelle dessinée à l’encre, foulard à la couleur
d’accent. Ce dossier contient tout ce qu’il faut pour l’intégrer ; rien n’est
encore branché dans `apps/`.

| Fichier | Contenu |
|---|---|
| `poses/<nom>.svg` | Seize poses, `viewBox` 96 × 96, de 2 à 2,8 Ko chacune |
| `animations.css` | Couleurs (clair, sombre, une couleur), pivots, regard, gestes, vie au repos, passages de page, mouvement réduit |
| `planche.html` | Toutes les poses, en clair et en sombre, à 24, 48, 96 et 160 px. Gestes jouables au survol, case « Mouvement réduit », choix d’accent |
| `tutoriel/index.html` | Les six étapes, téléphone et ordinateur, en clair, en sombre et en arabe |
| `outils/` | Les scripts qui produisent les trois éléments ci-dessus |

Les deux pages s’ouvrent directement dans un navigateur, sans serveur ni
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
| Tutoriel, téléphone | 64 px | |
| Tutoriel, ordinateur | 80 px | |
| Écran vide, erreur, succès | 120 à 160 px | |

- Minimum : 24 px. En dessous de 40 px, `plumio--petit` retire les lignes des
  plumes et les points de « réfléchit ».
- Le dessin déborde un peu de son cadre quand il saute ou fait un pas
  (`overflow: visible`). Il faut prévoir 8 px d’air autour.

## 4. Où le mettre, où ne pas le mettre

**Oui, une fois par écran au plus :**

| Situation | Pose | Taille |
|---|---|---|
| Tutoriel du premier lancement | `pointer-*`, puis `au-revoir` sur « Terminer » | 64 / 80 px |
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

## 6. Le tutoriel

Les maquettes sont dans `tutoriel/index.html`. Les règles :

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

## 7. Intégration

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
  ```
