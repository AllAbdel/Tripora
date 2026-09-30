import { paysDuPoint } from './catalog/origins.js';
import { haversineKm } from './geo.js';
import type { GeoPoint } from './types.js';

/**
 * Les jours où l'on peut partir : vacances scolaires, jours fériés, ponts.
 *
 * Choisir des dates, pour un groupe, c'est d'abord chercher les jours que tout
 * le monde a libres. Une famille regarde les vacances de sa zone ; des amis
 * qui travaillent guettent le jeudi de l'Ascension et le 8 mai un vendredi.
 * Tripora les connaît, et les propose.
 */

export type ZoneScolaire = 'A' | 'B' | 'C';

export interface PeriodeDeVacances {
  nom: string;
  zones: readonly ZoneScolaire[];
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
    { date: iso(annee, 1, 1), nom: 'Jour de l’an' },
    { date: decaler(paques, 1), nom: 'Lundi de Pâques' },
    { date: iso(annee, 5, 1), nom: 'Fête du Travail' },
    { date: iso(annee, 5, 8), nom: 'Victoire 1945' },
    { date: decaler(paques, 39), nom: 'Ascension' },
    { date: decaler(paques, 50), nom: 'Lundi de Pentecôte' },
    { date: iso(annee, 7, 14), nom: 'Fête nationale' },
    { date: iso(annee, 8, 15), nom: 'Assomption' },
    { date: iso(annee, 11, 1), nom: 'Toussaint' },
    { date: iso(annee, 11, 11), nom: 'Armistice' },
    { date: iso(annee, 12, 25), nom: 'Noël' },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

// ---------------------------------------------------------------------------
// Les ponts et les vacances à venir
// ---------------------------------------------------------------------------

export interface OccasionDePartir {
  /** « Ascension », « Vacances de printemps (zone C) ». */
  nom: string;
  debut: string;
  fin: string;
  /** Jours de suite, week-end compris. */
  jours: number;
  /** Jours de congé à poser pour en profiter (0 pour un lundi férié). */
  aPoser: number;
  nature: 'pont' | 'vacances';
  finProvisoire?: boolean;
}

/**
 * Les week-ends prolongés par un jour férié, entre deux dates.
 *
 * Un férié un lundi ou un vendredi donne trois jours sans rien poser ; un
 * mardi ou un jeudi en donne quatre pour un jour posé ; un mercredi, cinq pour
 * deux. Un férié le week-end ne donne rien : on ne le propose pas.
 */
export function pontsEntre(depuis: string, jusqua: string): OccasionDePartir[] {
  const premiere = Number(depuis.slice(0, 4));
  const derniere = Number(jusqua.slice(0, 4));
  const ponts: OccasionDePartir[] = [];
  for (let annee = premiere; annee <= derniere; annee += 1) {
    for (const ferie of joursFeries(annee)) {
      if (ferie.date < depuis || ferie.date > jusqua) continue;
      const jour = jourDeLaSemaine(ferie.date); // 0 = dimanche
      let debut: string;
      let fin: string;
      let aPoser: number;
      switch (jour) {
        case 1: // lundi : samedi → lundi
          [debut, fin, aPoser] = [decaler(ferie.date, -2), ferie.date, 0];
          break;
        case 2: // mardi : samedi → mardi, lundi posé
          [debut, fin, aPoser] = [decaler(ferie.date, -3), ferie.date, 1];
          break;
        case 3: // mercredi : mercredi → dimanche, jeudi et vendredi posés
          [debut, fin, aPoser] = [ferie.date, decaler(ferie.date, 4), 2];
          break;
        case 4: // jeudi : jeudi → dimanche, vendredi posé
          [debut, fin, aPoser] = [ferie.date, decaler(ferie.date, 3), 1];
          break;
        case 5: // vendredi : vendredi → dimanche
          [debut, fin, aPoser] = [ferie.date, decaler(ferie.date, 2), 0];
          break;
        default:
          continue;
      }
      ponts.push({ nom: ferie.nom, debut, fin, jours: ecartEnJours(debut, fin) + 1, aPoser, nature: 'pont' });
    }
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
  zone: ZoneScolaire | null,
): { vacances: PeriodeDeVacances[]; feries: JourFerie[] } {
  const vacances = VACANCES_SCOLAIRES.filter(
    (periode) =>
      periode.debut <= fin && periode.fin >= debut && (zone === null || periode.zones.includes(zone)),
  );
  const feries: JourFerie[] = [];
  for (let annee = Number(debut.slice(0, 4)); annee <= Number(fin.slice(0, 4)); annee += 1) {
    feries.push(...joursFeries(annee).filter((jour) => jour.date >= debut && jour.date <= fin));
  }
  return { vacances, feries };
}

/** Jusqu'à quelle date le calendrier scolaire est connu. */
export function calendrierConnuJusquau(): string {
  return VACANCES_SCOLAIRES.reduce((max, periode) => (periode.fin > max ? periode.fin : max), '');
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
