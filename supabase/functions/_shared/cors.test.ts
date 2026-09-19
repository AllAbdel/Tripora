/**
 * Le mur invisible : la requête préalable qui refusait toutes les fonctions.
 *
 *   deno test supabase/functions/_shared/cors.test.ts
 *
 * Le client Supabase de l'application ajoute `x-application-name` à chacune
 * de ses requêtes. La liste d'en-têtes autorisés, écrite à la main ici, ne le
 * mentionnait pas : le navigateur refusait donc l'appel avant même de
 * l'envoyer, pour l'IA comme pour les prix, la météo ou le géocodage.
 *
 * Rien ne l'attrapait, parce qu'une fonction interrogée en ligne de commande
 * répond parfaitement : curl n'envoie jamais de requête préalable. Ces tests
 * en fabriquent une, ce qui est la seule façon de voir le mur sans ouvrir un
 * navigateur.
 *
 * Aucune dépendance : ce fichier tourne hors ligne.
 */
import { preflight } from './cors.ts';

function egal(obtenu: unknown, attendu: unknown, quoi: string): void {
  if (obtenu !== attendu) {
    throw new Error(`${quoi} : attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
  }
}

/** La requête que le navigateur envoie avant l'appel, telle quelle. */
function requetePrealable(entetes: string): Request {
  return new Request('https://exemple.test/functions/v1/ai', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://tripora-3rg.pages.dev',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': entetes,
    },
  });
}

Deno.test('autorise les en-têtes que le navigateur annonce', () => {
  // Exactement ceux que le client Supabase envoie, « x-application-name »
  // compris : c'est cette demande-là qui était refusée.
  const demandes = 'authorization, content-type, apikey, x-client-info, x-application-name';
  const reponse = preflight(requetePrealable(demandes));

  egal(reponse?.status, 200, 'la requête préalable reçoit une réponse');
  egal(
    reponse?.headers.get('Access-Control-Allow-Headers'),
    demandes,
    'les en-têtes demandés reviennent tels quels',
  );
});

Deno.test('autorise aussi un en-tête que personne n’avait prévu', () => {
  // Le vrai défaut n'était pas l'oubli d'un nom, c'était une liste tenue à la
  // main dans les fonctions pendant que le client évoluait ailleurs. Un
  // en-tête inventé pour ce test doit passer, sinon la dérive peut revenir.
  const reponse = preflight(requetePrealable('authorization, x-une-idee-de-demain'));
  egal(
    reponse?.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-une-idee-de-demain',
    'un en-tête inconnu passe',
  );
});

Deno.test('répond avec les en-têtes connus quand rien n’est demandé', () => {
  const nue = new Request('https://exemple.test/functions/v1/ai', { method: 'OPTIONS' });
  const autorises = preflight(nue)?.headers.get('Access-Control-Allow-Headers') ?? '';

  for (const entete of ['authorization', 'apikey', 'content-type', 'x-application-name']) {
    if (!autorises.includes(entete)) {
      throw new Error(`« ${entete} » manque à la liste par défaut : ${autorises}`);
    }
  }
});

Deno.test('la réponse varie avec la demande, et se garde en cache', () => {
  const reponse = preflight(requetePrealable('authorization'));

  egal(
    reponse?.headers.get('Vary'),
    'Access-Control-Request-Headers',
    'un cache ne doit pas resservir cette réponse à un client différent',
  );
  egal(reponse?.headers.get('Access-Control-Max-Age'), '3600', 'la requête préalable est gardée');
});

Deno.test('laisse passer ce qui n’est pas une requête préalable', () => {
  const appel = new Request('https://exemple.test/functions/v1/ai', { method: 'POST' });
  egal(preflight(appel), null, 'un POST n’est pas intercepté');
});
