import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, QuotaEpuise } from '../_shared/budget.ts';
import { estUnEmbleme, nomCourt, texteBrut, titreCorrespond } from './choix.ts';

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
 * Deux sources d'image, et un filtre qui s'applique aux deux : la propriété
 * P18 de Wikidata (« image », distincte du drapeau P41 et des armoiries P94),
 * puis l'image de tête de l'article. P18 passe en premier parce qu'elle est
 * choisie pour représenter le lieu, là où l'image de tête est souvent un
 * blason — celui de Lisbonne — ou un montage de quatre vignettes. Le filtre
 * écarte les emblèmes, les cartes, les vues prises depuis l'orbite et les
 * légendes d'agence.
 *
 * On cherche en français d'abord, en anglais ensuite : quantité de petits
 * lieux n'ont d'article que là-bas.
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
 * Les deux Wikipédia interrogées, dans cet ordre.
 *
 * La française d'abord : le crédit et le titre d'article reviennent alors dans
 * la langue de l'écran. L'anglaise ensuite, parce qu'elle est la seule à
 * couvrir quantité de petits lieux — English Harbour à Antigua a un article et
 * une photo en anglais, et rien du tout en français. Sans ce second essai,
 * c'était une couverture vide sur une destination parfaitement réelle.
 */
const WIKIS = ['fr.wikipedia.org', 'en.wikipedia.org'] as const;

/** Un article trouvé, et le wiki d'où il vient — le fichier s'y lit ensuite. */
interface ArticleTrouve {
  page: PageTrouvee;
  hote: string;
}

async function trouverArticle(nom: string, pays: string): Promise<ArticleTrouve | null> {
  const court = nomCourt(nom);
  for (const hote of WIKIS) {
    const page = await articleSur(hote, nom, court, pays);
    if (page) return { page, hote };
  }
  return null;
}

async function articleSur(
  hote: string,
  nom: string,
  court: string,
  pays: string,
): Promise<PageTrouvee | null> {
  const parTitre = (await api(hote, {
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

  return await chercherArticle(hote, nom, court, pays);
}

async function chercherArticle(
  hote: string,
  nom: string,
  court: string,
  pays: string,
): Promise<PageTrouvee | null> {
  const recherche = (await api(hote, {
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
  const trouve = await trouverArticle(nom, pays);
  if (!trouve) return null;
  const { page, hote } = trouve;
  const titre = page.title;
  if (!titre) return null;

  // Wikidata d'abord, l'image de tête ensuite — le filtre s'applique aux deux.
  //
  // L'ordre inverse a été essayé, et il coûte plus qu'il ne rapporte : sur les
  // articles de grandes villes, l'image de tête est très souvent un montage de
  // quatre vignettes (Lyon, Gênes, Göteborg) ou un fichier sans nom, et un
  // montage fait une mauvaise photo de couverture. Le P18 de Wikidata est
  // choisi pour représenter le lieu, et c'est exactement ce qu'on cherche.
  const candidats = [
    await imageDeWikidata(page.pageprops?.wikibase_item),
    page.pageimage,
  ];
  const fichier = candidats.find((nom) => nom && !estUnEmbleme(nom));
  if (!fichier) return null;

  const details = (await api(hote, {
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
    article: titre,
  };
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


