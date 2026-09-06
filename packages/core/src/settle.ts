import { splitCents } from './money.js';

/**
 * Qui doit combien à qui.
 *
 * C'est la partie du produit où une erreur se voit immédiatement, et se paie
 * en gêne entre amis. Trois règles tenues :
 *
 *  1. Tout en centimes entiers. Aucun flottant ne touche à l'argent.
 *  2. La somme des soldes vaut exactement zéro. Un centime qui disparaît est
 *     un bug, pas un arrondi acceptable.
 *  3. On minimise le nombre de virements. Personne n'a envie de faire cinq
 *     transferts quand deux suffisent.
 */

export interface ExpenseShare {
  userId: string;
  shareCents: number;
}

export interface Expense {
  id: string;
  paidBy: string;
  /** Toujours dans la devise de référence du voyage, conversion déjà faite. */
  amountCents: number;
  shares: ExpenseShare[];
}

export interface Balance {
  userId: string;
  /** Positif : on lui doit de l'argent. Négatif : il en doit. */
  cents: number;
}

export interface Settlement {
  from: string;
  to: string;
  cents: number;
}

/**
 * Partage égal d'une dépense, au centime près.
 *
 * `splitCents` garantit que la somme des parts fait exactement le montant :
 * un repas à 100 € pour 3 donne 33,34 / 33,33 / 33,33, jamais 33,33 trois fois
 * avec un centime évaporé.
 */
export function splitEqually(amountCents: number, userIds: readonly string[]): ExpenseShare[] {
  if (userIds.length === 0) return [];
  const parts = splitCents(amountCents, userIds.length);
  return userIds.map((userId, index) => ({ userId, shareCents: parts[index]! }));
}

/** Ce que chacun a avancé, moins ce qu'il devait réellement porter. */
export function computeBalances(
  expenses: readonly Expense[],
  members: readonly string[],
): Balance[] {
  const soldes = new Map<string, number>(members.map((userId) => [userId, 0]));
  const noter = (userId: string, montant: number) => {
    soldes.set(userId, (soldes.get(userId) ?? 0) + montant);
  };

  for (const expense of expenses) {
    noter(expense.paidBy, expense.amountCents);
    for (const share of expense.shares) noter(share.userId, -share.shareCents);
  }

  return [...soldes.entries()]
    .map(([userId, cents]) => ({ userId, cents }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

/**
 * Le plus petit nombre de virements qui remet tout le monde à zéro.
 *
 * On apparie à chaque tour le plus gros créancier avec le plus gros débiteur.
 * Chaque virement solde au moins l'un des deux, donc il en faut au plus n-1 :
 * là où « chacun rembourse chacun » en demanderait beaucoup plus.
 *
 * Exemple : Abdel doit 20 à Thomas, Mehdi doit 40 à Thomas et Thomas doit 15
 * à Mehdi. Au lieu de trois virements, deux suffisent — Abdel verse 20 à
 * Thomas, Mehdi lui verse 25.
 */
export function simplifyDebts(balances: readonly Balance[]): Settlement[] {
  const total = balances.reduce((somme, solde) => somme + solde.cents, 0);
  if (total !== 0) {
    throw new Error(
      `Les soldes ne s'équilibrent pas (${total} centimes d'écart) : une dépense est mal répartie`,
    );
  }

  // Copies triées : le tri rend le résultat reproductible, ce qui compte pour
  // que deux personnes voient exactement les mêmes remboursements.
  const doivent = balances
    .filter((solde) => solde.cents < 0)
    .map((solde) => ({ ...solde }))
    .sort((a, b) => a.cents - b.cents || a.userId.localeCompare(b.userId));
  const attendent = balances
    .filter((solde) => solde.cents > 0)
    .map((solde) => ({ ...solde }))
    .sort((a, b) => b.cents - a.cents || a.userId.localeCompare(b.userId));

  const virements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < doivent.length && j < attendent.length) {
    const debiteur = doivent[i]!;
    const creancier = attendent[j]!;
    const montant = Math.min(-debiteur.cents, creancier.cents);

    if (montant > 0) {
      virements.push({ from: debiteur.userId, to: creancier.userId, cents: montant });
      debiteur.cents += montant;
      creancier.cents -= montant;
    }

    if (debiteur.cents === 0) i += 1;
    if (creancier.cents === 0) j += 1;
  }

  return virements;
}

/** Total dépensé par le groupe, toutes personnes confondues. */
export function totalSpent(expenses: readonly Expense[]): number {
  return expenses.reduce((somme, expense) => somme + expense.amountCents, 0);
}

/** Ce que chacun a réellement consommé, indépendamment de qui a avancé. */
export function shareOf(expenses: readonly Expense[], userId: string): number {
  return expenses.reduce(
    (somme, expense) =>
      somme +
      expense.shares
        .filter((share) => share.userId === userId)
        .reduce((sousTotal, share) => sousTotal + share.shareCents, 0),
    0,
  );
}
