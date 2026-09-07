/**
 * Les liens partagés dans la discussion d'un voyage.
 *
 * Quelqu'un tombe sur un endroit à la télé, sur TikTok ou dans un article, et
 * le colle dans la conversation. C'est la manière dont un voyage se prépare
 * vraiment — bien avant qu'un itinéraire existe.
 *
 * Ce module ne fait qu'une chose, et la fait sûrement : reconnaître ce qui est
 * un lien ouvrable, et refuser tout le reste. Un message est du texte écrit par
 * quelqu'un d'autre ; le transformer en lien cliquable est précisément l'endroit
 * où une application se fait avoir.
 *
 * D'où deux règles fermes :
 *
 *  - **`http` et `https` seulement.** `javascript:`, `data:`, `file:` et le
 *    reste sont ignorés, pas affichés autrement : ils ne deviennent jamais un
 *    lien. Un clic ne doit jamais pouvoir exécuter quoi que ce soit.
 *  - **Le domaine est toujours montré.** On affiche « youtube.com » à côté du
 *    lien, pour qu'un lien maquillé en autre chose se voie avant le clic.
 *
 * Le rendu, lui, n'assemble jamais de HTML : les morceaux renvoyés ici sont
 * posés tels quels dans des nœuds React, ce qui rend l'injection impossible
 * par construction.
 */

/** Ce qu'un message contient, découpé pour l'affichage. */
export type FragmentMessage =
  | { kind: 'text'; text: string }
  | { kind: 'link'; url: string; host: string; source: SourceLien };

/**
 * D'où vient le lien. Sert à choisir une icône et à dire « une vidéo » plutôt
 * que « un lien », jamais à faire confiance au contenu.
 */
export type SourceLien =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'carte'
  | 'reservation'
  | 'web';

const PROTOCOLES_SURS = new Set(['http:', 'https:']);

/**
 * Repère les candidats. Volontairement large : ce qui est attrapé ici est
 * ensuite validé par `URL`, seul juge de ce qui est vraiment une adresse.
 *
 * La ponctuation finale est exclue pour qu'un lien en fin de phrase ne parte
 * pas avec le point qui le suit.
 */
const CANDIDAT = /\bhttps?:\/\/[^\s<>"']+/giu;

/** Retire la ponctuation qu'une phrase colle à la fin d'une adresse. */
function elaguer(brut: string): string {
  let url = brut;
  while (url.length > 0 && '.,;:!?'.includes(url[url.length - 1]!)) {
    url = url.slice(0, -1);
  }
  // Une parenthèse fermante n'appartient au lien que s'il en contient une
  // ouvrante : « (voir https://x.fr/a) » ne doit pas emporter la parenthèse.
  while (url.endsWith(')') && !url.includes('(')) url = url.slice(0, -1);
  return url;
}

function hote(url: URL): string {
  return url.hostname.replace(/^www\./u, '');
}

export function sourceDuLien(host: string): SourceLien {
  const h = host.toLowerCase();
  if (h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be') return 'youtube';
  if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok';
  if (h === 'instagram.com' || h.endsWith('.instagram.com')) return 'instagram';
  // `maps.app.goo.gl` est le raccourcisseur de Google Maps ; `goo.gl` tout court
  // ne dit rien de sa cible, et le classer « carte » serait une supposition.
  if (h.includes('maps.google') || h === 'maps.app.goo.gl') return 'carte';
  if (h === 'openstreetmap.org' || h.endsWith('.openstreetmap.org')) return 'carte';
  if (
    h === 'booking.com' ||
    h.endsWith('.booking.com') ||
    h === 'airbnb.fr' ||
    h === 'airbnb.com' ||
    h.endsWith('.airbnb.com') ||
    h === 'hostelworld.com' ||
    h.endsWith('.hostelworld.com')
  ) {
    return 'reservation';
  }
  return 'web';
}

/**
 * Découpe un message en texte et en liens ouvrables.
 *
 * Ce qui n'est pas un lien sûr reste du texte : on n'efface rien de ce que la
 * personne a écrit, on refuse seulement de le rendre cliquable.
 */
export function fragmenterMessage(message: string): FragmentMessage[] {
  const fragments: FragmentMessage[] = [];
  let curseur = 0;

  for (const trouve of message.matchAll(CANDIDAT)) {
    const debut = trouve.index ?? 0;
    const brut = trouve[0];
    const url = elaguer(brut);

    let analysee: URL;
    try {
      analysee = new URL(url);
    } catch {
      continue;
    }
    if (!PROTOCOLES_SURS.has(analysee.protocol)) continue;

    if (debut > curseur) {
      fragments.push({ kind: 'text', text: message.slice(curseur, debut) });
    }
    const host = hote(analysee);
    fragments.push({ kind: 'link', url, host, source: sourceDuLien(host) });
    curseur = debut + url.length;
  }

  if (curseur < message.length) {
    fragments.push({ kind: 'text', text: message.slice(curseur) });
  }
  return fragments;
}

/** Le premier lien ouvrable d'un message, s'il y en a un. */
export function premierLien(message: string): FragmentMessage | undefined {
  return fragmenterMessage(message).find((fragment) => fragment.kind === 'link');
}

/**
 * Un nom d'épingle proposé à partir du lien, pour que le champ ne soit pas
 * vide. Le domaine, jamais le chemin : un chemin est du texte non vérifié qui
 * n'a pas sa place comme titre par défaut.
 */
export function nomPropose(fragment: FragmentMessage): string {
  if (fragment.kind !== 'link') return '';
  switch (fragment.source) {
    case 'youtube':
      return 'Vidéo YouTube';
    case 'tiktok':
      return 'Vidéo TikTok';
    case 'instagram':
      return 'Publication Instagram';
    case 'carte':
      return 'Lieu partagé';
    case 'reservation':
      return `Hébergement (${fragment.host})`;
    default:
      return fragment.host;
  }
}
