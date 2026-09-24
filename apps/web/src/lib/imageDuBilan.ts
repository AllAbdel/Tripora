/**
 * Le bilan d'un voyage en une image, au format des stories (1080 × 1920).
 *
 * C'est ce qu'on poste en rentrant, et ce que les autres voient de Tripora
 * sans l'avoir installé : la photo de la ville, trois grands chiffres, deux ou
 * trois phrases, et le nom de l'application en bas. Dessinée dans le
 * navigateur (canvas), sans bibliothèque ni serveur : rien ne quitte
 * l'appareil tant que la personne ne choisit pas de partager.
 *
 * La photo vient de Wikimedia Commons : son auteur et sa licence sont écrits
 * sur l'image, comme la licence le demande. Si le navigateur refuse de
 * l'exporter (serveur sans autorisation de partage), l'image se dessine sans
 * elle plutôt que de ne pas se dessiner du tout.
 */

export interface ContenuDuBilan {
  titre: string;
  sousTitre: string;
  /** Trois au plus, affichés en grand. */
  chiffres: readonly { valeur: string; libelle: string }[];
  lignes: readonly string[];
  photo?: { url: string; credit: string | null } | null | undefined;
}

const LARGEUR = 1080;
const HAUTEUR = 1920;
const MARGE = 88;
const HAUT_DE_LA_PHOTO = 1060;

const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "'Inter Tight', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function chargerLaPhoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resoudre) => {
    const image = new Image();
    // Sans cela, la toile serait « souillée » et refuserait de s'exporter.
    image.crossOrigin = 'anonymous';
    image.onload = () => resoudre(image);
    image.onerror = () => resoudre(null);
    image.src = url;
  });
}

/** Les mots d'un texte, répartis en lignes qui tiennent dans `largeur`. */
function envelopper(contexte: CanvasRenderingContext2D, texte: string, largeur: number, maxLignes: number): string[] {
  const mots = texte.split(/\s+/u);
  const lignes: string[] = [];
  let ligne = '';
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (contexte.measureText(essai).width <= largeur || !ligne) {
      ligne = essai;
    } else {
      lignes.push(ligne);
      ligne = mot;
    }
  }
  if (ligne) lignes.push(ligne);
  if (lignes.length <= maxLignes) return lignes;
  const gardees = lignes.slice(0, maxLignes);
  gardees[maxLignes - 1] = `${gardees[maxLignes - 1]!.replace(/\s+\S*$/u, '')}…`;
  return gardees;
}

/** La plus grande taille (≤ `taille`) à laquelle le texte tient sur une ligne. */
function ajuster(contexte: CanvasRenderingContext2D, texte: string, police: (taille: number) => string, taille: number, largeur: number): number {
  let courante = taille;
  contexte.font = police(courante);
  while (courante > 40 && contexte.measureText(texte).width > largeur) {
    courante -= 4;
    contexte.font = police(courante);
  }
  return courante;
}

/**
 * Sans photo, un globe au trait en haut à droite : les méridiens et les
 * parallèles, à peine visibles. Assez pour que l'image ne soit pas un aplat,
 * pas assez pour gêner la lecture.
 */
function dessinerUnGlobe(contexte: CanvasRenderingContext2D): void {
  const cx = LARGEUR - 120;
  const cy = 260;
  const rayon = 420;
  contexte.save();
  contexte.strokeStyle = 'rgba(124,196,255,0.14)';
  contexte.lineWidth = 3;
  contexte.beginPath();
  contexte.arc(cx, cy, rayon, 0, Math.PI * 2);
  contexte.stroke();
  for (const echelle of [0.25, 0.55, 0.82]) {
    contexte.beginPath();
    contexte.ellipse(cx, cy, rayon * echelle, rayon, 0, 0, Math.PI * 2);
    contexte.stroke();
  }
  for (const hauteur of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const demiLargeur = rayon * Math.sqrt(1 - hauteur * hauteur);
    contexte.beginPath();
    contexte.ellipse(cx, cy + hauteur * rayon, demiLargeur, demiLargeur * 0.18, 0, 0, Math.PI * 2);
    contexte.stroke();
  }
  contexte.restore();
}

function dessiner(contexte: CanvasRenderingContext2D, contenu: ContenuDuBilan, photo: HTMLImageElement | null): void {
  // Le fond : la nuit bleue de l'icône de Tripora.
  const fond = contexte.createLinearGradient(0, 0, 0, HAUTEUR);
  fond.addColorStop(0, '#16325c');
  fond.addColorStop(1, '#0b1220');
  contexte.fillStyle = fond;
  contexte.fillRect(0, 0, LARGEUR, HAUTEUR);

  if (photo) {
    // Recadrée pour remplir le haut, sans déformer.
    const echelle = Math.max(LARGEUR / photo.width, HAUT_DE_LA_PHOTO / photo.height);
    const l = photo.width * echelle;
    const h = photo.height * echelle;
    contexte.drawImage(photo, (LARGEUR - l) / 2, (HAUT_DE_LA_PHOTO - h) / 2, l, h);
    // Fondue dans le bleu : le titre se pose dessus sans perdre en contraste.
    const fondu = contexte.createLinearGradient(0, HAUT_DE_LA_PHOTO * 0.45, 0, HAUT_DE_LA_PHOTO);
    fondu.addColorStop(0, 'rgba(11,18,32,0)');
    fondu.addColorStop(1, 'rgba(15,33,64,1)');
    contexte.fillStyle = fondu;
    contexte.fillRect(0, 0, LARGEUR, HAUT_DE_LA_PHOTO);
    if (contenu.photo?.credit) {
      contexte.font = `400 24px ${SANS}`;
      contexte.fillStyle = 'rgba(255,255,255,0.55)';
      contexte.textAlign = 'right';
      contexte.fillText(`Photo : ${contenu.photo.credit}`.slice(0, 90), LARGEUR - 32, 52);
      contexte.textAlign = 'left';
    }
  }

  if (!photo) dessinerUnGlobe(contexte);

  // Sans photo, le bloc de texte se centre dans la hauteur, au lieu de
  // laisser un grand vide sous lui.
  const nombreDeLignes = Math.min(4, contenu.lignes.length);
  const hauteurDuBloc = 72 + 150 + 170 + nombreDeLignes * 76;
  let y = photo ? HAUT_DE_LA_PHOTO - 150 : Math.max(380, (HAUTEUR - 220 - hauteurDuBloc) / 2 + 60);
  contexte.fillStyle = '#ffffff';
  contexte.textBaseline = 'alphabetic';
  const tailleDuTitre = ajuster(contexte, contenu.titre, (taille) => `700 ${taille}px ${SERIF}`, 136, LARGEUR - 2 * MARGE);
  contexte.font = `700 ${tailleDuTitre}px ${SERIF}`;
  contexte.fillText(contenu.titre, MARGE, y);
  y += 72;
  contexte.font = `500 42px ${SANS}`;
  contexte.fillStyle = 'rgba(255,255,255,0.78)';
  contexte.fillText(contenu.sousTitre, MARGE, y);

  // Les grands chiffres, en colonnes.
  y += 150;
  const chiffres = contenu.chiffres.slice(0, 3);
  const colonne = (LARGEUR - 2 * MARGE) / Math.max(1, chiffres.length);
  chiffres.forEach((chiffre, index) => {
    const x = MARGE + index * colonne;
    contexte.fillStyle = '#ffffff';
    // De l'air entre les colonnes : « 24 745 » ne doit pas toucher le chiffre voisin.
    const taille = ajuster(contexte, chiffre.valeur, (t) => `700 ${t}px ${SERIF}`, 104, colonne - 56);
    contexte.font = `700 ${taille}px ${SERIF}`;
    contexte.fillText(chiffre.valeur, x, y);
    contexte.font = `500 36px ${SANS}`;
    contexte.fillStyle = '#7cc4ff';
    contexte.fillText(chiffre.libelle, x, y + 52);
  });

  // Les phrases.
  y += 170;
  contexte.font = `400 40px ${SANS}`;
  for (const texte of contenu.lignes.slice(0, 4)) {
    const lignes = envelopper(contexte, texte, LARGEUR - 2 * MARGE - 36, 2);
    contexte.fillStyle = '#f5b301';
    contexte.beginPath();
    contexte.arc(MARGE + 8, y - 13, 8, 0, Math.PI * 2);
    contexte.fill();
    contexte.fillStyle = 'rgba(255,255,255,0.92)';
    for (const ligne of lignes) {
      contexte.fillText(ligne, MARGE + 36, y);
      y += 54;
    }
    y += 22;
    if (y > HAUTEUR - 220) break;
  }

  // La signature.
  contexte.fillStyle = 'rgba(255,255,255,0.18)';
  contexte.fillRect(MARGE, HAUTEUR - 170, LARGEUR - 2 * MARGE, 2);
  contexte.font = `700 44px ${SERIF}`;
  contexte.fillStyle = '#ffffff';
  contexte.fillText('Tripora', MARGE, HAUTEUR - 96);
  contexte.font = `400 32px ${SANS}`;
  contexte.fillStyle = 'rgba(255,255,255,0.7)';
  contexte.textAlign = 'right';
  contexte.fillText('Le voyage à plusieurs, sans prise de tête', LARGEUR - MARGE, HAUTEUR - 98);
  contexte.textAlign = 'left';
}

function exporter(toile: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resoudre, rejeter) => {
    try {
      toile.toBlob((blob) => (blob ? resoudre(blob) : rejeter(new Error('Image vide'))), 'image/png');
    } catch (erreur) {
      rejeter(erreur instanceof Error ? erreur : new Error(String(erreur)));
    }
  });
}

export async function dessinerLeBilan(contenu: ContenuDuBilan): Promise<Blob> {
  // Les polices de l'application, pour que l'image lui ressemble. Absentes,
  // la toile prend celles du système : l'image reste lisible.
  try {
    await Promise.all([document.fonts.load(`700 120px ${SERIF}`), document.fonts.load(`500 40px ${SANS}`)]);
  } catch {
    // Pas de gestionnaire de polices : tant pis pour la ressemblance.
  }

  const toile = document.createElement('canvas');
  toile.width = LARGEUR;
  toile.height = HAUTEUR;
  const contexte = toile.getContext('2d');
  if (!contexte) throw new Error('Dessin impossible sur cet appareil');

  const photo = contenu.photo?.url ? await chargerLaPhoto(contenu.photo.url) : null;
  dessiner(contexte, contenu, photo);
  try {
    return await exporter(toile);
  } catch {
    // Photo refusée à l'export : on recommence sans elle.
    dessiner(contexte, { ...contenu, photo: null }, null);
    return exporter(toile);
  }
}
