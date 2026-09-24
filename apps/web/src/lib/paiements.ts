import { aDesMoyens, normaliserIban, type MoyensDePaiement } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Comment chacun veut être remboursé.
 *
 * Dans la table `moyens_de_paiement`, lisible par soi et par les gens avec qui
 * l'on voyage, jamais au-delà (testé dans `supabase/tests/paiement_test.sql`).
 * Sans serveur, seuls les siens existent, dans ce navigateur.
 */
export interface PaiementsApi {
  lesMiens(): Promise<MoyensDePaiement | null>;
  enregistrer(moyens: MoyensDePaiement): Promise<void>;
  deCesPersonnes(ids: readonly string[]): Promise<Map<string, MoyensDePaiement>>;
}

interface Ligne {
  user_id: string;
  paypal: string | null;
  revolut: string | null;
  wise: string | null;
  iban: string | null;
  titulaire: string | null;
}

function depuisLaBase(ligne: Ligne): MoyensDePaiement {
  return {
    paypal: ligne.paypal,
    revolut: ligne.revolut,
    wise: ligne.wise,
    iban: ligne.iban,
    titulaire: ligne.titulaire,
  };
}

/** Rien de vide en base : un champ effacé devient `null`. */
export function versLaBase(moyens: MoyensDePaiement) {
  const vide = (valeur: string | null | undefined) => (valeur && valeur.trim() !== '' ? valeur.trim() : null);
  const iban = vide(moyens.iban);
  return {
    paypal: vide(moyens.paypal),
    revolut: vide(moyens.revolut),
    wise: vide(moyens.wise),
    iban: iban ? normaliserIban(iban) : null,
    titulaire: iban ? vide(moyens.titulaire) : null,
  };
}

export function getPaiements(): PaiementsApi {
  const client = supabase;
  if (!client) return paiementsLocaux;

  const moi = async () => (await client.auth.getSession()).data.session?.user.id ?? null;

  return {
    async lesMiens() {
      const id = await moi();
      if (!id) return null;
      const { data, error } = await client.from('moyens_de_paiement').select('*').eq('user_id', id).maybeSingle();
      if (error) throw error;
      return data ? depuisLaBase(data as Ligne) : null;
    },
    async enregistrer(moyens) {
      const id = await moi();
      if (!id) return;
      const ligne = versLaBase(moyens);
      if (!aDesMoyens(ligne)) {
        const { error } = await client.from('moyens_de_paiement').delete().eq('user_id', id);
        if (error) throw error;
        return;
      }
      const { error } = await client
        .from('moyens_de_paiement')
        .upsert({ user_id: id, ...ligne }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    async deCesPersonnes(ids) {
      const table = new Map<string, MoyensDePaiement>();
      if (ids.length === 0) return table;
      const { data, error } = await client.from('moyens_de_paiement').select('*').in('user_id', [...ids]);
      if (error) throw error;
      for (const ligne of data as Ligne[]) table.set(ligne.user_id, depuisLaBase(ligne));
      return table;
    },
  };
}

export const CLE_MES_MOYENS = ['moyens-de-paiement', 'moi'] as const;

/* ------------------------------------------------------------ Mode local -- */

const CLE_LOCALE = 'tripora.local-paiement';

const paiementsLocaux: PaiementsApi = {
  async lesMiens() {
    try {
      const brut = localStorage.getItem(CLE_LOCALE);
      return brut ? (JSON.parse(brut) as MoyensDePaiement) : null;
    } catch {
      return null;
    }
  },
  async enregistrer(moyens) {
    try {
      localStorage.setItem(CLE_LOCALE, JSON.stringify(versLaBase(moyens)));
    } catch {
      // Stockage refusé : rien à garder.
    }
  },
  async deCesPersonnes(ids) {
    const table = new Map<string, MoyensDePaiement>();
    const miens = await paiementsLocaux.lesMiens();
    if (miens && ids.includes('moi')) table.set('moi', miens);
    return table;
  },
};
