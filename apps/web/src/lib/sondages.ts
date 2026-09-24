import { queryOptions } from '@tanstack/react-query';
import {
  libelleDeLOption,
  type GenreDeSondage,
  type NouvelleOption,
  type OptionDeSondage,
  type Sondage,
} from '@tripora/core';
import { supabase } from './supabase';

/**
 * Les sondages du groupe.
 *
 * Trois tables — `sondages`, `sondage_options`, `sondage_votes` — que tout le
 * groupe lit ; les règles (un vote par personne à choix unique, rien dans un
 * sondage clos, rien au nom d'un autre) sont en base et testées dans
 * `supabase/tests/sondages_test.sql`. Sans serveur, ils vivent dans ce
 * navigateur, avec « moi » pour seul votant.
 */

export interface NouveauSondage {
  question: string;
  genre: GenreDeSondage;
  choixMultiple: boolean;
  options: NouvelleOption[];
}

export interface SondagesApi {
  lister(tripId: string): Promise<Sondage[]>;
  creer(tripId: string, sondage: NouveauSondage): Promise<string>;
  proposer(sondageId: string, option: NouvelleOption): Promise<void>;
  retirerOption(optionId: string): Promise<void>;
  voter(optionId: string): Promise<void>;
  retirerVote(optionId: string): Promise<void>;
  clore(sondageId: string, clos: boolean): Promise<void>;
  supprimer(sondageId: string): Promise<void>;
  ecouter(tripId: string, surChangement: () => void): () => void;
}

const GENRES: readonly GenreDeSondage[] = ['texte', 'dates', 'liens'];

interface LigneOption {
  id: string;
  libelle: string;
  lien: string | null;
  du: string | null;
  au: string | null;
  position: number;
  ajoutee_par: string | null;
}

interface LigneSondage {
  id: string;
  trip_id: string;
  question: string;
  genre: string;
  choix_multiple: boolean;
  clos: boolean;
  cree_par: string | null;
  cree_le: string;
  sondage_options: LigneOption[] | null;
  sondage_votes: { option_id: string; user_id: string }[] | null;
}

export function depuisLaBase(ligne: LigneSondage): Sondage {
  return {
    id: ligne.id,
    tripId: ligne.trip_id,
    question: ligne.question,
    genre: (GENRES as readonly string[]).includes(ligne.genre) ? (ligne.genre as GenreDeSondage) : 'texte',
    choixMultiple: ligne.choix_multiple,
    clos: ligne.clos,
    creePar: ligne.cree_par,
    creeLe: ligne.cree_le,
    options: (ligne.sondage_options ?? []).map(
      (option): OptionDeSondage => ({
        id: option.id,
        libelle: option.libelle,
        lien: option.lien,
        du: option.du,
        au: option.au,
        position: option.position,
        ajouteePar: option.ajoutee_par,
      }),
    ),
    votes: (ligne.sondage_votes ?? []).map((vote) => ({ optionId: vote.option_id, userId: vote.user_id })),
  };
}

/** Ce qu'on envoie d'une option : le libellé déduit s'il manque, rien de vide. */
export function optionVersLaBase(option: NouvelleOption, position: number) {
  const vide = (valeur: string | null | undefined) => (valeur && valeur.trim() !== '' ? valeur.trim() : null);
  const du = vide(option.du);
  return {
    libelle: libelleDeLOption(option),
    lien: vide(option.lien),
    du,
    // Un seul jour : le même en début et en fin.
    au: du ? (vide(option.au) ?? du) : null,
    position,
  };
}

/** Les options qu'on a vraiment remplies, dans l'ordre. */
function remplies(options: readonly NouvelleOption[]): NouvelleOption[] {
  return options.filter((option) => libelleDeLOption(option) !== '');
}

/* ---------------------------------------------------------- Mode serveur -- */

export function getSondages(): SondagesApi {
  const client = supabase;
  if (!client) return sondagesLocaux;

  return {
    async lister(tripId) {
      const { data, error } = await client
        .from('sondages')
        .select('*, sondage_options(*), sondage_votes(option_id, user_id)')
        .eq('trip_id', tripId)
        .order('cree_le', { ascending: false });
      if (error) throw error;
      return (data as LigneSondage[]).map(depuisLaBase);
    },

    async creer(tripId, sondage) {
      const { data, error } = await client
        .from('sondages')
        .insert({
          trip_id: tripId,
          question: sondage.question.trim(),
          genre: sondage.genre,
          choix_multiple: sondage.choixMultiple,
        })
        .select('id')
        .single();
      if (error) throw error;
      const id = (data as { id: string }).id;
      const { error: erreurOptions } = await client
        .from('sondage_options')
        .insert(remplies(sondage.options).map((option, index) => ({ ...optionVersLaBase(option, index), sondage_id: id })));
      if (erreurOptions) {
        // Un sondage sans options n'a rien à faire là : on le retire.
        await client.from('sondages').delete().eq('id', id);
        throw erreurOptions;
      }
      return id;
    },

    async proposer(sondageId, option) {
      const { count } = await client
        .from('sondage_options')
        .select('id', { count: 'exact', head: true })
        .eq('sondage_id', sondageId);
      const { error } = await client
        .from('sondage_options')
        .insert({ ...optionVersLaBase(option, count ?? 99), sondage_id: sondageId });
      if (error) throw error;
    },

    async retirerOption(optionId) {
      const { error } = await client.from('sondage_options').delete().eq('id', optionId);
      if (error) throw error;
    },

    async voter(optionId) {
      // À choix unique, la base retire elle-même l'ancien vote.
      const { error } = await client.from('sondage_votes').insert({ option_id: optionId });
      if (error && error.code !== '23505') throw error;
    },

    async retirerVote(optionId) {
      const { data } = await client.auth.getSession();
      const moi = data.session?.user.id;
      if (!moi) return;
      const { error } = await client.from('sondage_votes').delete().eq('option_id', optionId).eq('user_id', moi);
      if (error) throw error;
    },

    async clore(sondageId, clos) {
      const { error } = await client.from('sondages').update({ clos }).eq('id', sondageId);
      if (error) throw error;
    },

    async supprimer(sondageId) {
      const { error } = await client.from('sondages').delete().eq('id', sondageId);
      if (error) throw error;
    },

    ecouter(tripId, surChangement) {
      const filtre = `trip_id=eq.${tripId}`;
      const canal = client
        .channel(`sondages:${tripId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sondages', filter: filtre }, surChangement)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sondage_options', filter: filtre }, surChangement)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sondage_votes', filter: filtre }, surChangement)
        .subscribe();
      return () => {
        void client.removeChannel(canal);
      };
    },
  };
}

export const cleSondages = (tripId: string | undefined) => ['sondages', tripId] as const;

/** La même requête pour l'écran des sondages et la case de l'aperçu. */
export function requeteDesSondages(tripId: string | undefined) {
  return queryOptions({
    queryKey: cleSondages(tripId),
    queryFn: () => getSondages().lister(tripId!),
    enabled: Boolean(tripId),
  });
}

/* ------------------------------------------------------------ Mode local -- */

const CLE_LOCALE = 'tripora.local-sondages';
/** L'identité du mode local, la même que partout ailleurs sans serveur. */
const MOI = 'moi';

function lireLocal(): Sondage[] {
  try {
    const brut = localStorage.getItem(CLE_LOCALE);
    return brut ? (JSON.parse(brut) as Sondage[]) : [];
  } catch {
    return [];
  }
}

function ecrireLocal(sondages: Sondage[]): void {
  try {
    localStorage.setItem(CLE_LOCALE, JSON.stringify(sondages));
  } catch {
    // Stockage plein ou refusé : le sondage ne survivra pas au rechargement.
  }
}

function modifier(sondageId: string, changement: (sondage: Sondage) => Sondage): void {
  ecrireLocal(lireLocal().map((sondage) => (sondage.id === sondageId ? changement(sondage) : sondage)));
}

function sondageDeLOption(optionId: string): Sondage | undefined {
  return lireLocal().find((sondage) => sondage.options.some((option) => option.id === optionId));
}

const sondagesLocaux: SondagesApi = {
  async lister(tripId) {
    return lireLocal()
      .filter((sondage) => sondage.tripId === tripId)
      .sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  },
  async creer(tripId, nouveau) {
    const id = crypto.randomUUID();
    const sondage: Sondage = {
      id,
      tripId,
      question: nouveau.question.trim(),
      genre: nouveau.genre,
      choixMultiple: nouveau.choixMultiple,
      clos: false,
      creePar: MOI,
      creeLe: new Date().toISOString(),
      options: remplies(nouveau.options).map((option, index) => ({
        id: crypto.randomUUID(),
        ...optionVersLaBase(option, index),
        ajouteePar: MOI,
      })),
      votes: [],
    };
    ecrireLocal([...lireLocal(), sondage]);
    return id;
  },
  async proposer(sondageId, option) {
    modifier(sondageId, (sondage) => ({
      ...sondage,
      options: [
        ...sondage.options,
        { id: crypto.randomUUID(), ...optionVersLaBase(option, sondage.options.length), ajouteePar: MOI },
      ],
    }));
  },
  async retirerOption(optionId) {
    const sondage = sondageDeLOption(optionId);
    if (!sondage) return;
    modifier(sondage.id, (s) => ({
      ...s,
      options: s.options.filter((option) => option.id !== optionId),
      votes: s.votes.filter((vote) => vote.optionId !== optionId),
    }));
  },
  async voter(optionId) {
    const sondage = sondageDeLOption(optionId);
    if (!sondage || sondage.clos) return;
    modifier(sondage.id, (s) => ({
      ...s,
      votes: [
        ...s.votes.filter((vote) => vote.userId !== MOI || (s.choixMultiple && vote.optionId !== optionId)),
        { optionId, userId: MOI },
      ],
    }));
  },
  async retirerVote(optionId) {
    const sondage = sondageDeLOption(optionId);
    if (!sondage || sondage.clos) return;
    modifier(sondage.id, (s) => ({
      ...s,
      votes: s.votes.filter((vote) => !(vote.optionId === optionId && vote.userId === MOI)),
    }));
  },
  async clore(sondageId, clos) {
    modifier(sondageId, (sondage) => ({ ...sondage, clos }));
  },
  async supprimer(sondageId) {
    ecrireLocal(lireLocal().filter((sondage) => sondage.id !== sondageId));
  },
  ecouter() {
    return () => {};
  },
};
