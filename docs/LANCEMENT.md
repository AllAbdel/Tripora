# Lancement : fiche Play Store et référencement

Ce qui est prêt dans le code, et ce qui reste à faire de ton côté (comptes,
formulaires). Les textes ci-dessous sont à copier tels quels ; ils décrivent
ce que l'application fait vraiment — la fiche du Play Store doit dire la même
chose que la page de confidentialité, sinon Google refuse la publication.

## 1. Fiche Google Play

**Nom de l'application** (30 caractères max) :

> Tripora : voyage entre amis

**Description courte** (80 caractères max) :

> Organisez un voyage à plusieurs : envies, budget, vote, programme et dépenses.

**Description complète** :

> Partir à plusieurs, c'est quinze conversations, trois tableurs et personne
> qui tranche. Tripora met tout le groupe au même endroit, du « on part où ? »
> au « qui doit combien ? ».
>
> TROUVER OÙ PARTIR
> Chacun dit ses envies (culture, nature, fête, gastronomie, détente…) et son
> budget. Tripora propose les destinations qui conviennent au groupe entier —
> pas seulement à celui qui organise — avec le vrai prix des vols relevé
> depuis votre ville, le climat du mois et le budget sur place.
>
> DÉCIDER ENSEMBLE
> Votez pour les destinations, faites des sondages de dates ou de logement, et
> découvrez les activités en les faisant glisser, comme des cartes : le groupe
> voit ce qui plaît, sans savoir qui a dit non.
>
> UN PROGRAMME JOUR PAR JOUR
> 2 100 activités dans près de 400 destinations, avec leur durée, leur prix et
> le meilleur moment de la journée. Tripora compose les journées, vous les
> ajustez, et tout s'affiche sur la carte.
>
> PENDANT LE VOYAGE
> Le coffre garde les codes, le wifi, les adresses et les billets, même sans
> réseau. La valise se prépare à plusieurs. Les rappels arrivent la veille du
> départ et avant chaque vol.
>
> LES COMPTES À LA FIN
> Chacun note ses dépenses, en toutes devises. Tripora calcule qui doit quoi
> au plus simple, et vous remboursez d'un geste (PayPal, Revolut, Wise,
> virement).
>
> ET AUSSI
> Les trips ouverts pour rejoindre un groupe qui part déjà, le bilan du voyage
> à partager, le passeport de vos pays visités.
>
> Gratuit, sans publicité, sans revente de données. Connexion avec Google, ou
> avec un simple code d'invitation.

**Catégorie** : Voyages et infos locales.
**Adresse e-mail de contact** : celle de la page de confidentialité.
**Site web** : https://tripora-3rg.pages.dev
**Règles de confidentialité** : https://tripora-3rg.pages.dev/confidentialite
**Suppression du compte** (URL demandée par Google) :
https://tripora-3rg.pages.dev/confidentialite — rubrique « Vos droits », qui
explique Profil → « Supprimer mon compte », et l'adresse e-mail pour qui n'a
plus l'application.

**Captures d'écran** (au moins 2, idéalement 6, format téléphone) : les
propositions de destinations avec leurs prix, le vote, Découvrir (les cartes
qui glissent), l'itinéraire sur la carte, « Qui doit quoi », le coffre.

**Public cible** : 18 ans et plus. Les trips ouverts mettent en relation des
inconnus : déclarer un public plus jeune ferait entrer l'application dans le
programme « Familles », aux règles beaucoup plus strictes.

## 2. Formulaire « Sécurité des données »

À remplir dans la Play Console, d'après ce que l'application fait (voir
`apps/web/src/routes/Confidentialite.tsx`). À relire avant d'envoyer : c'est
une déclaration faite en ton nom.

- **Données chiffrées en transit** : oui (HTTPS partout).
- **Suppression des données sur demande** : oui, dans l'application et par
  e-mail.
- **Partage avec des tiers** : non pour l'essentiel. Les prix de vol partent
  vers Travelpayouts sans donnée personnelle, et les covoyageurs ne sont pas
  des tiers. Seule réserve : l'assistant IA envoie aux fournisseurs d'IA des
  informations de voyage pseudonymisées (« Participant A, B »), et leurs
  offres gratuites peuvent les réutiliser. Dans le doute, déclarer
  « Activité dans l'application » partagée avec eux.
- **Données collectées** (toutes « nécessaires au fonctionnement », aucune
  pour la publicité) :
  - Informations personnelles : nom, adresse e-mail (compte Google) ;
    facultatif : genre et année de naissance (trips ouverts réservés).
  - Informations financières : autres informations financières (IBAN,
    identifiants PayPal, Revolut, Wise — facultatif, pour être remboursé) ;
    les dépenses du voyage.
  - Messages : messages dans l'application (discussion du voyage).
  - Photos et fichiers : documents du coffre (billets, confirmations).
  - Activité dans l'application : votes, envies, sondages, tâches.
- **Non collectées** : position (la ville de départ est saisie, jamais
  mesurée), contacts, identifiants publicitaires, historique de navigation.

## 3. Référencement (Google)

Déjà en place dans le code :

- 389 pages publiques « Que faire à … » (`/destinations/<id>`), leur
  sommaire (`/destinations`) et 12 pages « Où partir en <mois> ? »
  (`/ou-partir-en/octobre`…), écrites en HTML au moment du build ;
- `sitemap.xml` et `robots.txt` à la racine du site ;
- liens canoniques vers https://tripora-3rg.pages.dev (le même site servi par
  Vercel ne fait pas doublon) ;
- données structurées schema.org sur chaque page.

À faire de ton côté, une seule fois :

1. Ouvrir https://search.google.com/search-console et ajouter la propriété
   « Préfixe de l'URL » : `https://tripora-3rg.pages.dev`.
2. Méthode de validation « Balise HTML » : Google donne une ligne
   `<meta name="google-site-verification" content="…">`. **Envoie-moi la
   valeur de `content`** : elle est publique, je l'ajoute au site.
3. Une fois validé : Sitemaps → ajouter `sitemap.xml`.
4. Facultatif : https://www.bing.com/webmasters → « Importer depuis Google
   Search Console » (Bing, DuckDuckGo et Ecosia en profitent).

Si tu achètes un jour un nom de domaine, il suffira de changer
`VITE_SITE_ORIGIN` dans `apps/web/.env` : liens canoniques et plan du site
suivront.

## 4. À vérifier avant de toucher des commissions

La page de mentions légales dit que Tripora est édité par un particulier
« non professionnel », ce qui dispense de publier une adresse postale. Dès que
tu déclares une activité (micro-entreprise pour les commissions), la loi
demande d'y indiquer ton nom, ton adresse et ton numéro SIRET. Dis-le-moi le
jour venu : je mettrai la page à jour.
