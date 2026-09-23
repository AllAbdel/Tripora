/**
 * Une photo pour chaque activité ou lieu, et le crédit qui va avec.
 *
 * Le catalogue d'activités nomme un article Wikipédia pour presque chacune de
 * ses entrées, et OpenStreetMap en connaît un pour les lieux notables. Cet article a, dans la quasi-totalité des cas, une image de
 * tête sur Wikimedia Commons — libre de droits, souvent bonne, et gratuite.
 *
 * **Aucune fonction serveur ici, et c'est délibéré.** L'API de Wikimedia
 * répond avec `Access-Control-Allow-Origin: *` dès qu'on passe `origin=*` :
 * le navigateur peut l'interroger directement. Passer par une Edge Function
 * ajouterait un intermédiaire, un quota à surveiller, et un point de panne de
 * plus — on vient précisément de découvrir ce que coûte un point de panne
 * silencieux avec OpenStreetMap.
 *
 * **Deux requêtes par destination, pas deux par activité.** L'API accepte
 * cinquante titres d'un coup ; une ville entière tient donc dans un appel pour
 * les images, et un second sur Commons pour les crédits. Le résultat est gardé
 * un mois par le cache de requêtes.
 *
 * **On crédite.** Les images de Commons sont librement réutilisables, presque
 * jamais sans condition : la plupart exigent l'auteur et la licence. C'est la
 * raison du second appel. Une image sans sa mention ne s'affiche pas — il vaut
 * mieux une carte sans photo qu'une réutilisation en infraction.
 */

export interface Illustration {
  /** L'image elle-même, en HTTPS, servie par Wikimedia. */
  url: string;
  /** L'auteur, tel que Commons le déclare. Du texte, parfois du HTML nettoyé. */
  auteur: string | null;
  /** Le nom court de la licence, par exemple « CC BY-SA 4.0 ». */
  licence: string | null;
  /** La page du fichier, où le crédit complet est lisible. */
  page: string;
}

/** Les illustrations d'une destination, par identifiant d'activité. */
export type Illustrations = Record<string, Illustration>;

/** Assez large pour un écran de téléphone à densité 3, sans être un poster. */
const LARGEUR = 640;

/** Format OSM et catalogue : « fr:Mont Batur ». Langue et titre, séparés. */
export function lireLEtiquette(valeur: string | undefined): { langue: string; titre: string } | null {
  if (!valeur) return null;
  const separateur = valeur.indexOf(':');
  if (separateur < 2) return null;
  const langue = valeur.slice(0, separateur).toLowerCase();
  const titre = valeur.slice(separateur + 1).trim();
  if (!/^[a-z]{2,3}$/.test(langue) || titre.length < 2) return null;
  return { langue, titre };
}

interface PageWiki {
  title?: unknown;
  thumbnail?: { source?: unknown } | undefined;
  pageimage?: unknown;
}

/**
 * Lecture de la réponse « pageimages ».
 *
 * Exportée pour être testée : c'est la frontière entre une réponse écrite par
 * n'importe qui sur Wikipédia et l'écran. On refuse tout ce qui n'est pas une
 * adresse HTTPS chez Wikimedia — une image servie depuis ailleurs n'a pas la
 * licence qu'on s'apprête à afficher.
 */
export function lireLesImages(donnees: unknown): Map<string, { url: string; fichier: string }> {
  const trouvees = new Map<string, { url: string; fichier: string }>();
  if (typeof donnees !== 'object' || donnees === null) return trouvees;

  const source = donnees as {
    query?: {
      pages?: Record<string, PageWiki>;
      normalized?: { from: string; to: string }[];
      redirects?: { from: string; to: string }[];
    };
  };
  const pages = source.query?.pages;
  if (!pages) return trouvees;

  for (const page of Object.values(pages)) {
    const titre = typeof page.title === 'string' ? page.title : null;
    const url = typeof page.thumbnail?.source === 'string' ? page.thumbnail.source : null;
    const fichier = typeof page.pageimage === 'string' ? page.pageimage : null;
    if (!titre || !url || !fichier) continue;
    if (!url.startsWith('https://upload.wikimedia.org/')) continue;
    trouvees.set(titre, { url, fichier });
  }

  // Les redirections d'abord : « Cathédrale de Sienne » renvoie vers
  // « Cathédrale Santa Maria Assunta de Sienne », et la page revient sous ce
  // second titre. Sans ce report, un titre redirigé ne retrouvait jamais sa
  // photo — un titre sur sept du carnet, mesuré sur un lot de deux cents.
  for (const { from, to } of source.query?.redirects ?? []) {
    const image = trouvees.get(to);
    if (image) trouvees.set(from, image);
  }

  // Puis la normalisation, qui s'applique avant la redirection côté
  // Wikipédia — majuscule initiale, espaces insécables. Sans ce report,
  // « mont Batur » ne retrouverait pas sa propre image.
  for (const { from, to } of source.query?.normalized ?? []) {
    const image = trouvees.get(to);
    if (image) trouvees.set(from, image);
  }
  return trouvees;
}

interface FichierCommons {
  title?: unknown;
  imageinfo?: { extmetadata?: Record<string, { value?: unknown }> }[];
}

/** Retire le HTML que Commons met parfois dans le nom de l'auteur. */
export function texteBrut(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null;
  const nettoye = valeur
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return nettoye.length > 0 && nettoye.length < 200 ? nettoye : null;
}

/** Lecture des crédits renvoyés par Commons, par nom de fichier. */
export function lireLesCredits(
  donnees: unknown,
): Map<string, { auteur: string | null; licence: string | null }> {
  const credits = new Map<string, { auteur: string | null; licence: string | null }>();
  if (typeof donnees !== 'object' || donnees === null) return credits;

  const pages = (donnees as { query?: { pages?: Record<string, FichierCommons> } }).query?.pages;
  if (!pages) return credits;

  for (const page of Object.values(pages)) {
    const titre = typeof page.title === 'string' ? page.title : null;
    if (!titre) continue;
    const meta = page.imageinfo?.[0]?.extmetadata ?? {};
    credits.set(titre.replace(/^File:/u, '').replace(/^Fichier:/u, ''), {
      auteur: texteBrut(meta['Artist']?.value),
      licence: texteBrut(meta['LicenseShortName']?.value),
    });
  }
  return credits;
}

async function interroger(url: string): Promise<unknown> {
  const reponse = await fetch(url, { headers: { accept: 'application/json' } });
  if (!reponse.ok) throw new Error(`Wikimedia HTTP ${reponse.status}`);
  return await reponse.json();
}

/** Ce qu'il faut pour illustrer : un identifiant, et l'article qui le décrit. */
export interface AIllustrer {
  id: string;
  /** Format « langue:Titre », celui du carnet comme d'OpenStreetMap. */
  wikipedia?: string | undefined;
}

/** L'API de Wikimedia n'accepte pas plus de cinquante titres par appel. */
const PAR_APPEL = 50;

/** Découpe une liste en paquets, dans l'ordre. */
export function enPaquets<T>(liste: readonly T[], taille = PAR_APPEL): T[][] {
  const paquets: T[][] = [];
  for (let debut = 0; debut < liste.length; debut += taille) {
    paquets.push(liste.slice(debut, debut + taille));
  }
  return paquets;
}

/**
 * Les illustrations d'un lot — activités du carnet ou lieux d'OpenStreetMap.
 *
 * Tout échec est silencieux : sans photo, la fiche garde son nom, sa durée,
 * son prix et sa phrase — c'est-à-dire l'essentiel. Une panne de Wikimedia ne
 * doit pas vider un écran.
 *
 * Par paquets de cinquante : une ville d'OpenStreetMap peut compter soixante
 * lieux documentés dans la même langue, et l'API ignore sans le dire tout ce
 * qui dépasse. Couper à cinquante laissait donc les derniers sans photo, et
 * les suivants sans crédit.
 */
export async function chargerIllustrations(
  entrees: readonly AIllustrer[],
): Promise<Illustrations> {
  // Un appel par langue : les titres d'un lot peuvent venir de plusieurs
  // Wikipédias, et chaque édition a son propre point d'entrée.
  const parLangue = new Map<string, { titre: string; id: string }[]>();
  for (const entree of entrees) {
    const etiquette = lireLEtiquette(entree.wikipedia);
    if (!etiquette) continue;
    const lot = parLangue.get(etiquette.langue) ?? [];
    lot.push({ titre: etiquette.titre, id: entree.id });
    parLangue.set(etiquette.langue, lot);
  }
  if (parLangue.size === 0) return {};

  const illustrations: Illustrations = {};
  const fichiers = new Map<string, string[]>();

  const demandes = [...parLangue].flatMap(([langue, lot]) =>
    enPaquets([...new Set(lot.map((entree) => entree.titre))]).map((titres) => ({
      langue,
      lot,
      titres,
    })),
  );

  await Promise.all(
    demandes.map(async ({ langue, lot, titres }) => {
      try {
        const images = lireLesImages(
          await interroger(
            `https://${langue}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
              `&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=${LARGEUR}` +
              `&pilimit=50&titles=${encodeURIComponent(titres.join('|'))}`,
          ),
        );
        for (const { titre, id } of lot) {
          const image = images.get(titre);
          if (!image || illustrations[id]) continue;
          illustrations[id] = {
            url: image.url,
            auteur: null,
            licence: null,
            page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(image.fichier)}`,
          };
          const liste = fichiers.get(image.fichier) ?? [];
          liste.push(id);
          fichiers.set(image.fichier, liste);
        }
      } catch {
        // Une langue qui ne répond pas n'empêche pas les autres.
      }
    }),
  );

  // Les crédits, sur Commons, cinquante fichiers par appel.
  await Promise.all(
    enPaquets([...fichiers.keys()]).map(async (paquet) => {
      try {
        const noms = paquet.map((nom) => `File:${nom}`);
        const credits = lireLesCredits(
          await interroger(
            'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
              '&prop=imageinfo&iiprop=extmetadata&iiextmetadatafilter=Artist|LicenseShortName' +
              `&titles=${encodeURIComponent(noms.join('|'))}`,
          ),
        );
        for (const fichier of paquet) {
          const credit = credits.get(fichier);
          if (!credit) continue;
          for (const id of fichiers.get(fichier) ?? []) {
            const illustration = illustrations[id];
            if (illustration) {
              illustration.auteur = credit.auteur;
              illustration.licence = credit.licence;
            }
          }
        }
      } catch {
        // Sans crédit, on n'affiche pas l'image : voir `estAffichable`.
      }
    }),
  );

  return illustrations;
}

/**
 * Peut-on montrer cette image ?
 *
 * Non tant qu'on ne sait pas sous quelle licence. Les images de Commons sont
 * libres, presque jamais sans condition, et la condition la plus répandue est
 * d'indiquer l'auteur. Afficher sans crédit serait une réutilisation en
 * infraction — et une carte sans photo reste une carte.
 */
export function estAffichable(illustration: Illustration | undefined): boolean {
  return Boolean(illustration && illustration.licence);
}
