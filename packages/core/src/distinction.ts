import { formatCents } from './money.js';
import type { DestinationScore, ScoreFactor } from './types.js';

/**
 * Ce qui distingue une destination des autres du classement.
 *
 * Le résumé d'une destination, pris isolément, décrit des faits vrais mais
 * souvent partagés : six villes méditerranéennes tiennent toutes dans le
 * budget et sont toutes fortes en gastronomie. Six cartes qui disent la même
 * chose ne donnent rien à décider — et un classement 92 / 91 / 91 / 91 / 90
 * ressemble alors à du bruit.
 *
 * Ce module regarde le lot entier et cherche, pour chacune, ce qu'elle a que
 * les autres n'ont pas. Deux règles gouvernent le résultat :
 *
 *  1. **une raison ne sert qu'une fois.** Si trois destinations coûtent plus
 *     cher que la moins chère, le dire trois fois n'apprend rien à personne.
 *     Chaque type d'argument est attribué à celle pour qui il est le plus
 *     frappant, et les autres prennent le suivant sur leur liste ;
 *  2. **personne ne reste muet.** Faute de superlatif, une destination reçoit
 *     sa propre meilleure note. Une carte sans phrase est un trou dans
 *     l'écran, et une carte avec une phrase creuse est pire.
 *
 * Rien n'est inventé et rien n'est reformulé par un modèle : ce sont les mêmes
 * chiffres, comparés. Le classement ne change pas — seule la façon de le lire.
 */

/** Sous cet écart, deux destinations sont à égalité : le dire serait mentir. */
const ECART_SENSIBLE = 8;
/** Un facteur en dessous mérite d'être signalé, même sur une bonne note. */
const FAIBLESSE = 55;
/** En deçà, « devancer le lot » serait un grand mot pour un écart de mesure. */
const AVANTAGE_NET = 4;
/** En deçà, l'écart de prix ne change la vie de personne. */
const ECART_PRIX_NOTABLE = 0.12;
/** Deux prix à moins de ça l'un de l'autre : aucune n'est « la moins chère ». */
const EGALITE_PRIX = 0.02;
const EGALITE_PRIX_CENTS = 1000;

const SUPERLATIFS: Readonly<Record<ScoreFactor['key'], string>> = {
  price: 'la plus légère pour le budget',
  preferences: 'la plus proche de vos envies',
  climate: 'la mieux lotie côté météo',
  travel: 'la plus rapide à rejoindre',
  activities: 'la plus riche en choses à faire',
  equity: 'celle qui contente le mieux tout le monde',
};

const RESERVES: Readonly<Record<ScoreFactor['key'], string>> = {
  price: 'c’est la plus lourde pour le budget',
  preferences: 'c’est elle qui colle le moins à vos envies',
  climate: 'la météo y est la moins engageante',
  travel: 'c’est le trajet le plus long',
  activities: 'il y a moins à y faire',
  equity: 'c’est elle qui laisse le plus de monde de côté',
};

interface Argument {
  /** Deux arguments de même type ne sont jamais servis deux fois. */
  type: string;
  /** À qui il va, et à quel point il frappe. */
  destinationId: string;
  force: number;
  texte: string;
}

/**
 * Une phrase par destination, indexée par identifiant.
 *
 * Vide quand il n'y a rien à comparer — une seule proposition se lit très bien
 * sans qu'on lui explique qu'elle est première.
 */
export function distinguishScores(scores: readonly DestinationScore[]): Map<string, string> {
  const phrases = new Map<string, string>();
  if (scores.length < 2) return phrases;

  const arguments_ = rassemblerArguments(scores);

  // Le plus frappant d'abord : chaque argument va à la destination pour qui il
  // dit le plus, et chaque destination n'en reçoit qu'un.
  const attribues = new Map<string, Argument>();
  const typesServis = new Set<string>();
  // Deux destinations peuvent avoir le même point fort chiffré à l'identique
  // — deux villes à 100/100 en activités. On écarte donc aussi les doublons de
  // texte, sinon la promesse « chaque carte dit autre chose » ne tient pas.
  const textesServis = new Set<string>();
  for (const candidat of [...arguments_].sort((a, b) => b.force - a.force)) {
    if (attribues.has(candidat.destinationId)) continue;
    if (typesServis.has(candidat.type) || textesServis.has(candidat.texte)) continue;
    attribues.set(candidat.destinationId, candidat);
    typesServis.add(candidat.type);
    textesServis.add(candidat.texte);
  }

  for (const [rang, score] of scores.entries()) {
    const morceaux: string[] = [];
    const argument = attribues.get(score.destinationId);
    if (argument) morceaux.push(argument.texte);
    else if (rang > 0) {
      // Il arrive que deux destinations soient réellement interchangeables.
      // Le dire est plus utile qu'une carte muette, et plus honnête qu'un
      // avantage fabriqué pour meubler.
      morceaux.push(`${RANGS[rang] ?? `${rang + 1}ᵉ`} du classement, sans écart marquant avec les autres`);
    }

    // La tête du classement mérite qu'on dise de combien elle mène : sans ça,
    // « première » ne veut rien dire quand tout le monde est à un point.
    if (rang === 0) {
      const avance = score.total - scores[1]!.total;
      morceaux.unshift(
        avance <= 1
          ? 'En tête, mais d’un cheveu : les suivantes se valent'
          : `En tête de ${avance} point${avance > 1 ? 's' : ''}`,
      );
    }

    if (morceaux.length > 0) {
      phrases.set(score.destinationId, `${morceaux.map(majuscule).join('. ')}.`);
    }
  }

  return phrases;
}

function rassemblerArguments(scores: readonly DestinationScore[]): Argument[] {
  const trouves: Argument[] = [];

  // --- le prix, qui parle plus fort qu'une note
  const couts = scores.filter((score) => score.cost.totalCents > 0);
  if (couts.length >= 2) {
    const croissant = [...couts].sort((a, b) => a.cost.totalCents - b.cost.totalCents);
    const moinsChere = croissant[0]!;
    const plusChere = croissant[croissant.length - 1]!;
    const plancher = moinsChere.cost.totalCents;

    // « La moins chère » n'a de sens que si elle l'est vraiment : à dix euros
    // près sur quatre jours, les deux se valent et le dire induit en erreur.
    const marge = croissant[1]!.cost.totalCents - plancher;
    if (marge / plancher >= EGALITE_PRIX && marge >= EGALITE_PRIX_CENTS) {
      trouves.push({
        type: 'prix-bas',
        destinationId: moinsChere.destinationId,
        force: 100,
        texte: 'la moins chère du lot',
      });
    }

    const ecart = plusChere.cost.totalCents - plancher;
    if (plusChere !== moinsChere && ecart / plancher >= ECART_PRIX_NOTABLE) {
      trouves.push({
        type: 'prix-haut',
        destinationId: plusChere.destinationId,
        force: 60 + (ecart / plancher) * 100,
        texte: `la plus chère, ${formatCents(ecart, 'EUR', { hideCentimes: true })} au-dessus de la moins chère`,
      });
    }
  }

  // --- les superlatifs par facteur, seulement quand ils sont nets
  const cles = [...new Set(scores.flatMap((score) => score.factors.map((f) => f.key)))];
  for (const cle of cles) {
    const notes = scores
      .map((score) => ({ id: score.destinationId, ...facteurDe(score, cle) }))
      .filter((entree): entree is { id: string; note: number; poids: number } => entree.note !== null)
      .sort((a, b) => b.note - a.note);
    if (notes.length < 2) continue;

    const tete = notes[0]!;
    const ecart = tete.note - notes[1]!.note;
    if (ecart >= ECART_SENSIBLE) {
      trouves.push({
        type: `meilleur-${cle}`,
        destinationId: tete.id,
        force: ecart * (1 + tete.poids * 2),
        texte: SUPERLATIFS[cle],
      });
    }

    const queue = notes[notes.length - 1]!;
    const retard = notes[notes.length - 2]!.note - queue.note;
    if (retard >= ECART_SENSIBLE) {
      trouves.push({
        type: `pire-${cle}`,
        destinationId: queue.id,
        force: retard * (1 + queue.poids * 2) * 0.8,
        texte: RESERVES[cle],
      });
    }
  }

  // --- de quoi n'oublier personne
  //
  // Le repli ne dit pas « son point fort : équité 100/100 », que cinq
  // destinations sur six mériteraient à égalité — il dit où elle devance le
  // lot. C'est plus informatif, et c'est presque toujours différent d'une
  // destination à l'autre.
  const moyennes = moyennesParFacteur(scores);
  for (const score of scores) {
    const ecarts = score.factors
      .filter((facteur) => facteur.weight > 0 && moyennes.has(facteur.key))
      .map((facteur) => ({ facteur, ecart: facteur.score - moyennes.get(facteur.key)! }));
    if (ecarts.length === 0) continue;

    // Un repli par facteur, du plus flatteur au moins : si deux destinations
    // ont le même point fort au même chiffre, la seconde prendra le suivant
    // sur sa liste plutôt que de répéter la première.
    for (const { facteur, ecart } of [...ecarts].sort((a, b) => b.ecart - a.ecart)) {
      const quoi = facteur.label.toLowerCase();
      const note = Math.round(facteur.score);
      trouves.push({
        type: `propre-${score.destinationId}-${facteur.key}`,
        destinationId: score.destinationId,
        force: Math.max(0.001, ecart / 100),
        // Trois façons de le dire, selon ce que l'écart vaut réellement. Deux
        // points d'avance ne sont pas une avance, et l'écrire comme telle
        // décrédibiliserait tout le reste de l'écran.
        texte:
          ecart >= AVANTAGE_NET
            ? `elle devance le lot sur ${quoi} : ${note}/100 contre ${Math.round(moyennes.get(facteur.key)!)} en moyenne`
            : ecart > 0
              ? `au coude à coude avec les autres, avec un léger avantage sur ${quoi} (${note}/100)`
              : `aucun avantage net sur les autres ; sa meilleure carte reste ${quoi} (${note}/100)`,
      });
    }

    const faible = [...score.factors]
      .filter((facteur) => facteur.weight > 0 && facteur.score < FAIBLESSE)
      .sort((a, b) => a.score - b.score)[0];
    if (faible) {
      trouves.push({
        type: `bemol-${score.destinationId}`,
        destinationId: score.destinationId,
        force: (FAIBLESSE - faible.score) / 10,
        texte: `à surveiller : ${faible.label.toLowerCase()} ${Math.round(faible.score)}/100`,
      });
    }
  }

  return trouves;
}

function moyennesParFacteur(
  scores: readonly DestinationScore[],
): Map<ScoreFactor['key'], number> {
  const cumuls = new Map<ScoreFactor['key'], { somme: number; n: number }>();
  for (const score of scores) {
    for (const facteur of score.factors) {
      if (facteur.weight <= 0) continue;
      const entree = cumuls.get(facteur.key) ?? { somme: 0, n: 0 };
      entree.somme += facteur.score;
      entree.n += 1;
      cumuls.set(facteur.key, entree);
    }
  }
  return new Map([...cumuls].map(([cle, { somme, n }]) => [cle, somme / n]));
}

function facteurDe(
  score: DestinationScore,
  cle: ScoreFactor['key'],
): { note: number | null; poids: number } {
  const facteur = score.factors.find((entree) => entree.key === cle);
  return facteur && facteur.weight > 0
    ? { note: facteur.score, poids: facteur.weight }
    : { note: null, poids: 0 };
}

/** De quoi nommer un rang sans réinventer les ordinaux à chaque fois. */
const RANGS = [
  'première', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième',
  'septième', 'huitième', 'neuvième', 'dixième',
] as const;

const majuscule = (texte: string): string => texte.charAt(0).toUpperCase() + texte.slice(1);
