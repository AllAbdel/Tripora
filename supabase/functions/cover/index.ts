import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, QuotaEpuise } from '../_shared/budget.ts';

/**
 * Une photo pour une ville, et le crédit qui va avec.
 *
 * Un voyage sans image ressemble à un tableur. Une photo de la ville en haut de
 * l'écran fait plus pour l'envie de partir que n'importe quel classement, et
 * elle ne coûte rien : Wikipédia expose une image d'illustration pour presque
 * toutes les villes du monde, sans clé et sans quota facturé.
 *
 * Deux exigences, qui expliquent tout le reste du fichier.
 *
 * **On ne se trompe ni de ville ni d'image.** Le filtre sur les coordonnées
 * écarte les pages d'homonymie et les articles thématiques, mais il ne suffit
 * pas : chercher « Cambridge Royaume-Uni » a d'abord ramené l'article
 * « Royaume-Uni », qui a des coordonnées lui aussi, et donc la photo de
 * Westminster pour Cambridge. On exige en plus que le titre de l'article
 * corresponde vraiment au nom cherché — « Cambridge » ou « Cambridge
 * (Massachusetts) », jamais « Royaume-Uni ». Sans correspondance, on renvoie
 * `null` : une mauvaise photo est pire que pas de photo, parce qu'elle est
 * crue.
 *
 * Et surtout, on ne prend pas l'image de tête de l'article. Le premier essai
 * le faisait, et renvoyait pour Lisbonne… le drapeau municipal : sur beaucoup
 * d'articles de ville, l'image de tête est un blason. On demande à Wikidata la
 * propriété P18, « image », qui désigne la photo représentative — distincte du
 * drapeau (P41) et des armoiries (P94). En dernier recours seulement on
 * retombe sur l'image de tête, et on refuse alors tout ce qui ressemble à un
 * emblème.
 *
 * **On crédite.** Les images de Commons sont librement réutilisables, presque
 * jamais sans condition : la plupart exigent l'auteur et la licence. C'est
 * pour ça qu'on paie une requête de plus (`imageinfo`) et qu'on renvoie de
 * quoi afficher la mention. Une fonction qui renverrait seulement l'URL
 * inviterait à l'oublier.
 */

const PROVIDER = 'wikipedia';
/** Une ville ne change pas de visage : on garde la réponse un an. */
const TTL_SECONDES = 365 * 24 * 60 * 60;
/** Wikipédia est généreux, mais c'est un commun : on reste très en dessous. */
const LIMITES = { soft: 400, hard: 600 };
/** Assez large pour un bandeau plein écran sur un téléphone à densité 3. */
const LARGEUR = 1200;
const AGENT = 'Tripora/1.0 (application de voyage entre amis, non commerciale)';

export interface Couverture {
  /** L'image elle-même, en HTTPS, servie par Wikimedia. */
  url: string;
  /** Titre du fichier sur Commons, pour pointer vers sa page. */
  fichier: string;
  /** L'auteur, tel que Commons le déclare. Peut manquer. */
  auteur: string | null;
  /** Le nom court de la licence, par exemple « CC BY-SA 4.0 ». */
  licence: string | null;
  /** La page de description, où le crédit complet est lisible. */
  pageDuFichier: string;
  /** L'article dont vient l'image, pour situer. */
  article: string;
}

interface Demande {
  destinationId: string;
  name: string;
  /** Nom du pays en français, pour écarter les homonymes. */
  country: string;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  let demande: Demande;
  try {
    demande = await request.json();
  } catch {
    return json({ error: 'Corps de requête illisible' }, 400);
  }

  const { destinationId, name, country } = demande;
  if (
    typeof destinationId !== 'string' ||
    !/^[a-z0-9-]{2,60}$/.test(destinationId) ||
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    name.length > 120 ||
    typeof country !== 'string' ||
    country.length > 120
  ) {
    return json({ error: 'Destination invalide' }, 400);
  }

  const client = serviceClient();

  try {
    const { valeur, origine } = await avecCacheEtQuota<Couverture | null>({
      client,
      cle: `couverture:${destinationId}`,
      provider: PROVIDER,
      ttlSecondes: TTL_SECONDES,
      limites: LIMITES,
      appel: () => chercherCouverture(name, country),
    });

    return json({ couverture: valeur, origine, configured: true });
  } catch (cause) {
    if (cause instanceof QuotaEpuise) {
      return json({ couverture: null, quotaExceeded: true, provider: PROVIDER }, 200);
    }
    console.error('cover', cause);
    // Une couverture absente n'empêche rien : l'écran a un fond de repli.
    return json({ couverture: null, failed: true }, 200);
  }
});

async function api(hote: string, parametres: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://${hote}/w/api.php`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');
  for (const [cle, valeur] of Object.entries(parametres)) {
    url.searchParams.set(cle, valeur);
  }

  const reponse = await fetch(url, { headers: { 'User-Agent': AGENT } });
  if (!reponse.ok) throw new Error(`Wikipédia a répondu ${reponse.status}`);
  return await reponse.json();
}

interface PageTrouvee {
  title?: string;
  index?: number;
  pageimage?: string;
  coordinates?: unknown[];
  pageprops?: { disambiguation?: string; wikibase_item?: string };
}

/**
 * L'article de la ville : d'abord par son titre exact, ensuite par recherche.
 *
 * Le titre exact est de loin le plus fiable — « Séville » désigne Séville — et
 * il coûte le même appel. La recherche ne sert que de rattrapage, pour les
 * villes dont l'article porte un titre désambiguïsé (« Cambridge (Ontario) »).
 */
/**
 * Le nom d'article probable, tiré du nom du catalogue.
 *
 * Une bonne partie des entrées ne sont pas des noms de ville mais des
 * intitulés : « Caen et les plages du Débarquement », « Ålesund et le
 * Geirangerfjord », « Sumatra — Medan et le lac Toba ». Aucun titre
 * d'article ne leur ressemblera jamais. On garde donc ce qui précède le
 * premier séparateur — c'est toujours le lieu principal, par construction du
 * catalogue.
 *
 * Le nom complet reste utilisé pour la recherche : le contexte qu'il apporte
 * aide à départager les homonymes.
 */
function nomCourt(nom: string): string {
  const coupe = nom.split(/\s+[—–-]\s+| et (?=[a-zà-ÿ])|,/u)[0]?.trim() ?? nom;
  // En dessous de trois lettres, la coupe a mal tourné : on garde l'original.
  return coupe.length >= 3 ? coupe : nom;
}

async function trouverArticle(nom: string, pays: string): Promise<PageTrouvee | null> {
  const court = nomCourt(nom);
  const parTitre = (await api('fr.wikipedia.org', {
    action: 'query',
    titles: court,
    redirects: '1',
    prop: 'pageimages|pageprops|coordinates',
    piprop: 'name',
  })) as { query?: { pages?: PageTrouvee[] } };

  const exacte = (parTitre.query?.pages ?? []).find(
    (page) =>
      page.pageprops?.disambiguation === undefined &&
      Array.isArray(page.coordinates) &&
      page.coordinates.length > 0,
  );
  if (exacte) return exacte;

  return await chercherArticle(nom, court, pays);
}

async function chercherArticle(
  nom: string,
  court: string,
  pays: string,
): Promise<PageTrouvee | null> {
  const recherche = (await api('fr.wikipedia.org', {
    action: 'query',
    generator: 'search',
    gsrsearch: `${nom} ${pays}`,
    gsrlimit: '5',
    gsrnamespace: '0',
    prop: 'pageimages|pageprops|coordinates',
    piprop: 'name',
  })) as { query?: { pages?: PageTrouvee[] } };

  const pages = (recherche.query?.pages ?? [])
    // Les pages d'homonymie n'illustrent rien, et leur image est au mieux une
    // carte du monde.
    .filter((page) => page.pageprops?.disambiguation === undefined)
    // Un article de ville porte des coordonnées ; un article thématique
    // (« Histoire de Lyon ») n'en porte pas. C'est le filtre le plus efficace
    // contre les faux positifs, et il ne coûte rien de plus.
    .filter((page) => Array.isArray(page.coordinates) && page.coordinates.length > 0)
    .filter((page) => titreCorrespond(page.title, court))
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  return pages[0] ?? null;
}

/**
 * L'article de la ville, puis son image, puis le crédit de cette image.
 *
 * Trois appels enchaînés, mis en cache un an ensemble : c'est le prix d'une
 * couverture juste et créditée, payé une fois par ville pour tous les groupes.
 */
async function chercherCouverture(nom: string, pays: string): Promise<Couverture | null> {
  const page = await trouverArticle(nom, pays);
  if (!page?.title) return null;

  // Wikidata d'abord, l'image de tête ensuite — mais le filtre anti-emblème
  // s'applique aux deux. Sur un test de quarante villes, la seule erreur
  // restante venait de là : le P18 de Sumatra est une carte de 1900.
  const candidats = [
    await imageDeWikidata(page.pageprops?.wikibase_item),
    page.pageimage,
  ];
  const fichier = candidats.find((nom) => nom && !estUnEmbleme(nom));
  if (!fichier) return null;

  const details = (await api('fr.wikipedia.org', {
    action: 'query',
    titles: `File:${fichier}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(LARGEUR),
    iiextmetadatafilter: 'Artist|LicenseShortName|Credit',
  })) as {
    query?: {
      pages?: {
        imageinfo?: {
          thumburl?: string;
          url?: string;
          descriptionurl?: string;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }[];
    };
  };

  const info = details.query?.pages?.[0]?.imageinfo?.[0];
  const url = info?.thumburl ?? info?.url;
  if (!url) return null;

  const meta = info?.extmetadata ?? {};
  return {
    url,
    fichier: `File:${fichier}`,
    auteur: texteBrut(meta['Artist']?.value ?? meta['Credit']?.value),
    licence: texteBrut(meta['LicenseShortName']?.value),
    pageDuFichier:
      info?.descriptionurl ??
      `https://commons.wikimedia.org/wiki/${encodeURIComponent(`File:${fichier}`)}`,
    article: page.title,
  };
}

/** Sans accents, sans casse, sans ponctuation : la forme comparable d'un nom. */
function plier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * L'article trouvé parle-t-il bien de la ville cherchée ?
 *
 * On accepte le titre exact et le titre suivi d'une précision entre
 * parenthèses — « Cambridge (Massachusetts) » est bien un Cambridge. On refuse
 * tout le reste, y compris un article qui ne ferait que contenir le nom :
 * « Université de Cambridge » n'est pas une ville, et « Royaume-Uni » encore
 * moins.
 */
function titreCorrespond(titre: string | undefined, nom: string): boolean {
  if (!titre) return false;
  const cherche = plier(nom);
  const trouve = plier(titre);
  if (cherche.length === 0) return false;
  return trouve === cherche || trouve.startsWith(`${cherche} `);
}

/**
 * La photo représentative, telle que Wikidata la désigne.
 *
 * P18 est la propriété « image » : celle qu'on met en tête d'une fiche, et
 * qu'un humain a choisie pour représenter le lieu. Elle est distincte du
 * drapeau et des armoiries, qui ont leurs propres propriétés — c'est
 * exactement la distinction qui manquait à l'image de tête de l'article.
 *
 * Renvoie `undefined` plutôt que de lever : sans P18, l'appelant a un repli.
 */
async function imageDeWikidata(entite: string | undefined): Promise<string | undefined> {
  if (!entite || !/^Q[0-9]{1,12}$/.test(entite)) return undefined;
  try {
    const reponse = (await api('www.wikidata.org', {
      action: 'wbgetclaims',
      entity: entite,
      property: 'P18',
    })) as { claims?: { P18?: { mainsnak?: { datavalue?: { value?: unknown } } }[] } };

    const valeur = reponse.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    return typeof valeur === 'string' && valeur.length > 0 ? valeur : undefined;
  } catch {
    return undefined;
  }
}

/** Les mots qui trahissent un emblème ou une carte plutôt qu'une photo. */
const PAS_UNE_PHOTO =
  /(flag|bandeira|bandera|drapeau|coat[ _]of[ _]arms|wappen|blason|bras[aã]o|escudo|seal|logo|\bmap\b|\bmapa\b|\bcarte\b|atlas|topograph|relief|orthographic|satellite|localisation|location)/i;

/**
 * Une photo, ou autre chose ?
 *
 * Le format fait le gros du tri, et il le fait mieux que n'importe quelle
 * liste de mots : sur Commons, les photographies sont en JPEG et les cartes,
 * schémas et blasons en PNG ou en SVG. Une image vectorielle n'est jamais une
 * ville.
 *
 * Le PNG reste accepté sous condition, parce que quelques vraies photos y sont
 * — celle de Lisbonne, par exemple. Il passe alors par la liste de mots, qui
 * écarte les cartes topographiques et les blasons.
 *
 * Rien de tout ça n'est infaillible : pour une île ou une région, Wikipédia
 * illustre parfois avec une carte, et aucun filtre ne rattrapera tous les cas.
 * L'écran a un fond de repli pour ceux-là.
 */
function estUnEmbleme(fichier: string | undefined): boolean {
  if (!fichier) return true;
  if (/\.jpe?g$/i.test(fichier)) return PAS_UNE_PHOTO.test(fichier);
  if (/\.png$/i.test(fichier)) return PAS_UNE_PHOTO.test(fichier);
  // Tout le reste — SVG, GIF, TIFF — n'est pas une photographie de ville.
  return true;
}

/**
 * Le crédit arrive en HTML — Commons y met des liens, des balises et parfois
 * une mise en page entière. On n'en garde que le texte, parce que rien de tout
 * cela ne sera jamais interprété comme du HTML côté client : la règle du projet
 * est qu'aucune chaîne venue du réseau ne devient du balisage.
 */
function texteBrut(html: string | undefined): string | null {
  if (!html) return null;
  const texte = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (texte.length === 0) return null;
  // Un crédit de trois lignes ne tient pas sous une image ; au-delà, on
  // renvoie vers la page du fichier, qui porte la mention complète.
  return texte.length > 120 ? `${texte.slice(0, 117)}…` : texte;
}
