import { describe, expect, it } from 'vitest';
import { insecables } from './typographie';

describe('les espaces insécables', () => {
  it('attachent les guillemets et la ponctuation haute à leur mot', () => {
    expect(insecables('de « Non merci » à « Essentiel ».')).toBe(
      'de « Non merci » à « Essentiel ».',
    );
    expect(insecables('Du « on part où ? » au départ')).toBe('Du « on part où ? » au départ');
    expect(insecables('À droite : j’y vais ; à gauche !')).toBe('À droite : j’y vais ; à gauche !');
  });

  it('laisse un texte sans ponctuation tel quel', () => {
    expect(insecables('Le coffre, la valise')).toBe('Le coffre, la valise');
  });
});
