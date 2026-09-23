/**
 * Le programme du voyage, dans le calendrier de chacun.
 *
 * Un fichier iCalendar (RFC 5545) : le format que lisent Google Agenda,
 * Calendrier d'Apple et Outlook, sans compte ni autorisation. On le
 * télécharge, le téléphone propose d'ajouter les événements, et le jour J
 * l'alarme du kecak sonne à l'heure — sans ouvrir Tripora.
 *
 * **Les heures sont celles de la destination.** Un spectacle à 18 h à Bali
 * est à 18 h heure de Bali, qu'on regarde son calendrier à Paris avant de
 * partir ou à Ubud le jour même. Pour cela chaque heure porte le fuseau de la
 * destination, et le fichier contient la définition de ce fuseau pour la
 * durée du séjour : un calendrier ne sait pas forcément ce qu'est
 * « Asia/Makassar », il sait lire un décalage.
 *
 * Sans fuseau connu, les heures restent « flottantes » : 9 h où que l'on
 * soit, ce qui est encore la meilleure approximation pour un programme de
 * vacances.
 */

export interface EvenementDuProgramme {
  /** Identifiant stable : réimporter le fichier met à jour au lieu de doubler. */
  id: string;
  titre: string;
  /** « 2026-07-10 ». */
  date: string;
  /** « 09:30 », ou rien pour une journée entière. */
  debut?: string | null;
  fin?: string | null;
  description?: string | null;
}

export interface CalendrierDuVoyage {
  titre: string;
  /** Fuseau IANA de la destination, « Asia/Makassar ». */
  fuseau?: string | undefined;
  evenements: readonly EvenementDuProgramme[];
  /** L'instant de l'export, pour DTSTAMP. Injecté pour que les tests soient stables. */
  maintenant: Date;
}

/** Sans heure de fin, une activité dure une heure : c'est un rappel, pas un engagement. */
const DUREE_PAR_DEFAUT_MINUTES = 60;

export function calendrierDuVoyage({
  titre,
  fuseau,
  evenements,
  maintenant,
}: CalendrierDuVoyage): string {
  const fuseauValide = fuseau && fuseauConnu(fuseau) ? fuseau : undefined;
  const lignes: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tripora//Programme du voyage//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapper(titre)}`,
  ];
  if (fuseauValide) {
    lignes.push(`X-WR-TIMEZONE:${fuseauValide}`);
    lignes.push(...definitionDuFuseau(fuseauValide, evenements.map((evenement) => evenement.date)));
  }

  const horodatage = formaterUtc(maintenant);
  for (const evenement of evenements) {
    if (!DATE.test(evenement.date)) continue;
    lignes.push('BEGIN:VEVENT');
    lignes.push(`UID:${echapper(evenement.id)}@tripora`);
    lignes.push(`DTSTAMP:${horodatage}`);
    lignes.push(`SUMMARY:${echapper(evenement.titre)}`);

    const debut = lireHeure(evenement.debut);
    if (debut === null) {
      // Une journée entière : la date de fin est exclusive en iCalendar.
      lignes.push(`DTSTART;VALUE=DATE:${compacter(evenement.date)}`);
      lignes.push(`DTEND;VALUE=DATE:${compacter(lendemain(evenement.date))}`);
    } else {
      const finLue = lireHeure(evenement.fin);
      const fin = finLue !== null && finLue > debut ? finLue : debut + DUREE_PAR_DEFAUT_MINUTES;
      lignes.push(dateHeure('DTSTART', evenement.date, debut, fuseauValide));
      lignes.push(dateHeure('DTEND', evenement.date, fin, fuseauValide));
    }
    if (evenement.description) lignes.push(`DESCRIPTION:${echapper(evenement.description)}`);
    lignes.push('END:VEVENT');
  }

  lignes.push('END:VCALENDAR');
  return lignes.map(plier).join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ Dates -- */

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** « 09:30 » en minutes depuis minuit, ou `null` si ce n'est pas une heure. */
function lireHeure(heure: string | null | undefined): number | null {
  const lue = /^(\d{1,2}):(\d{2})/u.exec(heure ?? '');
  if (!lue) return null;
  const heures = Number(lue[1]);
  const minutes = Number(lue[2]);
  if (heures > 23 || minutes > 59) return null;
  return heures * 60 + minutes;
}

function compacter(date: string): string {
  return date.replaceAll('-', '');
}

function lendemain(date: string): string {
  const jour = new Date(`${date}T00:00:00Z`);
  jour.setUTCDate(jour.getUTCDate() + 1);
  return jour.toISOString().slice(0, 10);
}

function deuxChiffres(nombre: number): string {
  return String(nombre).padStart(2, '0');
}

/**
 * Une heure qui déborde minuit — un bar qui ferme à 1 h — passe au lendemain.
 */
function dateHeure(champ: string, date: string, minutes: number, fuseau: string | undefined): string {
  const jour = minutes >= 24 * 60 ? lendemain(date) : date;
  const reste = minutes % (24 * 60);
  const valeur = `${compacter(jour)}T${deuxChiffres(Math.floor(reste / 60))}${deuxChiffres(reste % 60)}00`;
  return fuseau ? `${champ};TZID=${fuseau}:${valeur}` : `${champ}:${valeur}`;
}

function formaterUtc(instant: Date): string {
  return instant.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}/u, '');
}

/* ----------------------------------------------------------------- Fuseau -- */

function fuseauConnu(fuseau: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: fuseau });
    return true;
  } catch {
    return false;
  }
}

/**
 * Le décalage du fuseau par rapport à UTC, en minutes, à midi du jour donné.
 *
 * Midi plutôt que minuit : les changements d'heure se font la nuit, et midi
 * tombe toujours du bon côté.
 */
export function decalageDuFuseau(fuseau: string, date: string): number {
  const midi = new Date(`${date}T12:00:00Z`);
  const morceaux = new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(midi);
  const valeur = (type: string): number => Number(morceaux.find((m) => m.type === type)?.value);
  const local = Date.UTC(
    valeur('year'),
    valeur('month') - 1,
    valeur('day'),
    valeur('hour'),
    valeur('minute'),
  );
  return Math.round((local - midi.getTime()) / 60_000);
}

function formaterDecalage(minutes: number): string {
  const signe = minutes < 0 ? '-' : '+';
  const absolu = Math.abs(minutes);
  return `${signe}${deuxChiffres(Math.floor(absolu / 60))}${deuxChiffres(absolu % 60)}`;
}

/**
 * La définition du fuseau, limitée à la durée du séjour.
 *
 * On ne recopie pas toute l'histoire du fuseau : seulement les décalages
 * rencontrés entre le premier et le dernier jour, chacun à partir du jour où
 * il s'applique. Un séjour de dix jours à Bali n'en a qu'un ; une semaine à
 * Lisbonne fin octobre en a deux, et l'heure du dernier dîner reste juste.
 */
function definitionDuFuseau(fuseau: string, dates: readonly string[]): string[] {
  const valides = [...new Set(dates.filter((date) => DATE.test(date)))].sort();
  if (valides.length === 0) return [];

  const periodes: { depuis: string; decalage: number }[] = [];
  let jour = valides[0]!;
  const dernier = valides[valides.length - 1]!;
  let precedent: number | null = null;
  // Jour par jour du premier au dernier : une transition entre deux dates
  // du programme ne doit pas passer inaperçue.
  for (let garde = 0; jour <= dernier && garde < 400; garde += 1) {
    const decalage = decalageDuFuseau(fuseau, jour);
    if (decalage !== precedent) periodes.push({ depuis: jour, decalage });
    precedent = decalage;
    jour = lendemain(jour);
  }

  const lignes = ['BEGIN:VTIMEZONE', `TZID:${fuseau}`];
  periodes.forEach((periode, index) => {
    const avant = index === 0 ? periode.decalage : periodes[index - 1]!.decalage;
    lignes.push(
      'BEGIN:STANDARD',
      `DTSTART:${compacter(periode.depuis)}T000000`,
      `TZOFFSETFROM:${formaterDecalage(avant)}`,
      `TZOFFSETTO:${formaterDecalage(periode.decalage)}`,
      'END:STANDARD',
    );
  });
  lignes.push('END:VTIMEZONE');
  return lignes;
}

/* ----------------------------------------------------------------- Texte -- */

/** Les quatre caractères que le format réserve, et les retours à la ligne. */
export function echapper(texte: string): string {
  return texte
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/gu, '\\n');
}

/**
 * Pas plus de 75 octets par ligne, les suivantes commencent par une espace.
 *
 * En octets, pas en caractères : « é » en vaut deux, et un calendrier strict
 * rejette une ligne trop longue. On ne coupe jamais au milieu d'un caractère.
 */
export function plier(ligne: string): string {
  const encodeur = new TextEncoder();
  if (encodeur.encode(ligne).length <= 75) return ligne;

  const morceaux: string[] = [];
  let courant = '';
  let taille = 0;
  for (const caractere of ligne) {
    const poids = encodeur.encode(caractere).length;
    // La première ligne tient 75 octets ; les suivantes 74, après l'espace.
    const limite = morceaux.length === 0 ? 75 : 74;
    if (taille + poids > limite) {
      morceaux.push(courant);
      courant = '';
      taille = 0;
    }
    courant += caractere;
    taille += poids;
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}
