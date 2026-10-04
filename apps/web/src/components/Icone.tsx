import {
  Beer,
  Droplets,
  Footprints,
  HeartPulse,
  IdCard,
  Plug,
  Shirt,
  BedDouble,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSun,
  CloudLightning,
  Drama,
  Landmark,
  Luggage,
  KeyRound,
  MapPin,
  Moon,
  Mountain,
  Plane,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Sun,
  TentTree,
  Ticket,
  TrainFront,
  TreePalm,
  UtensilsCrossed,
} from 'lucide-react';
import type { NomIcone } from '@tripora/core';
import { cn } from '@/lib/cn';

/**
 * Dessine l'icône que le noyau a nommée.
 *
 * Tripora n'affiche jamais d'émoji — un émoji change de dessin, de taille et de
 * couleur selon l'appareil, et plusieurs ne s'affichent pas du tout. Le noyau
 * nomme donc une icône, et ce tableau est le seul endroit qui décide à quoi
 * elle ressemble. Le type le rend exhaustif : ajouter un nom dans `icons.ts`
 * sans le dessiner ici ne compile pas.
 */
const TRACES: Record<NomIcone, typeof Sun> = {
  culture: Landmark,
  nature: Mountain,
  gastronomie: UtensilsCrossed,
  fete: Beer,
  detente: TreePalm,
  aventure: TentTree,
  shopping: ShoppingBag,
  insolite: Drama,

  soleil: Sun,
  eclaircies: CloudSun,
  nuages: Cloud,
  brouillard: CloudFog,
  pluie: CloudRain,
  neige: Snowflake,
  orage: CloudLightning,

  transport: TrainFront,
  hebergement: BedDouble,
  billet: Ticket,
  divers: Sparkles,
  avion: Plane,
  arrivee: KeyRound,
  depart: Luggage,
  repas: UtensilsCrossed,
  soiree: Moon,
  lieu: MapPin,

  papiers: IdCard,
  vetements: Shirt,
  chaussures: Footprints,
  toilette: Droplets,
  sante: HeartPulse,
  electronique: Plug,
};

export function Icone({
  nom,
  className,
  titre,
}: {
  nom: NomIcone;
  className?: string;
  /** Renseigné, l'icône devient une image nommée ; sinon elle est décorative. */
  titre?: string;
}) {
  const Trace = TRACES[nom];
  return (
    <Trace
      className={cn('size-4 shrink-0', className)}
      strokeWidth={1.9}
      {...(titre ? { role: 'img', 'aria-label': titre } : { 'aria-hidden': true })}
    />
  );
}
