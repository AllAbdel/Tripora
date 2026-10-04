import { lireLEtiquette } from './illustrations';

/**
 * Deux phrases pour dire ce qu'est un lieu, prises à son article Wikipédia.
 *
 * Le carnet d'activités a sa phrase écrite à la main ; un lieu venu
 * d'OpenStreetMap n'a qu'un nom et une catégorie — « Musée ». Pour qu'une
 * carte de « Découvrir » donne envie, il lui faut un texte : le résumé de
 * l'article, coupé à la fin d'une phrase.
 *
 * Le point d'entrée « page/summary » de l'API REST de Wikipédia renvoie ce
 * résumé en une requête, sans clé, et accepte les appels du navigateur.
 */

export interface ResumeWikipedia {
  extrait: string;
  /** L'article, pour « En savoir plus ». */
  url: string;
}

/** Au-delà, ce n'est plus une carte qu'on lit d'un coup d'œil. */
const LONGUEUR_MAX = 260;

/**
 * Le texte coupé à la dernière phrase entière qui tient, ou au dernier mot
 * suivi d'une ellipse quand même la première phrase est trop longue.
 */
export function raccourcir(texte: string, max = LONGUEUR_MAX): string {
  const propre = texte.replace(/\s+/gu, ' ').trim();
  if (propre.length <= max) return propre;
  const phrases = propre.match(/[^.!?]+[.!?]+(?:\s|$)/gu) ?? [];
  let garde = '';
  for (const phrase of phrases) {
    if ((garde + phrase).trim().length > max) break;
    garde += phrase;
  }
  if (garde.trim()) return garde.trim();
  const coupe = propre.slice(0, max);
  return `${coupe.slice(0, coupe.lastIndexOf(' ')).replace(/[,;:]$/u, '')}…`;
}

export async function chargerLeResume(etiquette: string | undefined): Promise<ResumeWikipedia | null> {
  const article = lireLEtiquette(etiquette);
  if (!article) return null;
  const titre = encodeURIComponent(article.titre.replace(/ /gu, '_'));
  try {
    const reponse = await fetch(`https://${article.langue}.wikipedia.org/api/rest_v1/page/summary/${titre}`, {
      headers: { Accept: 'application/json' },
    });
    if (!reponse.ok) return null;
    const donnees = (await reponse.json()) as { extract?: unknown; content_urls?: { mobile?: { page?: unknown } } };
    if (typeof donnees.extract !== 'string' || donnees.extract.trim().length < 20) return null;
    const url = donnees.content_urls?.mobile?.page;
    return {
      extrait: raccourcir(donnees.extract),
      url: typeof url === 'string' && url.startsWith('https://') ? url : `https://${article.langue}.wikipedia.org/wiki/${titre}`,
    };
  } catch {
    // Hors ligne ou article disparu : la carte garde son nom et sa catégorie.
    return null;
  }
}
