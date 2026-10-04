import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { consommerQuota } from '../_shared/budget.ts';

/**
 * Relève les normales climatiques d'une ville, et les range dans le catalogue.
 *
 * Les cinquante-cinq villes d'origine avaient leurs normales écrites à la main
 * dans `packages/core/src/catalog/climate.ts`. Le catalogue en compte cinq
 * cents, et ces chiffres ne se devinent pas : « Kyoto en octobre » est une
 * mesure, pas une impression. Cette fonction va les chercher là où elles sont.
 *
 * Trois ans complets d'archives Open-Meteo (2023-2025), moyennés mois par
 * mois. Un jour de pluie compte à partir d'un millimètre, et le nombre affiché
 * est une moyenne annuelle — pas un total sur trois ans.
 *
 * Deux refus assumés :
 *
 *  - **une année à trous n'est pas écrite.** Si un seul mois manque de
 *    mesures, la ville reste sans normales et retombe sur `bestMonths`. Un
 *    mois manquant passerait sinon pour « pas de données » sur une ville qui
 *    en a, ce qui est pire que pas de données du tout.
 *  - **rien n'est réécrit.** On ne remplit que les villes encore vides, ce qui
 *    rend l'appel rejouable sans risque et sans quota gaspillé.
 *
 * Open-Meteo accepte plusieurs points par requête : dix villes d'un coup, soit
 * cinquante requêtes pour tout le catalogue. Très en dessous de ce que le
 * service tolère, et cela ne se refait pas — une normale climatique bouge à
 * l'échelle de la décennie.
 */

const PROVIDER = 'open-meteo-archive';
const LIMITES = { soft: 400, hard: 600 };
const AGENT = 'Tripora/1.0 (application de voyage entre amis, non commerciale)';
/** Trois années complètes : assez pour lisser une saison, pas pour dater. */
const DEBUT = '2023-01-01';
const FIN = '2025-12-31';
/** Villes par requête Open-Meteo. */
const PAR_APPEL = 10;
/** Respiration entre deux requêtes, pour rester un bon client. */
const PAUSE_MS = 1500;
/** Villes par invocation : reste très en dessous des 150 s d'une Edge Function. */
const MAX_PAR_INVOCATION = 50;

interface Ville {
  id: string;
  lat: number;
  lng: number;
}

interface Quotidien {
  time?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  precipitation_sum?: unknown;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  const client = serviceClient();

  // Pas de vérification de session ici, contrairement à `geocode/retain`, et
  // c'est délibéré : cette fonction n'écrit rien de ce que l'appelant envoie.
  // Elle ne fait que recopier des mesures d'Open-Meteo dans des lignes encore
  // vides. Le seul abus possible est de consommer du quota, et c'est
  // exactement ce que le garde-quota plus bas empêche. La plateforme exige
  // déjà un jeton valable (`verify_jwt`).

  let corps: { limite?: unknown } = {};
  try {
    corps = await request.json();
  } catch {
    // Un corps vide est valable : on prend la taille par défaut.
  }
  const demande = Number(corps.limite);
  const limite = Number.isInteger(demande) && demande > 0
    ? Math.min(demande, MAX_PAR_INVOCATION)
    : MAX_PAR_INVOCATION;

  const { data, error } = await client
    .from('destinations')
    .select('id, lat, lng')
    .is('climate', null)
    .eq('discovered', false)
    .order('id')
    .limit(limite);
  if (error) return json({ error: error.message }, 500);

  const villes = (data ?? []) as Ville[];
  if (villes.length === 0) {
    return json({ remplies: 0, ignorees: 0, restantes: 0, termine: true });
  }

  let remplies = 0;
  let ignorees = 0;
  let echecs = 0;

  for (let debut = 0; debut < villes.length; debut += PAR_APPEL) {
    const lot = villes.slice(debut, debut + PAR_APPEL);

    // Open-Meteo est gratuit et communautaire : une requête de trois ans sur
    // dix points pèse lourd, et les enchaîner sans respirer se fait refuser.
    if (debut > 0) await new Promise((suite) => setTimeout(suite, PAUSE_MS));

    const autorisation = await consommerQuota(client, PROVIDER, LIMITES);
    if (autorisation === 'epuise') {
      return json({ remplies, ignorees, unavailable: true, reason: 'quota' });
    }

    // Un lot qui échoue ne doit pas arrêter les suivants : les villes non
    // relevées restent simplement vides, et le prochain appel les reprendra.
    // Abandonner au premier hoquet obligeait à relancer dix fois de suite.
    let series: Quotidien[];
    try {
      series = await archives(lot);
    } catch (cause) {
      console.error('climate-normals', cause);
      echecs += 1;
      ignorees += lot.length;
      continue;
    }

    for (const [index, ville] of lot.entries()) {
      const calcul = normales(series[index]);
      if (!calcul) {
        ignorees += 1;
        continue;
      }
      const { error: ecriture } = await client
        .from('destinations')
        .update({ climate: calcul })
        .eq('id', ville.id);
      if (ecriture) {
        console.error('climate-normals write', ville.id, ecriture.message);
        ignorees += 1;
        continue;
      }
      remplies += 1;
    }
  }

  const { count } = await client
    .from('destinations')
    .select('id', { count: 'exact', head: true })
    .is('climate', null)
    .eq('discovered', false);

  return json({ remplies, ignorees, echecs, restantes: count ?? 0, termine: (count ?? 0) === 0 });
});

async function archives(villes: readonly Ville[]): Promise<Quotidien[]> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', villes.map((v) => v.lat).join(','));
  url.searchParams.set('longitude', villes.map((v) => v.lng).join(','));
  url.searchParams.set('start_date', DEBUT);
  url.searchParams.set('end_date', FIN);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
  url.searchParams.set('timezone', 'UTC');

  const reponse = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!reponse.ok) throw new Error(`Open-Meteo ${reponse.status}`);

  // Un seul point renvoie un objet, plusieurs renvoient un tableau.
  const brut = await reponse.json();
  const liste = Array.isArray(brut) ? brut : [brut];
  return liste.map((entree) => (entree?.daily ?? {}) as Quotidien);
}

/** Les douze triplets, ou `null` si l'année a le moindre trou. */
function normales(serie: Quotidien | undefined): number[] | null {
  const jours = tableau(serie?.time);
  const maxima = tableau(serie?.temperature_2m_max);
  const minima = tableau(serie?.temperature_2m_min);
  const pluies = tableau(serie?.precipitation_sum);
  if (jours.length === 0 || maxima.length !== jours.length) return null;

  const sommeMax = new Array<number>(12).fill(0);
  const sommeMin = new Array<number>(12).fill(0);
  const mesures = new Array<number>(12).fill(0);
  const joursDePluie = new Array<number>(12).fill(0);
  const annees = new Set<string>();

  for (let i = 0; i < jours.length; i += 1) {
    const date = jours[i];
    const max = maxima[i];
    const min = minima[i];
    if (typeof date !== 'string' || typeof max !== 'number' || typeof min !== 'number') continue;

    const mois = Number(date.slice(5, 7)) - 1;
    if (!Number.isInteger(mois) || mois < 0 || mois > 11) continue;

    annees.add(date.slice(0, 4));
    sommeMax[mois] += max;
    sommeMin[mois] += min;
    mesures[mois] += 1;

    const mm = pluies[i];
    if (typeof mm === 'number' && mm >= 1) joursDePluie[mois] += 1;
  }

  const nbAnnees = annees.size || 1;
  const sortie: number[] = [];
  for (let mois = 0; mois < 12; mois += 1) {
    // Un mois sans aucune mesure rendrait la série trompeuse : on préfère
    // n'écrire rien, et laisser la ville sur sa saisonnalité assumée.
    if (mesures[mois] === 0) return null;
    sortie.push(
      Math.round(sommeMax[mois] / mesures[mois]),
      Math.round(sommeMin[mois] / mesures[mois]),
      Math.round(joursDePluie[mois] / nbAnnees),
    );
  }
  return sortie;
}

function tableau(valeur: unknown): unknown[] {
  return Array.isArray(valeur) ? valeur : [];
}
