# Mise en place

Cinq comptes gratuits, **aucune carte bancaire**, environ vingt minutes.
Tant que rien n'est configuré, Tripora fonctionne en mode local : l'interface
est explorable, mais rien n'est partagé.

Faites-les dans l'ordre. Après les étapes 1 et 2, l'application est déjà
collaborative ; les suivantes activent l'IA et les prix.

---

## 1. Supabase — base de données, comptes, temps réel

**Gratuit, sans carte.** 500 Mo de base, 50 000 utilisateurs actifs par mois,
500 000 appels de fonctions serveur.

1. Créez un compte sur [supabase.com](https://supabase.com) puis un projet
   nommé `tripora`. Choisissez une région proche (Francfort ou Paris).
2. Notez le mot de passe de la base à la création : il n'est plus affiché ensuite.
3. Une fois le projet prêt : **Settings → API**, copiez `Project URL` et la clé
   `anon public`.
4. Dans le dépôt :
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```
   puis collez les deux valeurs dans `apps/web/.env.local`.
5. Appliquez le schéma. **SQL Editor → New query**, collez le contenu de
   `supabase/migrations/0001_init.sql`, exécutez, puis faites de même avec
   `0002_rls.sql`.

   Avec le [CLI Supabase](https://supabase.com/docs/guides/cli), plus simple :
   ```bash
   supabase link --project-ref VOTRE_REF
   supabase db push
   ```
6. Relancez `pnpm dev`. Le bandeau « mode local » doit avoir disparu.

> **La pause au bout de 7 jours.** Un projet gratuit s'endort après une semaine
> sans requête. Le workflow `.github/workflows/keepalive.yml` s'en charge : dans
> **Settings → Secrets and variables → Actions** du dépôt GitHub, ajoutez
> `SUPABASE_URL` et `SUPABASE_ANON_KEY`.

---

## 2. Connexion Google

**Gratuit, illimité, sans carte.** C'est la seule méthode sans friction :
les courriels intégrés à Supabase sont plafonnés à 2 par heure sur le plan
gratuit, ce qui est inutilisable pour des liens de connexion.

1. Sur [console.cloud.google.com](https://console.cloud.google.com), créez un
   projet, puis **APIs & Services → Credentials → Create credentials → OAuth
   client ID**, type *Web application*.
2. Dans *Authorized redirect URIs*, mettez l'URL que Supabase vous indique dans
   **Authentication → Providers → Google** (de la forme
   `https://VOTRE_REF.supabase.co/auth/v1/callback`).
3. Collez l'identifiant et le secret dans Supabase, puis activez le fournisseur.
4. Toujours dans Supabase, **Authentication → URL Configuration** : ajoutez
   `http://localhost:5173` et l'URL de production aux redirections autorisées.
5. **Authentication → Providers → Anonymous sign-ins** : activez-le, c'est ce
   qui permet de rejoindre un voyage par lien sans rien créer.

---

## 3. Mistral — assistant et rédaction

**Gratuit, sans carte.** Environ un milliard de jetons par mois, ce qui est très
au-delà de ce qu'un groupe d'amis consomme.

1. Créez un compte sur [console.mistral.ai](https://console.mistral.ai) et
   générez une clé d'API.
2. Rangez-la **dans Supabase**, jamais dans l'application :
   **Edge Functions → Secrets** → `MISTRAL_API_KEY`.

> **Confidentialité.** Sur l'offre gratuite, les échanges peuvent servir à
> l'entraînement des modèles. Tripora en tient compte par conception : les
> participants sont anonymisés en « Participant A, B, C » et aucun nom, aucune
> adresse électronique ni aucune position n'est transmis. Vous pouvez aussi
> désactiver l'option dans **Admin → Privacy** de la console Mistral.

Deux secours facultatifs, même principe, à ajouter si vous voulez que
l'assistant reste disponible quand Mistral sature :
`GEMINI_API_KEY` ([aistudio.google.com](https://aistudio.google.com)) et
`GROQ_API_KEY` ([console.groq.com](https://console.groq.com)).

---

## 4. Travelpayouts — prix des vols et des hôtels

**Gratuit, sans carte.** Inscription au programme d'affiliation, sans site web
obligatoire. Les prix proviennent de recherches réelles faites par de vrais
utilisateurs dans les dernières 48 heures : ce ne sont pas des tarifs en direct,
et Tripora l'affiche toujours (« prix vu le … »).

1. Créez un compte sur [travelpayouts.com](https://www.travelpayouts.com).
2. Récupérez le **token** et le **marker** dans les outils développeur.
3. Dans les secrets Supabase : `TRAVELPAYOUTS_TOKEN` et `TRAVELPAYOUTS_MARKER`.

---

## 5. Geoapify — recherche de lieux et géocodage

**Gratuit, sans carte.** 3 000 requêtes par jour, largement suffisant avec le
cache partagé de Tripora.

1. Créez un compte sur [geoapify.com](https://www.geoapify.com) et générez une clé.
2. Dans les secrets Supabase : `GEOAPIFY_API_KEY`.

---

## Sans aucune clé

Ces sources ne demandent ni compte ni inscription, et sont déjà câblées :

| Source | Ce qu'elle apporte |
|---|---|
| [OpenFreeMap](https://openfreemap.org) | Fond de carte vectoriel, sans limite |
| [Open-Meteo](https://open-meteo.com) | Météo et normales climatiques |
| [Frankfurter](https://frankfurter.dev) | Taux de change de la Banque centrale européenne |
| [Overpass](https://overpass-api.de) / OpenStreetMap | Points d'intérêt |
| Wikipédia et Wikivoyage | Descriptions et photos |

---

## Déploiement (Cloudflare Pages)

**Gratuit, sans carte**, trafic illimité.

1. Sur [dash.cloudflare.com](https://dash.cloudflare.com) : **Workers & Pages →
   Create → Pages → Connect to Git**, choisissez le dépôt.
2. Réglages de construction :
   - commande : `pnpm install && pnpm --filter @tripora/web build`
   - dossier de sortie : `apps/web/dist`
   - variable : `NODE_VERSION` = `22`
3. Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables
   d'environnement du projet Pages.
4. Ajoutez l'URL publique (`https://tripora.pages.dev`) aux redirections
   autorisées dans Supabase.

Sur téléphone, ouvrez ensuite l'URL puis **Partager → Sur l'écran d'accueil**
(iPhone) ou **Installer l'application** (Android).

---

## Récapitulatif des secrets

| Où | Nom | Obligatoire | Effet si absent |
|---|---|---|---|
| `apps/web/.env.local` | `VITE_SUPABASE_URL` | oui | Mode local |
| `apps/web/.env.local` | `VITE_SUPABASE_ANON_KEY` | oui | Mode local |
| Secrets Supabase | `MISTRAL_API_KEY` | non | Pas d'assistant ni d'explications rédigées |
| Secrets Supabase | `GEMINI_API_KEY`, `GROQ_API_KEY` | non | Pas de secours quand Mistral sature |
| Secrets Supabase | `TRAVELPAYOUTS_TOKEN`, `_MARKER` | non | « Prix non disponible » sur les vols |
| Secrets Supabase | `GEOAPIFY_API_KEY` | non | Repli sur Nominatim et Overpass |
| Secrets GitHub | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | non | Le projet s'endort après 7 jours |

**Une clé secrète ne va jamais dans `apps/web`.** Tout ce qui commence par
`VITE_` finit dans le code envoyé au navigateur et est donc public. Les clés
Mistral, Travelpayouts et Geoapify vivent uniquement dans les secrets Supabase,
d'où seules les fonctions serveur les lisent.
