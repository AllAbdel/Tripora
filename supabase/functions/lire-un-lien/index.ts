import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, ecrireCache, lireCache, QuotaEpuise } from '../_shared/budget.ts';
import { AucuneIA, demanderIA, extraireJson, fournisseursDisponibles } from '../_shared/ia.ts';
import {
  adressePublique,
  carteDerriereLeConsentement,
  corpusDuLien,
  distanceKm,
  estUneCarte,
  lieuxCites,
  metaDeLaPage,
  oEmbedDe,
  premierLienDuTexte,
  sourceDe,
  type LieuCite,
  type SourceDuLien,
} from './lecture.ts';

/**
 * « Partager vers Tripora » : un lien devient des épingles pour le groupe.
 *
 * On tombe sur une vidéo TikTok « 5 adresses à Lisbonne », une fiche Google
 * Maps, un article de blog. On la partage à Tripora ; il lit ce qu'elle dit,
 * trouve les lieux cités, les situe près de la destination du voyage, et les
 * propose comme épingles — que la personne coche avant de les ajouter.
 *
 * Ce que fait le serveur, et rien de plus :
 *   1. suivre les raccourcis (maps.app.goo.gl, vm.tiktok.com) jusqu'à la vraie
 *      adresse, en refusant toute adresse qui ne soit pas du web public ;
 *   2. lire le titre et la légende (oEmbed pour TikTok et YouTube, balises de
 *      la page ailleurs), et un lieu décrit en JSON-LD s'il y en a un ;
 *   3. demander au modèle les noms de lieux cités — puis ne garder que ceux
 *      qui figurent réellement dans le texte ;
 *   4. situer chaque nom avec Photon, près de la destination.
 *
 * Un lien de carte n'a pas besoin de tout cela : l'application le lit seule,
 * et ne demande ici que de suivre un raccourci. Sans IA configurée, la
 * fonction rend quand même le titre et le lieu structuré : la personne
 * cherchera elle-même le reste.
 */

const AGENT = 'Mozilla/5.0 (compatible; Tripora/1.0; +https://tripora-3rg.pages.dev)';
const LIMITES_PHOTON = { soft: 400, hard: 700 };
/** Un même lien partagé par cinq personnes du groupe ne coûte qu'une lecture. */
const TTL_LECTURE = 7 * 24 * 60 * 60;
const TTL_GEOCODAGE = 180 * 24 * 60 * 60;
const PLAFOND_IA_PAR_PERSONNE = 40;
/** Au-delà, un lieu homonyme à l'autre bout du monde : on ne le propose pas. */
const RAYON_KM = 80;
const OCTETS_MAX = 600_000;

interface Lieu {
  nom: string;
  lat: number;
  lng: number;
  adresse: string | null;
}

interface Lecture {
  source: SourceDuLien;
  urlFinale: string;
  titre: string | null;
  lieux: Lieu[];
  /** Cités dans le texte mais introuvables sur la carte. */
  nonSitues: string[];
  sansIA: boolean;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  let corps: { lien?: unknown; texte?: unknown; pres?: unknown; destination?: unknown };
  try {
    corps = await request.json();
  } catch {
    return json({ error: 'Corps de requête illisible' }, 400);
  }

  const utilisateur = await identifier(request);
  if (!utilisateur) return json({ error: 'Connexion requise' }, 401);

  const texte = typeof corps.texte === 'string' ? corps.texte.slice(0, 3000) : '';
  const brut =
    (typeof corps.lien === 'string' && corps.lien.trim()) || premierLienDuTexte(texte) || '';
  const depart = adressePublique(brut);
  if (!depart) return json({ ok: false, raison: 'lien' });

  const pres = lirePoint(corps.pres);
  const destination =
    typeof corps.destination === 'string' ? corps.destination.trim().slice(0, 80) : '';
  const client = serviceClient();

  try {
    const urlFinale = await suivre(depart);
    const source = sourceDe(urlFinale);

    // Une carte : l'application la lit elle-même, on lui rend l'adresse suivie.
    if (source === 'carte') {
      return json({ ok: true, source, urlFinale: urlFinale.toString(), titre: null, lieux: [], nonSitues: [], sansIA: true });
    }

    const cle = `lien:v1:${urlFinale.toString()}|${pres ? `${pres.lat.toFixed(1)},${pres.lng.toFixed(1)}` : '-'}`;
    const cache = await lireCache<Lecture>(client, cle);
    if (cache?.fraiche) return json({ ok: true, ...cache.valeur });

    const lecture = await lire(client, utilisateur, urlFinale, source, texte, pres, destination);
    await ecrireCache(client, cle, 'lien', lecture, TTL_LECTURE);
    return json({ ok: true, ...lecture });
  } catch (cause) {
    if (cause instanceof QuotaEpuise) return json({ ok: false, raison: 'quota' });
    console.warn('lire-un-lien', cause instanceof Error ? cause.message : cause);
    return json({ ok: false, raison: 'lecture' });
  }
});

async function identifier(request: Request): Promise<string | null> {
  const entete = request.headers.get('authorization');
  if (!entete?.startsWith('Bearer ')) return null;
  const { data } = await serviceClient().auth.getUser(entete.slice(7));
  return data.user?.id ?? null;
}

function lirePoint(brut: unknown): { lat: number; lng: number } | null {
  if (brut === null || typeof brut !== 'object') return null;
  const lat = Number((brut as { lat?: unknown }).lat);
  const lng = Number((brut as { lng?: unknown }).lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Suit les redirections à la main, pour contrôler chaque étape : une adresse
 * publique au départ peut rediriger vers une adresse interne. Une carte
 * Google est rendue dès qu'on la voit passer, sans l'ouvrir — y compris
 * derrière la page de consentement.
 */
async function suivre(depart: URL): Promise<URL> {
  let courante = depart;
  for (let saut = 0; saut < 6; saut += 1) {
    if (saut > 0 && estUneCarte(courante)) return courante;
    const consentement = carteDerriereLeConsentement(courante);
    if (consentement) return consentement;
    // Seuls les raccourcis méritent d'être suivis ; une page ordinaire sera
    // lue plus tard, en une seule requête.
    if (!estUnRaccourci(courante)) return courante;

    const reponse = await fetch(courante, {
      redirect: 'manual',
      headers: { 'user-agent': AGENT, accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(7000),
    });
    await reponse.body?.cancel();
    const suite = reponse.headers.get('location');
    if (reponse.status < 300 || reponse.status >= 400 || !suite) return courante;
    const prochaine = adressePublique(new URL(suite, courante).toString());
    if (!prochaine) throw new Error('redirection vers une adresse refusée');
    courante = prochaine;
  }
  throw new Error('trop de redirections');
}

function estUnRaccourci(url: URL): boolean {
  const h = url.hostname.toLowerCase();
  return (
    h === 'maps.app.goo.gl' ||
    h === 'goo.gl' ||
    h === 'vm.tiktok.com' ||
    h === 'vt.tiktok.com' ||
    (h.endsWith('tiktok.com') && url.pathname.startsWith('/t/')) ||
    h === 'youtu.be' ||
    h === 'bit.ly' ||
    h === 't.co' ||
    h === 'tinyurl.com'
  );
}

async function lire(
  client: ReturnType<typeof serviceClient>,
  utilisateur: string,
  url: URL,
  source: SourceDuLien,
  texte: string,
  pres: { lat: number; lng: number } | null,
  destination: string,
): Promise<Lecture> {
  let titre: string | null = null;
  let description: string | null = null;
  let structure: Lieu | null = null;

  const oembed = oEmbedDe(url);
  if (oembed) {
    // Titre et légende de la vidéo. Le nom de l'auteur n'est pas gardé : ce
    // n'est pas un lieu, et c'est le nom d'une personne.
    const donnees = await recupererJson(oembed).catch(() => null);
    titre = typeof donnees?.['title'] === 'string' ? (donnees['title'] as string).slice(0, 600) : null;
  } else {
    const html = await recupererTexte(url).catch(() => null);
    if (html) {
      const meta = metaDeLaPage(html);
      titre = meta.titre;
      description = meta.description;
      structure = meta.lieu;
    }
  }

  const corpus = corpusDuLien([titre, description, texte]);
  const lieux: Lieu[] = structure ? [structure] : [];
  const nonSitues: string[] = [];
  let sansIA = true;

  if (corpus.length >= 8 && fournisseursDisponibles().length > 0 && (await quotaIA(client, utilisateur))) {
    const cites = await extraireLesLieux(corpus, destination).catch((cause) => {
      if (!(cause instanceof AucuneIA)) console.warn('lire-un-lien ia', cause);
      return null;
    });
    if (cites) {
      sansIA = false;
      for (const cite of cites) {
        if (lieux.some((lieu) => lieu.nom.toLowerCase() === cite.nom.toLowerCase())) continue;
        const situe = await situer(client, cite, pres).catch((cause) => {
          if (cause instanceof QuotaEpuise) throw cause;
          return null;
        });
        if (situe) lieux.push(situe);
        else nonSitues.push(cite.nom);
      }
    }
  }

  return { source, urlFinale: url.toString(), titre: titre ?? description, lieux, nonSitues, sansIA };
}

async function quotaIA(client: ReturnType<typeof serviceClient>, utilisateur: string): Promise<boolean> {
  const { data } = await client.rpc('bump_user_ai_quota', {
    p_user_id: utilisateur,
    p_limit: PLAFOND_IA_PAR_PERSONNE,
  });
  const ligne = Array.isArray(data) ? data[0] : data;
  return !(ligne && ligne.allowed === false);
}

const CONSIGNE = `Tu relèves les noms de lieux précis cités dans le texte d'une vidéo, d'une publication ou d'une page de voyage.

Réponds UNIQUEMENT par un objet JSON : {"lieux":[{"nom":"...","ville":"..."}]}

Règles :
- Ne garde que des lieux nommés explicitement dans le texte : restaurant, café, bar, boulangerie, marché, musée, monument, église, parc, jardin, plage, point de vue, quartier, rue, boutique, hôtel.
- Recopie chaque nom exactement comme il est écrit dans le texte, sans le traduire ni le corriger.
- N'ajoute jamais un lieu que tu connais par ailleurs, même célèbre, même évident.
- « ville » seulement si le texte la cite ; sinon omets la clé.
- Ignore les villes et les pays eux-mêmes : on cherche des endroits où aller.
- Aucun lieu cité : {"lieux":[]}. Huit lieux au plus.`;

async function extraireLesLieux(corpus: string, destination: string): Promise<LieuCite[]> {
  const { valeur } = await demanderIA<LieuCite[]>({
    tache: 'lieux-du-lien',
    systeme: CONSIGNE,
    message: `${destination ? `Destination du voyage : ${destination}\n` : ''}Texte :\n${corpus}`,
    maxTokens: 400,
    json: true,
    valider: (brut) => lieuxCites(extraireJson(brut), corpus),
  });
  return valeur;
}

/** Photon, biaisé vers la destination, et filtré à quatre-vingts kilomètres d'elle. */
async function situer(
  client: ReturnType<typeof serviceClient>,
  cite: LieuCite,
  pres: { lat: number; lng: number } | null,
): Promise<Lieu | null> {
  const q = cite.ville ? `${cite.nom}, ${cite.ville}` : cite.nom;
  const biais = pres ? `${pres.lat.toFixed(2)},${pres.lng.toFixed(2)}` : '-';
  const { valeur } = await avecCacheEtQuota<Lieu | null>({
    client,
    cle: `lien-lieu:${q.toLocaleLowerCase('fr')}|${biais}`,
    provider: 'photon',
    ttlSecondes: TTL_GEOCODAGE,
    limites: LIMITES_PHOTON,
    appel: async () => {
      const url = new URL('https://photon.komoot.io/api');
      url.searchParams.set('q', q);
      url.searchParams.set('lang', 'fr');
      url.searchParams.set('limit', '3');
      if (pres) {
        url.searchParams.set('lat', String(pres.lat));
        url.searchParams.set('lon', String(pres.lng));
      }
      const reponse = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (!reponse.ok) throw new Error(`Photon ${reponse.status}`);
      const brut = (await reponse.json()) as {
        features?: { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }[];
      };
      for (const trait of brut.features ?? []) {
        const coords = trait.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) continue;
        const [lng, lat] = coords as number[];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (pres && distanceKm(pres, { lat, lng }) > RAYON_KM) continue;
        const p = trait.properties ?? {};
        // Une ville ou un pays entier n'est pas un endroit à épingler.
        if (['country', 'state', 'city', 'county'].includes(String(p['type']))) continue;
        const texte = (cle: string) => (typeof p[cle] === 'string' ? (p[cle] as string).trim() : '');
        const adresse = [
          [texte('housenumber'), texte('street')].filter(Boolean).join(' '),
          texte('city'),
          texte('country'),
        ]
          .filter(Boolean)
          .join(', ');
        return { nom: cite.nom, lat, lng, adresse: adresse ? adresse.slice(0, 300) : null };
      }
      return null;
    },
  });
  return valeur;
}

async function recupererJson(url: URL): Promise<Record<string, unknown> | null> {
  const texte = await recupererTexte(url, 'application/json');
  const donnees = JSON.parse(texte) as unknown;
  return donnees && typeof donnees === 'object' ? (donnees as Record<string, unknown>) : null;
}

/** Une page, lue en une requête, sans suivre de redirection et sans dépasser 600 Ko. */
async function recupererTexte(url: URL, accept = 'text/html,application/xhtml+xml'): Promise<string> {
  const reponse = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': AGENT, accept, 'accept-language': 'fr,en;q=0.8' },
    signal: AbortSignal.timeout(7000),
  });
  if (!reponse.ok || !reponse.body) {
    await reponse.body?.cancel();
    throw new Error(`HTTP ${reponse.status}`);
  }
  const lecteur = reponse.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  while (total < OCTETS_MAX) {
    const { done, value } = await lecteur.read();
    if (done || !value) break;
    morceaux.push(value);
    total += value.length;
  }
  await lecteur.cancel().catch(() => undefined);
  const tout = new Uint8Array(Math.min(total, OCTETS_MAX));
  let position = 0;
  for (const morceau of morceaux) {
    const reste = tout.length - position;
    if (reste <= 0) break;
    tout.set(morceau.subarray(0, reste), position);
    position += Math.min(morceau.length, reste);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(tout);
}
