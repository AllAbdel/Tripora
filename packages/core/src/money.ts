/**
 * Toute somme d'argent circule dans Tripora en **centimes entiers**.
 * Aucune opération financière ne doit passer par un nombre à virgule :
 * 0.1 + 0.2 !== 0.3 en flottant, et une erreur d'un centime sur un partage
 * de dépenses se voit immédiatement entre amis.
 */

export type Cents = number;

export interface Money {
  readonly cents: Cents;
  readonly currency: string;
}

export function money(cents: Cents, currency = 'EUR'): Money {
  if (!Number.isInteger(cents)) {
    throw new TypeError(`Un montant doit être un nombre entier de centimes, reçu : ${cents}`);
  }
  return { cents, currency };
}

/** Convertit une saisie utilisateur (« 12,50 » ou 12.5) en centimes. */
export function parseAmountToCents(input: string | number): Cents {
  const raw = typeof input === 'number' ? String(input) : input.trim().replace(',', '.');
  if (raw === '') return 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new TypeError(`Montant illisible : « ${input} »`);
  }
  return Math.round(value * 100);
}

const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

/**
 * Affichage localisé, arrondi à l'unité pour les gros montants estimés.
 *
 * Le nombre de décimales suit la devise plutôt qu'une constante : le yen, le
 * won et la couronne islandaise n'ont pas de subdivision, et « 1 234,00 ISK »
 * a l'air d'une erreur de saisie. `Intl` connaît déjà la règle de chaque
 * devise ; on la lui demande au lieu de tenir une table de plus.
 */
export function formatCents(
  cents: Cents,
  currency = 'EUR',
  options: { locale?: string; hideCentimes?: boolean } = {},
): string {
  const locale = options.locale ?? 'fr-FR';
  const key = `${locale}|${currency}|${options.hideCentimes ? 0 : 'devise'}`;
  let formatter = FORMATTER_CACHE.get(key);
  if (!formatter) {
    const base: Intl.NumberFormatOptions = { style: 'currency', currency };
    formatter = new Intl.NumberFormat(
      locale,
      options.hideCentimes
        ? { ...base, minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : base,
    );
    FORMATTER_CACHE.set(key, formatter);
  }
  return formatter.format(cents / 100);
}

/** Somme sûre : refuse de mélanger deux devises. */
export function sumCents(amounts: readonly Money[]): Money {
  if (amounts.length === 0) return money(0);
  const currency = amounts[0]!.currency;
  let total = 0;
  for (const amount of amounts) {
    if (amount.currency !== currency) {
      throw new Error(
        `Impossible d'additionner ${currency} et ${amount.currency} sans conversion explicite`,
      );
    }
    total += amount.cents;
  }
  return money(total, currency);
}

/**
 * Répartit un montant en `parts` parts entières dont la somme est **exactement**
 * le montant d'origine. Les centimes restants sont distribués un par un aux
 * premières parts, ce qui évite le centime fantôme dans « qui doit quoi ».
 */
export function splitCents(total: Cents, parts: number): Cents[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`Nombre de parts invalide : ${parts}`);
  }
  const sign = total < 0 ? -1 : 1;
  const absolute = Math.abs(total);
  const base = Math.floor(absolute / parts);
  const remainder = absolute - base * parts;
  return Array.from({ length: parts }, (_, index) =>
    sign * (base + (index < remainder ? 1 : 0)),
  );
}

/** Conversion de devise : le taux vient toujours d'une source datée, jamais de l'IA. */
export function convertCents(cents: Cents, rate: number): Cents {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`Taux de change invalide : ${rate}`);
  }
  return Math.round(cents * rate);
}
