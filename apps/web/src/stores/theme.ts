import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NUANCES, paletteDepuis, texteSur } from '@tripora/core';

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * L'habit de l'application.
 *
 * — `epure` : des gris neutres, une seule police sans empattements, ni grain
 *   ni filet appuyé. Le style par défaut : ce qui se lit sans se remarquer.
 * — `carnet` : le carnet de voyage d'origine — papier crème, encre brune,
 *   titres en Fraunces, grain léger. Gardé tel quel, au choix dans le profil.
 *
 * Les deux partagent tout le reste : composants, accent, clair ou sombre.
 * Seuls les jetons de `index.css` changent (`html[data-style]`).
 */
export type StyleVisuel = 'epure' | 'carnet';

/**
 * Ce que l'application renvoie quand on la touche.
 *
 * Par défaut les vibrations seules : un retour qu'on sent sans déranger
 * personne. Le son reste à demander explicitement — une application qui se met
 * à faire du bruit dans un train sans prévenir se fait couper le son une fois
 * et pour toujours.
 */
export type Retours = 'silencieux' | 'vibrations' | 'complet';

/**
 * La couleur d'origine, et le repère quand on veut y revenir.
 *
 * Elle était prise telle quelle sur l'icône : un bleu d'écran, très clair et
 * très saturé. Sur le papier crème de la nouvelle mise en page il criait — un
 * bleu de bouton système au milieu d'un carnet. Celui-ci est le même bleu,
 * descendu vers l'encre : plus profond, moins électrique, il se pose sur la
 * page au lieu de flotter au-dessus.
 */
export const ACCENT_PAR_DEFAUT = '#1a5fb4';

interface ThemeState {
  preference: ThemePreference;
  style: StyleVisuel;
  accent: string;
  retours: Retours;
  /**
   * Les sons discrets du guide : une note d'interface quand il apparaît,
   * montre, valide ou s'en va (le nom du champ est resté, pour garder le
   * réglage de chacun). Actifs par défaut, contrairement aux sons des
   * retours : le guide apparaît rarement. Les retours sur « Rien » les font
   * taire aussi.
   */
  bruitagesPlumio: boolean;
  setPreference: (value: ThemePreference) => void;
  setStyle: (style: StyleVisuel) => void;
  setAccent: (couleur: string) => void;
  setRetours: (value: Retours) => void;
  setBruitagesPlumio: (actifs: boolean) => void;
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
 * Pose le style sur <html>. L'épuré est aussi ce que montre la page avant
 * que le réglage soit lu : la feuille de style le prend pour défaut, et seul
 * `data-style="carnet"` la fait changer d'habit.
 */
export function applyStyle(style: StyleVisuel): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.style = style;
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
  // Le halo teinté des boutons flottants. Le carnet s'en sert ; l'épuré,
  // qui n'a pas de halo, garde sa propre ombre (`--shadow-float` dans index.css).
  racine.setProperty('--shadow-float-accent', `0 8px 32px -8px ${palette[500]}73`);

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
      style: 'epure',
      accent: ACCENT_PAR_DEFAUT,
      retours: 'vibrations',
      bruitagesPlumio: true,
      setPreference: (value) => {
        applyTheme(value);
        set({ preference: value });
      },
      setStyle: (style) => {
        applyStyle(style);
        set({ style });
      },
      setAccent: (couleur) => {
        if (!paletteDepuis(couleur)) return;
        applyAccent(couleur);
        set({ accent: couleur });
      },
      setRetours: (value) => set({ retours: value }),
      setBruitagesPlumio: (actifs) => set({ bruitagesPlumio: actifs }),
    }),
    {
      name: 'tripora.theme',
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.preference ?? 'system');
        applyStyle(state?.style ?? 'epure');
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
