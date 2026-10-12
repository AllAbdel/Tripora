# Plumio v3 : compte-rendu pour l’intégration

Branche : `claude/bold-allen-m8ssbe` (partie de `main`). Seul `design/mascotte/` change ; rien dans `apps/`.

## Ce qui a changé

- **Le dessin.** Plumio est redessiné de zéro, sous les mêmes 23 noms de poses :
  - une vraie hirondelle, au corps fin et aux ailes en faux, avec deux longs filets de queue en fourche ;
  - un style de gravure : plus aucun contour noir, des tailles de papier entre les masses d’encre ;
  - des jointures cachées par construction ;
  - une vue de trois-quarts pour l’accueil (`face.svg`).

  Détails : `NOTES.md`, § 1, « Le dessin, version 3 ».
- **Le mouvement.** `animations.css` est réécrite pour un mouvement d’oiseau :
  - coups de tête secs et arrêts ;
  - sauts avec anticipation et réception ;
  - queue qui claque, filets et pans du foulard en retard ;
  - battement d’ailes par dessins de remplacement.

  Rien d’autre que `transform` et `opacity` n’est animé ; tout s’arrête en mouvement réduit.
- **L’outillage.** Le générateur a été réécrit : `outils/plumio.py` s’appuie sur le nouveau `outils/geo.py`. `planche.html` et les maquettes `tutoriel/` et `tutoriel-v2/` sont régénérées avec le nouveau dessin.

## Ce que l’application doit faire

**Aucun changement de code n’est nécessaire.** `Mascotte.tsx` lit déjà `design/mascotte/animations.css` et `design/mascotte/poses/*.svg`. Les éléments suivants sont gardés à l’identique :

- les 23 fichiers et le `viewBox` 96 × 96 ;
- la classe racine `plumio plumio--<pose>` ;
- les noms des groupes animés (`plumio-tete`, `plumio-aile`, `plumio-bec-bas`, `plumio-pupille`, `plumio-paupiere`, `plumio-souffle`, `plumio-pan`, `plumio-queue`, `plumio-encre`…) ;
- toutes les classes que l’application pose : `--calme`, `--vie`, `--joue`, `--atterrit`, `--sort`, `--suit`, `--petit`, `--arrive`, `--salue`, `--parle`, `--se-tourne`, `--tapote`, `--picore`, `--sautille`, `--content`, plus `--geste-*`, `--mono`, `--sombre` et `--immobile` ;
- les variables `--plumio-regard-x/y` et `--plumio-parle-fois` ;
- toutes les durées, ce qui laisse `DUREE_DU_GESTE` juste : arrive 1 100, salue 1 200, parle 1 100, se-tourne 520, tapote 700, picore 900, sautille 420 et content 640 ms ; au-revoir 1 100 puis sort 600 ; atterrit 360 ;
- le foulard en `currentColor`, le mode sombre sous `.dark` et la version 24 px via `plumio--petit` ;
- la vue de profil cachée dans `face.svg`, qui sert au demi-tour.

Un contrôle automatique a vérifié ces points sur les 23 poses : fichiers, classe racine, groupes requis, aucun `transform` sur un groupe animé, poids, classes, variables et mouvement réduit.

## À vérifier dans l’application

1. Lancer `pnpm lint`, `pnpm --filter @tripora/web typecheck`, `pnpm --filter @tripora/web test` et les e2e (`accueil-public`, plus les tests d’accessibilité qui mesurent l’accueil et la visite une fois les fondus finis).
2. Faire un passage visuel, en clair et en sombre, sur téléphone et sur ordinateur, sur les écrans suivants :
   - l’accueil (arrivée, coucou, parole, demi-tour) ;
   - la visite (aile qui tapote, bec qui picore, bulle repliée) ;
   - les écrans vides avec `vie="vie"` (Trips, Sondages, Réservations) ;
   - la page 404 et le filet de sécurité (`oups`) ;
   - le bilan (`celebre`) ;
   - les notifications (`notification`, 48 px).
3. Le poids a doublé :
   - les poses passent de 61 Ko à 124 Ko bruts, soit environ 9 Ko en gzip, et sont importées en `eager` ;
   - la feuille passe de 39 Ko à 59 Ko bruts.

   Si le paquet initial compte, charger les poses à la demande (`import.meta.glob` sans `eager`).

## Facultatif

- **`--plumio-fond`** : la couleur de la surface derrière l’oiseau, que prennent les tailles de gravure. Sans elle, elles prennent le papier en clair et l’encre de nuit en sombre, ce qui suffit, car elles restent dans la silhouette. Elle ne sert qu’à rendre le tampon `plumio--mono` exact sur un fond coloré.
- **Nouveaux groupes** : `plumio-buste` (pencher depuis la hanche), `plumio-filet-haut` et `plumio-filet-bas` (les deux filets de la queue), `plumio-aile-battue` (aile basse en vol), `plumio-oeil-content` (œil fermé souriant). Ils s’ajoutent aux anciens et n’en remplacent aucun.

## Limites connues

- `face.svg` pèse 7 Ko, au-dessus de la cible de 6 Ko, parce qu’il contient aussi la vue de profil du demi-tour.
- En arabe, l’oiseau doit toujours être retourné en entier (`scaleX(-1)` sur le `<svg>`), comme avant.
