import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Pastille, type NomDePastille } from './Pastille';

/**
 * Les dégradés viennent de la planche d'icônes, relevés au pixel aux deux
 * coins de chaque tuile. Les figer ici évite qu'ils dérivent un par un au fil
 * des retouches jusqu'à ce que la grille ne ressemble plus à rien de commun.
 */
const DEGRADES: Partial<Record<NomDePastille, string>> = {
  accueil: 'linear-gradient(135deg, rgb(62, 164, 237), rgb(2, 114, 208))',
  voyages: 'linear-gradient(135deg, rgb(73, 205, 154), rgb(23, 160, 130))',
  creer: 'linear-gradient(135deg, rgb(159, 129, 244), rgb(100, 72, 239))',
  carte: 'linear-gradient(135deg, rgb(252, 189, 84), rgb(253, 134, 72))',
  itineraire: 'linear-gradient(135deg, rgb(251, 130, 116), rgb(241, 91, 107))',
  participants: 'linear-gradient(135deg, rgb(105, 120, 246), rgb(69, 83, 233))',
  votes: 'linear-gradient(135deg, rgb(248, 120, 126), rgb(232, 87, 113))',
  depenses: 'linear-gradient(135deg, rgb(117, 207, 97), rgb(70, 168, 64))',
  hebergements: 'linear-gradient(135deg, rgb(162, 116, 240), rgb(112, 64, 224))',
  transport: 'linear-gradient(135deg, rgb(55, 167, 237), rgb(2, 114, 207))',
  meteo: 'linear-gradient(135deg, rgb(51, 207, 183), rgb(10, 177, 164))',
  profil: 'linear-gradient(135deg, rgb(81, 101, 130), rgb(43, 63, 93))',
};

/** Les seize noms, dans l'ordre de la planche puis des quatre ajouts. */
const NOMS: readonly NomDePastille[] = [
  'accueil', 'voyages', 'creer', 'carte', 'itineraire', 'participants', 'votes', 'depenses',
  'hebergements', 'transport', 'meteo', 'profil', 'discussion', 'valise', 'recapitulatif',
  'applications',
];

/** Tous les fichiers TypeScript sous un dossier, sous-dossiers compris. */
function fichiers(racine: string): string[] {
  return readdirSync(racine, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(entree.name) ? [chemin] : [];
  });
}

describe('pastilles', () => {
  it('porte le dégradé relevé sur la planche', () => {
    for (const [nom, degrade] of Object.entries(DEGRADES)) {
      const { container, unmount } = render(<Pastille nom={nom as NomDePastille} />);
      const boite = container.firstElementChild as HTMLElement;
      expect(boite.style.backgroundImage, nom).toBe(degrade);
      unmount();
    }
  });

  it('reste muette pour les lecteurs d’écran', () => {
    // Le nom de la fonction est toujours écrit à côté : répéter la pastille
    // ferait entendre deux fois la même chose.
    const { container } = render(<Pastille nom="carte" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('dessine un pictogramme, jamais un émoji', () => {
    // Un émoji change de forme selon l'appareil, ignore la couleur demandée et
    // ne suit pas la taille : la règle du projet est qu'il n'y en a aucun.
    const { container } = render(<Pastille nom="depenses" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('dessine aussi un pictogramme pour les quatre pastilles sans planche', () => {
    // Sans référence, elles gardent un pictogramme de bibliothèque au trait —
    // mais un pictogramme tout de même, jamais un carré vide.
    for (const nom of ['discussion', 'valise', 'recapitulatif', 'applications'] as const) {
      const { container, unmount } = render(<Pastille nom={nom} />);
      expect(container.querySelector('svg'), nom).not.toBeNull();
      unmount();
    }
  });

  /**
   * Le défaut que ce test existe pour empêcher : douze pictogrammes dessinés
   * au pixel, et six d'entre eux — la maison, le plus, la case cochée, le lit,
   * l'avion, le soleil — qui ne s'affichaient nulle part dans l'application.
   * Ils étaient déclarés, testés, commentés, et personne ne les voyait jamais.
   *
   * Une pastille qui n'est posée sur aucun écran est du travail invisible :
   * soit on lui trouve sa place, soit on la retire.
   */
  it('est posée quelque part dans l’application', () => {
    const sources = fichiers(join(process.cwd(), 'src'));
    const utilisations = sources
      .filter((chemin) => !chemin.endsWith('Pastille.tsx') && !chemin.includes('.test.'))
      .map((chemin) => readFileSync(chemin, 'utf8'))
      .join('\n');

    const orphelines = NOMS.filter(
      (nom) =>
        !utilisations.includes(`pastille="${nom}"`) &&
        !utilisations.includes(`nom="${nom}"`) &&
        !utilisations.includes(`pastille: '${nom}'`),
    );
    expect(orphelines, 'pastilles dessinées mais jamais affichées').toEqual([]);
  });

  it('change de gabarit sans changer de couleur', () => {
    const petite = render(<Pastille nom="meteo" taille="sm" />);
    const grande = render(<Pastille nom="meteo" taille="lg" />);
    const degrade = (r: typeof petite) =>
      (r.container.firstElementChild as HTMLElement).style.backgroundImage;
    expect(degrade(petite)).toBe(degrade(grande));
    expect((petite.container.firstElementChild as HTMLElement).className).not.toBe(
      (grande.container.firstElementChild as HTMLElement).className,
    );
  });
});
