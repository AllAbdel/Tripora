import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, QuotaEpuise } from '../_shared/budget.ts';

/**
 * Les lieux réels d'une destination, depuis OpenStreetMap et Wikipédia.
 *
 * C'est ce qui manquait pour que l'itinéraire cesse d'être une structure vide.
 * Le moteur savait déjà réserver un créneau « culture le mardi matin » ; il ne
 * pouvait pas dire lequel, parce qu'inventer un musée est exactement ce que
 * Tripora s'interdit. Maintenant il peut proposer le musée qui existe.
 *
 * Une requête Overpass par ville, mise en cache trente jours et partagée par
 * tout le groupe : cinq personnes qui ouvrent la même destination déclenchent
 * un seul appel, et il ne se rejoue qu'un mois plus tard. C'est ce qui rend
 * l'usage soutenable sur un service communautaire gratuit.
 *
 * Wikipédia n'est interrogé que pour les lieux dont OSM connaît déjà le titre
 * exact de l'article — pas de recherche floue, donc pas de descriptions
 * rattachées au mauvais lieu. Une seule requête pour tous les titres.
 */

const PROVIDER = 'overpass';
const TTL_SECONDES = 30 * 24 * 60 * 60;
/** Overpass est un service communautaire : on reste très en dessous. */
const LIMITES = { soft: 120, hard: 200 };
/** Rayon autour du centre-ville. Au-delà, ce n'est plus la même journée. */
const RAYON_METRES = 4000;
/** Au-delà, la liste devient un annuaire et plus une sélection. */
const MAX_LIEUX = 120;
/** Overpass et Wikipédia demandent qu'on s'identifie : c'est la contrepartie
 *  de la gratuité, et ça permet de nous joindre plutôt que de nous bloquer. */
const AGENT = 'Tripora/1.0 (application de voyage entre amis, non commerciale)';

interface Demande {
  destinationId: string;
  lat: number;
  lng: number;
}

interface ElementOsm {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
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

  const { destinationId, lat, lng } = demande;
  if (
    typeof destinationId !== 'string' ||
    !/^[a-z0-9-]{2,40}$/.test(destinationId) ||
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return json({ error: 'Destination ou coordonnées invalides' }, 400);
  }

  const client = serviceClient();

  try {
    const { valeur, origine } = await avecCacheEtQuota<BrutLieu[]>({
      client,
      cle: `lieux:${destinationId}`,
      provider: PROVIDER,
      ttlSecondes: TTL_SECONDES,
      limites: LIMITES,
      appel: async () => {
        const elements = await interrogerOverpass(lat, lng);
        return await enrichirDepuisWikipedia(elements);
      },
    });

    // On écrit aussi dans `places` : la table sert de référence stable aux
    // items d'itinéraire, qui doivent survivre à l'expiration du cache.
    await memoriser(client, destinationId, valeur);

    return json({ places: valeur, origine, configured: true });
  } catch (cause) {
    if (cause instanceof QuotaEpuise) {
      return json({ places: [], quotaExceeded: true, provider: PROVIDER }, 200);
    }
    console.error('places', cause);
    // Un écran sans lieux reste utilisable : l'itinéraire garde sa structure.
    return json({ places: [], failed: true }, 200);
  }
});

interface BrutLieu {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
  wikipedia?: string;
  extract?: string;
  imageUrl?: string;
  externalUrl?: string;
}

/**
 * Une seule requête pour toute la ville.
 *
 * Les restaurants et les bars sont volontairement absents : OSM en connaît des
 * milliers par ville, sans note ni prix fiables, et les proposer reviendrait à
 * recommander au hasard. Le classement des étiquettes qui restent se fait
 * côté application, dans `packages/core/src/places.ts`, où il est testé.
 */
async function interrogerOverpass(lat: number, lng: number): Promise<ElementOsm[]> {
  const autour = `(around:${RAYON_METRES},${lat},${lng})`;
  const requete = `[out:json][timeout:40];
(
  nwr["tourism"~"^(museum|gallery|artwork|viewpoint|attraction|zoo|aquarium|theme_park)$"]["name"]${autour};
  nwr["historic"~"^(castle|monument|ruins|city_gate|fort|archaeological_site|church|tower|memorial)$"]["name"]${autour};
  nwr["amenity"~"^(theatre|arts_centre|marketplace)$"]["name"]${autour};
  nwr["leisure"~"^(park|garden|spa|beach_resort|water_park)$"]["name"]${autour};
  nwr["natural"~"^(beach|peak|cliff|cave_entrance)$"]["name"]${autour};
  nwr["shop"~"^(mall|department_store)$"]["name"]${autour};
);
out center ${MAX_LIEUX * 3};`;

  const reponse = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    signal: AbortSignal.timeout(50_000),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': AGENT,
    },
    body: new URLSearchParams({ data: requete }),
  });

  if (!reponse.ok) throw new Error(`Overpass HTTP ${reponse.status}`);
  const donnees = (await reponse.json()) as { elements?: ElementOsm[] };
  return donnees.elements ?? [];
}

/**
 * Descriptions et images, uniquement pour les lieux dont OSM donne déjà le
 * titre exact de l'article. Pas de recherche par nom : elle rattacherait
 * régulièrement le texte d'un autre lieu, et une fiche fausse est pire qu'une
 * fiche absente.
 *
 * Deux détails appris en conditions réelles, sur Lisbonne :
 *
 *  - **l'étiquette wikipedia d'OSM est dans la langue du pays**, pas dans la
 *    nôtre : 13 articles en portugais, 3 en anglais, zéro en français. Ne
 *    garder que `fr:` revenait à n'enrichir aucun lieu. On passe donc par les
 *    liens interlangues pour retrouver l'article français ;
 *  - **les lieux documentés doivent passer devant avant qu'on tronque.** OSM
 *    rend ses éléments dans un ordre arbitraire ; couper à 120 au fil de l'eau
 *    écartait le monastère des Hiéronymites au profit d'un square anonyme.
 */
async function enrichirDepuisWikipedia(elements: ElementOsm[]): Promise<BrutLieu[]> {
  const utilisables = elements.filter(
    (element) =>
      element.tags?.name &&
      // OSM étiquette les arbres remarquables `tourism=attraction`, et leur
      // lien Wikipédia mène à l'espèce botanique : le figuier du jardin de
      // Lisbonne arrivait avec la fiche « Ficus macrophylla ». Un arbre n'est
      // pas une visite, et il ne doit pas consommer une place dans la liste.
      element.tags.natural !== 'tree' &&
      element.tags.natural !== 'shrub' &&
      (element.lat ?? element.center?.lat) !== undefined &&
      (element.lon ?? element.center?.lon) !== undefined,
  );

  // Les lieux que Wikipédia ou Wikidata connaissent sont, presque toujours,
  // ceux qu'on vient voir. Ils passent devant.
  const connus = (element: ElementOsm): number =>
    element.tags?.wikipedia || element.tags?.wikidata ? 0 : 1;
  utilisables.sort((a, b) => connus(a) - connus(b));

  const lieux: BrutLieu[] = utilisables.slice(0, MAX_LIEUX).map((element) => {
    const tags = element.tags ?? {};
    const lieu: BrutLieu = {
      id: `osm:${element.type}/${element.id}`,
      name: tags.name!.slice(0, 120),
      lat: (element.lat ?? element.center!.lat),
      lng: (element.lon ?? element.center!.lon),
      tags,
    };
    if (tags.website?.startsWith('https://')) lieu.externalUrl = tags.website.slice(0, 300);
    return lieu;
  });

  try {
    await rattacherFiches(lieux);
  } catch (cause) {
    // Une fiche manquante n'empêche pas d'afficher le lieu.
    console.warn('places: Wikipédia indisponible', cause);
  }

  return lieux;
}

/** Format OSM : « pt:Mosteiro dos Jerónimos ». Langue et titre, séparés. */
function lireEtiquetteWikipedia(valeur: string | undefined): { langue: string; titre: string } | null {
  if (!valeur) return null;
  const separateur = valeur.indexOf(':');
  if (separateur < 2) return null;
  const langue = valeur.slice(0, separateur).toLowerCase();
  const titre = valeur.slice(separateur + 1).trim();
  if (!/^[a-z]{2,3}$/.test(langue) || titre.length < 2) return null;
  return { langue, titre };
}

/**
 * Résout les titres, dans n'importe quelle langue, vers l'article français,
 * puis en récupère résumé et image. Une requête par langue d'origine, plus une
 * pour les extraits : trois appels au total dans le cas courant.
 */
async function rattacherFiches(lieux: BrutLieu[]): Promise<void> {
  const parLangue = new Map<string, Map<string, BrutLieu[]>>();

  for (const lieu of lieux) {
    const etiquette = lireEtiquetteWikipedia(lieu.tags.wikipedia);
    if (!etiquette) continue;
    const titres = parLangue.get(etiquette.langue) ?? new Map<string, BrutLieu[]>();
    const groupe = titres.get(etiquette.titre) ?? [];
    groupe.push(lieu);
    titres.set(etiquette.titre, groupe);
    parLangue.set(etiquette.langue, titres);
  }
  if (parLangue.size === 0) return;

  /** Titre d'article français -> lieux qui l'attendent. */
  const enFrancais = new Map<string, BrutLieu[]>();

  for (const [langue, titres] of parLangue) {
    if (langue === 'fr') {
      for (const [titre, groupe] of titres) {
        enFrancais.set(titre, [...(enFrancais.get(titre) ?? []), ...groupe]);
      }
      continue;
    }
    const traductions = await traduireEnFrancais(langue, [...titres.keys()].slice(0, 40));
    for (const [titre, groupe] of titres) {
      const francais = traductions.get(titre);
      if (!francais) continue;
      enFrancais.set(francais, [...(enFrancais.get(francais) ?? []), ...groupe]);
    }
  }
  if (enFrancais.size === 0) return;

  const fiches = await lireWikipedia([...enFrancais.keys()].slice(0, 50));
  for (const [titre, groupe] of enFrancais) {
    const fiche = fiches.get(titre);
    if (!fiche) continue;
    for (const lieu of groupe) {
      lieu.wikipedia = titre;
      if (fiche.extract) lieu.extract = fiche.extract;
      if (fiche.image) lieu.imageUrl = fiche.image;
    }
  }
}

/** Liens interlangues : « pt:Torre de Belém » devient « Tour de Belém ». */
async function traduireEnFrancais(
  langue: string,
  titres: readonly string[],
): Promise<Map<string, string>> {
  const traductions = new Map<string, string>();
  if (titres.length === 0) return traductions;

  const url = new URL(`https://${langue}.wikipedia.org/w/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('prop', 'langlinks');
  url.searchParams.set('lllang', 'fr');
  url.searchParams.set('lllimit', '500');
  url.searchParams.set('titles', titres.join('|'));

  const reponse = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'user-agent': AGENT },
  });
  if (!reponse.ok) throw new Error(`Wikipédia ${langue} HTTP ${reponse.status}`);

  const donnees = (await reponse.json()) as {
    query?: {
      pages?: { title?: string; langlinks?: { lang: string; title: string }[] }[];
      normalized?: { from: string; to: string }[];
    };
  };

  const versDemande = new Map<string, string>();
  for (const { from, to } of donnees.query?.normalized ?? []) versDemande.set(to, from);

  for (const page of donnees.query?.pages ?? []) {
    const francais = page.langlinks?.find((lien) => lien.lang === 'fr')?.title;
    if (!page.title || !francais) continue;
    traductions.set(versDemande.get(page.title) ?? page.title, francais);
  }
  return traductions;
}

async function lireWikipedia(
  titres: readonly string[],
): Promise<Map<string, { extract?: string; image?: string }>> {
  const url = new URL('https://fr.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('prop', 'extracts|pageimages');
  url.searchParams.set('exintro', '1');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('exsentences', '2');
  url.searchParams.set('piprop', 'thumbnail');
  url.searchParams.set('pithumbsize', '400');
  url.searchParams.set('titles', titres.join('|'));

  const reponse = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'user-agent': AGENT },
  });
  if (!reponse.ok) throw new Error(`Wikipédia HTTP ${reponse.status}`);

  const donnees = (await reponse.json()) as {
    query?: {
      pages?: { title?: string; extract?: string; thumbnail?: { source?: string } }[];
      normalized?: { from: string; to: string }[];
    };
  };

  // Wikipédia normalise les titres (majuscules, underscores) : sans cette
  // table de correspondance, un lieu sur trois ne retrouverait pas sa fiche.
  const versDemande = new Map<string, string>();
  for (const { from, to } of donnees.query?.normalized ?? []) versDemande.set(to, from);

  const fiches = new Map<string, { extract?: string; image?: string }>();
  for (const page of donnees.query?.pages ?? []) {
    if (!page.title) continue;
    const cle = versDemande.get(page.title) ?? page.title;
    const fiche: { extract?: string; image?: string } = {};
    if (page.extract) fiche.extract = page.extract.slice(0, 400);
    if (page.thumbnail?.source) fiche.image = page.thumbnail.source;
    if (fiche.extract || fiche.image) fiches.set(cle, fiche);
  }
  return fiches;
}

/**
 * Copie durable dans `places`.
 *
 * Le cache expire au bout d'un mois ; un item d'itinéraire, lui, doit pouvoir
 * pointer sur son lieu des années plus tard. La table est donc la référence,
 * le cache n'est qu'une économie d'appels.
 */
async function memoriser(
  client: ReturnType<typeof serviceClient>,
  destinationId: string,
  lieux: readonly BrutLieu[],
): Promise<void> {
  if (lieux.length === 0) return;
  const lignes = lieux.map((lieu) => ({
    id: lieu.id,
    destination_id: destinationId,
    name: lieu.name,
    // La catégorie fine est calculée côté application ; la base garde la
    // matière première, pour que corriger une règle ne demande pas de
    // réinterroger OpenStreetMap.
    category: lieu.tags.tourism ?? lieu.tags.historic ?? lieu.tags.leisure ??
      lieu.tags.natural ?? lieu.tags.amenity ?? lieu.tags.shop ?? 'autre',
    lat: lieu.lat,
    lng: lieu.lng,
    image_url: lieu.imageUrl ?? null,
    wiki_extract: lieu.extract ?? null,
    external_url: lieu.externalUrl ?? null,
    source: 'openstreetmap',
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await client.from('places').upsert(lignes, { onConflict: 'id' });
  if (error) console.warn('places: écriture impossible', error.message);
}
