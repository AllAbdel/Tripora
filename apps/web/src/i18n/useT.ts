import { useCallback } from 'react';
import { traduire, type CleDeTexte } from './textes';
import { useLangueActive } from '@/stores/langue';
import { etiquetteIntl } from './langues';

/**
 * Le traducteur de l'écran courant.
 *
 *   const t = useT();
 *   <h1>{t('trips.titre')}</h1>
 *
 * Volontairement minimal : pas d'interpolation, pas de pluriel automatique.
 * Une bibliothèque complète coûterait quarante kilo-octets pour résoudre des
 * problèmes que Tripora n'a pas encore — et le jour où il les aura, ce sera
 * une décision, pas une dépendance héritée.
 */
export function useT(): (cle: CleDeTexte) => string {
  const langue = useLangueActive();
  return useCallback((cle: CleDeTexte) => traduire(langue, cle), [langue]);
}

/**
 * L'étiquette à donner à `Intl`, pour les dates et les nombres.
 *
 * Elle suit la langue choisie et non celle du système : quelqu'un qui met
 * Tripora en anglais à Paris s'attend à lire « September 22 », pas
 * « 22 septembre ».
 */
export function useEtiquetteIntl(): string {
  return etiquetteIntl(useLangueActive());
}
