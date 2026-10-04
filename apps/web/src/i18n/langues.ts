/**
 * Les langues de Tripora.
 *
 * Une application de voyage qui ne parle qu'une langue est une contradiction :
 * le premier trip ouvert entre inconnus mettra dans le même groupe quelqu'un
 * de Paris, quelqu'un de Casablanca et quelqu'un de Berlin.
 *
 * Trois règles tenues partout :
 *
 *  - **le nom d'une langue s'écrit dans cette langue.** « Deutsch », pas
 *    « Allemand ». Quelqu'un qui cherche sa langue dans une liste qu'il ne
 *    sait pas lire cherche la forme qu'il connaît ;
 *  - **la langue du système d'abord.** On ne demande rien au démarrage : le
 *    navigateur dit déjà ce qu'il faut savoir, et le réglage est là pour ceux
 *    dont il se trompe ;
 *  - **le repli est le français**, langue de référence du projet. Une clé
 *    absente d'une traduction affiche le français plutôt qu'un identifiant —
 *    c'est moins beau qu'une traduction complète, c'est infiniment mieux
 *    qu'un écran couvert de `trip.publish.title`.
 */

export type Langue =
  | 'fr' | 'en' | 'es' | 'it' | 'de' | 'pt' | 'nl'
  | 'pl' | 'tr' | 'ru' | 'ar' | 'zh' | 'ja' | 'ko';

export interface FicheDeLangue {
  code: Langue;
  /** Le nom de la langue, écrit dans cette langue. */
  nom: string;
  /** Sens de lecture. L'arabe s'écrit de droite à gauche. */
  sens: 'ltr' | 'rtl';
  /** L'étiquette BCP 47 pour `Intl`, quand elle diffère du code. */
  intl?: string;
}

export const LANGUES: readonly FicheDeLangue[] = [
  { code: 'fr', nom: 'Français', sens: 'ltr' },
  { code: 'en', nom: 'English', sens: 'ltr' },
  { code: 'es', nom: 'Español', sens: 'ltr' },
  { code: 'it', nom: 'Italiano', sens: 'ltr' },
  { code: 'de', nom: 'Deutsch', sens: 'ltr' },
  { code: 'pt', nom: 'Português', sens: 'ltr', intl: 'pt-PT' },
  { code: 'nl', nom: 'Nederlands', sens: 'ltr' },
  { code: 'pl', nom: 'Polski', sens: 'ltr' },
  { code: 'tr', nom: 'Türkçe', sens: 'ltr' },
  { code: 'ru', nom: 'Русский', sens: 'ltr' },
  { code: 'ar', nom: 'العربية', sens: 'rtl' },
  { code: 'zh', nom: '中文', sens: 'ltr', intl: 'zh-CN' },
  { code: 'ja', nom: '日本語', sens: 'ltr' },
  { code: 'ko', nom: '한국어', sens: 'ltr' },
];

export const LANGUE_PAR_DEFAUT: Langue = 'fr';

const CODES = new Set<string>(LANGUES.map((langue) => langue.code));

/**
 * La langue à retenir, d'après ce que le navigateur annonce.
 *
 * `navigator.languages` est une liste ordonnée : « fr-CA », « fr », « en ».
 * On prend la première dont la partie principale est connue. Le code régional
 * est ignoré — on ne distingue pas le portugais du Brésil de celui du
 * Portugal, et prétendre le contraire demanderait deux traductions.
 */
export function langueDuSysteme(annoncees: readonly string[] = []): Langue {
  for (const annoncee of annoncees) {
    const principale = annoncee.toLowerCase().split('-')[0];
    if (principale && CODES.has(principale)) return principale as Langue;
  }
  return LANGUE_PAR_DEFAUT;
}

export function estUneLangue(valeur: unknown): valeur is Langue {
  return typeof valeur === 'string' && CODES.has(valeur);
}

export function ficheDe(langue: Langue): FicheDeLangue {
  return LANGUES.find((fiche) => fiche.code === langue) ?? LANGUES[0]!;
}

/** L'étiquette à donner à `Intl` pour formater une date ou un nombre. */
export function etiquetteIntl(langue: Langue): string {
  const fiche = ficheDe(langue);
  return fiche.intl ?? fiche.code;
}
