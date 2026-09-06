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
   - *Site URL* : l'URL de votre site Pages
   - *Redirect URLs* : `http://localhost:5173/**` et
     `https://VOTRE-SITE.pages.dev/**`

Le motif `/**` compte : l'application redirige vers `/voyages` après connexion,
et vers `/rejoindre/CODE` quand on arrive par une invitation.

### 3. Clés serveur dans Supabase (environ 2 minutes)

**Supabase → Edge Functions → Secrets**, une ligne par clé :

| Nom | Où la trouver | Si absente |
|---|---|---|
| `MISTRAL_API_KEY` | console.mistral.ai | Pas d'assistant ni d'explications rédigées |
| `GEMINI_API_KEY` | aistudio.google.com | Pas de secours quand Mistral sature |
| `GROQ_API_KEY` | console.groq.com | Pas de second secours |
| `GEOAPIFY_API_KEY` | geoapify.com | Repli sur Nominatim et Overpass |

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

Ensuite, dans les secrets Supabase : `TRAVELPAYOUTS_TOKEN` et
`TRAVELPAYOUTS_MARKER`. Sans eux, Tripora fonctionne : tous les prix sont
simplement étiquetés « indicatif », ce qu'il annonce à chaque écran.

⚠️ Régénérer le jeton invalide l'ancien immédiatement.

---

## Vérifier que tout marche

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
