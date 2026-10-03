import { Fragment, type ReactNode } from 'react';
import { useRegion } from '@/stores/region';

/**
 * Les chiffres sont écrits au rendu, d'après les réglages régionaux : quand
 * ils changent (dans le profil, ou à l'arrivée du taux du jour), l'interface
 * est redessinée en entier plutôt que composant par composant.
 */
export function SuitLaRegion({ children }: { children: ReactNode }) {
  const version = useRegion((etat) => etat.version);
  return <Fragment key={version}>{children}</Fragment>;
}
