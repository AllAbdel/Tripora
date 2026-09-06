import type { Expense } from '@tripora/core';
import { splitEqually } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Les dépenses du voyage.
 *
 * Tout est enregistré en centimes entiers, et la part de chacun est calculée
 * au moment de la saisie plutôt que recalculée à l'affichage : si quelqu'un
 * quitte le voyage plus tard, les comptes passés ne doivent pas bouger.
 */

export type ExpenseCategory =
  | 'transport' | 'accommodation' | 'food' | 'activities' | 'shopping' | 'other';

export interface ExpenseEntry extends Expense {
  label: string;
  category: ExpenseCategory;
  spentOn: string;
  currency: string;
}

export interface NouvelleDepense {
  label: string;
  amountCents: number;
  paidBy: string;
  category: ExpenseCategory;
  spentOn: string;
  sharedWith: string[];
}

export interface ExpensesApi {
  readonly kind: 'supabase' | 'local';
  list(tripId: string): Promise<ExpenseEntry[]>;
  add(tripId: string, depense: NouvelleDepense): Promise<void>;
  remove(expenseId: string): Promise<void>;
}

export const CATEGORIES: { value: ExpenseCategory; label: string; emoji: string }[] = [
  { value: 'food', label: 'Nourriture', emoji: '🍽️' },
  { value: 'transport', label: 'Transport', emoji: '🚆' },
  { value: 'accommodation', label: 'Hébergement', emoji: '🛏️' },
  { value: 'activities', label: 'Activités', emoji: '🎟️' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'other', label: 'Divers', emoji: '💫' },
];

const CLE_LOCALE = 'tripora.local-expenses';

function lireLocal(): Record<string, ExpenseEntry[]> {
  try {
    const brut = localStorage.getItem(CLE_LOCALE);
    return brut ? (JSON.parse(brut) as Record<string, ExpenseEntry[]>) : {};
  } catch {
    return {};
  }
}

const depensesLocales: ExpensesApi = {
  kind: 'local',

  async list(tripId) {
    return (lireLocal()[tripId] ?? []).sort((a, b) => b.spentOn.localeCompare(a.spentOn));
  },

  async add(tripId, depense) {
    const stock = lireLocal();
    const entree: ExpenseEntry = {
      id: crypto.randomUUID(),
      paidBy: depense.paidBy,
      amountCents: depense.amountCents,
      shares: splitEqually(depense.amountCents, depense.sharedWith),
      label: depense.label,
      category: depense.category,
      spentOn: depense.spentOn,
      currency: 'EUR',
    };
    localStorage.setItem(
      CLE_LOCALE,
      JSON.stringify({ ...stock, [tripId]: [entree, ...(stock[tripId] ?? [])] }),
    );
  },

  async remove(expenseId) {
    const stock = lireLocal();
    for (const [tripId, liste] of Object.entries(stock)) {
      stock[tripId] = liste.filter((entree) => entree.id !== expenseId);
    }
    localStorage.setItem(CLE_LOCALE, JSON.stringify(stock));
  },
};

function depensesSupabase(client: NonNullable<typeof supabase>): ExpensesApi {
  return {
    kind: 'supabase',

    async list(tripId) {
      const { data, error } = await client
        .from('expenses')
        .select('id, paid_by, amount_cents, currency, category, label, spent_on, expense_shares(user_id, share_cents)')
        .eq('trip_id', tripId)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id as string,
        paidBy: row.paid_by as string,
        amountCents: row.amount_cents as number,
        currency: (row.currency as string) ?? 'EUR',
        label: row.label as string,
        category: row.category as ExpenseCategory,
        spentOn: row.spent_on as string,
        shares: ((row.expense_shares ?? []) as { user_id: string; share_cents: number }[]).map(
          (share) => ({ userId: share.user_id, shareCents: share.share_cents }),
        ),
      }));
    },

    async add(tripId, depense) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error('Connexion requise');

      const { data, error } = await client
        .from('expenses')
        .insert({
          trip_id: tripId,
          paid_by: depense.paidBy,
          amount_cents: depense.amountCents,
          currency: 'EUR',
          // Une seule devise pour l'instant : le taux est donc neutre, mais la
          // colonne existe pour figer le change le jour où on l'ajoutera.
          fx_rate: 1,
          amount_home_cents: depense.amountCents,
          category: depense.category,
          label: depense.label,
          spent_on: depense.spentOn,
          created_by: userId,
        })
        .select('id')
        .single();
      if (error) throw error;

      const parts = splitEqually(depense.amountCents, depense.sharedWith);
      const { error: erreurParts } = await client.from('expense_shares').insert(
        parts.map((part) => ({
          expense_id: data.id,
          user_id: part.userId,
          share_cents: part.shareCents,
        })),
      );
      if (erreurParts) throw erreurParts;
    },

    async remove(expenseId) {
      // La suppression en cascade emporte les parts.
      const { error } = await client.from('expenses').delete().eq('id', expenseId);
      if (error) throw error;
    },
  };
}

export function getExpenses(): ExpensesApi {
  return supabase ? depensesSupabase(supabase) : depensesLocales;
}
