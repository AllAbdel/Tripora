import { fold } from './text.js';
import { FOURNISSEURS, type DonneesDeReservation, type TypeDeReservation } from './reservations.js';

/**
 * Lire un e-mail de confirmation, et en tirer une réservation.
 *
 * Booking, Airbnb, Expedia ou GetYourGuide n'ouvrent aucune API qui laisserait
 * une application lire les réservations d'un client. Ce qu'ils envoient tous,
 * c'est un e-mail. On le colle — ou on dépose le fichier `.eml` ou `.ics` — et
 * cette fonction en tire ce qu'elle peut. Trois lectures, de la plus sûre à la
 * plus approximative :
 *
 * 1. **Les données structurées.** La plupart des grandes plateformes cachent
 *    dans leurs e-mails une description schema.org de la réservation — c'est
 *    ce qui permet à Gmail d'afficher une carte « Votre séjour à Ubud ». Quand
 *    elle est là, tout est exact : dates, heures, adresse, référence.
 * 2. **Le calendrier.** Un fichier `.ics` joint, ou collé, dit la date, l'heure
 *    et le lieu sans ambiguïté.
 * 3. **Le texte.** Un e-mail copié depuis Gmail ne garde que son texte. On y
 *    cherche ce que tous ces e-mails écrivent, en français ou en anglais :
 *    « Arrivée », « Check-in », « Numéro de confirmation », « Total ».
 *
 * Rien n'est enregistré sans relecture : la fiche arrive préremplie, et c'est
 * la personne qui valide. Mieux vaut un champ vide qu'un champ faux — une
 * valeur douteuse est laissée de côté plutôt que devinée.
 *
 * Tout se passe sur l'appareil : l'e-mail, qui contient un nom, une adresse
 * e-mail et parfois un téléphone, n'est envoyé nulle part.
 */

export type OrigineDeLaLecture = 'donnees-structurees' | 'calendrier' | 'texte';

export interface LectureDeConfirmation {
  brouillon: Partial<DonneesDeReservation>;
  /** Ce qui a servi, pour le dire à l'écran. `null` : rien trouvé. */
  origine: OrigineDeLaLecture | null;
  /** Les champs remplis, pour signaler ce qui vient de l'e-mail. */
  trouves: (keyof DonneesDeReservation)[];
}

export function lireUneConfirmation(brut: string): LectureDeConfirmation {
  const message = deplierLeMessage(brut);
  const toutLeTexte = [message.expediteur, message.sujet, message.texte, message.html].filter(Boolean).join('\n');

  const structure = message.html ? lireLesDonneesStructurees(message.html) : lireLesDonneesStructurees(brut);
  const calendrier = /BEGIN:VEVENT/u.test(brut) ? lireUnCalendrier(brut) : null;
  const texte = lireLeTexte(message.texte, message.sujet);

  // Le plus sûr d'abord ; le texte ne comble que ce qui manque.
  const brouillon: Partial<DonneesDeReservation> = {};
  for (const source of [structure, calendrier, texte]) {
    if (!source) continue;
    for (const [cle, valeur] of Object.entries(source) as [keyof DonneesDeReservation, unknown][]) {
      if (valeur === undefined || valeur === null || valeur === '') continue;
      if (brouillon[cle] === undefined) (brouillon as Record<string, unknown>)[cle] = valeur;
    }
  }

  const fournisseur = brouillon.fournisseur ?? reconnaitreLeFournisseur(toutLeTexte);
  if (fournisseur) brouillon.fournisseur = fournisseur;
  if (!brouillon.type) {
    brouillon.type =
      FOURNISSEURS.find((connu) => connu.id === fournisseur)?.type ?? devinerLeType(message.texte);
  }

  nettoyer(brouillon);

  const origine: OrigineDeLaLecture | null =
    remplis(structure) > 1
      ? 'donnees-structurees'
      : remplis(calendrier) > 0
        ? 'calendrier'
        : remplis(texte) > 0
          ? 'texte'
          : null;

  const trouves = (Object.keys(brouillon) as (keyof DonneesDeReservation)[]).filter(
    (cle) => cle !== 'type' && cle !== 'fournisseur' && cle !== 'devise',
  );
  return { brouillon, origine: trouves.length > 0 ? origine : null, trouves };
}

/** Combien de champs une lecture a vraiment remplis. */
function remplis(lecture: Partial<DonneesDeReservation> | null): number {
  if (!lecture) return 0;
  return Object.values(lecture).filter((valeur) => valeur !== undefined && valeur !== null && valeur !== '').length;
}

/* ======================================================== Le message brut == */

interface MessageDeplie {
  /** L'en-tête « From » : le meilleur indice du fournisseur. */
  expediteur: string;
  sujet: string;
  texte: string;
  html: string | null;
}

/**
 * Un fichier `.eml` est un empilement de parties, chacune encodée à sa façon :
 * le HTML en « quoted-printable », une pièce jointe en base64, le sujet en
 * « =?UTF-8?Q?…?= ». On en sort le texte lisible et le HTML — c'est dans le
 * HTML que se cachent les données structurées.
 */
export function deplierLeMessage(brut: string): MessageDeplie {
  const normalise = brut.replace(/\r\n?/gu, '\n');
  const estUnEmail = /^(mime-version|content-type|subject|from|received|delivered-to):/imu.test(normalise.slice(0, 5000));
  if (estUnEmail && /^content-type:/imu.test(normalise)) {
    const { entetes, corps } = separer(normalise);
    const sujet = decoderLesMotsEncodes(entetes.get('subject') ?? '');
    const expediteur = decoderLesMotsEncodes(entetes.get('from') ?? '');
    const parties: { type: string; contenu: string }[] = [];
    extraireLesParties(entetes, corps, parties, 0);
    const html = parties.find((partie) => partie.type === 'text/html')?.contenu ?? null;
    const texte =
      parties.find((partie) => partie.type === 'text/plain')?.contenu ?? (html ? htmlEnTexte(html) : corps);
    return { expediteur, sujet, texte: html && texte.length < 40 ? htmlEnTexte(html) : texte, html };
  }
  if (/<(html|body|table|div|p|script)[\s>]/iu.test(normalise)) {
    return { expediteur: '', sujet: '', texte: htmlEnTexte(normalise), html: normalise };
  }
  return { expediteur: '', sujet: '', texte: normalise, html: null };
}

function separer(message: string): { entetes: Map<string, string>; corps: string } {
  const fin = message.indexOf('\n\n');
  const blocEntetes = fin === -1 ? message : message.slice(0, fin);
  const corps = fin === -1 ? '' : message.slice(fin + 2);
  const entetes = new Map<string, string>();
  // Un en-tête peut continuer sur la ligne suivante, indentée.
  for (const ligne of blocEntetes.replace(/\n[ \t]+/gu, ' ').split('\n')) {
    const deuxPoints = ligne.indexOf(':');
    if (deuxPoints <= 0) continue;
    const nom = ligne.slice(0, deuxPoints).trim().toLowerCase();
    if (!entetes.has(nom)) entetes.set(nom, ligne.slice(deuxPoints + 1).trim());
  }
  return { entetes, corps };
}

function parametre(entete: string, nom: string): string | undefined {
  const trouve = new RegExp(`${nom}\\s*=\\s*"?([^";]+)"?`, 'iu').exec(entete);
  return trouve?.[1]?.trim();
}

function extraireLesParties(
  entetes: Map<string, string>,
  corps: string,
  parties: { type: string; contenu: string }[],
  profondeur: number,
): void {
  if (profondeur > 6) return;
  const typeComplet = entetes.get('content-type') ?? 'text/plain';
  const type = typeComplet.split(';')[0]!.trim().toLowerCase();

  if (type.startsWith('multipart/')) {
    const frontiere = parametre(typeComplet, 'boundary');
    if (!frontiere) return;
    const morceaux = corps.split(`--${frontiere}`);
    for (const morceau of morceaux.slice(1)) {
      if (morceau.startsWith('--')) break;
      const partie = separer(morceau.replace(/^\n/u, ''));
      extraireLesParties(partie.entetes, partie.corps, parties, profondeur + 1);
    }
    return;
  }
  if (type !== 'text/html' && type !== 'text/plain' && type !== 'text/calendar') return;

  const encodage = (entetes.get('content-transfer-encoding') ?? '').toLowerCase();
  const jeu = parametre(typeComplet, 'charset') ?? 'utf-8';
  let octets: Uint8Array | null = null;
  if (encodage.includes('quoted-printable')) octets = decoderQuotedPrintable(corps);
  else if (encodage.includes('base64')) octets = decoderBase64(corps);
  const contenu = octets ? decoderLesOctets(octets, jeu) : corps;
  parties.push({ type: type === 'text/calendar' ? 'text/plain' : type, contenu });
}

function decoderLesOctets(octets: Uint8Array, jeu: string): string {
  try {
    return new TextDecoder(jeu.toLowerCase(), { fatal: false }).decode(octets);
  } catch {
    return new TextDecoder('utf-8').decode(octets);
  }
}

const encodeur = new TextEncoder();

export function decoderQuotedPrintable(texte: string): Uint8Array {
  const sansCoupures = texte.replace(/=\n/gu, '');
  const octets: number[] = [];
  for (let i = 0; i < sansCoupures.length; i += 1) {
    const caractere = sansCoupures[i]!;
    const hexa = sansCoupures.slice(i + 1, i + 3);
    if (caractere === '=' && /^[0-9A-Fa-f]{2}$/u.test(hexa)) {
      octets.push(parseInt(hexa, 16));
      i += 2;
    } else {
      for (const octet of encodeur.encode(caractere)) octets.push(octet);
    }
  }
  return Uint8Array.from(octets);
}

const ALPHABET_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decoderBase64(texte: string): Uint8Array {
  const propre = texte.replace(/[^A-Za-z0-9+/]/gu, '');
  const octets: number[] = [];
  let tampon = 0;
  let bits = 0;
  for (const caractere of propre) {
    tampon = (tampon << 6) | ALPHABET_BASE64.indexOf(caractere);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      octets.push((tampon >> bits) & 0xff);
    }
  }
  return Uint8Array.from(octets);
}

/** « =?UTF-8?Q?R=C3=A9servation?= » devient « Réservation ». */
export function decoderLesMotsEncodes(entete: string): string {
  return entete
    .replace(/\?=\s+=\?/gu, '?==?')
    .replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/gu, (_tout, jeu: string, mode: string, contenu: string) => {
      const octets =
        mode.toUpperCase() === 'B'
          ? decoderBase64(contenu)
          : decoderQuotedPrintable(contenu.replace(/_/gu, ' '));
      return decoderLesOctets(octets, jeu);
    });
}

const ENTITES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", eacute: 'é', egrave: 'è',
  ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', ccedil: 'ç', icirc: 'î', iuml: 'ï',
  ocirc: 'ô', ugrave: 'ù', ucirc: 'û', uuml: 'ü', Eacute: 'É', Agrave: 'À', euro: '€',
  pound: '£', yen: '¥', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–',
  mdash: '—', hellip: '…', middot: '·', deg: '°', ordm: 'º', times: '×',
};

export function decoderLesEntites(texte: string): string {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (tout, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITES[code] ?? tout;
  });
}

export function htmlEnTexte(html: string): string {
  const texte = html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1\s*>/giu, ' ')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|header|footer)\s*>/giu, '\n')
    .replace(/<\/t[dh]\s*>/giu, '  ')
    .replace(/<[^>]+>/gu, ' ');
  return decoderLesEntites(texte)
    .replace(/[ \t\u00a0\u200b]+/gu, ' ')
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne, index, lignes) => ligne !== '' || (index > 0 && lignes[index - 1] !== ''))
    .join('\n')
    .trim();
}

/* ============================================== 1. Données structurées == */

type Noeud = Record<string, unknown>;

function estNoeud(valeur: unknown): valeur is Noeud {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

function typesDe(noeud: Noeud): string[] {
  const type = noeud['@type'];
  return (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === 'string');
}

function tousLesNoeuds(valeur: unknown, sortie: Noeud[] = [], profondeur = 0): Noeud[] {
  if (profondeur > 8) return sortie;
  if (Array.isArray(valeur)) {
    for (const element of valeur) tousLesNoeuds(element, sortie, profondeur + 1);
  } else if (estNoeud(valeur)) {
    sortie.push(valeur);
    for (const cle of ['@graph', 'subReservation', 'mainEntity']) {
      if (cle in valeur) tousLesNoeuds(valeur[cle], sortie, profondeur + 1);
    }
  }
  return sortie;
}

function nomDe(valeur: unknown): string | undefined {
  if (typeof valeur === 'string') return valeur.trim() || undefined;
  if (estNoeud(valeur) && typeof valeur['name'] === 'string') return valeur['name'].trim() || undefined;
  return undefined;
}

function adresseDe(valeur: unknown): string | undefined {
  if (typeof valeur === 'string') return valeur.trim() || undefined;
  if (!estNoeud(valeur)) return undefined;
  if (estNoeud(valeur['address']) || typeof valeur['address'] === 'string') return adresseDe(valeur['address']);
  const morceaux = [
    valeur['streetAddress'],
    [valeur['postalCode'], valeur['addressLocality']].filter((m) => typeof m === 'string').join(' '),
    nomDe(valeur['addressCountry']),
  ].filter((m): m is string => typeof m === 'string' && m.trim() !== '');
  return morceaux.length > 0 ? morceaux.join(', ') : undefined;
}

/** « 2026-07-10T15:00:00+08:00 » : la date et l'heure telles qu'écrites, celles du lieu. */
function momentDe(valeur: unknown): { date?: string; heure?: string } {
  if (typeof valeur !== 'string') return {};
  const trouve = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/u.exec(valeur.trim());
  if (!trouve) return {};
  const [, date, heures, minutes] = trouve;
  // Une heure en UTC (« Z ») n'est pas celle du lieu : on garde la date seule.
  const utc = /Z$/u.test(valeur.trim());
  return { date: date!, ...(heures && !utc ? { heure: `${heures}:${minutes}` } : {}) };
}

function prixDe(noeud: Noeud): { prixCents?: number; devise?: string } {
  const candidats = [noeud['totalPrice'], noeud['price'], noeud['priceSpecification']];
  for (const candidat of candidats) {
    const valeur = estNoeud(candidat) ? candidat['price'] : candidat;
    const devise = estNoeud(candidat) ? candidat['priceCurrency'] : noeud['priceCurrency'];
    const nombre = typeof valeur === 'number' ? valeur : typeof valeur === 'string' ? lireUnNombre(valeur) : null;
    if (nombre !== null && nombre > 0) {
      return {
        prixCents: Math.round(nombre * 100),
        ...(typeof devise === 'string' && /^[A-Za-z]{3}$/u.test(devise) ? { devise: devise.toUpperCase() } : {}),
      };
    }
  }
  return {};
}

function lienDe(noeud: Noeud): string | undefined {
  const actions = [noeud['potentialAction']].flat().filter(estNoeud);
  const candidats = [
    noeud['modifyReservationUrl'],
    noeud['url'],
    ...actions.map((action) => (estNoeud(action['target']) ? action['target']['urlTemplate'] : action['target'] ?? action['url'])),
  ];
  return candidats.find((candidat): candidat is string => typeof candidat === 'string' && /^https:\/\//u.test(candidat));
}

export function lireLesDonneesStructurees(html: string): Partial<DonneesDeReservation> | null {
  const blocs = [
    ...html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/giu),
  ];
  for (const bloc of blocs) {
    const contenu = bloc[1]!.trim();
    let donnees: unknown;
    try {
      donnees = JSON.parse(contenu);
    } catch {
      try {
        donnees = JSON.parse(decoderLesEntites(contenu));
      } catch {
        continue;
      }
    }
    const reservation = tousLesNoeuds(donnees).find((noeud) =>
      typesDe(noeud).some((type) => /Reservation$/u.test(type) && type !== 'ReservationPackage'),
    );
    if (reservation) return traduireLaReservation(reservation);
  }
  return null;
}

function traduireLaReservation(noeud: Noeud): Partial<DonneesDeReservation> {
  const type = typesDe(noeud).find((t) => /Reservation$/u.test(t)) ?? '';
  const pour = estNoeud(noeud['reservationFor']) ? noeud['reservationFor'] : {};
  const sortie: Partial<DonneesDeReservation> = {};
  let debut: { date?: string; heure?: string };
  let fin: { date?: string; heure?: string };

  switch (type) {
    case 'LodgingReservation':
      sortie.type = 'hebergement';
      sortie.titre = nomDe(pour);
      sortie.adresse = adresseDe(pour);
      debut = momentDe(noeud['checkinTime'] ?? noeud['checkinDate']);
      fin = momentDe(noeud['checkoutTime'] ?? noeud['checkoutDate']);
      break;
    case 'FoodEstablishmentReservation':
      sortie.type = 'restaurant';
      sortie.titre = nomDe(pour);
      sortie.adresse = adresseDe(pour);
      debut = momentDe(noeud['startTime']);
      fin = momentDe(noeud['endTime']);
      break;
    case 'FlightReservation': {
      sortie.type = 'transport';
      const compagnie = estNoeud(pour['airline']) ? pour['airline'] : {};
      const de = estNoeud(pour['departureAirport']) ? pour['departureAirport'] : {};
      const vers = estNoeud(pour['arrivalAirport']) ? pour['arrivalAirport'] : {};
      const numero = [compagnie['iataCode'], pour['flightNumber']].filter((m) => typeof m === 'string').join('');
      const trajet = [de['iataCode'] ?? nomDe(de), vers['iataCode'] ?? nomDe(vers)].filter(Boolean).join(' → ');
      sortie.titre = ['Vol', numero, trajet].filter(Boolean).join(' ');
      sortie.adresse = nomDe(de);
      debut = momentDe(pour['departureTime']);
      fin = momentDe(pour['arrivalTime']);
      break;
    }
    case 'TrainReservation':
    case 'BusReservation':
    case 'BoatReservation': {
      sortie.type = 'transport';
      const mot = type === 'TrainReservation' ? 'Train' : type === 'BusReservation' ? 'Bus' : 'Bateau';
      const de = nomDe(pour['departureStation'] ?? pour['departureBusStop'] ?? pour['departureBoatTerminal']);
      const vers = nomDe(pour['arrivalStation'] ?? pour['arrivalBusStop'] ?? pour['arrivalBoatTerminal']);
      sortie.titre = [mot, [de, vers].filter(Boolean).join(' → ')].filter(Boolean).join(' ');
      sortie.adresse = de;
      debut = momentDe(pour['departureTime']);
      fin = momentDe(pour['arrivalTime']);
      break;
    }
    case 'RentalCarReservation':
      sortie.type = 'transport';
      sortie.titre = ['Location de voiture', nomDe(pour['brand'])].filter(Boolean).join(' ');
      sortie.adresse = adresseDe(noeud['pickupLocation']);
      debut = momentDe(noeud['pickupTime']);
      fin = momentDe(noeud['dropoffTime']);
      break;
    default: {
      sortie.type = type === 'EventReservation' ? 'activite' : 'autre';
      sortie.titre = nomDe(pour);
      const lieu = pour['location'];
      sortie.adresse = adresseDe(lieu) ?? nomDe(lieu);
      debut = momentDe(pour['startDate'] ?? noeud['startTime']);
      fin = momentDe(pour['endDate'] ?? noeud['endTime']);
    }
  }

  if (debut.date) sortie.debutLe = debut.date;
  if (debut.heure) sortie.debutA = debut.heure;
  if (fin.date && fin.date !== debut.date) sortie.finLe = fin.date;
  if (fin.date && fin.heure) {
    sortie.finA = fin.heure;
    if (!sortie.finLe && fin.date === debut.date) sortie.finLe = fin.date;
  }

  const reference = noeud['reservationNumber'] ?? noeud['reservationId'];
  if (typeof reference === 'string' || typeof reference === 'number') sortie.reference = String(reference);
  const geo = estNoeud(pour['geo']) ? pour['geo'] : estNoeud(pour['location']) && estNoeud(pour['location']['geo']) ? pour['location']['geo'] : null;
  if (geo) {
    const lat = Number(geo['latitude']);
    const lng = Number(geo['longitude']);
    if (Number.isFinite(lat) && Number.isFinite(lng)) Object.assign(sortie, { lat, lng });
  }
  Object.assign(sortie, prixDe(noeud));
  const lien = lienDe(noeud);
  if (lien) sortie.lien = lien;
  const fournisseur = reconnaitreLeFournisseur(
    [nomDe(noeud['provider']), nomDe(noeud['broker']), nomDe(noeud['bookingAgent']), lien].filter(Boolean).join(' '),
  );
  if (fournisseur) sortie.fournisseur = fournisseur;
  return sortie;
}

/* ======================================================= 2. Calendrier == */

function valeurIcs(ligne: string): string {
  return ligne
    .slice(ligne.indexOf(':') + 1)
    .replace(/\\n/giu, '\n')
    .replace(/\\([,;\\])/gu, '$1')
    .trim();
}

function momentIcs(ligne: string): { date?: string; heure?: string } {
  const valeur = ligne.slice(ligne.indexOf(':') + 1).trim();
  const trouve = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/u.exec(valeur);
  if (!trouve) return {};
  const [, a, m, j, h, min] = trouve;
  const utc = valeur.endsWith('Z');
  return { date: `${a}-${m}-${j}`, ...(h && !utc ? { heure: `${h}:${min}` } : {}) };
}

export function lireUnCalendrier(texte: string): Partial<DonneesDeReservation> | null {
  const deplie = texte.replace(/\r\n?/gu, '\n').replace(/\n[ \t]/gu, '');
  const evenement = /BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/u.exec(deplie)?.[1];
  if (!evenement) return null;
  const sortie: Partial<DonneesDeReservation> = {};
  let dtend: { date?: string; heure?: string } = {};
  let finExclusive = false;
  for (const ligne of evenement.split('\n')) {
    const nom = ligne.split(/[;:]/u)[0]!.toUpperCase();
    if (nom === 'SUMMARY') sortie.titre = valeurIcs(ligne);
    else if (nom === 'LOCATION') sortie.adresse = valeurIcs(ligne).replace(/\n/gu, ', ');
    else if (nom === 'URL' && /^https:\/\//u.test(valeurIcs(ligne))) sortie.lien = valeurIcs(ligne);
    else if (nom === 'DTSTART') {
      const debut = momentIcs(ligne);
      if (debut.date) sortie.debutLe = debut.date;
      if (debut.heure) sortie.debutA = debut.heure;
    } else if (nom === 'DTEND') {
      dtend = momentIcs(ligne);
      finExclusive = /VALUE=DATE[:;]/u.test(ligne) && !dtend.heure;
    } else if (nom === 'GEO') {
      const [lat, lng] = valeurIcs(ligne).split(';').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) Object.assign(sortie, { lat, lng });
    } else if (nom === 'DESCRIPTION') {
      const reference = chercherLaReference(valeurIcs(ligne));
      if (reference) sortie.reference = reference;
    }
  }
  if (dtend.date) {
    // En iCalendar, la fin d'une journée entière est exclusive : le lendemain.
    const fin = finExclusive ? veille(dtend.date) : dtend.date;
    if (fin !== sortie.debutLe) sortie.finLe = fin;
    if (dtend.heure) {
      sortie.finA = dtend.heure;
      if (!sortie.finLe) sortie.finLe = fin;
    }
  }
  return sortie;
}

function veille(date: string): string {
  const jour = new Date(`${date}T00:00:00Z`);
  jour.setUTCDate(jour.getUTCDate() - 1);
  return jour.toISOString().slice(0, 10);
}

/* ============================================================ 3. Texte == */

const MOIS = [
  'janvier', 'janv', 'février', 'fevrier', 'févr', 'fevr', 'mars', 'avril', 'avr', 'mai', 'juin',
  'juillet', 'juil', 'août', 'aout', 'septembre', 'sept', 'octobre', 'novembre', 'décembre',
  'decembre', 'déc', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug',
  'sep', 'oct', 'nov', 'dec',
].sort((a, b) => b.length - a.length);

const MOTIF_MOIS = MOIS.join('|');

function numeroDuMois(mot: string): number | null {
  const plie = fold(mot);
  if (plie.startsWith('juin') || plie === 'jun' || plie.startsWith('june')) return 6;
  if (plie.startsWith('juil') || plie === 'jul' || plie.startsWith('july')) return 7;
  const debut = plie.slice(0, 3);
  const table: Record<string, number> = {
    jan: 1, fev: 2, feb: 2, mar: 3, avr: 4, apr: 4, mai: 5, may: 5, aou: 8, aug: 8,
    sep: 9, oct: 10, nov: 11, dec: 12,
  };
  return table[debut] ?? null;
}

function dateValide(annee: number, mois: number, jour: number): string | null {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (date.getUTCMonth() !== mois - 1) return null;
  return date.toISOString().slice(0, 10);
}

interface DateTrouvee {
  date: string;
  debut: number;
  fin: number;
}

function trouverLesDates(ligne: string): DateTrouvee[] {
  const trouvees: DateTrouvee[] = [];
  const ajouter = (date: string | null, debut: number, longueur: number) => {
    if (!date) return;
    if (trouvees.some((autre) => debut < autre.fin && autre.debut < debut + longueur)) return;
    trouvees.push({ date, debut, fin: debut + longueur });
  };
  for (const m of ligne.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/gu)) {
    ajouter(dateValide(Number(m[1]), Number(m[2]), Number(m[3])), m.index, m[0].length);
  }
  for (const m of ligne.matchAll(new RegExp(`\\b(\\d{1,2})(?:er|st|nd|rd|th)?\\.?\\s+(${MOTIF_MOIS})\\.?,?\\s+(20\\d{2})\\b`, 'giu'))) {
    const mois = numeroDuMois(m[2]!);
    if (mois) ajouter(dateValide(Number(m[3]), mois, Number(m[1])), m.index, m[0].length);
  }
  for (const m of ligne.matchAll(new RegExp(`\\b(${MOTIF_MOIS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, 'giu'))) {
    const mois = numeroDuMois(m[1]!);
    if (mois) ajouter(dateValide(Number(m[3]), mois, Number(m[2])), m.index, m[0].length);
  }
  for (const m of ligne.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/gu)) {
    let jour = Number(m[1]);
    let mois = Number(m[2]);
    // Jour d'abord, comme en Europe ; sauf quand ce ne peut pas en être un.
    if (mois > 12 && jour <= 12) [jour, mois] = [mois, jour];
    ajouter(dateValide(Number(m[3]), mois, jour), m.index, m[0].length);
  }
  return trouvees.sort((a, b) => a.debut - b.debut);
}

/** « 15:00 », « 15h00 », « 3:00 PM », « 9 am ». */
function trouverUneHeure(texte: string): string | null {
  const m =
    /\b([01]?\d|2[0-3])\s*[:h]\s*([0-5]\d)(?:\s*([ap])\.?m\.?)?(?![\d])/iu.exec(texte) ??
    /\b(1[0-2]|0?[1-9])\s*([ap])\.?m\.?\b/iu.exec(texte);
  if (!m) return null;
  let heures = Number(m[1]);
  const minutes = m.length > 3 ? (m[2] ?? '00') : '00';
  const periode = (m.length > 3 ? m[3] : m[2])?.toLowerCase();
  if (periode === 'p' && heures < 12) heures += 12;
  if (periode === 'a' && heures === 12) heures = 0;
  return `${String(heures).padStart(2, '0')}:${/^\d{2}$/u.test(minutes) ? minutes : '00'}`;
}

/** Une ligne qui annonce l'heure d'arrivée ou de départ : elle n'appartient qu'à elle-même. */
const ETIQUETTE_HORAIRE = /^(arriv[ée]e|d[ée]part|check[- ]?in|check[- ]?out|heure\s+d['’]arriv[ée]e|heure\s+de\s+d[ée]part)\b/iu;

const ARRIVEE = /(arriv[ée]e|check[- ]?in|enregistrement|arrival|\bdu\b|\bfrom\b)/iu;
const DEPART = /(d[ée]part|check[- ]?out|departure|lib[ée]ration|\bau\b|\buntil\b|\bto\b)/iu;
/** Les dates qui ne sont pas celles du voyage : réservé le, annulable jusqu'au. */
const DATE_A_ECARTER =
  /(r[ée]serv[ée]e?\s+le|effectu[ée]e?\s+le|date\s+de\s+(?:la\s+)?r[ée]servation|\bbooked\s+on|\bbooking\s+date|[ée]mis\s+le|\bissued\b|pay[ée]e?\s+le|\bpaid\s+on|annulation|annulable|\bcancel|jusqu['’]au|avant\s+le|\bbefore\b|\bdeadline\b|g[ée]n[ée]r[ée]|\bsent\b|\benvoy[ée])/iu;

function contexteAvant(lignes: string[], index: number, colonne: number): string {
  const ligne = lignes[index]!.slice(0, colonne);
  // Une étiquette sur la même ligne suffit. Sinon — la date seule, ou précédée
  // du seul jour de la semaine (« jeu. ») —, l'étiquette est au-dessus.
  if (ligne.trim().length > 15) return ligne;
  for (let i = index - 1; i >= 0 && i >= index - 2; i -= 1) {
    if (lignes[i]!.trim() !== '') return `${lignes[i]!} ${ligne}`;
  }
  return ligne;
}

function dernierMot(contexte: string, motifs: RegExp[]): number {
  let meilleur = -1;
  let rang = -1;
  motifs.forEach((motif, position) => {
    const global = new RegExp(motif.source, 'giu');
    for (const m of contexte.matchAll(global)) {
      if (m.index > meilleur) {
        meilleur = m.index;
        rang = position;
      }
    }
  });
  return rang;
}

const LIBELLES_REFERENCE =
  /(num[ée]ro\s+de\s+(?:confirmation|r[ée]servation|commande|billet)|n[°ºo]\s*(?:de\s+)?(?:confirmation|r[ée]servation|commande)|code\s+de\s+(?:r[ée]servation|confirmation)|r[ée]f[ée]rence(?:\s+de\s+(?:la\s+|votre\s+)?r[ée]servation)?|confirmation\s+(?:number|code|no\.?|#)|booking\s+(?:number|reference|ref\.?|id|code|no\.?|#)|reservation\s+(?:number|code|id|no\.?|#)|itinerary\s+(?:number|no\.?|#)|num[ée]ro\s+d['’]itin[ée]raire|order\s+(?:number|#))\s*[:：#]?\s*\n?\s*([A-Z0-9][A-Z0-9.-]{3,40})/iu;

export function chercherLaReference(texte: string): string | null {
  for (const m of texte.matchAll(new RegExp(LIBELLES_REFERENCE.source, 'giu'))) {
    const valeur = m[2]!.replace(/[.-]+$/u, '');
    // Une vraie référence a au moins un chiffre, ou ressemble à un code.
    if (/\d/u.test(valeur) || (/^[A-Z]{6,}$/u.test(valeur) && !/^[A-Z][a-z]/u.test(valeur))) return valeur;
  }
  return null;
}

const DEVISES: Record<string, string> = {
  '€': 'EUR', eur: 'EUR', euros: 'EUR', euro: 'EUR', '$': 'USD', 'us$': 'USD', usd: 'USD', '£': 'GBP',
  gbp: 'GBP', chf: 'CHF', rp: 'IDR', idr: 'IDR', '฿': 'THB', thb: 'THB', '¥': 'JPY', jpy: 'JPY',
  mad: 'MAD', dh: 'MAD', cad: 'CAD', aud: 'AUD', 'a$': 'AUD', 'c$': 'CAD',
};
const MOTIF_DEVISE = '(US\\$|A\\$|C\\$|EUR|USD|GBP|CHF|IDR|THB|JPY|MAD|CAD|AUD|euros?|Rp|DH|€|\\$|£|฿|¥)';
const MOTIF_NOMBRE = "(\\d{1,3}(?:[\\s.,'\\u00a0\\u202f]\\d{3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";

/** « 1 234,56 », « 1,234.56 », « 1.500.000 » : le séparateur décimal se devine. */
export function lireUnNombre(texte: string): number | null {
  const brut = texte.replace(/[\s'\u00a0\u202f]/gu, '');
  if (!/^\d[\d.,]*$/u.test(brut)) return null;
  const dernierPoint = brut.lastIndexOf('.');
  const derniereVirgule = brut.lastIndexOf(',');
  const separateur = Math.max(dernierPoint, derniereVirgule);
  let entier = brut;
  let decimales = '';
  if (separateur !== -1) {
    const apres = brut.slice(separateur + 1);
    const plusieurs = (brut.match(/[.,]/gu) ?? []).length;
    const unique = plusieurs === 1 || (dernierPoint !== -1 && derniereVirgule !== -1);
    if (unique && apres.length <= 2) {
      entier = brut.slice(0, separateur);
      decimales = apres;
    }
  }
  const nombre = Number(`${entier.replace(/[.,]/gu, '')}${decimales ? `.${decimales}` : ''}`);
  return Number.isFinite(nombre) ? nombre : null;
}

function chercherUnMontant(ligne: string): { prixCents: number; devise: string } | null {
  const avant = new RegExp(`${MOTIF_DEVISE}\\s?${MOTIF_NOMBRE}`, 'iu').exec(ligne);
  const apres = new RegExp(`${MOTIF_NOMBRE}\\s?${MOTIF_DEVISE}(?![a-z])`, 'iu').exec(ligne);
  const candidats = [
    avant && { devise: avant[1]!, nombre: avant[2]!, index: avant.index },
    apres && { devise: apres[2]!, nombre: apres[1]!, index: apres.index },
  ].filter((c): c is { devise: string; nombre: string; index: number } => Boolean(c));
  candidats.sort((a, b) => a.index - b.index);
  for (const candidat of candidats) {
    const nombre = lireUnNombre(candidat.nombre);
    const devise = DEVISES[candidat.devise.toLowerCase()];
    if (nombre !== null && nombre > 0 && devise) return { prixCents: Math.round(nombre * 100), devise };
  }
  return null;
}

const LIBELLES_TITRE = [
  /(?:booking|reservation|r[ée]servation)\s+(?:is\s+|est\s+|a\s+été\s+)?confirm(?:ed|[ée]e)\s*[:–—-]\s*(.{3,120})$/imu,
  /(?:r[ée]servation|s[ée]jour|booking|reservation|stay)\s+(?:à\s+l['’]|à\s+la\s+|au\s+|aux\s+|à\s+|chez\s+|pour\s+|at\s+|for\s+|in\s+)(.{3,120}?)(?:\s+(?:est|a\s+été|is|has\s+been)\s+(?:confirm|accept)|\s+confirm|\s*[!|–—]\s|\s+-\s|\s*$)/imu,
  /(?:confirmation\s+de\s+(?:votre\s+)?r[ée]servation|r[ée]servation\s+confirm[ée]e|booking\s+confirmation|booking\s+confirmed|reservation\s+confirmed)\s*[:–—-]\s*(.{3,120})$/imu,
  /^(?:h[ôo]tel|h[ée]bergement|[ée]tablissement|logement|propri[ée]t[ée]|property|hotel|accommodation|activit[ée]|activity|excursion|visite|tour|billet|ticket|produit|product|option)\s*[:：]\s*(.{3,120})$/imu,
];

function chercherLeTitre(sujet: string, texte: string): string | null {
  for (const source of [sujet, texte]) {
    if (!source) continue;
    for (const motif of LIBELLES_TITRE) {
      const trouve = motif.exec(source)?.[1]?.trim().replace(/[.!,;:]+$/u, '');
      if (trouve && trouve.length >= 3 && !/^(votre|your|la|le|the)$/iu.test(trouve)) return trouve;
    }
  }
  return null;
}

const LIBELLE_ADRESSE =
  /^(?:adresse(?:\s+de\s+l['’]h[ôo]tel)?|address|lieu(?:\s+de\s+rendez-vous)?|point\s+de\s+rendez-vous|meeting\s+point|location)\s*[:：]?\s*(.*)$/iu;

export function lireLeTexte(texte: string, sujet = ''): Partial<DonneesDeReservation> | null {
  if (!texte.trim() && !sujet.trim()) return null;
  const lignes = texte.replace(/\u00a0/gu, ' ').split('\n').map((ligne) => ligne.trim());
  const sortie: Partial<DonneesDeReservation> = {};

  // Les dates, chacune avec ce qui l'annonce.
  interface Candidate {
    date: string;
    role: 'arrivee' | 'depart' | 'neutre';
    heure: string | null;
  }
  const candidates: Candidate[] = [];
  lignes.forEach((ligne, index) => {
    for (const trouvee of trouverLesDates(ligne)) {
      const avant = contexteAvant(lignes, index, trouvee.debut);
      if (DATE_A_ECARTER.test(avant)) continue;
      const rang = dernierMot(avant, [ARRIVEE, DEPART]);
      const suite = ligne.slice(trouvee.fin);
      const suivante = lignes[index + 1] ?? '';
      const heure =
        trouverUneHeure(suite.slice(0, 40)) ??
        // La ligne suivante, quand elle précise l'heure de cette date-ci
        // (« à partir de 14:00 ») — pas quand elle ouvre une autre rubrique
        // (« Arrivée : 15:00 » sous une ligne « du 10 au 16 »).
        (suivante.length < 60 && trouverLesDates(suivante).length === 0 && !ETIQUETTE_HORAIRE.test(suivante)
          ? trouverUneHeure(suivante)
          : null);
      candidates.push({ date: trouvee.date, role: rang === 0 ? 'arrivee' : rang === 1 ? 'depart' : 'neutre', heure });
    }
  });

  const arrivee = candidates.find((c) => c.role === 'arrivee') ?? candidates[0];
  if (arrivee) {
    sortie.debutLe = arrivee.date;
    if (arrivee.heure) sortie.debutA = arrivee.heure;
    const depart =
      candidates.find((c) => c.role === 'depart' && c.date >= arrivee.date) ??
      candidates.filter((c) => c.date > arrivee.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (depart && depart.date >= arrivee.date) {
      const ecart = (Date.parse(depart.date) - Date.parse(arrivee.date)) / 86_400_000;
      if (ecart <= 60) {
        if (depart.date !== arrivee.date) sortie.finLe = depart.date;
        if (depart.heure && depart.role === 'depart') {
          sortie.finA = depart.heure;
          sortie.finLe = depart.date;
        }
      }
    }
  }

  // « Arrivée : à partir de 15:00 », sans date sur la même ligne.
  for (const ligne of lignes) {
    if (trouverLesDates(ligne).length > 0) continue;
    if (!sortie.debutA && /^(arriv[ée]e|check[- ]?in|heure\s+de\s+d[ée]but|start\s+time|heure)\b/iu.test(ligne)) {
      const heure = trouverUneHeure(ligne);
      if (heure) sortie.debutA = heure;
    }
    if (!sortie.finA && sortie.finLe && /^(d[ée]part|check[- ]?out)\b/iu.test(ligne)) {
      const heure = trouverUneHeure(ligne);
      if (heure) sortie.finA = heure;
    }
  }

  const reference = chercherLaReference(texte);
  if (reference) sortie.reference = reference;

  const titre = chercherLeTitre(sujet, texte);
  if (titre) sortie.titre = titre;

  // Le montant : d'abord une ligne qui dit « total », puis toute ligne de prix.
  const lignesDePrix = [
    ...lignes.map((ligne, index) => ({ ligne, index })).filter(({ ligne }) => /\btotal\b/iu.test(ligne)),
    ...lignes
      .map((ligne, index) => ({ ligne, index }))
      .filter(({ ligne }) => /(montant|prix|price|amount|pay[ée]|paid|à\s+payer|charged|tarif)/iu.test(ligne)),
  ];
  for (const { ligne, index } of lignesDePrix) {
    const montant = chercherUnMontant(ligne) ?? (lignes[index + 1] ? chercherUnMontant(lignes[index + 1]!) : null);
    if (montant) {
      sortie.prixCents = montant.prixCents;
      sortie.devise = montant.devise;
      break;
    }
  }

  for (let index = 0; index < lignes.length; index += 1) {
    const trouve = LIBELLE_ADRESSE.exec(lignes[index]!);
    if (!trouve) continue;
    const valeur = (trouve[1]?.trim() || lignes[index + 1]?.trim() || '').replace(/^[:：]\s*/u, '');
    if (valeur.length >= 6 && !/^https?:/iu.test(valeur)) {
      sortie.adresse = valeur;
      break;
    }
  }

  const lien = chercherLeLien(texte);
  if (lien) sortie.lien = lien;

  return sortie;
}

/**
 * Le lien pour gérer la réservation : un lien du fournisseur qui parle de
 * réservation, de voyage ou de billet. Jamais un lien de désinscription.
 */
function chercherLeLien(texte: string): string | null {
  const liens = [...texte.matchAll(/https:\/\/[^\s"'<>)\]]+/gu)].map((m) => m[0].replace(/[.,;]+$/u, ''));
  const utiles = liens.filter((lien) => {
    let chemin: string;
    try {
      const url = new URL(lien);
      // Le chemin, pas le domaine : « booking.com » contient « booking », et
      // son lien vers la page d'accueil n'aide personne.
      chemin = `${url.pathname}${url.search}`;
    } catch {
      return false;
    }
    return (
      lien.length <= 2000 &&
      /(manage|mybooking|my-?reservation|reservation|booking|trips?|voyage|confirmation|voucher|ticket|billet|itinerary|itin[ée]raire|order)/iu.test(chemin) &&
      !/(unsubscribe|d[ée]sinscri|privacy|confidentialit|help|aide|support|app-?store|facebook|twitter|instagram)/iu.test(lien)
    );
  });
  return utiles[0] ?? null;
}

/* ====================================================== Recoupements == */

export function reconnaitreLeFournisseur(texte: string): string | undefined {
  const plie = fold(texte);
  let meilleur: { id: string; score: number } | null = null;
  for (const fournisseur of FOURNISSEURS) {
    let score = 0;
    for (const indice of fournisseur.indices) {
      score += plie.split(fold(indice)).length - 1;
    }
    // Hotels.com et Expedia se citent l'un l'autre : le nom exact l'emporte.
    if (score > 0 && (!meilleur || score > meilleur.score)) meilleur = { id: fournisseur.id, score };
  }
  return meilleur?.id;
}

function devinerLeType(texte: string): TypeDeReservation {
  const plie = fold(texte);
  const compter = (mots: string[]) => mots.reduce((total, mot) => total + (plie.split(mot).length - 1), 0);
  const scores: [TypeDeReservation, number][] = [
    ['hebergement', compter(['hotel', 'nuit', 'night', 'check-in', 'check in', 'arrivee', 'chambre', 'room', 'logement'])],
    ['activite', compter(['visite', 'excursion', 'billet', 'ticket', 'tour', 'activite', 'activity', 'guide', 'voucher'])],
    ['transport', compter(['vol ', 'flight', 'train', 'embarquement', 'boarding', 'aeroport', 'airport', 'gare '])],
    ['restaurant', compter(['restaurant', 'table pour', 'table for', 'couverts'])],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0]![1] > 0 ? scores[0]![0] : 'autre';
}

function nettoyer(brouillon: Partial<DonneesDeReservation>): void {
  if (brouillon.titre) brouillon.titre = brouillon.titre.replace(/\s+/gu, ' ').trim().slice(0, 200);
  if (brouillon.adresse) brouillon.adresse = brouillon.adresse.replace(/\s+/gu, ' ').trim().slice(0, 300);
  if (brouillon.reference && brouillon.reference.length > 80) delete brouillon.reference;
  if (brouillon.lien && (!/^https:\/\//u.test(brouillon.lien) || brouillon.lien.length > 2000)) delete brouillon.lien;
  if (brouillon.finLe && brouillon.debutLe && brouillon.finLe < brouillon.debutLe) {
    delete brouillon.finLe;
    delete brouillon.finA;
  }
  if (brouillon.devise && !/^[A-Z]{3}$/u.test(brouillon.devise)) delete brouillon.devise;
  for (const cle of ['lat', 'lng'] as const) {
    const valeur = brouillon[cle];
    if (valeur !== undefined && valeur !== null && !Number.isFinite(valeur)) delete brouillon[cle];
  }
}
