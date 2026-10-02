# Enregistrer la voix off

19 répliques, environ 1 min 30 de pub. Comptez une demi-heure, prises ratées
comprises. Un téléphone suffit.

## Avant de commencer

- **Une pièce calme et meublée** (une chambre, un salon avec canapé et rideaux) :
  les murs nus et la cuisine résonnent. Fenêtre fermée, frigo et machine à
  laver éteints.
- **Le téléphone à 20 cm de la bouche**, un peu sur le côté (pour que les « p »
  et les « b » ne soufflent pas dans le micro), en mode avion.
- **L'application Dictaphone / Enregistreur** du téléphone, en qualité maximale
  si le réglage existe.
- **Le ton** : souriant, posé, comme quand on raconte un bon plan à un ami.
  Pas de voix « pub de supermarché ». Sourire en parlant s'entend vraiment.

## Deux façons de faire

### A. Une réplique par fichier (le plus simple, recommandé)

Enregistrez chaque phrase séparément, nommez les fichiers `01`, `02`… `19`
(l'extension ne compte pas : m4a, mp3, wav…), et refaites une phrase autant de
fois que vous voulez : seule la dernière compte. Laissez une seconde de silence
avant et après, je les coupe.

La colonne « au plus » donne le temps disponible : si une phrase déborde un peu,
je l'accélère sans que ça s'entende (jusqu'à 15 %) ; au-delà, je vous dirai
laquelle refaire.

### B. Tout d'une traite, sur la vidéo-prompteur

Lancez `prompteur-fr.mp4` sur un ordinateur, enregistrez avec le téléphone, et
lisez la phrase **quand elle apparaît en bleu en bas** (la suivante est
annoncée en gris en haut). Un seul fichier, nommé `prise`. Laissez bien les
silences entre les phrases : c'est sur eux que je découpe.

## Le texte

| N° | Réplique | Au plus | Dans la pub à |
|---|---|---|---|
| 01 | Partir entre amis, le rêve. L’organiser… beaucoup moins. | 3.8 s | 0:06.1 |
| 02 | Tripora. Le voyage de groupe, de l’idée au souvenir. | 3.9 s | 0:10.1 |
| 03 | Une envie, une phrase : votre voyage est créé. Sans compte. | 4.4 s | 0:14.4 |
| 04 | Invitez la bande : chacun ses envies, chacun son budget. | 4.6 s | 0:19.2 |
| 05 | Tripora compare les destinations : vols, climat, coût total… et explique chaque choix. | 6.4 s | 0:24.4 |
| 06 | Le groupe vote. La destination se choisit ensemble. | 4.5 s | 0:31.3 |
| 07 | Swipez les activités : le classement se fait seul. | 3.7 s | 0:36.3 |
| 08 | Le prix baisse ? Vous êtes prévenus. | 2.6 s | 0:40.3 |
| 09 | Un itinéraire jour par jour, avec de vrais lieux. Il pleut ? Tripora propose d’échanger. | 6.3 s | 0:43.4 |
| 10 | Vu sur les réseaux ? Partagez, c’est épinglé. | 3.8 s | 0:50.2 |
| 11 | Billets, réservations, codes : tout le groupe a tout. Même hors ligne. | 4.6 s | 0:54.3 |
| 12 | Et tout ce qui va avec. | 2.6 s | 0:59.2 |
| 13 | Un ticket ? Une photo : la dépense est notée et partagée. | 4.5 s | 1:02.3 |
| 14 | Qui doit quoi ? Réglé en deux virements. | 3.5 s | 1:07.3 |
| 15 | Vos photos, réunies dans le journal du groupe. | 3.5 s | 1:11.3 |
| 16 | Au retour, un bilan à partager, et un passeport qui se remplit. | 5.4 s | 1:15.3 |
| 17 | Et ce n’est que le début. | 3.5 s | 1:21.3 |
| 18 | Gratuit, et sans publicité. | 2.3 s | 1:25.3 |
| 19 | Tripora. Partez ensemble. | 3.3 s | 1:28.3 |

Quelques repères de prononciation : « Tripora » se dit *tri-po-ra*, accent sur
la fin ; « swipez » à l'anglaise (*souaïpé*).

## Ensuite

Envoyez-moi les fichiers (ou déposez-les dans `marketing/pub/voix/fr/`). Je
nettoie le son (souffle, bruit de fond, niveau), je pose chaque phrase sur son
plan, la musique s'efface sous la voix, et je refais les deux formats :
16:9 et 9:16, avec les sous-titres calés sur la voix.

```sh
python3 voix.py fr        # nettoyage, calage, mixage → sortie/bande-son-fr.wav
python3 vertical.py fr    # la version 9:16 avec la voix
```
