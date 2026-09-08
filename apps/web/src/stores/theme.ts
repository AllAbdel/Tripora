import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NUANCES, paletteDepuis, texteSur } from '@tripora/core';

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Ce que l'application renvoie quand on la touche.
 *
 * Par défaut les vibrations seules : un retour qu'on sent sans déranger
 * personne. Le son reste à demander explicitement — une application qui se met
 * à faire du bruit dans un train sans prévenir se fait couper le son une fois
 * et pour toujours.
 */
export type Retours = 'silencieux' | 'vibrations' | 'complet';

/** La couleur d'origine, tirée de l'icône. Le repère quand on veut revenir. */
export const ACCENT_PAR_DEFAUT = '#0a84ff';

interface ThemeState {
  preference: ThemePreference;
  accent: string;
  retours: Retours;
  setPreference: (value: ThemePreference) => void;
  setAccent: (couleur: string) => void;
  setRetours: (value: Retours) => void;
}

/** Applique la classe `dark` sur <html> selon la préférence et le système. */
export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const prefersDark =
    preference === 'dark' ||
    (preference === 'system' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches === true);
  document.documentElement.classList.toggle('dark', prefersDark);
}

/**
 * Écrit la palette choisie dans les variables CSS de Tailwind.
 *
 * Tailwind 4 génère `bg-brand-500` comme `var(--color-brand-500)` : redéfinir
 * ces dix variables sur `<html>` suffit à recolorer toute l'application, sans
 * qu'aucun composant ait à connaître la couleur en cours. Une couleur illisible
 * ne touche à rien — on garde celle d'avant plutôt que d'afficher du gris.
 */
export function applyAccent(couleur: string): void {
  if (typeof document === 'undefined') return;
  const palette = paletteDepuis(couleur);
  if (!palette) return;

  const racine = document.documentElement.style;
  for (const nuance of NUANCES) racine.setProperty(`--color-brand-${nuance}`, palette[nuance]);
  // Le texte posé sur la couleur principale : calculé, jamais supposé blanc.
  racine.setProperty('--accent-contrast', texteSur(palette[500]));
  racine.setProperty('--shadow-float', `0 8px 32px -8px ${palette[500]}73`);

  // La barre système du téléphone suit la teinte, sinon l'application installée
  // garde un liseré bleu autour d'une interface devenue verte. Seule la
  // déclaration claire change : en sombre, la barre reste la couleur du fond.
  document
    .querySelector('meta[name="theme-color"][media*="light"]')
    ?.setAttribute('content', palette[500]);
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      accent: ACCENT_PAR_DEFAUT,
      retours: 'vibrations',
      setPreference: (value) => {
        applyTheme(value);
        set({ preference: value });
      },
      setAccent: (couleur) => {
        if (!paletteDepuis(couleur)) return;
        applyAccent(couleur);
        set({ accent: couleur });
      },
      setRetours: (value) => set({ retours: value }),
    }),
    {
      name: 'tripora.theme',
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.preference ?? 'system');
        applyAccent(state?.accent ?? ACCENT_PAR_DEFAUT);
      },
    },
  ),
);

/** Suit les changements de thème du système quand l'utilisateur n'a rien forcé. */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (useTheme.getState().preference === 'system') applyTheme('system');
  };
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}
