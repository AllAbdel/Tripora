import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { celebrer, demarrerLeMouvement, forcerLeMouvement, laisserJouer, oublierLeDernierAppui, secouer } from './mouvement';

function appuyerSur(element: Element, x = 40, y = 20) {
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
}

beforeEach(() => {
  forcerLeMouvement(true);
  oublierLeDernierAppui();
  demarrerLeMouvement();
  document.body.innerHTML = '';
});

afterEach(() => {
  forcerLeMouvement(null);
  vi.useRealTimers();
});

describe('le mouvement des interactions', () => {
  it('une onde part du point touché, dans un bouton positionné', () => {
    document.body.innerHTML = '<button class="btn" style="position: relative">Créer</button>';
    const bouton = document.querySelector('button')!;
    appuyerSur(bouton);
    const onde = bouton.querySelector<HTMLElement>('.onde');
    expect(onde).not.toBeNull();
    expect(onde!.getAttribute('aria-hidden')).toBe('true');
  });

  it('pas d’onde sur un bouton désactivé, ni hors des boutons et cartes', () => {
    document.body.innerHTML =
      '<button class="btn" style="position: relative" disabled>Non</button><button style="position: relative">Simple</button>';
    const [desactive, simple] = document.querySelectorAll('button');
    appuyerSur(desactive!);
    appuyerSur(simple!);
    expect(document.querySelectorAll('.onde')).toHaveLength(0);
  });

  it('une réussite fait jaillir une coche au point du dernier appui', () => {
    document.body.innerHTML = '<button>Enregistrer</button>';
    appuyerSur(document.querySelector('button')!, 120, 300);
    celebrer();
    const eclat = document.querySelector<HTMLElement>('.eclat');
    expect(eclat).not.toBeNull();
    expect(eclat!.style.left).toBe('120px');
    expect(eclat!.style.top).toBe('300px');
    expect(eclat!.querySelector('svg')).not.toBeNull();
  });

  it('sans appui récent, rien ne jaillit au hasard', () => {
    celebrer();
    expect(document.querySelector('.eclat')).toBeNull();
  });

  it('un échec secoue le bouton pressé', () => {
    document.body.innerHTML = '<button>Envoyer</button>';
    const bouton = document.querySelector('button')!;
    appuyerSur(bouton);
    secouer();
    expect(bouton.classList.contains('secoue')).toBe(true);
  });

  it('moins d’animations demandé : ni onde, ni éclat, ni attente', async () => {
    forcerLeMouvement(false);
    document.body.innerHTML = '<button class="btn" style="position: relative">Créer</button>';
    const bouton = document.querySelector('button')!;
    appuyerSur(bouton);
    celebrer();
    secouer();
    expect(document.querySelector('.onde, .eclat')).toBeNull();
    expect(bouton.classList.contains('secoue')).toBe(false);
    vi.useFakeTimers();
    let fini = false;
    void laisserJouer(5000).then(() => (fini = true));
    await Promise.resolve();
    expect(fini).toBe(true);
  });
});
