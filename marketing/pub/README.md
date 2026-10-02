# La pub de Tripora

Une vidéo de 1 min 33, 1920×1080, 30 images par seconde, dans l'identité
« carnet de voyage » de l'application : papier crème, encre brune, Fraunces et
Inter Tight, les couleurs de l'app. Tout est fabriqué ici, sans banque d'images
ni musique sous licence : les écrans sont de vraies captures de Tripora, les
illustrations sont dessinées en SVG, la musique et les bruitages sont
synthétisés par `musique.py`.

## Le découpage

Tempo 120 : une mesure dure 2 s, et les coupes tombent sur les temps.

| Temps | Plan | Ce qu'on voit |
|---|---|---|
| 0 → 6 s | Le problème | Un groupe de discussion qui déborde : 24 messages, « 99+ » non lus |
| 6 → 10 s | Le constat | « Partir entre amis, c'est le rêve. Tout organiser à six, beaucoup moins. » |
| 10 → 14 s | La marque | Logo, « Tripora », « Le voyage de groupe, de l'idée au souvenir. » |
| 14 → 19 s | 01 Choisir | Créer un voyage en une phrase, sans compte |
| 19 → 24 s | | Inviter la bande (lien, QR code), envies et budget de chacun, le plus serré fait foi |
| 24 → 31 s | | Les propositions notées et expliquées (vraie capture), prix relevés, climat, coût total, empreinte carbone, vacances scolaires |
| 31 → 36 s | | Le vote, le tampon « CHOISI » sur Bali |
| 36 → 40 s | | Découvrir en glissant, le classement du groupe |
| 40 → 43 s | | L'alerte de prix (le vrai texte de la notification) |
| 43 → 50 s | 02 Organiser | L'itinéraire jour par jour (vraie capture), la carte de Bali, l'échange de journées quand il pleut |
| 50 → 54 s | | Partager une vidéo vers Tripora : elle devient des épingles |
| 54 → 59 s | | Une réservation lue dans l'e-mail, le coffre (wifi, codes, billets), hors ligne |
| 59 → 62 s | | Douze outils : valise, sondages, tâches, infos pratiques, calendrier… |
| 62 → 67 s | 03 Vivre | Un ticket photographié, lu sur le téléphone, converti au taux BCE, partagé |
| 67 → 71 s | | Qui doit quoi, réglé en deux virements |
| 71 → 75 s | | Le journal photo du groupe |
| 75 → 81 s | 04 Se souvenir | Le bilan à partager (vraie capture), le passeport, ses tampons et ses rangs |
| 81 → 85 s | Bientôt | L'app iPhone sur l'App Store, des récompenses à chaque réservation, les notifications du groupe |
| 85 → 93 s | Fin | Gratuit, sans publicité, données jamais revendues ; logo, « Partez ensemble. », l'adresse |

Les trois promesses « Bientôt » sont des pistes de la feuille de route, pas
des fonctions livrées : à retirer ou à changer si le cap change.

## Refaire la vidéo

Il faut Node, Python 3 avec numpy et scipy, ffmpeg, et le Chromium de
Playwright (celui des tests de bout en bout).

```sh
cd marketing/pub
npm install                     # GSAP
(cd ../../apps/web && VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir dist-e2e)  # l'app en mode local
node captures.mjs               # captures/ : les vrais écrans, en mode local
node rendu.mjs --apercu 12,30   # sortie/apercu-*.png : vérifier une image
node rendu.mjs --cues           # sortie/cues.json : les instants des bruitages
python3 musique.py              # sortie/bande-son.wav (+ musique seule, bruitages seuls)
node rendu.mjs                  # sortie/image.mp4 : l'image, ~5 min sur 4 cœurs
ffmpeg -i sortie/image.mp4 -i sortie/bande-son.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart sortie/tripora-pub.mp4
```

`FFMPEG` et `CHROMIUM_PATH` indiquent où trouver les binaires s'ils ne sont
pas dans le chemin ; `OUVRIERS` règle le nombre d'onglets qui rendent en
parallèle.

Pour changer un texte, une couleur ou un temps : tout est dans `scenes.js`,
plan par plan, sur une seule ligne de temps GSAP en pause. Le rendu avance
image par image avec `window.allerA(t)` : rien ne dépend de l'horloge ni du
hasard, deux rendus donnent la même vidéo. Ouvrir `index.html?t=42` (servi
depuis la racine du dépôt) montre l'image à 42 s.

Pour changer la musique : `sortie/musique-seule.wav` et
`sortie/bruitages.wav` sont livrés à part ; on peut remplacer la première par
un morceau sous licence et garder les bruitages, calés sur l'image.

## La voix off et la version verticale

- `voix/script-fr.json` : les 19 répliques, chacune avec sa fenêtre dans la
  pub (vérifiée à 4,6 syllabes par seconde, une lecture posée). Le guide
  d'enregistrement est dans `voix/ENREGISTRER.md`.
- `python3 voix.py fr --prompteur` : la pub avec la réplique à lire en bas, pour
  enregistrer d'une traite.
- `python3 voix.py fr` : prend les enregistrements de `voix/fr/` (un fichier par
  réplique, ou une seule prise découpée sur les silences), les nettoie
  (passe-haut, réduction de bruit, compression, niveau commun), les pose sur
  leur plan, les accélère au besoin sans changer la hauteur (rubberband,
  15 % au plus — au-delà, il refuse et dit quoi refaire), puis efface la
  musique sous la voix (−9 dB). Sous-titres en ASS et SRT.
- `python3 polices.py` : les polices de l'app en TTF, pour les sous-titres.
- `python3 vertical.py fr` : la version 9:16 par recadrage — la vidéo 16:9 au
  milieu d'un écran papier, logo en haut, chapitre en cours, grands
  sous-titres en bas, adresse à la fin. Rien n'est reconstruit.

Les enregistrements (`voix/*/`) restent hors du dépôt.

## La version anglaise

La même pub, plan pour plan, sur les écrans de l'application en anglais.
`scenes.js` porte les deux langues côte à côte (`L('français', 'english')`) ;
`index.html?langue=en` choisit l'anglais, les captures de `captures-en/` et
leurs repères (`reperes.js` : les défilements visent les mêmes textes, qui ne
tombent pas à la même hauteur dans les deux langues).

```sh
LANGUE=en node captures.mjs            # captures-en/ : l'application en anglais
LANGUE=en node rendu.mjs --cues        # sortie/cues-en.json
LANGUE=en python3 musique.py           # musique-seule-en.wav, bruitages-en.wav (la frappe suit la phrase anglaise)
python3 synthese.py en                 # voix/en/01.wav… : la voix, synthétisée hors ligne
python3 voix.py en                     # sortie/bande-son-en.wav : musique effacée sous la voix
LANGUE=en node rendu.mjs               # sortie/image-en.mp4
ffmpeg -i sortie/image-en.mp4 -i sortie/bande-son-en.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart sortie/tripora-pub-en.mp4
python3 vertical.py en --sans-sous-titres   # sortie/tripora-pub-9x16-en.mp4
```

- **La voix** est celle de [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M)
  (82 M de paramètres, licence Apache 2.0), voix `af_heart`, calculée sur le
  processeur, sans compte ni service payant. Il faut le paquet Python
  `kokoro-onnx`, le modèle quantifié `model_quantized.onnx` et les voix
  `voices.bin` (chemins dans `KOKORO_MODELE` et `KOKORO_VOIX`). Le modèle et
  les voix se trouvent sur Hugging Face, ou sur npm (`kokoro-q8-shards` : le
  modèle en six morceaux à recoller ; `kokoro-local-runtime` : les voix
  anglaises, à réunir dans un `.npz`). `synthese.py` ralentit ou accélère
  chaque réplique pour qu'elle tienne dans sa fenêtre ; un vrai enregistrement
  posé dans `voix/en/` prend sa place (retirer alors `"synthese"` du script,
  pour retrouver la réduction de bruit).
- **Sans sous-titres** : la version anglaise ne montre pas le texte de la voix.
  En 9:16, la vidéo descend au centre et la devise de la marque occupe la
  place libre ; les chapitres, l'adresse et l'appel final restent.

## Crédits et licences

- Animation : [GSAP](https://gsap.com) 3 (licence standard sans frais), outil
  de rendu seulement, il ne part pas dans la vidéo.
- Pictogrammes : [Lucide](https://lucide.dev) (ISC), extraits dans `icones.js`,
  et les glyphes de navigation de Tripora.
- Polices : Fraunces et Inter Tight (SIL Open Font License), celles de l'app.
- Musique et bruitages : synthétisés par `musique.py`, sans échantillon.
- Voix anglaise : [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache 2.0), voix `af_heart`.
- Personnages, prix, adresses et références : fictifs, pour la démonstration.
