# Architecture et décisions

Ce document explique **pourquoi** Tripora est construit ainsi. Les décisions y
sont formulées comme des choix assumés, avec ce qui a été écarté et pour quelle
raison. Les quotas et les sources de données ont leur propre page :
[APIS.md](APIS.md).

## Sommaire

1. [Le problème](#le-problème)
2. [Le principe fondateur](#le-principe-fondateur)
3. [PWA plutôt qu'APK](#pwa-plutôt-quapk)
4. [Front](#front)
5. [Backend](#backend)
6. [Authentification](#authentification)
7. [Modèle de données](#modèle-de-données)
8. [Le moteur de scoring](#le-moteur-de-scoring)
9. [Le rôle de l'IA](#le-rôle-de-lia)
10. [Circulation des données](#circulation-des-données)
11. [Hors ligne et synchronisation](#hors-ligne-et-synchronisation)
12. [Sécurité et confidentialité](#sécurité-et-confidentialité)
13. [Interface](#interface)
14. [Difficulté par chantier](#difficulté-par-chantier)

---

## Le problème

Organiser un voyage à plusieurs échoue toujours au même endroit : chacun a un
budget, des envies, des disponibilités et des idées différentes, personne ne
tranche, et le coût réel n'est jamais comparé — on regarde le prix du billet
d'avion, pas celui du voyage.

Tripora transforme ce chaos en une décision commune argumentée.

## Le principe fondateur

```
Les APIs fournissent les faits.
Le code calcule.
L'IA interprète et explique.
L'utilisateur décide.
```

Cette séparation est visible dans l'arborescence :

| Couche | Où | Peut-elle inventer un prix ? |
|---|---|---|
| Faits | `supabase/functions/*` (appels externes, cache, quotas) | Non, elle relève |
| Calcul | `packages/core` (pur, testé, déterministe) | Non, elle additionne |
| Interprétation | Client IA dans les Edge Functions | **Elle n'y a pas accès** |
| Décision | Votes dans l'application | — |

`packages/core` n'a **aucune dépendance réseau**. Il est importé par
l'application web et par les fonctions serveur, ce qui garantit que le montant
affiché à l'écran est exactement celui qui est enregistré en base.

## PWA plutôt qu'APK

| Critère | APK Android natif | PWA |
|---|---|---|
| iPhone des amis | Impossible sans compte Apple à 99 $/an | Safari → « Sur l'écran d'accueil » |
| Android | Installation manuelle du fichier | Chrome → « Installer » |
| Mac, Windows, Linux | Non | Oui |
| Mises à jour | Renvoyer un fichier à chacun | Instantanées, une URL |
| Hors ligne | Oui | Oui (Service Worker + IndexedDB) |
| Notifications | Oui | Oui, y compris iOS ≥ 16.4 une fois installée |
| Coût | 0 €, ou 25 $ pour le Play Store | 0 € |

**Décision : PWA.** La seule raison d'un APK serait un accès matériel poussé,
dont Tripora n'a pas besoin. Capacitor pourra emballer le même code en APK plus
tard, sans réécriture, si l'envie d'une icône dans le tiroir se fait sentir.

**Écartés :** Kotlin/Compose (exclut les iPhone et tout usage sur ordinateur) ;
Flutter et React Native (leur sortie web est un objectif secondaire, et iOS
reste payant à distribuer).

## Front

| Choix | Pourquoi | Écarté |
|---|---|---|
| **React 19 + TypeScript + Vite** | Écosystème le plus riche pour cartes, interface et PWA ; typage partagé avec le reste du dépôt | Next.js : le rendu serveur n'apporte rien ici et contraint l'hébergement |
| **Tailwind CSS 4** | Design cohérent sans feuille de style qui dérive ; jetons de couleur centralisés | Material UI, Ant : allure de logiciel administratif |
| **React Router 7** | Navigation par écrans, standard | — |
| **TanStack Query** | Cache, réessais, états de chargement ; évite de relancer une requête au moindre retour sur l'onglet, donc de consommer du quota | — |
| **Zustand** | État du formulaire de création et du thème, sans cérémonie | Redux : disproportionné |
| **Zod** | Un schéma sert à la fois au formulaire, au serveur et à la validation des sorties de l'IA | — |
| **MapLibre GL + OpenFreeMap** | Vectoriel, gratuit, sans clé | Google Maps, Mapbox : carte bancaire |
| **Dexie + Workbox** | Lecture hors ligne et file d'attente d'écritures | — |

## Backend

**Supabase**, et un seul service pour tout : Postgres, autorisations par ligne,
temps réel, comptes, fonctions serveur, tâches planifiées. Gratuit, sans carte.

Le temps réel n'est pas un luxe ici : quand Thomas vote pendant qu'Abdel modifie
une activité, tout le monde doit voir la même chose. Une base relationnelle non
plus : votes, parts de dépenses et remboursements sont des jointures, pas des
documents.

**Écartés :**

- **Firebase (offre Spark)** : les fonctions serveur exigent le plan Blaze, donc
  une carte bancaire. Sans elles, impossible d'appeler une API avec une clé
  secrète. Et modéliser des votes et des dettes en NoSQL est pénible.
- **PocketBase auto-hébergé** : demande un serveur à maintenir et à surveiller.
- **Backend sur mesure** : plus de code à écrire et à sécuriser, pour aucun gain
  à cette échelle.
- **Cloudflare Workers** : gardé en réserve (100 000 requêtes par jour, sans
  carte) si les fonctions Supabase venaient à saturer.

Les limites du plan gratuit, et ce qu'on fait pour chacune :

| Limite | Parade |
|---|---|
| Mise en pause après 7 jours sans requête | Réveil automatique par GitHub Actions tous les 3 jours |
| Courriels plafonnés à 2 par heure | Connexion Google et invitation par code, pas de lien par courriel |
| 2 projets gratuits | Un seul projet suffit |
| 2 s de processeur par fonction, 150 s au total | Le temps d'attente réseau ne compte pas ; le scoring reste léger (au plus 25 destinations) |

## Authentification

Aucun mot de passe, nulle part. C'est la principale source de friction et de
fuite, pour un bénéfice nul entre amis.

1. **Google** — un bouton, gratuit, illimité.
2. **Compte invité** — pour rejoindre un voyage par lien sans rien créer.
   Rattachable à Google plus tard sans perdre ses données.
3. **Mode local** — tant qu'aucun serveur n'est configuré, pour que
   l'application reste explorable au lieu d'afficher une erreur.

Rejoindre un voyage passe obligatoirement par la fonction
`join_trip_with_code`, qui vérifie le code, son expiration et son nombre
d'usages. Aucun client ne peut s'ajouter à un voyage en insérant une ligne.

## Modèle de données

Un **voyage** a des **membres**. Chaque membre dépose ses **préférences** et son
budget. Le voyage engendre des **propositions** (une par destination candidate)
qui reçoivent des **votes**. La destination retenue alimente un **itinéraire**
(journées → activités → lieux). **Transport**, **hébergement** et **dépenses**
se rattachent au voyage. Les tables techniques (cache, quotas) n'ont aucun lien
métier et sont invisibles aux clients.

Trois choix de modélisation qui comptent :

- **Tout montant est un entier de centimes.** Aucun flottant ne touche à
  l'argent : `0.1 + 0.2 ≠ 0.3`, et un centime d'écart sur un partage entre amis
  se voit tout de suite.
- **Le taux de change est figé sur chaque dépense.** Une dépense passée ne doit
  jamais changer de montant parce que l'euro a bougé.
- **Les positions dans l'itinéraire sont fractionnaires.** Déplacer une activité
  n'écrit qu'une ligne, ce qui évite les conflits quand deux personnes
  réorganisent la même journée en même temps.

Le schéma complet et commenté : `supabase/migrations/0001_init.sql`.

## Le moteur de scoring

Six facteurs, pondérés, chacun produisant une phrase en français :

| Facteur | Poids | Ce qu'il mesure |
|---|---|---|
| Budget | 35 % | Coût **total** face au budget le plus serré du groupe |
| Envies du groupe | 30 % | 60 % de la satisfaction moyenne + 40 % de la plus basse |
| Météo de saison | 10 % | Normales climatiques du mois visé |
| Trajet | 10 % | Durée porte à porte estimée |
| Activités | 10 % | De quoi remplir la durée du séjour |
| Équité | 5 % | Écart entre le mieux et le moins bien servi |

La règle des 60/40 est le cœur de la promesse. Avec une simple moyenne, une
destination qui ravit trois amis sur quatre l'emporterait sur le compromis qui
convient à tous. Ce cas précis est testé
(`packages/core/src/scoring.test.ts`).

Le budget contraignant est **le plus bas du groupe**, jamais celui du créateur,
et il est affiché comme tel.

Le coût comparé est celui du voyage entier — transport, hébergement,
nourriture, activités, transport sur place, divers — et non celui du billet.
Un vol plus cher vers une ville bon marché sort souvent gagnant : c'est
également testé.

## Le rôle de l'IA

| Elle fait | Elle ne fait jamais |
|---|---|
| Transformer une phrase libre en contraintes structurées | Inventer un prix, une durée, une météo |
| Rédiger l'explication d'un score déjà calculé | Décider à la place du groupe |
| Proposer un compromis quand les envies divergent | Écrire en base sans passer par un outil validé |
| Commenter et ajuster un itinéraire construit par le code | Recevoir un nom, une adresse, une position |

Elle travaille par appels d'outils, pas par génération de texte libre :
`parseTripRequest`, `listCandidateDestinations`, `getFlightPriceEstimates`,
`getClimate`, `searchPlaces`, `estimateTripCost`, `scoreDestinations`,
`buildItinerary`, `replaceActivity`, `convertCurrency`.

Garde-fous : sortie validée par Zod (une relance, puis fournisseur suivant, puis
mode dégradé sans IA) ; température basse ; cache indexé sur l'empreinte des
entrées ; plafond de 40 appels par personne et par jour ; anonymisation
systématique.

## Circulation des données

```
Application PWA
   ├── directement vers Postgres (PostgREST + temps réel, filtré par RLS)
   │     voyages, membres, préférences, votes, itinéraire, dépenses
   │
   └── vers les Edge Functions
         tout ce qui touche un secret, un quota ou l'IA
         → Mistral · Travelpayouts · Open-Meteo · Geoapify · Overpass · Frankfurter
```

Le client parle directement à la base pour tout ce qui lui appartient : c'est
plus rapide, moins de code, et la RLS garantit qu'il ne voit que ses voyages.
Les fonctions serveur n'existent que là où elles sont indispensables.

Chaque appel externe est enveloppé : `withCache(withQuota(appel))`. En cas
d'échec, on descend l'escalier — cache frais, cache périmé, estimation
étiquetée, « non disponible » — sans jamais inventer.

## Hors ligne et synchronisation

Réaliste, et donc limité à ce qui sert vraiment en voyage :

| Disponible hors ligne | Pas hors ligne |
|---|---|
| Itinéraire complet, lieux, adresses | Nouvelles propositions |
| Informations du voyage, participants | Assistant IA |
| Dépenses (consultation et **ajout**, rejoué au retour du réseau) | Prix à jour |
| Carte de la destination, si téléchargée avant le départ | Météo à jour |

Conflits : les lignes sont fines (un vote, une activité), donc les collisions
sont rares. Le dernier écrit gagne, sauf pour les positions d'itinéraire qui
utilisent des valeurs fractionnaires, et pour les suppressions de voyage qui
sont douces (`deleted_at`).

## Sécurité et confidentialité

- **Aucune clé secrète dans l'application.** Tout ce qui commence par `VITE_`
  est public par construction. Mistral, Travelpayouts et Geoapify vivent
  uniquement dans les secrets Supabase.
- **RLS sur toutes les tables**, y compris les tables techniques qui, sans
  aucune politique, sont inaccessibles aux clients. Testé : un intrus ne voit
  ni le voyage, ni les membres, ni les invitations, ni les profils.
- **Chacun n'écrit que ses propres préférences et ses propres votes.**
- **Les propositions ne sont écrites que par les fonctions serveur** : un client
  ne peut pas s'attribuer une note.
- **Invitations** : code aléatoire, expiration, nombre d'usages, révocation. La
  page publique n'expose que le titre et la photo.
- **Limitation d'appels** par personne et par jour, en plus du garde-quota par
  fournisseur.
- **Données minimales** : nom d'affichage, photo facultative, adresse
  électronique seulement via Google. La position sert au calcul, elle n'est pas
  stockée. Rien de tout cela ne part vers un modèle d'IA.

## Interface

Mobile d'abord, utilisable d'une main. Navigation par onglets en bas d'écran :
c'est la seule zone réellement atteignable au pouce sur un grand téléphone.
Quatre entrées au maximum, sinon les cibles deviennent trop étroites. Cibles
tactiles de 44 pixels minimum, marges de sécurité pour les encoches.

Photos, cartes et destinations sont mis en avant : Tripora vend de l'envie, pas
un tableau de bord. Les animations restent discrètes et disparaissent si le
système demande de réduire les animations.

Les envies se saisissent en quatre paliers — *Non merci, Un peu, Beaucoup,
Indispensable* — plutôt qu'en pourcentages : un curseur au pourcent près est
pénible au pouce, et personne ne fait la différence entre 60 % et 65 % de goût
pour les musées. Un mode de réglage fin reste accessible.

Un écran vide explique quoi faire. Un écran en panne dit ce qui s'est passé et
ce qu'on peut tenter.

## Difficulté par chantier

| Chantier | Difficulté |
|---|---|
| Fondations, PWA, comptes | Facile |
| Assistant de création, interface | Moyen |
| Catalogue de destinations (curation des tags et des coûts) | Moyen |
| Collaboration temps réel et politiques RLS | Moyen |
| Scoring explicable et équité de groupe | Moyen |
| Prix des vols en cache | Moyen |
| Vote | Facile |
| Carte et points d'intérêt | Moyen |
| **Itinéraire cohérent** (regroupement géographique, horaires, repas, budget) | **Difficile** |
| Client IA multi-fournisseurs | Moyen |
| **Assistant qui modifie l'itinéraire** | **Difficile** |
| Dépenses et simplification des dettes | Facile à moyen |
| **Transports terrestres sans source de prix** | **Difficile** (on ne peut qu'estimer honnêtement) |
| Hors ligne avec écritures différées | Moyen à difficile |
| Météo et réorganisation du planning | Moyen |
| Notifications, iOS compris | Moyen |
