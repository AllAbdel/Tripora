import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Les passeports de la personne (codes ISO à deux lettres).
 *
 * Sans eux, les formalités d'entrée supposent un passeport du pays de départ :
 * un Algérien qui part de Paris recevait les réponses d'un Français. Ils sont
 * facultatifs, et restent sur l'appareil : une nationalité n'a rien à faire
 * sur un serveur pour savoir s'il faut un visa.
 *
 * Trois au plus : assez pour les doubles et triples nationalités.
 */

export const PASSEPORTS_MAX = 3;

interface EtatDesPasseports {
  passeports: string[];
  ajouter: (code: string) => void;
  retirer: (code: string) => void;
}

export const usePasseports = create<EtatDesPasseports>()(
  persist(
    (set) => ({
      passeports: [],
      ajouter: (code) =>
        set((etat) => {
          const propre = code.trim().toUpperCase();
          if (!/^[A-Z]{2}$/u.test(propre) || etat.passeports.includes(propre)) return etat;
          if (etat.passeports.length >= PASSEPORTS_MAX) return etat;
          return { passeports: [...etat.passeports, propre] };
        }),
      retirer: (code) => set((etat) => ({ passeports: etat.passeports.filter((p) => p !== code) })),
    }),
    {
      name: 'tripora.passeports',
      partialize: (etat) => ({ passeports: etat.passeports }),
    },
  ),
);

/** Le nom d'un pays dans la langue de l'interface (« Algérie »), le code à défaut. */
export function nomDuPays(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
