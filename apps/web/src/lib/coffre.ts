import { queryOptions } from '@tanstack/react-query';
import type { BrouillonDInfo, InfoDuVoyage } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Le coffre du voyage : codes, wifi, adresses, contacts.
 *
 * Dans la table `infos_du_voyage`, que seuls les membres lisent ; tout le
 * groupe ajoute et corrige, l'auteur et l'organisateur retirent (testé dans
 * `supabase/tests/coffre_test.sql`). Sans serveur, le coffre vit dans ce
 * navigateur.
 *
 * Le cache des requêtes est gardé sur l'appareil : un code ouvert une fois
 * reste lisible sans réseau, devant la porte.
 */

export interface CoffreApi {
  lister(tripId: string): Promise<InfoDuVoyage[]>;
  ajouter(tripId: string, info: BrouillonDInfo): Promise<void>;
  modifier(id: string, info: BrouillonDInfo): Promise<void>;
  supprimer(id: string): Promise<void>;
  ecouter(tripId: string, surChangement: () => void): () => void;
}

interface Ligne {
  id: string;
  trip_id: string;
  genre: InfoDuVoyage['genre'];
  titre: string;
  valeur: string;
  complement: string | null;
  cree_par: string | null;
  cree_le: string;
}

export function depuisLaBase(ligne: Ligne): InfoDuVoyage {
  return {
    id: ligne.id,
    tripId: ligne.trip_id,
    genre: ligne.genre,
    titre: ligne.titre,
    valeur: ligne.valeur,
    complement: ligne.complement,
    creePar: ligne.cree_par,
    creeLe: ligne.cree_le,
  };
}

function nettoyer(info: BrouillonDInfo) {
  return {
    genre: info.genre,
    titre: info.titre.trim(),
    valeur: info.valeur.trim(),
    complement: info.complement?.trim() || null,
  };
}

/* ---------------------------------------------------------- Mode serveur -- */

export function getCoffre(): CoffreApi {
  const client = supabase;
  if (!client) return coffreLocal;

  return {
    async lister(tripId) {
      const { data, error } = await client
        .from('infos_du_voyage')
        .select('id, trip_id, genre, titre, valeur, complement, cree_par, cree_le')
        .eq('trip_id', tripId)
        .order('cree_le', { ascending: true });
      if (error) throw error;
      return (data as Ligne[]).map(depuisLaBase);
    },
    async ajouter(tripId, info) {
      const { error } = await client.from('infos_du_voyage').insert({ trip_id: tripId, ...nettoyer(info) });
      if (error) throw error;
    },
    async modifier(id, info) {
      const { error } = await client.from('infos_du_voyage').update(nettoyer(info)).eq('id', id);
      if (error) throw error;
    },
    async supprimer(id) {
      const { error } = await client.from('infos_du_voyage').delete().eq('id', id);
      if (error) throw error;
    },
    ecouter(tripId, surChangement) {
      const canal = client
        .channel(`coffre:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'infos_du_voyage', filter: `trip_id=eq.${tripId}` },
          surChangement,
        )
        .subscribe();
      return () => {
        void client.removeChannel(canal);
      };
    },
  };
}

export const cleCoffre = (tripId: string | undefined) => ['coffre', tripId] as const;

export function requeteDuCoffre(tripId: string | undefined) {
  return queryOptions({
    queryKey: cleCoffre(tripId),
    queryFn: () => getCoffre().lister(tripId!),
    enabled: Boolean(tripId),
  });
}

/* ------------------------------------------------------------ Mode local -- */

const CLE_LOCALE = 'tripora.local-coffre';

function lireLocal(): InfoDuVoyage[] {
  try {
    const brut = localStorage.getItem(CLE_LOCALE);
    return brut ? (JSON.parse(brut) as InfoDuVoyage[]) : [];
  } catch {
    return [];
  }
}

function ecrireLocal(infos: InfoDuVoyage[]): void {
  try {
    localStorage.setItem(CLE_LOCALE, JSON.stringify(infos));
  } catch {
    // Stockage plein ou refusé : l'info ne survivra pas au rechargement.
  }
}

const coffreLocal: CoffreApi = {
  async lister(tripId) {
    return lireLocal().filter((info) => info.tripId === tripId);
  },
  async ajouter(tripId, info) {
    ecrireLocal([
      ...lireLocal(),
      { id: crypto.randomUUID(), tripId, ...nettoyer(info), creePar: 'moi', creeLe: new Date().toISOString() },
    ]);
  },
  async modifier(id, info) {
    ecrireLocal(lireLocal().map((existante) => (existante.id === id ? { ...existante, ...nettoyer(info) } : existante)));
  },
  async supprimer(id) {
    ecrireLocal(lireLocal().filter((info) => info.id !== id));
  },
  ecouter() {
    return () => {};
  },
};
