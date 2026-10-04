# Skills du projet

Des consignes que Claude Code charge d'elles-mêmes quand la tâche s'y prête (créer un écran, auditer l'accessibilité, travailler le référencement…). Elles voyagent avec le dépôt : toute session sur Tripora en profite, sans rien installer.

| Skill | Sert à | Origine | Licence |
|---|---|---|---|
| `tripora-interface` | Le style maison : identité « carnet », jetons, composants `ui/`, français, mouvement, plateformes. **Prime sur les autres.** | Écrit pour Tripora | — |
| `web-interface-guidelines` | Revue d'écran règle par règle (accessibilité, formulaires, animation, typographie, performance…), sortie `fichier:ligne` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) + [web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | MIT |
| `react-best-practices` | 70 règles de performance React classées par impact (référence rapide) | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | MIT |
| `redesign-existing-projects` | Audit « ce qui fait générique » et plan de polissage sans tout réécrire | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT |
| `accessibility` | WCAG 2.2, méthode d'audit, liste de contrôle | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | MIT |
| `seo` | Référencement technique et éditorial, données structurées | idem | MIT |
| `performance` | Budget, chemin critique, images, polices, cache | idem | MIT |
| `core-web-vitals` | LCP, INP, CLS : mesurer puis corriger | idem | MIT |

Chaque copie garde en tête un bandeau (source, date, modifications) et son fichier `LICENSE`. Les modifications se limitent à : liens relatifs vers des fichiers non copiés redirigés vers le dépôt d'origine, règles de Vercel lues en local au lieu d'être téléchargées, et une section **« Adaptation Tripora »** ajoutée à la fin de chaque skill — elle dit ce qui ne s'applique pas ici (Next.js, SSR, Title Case…) et ce qui existe déjà.

## Ce qui n'est pas copié ici, volontairement

- **frontend-design** (Anthropic) : le meilleur skill de direction artistique, mais sous « © Anthropic PBC. All rights reserved » — il ne se redistribue pas. Il s'installe comme plugin Claude Code (`frontend-design`, marketplace officielle).
- **UI/UX Pro Max** : une base de données CSV et des scripts Python, lourds pour ce qu'ils apportent à un projet qui a déjà son identité.
- **taste-skill** (le skill principal) : pensé pour créer des pages d'atterrissage de zéro ; `redesign-existing-projects`, du même auteur, correspond mieux à un projet existant.

## Mettre à jour

Refaire la copie depuis la source, relire le texte en entier (on ne publie pas ce qu'on n'a pas lu), reporter la section « Adaptation Tripora » et la date du bandeau.
