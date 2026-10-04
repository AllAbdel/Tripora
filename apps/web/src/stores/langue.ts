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

/**
 * Les robots des moteurs de recherche et des aperçus de lien. Ils n'ont pas de
 * langue à eux — Googlebot rend les pages en « en-US » — : sans ce garde-fou,
 * l'accueil serait indexé en anglais et en dollars, puis proposé ainsi à des
 * Français. Ils lisent donc la langue de référence ; chaque autre version a sa
 * propre adresse (`?langue=en`), annoncée par le plan du site.
 */
const ROBOTS =
  /googlebot|google-inspectiontool|storebot-google|adsbot-google|bingbot|bingpreview|yandex|baiduspider|duckduckbot|applebot|slurp|qwantbot|petalbot|seznambot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp/iu;

export function estUnRobot(agent = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return ROBOTS.test(agent);
}

/** Ce que le navigateur annonce, dans l'ordre où il l'annonce ; rien pour un robot. */
export function languesAnnoncees(): string[] {
  if (typeof navigator === 'undefined' || estUnRobot()) return [];
  return [...(navigator.languages ?? []), navigator.language].filter(Boolean) as string[];
}

/**
 * La langue que demande l'adresse (`?langue=en`) : un résultat de recherche ou
 * un lien partagé dans une langue précise. Lue une fois, au chargement : le
 * paramètre disparaît à la première navigation, la langue reste.
 */
export function langueDeLAdresse(recherche = typeof location === 'undefined' ? '' : location.search): Langue | null {
  const demandee = new URLSearchParams(recherche).get('langue');
  return estUneLangue(demandee) ? demandee : null;
}

const LANGUE_DEMANDEE = langueDeLAdresse();

/** Un choix fait dans le profil l'emporte ; sinon l'adresse, sinon le système. */
export function resoudre(preference: PreferenceDeLangue, demandee: Langue | null = LANGUE_DEMANDEE): Langue {
  if (preference !== 'systeme') return preference;
  return demandee ?? langueDuSysteme(languesAnnoncees());
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
  // Pour le service worker, qui affiche les notifications sans accès aux
  // réglages : il lit la langue dans ce cache (public/sw-alertes.js).
  if (typeof caches !== 'undefined') {
    void caches
      .open('tripora-reglages')
      .then((cache) => cache.put('/langue', new Response(langue)))
      .catch(() => {});
  }
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
