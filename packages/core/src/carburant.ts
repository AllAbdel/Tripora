import { CARBURANT_DU_MONDE, RELEVE_DU_CARBURANT } from './carburant-du-monde.js';

/**
 * Ce que coûte un kilomètre en voiture, au prix du carburant du pays.
 *
 * Les prix viennent d'OpenVan (CC BY 4.0), relevés par `scripts/carburant.py`
 * et embarqués : aucun appel, fonctionne hors ligne. Toute estimation qui s'en
 * sert doit afficher « Data: OpenVan.camp » (`MENTION_OPENVAN`).
 *
 * Le calcul reste une estimation, et se dit comme telle :
 *  - une voiture moyenne consomme 6,5 litres aux 100 km sur route ;
 *  - le prix retenu est la moyenne de l'essence au départ et à l'arrivée :
 *    on fait le plein des deux côtés ;
 *  - les péages, qu'aucune source gratuite ne donne pays par pays, restent un
 *    forfait de 3 centimes du kilomètre ;
 *  - un pays absent du relevé garde l'ancien forfait, 14 centimes du
 *    kilomètre carburant et péages compris, plutôt qu'un prix deviné.
 */

export { RELEVE_DU_CARBURANT };

/** L'attribution qu'exige la licence d'OpenVan, à côté de toute estimation. */
export const MENTION_OPENVAN = 'Data: OpenVan.camp';
export const LIEN_OPENVAN = 'https://openvan.camp/';

const LITRES_AUX_100_KM = 6.5;
const PEAGES_PAR_KM_CENTIMES = 3;
/** L'ancien forfait, carburant et péages compris, quand on ne sait rien. */
export const FORFAIT_VOITURE_PAR_KM_CENTIMES = 14;

export interface PrixDuCarburant {
  /** Centimes d'euro par litre de sans-plomb, ou `null` s'il manque. */
  essence: number | null;
  gazole: number | null;
}

export function prixDuCarburant(codePays: string | null | undefined): PrixDuCarburant | undefined {
  const ligne = codePays ? CARBURANT_DU_MONDE[codePays.toUpperCase()] : undefined;
  if (!ligne) return undefined;
  return { essence: ligne[0], gazole: ligne[1] };
}

/** Le litre retenu pour un pays : l'essence, sinon le gazole. */
function litre(codePays: string | null | undefined): number | undefined {
  const prix = prixDuCarburant(codePays);
  return prix?.essence ?? prix?.gazole ?? undefined;
}

export interface CoutAuKilometre {
  /** Centimes d'euro par kilomètre et par véhicule, carburant et péages. */
  centimes: number;
  /** Vrai quand le prix vient du relevé d'OpenVan (et appelle la mention). */
  releve: boolean;
}

/**
 * Le coût d'un kilomètre pour une voiture qui va d'un pays à un autre. Un seul
 * pays connu suffit : on fait alors le plein de ce côté.
 */
export function coutVoitureAuKm(
  depart: string | null | undefined,
  arrivee: string | null | undefined,
): CoutAuKilometre {
  const connus = [litre(depart), litre(arrivee)].filter((prix): prix is number => prix !== undefined);
  if (connus.length === 0) return { centimes: FORFAIT_VOITURE_PAR_KM_CENTIMES, releve: false };
  const moyen = connus.reduce((somme, prix) => somme + prix, 0) / connus.length;
  return { centimes: (moyen * LITRES_AUX_100_KM) / 100 + PEAGES_PAR_KM_CENTIMES, releve: true };
}
