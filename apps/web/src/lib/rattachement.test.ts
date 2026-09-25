import { describe, expect, it } from 'vitest';
import { messageDeRattachement } from './rattachement';

describe('les refus du rattachement', () => {
  it('dit franchement qu’une adresse déjà utilisée ne se fusionne pas', () => {
    expect(
      messageDeRattachement(new Error('A user with this email address has already been registered')),
    ).toContain('ne peuvent pas être réunis');
  });

  it('reconnaît un compte Google déjà utilisé', () => {
    expect(messageDeRattachement(new Error('Identity is already linked to another user'))).toContain(
      'Ce compte Google',
    );
  });

  it('propose l’e-mail quand la liaison à Google n’est pas ouverte', () => {
    expect(messageDeRattachement(new Error('Manual linking is disabled'))).toContain('adresse e-mail');
  });

  it('laisse les autres erreurs aux messages ordinaires', () => {
    expect(messageDeRattachement(new Error('Token has expired or is invalid'))).toBeNull();
  });
});
