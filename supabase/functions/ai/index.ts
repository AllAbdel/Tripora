import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import {
  AucuneIA,
  demanderIA,
  extraireJson,
  fournisseursDisponibles,
} from '../_shared/ia.ts';

/**
 * Le point d'entrée unique de l'IA.
 *
 * Deux tâches aujourd'hui, toutes deux en bordure du produit et jamais en son
 * centre :
 *
 *   `parse`    une phrase libre — « on est 5, depuis Lyon, une semaine en
 *              octobre, 400 € max, plutôt fête et bouffe » — devient un
 *              brouillon de formulaire. L'utilisateur voit et corrige tout
 *              avant que quoi que ce soit ne soit calculé.
 *
 *   `explain`  une note déjà calculée devient un paragraphe lisible. Les
 *              chiffres sont fournis dans la consigne ; le modèle n'a le droit
 *              que de les recopier. Il ne classe pas, il ne compare pas, il
 *              n'invente pas de prix.
 *
 * Ce qui ne passe jamais par ici : le classement des destinations, les prix,
 * les distances, la répartition des dépenses. Tout cela est du code testé, et
 * le reste. Si les trois fournisseurs sont muets, l'application perd deux
 * commodités et garde toutes ses fonctions.
 *
 * Aucune donnée personnelle n'est transmise : les offres gratuites autorisent
 * l'entraînement sur ce qu'on leur envoie. Les corps de requête acceptés
 * ci-dessous ne comportent volontairement ni nom, ni e-mail, ni identifiant.
 */

/** Un compte peut demander 40 réponses par jour ; au-delà, l'app continue sans. */
const PLAFOND_PAR_PERSONNE = 40;
/** Une même question posée par cinq personnes ne coûte qu'un appel. */
const TTL_CACHE_SECONDES = 7 * 24 * 60 * 60;

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  const disponibles = fournisseursDisponibles();
  if (disponibles.length === 0) {
    // Pas une erreur : une fonctionnalité qui n'est pas branchée. L'écran
    // masque simplement l'entrée en langage naturel.
    return json({ configured: false, providers: [] });
  }

  let demande: { task?: string; input?: unknown };
  try {
    demande = await request.json();
  } catch {
    return json({ error: 'Corps de requête illisible' }, 400);
  }

  // Sonde de configuration : sert à l'écran pour savoir s'il doit proposer la
  // saisie en langage naturel. Ne consomme aucun quota, n'appelle aucun modèle.
  if (demande.task === 'status') {
    return json({ configured: true, providers: disponibles });
  }

  const utilisateur = await identifier(request);
  if (!utilisateur) return json({ error: 'Connexion requise' }, 401);

  const client = serviceClient();

  const { data: quota } = await client.rpc('bump_user_ai_quota', {
    p_user_id: utilisateur,
    p_limit: PLAFOND_PAR_PERSONNE,
  });
  const ligne = Array.isArray(quota) ? quota[0] : quota;
  if (ligne && ligne.allowed === false) {
    return json({ configured: true, quotaExceeded: true, limit: PLAFOND_PAR_PERSONNE });
  }

  try {
    switch (demande.task) {
      case 'parse':
        return await parser(client, demande.input);
      case 'explain':
        return await expliquer(client, demande.input);
      default:
        return json({ error: 'Tâche inconnue' }, 400);
    }
  } catch (cause) {
    if (cause instanceof AucuneIA) {
      console.warn('ai: aucun fournisseur', cause.detail);
      return json({ configured: true, unavailable: true, detail: cause.detail });
    }
    console.error('ai', cause);
    return json({ configured: true, failed: true });
  }
});

/** L'identifiant sert au compteur de quota, et ne part jamais au modèle. */
async function identifier(request: Request): Promise<string | null> {
  const entete = request.headers.get('authorization');
  if (!entete?.startsWith('Bearer ')) return null;
  const client = serviceClient();
  const { data } = await client.auth.getUser(entete.slice(7));
  return data.user?.id ?? null;
}

// ---------------------------------------------------------------- tâche parse

const CONSIGNE_PARSE = `Tu convertis une phrase en français décrivant une envie de voyage en un objet JSON.

Réponds UNIQUEMENT par un objet JSON, sans texte autour, avec ces clés (toutes facultatives, omets celles que la phrase ne mentionne pas) :
- participants : entier, nombre de voyageurs
- durationDays : entier, nombre de jours
- month : entier 1-12, mois visé
- budgetPerPersonCents : entier, budget maximum par personne EN CENTIMES (450 € = 45000)
- comfortLevel : "budget" | "standard" | "comfort"
- groupType : "friends" | "couple" | "family" | "solo"
- destination : nom de ville si une ville précise est nommée
- origin : nom de la ville de départ si elle est nommée
- weights : objet dont les clés sont culture, nature, food, nightlife, relax, adventure, shopping, offbeat et les valeurs des nombres DÉCIMAUX entre 0 et 1 (0.8, jamais 8)

Règles strictes :
- N'invente rien. Ce qui n'est pas dit n'apparaît pas dans le JSON.
- "un week-end" = 3 jours. "une semaine" = 7 jours. "quinze jours" = 14 jours.
- "pas cher", "petit budget" = comfortLevel "budget". "confort", "sans se priver" = "comfort".
- Ne déduis un budget que d'un montant explicitement cité.
- Ne mets dans weights que les envies évoquées. Une envie non citée est absente, pas à zéro.`;

async function parser(
  client: ReturnType<typeof serviceClient>,
  entree: unknown,
): Promise<Response> {
  const phrase = typeof entree === 'string' ? entree.trim() : '';
  if (phrase.length < 3) return json({ error: 'Phrase trop courte' }, 400);
  if (phrase.length > 600) return json({ error: 'Phrase trop longue' }, 400);

  const cle = await empreinte('parse', phrase);
  const enCache = await lireCacheIA<Record<string, unknown>>(client, cle);
  if (enCache) return json({ configured: true, draft: enCache, cached: true });

  const { valeur, fournisseur } = await demanderIA({
    tache: 'parse',
    systeme: CONSIGNE_PARSE,
    message: phrase,
    json: true,
    maxTokens: 400,
    valider: brouillonPlausible,
  });

  await ecrireCacheIA(client, cle, 'parse', fournisseur, valeur);
  return json({ configured: true, draft: valeur, provider: fournisseur });
}

/**
 * Contrôle minimal avant de mettre en cache : le modèle a-t-il renvoyé un
 * objet contenant au moins un champ que nous connaissons ?
 *
 * La validation stricte — bornes, types, longueurs — vit dans `sanitizeDraft`,
 * côté application : c'est là que le brouillon entre dans un formulaire, et un
 * seul endroit doit décider de ce qui est acceptable. Ici on se contente
 * d'écarter les réponses hors sujet, pour ne pas les mémoriser une semaine et
 * pour laisser sa chance au fournisseur suivant.
 */
export function brouillonPlausible(brut: string): Record<string, unknown> | null {
  const objet = extraireJson(brut);
  if (typeof objet !== 'object' || objet === null || Array.isArray(objet)) return null;
  const source = objet as Record<string, unknown>;
  const reconnu = CHAMPS.some((champ) => source[champ] !== undefined && source[champ] !== null);
  return reconnu ? source : null;
}

const CHAMPS = [
  'participants',
  'durationDays',
  'month',
  'budgetPerPersonCents',
  'comfortLevel',
  'groupType',
  'destination',
  'origin',
  'weights',
] as const;

// -------------------------------------------------------------- tâche explain

const CONSIGNE_EXPLAIN = `Tu rédiges, en français, l'explication d'une note de destination déjà calculée par un moteur.

Règles absolues :
- Tu n'as le droit d'utiliser QUE les chiffres fournis. N'en invente aucun, n'en arrondis aucun, n'en ajoute aucun.
- Ne conseille pas, ne recommande pas, ne classe pas. Tu expliques une note, tu ne prends pas de décision à la place du groupe.
- N'invente aucun lieu, aucun restaurant, aucun quartier.
- Ne t'adresse à personne nommément. Les voyageurs sont « le groupe ».
- 2 à 3 phrases, 60 mots maximum, ton direct et concret, sans superlatif publicitaire.
- Commence par ce qui pèse le plus dans la note, positif ou négatif. Si un point est mauvais, dis-le.
- Écris un paragraphe simple, sans titre, sans liste, sans markdown.`;

async function expliquer(
  client: ReturnType<typeof serviceClient>,
  entree: unknown,
): Promise<Response> {
  const faits = typeof entree === 'string' ? entree.trim() : '';
  if (faits.length < 10 || faits.length > 2000) {
    return json({ error: 'Faits absents ou trop longs' }, 400);
  }

  const cle = await empreinte('explain', faits);
  const enCache = await lireCacheIA<{ text: string }>(client, cle);
  if (enCache) return json({ configured: true, text: enCache.text, cached: true });

  const { valeur, fournisseur } = await demanderIA({
    tache: 'explain',
    systeme: CONSIGNE_EXPLAIN,
    message: faits,
    maxTokens: 220,
    valider: (brut) => {
      const texte = brut.replace(/[*_#`]/g, '').trim();
      // Une réponse d'un mot, ou un pavé : dans les deux cas le modèle n'a pas
      // suivi la consigne, et le fournisseur suivant fera mieux.
      if (texte.length < 40 || texte.length > 700) return null;
      return { text: texte };
    },
  });

  await ecrireCacheIA(client, cle, 'explain', fournisseur, valeur);
  return json({ configured: true, text: valeur.text, provider: fournisseur });
}

// ----------------------------------------------------------------- cache d'IA

/** SHA-256 de la tâche et de son entrée : même question, même réponse, zéro appel. */
async function empreinte(tache: string, entree: string): Promise<string> {
  const octets = new TextEncoder().encode(`${tache} ${entree}`);
  const hash = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(hash))
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('');
}

async function lireCacheIA<T>(
  client: ReturnType<typeof serviceClient>,
  cle: string,
): Promise<T | null> {
  const { data } = await client
    .from('ai_cache')
    .select('output, expires_at')
    .eq('input_hash', cle)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;
  return data.output as T;
}

async function ecrireCacheIA(
  client: ReturnType<typeof serviceClient>,
  cle: string,
  tache: string,
  fournisseur: string,
  sortie: unknown,
): Promise<void> {
  await client.from('ai_cache').upsert(
    {
      input_hash: cle,
      task: tache,
      provider: fournisseur,
      output: sortie,
      expires_at: new Date(Date.now() + TTL_CACHE_SECONDES * 1000).toISOString(),
    },
    { onConflict: 'input_hash' },
  );
}
