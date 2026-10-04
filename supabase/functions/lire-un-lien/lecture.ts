/**
 * Lire un lien partagé, sans lui faire confiance.
 *
 * Module sans dépendance : il se teste hors ligne (`lecture.test.ts`), et
 * contient tout ce qui décide — quelle adresse on accepte d'ouvrir, ce qu'on
 * garde d'une page, ce qu'on croit de la réponse d'un modèle. Le reste
 * (`index.ts`) ne fait que transporter.
 */

// ---------------------------------------------------------------------------
// Quelles adresses le serveur accepte d'ouvrir
// ---------------------------------------------------------------------------

const HOTES_INTERDITS = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/u;

/**
 * Une adresse du web public, et rien d'autre.
 *
 * Le serveur va chercher une page à la place de quelqu'un : c'est exactement
 * ce qu'un attaquant voudrait détourner vers une adresse interne. On refuse
 * donc tout ce qui n'est pas http(s) sur un port ordinaire, les adresses IP
 * écrites en chiffres (un vrai site a un nom), les identifiants dans
 * l'adresse, et les noms réservés aux réseaux privés.
 */
export function adressePublique(brute: string): URL | null {
  let url: URL;
  try {
    url = new URL(brute.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '80' && url.port !== '443') return null;
  const hote = url.hostname.toLowerCase().replace(/\.$/u, '');
  if (!hote.includes('.')) return null;
  if (hote.startsWith('[') || /^[\d.]+$/u.test(hote) || /^0x/u.test(hote)) return null;
  if (HOTES_INTERDITS.test(hote)) return null;
  return url;
}

/**
 * Une adresse IP du web public.
 *
 * `adressePublique` ne juge que le nom, et un nom ordinaire peut mener à une
 * adresse interne : « 127.0.0.1.nip.io », ou un domaine dont on tient le DNS.
 * Le serveur résout donc le nom avant chaque requête et passe ici chaque
 * adresse obtenue. Refusées : les réseaux privés, la boucle locale, le lien
 * local (dont les métadonnées des hébergeurs, 169.254.169.254), le partage
 * d'adresses des opérateurs, la documentation, la multidiffusion, et les
 * mêmes cachées dans une IPv6 (encapsulée, compatible ou NAT64).
 */
export function ipPublique(ip: string): boolean {
  const v4 = octetsIPv4(ip);
  if (v4) return ipv4Publique(v4);
  const g = groupesIPv6(ip.toLowerCase().replace(/^\[|\]$/gu, ''));
  if (!g) return false;
  const debutNul = (n: number) => g.slice(0, n).every((x) => x === 0);
  const ipv4Finale = () => ipv4Publique([g[6]! >> 8, g[6]! & 0xff, g[7]! >> 8, g[7]! & 0xff]);
  if (debutNul(8)) return false; // ::
  if (debutNul(7) && g[7] === 1) return false; // ::1
  if (debutNul(5) && g[5] === 0xffff) return ipv4Finale(); // ::ffff:a.b.c.d
  if (debutNul(6)) return ipv4Finale(); // ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return ipv4Finale(); // NAT64
  if ((g[0]! & 0xfe00) === 0xfc00) return false; // fc00::/7, adresses locales uniques
  if ((g[0]! & 0xffc0) === 0xfe80) return false; // fe80::/10, lien local
  if ((g[0]! & 0xff00) === 0xff00) return false; // multidiffusion
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  return true;
}

function octetsIPv4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(ip);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
}

function ipv4Publique([a, b, c]: number[]): boolean {
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a! >= 224
  );
}

/** Les huit groupes de 16 bits d'une IPv6, « :: » et IPv4 finale dépliés ; `null` si illisible. */
function groupesIPv6(ip: string): number[] | null {
  let texte = ip;
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/u.exec(texte);
  if (v4) {
    const o = octetsIPv4(v4[1]!);
    if (!o) return null;
    texte = `${texte.slice(0, v4.index)}${((o[0]! << 8) | o[1]!).toString(16)}:${((o[2]! << 8) | o[3]!).toString(16)}`;
  }
  const moities = texte.split('::');
  if (moities.length > 2) return null;
  const gauche = moities[0] ? moities[0].split(':') : [];
  const droite = moities[1] ? moities[1].split(':') : [];
  const manquants = 8 - gauche.length - droite.length;
  if (moities.length === 1 ? manquants !== 0 : manquants < 1) return null;
  const groupes = [...gauche, ...Array<string>(moities.length === 2 ? manquants : 0).fill('0'), ...droite];
  if (!groupes.every((x) => /^[0-9a-f]{1,4}$/u.test(x))) return null;
  return groupes.map((x) => parseInt(x, 16));
}

/** Le premier lien d'un texte partagé (« Regarde ça https://vm.tiktok.com/… »). */
export function premierLienDuTexte(texte: string): string | null {
  const trouve = texte.match(/https?:\/\/[^\s<>"']+/u)?.[0];
  if (!trouve) return null;
  return trouve.replace(/[.,;:!?)]+$/u, '');
}

export type SourceDuLien = 'carte' | 'tiktok' | 'youtube' | 'instagram' | 'web';

export function sourceDe(url: URL): SourceDuLien {
  const h = url.hostname.toLowerCase().replace(/^www\./u, '');
  if (estUneCarte(url)) return 'carte';
  if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok';
  if (h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be') return 'youtube';
  if (h === 'instagram.com' || h.endsWith('.instagram.com')) return 'instagram';
  return 'web';
}

/** Google Maps, Plans d'Apple, OpenStreetMap — raccourcis compris. */
export function estUneCarte(url: URL): boolean {
  const h = url.hostname.toLowerCase().replace(/^www\./u, '');
  if (h === 'maps.app.goo.gl' || (h === 'goo.gl' && url.pathname.startsWith('/maps'))) return true;
  if (h.startsWith('maps.google.')) return true;
  if (/^google\.[a-z.]+$/u.test(h) && url.pathname.startsWith('/maps')) return true;
  if (h === 'maps.apple.com') return true;
  return h === 'openstreetmap.org' || h === 'osm.org' || h.endsWith('.openstreetmap.org');
}

/**
 * La page de consentement de Google cache la carte dans son paramètre
 * `continue` : c'est elle qu'on veut, pas le formulaire.
 */
export function carteDerriereLeConsentement(url: URL): URL | null {
  if (!url.hostname.toLowerCase().startsWith('consent.google.')) return null;
  const suite = url.searchParams.get('continue');
  if (!suite) return null;
  const cible = adressePublique(suite);
  return cible && estUneCarte(cible) ? cible : null;
}

/** L'adresse oEmbed d'une vidéo : son titre et sa légende, sans ouvrir la page. */
export function oEmbedDe(url: URL): URL | null {
  const source = sourceDe(url);
  if (source === 'tiktok') {
    const o = new URL('https://www.tiktok.com/oembed');
    o.searchParams.set('url', url.toString());
    return o;
  }
  if (source === 'youtube') {
    const o = new URL('https://www.youtube.com/oembed');
    o.searchParams.set('url', url.toString());
    o.searchParams.set('format', 'json');
    return o;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ce qu'on garde d'une page
// ---------------------------------------------------------------------------

export interface MetaDeLaPage {
  titre: string | null;
  description: string | null;
  /** Un lieu décrit par les données structurées de la page, point compris. */
  lieu: { nom: string; lat: number; lng: number; adresse: string | null } | null;
}

const ENTITES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '’',
  nbsp: ' ',
  '#39': '’',
};

export function decoderEntites(texte: string): string {
  return texte
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z#0-9]+);/giu, (tout, nom: string) => ENTITES[nom.toLowerCase()] ?? tout);
}

function nettoyer(texte: string | null | undefined, max: number): string | null {
  if (!texte) return null;
  const propre = decoderEntites(texte.replace(/<[^>]*>/gu, ' ')).replace(/\s+/gu, ' ').trim();
  return propre ? propre.slice(0, max) : null;
}

function meta(html: string, nom: string): string | null {
  // L'ordre des attributs varie d'un site à l'autre : on essaie les deux.
  const motif = nom.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const avant = new RegExp(
    `<meta[^>]+(?:property|name)=["']${motif}["'][^>]*content=["']([^"']*)["']`,
    'iu',
  );
  const apres = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${motif}["']`,
    'iu',
  );
  return html.match(avant)?.[1] ?? html.match(apres)?.[1] ?? null;
}

/**
 * Le titre, la description, et un lieu s'il est décrit proprement.
 *
 * Beaucoup de pages de restaurants et de musées publient leurs coordonnées
 * en JSON-LD (`geo.latitude`, `geo.longitude`) : c'est la seule source qu'on
 * croit sans passer par un géocodeur, parce que c'est le site du lieu qui la
 * donne.
 */
export function metaDeLaPage(html: string): MetaDeLaPage {
  const titre =
    nettoyer(meta(html, 'og:title'), 200) ??
    nettoyer(meta(html, 'twitter:title'), 200) ??
    nettoyer(html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1], 200);
  const description =
    nettoyer(meta(html, 'og:description'), 600) ?? nettoyer(meta(html, 'description'), 600);
  return { titre, description, lieu: lieuStructure(html) };
}

function lieuStructure(html: string): MetaDeLaPage['lieu'] {
  const blocs = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/giu);
  for (const [, contenu] of blocs) {
    let donnees: unknown;
    try {
      donnees = JSON.parse(contenu!.trim());
    } catch {
      continue;
    }
    const trouve = chercherUnLieu(donnees, 0);
    if (trouve) return trouve;
  }
  return null;
}

function chercherUnLieu(noeud: unknown, profondeur: number): MetaDeLaPage['lieu'] {
  if (profondeur > 4 || noeud === null || typeof noeud !== 'object') return null;
  if (Array.isArray(noeud)) {
    for (const element of noeud) {
      const trouve = chercherUnLieu(element, profondeur + 1);
      if (trouve) return trouve;
    }
    return null;
  }
  const objet = noeud as Record<string, unknown>;
  const geo = objet['geo'] as Record<string, unknown> | undefined;
  const nom = typeof objet['name'] === 'string' ? nettoyer(objet['name'], 120) : null;
  if (geo && nom) {
    const lat = Number(geo['latitude']);
    const lng = Number(geo['longitude']);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      const adresse = objet['address'] as Record<string, unknown> | string | undefined;
      const texteAdresse =
        typeof adresse === 'string'
          ? adresse
          : adresse
            ? [adresse['streetAddress'], adresse['postalCode'], adresse['addressLocality']]
                .filter((partie) => typeof partie === 'string' && partie)
                .join(', ')
            : '';
      return { nom, lat, lng, adresse: nettoyer(texteAdresse, 300) };
    }
  }
  for (const cle of ['@graph', 'mainEntity', 'itemListElement', 'item']) {
    const trouve = chercherUnLieu(objet[cle], profondeur + 1);
    if (trouve) return trouve;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Le texte donné au modèle, et ce qu'on croit de sa réponse
// ---------------------------------------------------------------------------

/**
 * Le texte à lire : titre, légende, texte partagé — sans les adresses, qui
 * n'apprennent rien au modèle, ni les @mentions, qui sont des noms de
 * personnes. Les mots-dièse perdent leur dièse : « #lisbonne » dit un lieu.
 */
export function corpusDuLien(parties: readonly (string | null | undefined)[]): string {
  return parties
    .filter((partie): partie is string => Boolean(partie))
    .join('\n')
    .replace(/https?:\/\/\S+/gu, ' ')
    // Une adresse e-mail n'est pas un lieu, et elle ne part jamais au modèle.
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/gu, ' ')
    .replace(/(^|\s)@[\w.]+/gu, '$1')
    .replace(/#([\p{L}\p{N}_]+)/gu, '$1')
    .split('\n')
    .map((ligne) => ligne.replace(/[ \t]+/gu, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);
}

/** Minuscules, sans accents ni ponctuation : pour comparer, jamais pour afficher. */
export function plier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface LieuCite {
  nom: string;
  ville: string | null;
}

/**
 * Les lieux rendus par le modèle, filtrés : seuls ceux qui figurent vraiment
 * dans le texte restent.
 *
 * Un modèle à qui l'on montre une légende sur Lisbonne a envie d'ajouter la
 * tour de Belém, qu'il connaît. C'est précisément ce qu'on ne veut pas : une
 * épingle doit venir de ce que la personne a partagé. Chaque nom est donc
 * recherché dans le texte d'origine ; absent, il est écarté.
 */
export function lieuxCites(reponse: unknown, corpus: string): LieuCite[] | null {
  if (reponse === null || typeof reponse !== 'object') return null;
  const liste = (reponse as { lieux?: unknown }).lieux;
  if (!Array.isArray(liste)) return null;
  const texte = ` ${plier(corpus)} `;
  const vus = new Set<string>();
  const gardes: LieuCite[] = [];
  for (const element of liste) {
    const brut =
      typeof element === 'string'
        ? { nom: element, ville: null }
        : (element as { nom?: unknown; ville?: unknown } | null);
    const nom = typeof brut?.nom === 'string' ? brut.nom.replace(/\s+/gu, ' ').trim() : '';
    if (nom.length < 2 || nom.length > 80) continue;
    const cle = plier(nom);
    if (!cle || vus.has(cle) || !texte.includes(` ${cle} `)) continue;
    vus.add(cle);
    const ville =
      typeof brut?.ville === 'string' && texte.includes(` ${plier(brut.ville)} `)
        ? brut.ville.trim().slice(0, 80)
        : null;
    gardes.push({ nom: nom.slice(0, 80), ville });
    if (gardes.length >= 8) break;
  }
  return gardes;
}

/** Distance à vol d'oiseau, en kilomètres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
