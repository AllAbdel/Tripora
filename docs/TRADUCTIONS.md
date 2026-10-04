# Traductions — le guide

Ce guide s'adresse à qui traduit Tripora dans une nouvelle langue, humain ou
agent (GitHub Copilot, Claude…). Le terrain est prêt : **chaque texte affiché
peut être traduit sans toucher aux composants**. Une langue, c'est
essentiellement **un fichier de dictionnaire**, sur le modèle de l'anglais.

> En une phrase : copier `apps/web/src/i18n/phrases-en.ts` en
> `phrases-<code>.ts`, traduire les valeurs (jamais les clés), adapter les
> motifs, puis lister ce qui manque avec `traductions:extraire`.

## Les trois étages

1. **Les chiffres** — `packages/core/src/regional.ts`. Montants, dates,
   nombres, températures (°C, °F, K), distances (km, mi) et tailles de fichier
   s'écrivent déjà dans la langue et les unités de la personne (réglées dans
   Profil › Unités et devise). **Un traducteur ne touche jamais un chiffre** :
   dans les phrases, ils arrivent tout faits (« 1 450 € », « $1,450 »,
   « 75 °F », « 7,688 mi », « October 2 »).
2. **Les clés typées** — `apps/web/src/i18n/textes.ts`, lues par `useT()` :
   navigation, actions, écrans d'entrée. Un dictionnaire partiel par langue ;
   une clé absente affiche le français.
3. **La traduction au rendu** — `apps/web/src/i18n/traductionAuRendu.ts`
   (et son moteur sans navigateur, `moteur.ts`). Tout le reste. Une fois
   l'écran rendu, chaque texte (et les attributs `placeholder`, `aria-label`,
   `title`, `alt`) est cherché dans le dictionnaire de la langue active :
   - **`PHRASES`** : la clé est **la phrase française exacte**, telle qu'elle
     s'affiche, espaces resserrés (les espaces insécables comptent comme des
     espaces) ; la valeur, sa traduction ;
   - **`MOTIFS`** : pour les phrases qui portent un nombre ou un nom
     (« 12 jours en juillet », « Départ demain pour Bali »). Une expression
     régulière ancrée (`^…$`, drapeau `u`) qui lit le français, et un
     remplacement (texte avec `$1`, ou fonction qui peut renoncer en
     renvoyant `null`) ;
   - une phrase écrite **en morceaux** dans le JSX (`{n} idée{s} à {ville}`)
     est recollée avant la recherche : c'est la phrase entière qui est
     cherchée (« 12 idées à Bali »), et c'est elle que les outils listent ;
   - ce qui sort de la page (boîtes de confirmation, partage, rappels sur le
     téléphone, image du bilan) passe par `traduireDansLaLangueActive`, avec
     le même dictionnaire.

Rien n'est touché sous `translate="no"` (noms, messages, ce que les gens
écrivent), ni dans les champs de saisie. Le dictionnaire d'une langue n'est
téléchargé que quand elle devient active.

**Le carnet d'activités** (2 166 activités, leur nom et leur résumé) a son
propre fichier, `carnet-<code>.ts`, rangé **par identifiant d'activité**
(`"bali/batur": ["nom", "résumé"]`) : le français est déjà dans le
catalogue, inutile de le recopier. Le dictionnaire de la langue l'annonce
par `export const CARNET = () => import('./carnet-xx').then((m) =>
m.phrasesDuCarnet())` ; il est chargé juste après l'interface, ajouté sans
écraser `PHRASES`, et jamais préchargé par le service worker (il est plus
lourd que toute l'interface traduite). `carnet-en.test.ts` vérifie que
chaque activité du catalogue a sa ligne.

## Ajouter une langue, pas à pas

Les codes possibles sont ceux de `apps/web/src/i18n/langues.ts` : `es`, `it`,
`de`, `pt`, `nl`, `pl`, `tr`, `ru`, `ar`, `zh`, `ja`, `ko`.

1. **Copier le modèle.** `phrases-en.ts` → `phrases-es.ts`, dans le même
   dossier. Le fichier est trouvé et chargé tout seul : rien d'autre à
   déclarer. Il doit exporter `PHRASES` et `MOTIFS` (le test
   `dictionnaires.test.ts` le vérifie, ainsi que l'absence de valeur vide).
2. **Les pays** se traduisent seuls : remplacer `'en'` par le code dans
   `Intl.DisplayNames(['en'], { type: 'region' })` (`PAYS_EN` → `PAYS_ES`).
3. **Traduire chaque valeur de `PHRASES_FIXES`.** Ne jamais modifier une clé :
   c'est le texte français exact de l'écran ; une clé changée ne correspond
   plus à rien.
4. **Traduire les tables d'aide** (`MOIS`, `ENVIES`, `CRITERES`, `ARGUMENTS`,
   rangs…) et **les remplacements des motifs**. Les expressions régulières,
   elles, restent identiques : elles lisent le français.
5. **Lister ce qui manque** — deux outils, complémentaires :
   ```sh
   cd apps/web
   # Tout le code : chaque texte français, et s'il est déjà traduit.
   LANGUE=es pnpm traductions:extraire > /tmp/a-traduire.json
   # Ce qui s'affiche vraiment sur 31 écrans de démonstration.
   VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir dist-e2e
   LANGUE=es pnpm traductions:recolte > /tmp/phrases-manquantes.json
   ```
   Dans l'extraction, `nature: "phrase"` signale une phrase à trous
   (« {1} idées à {2} ») : elle demande un motif, et ne se vérifie qu'à
   l'écran (`traduit: null`). La récolte liste aussi des noms propres et des
   textes déjà dans la langue (`useT()`, noms de devises) : à ignorer.
6. **Compléter `textes.ts`** : le dictionnaire de la langue (`ES`…), pour
   les clés qui lui manquent.
7. **La notification des alertes de prix** : une ligne dans `TEXTES`,
   en tête de `apps/web/public/sw-alertes.js`.
8. **Vérifier**, depuis la racine :
   ```sh
   pnpm lint && pnpm -r typecheck && pnpm -r test
   pnpm --filter @tripora/web exec playwright test
   ```
9. **Committer par lots** (un écran, un dossier du carnet), messages en
   français : « i18n(es) : l'écran du budget ».

## Règles

- **Le français ne bouge pas.** On ne réécrit pas un texte français en
  traduisant : les tests de bout en bout le cherchent (`locale: 'fr-FR'`).
- **Une phrase entière par entrée.** Pas de mot isolé quand le mot fait
  partie d'une phrase : traduire « 12 idées à Bali » par un motif, pas
  « idées » et « à » séparément.
- **Les chiffres arrivent formatés.** Dans un motif, un montant, une date ou
  une distance se capture tel quel (`(.+)`) et se recopie. Certaines langues
  écrivent leurs propres chiffres : `\d` ne lit que 0-9, préférer `\p{Nd}` ou
  `(.+?)` quand un nombre peut venir d'`Intl`.
- **Ce qui ne se traduit pas** : les noms propres (personnes, marques des
  partenaires), les codes (aéroports, devises), ce qui est sous
  `translate="no"`.
- **Ton** : celui de l'interface française — chaleureux, phrases courtes,
  casse de phrase. Vocabulaire tenu dans `phrases-en.ts` : « trip » pour
  voyage, « wishes » pour envies, « vault » pour coffre ; trouver
  l'équivalent naturel dans la langue, et s'y tenir.
- **Registre : une seule forme d'adresse par langue, partout** (boutons,
  phrases, notification de `sw-alertes.js`). Le français vouvoie ; ailleurs,
  on suit l'usage des applications grand public :

  | Langue | Forme | Exemple |
  |---|---|---|
  | es | tú (jamais vosotros ni usted) | « Elige tu ciudad de salida » |
  | it | tu | « Scegli la tua città di partenza » |
  | de | du | « Wähle deine Abfahrtsstadt » |
  | pt (Portugal) | tu | « Escolhe a tua cidade de partida » |
  | nl | je | « Kies je vertrekstad » |
  | pl | ty, ou l'impersonnel | « Wybierz miasto wyjazdu » |
  | tr | sen | « Kalkış şehrini seç » |
  | ru | вы | « Выберите город отправления » |
  | ar | المخاطَب، صيغة محايدة ومهذبة | « اختر مدينة المغادرة » |
  | zh | 你 | « 选择出发城市 » |
  | ja | です・ます調 | « 出発する都市を選んでください » |
  | ko | 해요체 | « 출발 도시를 선택해요 » |
- **Pas de morceaux de phrase en clé.** Les morceaux voisins sont recollés
  avant la recherche : traduire la phrase entière que listent
  `traductions:extraire` et `traductions:recolte`, par un motif si elle
  porte un nombre ou un nom. Les seuls morceaux légitimes sont ceux qu'un
  élément sépare dans le JSX (un lien, un `<strong>`) : « Les votes
  désignent » + **Bali** + « , avec 3 personnes pour. ».
- **Un motif large se contraint.** `^(.+) doit (.+) à (.+)$` traduisait
  aussi « « Qui doit quoi » est un calcul… » en « Qui owes quoi… ». Exiger
  un chiffre, une longueur, ou passer le complément par `complement()`
  (qui renonce devant « la », « sur »…), et ajouter le cas à
  `phrases-<code>.test.ts`. Les motifs récents vont en tête de la liste.
- **Les pages légales** se traduisent comme le reste ; elles affichent hors
  du français « Ceci est une traduction : seule la version française de ce
  texte fait foi. », phrase à traduire aussi.
- **Mieux vaut le français qu'une traduction approximative.** Une entrée
  absente laisse le français ; une entrée fausse trompe.
- **Arabe** : l'interface passe de droite à gauche toute seule (`dir`) ; il
  n'y a rien à faire dans les phrases.

## Par où commencer

Dans l'ordre où les gens les lisent (les chiffres viennent de l'extraction
en anglais, octobre 2026) :

1. **L'interface** — `apps/web/src/routes`, `components`, `lib` :
   environ 1 500 textes et 300 phrases à trous.
2. **Le cœur** — `packages/core/src` hors carnet (valise, préparation du
   voyage, coffre, explications du classement, rappels…) : environ 600.
3. **Le carnet** — `packages/core/src/catalog` : environ 6 500 textes
   (titres et descriptions d'activités, infos pratiques, noms des
   destinations). Le plus gros volume : par lots, destination par
   destination.
4. **Les pages légales** (`Confidentialite`, `MentionsLegales`,
   `Conditions`) : elles engagent ; les faire relire plutôt que les traduire
   mot à mot.

## Où en est chaque langue

- **Anglais** : le modèle, complet. Toute l'interface (routes,
  composants, messages d'erreur, pages légales), le cœur (valise,
  classement, coffre, bilan…) et tout le carnet : les noms des
  destinations et les 2 166 activités (`carnet-en.ts`). La récolte ne
  trouve plus de français sur les 31 écrans de démonstration. Un test de bout en bout
  (`e2e/anglais.spec.ts`) parcourt les écrans principaux en `en-US`. Les
  pages publiques du référencement existent aussi en anglais (`/en/`).
- **Les douze autres** : quelques dizaines de clés de `textes.ts` ; rien
  encore en traduction au rendu.

## Hors de ce mécanisme

- **Les pages publiques du référencement** (`apps/web/src/seo/`) : un site
  statique généré au build, en français et en anglais (sous `/en/`, adresses
  traduites : `/en/where-to-go-in/october`). Les phrases de ces pages sont
  écrites dans `pagesPubliques.ts` même, une branche par langue ; les
  libellés du cœur (envies, catégories, transports, rubriques de liens) et
  les noms des pays passent par le dictionnaire de l'application, le carnet
  par `carnet-en.ts`. Ajouter une langue à ces pages, c'est ajouter une
  branche et des adresses : un chantier à part, à faire seulement pour une
  langue dont le carnet est traduit. Un test (`pagesPubliques.test.ts`)
  vérifie qu'aucune page anglaise ne garde de français hors des noms
  propres. L'accueil, lui, fait partie de l'application : `/?langue=en`
  l'ouvre dans une langue précise, et le plan du site annonce cette
  adresse. Les robots des moteurs lisent le français à l'adresse nue,
  quelle que soit la langue de leur navigateur (`estUnRobot`,
  `stores/langue.ts`).
- **Ce que le cœur envoie à l'IA** (`packages/core/src/ai/`) : en français
  par construction.
- **Les listes de mots des lecteurs** de tickets et d'e-mails de
  réservation : ce sont des motifs de lecture, pas des textes affichés.
