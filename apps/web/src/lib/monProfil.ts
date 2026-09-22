import { supabase } from './supabase';
import type { Genre } from './tripsOuverts';

/**
 * Ce que je déclare de moi.
 *
 * Deux champs seulement, et ils n'existent que pour une chose : appliquer les
 * conditions d'un trip ouvert. Un voyage réservé aux femmes ne peut l'être que
 * si quelqu'un l'a écrit quelque part ; une tranche d'âge ne se vérifie pas
 * sans année de naissance.
 *
 * Trois conséquences, tenues partout :
 *
 *  - **c'est facultatif.** Sans ces informations, Tripora fonctionne
 *    entièrement, à ceci près qu'on ne peut rejoindre qu'un trip mixte sans
 *    condition d'âge. L'écran le dit plutôt que de laisser deviner.
 *  - **ça ne sert à rien d'autre.** Ni classement, ni suggestion, ni statistique.
 *  - **ça se retire.** Repasser à « je préfère ne pas le dire » efface la
 *    valeur ; on ne garde pas une donnée dont quelqu'un ne veut plus.
 *
 * L'année plutôt que la date de naissance : elle suffit à vérifier une tranche
 * d'âge, et c'est une information de moins à conserver.
 */

export interface MonProfil {
  genre: Genre | null;
  anneeNaissance: number | null;
}

export const PROFIL_VIDE: MonProfil = { genre: null, anneeNaissance: null };

export async function lireMonProfil(userId: string): Promise<MonProfil> {
  if (!supabase) return PROFIL_VIDE;
  const { data, error } = await supabase
    .from('profiles')
    .select('genre, annee_naissance')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return PROFIL_VIDE;
  return {
    genre: (data.genre as Genre | null) ?? null,
    anneeNaissance: (data.annee_naissance as number | null) ?? null,
  };
}

export async function ecrireMonProfil(userId: string, profil: MonProfil): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('profiles')
    .update({ genre: profil.genre, annee_naissance: profil.anneeNaissance })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Les années proposées.
 *
 * Bornées à seize ans révolus : en dessous, aucun trip ouvert n'est accessible
 * de toute façon, et proposer l'année n'aurait pour effet que de collecter la
 * date de naissance d'un mineur.
 */
export function anneesProposees(maintenant = new Date()): number[] {
  const actuelle = maintenant.getFullYear();
  const annees: number[] = [];
  for (let annee = actuelle - 16; annee >= actuelle - 99; annee -= 1) annees.push(annee);
  return annees;
}
