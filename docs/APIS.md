# Sources de données et quotas gratuits

Vérifié le 5 septembre 2026. Règle absolue : **aucun moyen de paiement
enregistré nulle part**. Sans carte, un dépassement se traduit par une réponse
refusée, jamais par une facture.

## Le garde-quota

Tripora ne se contente pas de compter sur l'absence de carte. Une table
`api_quota` compte les appels par fournisseur et par jour :

| Consommation | Comportement |
|---|---|
| Moins de 80 % de la limite | Appel normal, réponse mise en cache |
| Au-delà de 80 % | Cache uniquement, même périmé, silencieusement |
| À 100 % | Fonction en pause avec un message et la date de reprise |

On n'atteint donc quasiment jamais la vraie limite du fournisseur. Le compteur
s'incrémente de façon atomique (`bump_api_quota`), pour que deux requêtes
simultanées ne puissent pas passer au travers.

## Le cache partagé

Une réponse sert tout le groupe. Cinq personnes qui ouvrent le même hôtel
déclenchent un seul appel.

| Donnée | Durée de vie | Pourquoi |
|---|---|---|
| Prix des vols | 24 h | La source elle-même agrège 48 h |
| Prix des hôtels | 24 h | Idem |
| Géocodage | illimitée | Une ville ne bouge pas |
| Points d'intérêt | 30 jours | Un musée non plus |
| Prévisions météo | 6 h | Au-delà, la prévision a changé |
| Normales climatiques | illimitée | Moyennes sur trente ans |
| Taux de change | 24 h | La BCE publie une fois par jour |
| Réponses de l'IA | 7 jours | Clé = empreinte des entrées |

---

## Ce qui est utilisé

### Prix des vols — Travelpayouts (données Aviasales)

Gratuit, inscription affiliée sans site web, environ une requête par seconde.
Fournit les vols les moins chers **relevés par de vrais utilisateurs dans les
dernières 48 heures**, par date, par mois, et surtout les destinations les moins
chères au départ d'une ville : exactement la question « on part d'où, on ne sait
pas où aller, le moins cher possible ».

Ce n'est pas du temps réel. Tripora l'affiche toujours (« prix vu le … ») et
déclasse automatiquement en « prix indicatif » au-delà de 72 heures.

### Hôtels — Hotellook (même compte Travelpayouts)

Gratuit, 60 requêtes par minute. Prix moyens en cache par ville et par période.
Ni Booking ni Airbnb n'exposent d'API accessible à un projet personnel : pour la
réservation, Tripora renvoie vers des liens préremplis.

### Trains et bus

Aucune source gratuite ne donne des **prix**. Tripora fournit des durées réelles
(API SNCF, 3 000 requêtes par jour ; `v6.db.transport.rest` pour l'Europe) et
une fourchette de prix estimée au kilomètre, clairement étiquetée comme telle,
avec des liens vers SNCF Connect, Trainline, Omio, FlixBus et BlaBlaCar.

### Météo — Open-Meteo

Sans clé, 10 000 requêtes par jour, usage non commercial. Prévisions à 16 jours
et normales climatiques mensuelles. Ce sont ces dernières qui servent au score
d'une destination : personne ne connaît la météo de juin prochain, mais on sait
qu'il fait en moyenne 27 °C à Séville en juin.

### Cartes — OpenFreeMap + MapLibre

Tuiles vectorielles, sans clé, sans limite annoncée, attribution automatique.
Repli possible sur Protomaps ou MapTiler. Google Maps et Mapbox exigent une
carte bancaire : écartés d'emblée.

### Lieux — Overpass (OpenStreetMap), Wikipédia, Wikivoyage, Geoapify

Sans clé pour les trois premiers, 3 000 requêtes par jour pour Geoapify.
Restaurants, bars, musées, monuments, nature, plus les descriptions et les
photos libres. La qualité varie selon les villes : c'est le prix du gratuit, et
Tripora préfère afficher moins de lieux que des lieux inventés.

### Devises — Frankfurter

Sans clé, sans quota, taux officiels de la Banque centrale européenne. Le taux
est **figé sur chaque dépense au moment de la saisie** : une dépense passée ne
doit jamais changer de montant parce que l'euro a bougé.

### Données statiques

REST Countries, OpenFlights (codes IATA), GeoNames : elles alimentent un
catalogue local d'environ 300 destinations, versionné avec le code. Lancer une
recherche ne consomme donc aucun quota.

### Intelligence artificielle

Trois fournisseurs, interrogés dans cet ordre jusqu'à ce que l'un réponde.
L'ordre n'est pas une préférence de principe : il vient de ce que chacun a
réellement répondu, le 6 septembre 2026, à la même phrase de test.

| Rang | Fournisseur | Modèles retenus | Mesuré ce jour-là |
|---|---|---|---|
| 1 | Gemini | `gemini-flash-lite-latest`, `gemini-flash-latest` | extraction complète et correcte, ~700 ms, mode JSON strict accepté |
| 2 | Groq | `qwen/qwen3.8-27b`, `openai/gpt-oss-120b` | extraction complète, ~250 ms, **mode JSON strict refusé** |
| 3 | Mistral | `mistral-small-latest`, `mistral-medium-latest` | 429 en 90 ms sur ce compte ; `ministral-8b` répondait, lui |

Tous exposent une interface compatible OpenAI : un seul client dans le code.

Trois leçons de cette vérification, qui expliquent des choix du code :

- **les identifiants de modèles vieillissent vite.** `gemini-2.0-flash` et
  `llama-3.3-70b-versatile` avaient déjà disparu. On utilise partout les alias
  « latest » quand le fournisseur en propose : ils suivent les remplacements
  tout seuls ;
- **Groq refuse `response_format: json_object`.** Ses modèles raisonnent dans
  un canal séparé et la validation stricte échoue à vide. Le mode JSON est donc
  désactivé pour lui seul, et l'objet est extrait du texte ;
- **un modèle ne suit pas forcément l'échelle demandée.** L'un a répondu
  « food: 8, nightlife: 9 » là où la consigne disait 0 à 1. `sanitizeDraft`
  en déduit l'échelle et divise, plutôt que d'écraser les deux à 1.

Si Mistral continue de répondre 429 immédiatement, c'est côté compte : l'offre
gratuite demande une validation par numéro de téléphone sur
console.mistral.ai. Rien à changer dans Tripora — les deux autres suffisent.

**Sur les offres gratuites, les échanges peuvent servir à l'entraînement.** D'où une règle non négociable : les participants sont
anonymisés en « Participant A, B, C », et aucun nom, adresse électronique ou
position ne part vers un modèle. Seuls circulent des préférences chiffrées, des
contraintes et des faits déjà publics.

Deux garde-fous se cumulent : le compteur par fournisseur, qui protège le
quota gratuit, et un plafond de **40 demandes par personne et par jour**, qui
protège le groupe de l'un de ses membres — une page laissée ouverte qui
relancerait l'assistant en boucle épuiserait sinon le quota commun avant midi.
Les réponses sont mises en cache une semaine, indexées par l'empreinte de la
question : la même phrase posée par cinq personnes ne coûte qu'un appel.

Si les trois fournisseurs sont saturés, Tripora continue de fonctionner : le
scoring, les votes, l'itinéraire de base et les dépenses sont déterministes.
Seules les deux commodités rédigées se mettent en pause, et l'écran le dit
sans dramatiser.

---

## Ce qui a été écarté, et pourquoi

| Source | Raison |
|---|---|
| **Amadeus Self-Service** | Portail décommissionné le 17 juillet 2026, clés désactivées, pas d'équivalent gratuit |
| **Kiwi.com Tequila** | Sur invitation depuis 2024, fermé aux nouveaux développeurs |
| **Skyscanner, Duffel** | Réservés aux partenaires commerciaux |
| **Booking, Airbnb** | Pas d'API accessible à un projet personnel |
| **Google Maps, Mapbox** | Carte bancaire obligatoire |
| **Google Places** | Facturation à l'appel, dès le premier |
| **OpenWeather** | Offre gratuite réduite, carte demandée pour certaines fonctions |
| **SerpApi (Google Flights)** | Retenu, mais **en option** : 100 recherches par mois seulement, réservé au bouton « Vérifier le prix » sur la destination finale, plafonné à 3 par jour |

## Coût mensuel

**0 €.** Consommation attendue pour un groupe d'amis : moins de 5 % de chaque
quota gratuit. Seule dépense possible, entièrement facultative : un nom de
domaine, environ 10 € par an. Sans domaine, l'application vit sur
`tripora.pages.dev`.
