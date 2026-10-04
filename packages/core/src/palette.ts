/**
 * Une palette complète à partir d'une seule couleur.
 *
 * Laisser quelqu'un choisir « sa » couleur est facile ; faire en sorte que
 * l'application reste lisible ensuite l'est beaucoup moins. Un bouton violet
 * vif et un bouton jaune vif n'ont pas besoin du même texte par-dessus, et une
 * teinte pastel étalée telle quelle sur dix nuances donne dix gris.
 *
 * D'où le passage par **OKLab**, un espace où la clarté correspond à ce que
 * l'œil perçoit : deux couleurs de même clarté OKLab paraissent vraiment aussi
 * claires l'une que l'autre, ce qui n'est pas vrai en HSL — un jaune et un bleu
 * « à 50 % de luminosité » y sont perceptivement à des lieues l'un de l'autre.
 *
 * La méthode : on garde la **courbe** de clarté et de saturation de la palette
 * d'origine (celle tirée de l'icône), et on n'emprunte à la couleur choisie que
 * sa teinte et son intensité. Le résultat garde donc le contraste et le rythme
 * de la charte, quelle que soit la couleur demandée — y compris un blanc cassé
 * ou un noir, où la palette devient une échelle de gris cohérente.
 *
 * Tout est calculé en TypeScript pur plutôt que laissé à `oklch()` en CSS :
 * on a besoin des valeurs, pas seulement de leur rendu, pour choisir la couleur
 * du texte posé dessus.
 */

export const NUANCES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type Nuance = (typeof NUANCES)[number];

/**
 * La courbe de la palette d'origine, mesurée sur le bleu de l'icône.
 *
 * - `t` : où se place la nuance entre le presque-blanc et la couleur
 *   principale, pour celles qui sont plus claires qu'elle.
 * - `f` : de quelle fraction de la couleur principale elle s'assombrit, pour
 *   celles qui sont plus sombres.
 * - `c` : sa part de l'intensité maximale.
 *
 * Deux échelles plutôt qu'une liste de clartés absolues, parce que la clarté de
 * la nuance 500 n'est pas fixe : elle est calculée pour chaque teinte (voir
 * `clarteLisible`). Toute la palette se replace ensuite autour d'elle.
 */
const COURBE: Readonly<Record<Nuance, { t?: number; f?: number; c: number }>> = {
  50: { t: 0.042, c: 0.087 },
  100: { t: 0.143, c: 0.181 },
  200: { t: 0.337, c: 0.362 },
  300: { t: 0.559, c: 0.589 },
  400: { t: 0.854, c: 0.869 },
  500: { t: 1, c: 1 },
  600: { f: 0.849, c: 0.924 },
  700: { f: 0.71, c: 0.769 },
  800: { f: 0.577, c: 0.613 },
  900: { f: 0.468, c: 0.487 },
};

/** La clarté du presque-blanc dont part la palette. */
const PLUS_CLAIR = 0.98;

/** Au-delà, une teinte devient fluorescente sur un écran et fatigue à la lecture. */
const CHROMA_MAX = 0.21;

/** Seuil AA du texte courant. Le texte d'un bouton n'est pas du « grand texte ». */
const CONTRASTE_AA = 4.5;

export interface Oklch {
  /** Clarté perçue, de 0 (noir) à 1 (blanc). */
  l: number;
  /** Intensité de la couleur. 0 = gris. */
  c: number;
  /** Teinte en degrés. Sans objet quand `c` vaut 0. */
  h: number;
}

// --------------------------------------------------------------- conversions

function versLineaire(canal: number): number {
  return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
}

function versSrgb(canal: number): number {
  return canal <= 0.0031308 ? canal * 12.92 : 1.055 * canal ** (1 / 2.4) - 0.055;
}

/** Analyse `#rgb`, `#rrggbb`. Renvoie `null` sur toute autre écriture. */
export function lireHex(valeur: string): { r: number; g: number; b: number } | null {
  const brut = valeur.trim().replace(/^#/u, '');
  const complet =
    brut.length === 3
      ? brut
          .split('')
          .map((caractere) => caractere + caractere)
          .join('')
      : brut;
  if (!/^[0-9a-f]{6}$/iu.test(complet)) return null;
  return {
    r: parseInt(complet.slice(0, 2), 16) / 255,
    g: parseInt(complet.slice(2, 4), 16) / 255,
    b: parseInt(complet.slice(4, 6), 16) / 255,
  };
}

function versHex(r: number, g: number, b: number): string {
  const octet = (canal: number) =>
    Math.round(Math.min(1, Math.max(0, canal)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${octet(r)}${octet(g)}${octet(b)}`;
}

export function hexVersOklch(hex: string): Oklch | null {
  const rgb = lireHex(hex);
  if (!rgb) return null;

  const r = versLineaire(rgb.r);
  const g = versLineaire(rgb.g);
  const b = versLineaire(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const clarte = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.hypot(a, bb);
  const teinte = chroma < 1e-6 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: clarte, c: chroma, h: teinte };
}

export function oklchVersHex({ l, c, h }: Oklch): string {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return versHex(
    versSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    versSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    versSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  );
}

// ------------------------------------------------------------------- palette

export type Palette = Record<Nuance, string>;

/**
 * La clarté la plus haute à laquelle une teinte peut être posée en gardant du
 * texte blanc lisible par-dessus.
 *
 * C'est le pivot de toute la palette, et il n'est pas le même selon la teinte :
 * un jaune atteint le seuil bien plus bas qu'un bleu. Le calculer plutôt que de
 * le fixer évite d'avoir à choisir entre une couleur fidèle et un bouton
 * lisible — on prend la plus claire des deux qui reste lisible.
 *
 * Recherche par dichotomie : la fonction de contraste n'est pas inversible
 * analytiquement, et quarante bissections coûtent quelques microsecondes.
 */
function clarteLisible(h: number, c: number): number {
  let bas = 0.2;
  let haut = 0.85;
  for (let pas = 0; pas < 40; pas += 1) {
    const milieu = (bas + haut) / 2;
    if (contraste(oklchVersHex({ l: milieu, c, h }), '#ffffff') >= CONTRASTE_AA) bas = milieu;
    else haut = milieu;
  }
  return bas;
}

/**
 * Les dix nuances dérivées d'une couleur.
 *
 * Renvoie `null` si la couleur est illisible : à l'appelant de garder celle
 * d'avant plutôt que d'afficher une palette de secours que personne n'a
 * demandée.
 */
export function paletteDepuis(couleur: string): Palette | null {
  const base = hexVersOklch(couleur);
  if (!base) return null;

  // On plafonne l'intensité sans l'inventer : une couleur terne reste terne,
  // une couleur fluorescente est ramenée à ce qu'un écran rend proprement.
  const chroma = Math.min(base.c, CHROMA_MAX);

  // Le pivot : la nuance 500, aussi claire que possible sans rendre illisible
  // le texte des boutons qu'elle porte.
  const pivot = clarteLisible(base.h, chroma);

  const palette = {} as Palette;
  for (const nuance of NUANCES) {
    const point = COURBE[nuance];
    const l =
      point.t === undefined
        ? pivot * (point.f ?? 1)
        : PLUS_CLAIR - (PLUS_CLAIR - pivot) * point.t;
    palette[nuance] = oklchVersHex({ l, c: chroma * point.c, h: base.h });
  }
  return palette;
}

/**
 * Luminance relative au sens WCAG, pour choisir un texte lisible.
 * Ce n'est pas la clarté OKLab : la norme de contraste a sa propre formule, et
 * c'est elle qui fait foi pour l'accessibilité.
 */
export function luminance(hex: string): number {
  const rgb = lireHex(hex);
  if (!rgb) return 0;
  return (
    0.2126 * versLineaire(rgb.r) + 0.7152 * versLineaire(rgb.g) + 0.0722 * versLineaire(rgb.b)
  );
}

/** Rapport de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (clair + 0.05) / (sombre + 0.05);
}

/**
 * Le noir ou le blanc, selon lequel se lit le mieux sur ce fond.
 *
 * Le blanc est préféré dès qu'il passe le seuil AA, même si le noir contraste
 * davantage : c'est la convention d'un bouton plein, et la palette est
 * précisément construite pour que ce cas soit toujours le bon. La branche noire
 * reste utile pour une couleur reçue d'ailleurs — un fond clair quelconque.
 */
export function texteSur(fond: string): '#ffffff' | '#0b1220' {
  if (contraste(fond, '#ffffff') >= CONTRASTE_AA) return '#ffffff';
  return contraste(fond, '#ffffff') >= contraste(fond, '#0b1220') ? '#ffffff' : '#0b1220';
}

/**
 * Quelques couleurs proposées d'avance.
 *
 * Un sélecteur libre seul décourage : la plupart des gens veulent choisir vite,
 * pas régler une teinte. Les noms sont ceux d'un voyage, pas d'un nuancier.
 */
export const ACCENTS_PROPOSES: readonly { nom: string; couleur: string }[] = [
  { nom: 'Grand large', couleur: '#0a84ff' },
  { nom: 'Lagon', couleur: '#1c8c9b' },
  { nom: 'Forêt', couleur: '#2f8f4e' },
  { nom: 'Safran', couleur: '#e08a1e' },
  { nom: 'Coucher de soleil', couleur: '#e2564a' },
  { nom: 'Bougainvillier', couleur: '#c2418f' },
  { nom: 'Nuit', couleur: '#6257d6' },
  { nom: 'Ardoise', couleur: '#5a6b86' },
];
