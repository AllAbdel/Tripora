/**
 * Lire un ticket de caisse : du texte reconnu à une dépense préremplie.
 *
 * Le texte vient de la reconnaissance de caractères faite sur le téléphone
 * (l'image ne quitte jamais l'appareil). Il est bruité : lettres prises pour
 * des chiffres, lignes coupées, montants de TVA et de rendu monnaie mêlés au
 * total. On n'en tire que ce qu'on peut défendre — le total, la date, le nom
 * du commerce, la devise, une catégorie probable — et chaque champ reste
 * `null` quand le ticket ne permet pas de trancher. La personne vérifie
 * toujours avant d'enregistrer : l'écran le lui demande.
 */

export type CategorieDuTicket = 'food' | 'transport' | 'accommodation' | 'activities' | 'shopping' | 'other';

export interface LectureDuTicket {
  /** Le total payé, en centimes de la devise du ticket. */
  montantCents: number | null;
  /** Code ISO 4217, seulement quand un symbole ou un code le dit clairement. */
  devise: string | null;
  /** AAAA-MM-JJ. */
  date: string | null;
  commerce: string | null;
  categorie: CategorieDuTicket | null;
}

/**
 * Des mots entiers, dans n'importe quel alphabet : `\b` ne connaît que
 * l'ASCII, et laisserait passer « итого » comme ne jamais le trouver.
 */
function mots(...alternatives: string[]): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'u');
}

/** Sans accents, en minuscules : « À PAYER » et « a payer » se valent. */
function plier(texte: string): string {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/* ------------------------------------------------------------- Montants -- */

/**
 * Un montant avec ses centimes : « 23,40 », « 1 234.50 », « 12€50 ».
 *
 * Les centimes sont exigés : un nombre sans décimales, sur un ticket, est
 * presque toujours une quantité, un numéro de caisse ou un téléphone.
 */
const MONTANT =
  /(?<![\d,.])(\d{1,3}(?:[ \u00a0\u202f.]\d{3})+|\d{1,6})\s?(?:[,.]|€)\s?(\d{2})(?![\d%]|[.,/-]\d)/gu;

/** Les confusions classiques de la lecture : O pour 0, l ou I pour 1. */
function redresserLesChiffres(ligne: string): string {
  return ligne
    .replace(/(?<=\d[,.]?)[Oo]|[Oo](?=\d*[,.]\d)/gu, '0')
    .replace(/(?<=\d)[lI|](?=\d)/gu, '1');
}

export function montantsDeLaLigne(ligne: string): number[] {
  const montants: number[] = [];
  for (const trouve of redresserLesChiffres(ligne).matchAll(MONTANT)) {
    const entiers = Number(trouve[1]!.replace(/[ \u00a0\u202f.]/gu, ''));
    const cents = entiers * 100 + Number(trouve[2]);
    if (cents > 0 && cents < 10_000_000) montants.push(cents);
  }
  return montants;
}

/**
 * Ce qui désigne le total, dans les langues des tickets qu'on rencontre en
 * voyage, avec un poids : « net à payer » l'emporte sur « total », qui
 * l'emporte sur la ligne du paiement par carte.
 */
const MOTS_DU_TOTAL: readonly [RegExp, number][] = [
  [
    mots('net a payer', 'a payer', 'reste a payer', 'total a payer', 'amount due', 'balance due', 'grand total',
      'zu zahlen', 'total a pagar', 'totale da pagare', 'te betalen', 'do zaplaty', 'к оплате', 'итого'),
    5,
  ],
  [mots('total ttc', 't[o0]tale?', 'importe', 'summe', 'gesamt', 'gesamtbetrag', 'suma', 'totaal', 'razem', 'toplam', 'montant'), 4],
  [mots('cb', 'carte bancaire', 'carte', 'visa', 'mastercard', 'card', 'paiement', 'pago', 'tarjeta', 'bezahlt', 'contactless', 'sans contact'), 2],
];

/** Ce qui n'est pas le total même s'il en a l'air. */
const MOTS_A_ECARTER = mots(
  'tva', 'vat', 'iva', 'mwst', 'ust', 'ht', 'hors taxes?', 'sous[- ]?total', 'subtotal', 'rendu', 'monnaie', 'change',
  'cambio', 'remise', 'reduction', 'economie', 'avantage', 'points', 'fidelite', 'cagnotte', 'base',
);

function poidsDuTotal(lignePliee: string): number {
  for (const [motif, poids] of MOTS_DU_TOTAL) if (motif.test(lignePliee)) return poids;
  return 0;
}

function totalDuTicket(lignes: readonly string[]): number | null {
  let meilleur: { poids: number; cents: number } | null = null;
  const garder = (poids: number, cents: number) => {
    if (!meilleur || poids > meilleur.poids || (poids === meilleur.poids && cents > meilleur.cents)) {
      meilleur = { poids, cents };
    }
  };

  lignes.forEach((ligne, index) => {
    const pliee = plier(ligne);
    if (MOTS_A_ECARTER.test(pliee)) return;
    const poids = poidsDuTotal(pliee);
    let montants = montantsDeLaLigne(ligne);
    // « TOTAL » seul sur sa ligne, le montant juste en dessous.
    if (montants.length === 0 && poids > 0 && lignes[index + 1] !== undefined) {
      montants = montantsDeLaLigne(lignes[index + 1]!);
    }
    const dernier = montants.at(-1);
    if (dernier !== undefined) garder(poids, dernier);
  });

  return meilleur === null ? null : (meilleur as { cents: number }).cents;
}

/* --------------------------------------------------------------- Devise -- */

const DEVISES: readonly [RegExp, string][] = [
  [/€|(?<!\p{L})euros?(?!\p{L})|(?<!\p{L})eur(?!\p{L})/u, 'EUR'],
  [/£|(?<!\p{L})gbp(?!\p{L})/u, 'GBP'],
  [mots('chf'), 'CHF'],
  [/us\$|(?<!\p{L})usd(?!\p{L})/u, 'USD'],
  [/ca\$|(?<!\p{L})cad(?!\p{L})/u, 'CAD'],
  [/¥|円|(?<!\p{L})jpy(?!\p{L})/u, 'JPY'],
  [/zł|(?<!\p{L})(?:pln|zl)(?!\p{L})/u, 'PLN'],
  [/kč|(?<!\p{L})czk(?!\p{L})/u, 'CZK'],
  [mots('huf', 'ft'), 'HUF'],
  [/₺|(?<!\p{L})(?:try|tl)(?!\p{L})/u, 'TRY'],
  [mots('mad', 'dhs?'), 'MAD'],
  [mots('ron', 'lei'), 'RON'],
  [/฿|(?<!\p{L})thb(?!\p{L})/u, 'THB'],
  [mots('sek'), 'SEK'],
  [mots('dkk'), 'DKK'],
  [mots('nok'), 'NOK'],
];

function deviseDuTicket(textePlie: string): string | null {
  const trouvees = new Set<string>();
  for (const [motif, code] of DEVISES) if (motif.test(textePlie)) trouvees.add(code);
  // Le dollar seul peut être américain, canadien, australien… on ne tranche
  // que s'il est le seul indice.
  if (trouvees.size === 0 && /\$/u.test(textePlie)) return 'USD';
  // Deux devises sur un même ticket (un prix converti, un taux affiché) :
  // on laisse la personne choisir plutôt que de parier.
  return trouvees.size === 1 ? [...trouvees][0]! : null;
}

/* ----------------------------------------------------------------- Date -- */

function dateValide(annee: number, mois: number, jour: number): string | null {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || annee < 2000 || annee > 2100) return null;
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (date.getUTCMonth() !== mois - 1) return null;
  return date.toISOString().slice(0, 10);
}

function dateDuTicket(texte: string): string | null {
  const iso = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/u.exec(texte);
  if (iso) {
    const date = dateValide(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) return date;
  }
  // Jour, mois, année : l'ordre de presque tous les tickets hors États-Unis.
  for (const trouve of texte.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/gu)) {
    const annee = trouve[3]!.length === 2 ? 2000 + Number(trouve[3]) : Number(trouve[3]);
    const date = dateValide(annee, Number(trouve[2]), Number(trouve[1]));
    if (date) return date;
  }
  return null;
}

/* ------------------------------------------------------------- Commerce -- */

const PAS_UN_NOM = mots(
  'ticket', 'recu', 'facture', 'invoice', 'receipt', 'bienvenue', 'welcome', 'merci', 'thank', 'siret', 'siren', 'tva',
  'vat', 'tel', 'phone', 'www', 'http', 'caisse', 'client', 'n°\\s*\\d*', 'no', 'rue', 'avenue', 'boulevard', 'bd',
  'street', 'road', 'calle', 'via', 'strasse',
);

/** « CARREFOUR CITY » devient « Carrefour City » ; un nom déjà en casse mixte reste tel quel. */
function casseDuNom(nom: string): string {
  if (nom !== nom.toUpperCase()) return nom;
  return nom.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, avant: string, lettre: string) => avant + lettre.toUpperCase());
}

function commerceDuTicket(lignes: readonly string[]): string | null {
  for (const ligne of lignes.slice(0, 6)) {
    const propre = ligne.replace(/[^\p{L}\p{N}&'’. -]/gu, ' ').replace(/\s+/gu, ' ').trim();
    const lettres = propre.match(/\p{L}/gu)?.length ?? 0;
    if (lettres < 3 || lettres < propre.length / 2) continue;
    if (PAS_UN_NOM.test(plier(propre)) || montantsDeLaLigne(propre).length > 0) continue;
    return casseDuNom(propre).slice(0, 60);
  }
  return null;
}

/* ------------------------------------------------------------ Catégorie -- */

const CATEGORIES: readonly [RegExp, CategorieDuTicket][] = [
  [mots('hotel', 'hostel', 'auberge', 'nuitees?', 'taxe de sejour', 'city tax', 'airbnb', 'chambre', 'room'), 'accommodation'],
  [
    mots('taxi', 'uber', 'bolt', 'sncf', 'ratp', 'renfe', 'trenitalia', 'metro', 'bus', 'tram', 'train', 'navigo',
      'essence', 'carburant', 'gazole', 'diesel', 'sp ?9[58]', 'peage', 'parking', 'station[- ]service', 'shell', 'esso'),
    'transport',
  ],
  [
    mots('restaurant', 'brasserie', 'bistrot?', 'cafe', 'bar', 'pizzeria', 'trattoria', 'boulangerie', 'patisserie',
      'menu', 'boissons?', 'couverts?', 'dessert', 'carrefour', 'monoprix', 'franprix', 'lidl', 'aldi', 'auchan',
      'leclerc', 'intermarche', 'super u', 'spar', 'casino', 'mercadona', 'tesco', 'sainsbury', 'coop', 'rewe', 'edeka',
      'supermarche', 'epicerie', 'alimentation'),
    'food',
  ],
  [
    mots('musee', 'museum', 'museo', "droit d'entree", "ticket d'entree", 'entrada', 'eintritt', 'visite guidee',
      'excursion', 'concert', 'spectacle', 'zoo', 'aquarium'),
    'activities',
  ],
  [mots('zara', 'h&m', 'primark', 'fnac', 'decathlon', 'souvenirs?', 'boutique', 'vetements?', 'chaussures?'), 'shopping'],
];

function categorieDuTicket(textePlie: string): CategorieDuTicket | null {
  for (const [motif, categorie] of CATEGORIES) if (motif.test(textePlie)) return categorie;
  return null;
}

/* ---------------------------------------------------------------- Lecture -- */

export function lireLeTicket(texte: string): LectureDuTicket {
  const lignes = texte
    .split(/\r?\n/u)
    .map((ligne) => ligne.replace(/\s+/gu, ' ').trim())
    .filter((ligne) => ligne.length > 0);
  const plie = plier(lignes.join('\n'));
  return {
    montantCents: totalDuTicket(lignes),
    devise: deviseDuTicket(plie),
    date: dateDuTicket(lignes.join('\n')),
    commerce: commerceDuTicket(lignes),
    categorie: categorieDuTicket(plie),
  };
}
