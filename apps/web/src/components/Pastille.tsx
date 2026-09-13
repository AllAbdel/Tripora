import {
  BedDouble,
  CalendarDays,
  CheckSquare,
  CloudSun,
  Coins,
  Backpack,
  FileText,
  Home,
  Luggage,
  Map as MapIcon,
  MessagesSquare,
  Plane,
  Plus,
  Smartphone,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Les pastilles colorées de la planche d'icônes.
 *
 * Chaque fonction de Tripora a sa teinte et son pictogramme, relevés sur la
 * planche fournie plutôt que réinventés : c'est ce qui fait qu'on reconnaît
 * « Dépenses » avant d'avoir lu le mot. Le nom, lui, reste toujours écrit à
 * côté — une couleur seule n'est pas une information accessible, et la même
 * teinte sert deux fois dans la planche.
 *
 * Ce sont des pictogrammes dessinés, jamais des émojis : un émoji change de
 * forme selon l'appareil, ignore la couleur demandée et ne suit pas la taille.
 */

export type NomDePastille =
  | 'accueil'
  | 'voyages'
  | 'creer'
  | 'carte'
  | 'itineraire'
  | 'participants'
  | 'votes'
  | 'depenses'
  | 'hebergements'
  | 'transport'
  | 'meteo'
  | 'profil'
  | 'discussion'
  | 'valise'
  | 'recapitulatif'
  | 'applications';

interface Pastille {
  icone: LucideIcon;
  /** La teinte de la planche, relevée au pixel sur la tuile correspondante. */
  teinte: string;
}

const PASTILLES: Readonly<Record<NomDePastille, Pastille>> = {
  accueil: { icone: Home, teinte: '#2690e3' },
  voyages: { icone: Luggage, teinte: '#34be92' },
  creer: { icone: Plus, teinte: '#8668f4' },
  carte: { icone: MapIcon, teinte: '#fdaa4e' },
  itineraire: { icone: CalendarDays, teinte: '#f77572' },
  participants: { icone: Users, teinte: '#5c6bf2' },
  votes: { icone: CheckSquare, teinte: '#f16a78' },
  depenses: { icone: Coins, teinte: '#5fbe55' },
  hebergements: { icone: BedDouble, teinte: '#8d5ee9' },
  transport: { icone: Plane, teinte: '#2191e1' },
  meteo: { icone: CloudSun, teinte: '#21c0ae' },
  profil: { icone: User, teinte: '#415674' },
  // Trois fonctions que la planche ne montrait pas : on prolonge la même
  // grammaire plutôt que de les laisser en gris au milieu des autres.
  discussion: { icone: MessagesSquare, teinte: '#3aa8d8' },
  // La planche donne la valise aux voyages ; celle qu'on prépare pour soi
  // prend donc le sac à dos, sinon les deux se confondent dans la grille.
  valise: { icone: Backpack, teinte: '#e08a3c' },
  recapitulatif: { icone: FileText, teinte: '#6b7a99' },
  applications: { icone: Smartphone, teinte: '#7c6cf0' },
};

const TAILLES = {
  sm: { boite: 'size-9 rounded-xl', icone: 'size-4.5' },
  md: { boite: 'size-11 rounded-2xl', icone: 'size-5.5' },
  lg: { boite: 'size-14 rounded-2xl', icone: 'size-7' },
} as const;

/**
 * Le carré coloré et son pictogramme blanc.
 *
 * Purement décoratif : le nom de la fonction est toujours écrit à côté, donc
 * la pastille est masquée aux lecteurs d'écran plutôt que répétée.
 */
export function Pastille({
  nom,
  taille = 'md',
  className,
}: {
  nom: NomDePastille;
  taille?: keyof typeof TAILLES;
  className?: string;
}) {
  const { icone: Icone, teinte } = PASTILLES[nom];
  const mesures = TAILLES[taille];
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center', mesures.boite, className)}
      style={{
        backgroundColor: teinte,
        // L'ombre reprend la teinte : une ombre grise sous un carré coloré
        // fait sale, et la planche n'en a pas.
        boxShadow: `0 2px 8px -2px ${teinte}80`,
      }}
    >
      <Icone className={cn(mesures.icone, 'text-white')} strokeWidth={2.4} />
    </span>
  );
}
