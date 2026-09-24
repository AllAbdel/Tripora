# Traductions — guide de passation

Ce guide s'adresse à qui reprend la traduction de Tripora, humain ou IA. Il
dit où en est le multilingue, comment il marche, et comment y travailler sans
casser les tests ni gêner le reste du développement, qui continue en parallèle.

## Où en est-on

- **14 langues** déclarées : fr, en, es, it, de, pt, nl, pl, tr, ru, ar, zh,
  ja, ko (`apps/web/src/i18n/langues.ts`). La langue suit celle du système,
  réglable dans le profil ; l'arabe s'affiche de droite à gauche.
- **Une cinquantaine de clés** seulement (`apps/web/src/i18n/textes.ts`) :
  navigation, actions courantes, écrans d'entrée, états vides, trips ouverts.
- **Presque tout le reste est écrit en français en dur** dans les composants :
  environ 35 écrans de `apps/web/src/routes/` n'appellent pas `useT()`, ni la
  plupart des composants de `apps/web/src/components/`.
- Des **phrases destinées à l'écran sortent aussi de `packages/core`** :
  messages de validation (`problemeDeLInfo`, `problemeDuFichier`,
  `problemeDuSondage`…), phrases toutes faites (`phraseDesEnvies`,
  `periodeLisible`, `decalageLisible`, `phraseDeReservation`…).
- Le **carnet d'activités** (`packages/core/src/catalog/`, ~1 300 textes) et
  les **infos pratiques des pays** sont en français. Leur traduction est un
  chantier à part, à décider plus tard : ne pas s'y lancer sans en parler.

## Comment ça marche

```ts
import { useT } from '@/i18n/useT';

const t = useT();
<h1>{t('trips.titre')}</h1>
```

- `FR` dans `textes.ts` est **la référence** : il définit toutes les clés (le
  type `CleDeTexte` les énumère). Les autres langues sont des dictionnaires
  **partiels** ; une clé absente affiche le français (`traduire`).
- `useEtiquetteIntl()` donne l'étiquette à passer à `Intl` pour les dates et
  les nombres, dans la langue choisie.
- Pas de bibliothèque : ni interpolation, ni pluriels pour l'instant. Il
  faudra les ajouter pour traduire les écrans profonds (« 3 idées à
  glisser », « Départ dans 12 jours »). Recommandation : des jetons nommés
  (`'Départ dans {n} jours'`) et `Intl.PluralRules` dans `traduire`, sans
  dépendance (le poids du paquet principal est surveillé).

## Règles d'écriture

Elles sont déjà en tête de `textes.ts` et `langues.ts` ; les principales :

- **Pas de phrase construite par morceaux.** « Il reste {n} places » se
  traduit ; « Il reste » + n + « places » ne se traduit pas.
- **« trip », pas « voyage »** dans les textes traduits (règle voulue par le
  porteur du projet ; l'interface française dit encore souvent « voyage »,
  ne pas la réécrire sans lui demander).
- Le nom d'une langue s'écrit dans cette langue (« Deutsch »).
- Mieux vaut peu de phrases justes que beaucoup de phrases approximatives.

## Travailler sans rien casser

1. **Ne pas changer le texte français en l'extrayant.** Les tests de bout en
   bout (`apps/web/e2e/`, Playwright, `locale: 'fr-FR'`) trouvent les boutons
   et les titres par leur texte français. Une clé dont la valeur FR est
   identique à l'ancien texte en dur ne casse rien.
2. **Ne pas toucher à la logique.** Une traduction ne change que des chaînes.
3. **Un écran par commit**, messages de commit **en français**.
4. Avant chaque envoi, depuis la racine :
   ```sh
   pnpm lint && pnpm -r typecheck && pnpm -r test
   pnpm --filter @tripora/web exec playwright test
   ```
   (`textes.test.ts` vérifie que chaque dictionnaire ne contient que des clés
   connues.)
5. **Le développement continue en parallèle** : de nouveaux écrans arrivent,
   écrits directement en français. Pour limiter les conflits, travailler sur
   sa propre branche, se remettre souvent à jour sur la branche principale de
   développement, et commencer par les écrans qui ne bougent plus (voir
   `git log -- apps/web/src/routes/<Ecran>.tsx`).

## Par où commencer

Les écrans les plus vus d'abord :

1. `routes/TripDetail.tsx` et `components/OutilsDuVoyage.tsx` (l'accueil d'un
   trip et sa grille) ;
2. `components/LeVoyageAuPresent.tsx` (compte à rebours, jour du séjour) ;
3. `routes/Decouvrir.tsx`, `routes/AFaire.tsx`, `routes/TripItinerary.tsx` ;
4. `routes/TripBudget.tsx` (dépenses, qui doit quoi) ;
5. `routes/TripCoffre.tsx`, `routes/TripTaches.tsx`, `routes/TripSondages.tsx` ;
6. les messages de `packages/core` (faire renvoyer une clé ou un code plutôt
   qu'une phrase, puis traduire côté application).
