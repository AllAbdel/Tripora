# Feuille de route

Le MVP s'arrête à la fin de la phase 6 : à ce stade, un groupe peut créer un
voyage, exprimer ses envies, comparer des destinations chiffrées, voter, obtenir
un itinéraire et le consulter hors ligne. Tout le reste vient ensuite.

| Phase | Contenu | État |
|---|---|---|
| **0** | **Fondations** — monorepo, PWA installable, thèmes, identité visuelle, schéma Postgres avec RLS, comptes Google et invité, intégration continue | ✅ fait |
| **1** | **Création de voyage** — assistant en six étapes (avec qui, départ, destination ou « surprends-nous », dates ou durée, budget, envies), catalogue de 55 destinations | ✅ fait |
| **2** | **Collaboration** — invitation par lien, code et QR, liste des membres, préférences et budget de chacun, mises à jour en direct | ✅ fait |
| **3** | **Propositions** — moteur de scoring branché, coût total, explications ✅ ; prix des vols en cache et climat réel restent à brancher | 🔨 en cours |
| **4** | **Vote et décision** — j'aime, je n'aime pas, favori, agrégation, verrouillage de la destination | ✅ fait |
| **5** | **Carte et lieux** — MapLibre, points d'intérêt, photos, fiches, favoris | ⬜ |
| **6** | **Itinéraire et hors ligne** — génération jour par jour cohérente géographiquement, réorganisation, consultation sans réseau — **fin du MVP** | ⬜ |
| **7** | **Intelligence artificielle** — compréhension du langage naturel, explications rédigées, assistant conversationnel avec outils | ⬜ |
| **8** | **Budget et dépenses** — saisie multi-devises, parts, « qui doit combien à qui » simplifié | ⬜ |
| **9** | **Transport et hébergement** — comparaison avion, train, bus, voiture ; hôtels indicatifs ; liens de réservation ; vérification ponctuelle d'un prix | ⬜ |
| **10** | **Confort** — météo et réorganisation du planning, notifications, carte hors ligne, éventuel emballage APK | ⬜ |

## Où on en est

Les phases 0, 1, 2 et 4 sont terminées, la 3 et la 5 le sont pour leur partie
qui ne dépend d'aucune clé d'API. Un groupe peut créer un voyage, s'inviter par lien ou par QR
code, exprimer ses envies chacun de son côté, et voir des destinations notées,
expliquées et chiffrées se recalculer en direct — **sans aucune clé d'API**.
Tous les prix sont alors des estimations, et l'application le dit à chaque
écran.

Le vote est en place, et la carte montre la géographie du voyage : d'où l'on
part, les destinations en lice, et le trajet vers celle qu'on regarde. Il reste
l'itinéraire jour par jour pour boucler le MVP, puis les points d'intérêt et
les prix réels.

## Pourquoi cet ordre

**Le vote avant l'IA.** Un groupe qui ne peut pas trancher n'a pas besoin d'un
assistant : il a besoin d'un bouton. Les phases 3 et 4 livrent la valeur
centrale — comparer et décider — avec du code déterministe et testable.

**L'itinéraire avant les hôtels.** Voir sa journée sur une carte donne envie de
partir ; une liste d'hôtels sans itinéraire ne sert à rien.

**Les dépenses après le MVP.** Elles servent *pendant* le voyage, pas pour le
choisir. Mais la logique financière (centimes entiers, répartition exacte) est
déjà écrite et testée en phase 0, parce que c'est la partie où une erreur se
voit le plus.

**Les transports en phase 9.** Aucune source gratuite ne donne les prix des
trains et des bus. Retarder ce chantier laisse le temps de vérifier ce qui est
réellement possible plutôt que de promettre une comparaison qu'on ne peut pas
tenir.

## Chaque phase se termine par

- tests verts (`pnpm check` et, si le schéma bouge, `./supabase/tests/run.sh`) ;
- au moins un commit en français décrivant ce qui change et pourquoi ;
- la memory bank mise à jour ;
- la liste de ce qui reste à faire côté humain : créer un compte, coller une clé.
