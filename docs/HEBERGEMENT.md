# Où l'application est hébergée

Tripora est déployée **deux fois, au même moment, depuis la même branche**.
C'est gratuit des deux côtés et ça règle un problème réel : quand une adresse
ne s'ouvre pas chez quelqu'un, l'autre marche.

| Hébergeur | Adresse | Rôle |
|---|---|---|
| Cloudflare Pages | `https://tripora-3rg.pages.dev` | Premier déploiement |
| Vercel | `https://tripora-git-claude-tripora-travel-pla-21567e-allabdels-projects.vercel.app` | Second déploiement, même code |

Les deux construisent la branche `claude/tripora-travel-planning-app-r3pv5t` à
chaque push, sans carte bancaire et sans quota qu'un groupe d'amis puisse
atteindre.

## L'adresse Vercel est longue, et pourquoi

Vercel donne à chaque branche une adresse stable, mais réserve l'adresse
courte — `tripora.vercel.app` — à la **branche de production**, réglée sur
`main` à la création du projet. Or `main` ne contient qu'un README : l'adresse
courte servirait donc une page vide, ce qui est pire qu'une adresse longue qui
marche.

Deux façons de récupérer l'adresse courte, au choix :

1. **dans le tableau de bord Vercel** — Settings → Git → Production Branch →
   `claude/tripora-travel-planning-app-r3pv5t`, puis redéployer. Dix secondes,
   rien à changer dans le dépôt ;
2. **en amenant le travail sur `main`**, qui redevient alors la branche de
   référence du dépôt. C'est un choix de dépôt plus qu'un choix
   d'hébergement — il change ce que voit quelqu'un qui arrive sur GitHub.

En attendant, l'adresse longue est parfaitement fonctionnelle et se met à jour
à chaque push, exactement comme le ferait la courte.

## Pourquoi deux

Un site peut être parfaitement en ligne et rester injoignable depuis un
appareil précis : un résolveur DNS qui n'a pas encore le domaine, un réseau
d'entreprise ou d'opérateur qui filtre `pages.dev`, un cache local abîmé. Le
symptôme — « Ce site est inaccessible » — ressemble à une panne du serveur
alors que le serveur va bien.

C'est arrivé pendant le développement : `tripora-3rg.pages.dev` répondait 200
avec le bon contenu depuis un réseau tiers, et restait introuvable depuis un
téléphone. Deux adresses sur deux réseaux différents suppriment la question.

## Comment vérifier qu'un déploiement est vivant

Depuis n'importe quel appareil :

1. ouvrir l'adresse en **navigation privée** (élimine le cache et le service
   worker) ;
2. essayer en **données mobiles** plutôt qu'en Wi-Fi (élimine le DNS de la
   box) ;
3. si les données mobiles marchent et pas le Wi-Fi, c'est le résolveur :
   passer le réseau sur `1.1.1.1` ou `8.8.8.8`.

## Configuration Vercel

Tout est dans `vercel.json`, à la racine du dépôt :

- `buildCommand` construit **uniquement** l'application web ; le moteur
  `@tripora/core` est un paquet du monorepo pnpm, résolu par le lien de
  l'espace de travail ;
- `outputDirectory` pointe sur `apps/web/dist` ;
- la règle de réécriture sert `index.html` pour toute adresse sans fichier
  correspondant. C'est ce qui fait qu'un lien d'invitation
  `/rejoindre/ABCD2345` ouvre l'application au lieu d'une 404 — Vercel sert
  d'abord les fichiers réels, la réécriture n'attrape que le reste.

L'équivalent Cloudflare est `apps/web/public/_redirects`. Les deux fichiers
disent la même chose dans deux langues différentes ; changer l'un sans l'autre
casse les liens d'invitation sur un seul des deux hébergeurs.

`installCommand` porte `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` : Playwright est
une dépendance de développement du dépôt, et son script d'installation
télécharge sans ça une centaine de mégaoctets de navigateurs à chaque
construction. Le serveur de construction n'exécute aucun test de navigateur —
c'est `pnpm smoke`, en local, qui s'en charge.

Aucune variable d'environnement à saisir : `apps/web/.env` est versionné et ne
contient que des valeurs publiques par conception — l'URL Supabase et la clé
anonyme, qui n'ouvrent que ce que les politiques RLS autorisent. Les vrais
secrets vivent dans les Edge Functions Supabase et ne touchent jamais un
hébergeur de fichiers statiques.
