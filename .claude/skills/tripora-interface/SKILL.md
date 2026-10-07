---
name: tripora-interface
description: Style maison de Tripora — identité « carnet », jetons de couleur, composants ui/, typographie française, mouvement, plateformes (web, Android, iOS). À charger avant de créer ou modifier un écran, un composant ou une page publique de Tripora, et avant toute revue d'interface ; il l'emporte sur les skills génériques (web-interface-guidelines, redesign-existing-projects…).
---

# Interface de Tripora

Tripora aide un groupe d'amis à choisir une destination, s'organiser et faire ses comptes. Une seule base de code sert le web (PWA), Android et iOS (Capacitor). Ce skill décrit ce qui existe déjà : on le **prolonge**, on ne le réinvente pas écran par écran.

## 1. L'identité : un carnet de voyage

- **Papier crème, encre brune, filets, grain.** Le fond n'est pas gris mais papier (`--surface-muted`), les textes ne sont pas noirs mais encre chaude (`--text-strong`), les blocs se séparent par un **filet** (bordure `--border-subtle`) plutôt que par une ombre. Un grain SVG très léger couvre tout (`body::after`).
- **Deux voix.** *Fraunces* (romane à caractère, axe WONK) pour les grands titres uniquement : `h1`, `.titre`, `.titre-lieu` (noms de villes et de pays). *Inter Tight* pour tout le reste. Les deux sont auto-hébergées et sous-ensemblées (`/polices/`) : **ne jamais charger une police depuis un tiers** (hors-ligne, CSP).
- **Un accent, choisi par la personne.** La couleur d'accent se règle dans le profil et le thème recalcule l'échelle `brand-*` à l'exécution. Conséquence : on n'écrit jamais une couleur brute (`#1a5fb4`, `text-blue-600`) pour l'accent, on passe par `brand-*` ou `var(--accent)`.
- **Retenue.** Presque pas d'ombre (seulement ce qui flotte), pas de dégradé violet-bleu, pas de pilule partout (les boutons sont des rectangles à peine adoucis, `--radius-card`), des rayons variés (`--radius-card` 12 px, `--radius-sheet` 24 px).

## 2. Jetons et utilitaires (`apps/web/src/index.css`)

| Besoin | À utiliser |
|---|---|
| Fond de carte / de page | `.surface-raised` / `.surface`, fond de page = `--surface-muted` |
| Texte secondaire | `.text-muted` |
| Bordure, filet | `border-[color:var(--border-subtle)]`, `.filet`, `--border-fort` pour un trait appuyé |
| Accent | `bg-brand-500`, `text-brand-600 dark:text-brand-300`, `var(--accent)`, `var(--accent-contrast)` |
| Teintes d'appoint | `lagoon-*` (turquoise : réussite, choix du groupe), `gold-*` (réserve, avertissement, épingles), `ink-*`, `paper-*` |
| Étiquette de rubrique | `.etiquette` (petites capitales espacées) ou `.etiquette-filet` (étiquette + trait) — **une par rubrique au plus** |
| Chiffres en colonne | `.chiffres` (ou `<time>`) : chiffres à chasse fixe |
| Zone du pouce | `.pb-safe` |
| Apparition | `.animate-rise` (un bloc), `.animate-cascade` (une liste), `.animate-page` (écran d'arrivée) |
| Attente | `.squelette` / `ui/Squelette.tsx`, `.apparition-tardive` pour un indicateur (> 250 ms seulement) |
| Appui | `.pressable` (s'enfonce vite, se relâche doucement) |

**Nuances existantes seulement.** Tailwind 4 ne génère rien pour une nuance absente du thème, sans avertissement. Les nuances définies sont listées dans `@theme` ; `src/palette.test.ts` échoue si un écran en cite une autre. Pour une nouvelle nuance : l'ajouter à `@theme` (interpolée en OKLab entre ses voisines), jamais la contourner par une couleur brute.

**Mode sombre.** Classe `.dark` sur `<html>` (variante `dark:`), choisie par la personne ou suivie du système. Chaque couleur posée à la main a sa contrepartie `dark:`. La nuit n'est pas le jour inversé : papier brun très sombre, pas de gris bleuté.

**Contraste.** L'or est faible : texte doré en `gold-600` minimum sur le papier des cartes (4,7:1), `gold-700` sur le fond de page ; en sombre, `gold-200` à `gold-400`.

## 3. Composants (`apps/web/src/components/ui/`)

Toujours partir de ces briques avant d'écrire des classes à la main :

- `Button` — variantes `primary | secondary | ghost | danger`, tailles `sm | md | lg` (40 à 56 px de haut : cibles tactiles), `loading` (spinner + `aria-busy`), `icon`, `block`. Pour un **lien** qui a l'air d'un bouton : `<Link className={classesDeBouton({...})}>` (`ui/classesDeBouton.ts`) — un changement de page reste un lien.
- `Card` + `CardBody` — le conteneur de base (la `ref` traverse, React 19).
- `Banner` — `tone="info" | "warning" | "offline"`, filet vertical à gauche (`border-s-2`), `role="status"`.
- `EmptyState` — un écran vide explique quoi faire ; `niveauDuTitre={1}` quand il occupe la page.
- `Chip` (`aria-pressed`), `OptionCard`, `Field` + `TextInput` (16 px : pas de zoom iOS), `MoneyInput`, `NumberStepper`, `Progress`, `Squelette`.
- Pictogrammes : `lucide-react` avec `aria-hidden` quand ils accompagnent un texte ; pastilles dessinées de `components/Pastille.tsx` pour les outils du voyage.
- Visite guidée : un élément qu'elle montre porte `data-guide="…"` (liste dans `components/guide/arretsDeLaVisite.ts`). Le garder en retouchant l'écran ; un test vérifie que chaque repère existe encore.
- Cadres : `AppShell` (onglets en bas sur téléphone, barre latérale à partir de `lg`), `CadrePublic` (pages sans compte), `PageLegale`, `TitreDePage`.

## 4. Écrire en français

- **Vouvoiement**, voix active, **casse de phrase** (« Créer un voyage »). Pas de Title Case, pas de « & ».
- Guillemets « » avec espaces insécables, apostrophe ’, points de suspension …, espace insécable avant `? ! : ;`. Pour un texte long ou venu d'une donnée : `insecables()` (`lib/typographie.ts`).
- Libellés précis : « Rattacher mon compte Google », pas « Continuer ». États d'attente terminés par « … » (« Envoi… »).
- Une erreur dit ce qui s'est passé **et** quoi faire (« Google n’a pas pu être rattaché. Réessayez dans un instant. »). Pas de « Oups ».
- Vocabulaire : les clés de `i18n/textes.ts` disent « trip » ; beaucoup d'écrans disent « voyage » — suivre l'écran voisin.
- **Traductions.** Les textes les plus lus passent par `useT()` et une clé typée (`CleDeTexte`) ; le français est la référence. Tout le reste se traduit au rendu (`i18n/traductionAuRendu.ts`) : un dictionnaire par langue, `i18n/phrases-<code>.ts`, dont la clé est la phrase française ; un nouveau texte français s'ajoute à `phrases-en.ts` avec sa traduction anglaise. Les phrases en morceaux du JSX sont recollées avant la recherche, mais une phrase reste plus lisible en un seul gabarit (`` `${n} idées à ${ville}` ``). Un texte qui sort de la page (`window.confirm`, partage, notification, canvas) passe par `traduireDansLaLangueActive`. Noms et textes saisis : `translate="no"`. Ne pas traduire soi-même les autres langues : elles suivent `docs/TRADUCTIONS.md`. Jamais de phrase construite par morceaux de mots (« jour » + « s »).
- **Chiffres.** Jamais de `'fr-FR'`, de « °C » ni de « km » écrits à la main : `formatCents` (les estimations en euros se convertissent dans la devise choisie ; `sansConversion` pour une dépense réelle ou une saisie), `formatNombre`, `formatDate` / `localeActive()`, `formatTemperature`, `formatDistance`, `formatTaille` (`@tripora/core`, `regional.ts`). Les données restent en centimes d'euro, °C et km.

## 5. Honnêteté des données

- Un prix affiché porte sa source et sa date (« vu le … ») ou le mot « estimation » ; sinon « prix non disponible ». Rien n'est inventé pour « faire vrai ».
- Les liens partenaires sont marqués comme tels (`rel="sponsored"` ; sur les pages publiques, passage par `/go/…`) et ne changent jamais l'ordre d'une liste.
- Les photos viennent de Wikimedia, avec crédit. Pas d'image de banque d'images ni de `picsum`.

## 6. Mouvement

- Courbe `--ease-pose` (vive au départ, arrêt net, **sans rebond** : le papier ne rebondit pas). Durées 160 à 360 ms.
- N'animer que `transform` et `opacity` ; lister les propriétés de `transition` (jamais `all`).
- `prefers-reduced-motion` coupe tout, globalement : ne pas le contourner.
- Pas de défilement détourné, pas d'effet qui retarde la lecture.

## 7. Plateformes et accessibilité

- `estNatif` (`lib/natif.ts`) pour les écarts web / application. Le pied de page légal n'existe que sur le web ; dans l'application, ces liens sont dans Profil › À propos.
- Rien ne dépend du survol seul ; tout geste (swipe) a une alternative bouton + clavier.
- Quatorze langues dont l'arabe : `lang` et `dir` sont posés par `stores/langue.ts`. Préférer les propriétés logiques (`ms-`, `me-`, `ps-`, `pe-`, `border-s`, `start-`, `end-`).
- Focus visible global, `<dialog>` natif pour une modale, `role="alert"` pour une erreur, `role="status"` pour une information.
- CSP stricte (`public/_headers`) : aucun script tiers ni en ligne, images seulement depuis Wikimedia, Wikipédia et OpenFreeMap. Une nouvelle origine = une ligne justifiée dans `_headers`.

## 8. Avant de livrer un écran

1. Clair **et** sombre, téléphone **et** PC (`lg`), français **et** une langue RTL si le texte bouge.
2. États : chargement (squelette), vide (`EmptyState`), erreur, hors ligne (`Banner tone="offline"`).
3. `pnpm lint` (vérifier le code de sortie : `--max-warnings 0`, et `react-refresh/only-export-components` impose un module à part pour tout ce qui n'est pas un composant), `pnpm --filter @tripora/web typecheck`, `pnpm --filter @tripora/web test`.
4. Un parcours nouveau mérite un test Playwright (`apps/web/e2e/`).
5. Pour une revue plus large : `web-interface-guidelines` (règles détaillées), `accessibility`, `performance`, `seo` pour les pages publiques.
