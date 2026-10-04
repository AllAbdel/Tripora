import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LigneGlissante } from './LigneGlissante';

/**
 * Le geste et le bouton mènent au même endroit, et un défilement vertical
 * n'est pas un geste. C'est tout ce qu'il y a à vérifier ici.
 */

function poser(epingle = false) {
  const surEpingler = vi.fn();
  const surSupprimer = vi.fn();
  render(
    <LigneGlissante
      libelle="Rome entre potes"
      epingle={epingle}
      surEpingler={surEpingler}
      surSupprimer={surSupprimer}
    >
      <p>contenu</p>
    </LigneGlissante>,
  );
  const zone = screen.getByText('contenu').parentElement!.parentElement!;
  return { surEpingler, surSupprimer, zone };
}

function glisser(zone: HTMLElement, dx: number, dy = 0): void {
  fireEvent.pointerDown(zone, { clientX: 200, clientY: 100, pointerType: 'touch' });
  // Deux mouvements : le premier décide de l'axe, le second déplace.
  fireEvent.pointerMove(zone, { clientX: 200 + Math.sign(dx) * 12, clientY: 100 + dy });
  fireEvent.pointerMove(zone, { clientX: 200 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(zone);
}

describe('ligne glissante', () => {
  it('supprime quand on glisse franchement vers la gauche', () => {
    const { surSupprimer, surEpingler, zone } = poser();
    glisser(zone, -140);
    expect(surSupprimer).toHaveBeenCalledTimes(1);
    expect(surEpingler).not.toHaveBeenCalled();
  });

  it('épingle quand on glisse franchement vers la droite', () => {
    const { surEpingler, surSupprimer, zone } = poser();
    glisser(zone, 140);
    expect(surEpingler).toHaveBeenCalledTimes(1);
    expect(surSupprimer).not.toHaveBeenCalled();
  });

  it('ne fait rien sur un glissement timide', () => {
    // Sinon on supprimerait un voyage en effleurant l'écran.
    const { surEpingler, surSupprimer, zone } = poser();
    glisser(zone, -40);
    expect(surSupprimer).not.toHaveBeenCalled();
    expect(surEpingler).not.toHaveBeenCalled();
  });

  it('laisse défiler la liste sans rien déclencher', () => {
    // Le pouce descend en diagonale : c'est un défilement, pas une action.
    const { surEpingler, surSupprimer, zone } = poser();
    fireEvent.pointerDown(zone, { clientX: 200, clientY: 100, pointerType: 'touch' });
    fireEvent.pointerMove(zone, { clientX: 190, clientY: 40 });
    fireEvent.pointerMove(zone, { clientX: 60, clientY: 20 });
    fireEvent.pointerUp(zone);
    expect(surSupprimer).not.toHaveBeenCalled();
    expect(surEpingler).not.toHaveBeenCalled();
  });

  it('offre les mêmes actions en boutons, nommés', () => {
    const { surEpingler, surSupprimer } = poser();
    fireEvent.click(screen.getByRole('button', { name: 'Épingler Rome entre potes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Rome entre potes' }));
    expect(surEpingler).toHaveBeenCalledTimes(1);
    expect(surSupprimer).toHaveBeenCalledTimes(1);
  });

  it('propose de décrocher ce qui est déjà épinglé', () => {
    poser(true);
    expect(
      screen.getByRole('button', { name: 'Retirer Rome entre potes des favoris' }),
    ).toBeTruthy();
  });
});

describe('ce qui interrompt un geste', () => {
  it('ne supprime rien quand le navigateur reprend la main', () => {
    // `pointercancel` n'est pas un relâchement : c'est le navigateur qui
    // annule. Le confondre avec la fin du geste supprimait un voyage que
    // personne n'avait fini de glisser.
    const { surSupprimer, surEpingler, zone } = poser();
    fireEvent.pointerDown(zone, { clientX: 200, clientY: 100, pointerType: 'touch' });
    fireEvent.pointerMove(zone, { clientX: 188, clientY: 100 });
    fireEvent.pointerMove(zone, { clientX: 60, clientY: 100 });
    fireEvent.pointerCancel(zone);
    expect(surSupprimer).not.toHaveBeenCalled();
    expect(surEpingler).not.toHaveBeenCalled();
  });

  it('empêche le glisser-déposer natif de tuer le geste', () => {
    // Une carte est un lien, et un lien se traîne : à la souris, le navigateur
    // lançait un glisser-déposer au bout de deux pixels, ce qui annulait le
    // pointeur. Le geste ne démarrait jamais sur ordinateur.
    const { zone } = poser();
    const debut = new Event('dragstart', { bubbles: true, cancelable: true });
    zone.dispatchEvent(debut);
    expect(debut.defaultPrevented).toBe(true);
  });

  it('étouffe le clic qui suit un glissement', () => {
    // Sinon glisser pour supprimer ouvrait la confirmation *et*, derrière
    // elle, la page du voyage.
    const { zone } = poser();
    glisser(zone, -140);
    const clic = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByText('contenu').dispatchEvent(clic);
    expect(clic.defaultPrevented).toBe(true);
  });

  it('laisse passer un appui simple', () => {
    // Sans mouvement, il n'y a pas de geste : la carte doit s'ouvrir.
    const { zone } = poser();
    fireEvent.pointerDown(zone, { clientX: 200, clientY: 100, pointerType: 'touch' });
    fireEvent.pointerUp(zone);
    const clic = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByText('contenu').dispatchEvent(clic);
    expect(clic.defaultPrevented).toBe(false);
  });
});
