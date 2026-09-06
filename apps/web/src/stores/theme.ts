import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
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

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (value) => {
        applyTheme(value);
        set({ preference: value });
      },
    }),
    {
      name: 'tripora.theme',
      onRehydrateStorage: () => (state) => applyTheme(state?.preference ?? 'system'),
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
