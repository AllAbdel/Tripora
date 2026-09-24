import {
  Backpack,
  ClipboardCheck,
  FileText,
  Globe2,
  Layers,
  MessagesSquare,
  Smartphone,
  Stamp,
  Vote,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import {
  GlypheAccueil,
  GlypheCarte,
  GlypheCreer,
  GlypheDepenses,
  GlypheHebergements,
  GlypheItineraire,
  GlypheMeteo,
  GlypheParticipants,
  GlypheProfil,
  GlypheTransport,
  GlypheVoyages,
  GlypheVotes,
} from '@/components/PageGlyphs';
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
 * Douze de ces seize pastilles reprennent le tracé exact de la planche
 * (`PageGlyphs.tsx`, vectorisé au pixel) sur le dégradé exact qui les
 * accompagne. La première version recolorait des pictogrammes de bibliothèque
 * au **trait** — fins, ajourés — quand la planche montre des silhouettes
 * **pleines** sur fond dégradé : deux langages graphiques différents, qui ne
 * pouvaient pas se ressembler.
 *
 * Les quatre restantes (discussion, valise, récapitulatif, applications)
 * n'ont pas de tuile dans la planche fournie : elles gardent leurs
 * pictogrammes de bibliothèque et une teinte unie, en attendant qu'une
 * référence existe pour elles aussi. C'est un compromis assumé, pas un oubli.
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
  | 'applications'
  | 'ouvert'
  | 'passeport'
  | 'sondages'
  | 'taches'
  | 'decouvrir';

/** Un pictogramme dessiné (`PageGlyphs`) ou un pictogramme de bibliothèque. */
type IconePastille = ComponentType<SVGProps<SVGSVGElement>> | LucideIcon;

interface Pastille {
  icone: IconePastille;
  /**
   * Le dégradé de la tuile, du coin clair au coin sombre — relevé au pixel
   * sur la planche pour les douze premières, approché pour les quatre
   * dernières.
   */
  degrade: readonly [depart: string, arrivee: string];
  /** Vrai pour les pictogrammes de bibliothèque, qui restent au trait. */
  auTrait?: boolean;
}

const PASTILLES: Readonly<Record<NomDePastille, Pastille>> = {
  accueil: { icone: GlypheAccueil, degrade: ['#3ea4ed', '#0272d0'] },
  voyages: { icone: GlypheVoyages, degrade: ['#49cd9a', '#17a082'] },
  creer: { icone: GlypheCreer, degrade: ['#9f81f4', '#6448ef'] },
  carte: { icone: GlypheCarte, degrade: ['#fcbd54', '#fd8648'] },
  itineraire: { icone: GlypheItineraire, degrade: ['#fb8274', '#f15b6b'] },
  participants: { icone: GlypheParticipants, degrade: ['#6978f6', '#4553e9'] },
  votes: { icone: GlypheVotes, degrade: ['#f8787e', '#e85771'] },
  depenses: { icone: GlypheDepenses, degrade: ['#75cf61', '#46a840'] },
  hebergements: { icone: GlypheHebergements, degrade: ['#a274f0', '#7040e0'] },
  transport: { icone: GlypheTransport, degrade: ['#37a7ed', '#0272cf'] },
  meteo: { icone: GlypheMeteo, degrade: ['#33cfb7', '#0ab1a4'] },
  profil: { icone: GlypheProfil, degrade: ['#516582', '#2b3f5d'] },
  // Quatre fonctions que la planche fournie ne montrait pas : on prolonge la
  // même grammaire de couleur plutôt que de les laisser en gris au milieu des
  // autres, mais leur pictogramme reste celui d'une bibliothèque, au trait.
  discussion: { icone: MessagesSquare, degrade: ['#5cb8e4', '#3aa8d8'], auTrait: true },
  // La planche donne la valise aux voyages ; celle qu'on prépare pour soi
  // prend donc le sac à dos, sinon les deux se confondent dans la grille.
  valise: { icone: Backpack, degrade: ['#eba15c', '#e08a3c'], auTrait: true },
  recapitulatif: { icone: FileText, degrade: ['#8797ab', '#6b7a99'], auTrait: true },
  applications: { icone: Smartphone, degrade: ['#9689f5', '#7c6cf0'], auTrait: true },
  // Le trip ouvert : un globe, parce qu'on sort du cercle des amis. Il se
  // distingue volontairement des « participants », qui sont ceux du voyage.
  ouvert: { icone: Globe2, degrade: ['#37c2b1', '#1f9d95'], auTrait: true },
  // Le passeport du voyageur : un tampon, dans l'or des étoiles de l'icône.
  passeport: { icone: Stamp, degrade: ['#f5c542', '#e0a106'], auTrait: true },
  // Les sondages : l'urne, dans un rose qui ne se confond ni avec les votes
  // sur la destination (rouge corail) ni avec la discussion (bleu ciel).
  sondages: { icone: Vote, degrade: ['#f08fc0', '#d9589a'], auTrait: true },
  // Qui fait quoi : la liste cochée, dans un vert tilleul qui ne se confond
  // pas avec le vert des voyages ni celui des dépenses.
  taches: { icone: ClipboardCheck, degrade: ['#a9cf55', '#7fa82f'], auTrait: true },
  // Découvrir : un paquet de cartes, dans le dégradé chaud des écrans de
  // vidéos courtes — c'est le geste qu'il emprunte.
  decouvrir: { icone: Layers, degrade: ['#ff8a65', '#e8457a'], auTrait: true },
};

const TAILLES = {
  xs: { boite: 'size-7 rounded-lg', icone: 'size-3.5' },
  sm: { boite: 'size-9 rounded-xl', icone: 'size-4.5' },
  md: { boite: 'size-11 rounded-2xl', icone: 'size-5.5' },
  lg: { boite: 'size-14 rounded-2xl', icone: 'size-7' },
} as const;

/**
 * Le carré dégradé et son pictogramme blanc.
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
  const { icone: Icone, degrade, auTrait } = PASTILLES[nom];
  const [depart, arrivee] = degrade;
  const mesures = TAILLES[taille];
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center', mesures.boite, className)}
      style={{
        backgroundImage: `linear-gradient(135deg, ${depart}, ${arrivee})`,
        // L'ombre reprend la teinte sombre du dégradé : une ombre grise sous
        // un carré coloré fait sale, et la planche n'en a pas.
        boxShadow: `0 2px 8px -2px ${arrivee}80`,
      }}
    >
      {auTrait ? (
        // Pas de remplissage ici : essayé, et deux pictogrammes different
        // (le sac à dos, le téléphone) s'aplatissent alors en le même
        // rectangle blanc muet, indiscernables l'un de l'autre. Un trait un
        // peu fin est un moindre défaut qu'une confusion entre deux
        // fonctions différentes.
        <Icone className={cn(mesures.icone, 'text-white')} strokeWidth={2.4} />
      ) : (
        <Icone className={cn(mesures.icone, 'text-white')} />
      )}
    </span>
  );
}
