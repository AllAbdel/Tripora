/**
 * Rembourser en un geste : les moyens de paiement de chacun.
 *
 * « Qui doit quoi » disait à Léa qu'elle devait 42,50 € à Tom, puis la
 * laissait demander son IBAN dans la messagerie. On range ici comment chacun
 * veut être payé, et on construit le lien qui ouvre le virement.
 */

export interface MoyensDePaiement {
  /** L'identifiant PayPal.me, sans l'adresse : « tomdupont ». */
  paypal?: string | null;
  /** L'identifiant Revolut, sans « @ » : « tom.d ». */
  revolut?: string | null;
  /** Le nom du lien Wise « wise.com/pay/me/… ». */
  wise?: string | null;
  /** Sans espaces, en majuscules. */
  iban?: string | null;
  titulaire?: string | null;
}

/**
 * L'identifiant qu'on a collé, quelle que soit sa forme : l'adresse entière,
 * avec ou sans « https:// », avec ou sans « @ ».
 */
function dernierSegment(texte: string, domaine: RegExp): string {
  const propre = texte.trim().replace(/^@/u, '');
  const trouve = domaine.exec(propre);
  const segment = trouve ? trouve[1]! : propre;
  return segment.replace(/[/?#].*$/u, '');
}

export function normaliserPaypal(texte: string): string {
  return dernierSegment(texte, /(?:https?:\/\/)?(?:www\.)?paypal\.me\/([^/?#]+)/iu);
}

export function normaliserRevolut(texte: string): string {
  return dernierSegment(texte, /(?:https?:\/\/)?(?:www\.)?revolut\.me\/([^/?#]+)/iu);
}

export function normaliserWise(texte: string): string {
  return dernierSegment(texte, /(?:https?:\/\/)?(?:www\.)?wise\.com\/pay\/me\/([^/?#]+)/iu);
}

export function normaliserIban(texte: string): string {
  return texte.replace(/[\s-]/gu, '').toUpperCase();
}

/**
 * La clé de contrôle d'un IBAN (ISO 13616, modulo 97).
 *
 * Une faute de frappe dans un IBAN envoie l'argent nulle part — ou, pire,
 * chez quelqu'un d'autre. La clé attrape presque toutes les fautes d'un
 * caractère et toutes les inversions de deux chiffres voisins.
 */
export function ibanValide(texte: string): boolean {
  const iban = normaliserIban(texte);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/u.test(iban)) return false;
  const reordonne = iban.slice(4) + iban.slice(0, 4);
  let reste = 0;
  for (const caractere of reordonne) {
    const valeur = /\d/u.test(caractere) ? caractere : String(caractere.charCodeAt(0) - 55);
    for (const chiffre of valeur) reste = (reste * 10 + Number(chiffre)) % 97;
  }
  return reste === 1;
}

/** « FR76 3000 6000 0112 3456 7890 189 » : par groupes de quatre, comme sur un RIB. */
export function ibanLisible(iban: string): string {
  return normaliserIban(iban).replace(/(.{4})(?=.)/gu, '$1 ');
}

const IDENTIFIANTS = {
  paypal: /^[A-Za-z0-9]{1,20}$/u,
  revolut: /^[A-Za-z0-9._-]{3,32}$/u,
  wise: /^[A-Za-z0-9._-]{2,40}$/u,
} as const;

/** Ce qui ne va pas dans ce qu'on s'apprête à enregistrer, ou `null`. */
export function problemeDesMoyens(moyens: MoyensDePaiement): string | null {
  if (moyens.paypal && !IDENTIFIANTS.paypal.test(moyens.paypal)) return 'Cet identifiant PayPal.me ne semble pas valable.';
  if (moyens.revolut && !IDENTIFIANTS.revolut.test(moyens.revolut)) return 'Cet identifiant Revolut ne semble pas valable.';
  if (moyens.wise && !IDENTIFIANTS.wise.test(moyens.wise)) return 'Ce lien Wise ne semble pas valable.';
  if (moyens.iban && !ibanValide(moyens.iban)) return 'Cet IBAN ne passe pas le contrôle : une faute de frappe ?';
  if (moyens.iban && !moyens.titulaire?.trim()) return 'Indiquez le titulaire du compte : la banque le demande pour un virement.';
  return null;
}

export interface LienDePaiement {
  id: 'paypal' | 'revolut' | 'wise';
  libelle: string;
  url: string;
  /** Le montant est-il déjà rempli à l'ouverture ? */
  montantInclus: boolean;
}

/**
 * Les liens qui ouvrent le paiement, montant compris quand le service le
 * permet. PayPal.me accepte le montant et la devise dans l'adresse ; Revolut
 * et Wise ouvrent la page de la personne, on y tape le montant.
 */
export function liensDePaiement(moyens: MoyensDePaiement, montantCents: number, devise = 'EUR'): LienDePaiement[] {
  const liens: LienDePaiement[] = [];
  const montant = (Math.max(0, montantCents) / 100).toFixed(2);
  if (moyens.paypal && IDENTIFIANTS.paypal.test(moyens.paypal)) {
    liens.push({
      id: 'paypal',
      libelle: 'PayPal',
      url: `https://paypal.me/${moyens.paypal}/${montant}${devise}`,
      montantInclus: true,
    });
  }
  if (moyens.revolut && IDENTIFIANTS.revolut.test(moyens.revolut)) {
    liens.push({ id: 'revolut', libelle: 'Revolut', url: `https://revolut.me/${moyens.revolut}`, montantInclus: false });
  }
  if (moyens.wise && IDENTIFIANTS.wise.test(moyens.wise)) {
    liens.push({ id: 'wise', libelle: 'Wise', url: `https://wise.com/pay/me/${moyens.wise}`, montantInclus: false });
  }
  return liens;
}

export function aDesMoyens(moyens: MoyensDePaiement | null | undefined): boolean {
  return Boolean(moyens && (moyens.paypal || moyens.revolut || moyens.wise || moyens.iban));
}
