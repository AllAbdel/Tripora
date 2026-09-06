# Tester Tripora

Une liste à suivre dans l'ordre. Chaque étape dit **ce que tu dois voir** : si
ce n'est pas ça, note l'écran et le message exact, c'est ce qui permet de
corriger vite.

Compte environ dix minutes. Prévois **deux fenêtres** : ton navigateur normal,
et une fenêtre de navigation privée qui jouera le rôle d'un ami.

Adresse du site : **https://tripora-3rg.pages.dev**
(pas les adresses en `b0a5cccd.*`, qui sont figées sur un ancien déploiement)

---

## 1. Se connecter

1. Ouvre le site. → Tu dois voir le logo, « Tripora », et deux boutons.
2. **Continuer avec Google**.

| Ce qui peut clocher | Ce que ça veut dire |
|---|---|
| « redirect_uri_mismatch » | L'URL de rappel manque côté Google. Elle doit être exactement `https://eelvllvgnsohznconfpt.supabase.co/auth/v1/callback` |
| Retour sur la page de connexion sans rien | L'URL du site manque dans Supabase → Authentication → URL Configuration |
| « Access blocked » / « app not verified » | Ajoute-toi comme testeur dans l'écran de consentement Google |

→ Tu dois arriver sur **Mes voyages**, avec « Bonjour <ton prénom> ».

## 2. Créer un voyage

3. **Nouveau** → six écrans : avec qui, d'où, où, quand, budget, envies.

   **Avant de remplir quoi que ce soit**, essaie l'encadré en pointillés tout
   en haut, « Ou dites-le en une phrase ». Colle exactement :

   > On part à 5 depuis Lyon, une semaine en octobre, 400 € max, plutôt fête
   > et bonne bouffe

   → Une liste de pastilles doit apparaître : *5 personnes · départ de Lyon ·
   7 jours · en octobre · 400 € max · entre amis · Gastronomie · Fête*.
   Rien n'est appliqué tant que tu n'as pas cliqué **Reprendre** — et
   **Ignorer** doit tout annuler sans rien changer au formulaire.

   → Clique **Reprendre**, puis parcours les six écrans : ils doivent déjà
   être remplis, et tout doit rester modifiable.

   Si l'encadré n'apparaît pas du tout, c'est que les clés d'IA ne répondent
   plus : le reste fonctionne à l'identique, signale-le simplement.

   Puis, pour la suite du test, repars des valeurs ci-dessous.
4. Prends **Entre amis**, mets 4 participants.
5. Départ : cherche ta ville. → La recherche doit tolérer les accents (tape `nimes`, tu dois voir Nîmes).
6. Destination : laisse **Surprends-nous**.
7. Quand : un mois, par exemple octobre.
8. Budget : **Un maximum par personne**, 400 €.
9. Envies : mets Gastronomie sur *Essentiel* et Fête sur *Beaucoup*.
   → Les axes auxquels tu n'as pas répondu ne doivent **rien** avoir de
   sélectionné. « Pas encore répondu » n'est pas « Non merci ».
10. **Créer le voyage**.

→ Tu dois voir six destinations, chacune avec une note sur 100, un prix par
personne et une phrase qui explique la note. Déplie « Voir le détail » : la
ventilation du prix, les six facteurs avec leur poids, et les options de
transport comparées.

→ Les prix des vols doivent porter une étiquette du type **« Prix vu il y a
N jours (Aviasales) »**. Le reste du coût — logement, nourriture, sur place —
reste estimé, et c'est écrit. Jamais un prix estimé présenté comme constaté.

→ À côté du prix, un thermomètre et un nuage : la température de journée et
le nombre de jours de pluie du mois visé, mesurés sur trois ans d'archives.
Dans le détail, la bande **« Quand y aller »** montre les douze mois d'un coup
d'œil, le mois choisi encadré. Vérifie que ça a du sens : Marrakech doit être
rouge en juillet et confortable en janvier.

→ Toujours dans le détail, **« Résumer cette note en une phrase »** fait
rédiger un paragraphe. Il ne doit contenir **aucun chiffre absent de la
ventilation juste au-dessus**. Si tu en vois un inventé, c'est un vrai bug :
signale-le.

### Au passage : « Où on en est »

En haut du voyage, un bloc doit lister ce qui bloque : « 3 personnes n'ont pas
encore rejoint », « Personne n'a encore voté »… avec, sous chaque ligne, **ce
que ça empêche**. Les vrais blocages portent une icône dorée et passent en
premier.

→ Vérifie qu'**aucun prénom n'apparaît**. C'est volontaire : on compte, on
n'accuse personne.

→ Le bloc doit disparaître complètement une fois la destination arrêtée et
tout le monde ayant répondu. Un écran qui félicite prend de la place pour rien.

## 3. Inviter quelqu'un

11. **Participants → Créer un lien d'invitation**.
    → Un code de 8 caractères, sans lettre ambiguë (ni O contre 0, ni I contre 1).
12. **QR code** → un carré noir et blanc doit s'afficher.
13. Copie le lien.

## 4. Rejoindre en tant qu'ami

14. Ouvre le lien dans une **fenêtre de navigation privée**.
    → Tu dois atterrir directement sur **Vos envies**, sans avoir rien créé ni
    saisi de mot de passe.
15. Mets un budget plus bas (200 €) et des envies **opposées** aux tiennes :
    Culture sur *Essentiel*, Fête sur *Non merci*.
16. **Enregistrer mes envies**.

## 5. Le moment qui compte

17. **Reviens sur la première fenêtre, sans la recharger.**

→ Le nombre de participants doit passer à 2, et **le classement doit changer
tout seul**. C'est la preuve que la synchronisation en direct fonctionne.

→ Le budget retenu doit être **le plus bas des deux** (200 €), pas le tien.
C'est visible dans le détail du prix de chaque destination.

Si rien ne bouge sans rechargement : tout le reste marche quand même,
signale-le simplement. C'est le seul point que je ne peux pas vérifier à
distance.

## 6. Voter et trancher

18. Depuis les deux fenêtres, vote sur des destinations différentes.
    Recliquer sur son propre choix doit le retirer.
19. → Une destination se badge **« Le groupe préfère celle-ci »**. Si elle
    n'est pas la première du classement, l'écran doit le dire explicitement :
    « Le calcul, lui, plaçait X en tête : c'est le groupe qui décide. »
20. Depuis la fenêtre de l'**ami**, le bouton « Partir à… » ne doit **pas**
    apparaître : seul l'organisateur tranche.
21. Depuis ta fenêtre : **Partir à …**.

## 7. La carte

22. **Voir sur la carte**.
    → Ton point de départ en foncé, la destination retenue en vert, et le
    trajet en pointillés. Avant le verrouillage, tu verrais les six
    destinations numérotées.
23. Touche un repère → la fiche de la ville apparaît en bas.
24. Fais glisser la carte en terminant le geste sur un repère → **rien ne doit
    se sélectionner**.

## 8. L'itinéraire

25. **L'itinéraire jour par jour → Générer l'itinéraire**.
    → Un onglet par journée, chaque créneau avec son heure, son budget et
    **la raison de sa présence**.
26. Cherche la mention **« Réservé pour … , dont c'est la première envie »** :
    chaque participant doit retrouver au moins une de ses envies au programme.
27. → **Aucun nom de restaurant ou de musée précis** ne doit apparaître. Le
    moteur donne la structure, pas des lieux qu'il n'a pas relevés.
28. **Ajouter un lieu à cette journée** : mets un vrai endroit trouvé de ton
    côté, avec une heure. → Il doit se placer **au bon moment** de la journée,
    pas à la fin.
29. Monte-le, descends-le, supprime-le.
30. Depuis la fenêtre de l'ami : la même journée doit refléter tes ajouts.

## 8 bis. Les vrais lieux

Une fois la destination verrouillée :

22. Onglet **Itinéraire** → **Ajouter un lieu à cette journée**.

→ Au-dessus du champ de saisie, une liste de vrais lieux de la ville doit
apparaître, avec pour certains une photo et deux phrases de description. Ils
viennent d'OpenStreetMap et de Wikipédia — **rien n'est inventé**.

→ L'ordre suit les envies du groupe : si vous avez mis Culture sur *Essentiel*,
les musées doivent être devant les centres commerciaux.

→ Tape `belv` dans la recherche : les belvédères doivent remonter, accents
ignorés.

→ Clique sur un lieu : son nom remplit le champ « Quoi ? ». Tu peux encore le
corriger, et le champ reste libre — aucun catalogue ne connaît la crêperie que
ton cousin a recommandée.

23. Onglet **Carte**.

→ La carte doit maintenant zoomer sur la ville et montrer les lieux en petits
points dorés autour de la destination. Avant le verrouillage, ils ne doivent
**pas** apparaître : on compare des villes, pas des musées.

⚠️ Ce que tu ne dois **pas** voir : des restaurants ou des bars. C'est
volontaire — OpenStreetMap en connaît des milliers par ville sans note ni prix
fiables, et les proposer reviendrait à recommander au hasard.

## 8 ter. Couper le réseau

24. Charge le voyage normalement, puis **active le mode avion** et recharge la
    page.

→ Un bandeau doré doit apparaître en haut : « Hors réseau — vous voyez la
dernière version connue de vos voyages. »

→ **L'écran doit s'afficher tout de suite**, pas après six secondes de rond
qui tourne : le voyage, l'itinéraire, la carte et les dépenses viennent du
cache gardé sur l'appareil.

→ Rallume le réseau : le bandeau disparaît et les données se rafraîchissent
sans que tu aies à recharger.

C'est le scénario du vrai voyage : dans l'avion, dans le métro, à l'étranger
sans forfait.

## 9. Installer l'application

31. Sur téléphone : Safari → Partager → **Sur l'écran d'accueil**, ou Chrome →
    **Installer l'application**.
    → Icône Tripora, plein écran, pas de barre d'adresse.
32. Coupe le réseau et rouvre : le voyage déjà consulté doit rester lisible.
    → La carte affichera un fond gris avec « Fond de carte indisponible hors
    ligne. Les repères restent à leur place. »

---

## Ce qui ne marche pas encore, et c'est normal

| Fonction | Pourquoi |
|---|---|
| Assistant conversationnel (poser une question, faire modifier l'itinéraire) | Phase suivante |
| Hôtels et comparaison de transports | Phase suivante |
| Dépenses en plusieurs devises | Phase suivante |
| Liens de réservation affiliés | Attend `TRAVELPAYOUTS_MARKER`, entièrement facultatif |

## Ce qu'il faut me signaler

Dans l'ordre d'utilité :

1. **Un écran bloqué** sur un rond qui tourne, plus de quelques secondes.
2. **Un message d'erreur en anglais** ou incompréhensible — ils doivent tous
   être en français et dire quoi faire.
3. **Un prix affiché sans étiquette** de fraîcheur.
4. Le classement qui ne bouge pas quand quelqu'un renseigne ses envies.
5. **Un chiffre inventé** dans un texte rédigé par l'IA — un prix, une durée,
   une température qui n'apparaît nulle part ailleurs à l'écran. C'est la règle
   la plus importante du projet : l'IA explique, elle ne mesure pas.
6. Tout ce qui te fait hésiter plus de deux secondes sur « je fais quoi
   maintenant ? ».
