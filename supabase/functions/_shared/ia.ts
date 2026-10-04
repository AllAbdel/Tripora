/**
 * Client IA multi-fournisseurs.
 *
 * Trois offres gratuites, interrogées dans l'ordre, toutes compatibles avec
 * l'API de conversation d'OpenAI — un seul code les couvre. L'ordre n'est pas
 * une préférence de principe : il vient de ce que chacune a réellement répondu
 * quand on le lui a demandé, le 6 septembre 2026, sur la même phrase.
 *
 *   1. Gemini    extraction complète et correcte, ~700 ms, mode JSON accepté ;
 *   2. Groq      aussi complète, ~250 ms, mais refuse le mode JSON — ses
 *                modèles raisonnent dans un canal séparé et la validation
 *                stricte échoue à vide. On lit donc le JSON dans le texte ;
 *   3. Mistral   le plus gros quota annoncé, mais `mistral-small` répondait
 *                429 en 90 ms sur ce compte. Gardé en dernier : quand il
 *                marche il est excellent, et quand il refuse il ne coûte rien.
 *
 * Les identifiants de modèles vieillissent vite — gemini-2.0-flash et
 * llama-3.3-70b avaient déjà disparu à la première tentative. On privilégie
 * partout les alias « latest », qui suivent les remplacements tout seuls.
 *
 * Quatre règles qui ne se négocient pas :
 *
 *  - **Aucune donnée personnelle ne part.** Les offres gratuites autorisent
 *    l'entraînement sur ce qu'on leur envoie. Les participants deviennent
 *    « Participant A », « Participant B » ; aucun nom, aucun e-mail, aucune
 *    position ne quitte Tripora. La pseudonymisation se fait chez l'appelant,
 *    et `assertAnonyme` refuse ici ce qui aurait glissé entre les mailles.
 *  - **L'IA n'est jamais une source de fait.** Elle reformule des chiffres
 *    déjà calculés ; elle n'en produit aucun.
 *  - **Aucun paiement possible.** Sans moyen de paiement enregistré, un
 *    dépassement est un 429, jamais une facture. Un 429 fait passer au
 *    fournisseur suivant ; les trois épuisés, Tripora continue sans IA.
 *  - **La sortie est validée.** Un modèle qui répond à côté est traité comme
 *    un fournisseur en panne : on passe au suivant.
 */

export type Fournisseur = 'mistral' | 'groq' | 'gemini';

interface Config {
  readonly nom: Fournisseur;
  readonly cleEnv: string;
  readonly url: string;
  /** Modèle léger : compréhension de texte, reformulation. */
  readonly rapide: string;
  /** Modèle plus solide : raisonnement, itinéraire, compromis. */
  readonly soigne: string;
  /** Faux si le fournisseur rejette `response_format: json_object`. */
  readonly modeJson: boolean;
}

const FOURNISSEURS: readonly Config[] = [
  {
    nom: 'gemini',
    cleEnv: 'GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    rapide: 'gemini-flash-lite-latest',
    soigne: 'gemini-flash-latest',
    modeJson: true,
  },
  {
    nom: 'groq',
    cleEnv: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    rapide: 'qwen/qwen3.8-27b',
    soigne: 'openai/gpt-oss-120b',
    modeJson: false,
  },
  {
    nom: 'mistral',
    cleEnv: 'MISTRAL_API_KEY',
    url: 'https://api.mistral.ai/v1/chat/completions',
    rapide: 'mistral-small-latest',
    soigne: 'mistral-medium-latest',
    modeJson: true,
  },
];

export class AucuneIA extends Error {
  constructor(public readonly detail: string) {
    super('Aucun fournisseur d’IA disponible');
    this.name = 'AucuneIA';
  }
}

/** Fournisseurs réellement configurés, dans l'ordre de préférence. */
export function fournisseursDisponibles(): Fournisseur[] {
  return FOURNISSEURS.filter((f) => (Deno.env.get(f.cleEnv) ?? '').length > 0).map((f) => f.nom);
}

export interface DemandeIA<T> {
  /** Nom de la tâche, pour le cache et les journaux. */
  tache: string;
  /** Consigne de rôle. Doit interdire explicitement d'inventer des faits. */
  systeme: string;
  /** Le message, déjà pseudonymisé. */
  message: string;
  /** Vrai pour une tâche de raisonnement, faux pour de la reformulation. */
  soigne?: boolean;
  /** Nombre maximum de jetons en sortie. */
  maxTokens?: number;
  /** Valide et convertit la réponse. Renvoyer `null` rejette le fournisseur. */
  valider: (brut: string) => T | null;
  /**
   * Vrai si la réponse attendue est un objet JSON. Le mode strict n'est activé
   * que chez les fournisseurs qui le supportent ; ailleurs la consigne suffit,
   * et `extraireJson` récupère l'objet dans le texte.
   */
  json?: boolean;
}

export interface ReponseIA<T> {
  valeur: T;
  fournisseur: Fournisseur;
}

/**
 * Interroge les fournisseurs dans l'ordre jusqu'à une réponse valide.
 * Ne lève qu'une fois tous épuisés — et l'appelant doit alors continuer sans
 * IA, pas afficher une erreur.
 */
export async function demanderIA<T>(demande: DemandeIA<T>): Promise<ReponseIA<T>> {
  assertAnonyme(demande.message);
  const echecs: string[] = [];

  for (const config of FOURNISSEURS) {
    const cle = Deno.env.get(config.cleEnv);
    if (!cle) {
      echecs.push(`${config.nom}: non configuré`);
      continue;
    }

    try {
      const brut = await appeler(config, cle, demande);
      const valeur = demande.valider(brut);
      if (valeur === null) {
        echecs.push(`${config.nom}: réponse inexploitable`);
        continue;
      }
      return { valeur, fournisseur: config.nom };
    } catch (cause) {
      echecs.push(`${config.nom}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  throw new AucuneIA(echecs.join(' · '));
}

async function appeler<T>(config: Config, cle: string, demande: DemandeIA<T>): Promise<string> {
  // Une requête qui traîne bloque l'Edge Function : mieux vaut passer au
  // fournisseur suivant que faire patienter le groupe.
  const abandon = AbortSignal.timeout(25_000);

  const reponse = await fetch(config.url, {
    method: 'POST',
    signal: abandon,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cle}` },
    body: JSON.stringify({
      model: demande.soigne ? config.soigne : config.rapide,
      // Basse, mais pas nulle : à zéro, certains modèles bouclent sur une
      // formule et rendent des explications toutes identiques.
      temperature: 0.2,
      max_tokens: demande.maxTokens ?? 700,
      ...(demande.json && config.modeJson ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: demande.systeme },
        { role: 'user', content: demande.message },
      ],
    }),
  });

  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => '');
    throw new Error(`HTTP ${reponse.status} ${corps.slice(0, 160)}`);
  }

  const donnees = (await reponse.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const contenu = donnees.choices?.[0]?.message?.content;
  if (typeof contenu !== 'string' || contenu.trim().length === 0) {
    throw new Error('réponse vide');
  }
  return contenu.trim();
}

/**
 * Dernier filet avant l'envoi. Il ne remplace pas la pseudonymisation faite en
 * amont : il attrape ce qu'elle aurait laissé passer, et préfère refuser
 * l'appel plutôt que laisser fuiter une adresse.
 */
export function assertAnonyme(message: string): void {
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(message)) {
    throw new Error('Refus : une adresse e-mail figurait dans le message');
  }
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(message)) {
    throw new Error('Refus : un identifiant de compte figurait dans le message');
  }
}

/**
 * Extrait un objet JSON d'une réponse de modèle. Même en mode JSON, certains
 * fournisseurs encadrent la réponse d'une clôture markdown ou d'une phrase
 * d'introduction.
 */
export function extraireJson(brut: string): unknown {
  const nettoye = brut
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(nettoye);
  } catch {
    const debut = nettoye.indexOf('{');
    const fin = nettoye.lastIndexOf('}');
    if (debut === -1 || fin <= debut) return null;
    try {
      return JSON.parse(nettoye.slice(debut, fin + 1));
    } catch {
      return null;
    }
  }
}
