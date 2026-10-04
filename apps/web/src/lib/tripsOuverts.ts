import { supabase } from './supabase';

/**
 * Les trips ouverts, côté application.
 *
 * Toute la règle vit dans la base : cette couche ne fait qu'appeler les
 * fonctions et traduire leurs codes de refus en phrases. Elle ne décide de
 * rien — et surtout pas de qui peut entrer. Un jour où elle se tromperait, la
 * base refuserait quand même.
 *
 * Les motifs sont traduits ici plutôt que renvoyés en français par le serveur
 * pour une raison simple : ces phrases sont de l'interface, elles changeront
 * de langue, et la base n'a pas à savoir dans quelle langue on lui parle.
 */

export type Mixite = 'femmes' | 'hommes' | 'mixte';
export type Rythme = 'tranquille' | 'equilibre' | 'intense';
export type SuiteCandidature = 'en-attente' | 'acceptee' | 'refusee' | 'retiree';
export type Genre = 'femme' | 'homme' | 'autre';

export interface TripOuvert {
  tripId: string;
  titre: string;
  couverture: string | null;
  resume: string;
  mixite: Mixite;
  rythme: Rythme;
  langues: string[];
  hebergementPartage: boolean;
  placesMax: number;
  placesFemmes: number | null;
  placesHommes: number | null;
  ageMin: number | null;
  ageMax: number | null;
  validation: 'auto' | 'organisateur';
  presentationMinimum: number;
  destinationId: string;
  origineNom: string;
  origineIata: string[];
  publieLe: string;
  dureeJours: number;
  debut: string | null;
  fin: string | null;
  moisCible: number | null;
  budgetParPersonneCents: number | null;
  devise: string;
  membres: number;
  membresFemmes: number;
  membresHommes: number;
}

export interface Candidature {
  userId: string;
  nom: string;
  avatarUrl: string | null;
  genre: Genre | null;
  age: number | null;
  presentation: string;
  suite: SuiteCandidature;
  deposeLe: string;
}

/**
 * Pourquoi je ne peux pas rejoindre ce voyage.
 *
 * C'est la moitié de ce qu'on vient chercher sur la fiche : savoir dans quoi
 * on s'embarque, et savoir tout de suite si on n'y a pas sa place. Une porte
 * fermée qui dit pourquoi vaut mieux qu'un bouton grisé.
 */
const MOTIFS: Record<string, string> = {
  ferme: 'Ce voyage n’est plus ouvert.',
  exclu: 'L’organisateur a mis fin à votre participation à ce voyage.',
  'deja-membre': 'Vous faites déjà partie de ce voyage.',
  'profil-absent': 'Votre profil est incomplet.',
  'compte-anonyme':
    'Créez un compte pour rejoindre des inconnus. Un lien d’ami suffit entre vous ; se présenter à des gens qu’on ne connaît pas demande un peu plus.',
  complet: 'Toutes les places sont prises.',
  'reserve-aux-femmes':
    'Ce voyage est réservé aux femmes. Si vous en êtes une, indiquez-le dans votre profil : sans cette information, la règle ne peut pas être appliquée.',
  'reserve-aux-hommes':
    'Ce voyage est réservé aux hommes. Si vous en êtes un, indiquez-le dans votre profil : sans cette information, la règle ne peut pas être appliquée.',
  'quota-hommes-atteint':
    'Les places ouvertes aux hommes sont prises. Celles qui restent sont réservées aux femmes.',
  'quota-femmes-atteint':
    'Les places ouvertes aux femmes sont prises. Celles qui restent sont réservées aux hommes.',
  'age-inconnu':
    'Ce voyage fixe une tranche d’âge. Renseignez votre année de naissance dans votre profil pour pouvoir postuler.',
  'trop-jeune': 'Vous êtes en dessous de l’âge demandé pour ce voyage.',
  'trop-age': 'Vous êtes au-dessus de l’âge demandé pour ce voyage.',
  'deja-candidat': 'Votre candidature est déjà déposée. L’organisateur n’a pas encore répondu.',
  'deja-refuse': 'Votre candidature a été refusée pour ce voyage.',
  // Neutre à dessein : « indisponible » couvre un blocage sans le dire. Le
  // révéler, ce serait donner à la personne bloquée une raison de chercher
  // un autre chemin.
  indisponible: 'Ce voyage n’est pas accessible.',
  suspendu:
    'Votre accès aux trips ouverts est suspendu après un signalement. Vos voyages entre amis ne sont pas concernés.',
  'trop-en-attente':
    'Vous avez déjà cinq candidatures en attente. Attendez une réponse, ou retirez-en une, avant d’en déposer une autre.',
  'trop-aujourdhui': 'Vous avez déposé beaucoup de candidatures aujourd’hui. Réessayez demain.',
  'sans-lien': 'On ne peut signaler que quelqu’un avec qui on a partagé un voyage ou une candidature.',
  'trop-de-signalements': 'Vous avez envoyé beaucoup de signalements aujourd’hui. Réessayez demain.',
  'deja-signale': 'Vous avez déjà signalé cette personne. Le signalement est en cours de lecture.',
};

export function direLeRefus(code: string | null | undefined): string | null {
  if (!code) return null;
  return MOTIFS[code] ?? 'Vous ne pouvez pas rejoindre ce voyage.';
}

/**
 * Les erreurs des fonctions arrivent sous la forme « refus:code ». On les
 * rattrape ici pour qu'un écran n'ait jamais à afficher un message Postgres.
 */
export function lireLErreur(erreur: unknown): string {
  const message = erreur instanceof Error ? erreur.message : String(erreur ?? '');
  const code = /refus:([a-z-]+)/u.exec(message)?.[1];
  if (code) return direLeRefus(code) ?? message;
  // Les `raise exception` écrits en français passent tels quels : ils sont
  // déjà rédigés pour être lus.
  return message.replace(/^.*?:\s*/u, '') || 'Cette action n’a pas abouti.';
}

interface LigneOuverte {
  trip_id: string;
  title: string;
  cover_image_url: string | null;
  resume: string;
  mixite: Mixite;
  rythme: Rythme;
  langues: string[] | null;
  hebergement_partage: boolean;
  places_max: number;
  places_femmes: number | null;
  places_hommes: number | null;
  age_min: number | null;
  age_max: number | null;
  validation: 'auto' | 'organisateur';
  presentation_minimum: number;
  destination_id: string;
  origine_nom: string;
  origine_iata: string[] | null;
  publie_le: string;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  target_month: number | null;
  budget_per_person_cents: number | null;
  currency: string;
  membres: number;
  membres_femmes: number;
  membres_hommes: number;
}

function lire(ligne: LigneOuverte): TripOuvert {
  return {
    tripId: ligne.trip_id,
    titre: ligne.title,
    couverture: ligne.cover_image_url,
    resume: ligne.resume,
    mixite: ligne.mixite,
    rythme: ligne.rythme,
    langues: ligne.langues ?? [],
    hebergementPartage: ligne.hebergement_partage,
    placesMax: ligne.places_max,
    placesFemmes: ligne.places_femmes,
    placesHommes: ligne.places_hommes,
    ageMin: ligne.age_min,
    ageMax: ligne.age_max,
    validation: ligne.validation,
    presentationMinimum: ligne.presentation_minimum,
    destinationId: ligne.destination_id,
    origineNom: ligne.origine_nom,
    origineIata: ligne.origine_iata ?? [],
    publieLe: ligne.publie_le,
    dureeJours: ligne.duration_days,
    debut: ligne.start_date,
    fin: ligne.end_date,
    moisCible: ligne.target_month,
    budgetParPersonneCents: ligne.budget_per_person_cents,
    devise: ligne.currency,
    membres: Number(ligne.membres ?? 0),
    membresFemmes: Number(ligne.membres_femmes ?? 0),
    membresHommes: Number(ligne.membres_hommes ?? 0),
  };
}

/** Les places encore libres, et pour qui elles le sont. */
export function placesRestantes(trip: TripOuvert): {
  total: number;
  pourLesFemmes: number | null;
  pourLesHommes: number | null;
} {
  const total = Math.max(0, trip.placesMax - trip.membres);
  const autres = trip.membres - trip.membresFemmes - trip.membresHommes;
  return {
    total,
    pourLesFemmes:
      trip.placesFemmes === null ? null : Math.max(0, trip.placesFemmes - trip.membresFemmes),
    pourLesHommes:
      trip.placesHommes === null
        ? null
        : Math.max(0, trip.placesHommes - trip.membresHommes - Math.max(0, autres)),
  };
}

export type MotifDeSignalement =
  | 'comportement'
  | 'harcelement'
  | 'faux-profil'
  | 'arnaque'
  | 'contenu'
  | 'autre';

export const MOTIFS_DE_SIGNALEMENT: { valeur: MotifDeSignalement; libelle: string }[] = [
  { valeur: 'comportement', libelle: 'Comportement déplacé' },
  { valeur: 'harcelement', libelle: 'Harcèlement ou insistance' },
  { valeur: 'faux-profil', libelle: 'Faux profil' },
  { valeur: 'arnaque', libelle: 'Arnaque ou demande d’argent' },
  { valeur: 'contenu', libelle: 'Contenu choquant' },
  { valeur: 'autre', libelle: 'Autre chose' },
];

export interface MaCandidature {
  tripId: string;
  titre: string;
  destinationId: string;
  origineNom: string;
  suite: SuiteCandidature;
  deposeLe: string;
}

export interface PersonneBloquee {
  userId: string;
  nom: string;
  depuis: string;
}

export interface Signalement {
  id: string;
  auteurNom: string;
  vise: string;
  viseNom: string;
  motif: MotifDeSignalement;
  detail: string | null;
  creeLe: string;
  /** Combien de personnes différentes ont déjà signalé la même personne. */
  dejaSignale: number;
}

export interface RepertoireDesTripsOuverts {
  chercher(destinationId: string, origineIata: readonly string[]): Promise<TripOuvert[]>;
  voir(tripId: string): Promise<{ trip: TripOuvert; refus: string | null; maCandidature: SuiteCandidature | null } | null>;
  postuler(tripId: string, presentation: string): Promise<'acceptee' | 'en-attente'>;
  retirer(tripId: string): Promise<void>;
  publier(tripId: string, reglages: Reglages): Promise<void>;
  refermer(tripId: string): Promise<void>;
  reglagesDe(tripId: string): Promise<Reglages | null>;
  candidatures(tripId: string): Promise<Candidature[]>;
  trancher(tripId: string, userId: string, accepter: boolean): Promise<void>;
  exclure(tripId: string, userId: string, motif?: string): Promise<void>;
  mesCandidatures(): Promise<MaCandidature[]>;
  bloquer(userId: string): Promise<void>;
  debloquer(userId: string): Promise<void>;
  mesBlocages(): Promise<PersonneBloquee[]>;
  signaler(userId: string, motif: MotifDeSignalement, detail: string, tripId?: string, bloquer?: boolean): Promise<void>;
  signalementsATraiter(): Promise<Signalement[]>;
  trancherLeSignalement(id: string, suspendre: boolean): Promise<void>;
}

export interface Reglages {
  resume: string;
  mixite: Mixite;
  placesMax: number;
  placesFemmes: number | null;
  placesHommes: number | null;
  ageMin: number | null;
  ageMax: number | null;
  validation: 'auto' | 'organisateur';
  rythme: Rythme;
  langues: string[];
  hebergementPartage: boolean;
  presentationMinimum: number;
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  resume: '',
  mixite: 'mixte',
  placesMax: 6,
  placesFemmes: null,
  placesHommes: null,
  ageMin: null,
  ageMax: null,
  // La validation manuelle par défaut : ouvrir son voyage à des inconnus ne
  // veut pas dire laisser la porte ouverte.
  validation: 'organisateur',
  rythme: 'equilibre',
  langues: ['fr'],
  hebergementPartage: false,
  presentationMinimum: 80,
};

/** Sans serveur, la fonctionnalité n'existe pas : elle est faite pour rencontrer du monde. */
const SANS_SERVEUR = new Error('Les trips ouverts demandent une connexion.');

export function getTripsOuverts(): RepertoireDesTripsOuverts {
  const client = supabase;

  return {
    async chercher(destinationId, origineIata) {
      if (!client || origineIata.length === 0) return [];
      const { data, error } = await client.rpc('chercher_trips_ouverts', {
        p_destination_id: destinationId,
        p_origine_iata: [...origineIata],
      });
      if (error) throw error;
      return ((data ?? []) as LigneOuverte[]).map(lire);
    },

    async voir(tripId) {
      if (!client) throw SANS_SERVEUR;
      const { data, error } = await client.rpc('voir_le_trip_ouvert', { p_trip_id: tripId });
      if (error) throw error;
      const ligne = (data as { fiche: LigneOuverte; refus: string | null; ma_candidature: SuiteCandidature | null }[])?.[0];
      if (!ligne?.fiche) return null;
      return {
        trip: lire(ligne.fiche),
        refus: ligne.refus,
        maCandidature: ligne.ma_candidature,
      };
    },

    async postuler(tripId, presentation) {
      if (!client) throw SANS_SERVEUR;
      const { data, error } = await client.rpc('postuler_au_trip', {
        p_trip_id: tripId,
        p_presentation: presentation,
      });
      if (error) throw error;
      return data === 'acceptee' ? 'acceptee' : 'en-attente';
    },

    async retirer(tripId) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('retirer_ma_candidature', { p_trip_id: tripId });
      if (error) throw error;
    },

    async publier(tripId, r) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('publier_le_trip', {
        p_trip_id: tripId,
        p_resume: r.resume,
        p_mixite: r.mixite,
        p_places_max: r.placesMax,
        p_places_femmes: r.placesFemmes,
        p_places_hommes: r.placesHommes,
        p_age_min: r.ageMin,
        p_age_max: r.ageMax,
        p_validation: r.validation,
        p_rythme: r.rythme,
        p_langues: r.langues,
        p_hebergement_partage: r.hebergementPartage,
        p_presentation_minimum: r.presentationMinimum,
      });
      if (error) throw error;
    },

    async refermer(tripId) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('refermer_le_trip', { p_trip_id: tripId });
      if (error) throw error;
    },

    async reglagesDe(tripId) {
      if (!client) return null;
      const { data, error } = await client
        .from('trip_publications')
        .select('*')
        .eq('trip_id', tripId)
        .is('ferme_le', null)
        .maybeSingle();
      if (error || !data) return null;
      const ligne = data as LigneOuverte;
      return {
        resume: ligne.resume,
        mixite: ligne.mixite,
        placesMax: ligne.places_max,
        placesFemmes: ligne.places_femmes,
        placesHommes: ligne.places_hommes,
        ageMin: ligne.age_min,
        ageMax: ligne.age_max,
        validation: ligne.validation,
        rythme: ligne.rythme,
        langues: ligne.langues ?? [],
        hebergementPartage: ligne.hebergement_partage,
        presentationMinimum: ligne.presentation_minimum,
      };
    },

    async candidatures(tripId) {
      if (!client) return [];
      const { data, error } = await client.rpc('candidatures_recues', { p_trip_id: tripId });
      if (error) throw error;
      return ((data ?? []) as {
        user_id: string;
        nom: string;
        avatar_url: string | null;
        genre: Genre | null;
        age: number | null;
        presentation: string;
        suite: SuiteCandidature;
        depose_le: string;
      }[]).map((ligne) => ({
        userId: ligne.user_id,
        nom: ligne.nom,
        avatarUrl: ligne.avatar_url,
        genre: ligne.genre,
        age: ligne.age,
        presentation: ligne.presentation,
        suite: ligne.suite,
        deposeLe: ligne.depose_le,
      }));
    },

    async trancher(tripId, userId, accepter) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('trancher_la_candidature', {
        p_trip_id: tripId,
        p_user_id: userId,
        p_accepter: accepter,
      });
      if (error) throw error;
    },

    async exclure(tripId, userId, motif) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('exclure_du_trip', {
        p_trip_id: tripId,
        p_user_id: userId,
        p_motif: motif ?? null,
      });
      if (error) throw error;
    },

    async mesCandidatures() {
      if (!client) return [];
      const { data, error } = await client.rpc('mes_candidatures');
      if (error) throw error;
      return ((data ?? []) as {
        trip_id: string;
        titre: string;
        destination_id: string;
        origine_nom: string;
        suite: SuiteCandidature;
        depose_le: string;
      }[]).map((ligne) => ({
        tripId: ligne.trip_id,
        titre: ligne.titre,
        destinationId: ligne.destination_id,
        origineNom: ligne.origine_nom,
        suite: ligne.suite,
        deposeLe: ligne.depose_le,
      }));
    },

    async bloquer(userId) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('bloquer', { p_user_id: userId });
      if (error) throw error;
    },

    async debloquer(userId) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('debloquer', { p_user_id: userId });
      if (error) throw error;
    },

    async mesBlocages() {
      if (!client) return [];
      const { data, error } = await client.rpc('mes_blocages');
      if (error) throw error;
      return ((data ?? []) as { user_id: string; nom: string; depuis: string }[]).map((ligne) => ({
        userId: ligne.user_id,
        nom: ligne.nom,
        depuis: ligne.depuis,
      }));
    },

    async signaler(userId, motif, detail, tripId, bloquer = true) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('signaler_quelquun', {
        p_user_id: userId,
        p_motif: motif,
        p_detail: detail.trim() || null,
        p_trip_id: tripId ?? null,
        p_bloquer: bloquer,
      });
      if (error) throw error;
    },

    async signalementsATraiter() {
      if (!client) return [];
      const { data, error } = await client.rpc('signalements_a_traiter');
      if (error) throw error;
      return ((data ?? []) as {
        id: string;
        auteur_nom: string;
        vise: string;
        vise_nom: string;
        motif: MotifDeSignalement;
        detail: string | null;
        cree_le: string;
        deja_signale: number;
      }[]).map((ligne) => ({
        id: ligne.id,
        auteurNom: ligne.auteur_nom,
        vise: ligne.vise,
        viseNom: ligne.vise_nom,
        motif: ligne.motif,
        detail: ligne.detail,
        creeLe: ligne.cree_le,
        dejaSignale: Number(ligne.deja_signale ?? 0),
      }));
    },

    async trancherLeSignalement(id, suspendre) {
      if (!client) throw SANS_SERVEUR;
      const { error } = await client.rpc('trancher_le_signalement', {
        p_id: id,
        p_suspendre: suspendre,
      });
      if (error) throw error;
    },
  };
}
