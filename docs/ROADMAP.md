# Feuille de route

Le MVP s'arrête à la fin de la phase 6 : à ce stade, un groupe peut créer un
voyage, exprimer ses envies, comparer des destinations chiffrées, voter, obtenir
un itinéraire et le consulter hors ligne. Tout le reste vient ensuite.

| Phase | Contenu | État |
|---|---|---|
| **0** | **Fondations** — monorepo, PWA installable, thèmes, identité visuelle, schéma Postgres avec RLS, comptes Google et invité, intégration continue | ✅ fait |
| **1** | **Création de voyage** — assistant en six étapes (avec qui, départ, destination ou « surprends-nous », dates ou durée, budget, envies), catalogue de 55 destinations | ✅ fait |
| **2** | **Collaboration** — invitation par lien, code et QR, liste des membres, préférences et budget de chacun, mises à jour en direct | ✅ fait |
| **3** | **Propositions** — moteur de scoring, coût total, explications, prix des vols relevés chez Aviasales, climat mesuré sur trois ans | ✅ fait |
| **4** | **Vote et décision** — j'aime, je n'aime pas, favori, agrégation, verrouillage de la destination | ✅ fait |
| **5** | **Carte et lieux** — MapLibre, destinations en lice, tracé du trajet, lieux réels d'OpenStreetMap avec descriptions Wikipédia | ✅ fait |
| **6** | **Itinéraire** — génération jour par jour, réorganisation, remplissage automatique avec de vrais lieux regroupés par quartier, consultation hors ligne — **MVP atteint** | ✅ fait |
| **7** | **Intelligence artificielle** — compréhension du langage naturel, explications rédigées, assistant qui répond aux questions du groupe sans jamais rien décider ni rien modifier | ✅ fait |
| **8** | **Budget et dépenses** — saisie, parts, « qui doit combien à qui » simplifié, dépenses en devise locale converties aux taux de la BCE | ✅ fait |
| **9** | **Transport et hébergement** — comparaison avion, train, bus, voiture ✅, liens de réservation préremplis ✅ ; prix d'hôtels **impossibles** (Hotellook retiré, voir APIS.md) | 🔨 en cours |
| **10** | **Confort** — météo du séjour, sur la fiche et sur chaque journée, avec proposition d'échanger deux journées quand la pluie tombe sur le programme en extérieur ✅ ; notifications, carte hors ligne et éventuel emballage APK à venir | 🔨 en cours |

## Où on en est

**Le MVP est atteint, et dépassé.** Un groupe peut créer un voyage — au
formulaire ou en une phrase —, s'inviter par lien ou par QR code, exprimer ses
envies chacun de son côté, comparer des destinations notées, chiffrées et
expliquées, voter, trancher, voir la carte, obtenir un itinéraire jour par jour
qu'il complète de vraies adresses, et se répartir les dépenses.

Ce qui repose sur des faits mesurés plutôt que sur des estimations :

- **les prix des vols**, relevés chez Aviasales et étiquetés de leur date ;
- **les lieux**, tirés d'OpenStreetMap et décrits par Wikipédia : l'itinéraire
  propose des visites qui existent, il n'en invente aucune. Un bouton pose ces
  endroits sur les créneaux encore génériques, en respectant l'envie de chacun
  et en regroupant la journée par quartier — sans jamais écraser ce que
  quelqu'un a écrit ;
- **le climat**, normales mensuelles calculées sur les archives 2023-2025 pour
  les 55 destinations, embarquées dans le code : aucun appel, aucun quota,
  fonctionne hors ligne.

Sans aucune clé d'API, tout continue de fonctionner : les prix redeviennent des
estimations, l'IA disparaît de l'écran, et rien d'autre ne bouge.

Le groupe peut aussi **poser une question sur son propre voyage** — « pourquoi
la première est devant la deuxième ? », « qu'est-ce qui nous empêche de
trancher ? ». L'assistant lit le dossier de faits calculé par le moteur et
répond en trois phrases. Il n'a aucun outil, ne peut rien modifier, et aucun
prénom ne lui est transmis : les participants sont « Participant A, B, C », et
un contrôle vérifie avant chaque envoi qu'aucun nom n'a glissé.

Et pendant le voyage, **une dépense se note dans la monnaie qu'on a payée** :
le zloty, la couronne, la livre. La conversion utilise les taux de référence de
la Banque centrale européenne, avec leur date de publication affichée, et le
taux est figé dans la dépense pour que les comptes ne bougent plus.

À l'approche du départ, **la vraie météo remplace les moyennes** : la fiche du
voyage montre les jours du séjour, et chaque journée de l'itinéraire porte sa
prévision — « pluie, 18 ° — plutôt à l'abri ». Au-delà de seize jours la
prévision n'existe pas, et les normales reprennent la main, sans que personne
ait à choisir.

Et quand la randonnée tombe le jour de pluie pendant que le musée prend le
grand soleil, Tripora le remarque et propose d'échanger les deux journées.
**Il ne le fait pas** : un itinéraire qui se réorganiserait tout seul serait
impossible à suivre. Il le dit, le groupe décide.

La suite : les notifications et la carte hors ligne.
La marche à suivre pour tout essayer soi-même est dans [TESTER.md](TESTER.md).

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
