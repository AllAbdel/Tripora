# Mise en place

État au 6 septembre 2026. La base de données et l'application sont branchées :
ce qui reste tient en trois manipulations, listées à la fin.

**Aucune carte bancaire n'est enregistrée nulle part.** À la limite d'un quota
gratuit, la fonction concernée se coupe avec un message ; une facture est
impossible.

---

## Déjà fait

| Élément | État |
|---|---|
| Projet Supabase `tripora` (`eelvllvgnsohznconfpt`, eu-west-3, PostgreSQL 17) | ✅ |
| 21 tables, RLS active partout, politiques testées | ✅ |
| Catalogue des 55 destinations en base | ✅ |
| Durcissement des droits (voir [ARCHITECTURE](ARCHITECTURE.md#sécurité-et-confidentialité)) | ✅ |
| Diffusion temps réel sur les 5 tables collaboratives | ✅ |
| URL et clé publique dans `apps/web/.env`, versionnées | ✅ |
| Comptes Mistral, Groq, Gemini, Geoapify créés | ✅ |

L'URL et la clé « anon » sont **volontairement versionnées** dans
`apps/web/.env`. Elles sont publiques par conception : elles partent de toute
façon dans le JavaScript envoyé au navigateur, où n'importe qui peut les lire.
La sécurité ne repose pas sur leur secret mais sur les politiques RLS. Les
versionner évite d'avoir à saisir des variables sur l'hébergeur : le
déploiement fonctionne dès le premier push.

⚠️ **Vite ne lit jamais `.env.example`.** Seuls `.env`, `.env.local` et
`.env.[mode]` sont chargés. Mettre des valeurs dans `.env.example` ne
configure rien.

---

## Ce qu'il reste à faire

### 1. Activer la connexion anonyme (1 clic)

Sans elle, « J'ai un code d'invitation » échoue : c'est elle qui permet à un
ami de rejoindre un voyage sans créer de compte.

**Supabase → Authentication → Sign In / Providers → Allow anonymous sign-ins**
→ activer.

Pendant que vous y êtes, jetez un œil à **Authentication → Rate Limits** :
la limite d'inscriptions anonymes par heure et par adresse IP est ce qui
empêche un robot d'épuiser le quota gratuit. La valeur par défaut convient ;
ne la montez pas.

### 2. Connexion Google (environ 5 minutes)

Votre erreur venait d'une confusion de champ. Le champ **« Client IDs »** de
Supabase attend l'identifiant délivré par Google, de la forme
`123456789-abcdef.apps.googleusercontent.com` — pas le nom du projet. Il faut
donc d'abord créer le client OAuth chez Google.

**Côté Google**, sur [console.cloud.google.com](https://console.cloud.google.com) :

1. Créez ou choisissez un projet.
2. **APIs & Services → OAuth consent screen** : type *External*, nom de
   l'application « Tripora », votre adresse en contact. Restez en *Testing* et
   ajoutez-vous comme testeur, c'est suffisant entre amis.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application** :
   - *Authorized JavaScript origins* :
     `http://localhost:5173` et l'URL de votre site Cloudflare Pages
   - *Authorized redirect URIs*, exactement ceci :
     ```
     https://eelvllvgnsohznconfpt.supabase.co/auth/v1/callback
     ```
4. Copiez le **Client ID** et le **Client secret**.

**Côté Supabase**, **Authentication → Sign In / Providers → Google** :

5. Activez le fournisseur, collez le Client ID dans « Client IDs » et le
   secret dans « Client Secret ». Le champ « Callback URL » y est en lecture
   seule : c'est celui que vous venez de coller chez Google.
6. **Authentication → URL Configuration** :
   - *Site URL* : l'adresse principale du site
   - *Redirect URLs* : **une ligne par adresse d'où l'on se connecte**

     ```
     http://localhost:5173/**
     https://tripora-3rg.pages.dev/**
     https://tripora-allabdels-projects.vercel.app/**
     https://tripora-git-claude-tripora-travel-pla-21567e-allabdels-projects.vercel.app/**
     ```

     La dernière ligne est l'adresse de préversion de la branche. Vercel en
     crée une par branche, et c'est celle-là qu'on ouvre quand on teste un
     déploiement avant qu'il devienne la production.

Le motif `/**` compte : l'application redirige vers `/voyages` après connexion,
et vers `/rejoindre/CODE` quand on arrive par une invitation.

⚠️ **Une adresse absente de cette liste casse la connexion Google, et elle
seule.** Le retour de Google est refusé par Supabase et on revient à l'écran de
connexion sans explication. Le mode local et l'entrée par code d'invitation
continuent de fonctionner — ce qui rend le symptôme trompeur. Chaque nouvel
hébergeur ajoute donc une ligne ici.

#### Deux pannes qui se ressemblent, et ne se corrigent pas au même endroit

L'écran de connexion affiche désormais ce que le retour de Google disait, ce
qui permet de les séparer :

| Ce qui s'affiche | Où est le problème |
|---|---|
| « Le retour de Google n'a pas abouti » | L'adresse d'où l'on se connecte manque dans **Redirect URLs**, ci-dessus |
| « Google a répondu, le serveur n'a pas pu conclure » (*unable to exchange external code*) | Les **identifiants Google** dans Supabase → Authentication → Providers → Google |

Le second cas ne doit rien aux redirections : Google a accepté la connexion et
délivré un code, et c'est Supabase qui échoue ensuite à l'échanger contre une
session, **de serveur à serveur**. Google refuse donc la paire qu'on lui
présente. Dans l'ordre :

1. Dans Google Cloud → *APIs & Services* → *Credentials*, ouvrez le client
   OAuth de type **Web application** — celui dont l'identifiant est déjà collé
   dans Supabase, pas un autre.
2. Vérifiez que **Authorized redirect URIs** contient exactement
   `https://eelvllvgnsohznconfpt.supabase.co/auth/v1/callback`, sans barre
   oblique finale.
3. Générez un nouveau **Client secret** et recollez-le dans Supabase avec le
   Client ID **du même client**, sans espace avant ni après, puis
   enregistrez.

Un secret régénéré, effacé, ou pris sur un autre client OAuth que son
identifiant produit très exactement ce message.

### 3. Clés serveur dans Supabase (environ 2 minutes)

**Supabase → Edge Functions → Secrets**, une ligne par clé :

| Nom | Où la trouver | Si absente |
|---|---|---|
| `GEMINI_API_KEY` | aistudio.google.com | Premier fournisseur d'IA : Groq prend le relais |
| `GROQ_API_KEY` | console.groq.com | Secours immédiat |
| `GEOAPIFY_API_KEY` | geoapify.com | Repli sur Nominatim et Overpass |
| `MISTRAL_API_KEY` | console.mistral.ai | Troisième secours seulement |

Les trois clés d'IA sont posées et vérifiées. Une remarque sur Mistral :
sur ce compte, `mistral-small` répond **429 « Rate limit exceeded » en 90 ms**,
c'est-à-dire un refus immédiat et non une saturation passagère. L'offre
gratuite de Mistral demande une validation par numéro de téléphone sur
console.mistral.ai ; tant qu'elle n'est pas faite, Gemini et Groq assurent le
service et Mistral est simplement sauté. Il n'y a rien à corriger dans le code.

Si aucune des trois n'est renseignée, la saisie en langage naturel et le
résumé rédigé **disparaissent de l'écran** au lieu d'afficher un bouton qui
échoue. Tout le reste de Tripora fonctionne à l'identique.

Ces clés ne doivent **jamais** aller dans `apps/web` : tout ce qui commence par
`VITE_` est public.

### 4. Cloudflare Pages

Le code vit sur la branche `claude/tripora-travel-planning-app-r3pv5t`.
Dans **Workers & Pages → votre projet → Settings → Build** :

- *Production branch* : `claude/tripora-travel-planning-app-r3pv5t`
- *Build command* : `pnpm install && pnpm --filter @tripora/web build`
- *Build output directory* : `apps/web/dist`
- Variable : `NODE_VERSION` = `22`

Aucune variable `VITE_` à saisir : elles sont dans `apps/web/.env`.

Le fichier `apps/web/public/_redirects` est indispensable et déjà en place :
sans lui, ouvrir directement un lien d'invitation
(`/rejoindre/ABCD2345`) renverrait une 404, et tout le partage serait cassé.

### 5. Travelpayouts, pour les vrais prix (plus tard)

Vous ne trouviez pas les outils développeur : ils ne sont pas là où la
documentation le laisse croire. Le jeton se récupère à l'un de ces deux
endroits :

- **Profil → onglet « API token »** de votre compte Travelpayouts ;
- ou directement <https://www.travelpayouts.com/programs/100/tools/api>.

Ensuite, dans les secrets Supabase : `TRAVELPAYOUTS_TOKEN`. C'est fait, et
les prix relevés arrivent bien.

#### Et le « marker », alors ?

**Vous n'en avez pas besoin, et c'est pour ça que vous ne le trouvez pas sous
ce nom.** Le marker n'est pas une seconde clé à générer : c'est simplement
votre **identifiant de partenaire**, un nombre à six chiffres affiché en bas à
gauche du tableau de bord Travelpayouts, souvent écrit « ID » ou « Partner ID »
plutôt que « marker ». Certains comptes l'affichent aussi dans l'URL du
tableau de bord.

À quoi il sert : uniquement à **toucher une commission** si quelqu'un réserve
en passant par un lien Tripora. Il s'ajoute aux liens de réservation, pas aux
requêtes de prix. L'API de données, elle, n'a besoin que du jeton.

Autrement dit : Tripora affiche déjà les vrais prix sans marker, et continuera
très bien sans. Le jour où vous voudrez que les liens « Réserver » soient
affiliés, ajoutez le secret `TRAVELPAYOUTS_MARKER` avec ce nombre — rien
d'autre à changer.

⚠️ Régénérer le jeton invalide l'ancien immédiatement.

---

## Vérifier que tout marche

### Le parcours automatisé

```bash
pnpm --filter @tripora/web build     # en mode local, sans clés
pnpm --filter @tripora/web smoke
```

Il ouvre un vrai navigateur sur le bundle de production, crée un voyage en six
étapes, vérifie les propositions, le climat, le détail d'une note, puis coupe
le réseau et s'assure que l'écran reste lisible. Seize vérifications.

C'est le seul filet qui attrape ce que ni TypeScript ni les tests unitaires ne
voient — il a déjà trouvé un plantage au rechargement hors réseau.

Dans un conteneur qui fournit son propre Chromium :
`SMOKE_CHROMIUM=/chemin/vers/chrome pnpm --filter @tripora/web smoke`.


1. Ouvrez le site, connectez-vous avec Google.
2. Créez un voyage : vous devez obtenir des destinations notées et chiffrées.
3. **Participants → Créer un lien d'invitation**.
4. Ouvrez ce lien dans une fenêtre de navigation privée : vous devez atterrir
   sur « Vos envies » sans avoir rien créé.
5. Renseignez des envies très différentes, validez.
6. Revenez sur la première fenêtre : **le classement doit changer tout seul**,
   sans rechargement. C'est la preuve que le temps réel fonctionne.

Si l'étape 6 ne bouge pas, le reste marche quand même : signalez-le, la
diffusion temps réel est le seul point que l'environnement de développement ne
peut pas vérifier à distance.

---

## Sans aucune clé

Déjà câblées, ni compte ni inscription :

| Source | Ce qu'elle apporte |
|---|---|
| [OpenFreeMap](https://openfreemap.org) | Fond de carte vectoriel, sans limite |
| [Open-Meteo](https://open-meteo.com) | Météo et normales climatiques |
| [Frankfurter](https://frankfurter.dev) | Taux de change de la Banque centrale européenne |
| [Overpass](https://overpass-api.de) / OpenStreetMap | Points d'intérêt |
| Wikipédia et Wikivoyage | Descriptions et photos |

## Travailler sur la base de données

Les migrations suivent la convention horodatée de Supabase et l'historique du
projet en ligne est aligné : `supabase db push` fonctionne.

Pour tester le schéma et les politiques **sans toucher au projet en ligne**,
sans réseau et sans consommer de quota :

```bash
./supabase/tests/run.sh
```

Le script rejoue toutes les migrations sur un PostgreSQL local, avec une
doublure du schéma `auth` de Supabase, puis vérifie qu'un intrus ne voit rien
et que le scénario complet de collaboration se déroule correctement.
