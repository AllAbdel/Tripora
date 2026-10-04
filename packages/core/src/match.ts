import {
  AXIS_ICON,
  AXIS_LABELS_FR,
  PREFERENCE_AXES,
  groupWeights,
  type PreferenceAxis,
} from './preferences.js';
import type { NomIcone } from './icons.js';
import type { Destination, MemberPreference } from './types.js';

/**
 * À quel point une destination répond aux envies qu'on a saisies.
 *
 * Le score global d'une proposition mélange six facteurs — prix, envies,
 * météo, trajet, activités, équité — et n'en donne qu'une note. C'est utile
 * pour classer, insuffisant pour décider : quelqu'un qui a coché « nature :
 * essentiel » veut savoir si cette ville-là a de la nature, pas si elle fait
 * 82 sur 100 toutes causes confondues.
 *
 * Ce module rouvre donc la boîte, envie par envie. Il ne calcule rien de
 * nouveau : il expose ce que le catalogue dit déjà de la destination, en face
 * de ce que le groupe a demandé.
 */

/** Ce que vaut une destination sur une envie précise du groupe. */
export interface CorrespondanceAxe {
  axis: PreferenceAxis;
  /** « Nature et paysages ». */
  label: string;
  icon: NomIcone;
  /** Ce que le groupe a demandé, de 0 à 1. */
  envie: number;
  /** Ce que la destination offre, de 0 à 1. */
  offre: number;
  /**
   * Part de l'envie réellement couverte, de 0 à 100.
   *
   * Rapportée à ce qui a été demandé, et non dans l'absolu : une ville qui
   * offre « 6/10 de fête » comble quelqu'un qui en voulait un peu, et déçoit
   * quelqu'un pour qui c'était essentiel. La même donnée, deux lectures, et
   * c'est la seconde qui intéresse le voyageur.
   */
  couverture: number;
  verdict: 'comble' | 'correct' | 'faible';
  /** Phrase prête à afficher, construite par le code. */
  phrase: string;
}

/** Un axe que le groupe a explicitement refusé, et que la ville sert quand même. */
export interface RejetAxe {
  axis: PreferenceAxis;
  label: string;
  icon: NomIcone;
  offre: number;
  phrase: string;
}

export interface Correspondance {
  /** Les envies exprimées, de la plus forte à la plus faible. */
  axes: CorrespondanceAxe[];
  /** Ce qu'on voulait éviter et qu'on trouvera quand même. */
  rejets: RejetAxe[];
  /** Moyenne des couvertures, pondérée par l'envie. 0 à 100. */
  couvertureGlobale: number;
  /** Une phrase de tête, à afficher au-dessus du détail. */
  resume: string;
}

/** En dessous, l'envie est trop faible pour qu'on prétende en parler. */
const ENVIE_MINIMALE = 0.15;
/** Une envie couverte à ce point est comblée ; en dessous du second, elle ne l'est pas. */
const SEUIL_COMBLE = 85;
const SEUIL_CORRECT = 60;
/** Un axe rejeté n'est signalé que s'il est vraiment présent sur place. */
const REJET_VISIBLE = 0.6;

const arrondi = (valeur: number): number => Math.round(valeur * 10);

function niveauDEnvie(envie: number): string {
  if (envie >= 0.85) return 'essentiel pour vous';
  if (envie >= 0.55) return 'vous en vouliez beaucoup';
  return 'vous en vouliez un peu';
}

function phrasePour(label: string, envie: number, offre: number, verdict: string): string {
  const note = `${arrondi(offre)}/10`;
  const demande = niveauDEnvie(envie);
  if (verdict === 'comble') return `${label} : ${demande}, et la ville est à ${note}.`;
  if (verdict === 'correct') return `${label} : ${demande}, la ville est à ${note}.`;
  return `${label} : ${demande}, mais la ville n'est qu'à ${note}.`;
}

/**
 * Le détail de la correspondance, envie par envie.
 *
 * `members` porte les préférences de chacun ; on en prend la moyenne, comme
 * partout où l'on ordonne plutôt qu'on ne décide. Un groupe qui n'a rien
 * renseigné rend une correspondance vide, et l'écran ne montre rien — mieux
 * que d'inventer des envies pour avoir quelque chose à afficher.
 */
export function correspondanceAuxEnvies(
  destination: Destination,
  members: readonly MemberPreference[],
): Correspondance {
  const envies = groupWeights(members);

  const axes: CorrespondanceAxe[] = PREFERENCE_AXES.filter(
    (axis) => (envies[axis] ?? 0) >= ENVIE_MINIMALE,
  )
    .map((axis) => {
      const envie = envies[axis] ?? 0;
      const offre = destination.tags[axis];
      const couverture = Math.min(100, Math.round((offre / envie) * 100));
      const verdict =
        couverture >= SEUIL_COMBLE ? 'comble' : couverture >= SEUIL_CORRECT ? 'correct' : 'faible';
      return {
        axis,
        label: AXIS_LABELS_FR[axis],
        icon: AXIS_ICON[axis],
        envie,
        offre,
        couverture,
        verdict,
        phrase: phrasePour(AXIS_LABELS_FR[axis], envie, offre, verdict),
      } satisfies CorrespondanceAxe;
    })
    .sort((a, b) => b.envie - a.envie || a.label.localeCompare(b.label, 'fr'));

  const refuses = new Set(members.flatMap((membre) => membre.avoid ?? []));
  const rejets: RejetAxe[] = [...refuses]
    .filter((axis): axis is PreferenceAxis =>
      PREFERENCE_AXES.includes(axis as PreferenceAxis) &&
      destination.tags[axis as PreferenceAxis] >= REJET_VISIBLE,
    )
    .map((axis) => ({
      axis,
      label: AXIS_LABELS_FR[axis],
      icon: AXIS_ICON[axis],
      offre: destination.tags[axis],
      phrase: `${AXIS_LABELS_FR[axis]} : vous vouliez l'éviter, la ville est à ${arrondi(
        destination.tags[axis],
      )}/10.`,
    }))
    .sort((a, b) => b.offre - a.offre);

  const poids = axes.reduce((somme, axe) => somme + axe.envie, 0);
  const couvertureGlobale =
    poids === 0
      ? 0
      : Math.round(axes.reduce((somme, axe) => somme + axe.couverture * axe.envie, 0) / poids);

  return { axes, rejets, couvertureGlobale, resume: resumer(axes, couvertureGlobale) };
}

function resumer(axes: readonly CorrespondanceAxe[], globale: number): string {
  if (axes.length === 0) return 'Aucune envie renseignée : rien à comparer.';
  const manques = axes.filter((axe) => axe.verdict === 'faible');
  if (manques.length === 0) return `Répond à toutes vos envies (${globale} %).`;
  const noms = manques.map((axe) => axe.label.toLowerCase());
  const liste =
    noms.length === 1
      ? noms[0]
      : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
  return `Répond à ${globale} % de vos envies. Ce qui manque : ${liste}.`;
}
