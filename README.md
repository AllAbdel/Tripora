<div align="center">
  <img src="apps/web/public/icons/icon-192.png" width="96" alt="" />
  <h1>Tripora</h1>
  <p><strong>Organiser un voyage à plusieurs sans 15 conversations WhatsApp, 40 onglets et trois tableurs.</strong></p>
</div>

---

Vous dites à Tripora avec qui vous partez, d'où, quand, pour combien et ce dont
vous avez envie. Tripora aide le groupe à choisir une destination, puis à
construire le voyage : itinéraire, carte, budget, dépenses.

```
« On aimerait partir 5 jours quelque part en Europe à 4, le moins cher possible. »
                                   ↓
« Voici 5 destinations qui collent à vos goûts et à vos budgets, avec le coût
  total de chacune, l'option qui met tout le monde d'accord, et pourquoi. »
```

## Le principe, en quatre lignes

```
Les APIs fournissent les faits.     (prix relevés, météo, lieux, taux de change)
Le code calcule.                    (coût total, scores, compromis, remboursements)
L'IA interprète et explique.        (langage naturel, rédaction, adaptation)
Le groupe décide.                   (vote)
```

L'IA n'est jamais une source de vérité pour un prix, une durée ou une météo.
Un prix affiché est toujours dans l'un de ces trois états, jamais autre chose :

| État | Ce que ça veut dire |
|---|---|
| **Prix vu le 5 sept. (Aviasales)** | Relevé sur une source réelle, il y a moins de 72 h |
| **Prix indicatif** | Estimation calculée par Tripora |
| **Prix non disponible** | Aucune donnée exploitable, et on le dit |

## Ce qui rend Tripora différent

- **Optimisé pour le groupe, pas pour celui qui crée le voyage.** Le score
  combine 60 % de la satisfaction moyenne et 40 % de celle de la personne la
  moins servie. Une destination qui ravit trois amis sur quatre perd contre le
  compromis qui convient à tous.
- **Le coût total, pas le prix du billet.** Un vol plus cher vers une ville bon
  marché sort souvent gagnant, et Tripora le montre.
- **Explicable.** « Budapest 86/100 : tient dans le budget, fête 9/10,
  gastronomie 8/10, 3 h de trajet » plutôt que « l'IA préfère Budapest ».
- **Le budget contraignant est celui de la personne qui peut mettre le moins**,
  affiché comme tel.
- **Gratuit pour de bon.** Aucun moyen de paiement n'est enregistré nulle part :
  à la limite d'un quota gratuit, la fonction concernée se met en pause avec un
  message clair, et le reste continue de tourner. Une facture est impossible.
- **Privé.** Aucun nom, aucune adresse électronique, aucune position n'est
  transmis à un service d'intelligence artificielle.

## Application web, pas APK

Tripora est une **PWA** : une application web installable. Un seul code, une
seule URL, et elle s'installe sur iPhone, Android, Mac, Windows et Linux, avec
icône, plein écran, fonctionnement hors ligne et notifications. Un APK aurait
laissé de côté les amis sous iPhone et tout usage sur ordinateur.
[Le détail du choix](docs/ARCHITECTURE.md#pwa-plutôt-quapk).

## Démarrer

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Sans configuration, l'application démarre en **mode local** : l'interface est
explorable, mais rien n'est partagé. Pour activer la collaboration, suivez le
[guide de mise en place](docs/SETUP.md) — cinq comptes gratuits, aucune carte
bancaire, une vingtaine de minutes.

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm check` | Lint, types, tests et build : tout ce que vérifie l'intégration continue |
| `pnpm test` | Tests unitaires et d'interface |
| `./supabase/tests/run.sh` | Rejoue le schéma sur un Postgres local et teste les politiques RLS |
| `pnpm --filter @tripora/web icons` | Régénère le jeu d'icônes PWA |

## Organisation du dépôt

```
apps/web/          Application PWA (React, TypeScript, Tailwind, MapLibre)
packages/core/     Logique métier pure : coût, scoring, argent, schémas — testée
supabase/          Schéma SQL, politiques RLS, Edge Functions, tests hors ligne
docs/              Architecture, APIs, mise en place
```

`packages/core` est importé à la fois par l'application et par les fonctions
serveur : le calcul affiché est exactement celui qui est enregistré.

## Documentation

- [Tester l'application pas à pas](docs/TESTER.md)
- [Architecture et décisions techniques](docs/ARCHITECTURE.md)
- [Sources de données et quotas gratuits](docs/APIS.md)
- [Mise en place, comptes et clés](docs/SETUP.md)
- [Feuille de route](docs/ROADMAP.md)

## Licence et inspiration

Projet personnel. Tripora s'inspire des idées fonctionnelles d'applications de
voyage en groupe comme Palima, sans reprendre ni leur code, ni leurs textes,
ni leur identité visuelle.
