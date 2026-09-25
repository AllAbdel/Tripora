import { describe, expect, it } from 'vitest';
import {
  chiffresDuCode,
  codeComplet,
  emailPlausible,
  messageDErreurEmail,
  normaliserEmail,
  secondesAAttendre,
} from './connexionEmail';

describe('connexion par e-mail', () => {
  it('range l’adresse avant de l’envoyer', () => {
    expect(normaliserEmail('  Lea.Martin@Exemple.FR ')).toBe('lea.martin@exemple.fr');
  });

  it('accepte les adresses ordinaires et refuse les évidences', () => {
    expect(emailPlausible('lea@exemple.fr')).toBe(true);
    expect(emailPlausible('lea+voyages@mail.exemple.co.uk')).toBe(true);
    expect(emailPlausible('lea@exemple')).toBe(false);
    expect(emailPlausible('lea exemple.fr')).toBe(false);
    expect(emailPlausible('')).toBe(false);
  });

  it('garde les chiffres d’un code collé avec des espaces', () => {
    expect(chiffresDuCode('123 456')).toBe('123456');
    expect(chiffresDuCode(' 12-34-56\n')).toBe('123456');
    expect(codeComplet('123456')).toBe(true);
    expect(codeComplet('12345')).toBe(false);
    // Un projet réglé sur huit chiffres ne doit pas se voir refuser ses codes.
    expect(codeComplet('12345678')).toBe(true);
  });

  it('lit le délai imposé par le serveur', () => {
    expect(
      secondesAAttendre('For security purposes, you can only request this after 42 seconds.'),
    ).toBe(42);
    expect(secondesAAttendre('autre chose')).toBeNull();
  });

  it('traduit les refus du serveur en phrases utiles', () => {
    expect(
      messageDErreurEmail(new Error('For security purposes, you can only request this after 1 second.'), 'envoi'),
    ).toContain('1 seconde avant');
    expect(messageDErreurEmail(new Error('email rate limit exceeded'), 'envoi')).toContain(
      'Trop de codes',
    );
    expect(messageDErreurEmail(new Error('Signups not allowed for otp'), 'envoi')).toContain(
      'Créer un compte',
    );
    expect(messageDErreurEmail(new Error('Email address not authorized'), 'envoi')).toContain(
      'pas encore ouvert',
    );
    expect(messageDErreurEmail(new Error('Token has expired or is invalid'), 'verification')).toContain(
      'Code incorrect ou expiré',
    );
    expect(messageDErreurEmail(new Error('Failed to fetch'), 'envoi')).toContain('réseau');
    expect(messageDErreurEmail(new Error('???'), 'verification')).toContain('pas pu être vérifié');
  });
});
