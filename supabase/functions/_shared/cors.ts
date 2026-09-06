/**
 * L'application est servie depuis Cloudflare Pages, les fonctions depuis
 * Supabase : chaque appel est donc « cross-origin » et le navigateur envoie
 * d'abord une requête OPTIONS. Sans réponse à celle-ci, aucun appel ne passe.
 */
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

export function preflight(request: Request): Response | null {
  return request.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
