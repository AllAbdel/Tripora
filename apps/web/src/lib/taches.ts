import { queryOptions } from '@tanstack/react-query';
import type { Tache } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Qui fait quoi : les tâches du groupe.
 *
 * Dans la table `taches`, que tout le groupe lit et coche ; qui a coché et
 * quand est posé par la base, et un responsable est forcément du voyage
 * (testé dans `supabase/tests/taches_test.sql`). Sans serveur, la liste vit
 * dans ce navigateur.
 */

export interface NouvelleTache {
  titre: string;
  responsable?: string | null;
  echeance?: string | null;
}

export interface ModificationDeTache {
  titre?: string;
  responsable?: string | null;
  echeance?: string | null;
  faite?: boolean;
}

export interface TachesApi {
  lister(tripId: string): Promise<Tache[]>;
  ajouter(tripId: string, tache: NouvelleTache): Promise<void>;
  modifier(id: string, modification: ModificationDeTache): Promise<void>;
  supprimer(id: string): Promise<void>;
  ecouter(tripId: string, surChangement: () => void): () => void;
}

interface Ligne {
  id: string;
  trip_id: string;
  titre: string;
  responsable: string | null;
  echeance: string | null;
  faite: boolean;
  faite_par: string | null;
  faite_le: string | null;
  cree_par: string | null;
  cree_le: string;
}

export function depuisLaBase(ligne: Ligne): Tache {
  return {
    id: ligne.id,
    tripId: ligne.trip_id,
    titre: ligne.titre,
    responsable: ligne.responsable,
    echeance: ligne.echeance,
    faite: ligne.faite,
    faitePar: ligne.faite_par,
    faiteLe: ligne.faite_le,
    creePar: ligne.cree_par,
    creeLe: ligne.cree_le,
  };
}

function versLaBase(modification: ModificationDeTache) {
  return {
    ...(modification.titre !== undefined ? { titre: modification.titre.trim() } : {}),
    ...(modification.responsable !== undefined ? { responsable: modification.responsable || null } : {}),
    ...(modification.echeance !== undefined ? { echeance: modification.echeance || null } : {}),
    ...(modification.faite !== undefined ? { faite: modification.faite } : {}),
  };
}

/* ---------------------------------------------------------- Mode serveur -- */

export function getTaches(): TachesApi {
  const client = supabase;
  if (!client) return tachesLocales;

  return {
    async lister(tripId) {
      const { data, error } = await client
        .from('taches')
        .select('*')
        .eq('trip_id', tripId)
        .order('cree_le', { ascending: true });
      if (error) throw error;
      return (data as Ligne[]).map(depuisLaBase);
    },
    async ajouter(tripId, tache) {
      const { error } = await client.from('taches').insert({
        trip_id: tripId,
        titre: tache.titre.trim(),
        responsable: tache.responsable || null,
        echeance: tache.echeance || null,
      });
      if (error) throw error;
    },
    async modifier(id, modification) {
      const { error } = await client.from('taches').update(versLaBase(modification)).eq('id', id);
      if (error) throw error;
    },
    async supprimer(id) {
      const { error } = await client.from('taches').delete().eq('id', id);
      if (error) throw error;
    },
    ecouter(tripId, surChangement) {
      const canal = client
        .channel(`taches:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'taches', filter: `trip_id=eq.${tripId}` },
          surChangement,
        )
        .subscribe();
      return () => {
        void client.removeChannel(canal);
      };
    },
  };
}

export const cleTaches = (tripId: string | undefined) => ['taches', tripId] as const;

export function requeteDesTaches(tripId: string | undefined) {
  return queryOptions({
    queryKey: cleTaches(tripId),
    queryFn: () => getTaches().lister(tripId!),
    enabled: Boolean(tripId),
  });
}

/* ------------------------------------------------------------ Mode local -- */

const CLE_LOCALE = 'tripora.local-taches';
const MOI = 'moi';

function lireLocal(): Tache[] {
  try {
    const brut = localStorage.getItem(CLE_LOCALE);
    return brut ? (JSON.parse(brut) as Tache[]) : [];
  } catch {
    return [];
  }
}

function ecrireLocal(taches: Tache[]): void {
  try {
    localStorage.setItem(CLE_LOCALE, JSON.stringify(taches));
  } catch {
    // Stockage plein ou refusé : la tâche ne survivra pas au rechargement.
  }
}

const tachesLocales: TachesApi = {
  async lister(tripId) {
    return lireLocal().filter((tache) => tache.tripId === tripId);
  },
  async ajouter(tripId, nouvelle) {
    ecrireLocal([
      ...lireLocal(),
      {
        id: crypto.randomUUID(),
        tripId,
        titre: nouvelle.titre.trim(),
        responsable: nouvelle.responsable || null,
        echeance: nouvelle.echeance || null,
        faite: false,
        creePar: MOI,
        creeLe: new Date().toISOString(),
      },
    ]);
  },
  async modifier(id, modification) {
    ecrireLocal(
      lireLocal().map((tache) => {
        if (tache.id !== id) return tache;
        const suivante: Tache = {
          ...tache,
          ...(modification.titre !== undefined ? { titre: modification.titre.trim() } : {}),
          ...(modification.responsable !== undefined ? { responsable: modification.responsable || null } : {}),
          ...(modification.echeance !== undefined ? { echeance: modification.echeance || null } : {}),
        };
        if (modification.faite !== undefined && modification.faite !== tache.faite) {
          suivante.faite = modification.faite;
          suivante.faitePar = modification.faite ? MOI : null;
          suivante.faiteLe = modification.faite ? new Date().toISOString() : null;
        }
        return suivante;
      }),
    );
  },
  async supprimer(id) {
    ecrireLocal(lireLocal().filter((tache) => tache.id !== id));
  },
  ecouter() {
    return () => {};
  },
};
