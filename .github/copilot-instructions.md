# Instructions pour GitHub Copilot

Tripora est une application de voyage en groupe (React + TypeScript, Vite,
Supabase ; web, Android et iOS par Capacitor). Monorepo pnpm :
`apps/web` (l'application), `packages/core` (la logique, sans navigateur).

## Langue du projet

- Le code, les commentaires, les messages de commit et les descriptions de
  pull request sont **en français**.
- **Le français est la langue source de l'interface**, écrite en dur dans les
  composants. Ne jamais la réécrire, la déplacer ni la remplacer par des clés
  pour traduire : les traductions se posent par-dessus.

## Pour une tâche de traduction

Lire d'abord **`docs/TRADUCTIONS.md`** : il décrit le mécanisme et la marche
à suivre, pas à pas. L'essentiel :

- Une langue = un fichier `apps/web/src/i18n/phrases-<code>.ts`, sur le modèle
  exact de `phrases-en.ts` (exports `PHRASES` et `MOTIFS`). Il est chargé
  automatiquement.
- Les clés de `PHRASES` sont les phrases françaises exactes : on traduit les
  valeurs, jamais les clés. Les motifs gardent leurs expressions régulières
  (elles lisent le français) ; seuls les remplacements se traduisent.
- Les montants, dates, températures et distances arrivent déjà formatés dans
  la langue et les unités de la personne (`packages/core/src/regional.ts`) :
  ne pas les traduire, les capturer tels quels.
- Lister le travail : `LANGUE=<code> pnpm --filter @tripora/web traductions:extraire`
  (tout le code) et `traductions:recolte` (ce qui s'affiche réellement).
- Compléter aussi le dictionnaire de la langue dans `apps/web/src/i18n/textes.ts`
  et sa ligne dans `apps/web/public/sw-alertes.js`.
- Mieux vaut laisser une phrase en français que la traduire approximativement.

## Avant de proposer un changement

Depuis la racine :

```sh
pnpm lint && pnpm -r typecheck && pnpm -r test
pnpm --filter @tripora/web exec playwright test
```

`--max-warnings 0` : un avertissement de lint fait échouer. Les tests de bout
en bout cherchent les textes français : un texte français modifié les casse.

## À ne pas faire

- Ne pas ajouter de dépendance payante ni de service qui demande une carte
  bancaire : Tripora fonctionne à 0 €.
- Ne pas committer de secret : seules des valeurs publiques vivent dans
  `apps/web/.env`.
- Ne pas modifier les pages légales sans relecture humaine.
