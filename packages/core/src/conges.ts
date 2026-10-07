import { paysDuPoint } from './catalog/origins.js';
import { codeDuPays } from './catalog/pays.js';
import { FERIES_CONNUS, FERIES_DU_MONDE } from './feries-du-monde.js';
import { haversineKm } from './geo.js';
import type { GeoPoint } from './types.js';
import { VACANCES_DU_MONDE, VACANCES_RELEVEES_LE } from './vacances-du-monde.js';

/**
 * Les jours où l'on peut partir : vacances scolaires, jours fériés, ponts.
 *
 * Choisir des dates, pour un groupe, c'est d'abord chercher les jours que tout
 * le monde a libres. Une famille regarde les vacances de sa zone ; des amis
 * qui travaillent guettent le jeudi de l'Ascension et le 8 mai un vendredi.
 * Tripora les connaît, et les propose.
 *
 * **Selon le pays de départ.** Le 8 mai n'est férié qu'en France ; à Londres,
 * c'est le lundi de Pâques et le dernier lundi d'août ; à Riyad, le week-end
 * tombe le vendredi et le samedi. Les fériés de la France sont écrits ici, à
 * la main ; ceux des autres pays viennent de `feries-du-monde.ts` (généré).
 * Les vacances scolaires de la France aussi ; celles d'une quinzaine d'autres
 * pays viennent de `vacances-du-monde.ts` (généré depuis OpenHolidays).
 * Ailleurs, on n'en parle pas plutôt que de plaquer le calendrier français.
 */

export type ZoneScolaire = 'A' | 'B' | 'C';

export interface PeriodeDeVacances {
  nom: string;
  /** Hors de France : le nom en anglais (en France, la traduction de l'interface s'en charge). */
  en?: string;
  zones: readonly ZoneScolaire[];
  /** Hors de France : les régions concernées, par leur code ; absent pour tout le pays. */
  regions?: readonly string[];
  /** Premier jour sans classe (AAAA-MM-JJ). */
  debut: string;
  /** Dernier jour sans classe, inclus. */
  fin: string;
  /** Vrai quand la fin n'est pas encore publiée : on retient alors le 31 août. */
  finProvisoire?: boolean;
}

const TOUTES: readonly ZoneScolaire[] = ['A', 'B', 'C'];

/**
 * Le calendrier scolaire officiel de la métropole.
 *
 * Source : jeu de données « Calendrier scolaire » du ministère de l'Éducation
 * nationale (data.education.gouv.fr, `fr-en-calendrier-scolaire`), relevé le
 * 30/09/2026. Le jeu donne le premier jour de vacances et le jour de reprise,
 * en heure de Paris : on retient ici le dernier jour de vacances, la veille
 * de la reprise. Le pont de l'Ascension court du jeudi férié au dimanche.
 *
 * À compléter chaque année quand l'année scolaire suivante est publiée : le
 * test `conges.test.ts` rappelle quand la dernière période approche.
 */
export const VACANCES_SCOLAIRES: readonly PeriodeDeVacances[] = [
  // 2025-2026
  { nom: 'Vacances de la Toussaint', zones: TOUTES, debut: '2025-10-18', fin: '2025-11-02' },
  { nom: 'Vacances de Noël', zones: TOUTES, debut: '2025-12-20', fin: '2026-01-04' },
  { nom: 'Vacances d’hiver', zones: ['A'], debut: '2026-02-07', fin: '2026-02-22' },
  { nom: 'Vacances d’hiver', zones: ['B'], debut: '2026-02-14', fin: '2026-03-01' },
  { nom: 'Vacances d’hiver', zones: ['C'], debut: '2026-02-21', fin: '2026-03-08' },
  { nom: 'Vacances de printemps', zones: ['A'], debut: '2026-04-04', fin: '2026-04-19' },
  { nom: 'Vacances de printemps', zones: ['B'], debut: '2026-04-11', fin: '2026-04-26' },
  { nom: 'Vacances de printemps', zones: ['C'], debut: '2026-04-18', fin: '2026-05-03' },
  { nom: 'Pont de l’Ascension', zones: TOUTES, debut: '2026-05-14', fin: '2026-05-17' },
  { nom: 'Vacances d’été', zones: TOUTES, debut: '2026-07-04', fin: '2026-08-31' },
  // 2026-2027
  { nom: 'Vacances de la Toussaint', zones: TOUTES, debut: '2026-10-17', fin: '2026-11-01' },
  { nom: 'Vacances de Noël', zones: TOUTES, debut: '2026-12-19', fin: '2027-01-03' },
  { nom: 'Vacances d’hiver', zones: ['C'], debut: '2027-02-06', fin: '2027-02-21' },
  { nom: 'Vacances d’hiver', zones: ['A'], debut: '2027-02-13', fin: '2027-02-28' },
  { nom: 'Vacances d’hiver', zones: ['B'], debut: '2027-02-20', fin: '2027-03-07' },
  { nom: 'Vacances de printemps', zones: ['C'], debut: '2027-04-03', fin: '2027-04-18' },
  { nom: 'Vacances de printemps', zones: ['A'], debut: '2027-04-10', fin: '2027-04-25' },
  { nom: 'Vacances de printemps', zones: ['B'], debut: '2027-04-17', fin: '2027-05-02' },
  { nom: 'Pont de l’Ascension', zones: TOUTES, debut: '2027-05-06', fin: '2027-05-09' },
  { nom: 'Vacances d’été', zones: TOUTES, debut: '2027-07-03', fin: '2027-09-01' },
  // 2027-2028
  { nom: 'Vacances de la Toussaint', zones: TOUTES, debut: '2027-10-23', fin: '2027-11-07' },
  { nom: 'Vacances de Noël', zones: TOUTES, debut: '2027-12-18', fin: '2028-01-02' },
  { nom: 'Vacances d’hiver', zones: ['B'], debut: '2028-02-05', fin: '2028-02-20' },
  { nom: 'Vacances d’hiver', zones: ['C'], debut: '2028-02-12', fin: '2028-02-27' },
  { nom: 'Vacances d’hiver', zones: ['A'], debut: '2028-02-19', fin: '2028-03-05' },
  { nom: 'Vacances de printemps', zones: ['B'], debut: '2028-04-08', fin: '2028-04-23' },
  { nom: 'Vacances de printemps', zones: ['C'], debut: '2028-04-15', fin: '2028-05-01' },
  { nom: 'Vacances de printemps', zones: ['A'], debut: '2028-04-22', fin: '2028-05-08' },
  { nom: 'Pont de l’Ascension', zones: TOUTES, debut: '2028-05-25', fin: '2028-05-28' },
  {
    nom: 'Vacances d’été',
    zones: TOUTES,
    debut: '2028-07-04',
    fin: '2028-08-31',
    finProvisoire: true,
  },
];

// ---------------------------------------------------------------------------
// Les zones
// ---------------------------------------------------------------------------

/**
 * Des villes de référence par zone : les sièges d'académie, plus quelques
 * villes proches d'une frontière entre académies, où la plus proche des
 * capitales se tromperait (Pau est de l'académie de Bordeaux, pas de celle de
 * Toulouse, pourtant plus proche).
 */
const VILLES_DES_ZONES: readonly (GeoPoint & { zone: ZoneScolaire })[] = [
  // Zone A : Besançon, Bordeaux, Clermont-Ferrand, Dijon, Grenoble, Limoges, Lyon, Poitiers.
  { zone: 'A', lat: 47.2378, lng: 6.0241 },
  { zone: 'A', lat: 44.8378, lng: -0.5792 },
  { zone: 'A', lat: 45.7772, lng: 3.087 },
  { zone: 'A', lat: 47.322, lng: 5.0415 },
  { zone: 'A', lat: 45.1885, lng: 5.7245 },
  { zone: 'A', lat: 45.8336, lng: 1.2611 },
  { zone: 'A', lat: 45.764, lng: 4.8357 },
  { zone: 'A', lat: 46.5802, lng: 0.3404 },
  // Pau, Bayonne, Agen, Saint-Étienne, Annecy, Chambéry, Valence, La Rochelle, Brive.
  { zone: 'A', lat: 43.2951, lng: -0.3708 },
  { zone: 'A', lat: 43.4929, lng: -1.4748 },
  { zone: 'A', lat: 44.2033, lng: 0.6163 },
  { zone: 'A', lat: 45.4397, lng: 4.3872 },
  { zone: 'A', lat: 45.8992, lng: 6.1294 },
  { zone: 'A', lat: 45.5646, lng: 5.9178 },
  { zone: 'A', lat: 44.9334, lng: 4.8924 },
  { zone: 'A', lat: 46.1603, lng: -1.1511 },
  { zone: 'A', lat: 45.1589, lng: 1.5331 },
  // Zone B : Aix, Marseille, Amiens, Lille, Nancy, Metz, Nantes, Nice, Caen, Rouen, Orléans, Tours, Reims, Rennes, Strasbourg.
  { zone: 'B', lat: 43.5297, lng: 5.4474 },
  { zone: 'B', lat: 43.2965, lng: 5.3698 },
  { zone: 'B', lat: 49.8941, lng: 2.2958 },
  { zone: 'B', lat: 50.6292, lng: 3.0573 },
  { zone: 'B', lat: 48.6921, lng: 6.1844 },
  { zone: 'B', lat: 49.1193, lng: 6.1757 },
  { zone: 'B', lat: 47.2184, lng: -1.5536 },
  { zone: 'B', lat: 43.7102, lng: 7.262 },
  { zone: 'B', lat: 49.1829, lng: -0.3707 },
  { zone: 'B', lat: 49.4432, lng: 1.0999 },
  { zone: 'B', lat: 47.903, lng: 1.9093 },
  { zone: 'B', lat: 47.3941, lng: 0.6848 },
  { zone: 'B', lat: 49.2583, lng: 4.0317 },
  { zone: 'B', lat: 48.1173, lng: -1.6778 },
  { zone: 'B', lat: 48.5734, lng: 7.7521 },
  // Brest, Le Havre, Le Mans, Angers, Mulhouse, Troyes, Bourges, Toulon, Avignon.
  { zone: 'B', lat: 48.3904, lng: -4.4861 },
  { zone: 'B', lat: 49.4944, lng: 0.1079 },
  { zone: 'B', lat: 48.0061, lng: 0.1996 },
  { zone: 'B', lat: 47.4784, lng: -0.5632 },
  { zone: 'B', lat: 47.7508, lng: 7.3359 },
  { zone: 'B', lat: 48.2973, lng: 4.0744 },
  { zone: 'B', lat: 47.081, lng: 2.3988 },
  { zone: 'B', lat: 43.1242, lng: 5.928 },
  { zone: 'B', lat: 43.9493, lng: 4.8055 },
  // Zone C : Créteil, Paris, Versailles, Montpellier, Toulouse.
  { zone: 'C', lat: 48.7904, lng: 2.4556 },
  { zone: 'C', lat: 48.8566, lng: 2.3522 },
  { zone: 'C', lat: 48.8049, lng: 2.1204 },
  { zone: 'C', lat: 43.6108, lng: 3.8767 },
  { zone: 'C', lat: 43.6047, lng: 1.4442 },
  // Nîmes, Perpignan, Albi, Tarbes, Montauban, Rodez.
  { zone: 'C', lat: 43.8367, lng: 4.3601 },
  { zone: 'C', lat: 42.6887, lng: 2.8948 },
  { zone: 'C', lat: 43.9289, lng: 2.148 },
  { zone: 'C', lat: 43.2328, lng: 0.0781 },
  { zone: 'C', lat: 44.0176, lng: 1.355 },
  { zone: 'C', lat: 44.3506, lng: 2.575 },
];

/**
 * La zone probable d'un point de départ, s'il est en France métropolitaine.
 *
 * Une supposition, affichée comme telle et modifiable : les frontières entre
 * académies suivent les régions, pas les distances.
 */
export function zoneProbable(point: GeoPoint & { country?: string | undefined }): ZoneScolaire | null {
  const pays = point.country ?? paysDuPoint(point, 120);
  if (pays !== 'France') return null;
  let meilleure: { zone: ZoneScolaire; km: number } | null = null;
  for (const ville of VILLES_DES_ZONES) {
    const km = haversineKm(point, ville);
    if (!meilleure || km < meilleure.km) meilleure = { zone: ville.zone, km };
  }
  // Loin de toute ville de référence (Corse, outre-mer) : on ne devine pas.
  return meilleure && meilleure.km <= 150 ? meilleure.zone : null;
}

// ---------------------------------------------------------------------------
// Les jours fériés
// ---------------------------------------------------------------------------

export interface JourFerie {
  date: string;
  nom: string;
  /** Le nom en anglais, pour l'interface en anglais. */
  en: string;
  /** Un jour chômé à la place d'un férié tombé le week-end. */
  reporte?: boolean;
  /** Une fête réglée sur la lune : la date dépend de son observation. */
  estime?: boolean;
}

/** Le dimanche de Pâques (calendrier grégorien, algorithme de Meeus). */
export function dimancheDePaques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(annee, mois, jour);
}

/** Les onze jours fériés de la métropole (hors Alsace-Moselle et outre-mer). */
export function joursFeries(annee: number): JourFerie[] {
  const paques = dimancheDePaques(annee);
  return [
    { date: iso(annee, 1, 1), nom: 'Jour de l’an', en: 'New Year’s Day' },
    { date: decaler(paques, 1), nom: 'Lundi de Pâques', en: 'Easter Monday' },
    { date: iso(annee, 5, 1), nom: 'Fête du Travail', en: 'Labour Day' },
    { date: iso(annee, 5, 8), nom: 'Victoire 1945', en: 'Victory in Europe Day' },
    { date: decaler(paques, 39), nom: 'Ascension', en: 'Ascension Day' },
    { date: decaler(paques, 50), nom: 'Lundi de Pentecôte', en: 'Whit Monday' },
    { date: iso(annee, 7, 14), nom: 'Fête nationale', en: 'Bastille Day' },
    { date: iso(annee, 8, 15), nom: 'Assomption', en: 'Assumption Day' },
    { date: iso(annee, 11, 1), nom: 'Toussaint', en: 'All Saints’ Day' },
    { date: iso(annee, 11, 11), nom: 'Armistice', en: 'Armistice Day' },
    { date: iso(annee, 12, 25), nom: 'Noël', en: 'Christmas Day' },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

// ---------------------------------------------------------------------------
// Le pays de départ
// ---------------------------------------------------------------------------

/**
 * Le pays d'un point de départ, en code ISO (« FR », « GB ») ; `null` quand on
 * ne le sait pas (un point loin de toute ville connue).
 */
export function paysDeDepart(point: GeoPoint & { country?: string | undefined }): string | null {
  return codeDuPays(point.country ?? paysDuPoint(point, 120)) ?? null;
}

/** Vrai quand Tripora connaît les jours fériés de ce pays. */
export function feriesConnus(pays: string | null | undefined): boolean {
  return pays === 'FR' || (pays != null && pays in FERIES_DU_MONDE);
}

/** Les jours du week-end, numérotés comme `Date.getUTCDay()` : samedi et dimanche presque partout. */
export function weekendDu(pays: string): readonly number[] {
  return FERIES_DU_MONDE[pays]?.w ?? [6, 0];
}

const LUS = new Map<string, JourFerie[]>();

/** Les jours fériés d'un pays pour une année ; aucun pour un pays inconnu. */
export function joursFeriesDu(pays: string, annee: number): JourFerie[] {
  if (pays === 'FR') return joursFeries(annee);
  const donnees = FERIES_DU_MONDE[pays];
  if (!donnees) return [];
  let tous = LUS.get(pays);
  if (!tous) {
    tous = [];
    for (const bloc of donnees.d.split(';')) {
      const [an, jours] = bloc.split(':') as [string, string];
      for (const jour of jours.split(',')) {
        const lu = /^(\d{2})(\d{2})(\d+)([re]?)$/u.exec(jour);
        const noms = lu ? donnees.n[Number(lu[3])] : undefined;
        if (!lu || !noms) continue;
        const [francais, anglais = francais] = noms;
        // « Day off » : un jour de pont accordé par l'État (Chine), pas un férié reporté.
        const reporte = lu[4] === 'r' && anglais !== 'Day off';
        tous.push({
          date: `${an}-${lu[1]}-${lu[2]}`,
          nom: reporte ? `${francais} (jour reporté)` : francais,
          en: reporte ? `${anglais} (observed)` : anglais,
          ...(reporte ? { reporte: true } : {}),
          ...(lu[4] === 'e' ? { estime: true } : {}),
        });
      }
    }
    LUS.set(pays, tous);
  }
  return tous.filter((jour) => jour.date.startsWith(`${annee}-`));
}

/** Jusqu'à quelle date les jours fériés des pays hors France sont connus. */
export function feriesConnusJusquau(): string {
  return `${FERIES_CONNUS.derniere}-12-31`;
}

// ---------------------------------------------------------------------------
// Les ponts et les vacances à venir
// ---------------------------------------------------------------------------

export interface OccasionDePartir {
  /** « Ascension », « Vacances de printemps (zone C) ». */
  nom: string;
  /** Le nom en anglais, pour un pont (les vacances, françaises, passent par la traduction de l'interface). */
  nomEn?: string;
  debut: string;
  fin: string;
  /** Jours de suite, week-end compris. */
  jours: number;
  /** Jours de congé à poser pour en profiter (0 pour un lundi férié). */
  aPoser: number;
  nature: 'pont' | 'vacances';
  finProvisoire?: boolean;
}

/** Au-delà, poser des jours n'est plus un pont, ce sont des vacances. */
const JOURS_A_POSER_MAX = 2;

/**
 * Les week-ends prolongés par un jour férié, entre deux dates, dans un pays.
 *
 * Autour de chaque férié tombé en semaine, on prend les jours chômés qui le
 * touchent (week-end, autres fériés), puis, s'il le faut, un ou deux jours de
 * congé pour rejoindre le week-end le plus proche. En France : un férié un
 * lundi ou un vendredi donne trois jours sans rien poser ; un mardi ou un
 * jeudi, quatre pour un jour posé ; un mercredi, cinq pour deux. Un férié le
 * week-end ne donne rien — sauf là où il est reporté au lundi, comme au
 * Royaume-Uni : c'est alors le lundi qui compte. Plusieurs fériés d'affilée
 * (Noël et le lendemain, le Nouvel An chinois) ne font qu'une occasion.
 */
export function pontsEntre(depuis: string, jusqua: string, pays = 'FR'): OccasionDePartir[] {
  const weekend = new Set(weekendDu(pays));
  const feries = new Map<string, JourFerie[]>();
  for (let annee = Number(depuis.slice(0, 4)) - 1; annee <= Number(jusqua.slice(0, 4)) + 1; annee += 1) {
    for (const ferie of joursFeriesDu(pays, annee)) feries.set(ferie.date, [...(feries.get(ferie.date) ?? []), ferie]);
  }
  const chome = (jour: string) => weekend.has(jourDeLaSemaine(jour)) || feries.has(jour);

  const ponts: OccasionDePartir[] = [];
  for (const date of [...feries.keys()].sort()) {
    if (date < depuis || date > jusqua || weekend.has(jourDeLaSemaine(date))) continue;
    if (ponts.length > 0 && date <= ponts[ponts.length - 1]!.fin) continue;
    // Les jours chômés d'affilée autour du férié.
    let debut = date;
    let fin = date;
    while (chome(decaler(debut, -1))) debut = decaler(debut, -1);
    while (chome(decaler(fin, 1))) fin = decaler(fin, 1);
    // Puis le moins de jours posés pour atteindre trois jours : d'abord vers
    // la fin de la semaine (le jeudi de l'Ascension appelle le vendredi).
    let choix = { debut, fin, aPoser: 0 };
    if (ecartEnJours(debut, fin) + 1 < 3) {
      const options: { debut: string; fin: string; aPoser: number }[] = [];
      for (let k = 1; k <= JOURS_A_POSER_MAX; k += 1) {
        if (chome(decaler(fin, k + 1))) {
          let bout = decaler(fin, k + 1);
          while (chome(decaler(bout, 1))) bout = decaler(bout, 1);
          options.push({ debut, fin: bout, aPoser: k });
        }
        if (chome(decaler(debut, -k - 1))) {
          let bout = decaler(debut, -k - 1);
          while (chome(decaler(bout, -1))) bout = decaler(bout, -1);
          options.push({ debut: bout, fin, aPoser: k });
        }
      }
      const meilleure = options.find((option) => ecartEnJours(option.debut, option.fin) + 1 >= 3);
      if (!meilleure) continue;
      choix = meilleure;
    }
    // Le nom : les fériés de la période, sans les jours de pont ni les doublons d'un report.
    const dedans = [...feries.entries()]
      .filter(([jour]) => jour >= choix.debut && jour <= choix.fin)
      .flatMap(([, jours]) => jours)
      .filter((ferie) => ferie.en !== 'Day off');
    const noms = [...new Set(dedans.map((ferie) => ferie.nom.replace(/ \(jour reporté\)$/u, '')))];
    const nomsEn = [...new Set(dedans.map((ferie) => ferie.en.replace(/ \(observed\)$/u, '')))];
    ponts.push({
      nom: noms.join(' et '),
      nomEn: nomsEn.join(' and '),
      debut: choix.debut,
      fin: choix.fin,
      jours: ecartEnJours(choix.debut, choix.fin) + 1,
      aPoser: choix.aPoser,
      nature: 'pont',
    });
  }
  return ponts;
}

/** Les vacances scolaires d'une zone (ou de toutes) qui ne sont pas encore finies. */
export function vacancesAVenir(depuis: string, zone: ZoneScolaire | null, limite = 6): OccasionDePartir[] {
  return VACANCES_SCOLAIRES.filter(
    (periode) => periode.fin >= depuis && (zone === null || periode.zones.includes(zone)),
  )
    .slice(0, limite * 3)
    .map((periode) => ({
      nom:
        periode.zones.length === 3 || zone === null
          ? `${periode.nom}${periode.zones.length === 3 ? '' : ` (zone ${periode.zones.join(', ')})`}`
          : `${periode.nom} (zone ${zone})`,
      // Déjà commencées : on part d'aujourd'hui.
      debut: periode.debut < depuis ? depuis : periode.debut,
      fin: periode.fin,
      jours: ecartEnJours(periode.debut < depuis ? depuis : periode.debut, periode.fin) + 1,
      aPoser: 0,
      nature: 'vacances' as const,
      ...(periode.finProvisoire ? { finProvisoire: true } : {}),
    }))
    .slice(0, limite);
}

/**
 * Ce qu'une période recoupe : vacances scolaires et jours fériés.
 *
 * Pour dire, une fois les dates choisies : « pendant les vacances de la
 * Toussaint » — plus de monde, souvent des prix plus hauts — ou « le 1er mai
 * est férié ».
 */
export function cePendant(
  debut: string,
  fin: string,
  zone: ZoneScolaire | string | null,
  pays = 'FR',
): { vacances: PeriodeDeVacances[]; feries: JourFerie[] } {
  // En France, la zone ; ailleurs, la région. Un pays sans calendrier connu : rien.
  const vacances =
    pays === 'FR'
      ? VACANCES_SCOLAIRES.filter(
          (periode) =>
            periode.debut <= fin &&
            periode.fin >= debut &&
            (zone === null || periode.zones.includes(zone as ZoneScolaire)),
        )
      : periodesDu(pays).filter(
          (periode) => periode.debut <= fin && periode.fin >= debut && concerne(periode, zone),
        );
  const feries: JourFerie[] = [];
  for (let annee = Number(debut.slice(0, 4)); annee <= Number(fin.slice(0, 4)); annee += 1) {
    feries.push(...joursFeriesDu(pays, annee).filter((jour) => jour.date >= debut && jour.date <= fin));
  }
  return { vacances, feries };
}

/** Jusqu'à quelle date le calendrier scolaire est connu. */
export function calendrierConnuJusquau(): string {
  return VACANCES_SCOLAIRES.reduce((max, periode) => (periode.fin > max ? periode.fin : max), '');
}

// ---------------------------------------------------------------------------
// Les vacances scolaires hors de France
// ---------------------------------------------------------------------------

/** Une région scolaire d'un pays hors de France : Land, canton, communauté… */
export interface RegionScolaire {
  code: string;
  nom: string;
  en: string;
  /** Le dernier jour connu de son calendrier. */
  jusquau: string;
}

interface PaysLu {
  regions: RegionScolaire[];
  reperes: { region: number; lat: number; lng: number }[];
  periodes: PeriodeDeVacances[];
}

const PAYS_LUS = new Map<string, PaysLu>();

function lirePays(pays: string): PaysLu | null {
  const donnees = VACANCES_DU_MONDE[pays];
  if (!donnees) return null;
  let lu = PAYS_LUS.get(pays);
  if (!lu) {
    const regions = donnees.regions.map(([code, nom, en, jusquau]) => ({
      code,
      nom,
      en,
      jusquau: jusquau || donnees.jusquau,
    }));
    const reperes = donnees.reperes
      ? donnees.reperes.split(';').map((repere) => {
          const [region, lat, lng] = repere.split(',').map(Number) as [number, number, number];
          return { region, lat, lng };
        })
      : [];
    const enDate = (jour: string) => `${jour.slice(0, 4)}-${jour.slice(4, 6)}-${jour.slice(6, 8)}`;
    const periodes = donnees.periodes
      ? donnees.periodes.split(';').map((ligne): PeriodeDeVacances => {
          const [dates, nom, portee] = ligne.split(':') as [string, string, string];
          const [debut, fin] = dates.split('-') as [string, string];
          const [francais, anglais] = donnees.noms[Number(nom)] ?? ['', ''];
          return {
            nom: francais,
            en: anglais,
            zones: [],
            debut: enDate(debut),
            fin: enDate(fin),
            ...(portee === '*' ? {} : { regions: portee.split('.').map((i) => regions[Number(i)]!.code) }),
          };
        })
      : [];
    lu = { regions, reperes, periodes };
    PAYS_LUS.set(pays, lu);
  }
  return lu;
}

function periodesDu(pays: string): PeriodeDeVacances[] {
  return lirePays(pays)?.periodes ?? [];
}

/** Une période vaut pour la région choisie — ou pour toutes, sans choix. */
function concerne(periode: PeriodeDeVacances, region: string | null): boolean {
  return region === null || !periode.regions || periode.regions.includes(region);
}

/** Vrai quand Tripora connaît les vacances scolaires de ce pays. */
export function vacancesConnues(pays: string | null | undefined): boolean {
  return pays === 'FR' || (pays != null && pays in VACANCES_DU_MONDE);
}

/** Les régions scolaires d'un pays hors de France, par ordre alphabétique ; vide quand le calendrier est national. */
export function regionsScolaires(pays: string): readonly RegionScolaire[] {
  return lirePays(pays)?.regions ?? [];
}

/**
 * La région probable d'un point de départ hors de France : celle du repère le
 * plus proche (le centre d'un Land, une commune néerlandaise, une ville belge).
 *
 * Une supposition, affichée comme telle et modifiable, comme la zone française.
 * `null` quand le pays n'a pas de régions, que le point est loin de tout repère,
 * ou qu'il tombe sur un lieu qui n'en désigne aucune (Bruxelles, où les deux
 * grandes communautés ont leurs écoles).
 */
export function regionProbable(pays: string, point: GeoPoint): string | null {
  const lu = lirePays(pays);
  if (!lu || lu.regions.length === 0) return null;
  let meilleur: { region: number; km: number } | null = null;
  for (const repere of lu.reperes) {
    const km = haversineKm(point, repere);
    if (!meilleur || km < meilleur.km) meilleur = { region: repere.region, km };
  }
  if (!meilleur || meilleur.km > 300 || meilleur.region < 0) return null;
  return lu.regions[meilleur.region]?.code ?? null;
}

/** Le nom d'une région, dans la langue de l'interface. */
export function nomDeRegion(pays: string, code: string, anglais = false): string {
  const region = regionsScolaires(pays).find((candidate) => candidate.code === code);
  return region ? (anglais ? region.en : region.nom) : code;
}

/**
 * Les vacances scolaires à venir d'un pays, pour une région ou pour toutes.
 *
 * Même forme que `vacancesAVenir` (la France) : le nom porte la région quand
 * la période ne vaut pas pour tout le pays — « Vacances d’automne (Bavière) ».
 */
export function vacancesAVenirDu(
  pays: string,
  depuis: string,
  region: string | null,
  limite = 6,
): OccasionDePartir[] {
  if (pays === 'FR') return vacancesAVenir(depuis, region as ZoneScolaire | null, limite);
  const precision = (periode: PeriodeDeVacances, anglais: boolean): string => {
    if (!periode.regions) return '';
    const codes = region ? [region] : periode.regions;
    if (codes.length > 2) return anglais ? ` (${codes.length} regions)` : ` (${codes.length} régions)`;
    return ` (${codes.map((code) => nomDeRegion(pays, code, anglais)).join(', ')})`;
  };
  return periodesDu(pays)
    .filter((periode) => periode.fin >= depuis && concerne(periode, region))
    .slice(0, limite)
    .map((periode) => {
      const debut = periode.debut < depuis ? depuis : periode.debut;
      return {
        nom: `${periode.nom}${precision(periode, false)}`,
        nomEn: `${periode.en ?? periode.nom}${precision(periode, true)}`,
        debut,
        fin: periode.fin,
        jours: ecartEnJours(debut, periode.fin) + 1,
        aPoser: 0,
        nature: 'vacances' as const,
      };
    });
}

/** Le jour où les vacances des autres pays ont été relevées. */
export function vacancesDuMondeReleveesLe(): string {
  return VACANCES_RELEVEES_LE;
}

// ---------------------------------------------------------------------------
// Dates, sans fuseau : midi UTC évite tout décalage d'un jour.
// ---------------------------------------------------------------------------

function iso(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

function enDate(jour: string): Date {
  return new Date(`${jour}T12:00:00Z`);
}

export function decaler(jour: string, nombre: number): string {
  const date = enDate(jour);
  date.setUTCDate(date.getUTCDate() + nombre);
  return date.toISOString().slice(0, 10);
}

function jourDeLaSemaine(jour: string): number {
  return enDate(jour).getUTCDay();
}

function ecartEnJours(debut: string, fin: string): number {
  return Math.round((enDate(fin).getTime() - enDate(debut).getTime()) / 86_400_000);
}
