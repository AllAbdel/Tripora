import { lireLeTicket, type LectureDuTicket } from '@tripora/core';

/**
 * Scanner un ticket de caisse, sur l'appareil.
 *
 * La photo ne quitte jamais le téléphone : la reconnaissance de caractères
 * (Tesseract, en WebAssembly) tourne dans un ouvrier du navigateur, et seul le
 * texte obtenu est lu, par `lireLeTicket` (core). Le moteur et le modèle
 * français sont servis par Tripora (voir `lectureDesTickets` dans
 * vite.config.ts) et téléchargés au premier ticket seulement — quelques
 * mégaoctets, gardés ensuite pour les suivants et pour le hors-ligne.
 */

export type EtapeDeLecture = 'preparation' | 'lecture';

/** Au-delà, une photo de téléphone ralentit la lecture sans la rendre plus juste. */
const COTE_MAX = 2000;

/**
 * Prépare la photo : redressée selon l'orientation enregistrée par le
 * téléphone (sans quoi un ticket photographié en portrait arrive couché),
 * convertie en PNG quel que soit le format d'origine (HEIC, WebP…), et
 * réduite — une photo de 12 mégapixels se lit lentement, et pas mieux : le
 * texte d'un ticket reste net bien en dessous de 2 000 pixels.
 */
async function preparer(image: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return image;
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  const echelle = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
  const toile = new OffscreenCanvas(Math.round(bitmap.width * echelle), Math.round(bitmap.height * echelle));
  toile.getContext('2d')?.drawImage(bitmap, 0, 0, toile.width, toile.height);
  bitmap.close();
  return toile.convertToBlob({ type: 'image/png' });
}

export async function lireUnePhotoDeTicket(
  photo: Blob,
  surEtape: (etape: EtapeDeLecture, progression: number) => void = () => undefined,
): Promise<LectureDuTicket & { texte: string }> {
  surEtape('preparation', 0);
  const [{ createWorker, OEM }, image] = await Promise.all([import('tesseract.js'), preparer(photo)]);
  const ouvrier = await createWorker('fra', OEM.LSTM_ONLY, {
    workerPath: `${__DOSSIER_OCR__}worker.min.js`,
    corePath: __DOSSIER_OCR__,
    langPath: __DOSSIER_OCR__.replace(/\/$/u, ''),
    // Un ouvrier chargé depuis son fichier, pas depuis un blob fabriqué à la
    // volée : c'est ce que la CSP attend d'un script.
    workerBlobURL: false,
    logger: (message) => {
      if (message.status === 'recognizing text') surEtape('lecture', message.progress);
      else surEtape('preparation', message.progress);
    },
  });
  try {
    const { data } = await ouvrier.recognize(image);
    return { ...lireLeTicket(data.text), texte: data.text };
  } finally {
    await ouvrier.terminate();
  }
}

/** « 11,57 », tel que le champ du montant l'attend. */
export function montantSaisi(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * La date lue n'est retenue que si elle est plausible pour une dépense de ce
 * voyage : ni dans le futur, ni plus vieille d'un an. Un « 01/02/03 » mal lu
 * ne doit pas ranger le dîner d'hier en 2003.
 */
export function datePlausible(date: string | null, aujourdhui: string): string | null {
  if (!date || date > aujourdhui) return null;
  const ilYaUnAn = `${Number(aujourdhui.slice(0, 4)) - 1}${aujourdhui.slice(4)}`;
  return date >= ilYaUnAn ? date : null;
}
