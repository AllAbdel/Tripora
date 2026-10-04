/**
 * L'application est servie depuis Cloudflare Pages, les fonctions depuis
 * Supabase : chaque appel est donc « cross-origin » et le navigateur envoie
 * d'abord une requête OPTIONS. Sans réponse à celle-ci, aucun appel ne passe.
 *
 * Cette liste d'en-têtes autorisés était écrite à la main, et il en manquait
 * un : `x-application-name`, que le client Supabase ajoute à chaque requête
 * depuis le premier jour (`apps/web/src/lib/supabase.ts`). Le navigateur
 * refusait donc *toutes* les fonctions — l'IA, les prix de vol, la météo, le
 * géocodage, les lieux, les taux — depuis toujours, et sans bruit :
 * l'application se rabat proprement sur ses estimations hors ligne, si bien
 * que l'écran affichait « montants estimés » là où il fallait lire « le
 * navigateur n'a jamais laissé partir l'appel ».
 *
 * Rien ne pouvait l'attraper : la fonction, interrogée en ligne de commande,
 * répondait parfaitement — curl n'envoie pas de requête préalable. Seul un
 * navigateur voyait le mur.
 *
 * On renvoie désormais les en-têtes que le navigateur annonce vouloir
 * envoyer, au lieu d'une liste tenue ici. Une liste figée dans les fonctions
 * et une configuration de client écrite ailleurs finissent toujours par
 * diverger ; celle-ci ne le peut plus. Cela n'ouvre rien de neuf : l'origine
 * est déjà « * », et la CORS ne décide que de ce qu'une page a le droit de
 * *lire*. Ce qui garde la porte, c'est le JWT vérifié à l'entrée.
 */

/** Ce qu'on autorise quand le navigateur ne demande rien de précis. */
const ENTETES_CONNUS = 'authorization, x-client-info, apikey, content-type, x-application-name';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': ENTETES_CONNUS,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;

  const demandes = request.headers.get('Access-Control-Request-Headers');
  return new Response('ok', {
    headers: {
      ...CORS,
      'Access-Control-Allow-Headers': demandes ?? ENTETES_CONNUS,
      // La réponse dépend de ce que le navigateur a demandé : sans ce
      // `Vary`, un cache intermédiaire pourrait resservir la réponse d'un
      // client à un autre qui n'envoie pas les mêmes en-têtes.
      Vary: 'Access-Control-Request-Headers',
      // Un appel de fonction coûte deux allers-retours : la requête
      // préalable, puis la vraie. Garder la première en cache une heure
      // supprime la moitié de cette latence sur tous les appels suivants.
      'Access-Control-Max-Age': '3600',
    },
  });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
