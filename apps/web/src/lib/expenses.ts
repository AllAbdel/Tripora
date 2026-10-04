import type { Expense } from '@tripora/core';
import { splitEqually } from '@tripora/core';
import { supabase } from './supabase';
import type { NomIcone } from '@tripora/core';

/**
 * Les dépenses du voyage.
 *
 * Tout est enregistré en centimes entiers, et la part de chacun est calculée
 * au moment de la saisie plutôt que recalculée à l'affichage : si quelqu'un
 * quitte le voyage plus tard, les comptes passés ne doivent pas bouger.
 *
 * Une dépense peut être payée dans n'importe quelle devise publiée par la BCE.
 * Deux montants sont alors conservés : celui qu'on a réellement payé, dans sa
 * devise, et sa conversion en euros. **Les comptes se font toujours sur
 * l'euro** — c'est `amountCents` — et le taux employé est figé dans la ligne,
 * pour qu'une dépense de la semaine dernière ne change pas de valeur parce que
 * le zloty a bougé depuis.
 */

export type ExpenseCategory =
  | 'transport' | 'accommodation' | 'food' | 'activities' | 'shopping' | 'other';

export interface ExpenseEntry extends Expense {
  label: string;
  category: ExpenseCategory;
  spentOn: string;
  /** Devise de la saisie. `amountCents`, lui, est toujours en euros. */
  currency: string;
  /** Ce qui a été payé, dans sa devise. Identique à `amountCents` en euros. */
  originalCents: number;
}

export interface NouvelleDepense {
  label: string;
  /** Montant payé, dans `currency`. */
  originalCents: number;
  /** Le même montant en euros : c'est lui qui entre dans les comptes. */
  amountCents: number;
  currency: string;
  /** Combien d'euros vaut une unité de `currency`, figé au jour de la saisie. */
  fxRate: number;
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

export const CATEGORIES: { value: ExpenseCategory; label: string; icone: NomIcone }[] = [
  { value: 'food', label: 'Nourriture', icone: 'gastronomie' },
  { value: 'transport', label: 'Transport', icone: 'transport' },
  { value: 'accommodation', label: 'Hébergement', icone: 'hebergement' },
  { value: 'activities', label: 'Activités', icone: 'billet' },
  { value: 'shopping', label: 'Shopping', icone: 'shopping' },
  { value: 'other', label: 'Divers', icone: 'divers' },
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
      currency: depense.currency,
      originalCents: depense.originalCents,
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
        .select(
          'id, paid_by, amount_cents, amount_home_cents, currency, category, label, spent_on, expense_shares(user_id, share_cents)',
        )
        .eq('trip_id', tripId)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id as string,
        paidBy: row.paid_by as string,
        // Les comptes se font en euros ; le montant d'origine ne sert qu'à
        // l'affichage, pour qu'on reconnaisse la somme qu'on a payée.
        amountCents: row.amount_home_cents as number,
        originalCents: row.amount_cents as number,
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
          amount_cents: depense.originalCents,
          currency: depense.currency,
          fx_rate: depense.fxRate,
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
