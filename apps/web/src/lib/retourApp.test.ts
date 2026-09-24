import { describe, expect, it } from 'vitest';
import { lireLienEntrant } from './natif';
import { PAQUET_ANDROID, retourVersLApp, systemeDe } from './retourApp';

describe('la page qui rend la main à l’application', () => {
  it('transmet le code à l’application', () => {
    const retour = retourVersLApp('?code=abc-123', '');
    expect(retour.utile).toBe(true);
    expect(retour.schema).toBe('tripora://connexion?code=abc-123');
    expect(retour.intention).toBe(
      `intent://connexion?code=abc-123#Intent;scheme=tripora;package=${PAQUET_ANDROID};end`,
    );
  });

  it('produit une adresse que l’application sait relire', () => {
    const { schema } = retourVersLApp('?code=a%2Bb%3D', '');
    expect(lireLienEntrant(schema)).toEqual({ type: 'connexion', code: 'a+b=' });
  });

  it('rapporte une erreur, même rangée dans le fragment', () => {
    const retour = retourVersLApp(
      '',
      '#error=access_denied&error_description=L%27utilisateur+a+refus%C3%A9',
    );
    expect(retour.utile).toBe(true);
    expect(retour.erreur).toBe("L'utilisateur a refusé");
    expect(lireLienEntrant(retour.schema)).toEqual({
      type: 'connexion',
      erreur: 'access_denied',
      description: "L'utilisateur a refusé",
    });
  });

  it('ne transmet rien d’autre que les paramètres de connexion', () => {
    // Une page qui recopierait tout laisserait n'importe quel lien piloter
    // l'application.
    const { schema } = retourVersLApp('?code=abc&next=/profil&state=x', '#access_token=vol');
    expect(schema).toBe('tripora://connexion?code=abc');
  });

  it('ne fait rien sans code ni erreur', () => {
    const retour = retourVersLApp('', '');
    expect(retour.utile).toBe(false);
    expect(retour.schema).toBe('tripora://connexion');
  });

  it('reconnaît le téléphone', () => {
    expect(
      systemeDe('Mozilla/5.0 (Linux; Android 14; CPH2305) AppleWebKit/537.36 Chrome/128 Mobile'),
    ).toBe('android');
    expect(systemeDe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(systemeDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128')).toBe('autre');
  });
});
