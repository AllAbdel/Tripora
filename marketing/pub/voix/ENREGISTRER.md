# Enregistrer la voix off

19 répliques, environ 1 min 50 de pub. Comptez une demi-heure, prises ratées
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
| 01 | Partir entre amis, le rêve. L’organiser… beaucoup moins. | 4.6 s | 0:07.3 |
| 02 | Tripora. Le voyage de groupe, de l’idée au souvenir. | 4.7 s | 0:12.1 |
| 03 | Une envie, une phrase : votre voyage est créé. Sans compte. | 5.3 s | 0:17.3 |
| 04 | Invitez la bande : chacun ses envies, chacun son budget. | 5.5 s | 0:23.1 |
| 05 | Tripora compare les destinations : vols, climat, coût total… et explique chaque choix. | 7.7 s | 0:29.3 |
| 06 | Le groupe vote. La destination se choisit ensemble. | 5.4 s | 0:37.6 |
| 07 | Swipez les activités : le classement se fait seul. | 4.4 s | 0:43.6 |
| 08 | Le prix baisse ? Vous êtes prévenus. | 3.1 s | 0:48.4 |
| 09 | Un itinéraire jour par jour, avec de vrais lieux. Il pleut ? Tripora propose d’échanger. | 7.6 s | 0:52.1 |
| 10 | Vu sur les réseaux ? Partagez, c’est épinglé. | 4.5 s | 1:00.2 |
| 11 | Billets, réservations, codes : tout le groupe a tout. Même hors ligne. | 5.5 s | 1:05.2 |
| 12 | Et tout ce qui va avec. | 3.2 s | 1:11.0 |
| 13 | Un ticket ? Une photo : la dépense est notée et partagée. | 5.5 s | 1:14.8 |
| 14 | Qui doit quoi ? Réglé en deux virements. | 4.3 s | 1:20.8 |
| 15 | Vos photos, réunies dans le journal du groupe. | 4.3 s | 1:25.6 |
| 16 | Au retour, un bilan à partager, et un passeport qui se remplit. | 6.5 s | 1:30.4 |
| 17 | Et ce n’est que le début. | 4.1 s | 1:37.6 |
| 18 | Gratuit, et sans publicité. | 2.8 s | 1:42.4 |
| 19 | Tripora. Partez ensemble. | 4.0 s | 1:46.0 |

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
