---
name: web-interface-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

> **Copie vendorisée** de [vercel-labs/agent-skills › web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) (licence MIT déclarée par le dépôt) ; les règles `regles.md` viennent de [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) (MIT, © 2025 Vercel Labs, voir `LICENSE`).
> Récupérées le 27/09/2026. Modifications : nom aligné sur le dossier ; règles lues dans la copie locale au lieu d'être téléchargées ; section « Adaptation Tripora » ajoutée.
> En cas de conflit, la section « Adaptation Tripora » et le skill `tripora-interface` l'emportent.


# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the rules in `regles.md` (local copy of the source below — no network needed)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in `regles.md`
4. Output findings in the terse `file:line` format

## Guidelines Source

`regles.md` is a copy of this file, taken on 27/09/2026. Refresh it from the source when the rules look stale:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

`regles.md` contains all the rules and the output format instructions.

## Usage

When a user provides a file or pattern argument:
1. Read `regles.md`
2. Read the specified files
3. Apply all rules from `regles.md`, then the « Adaptation Tripora » overrides below
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.

## Adaptation Tripora

Ces règles priment sur `regles.md` quand elles le contredisent. Le détail du style maison est dans le skill `tripora-interface`.

- **Langue et ton.** L'interface est en français. On vouvoie (« Rattachez-le à Google »), on écrit en **casse de phrase** (« Créer un voyage », jamais « Créer Un Voyage ») : la règle *Title Case* ne s'applique pas. Pas de « & » à la place de « et ».
- **Typographie française.** Guillemets « » avec espaces insécables, apostrophe typographique ’, points de suspension … . Les espaces insécables avant `? ! : ;` et à l'intérieur des guillemets passent par `insecables()` (`apps/web/src/lib/typographie.ts`) pour les textes longs. La règle des guillemets anglais “ ” est remplacée par celle-ci.
- **Hydratation.** L'application est une SPA Vite sans rendu serveur : la section *Hydration Safety* ne concerne pas les écrans React. Les pages publiques (carnet, « Où partir en <mois> ? ») sont du HTML statique généré par `apps/web/scripts/generer-pages-publiques.ts`.
- **État dans l'adresse.** Pas de `nuqs` : on passe par `useSearchParams` de React Router 7 quand un filtre ou un onglet mérite un lien partageable.
- **Dates et nombres.** `Intl.*` avec l'étiquette de `useEtiquetteIntl()` (elle suit la langue choisie dans Tripora, pas celle du système).
- **Mots propres à l'app.** Noms de marque, codes d'invitation, codes IATA : `translate="no"`.
- **Plateformes.** Le même code tourne sur le web, Android et iOS (Capacitor) : aucune action ne dépend du survol seul, et les zones sûres (`env(safe-area-inset-*)`, `.pb-safe`) sont déjà gérées par `AppShell`.
- **Sens de lecture.** Quatorze langues, dont l'arabe (RTL) : préférer les propriétés logiques (`ms-`, `me-`, `ps-`, `pe-`, `border-s`, `start-`, `end-`) à `ml-`/`mr-`/`left-`/`right-`.
