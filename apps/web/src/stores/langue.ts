import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  estUneLangue,
  ficheDe,
  LANGUE_PAR_DEFAUT,
  langueDuSysteme,
  type Langue,
} from '@/i18n/langues';

/**
 * La langue choisie, ou celle du système.
 *
 * `'systeme'` n'est pas une langue : c'est l'absence de choix, et c'est le
 * défaut. La distinction compte — quelqu'un qui n'a rien réglé et qui change
 * la langue de son téléphone doit voir Tripora suivre, alors que quelqu'un qui
 * a explicitement choisi le français à Berlin doit garder le français.
 */
export type PreferenceDeLangue = 'systeme' | Langue;

interface EtatDeLangue {
  preference: PreferenceDeLangue;
  setPreference: (valeur: PreferenceDeLangue) => void;
}

/** Ce que le navigateur annonce, dans l'ordre où il l'annonce. */
function annoncees(): string[] {
  if (typeof navigator === 'undefined') return [];
  return [...(navigator.languages ?? []), navigator.language].filter(Boolean) as string[];
}

export function resoudre(preference: PreferenceDeLangue): Langue {
  return preference === 'systeme' ? langueDuSysteme(annoncees()) : preference;
}

/**
 * Pose la langue et le sens de lecture sur `<html>`.
 *
 * `lang` sert aux lecteurs d'écran, qui changent de voix, et à la césure. `dir`
 * retourne toute la mise en page pour l'arabe — ce qui ne marche que parce que
 * l'application est écrite en propriétés logiques (`ps-`, `start-`, `-ms-`)
 * depuis le début, et non en `left` et `right`.
 */
export function appliquerLaLangue(preference: PreferenceDeLangue): void {
  if (typeof document === 'undefined') return;
  const langue = resoudre(preference);
  const fiche = ficheDe(langue);
  document.documentElement.lang = langue;
  document.documentElement.dir = fiche.sens;
}

export const useLangue = create<EtatDeLangue>()(
  persist(
    (set) => ({
      preference: 'systeme',
      setPreference: (valeur) => {
        appliquerLaLangue(valeur);
        set({ preference: valeur });
      },
    }),
    {
      name: 'tripora.langue',
      onRehydrateStorage: () => (etat) => {
        // Le réglage enregistré doit reprendre la main dès le premier rendu :
        // sans ça, l'arabe s'afficherait de gauche à droite le temps d'un
        // battement, et la page sauterait.
        appliquerLaLangue(etat?.preference ?? 'systeme');
      },
      merge: (persiste, courant) => {
        const lu = (persiste as Partial<EtatDeLangue> | undefined)?.preference;
        return {
          ...courant,
          preference: lu === 'systeme' || estUneLangue(lu) ? lu : 'systeme',
        };
      },
    },
  ),
);

/** La langue effective, prête à l'emploi. */
export function useLangueActive(): Langue {
  const preference = useLangue((etat) => etat.preference);
  return resoudre(preference);
}

export { LANGUE_PAR_DEFAUT };
