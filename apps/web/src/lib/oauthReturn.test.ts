import { describe, expect, it } from 'vitest';
import { diagnosticConnexion } from './oauthReturn';

const ORIGINE = 'https://tripora-allabdels-projects.vercel.app';

describe('diagnostic du retour de connexion', () => {
  it('ne dit rien quand on arrive normalement', () => {
    // Ouvrir Tripora sans avoir rien tenté est le cas courant : un
    // avertissement y serait du bruit pur.
    expect(diagnosticConnexion({ code: false }, ORIGINE)).toBeNull();
  });

  it('répète l’explication du fournisseur quand il y en a une', () => {
    const vu = diagnosticConnexion(
      { code: false, erreur: 'access_denied', description: 'User+denied+access' },
      ORIGINE,
    );
    expect(vu?.message).toContain('User denied access');
  });

  it('nomme le code d’erreur à défaut d’explication', () => {
    const vu = diagnosticConnexion({ code: false, erreur: 'server_error' }, ORIGINE);
    expect(vu?.message).toContain('server_error');
  });

  it('explique le cas silencieux, et donne la ligne exacte à coller', () => {
    // Le vrai piège : on revient bien de Google, avec un code valable, mais la
    // session ne s’ouvre pas parce que le domaine n’est pas autorisé.
    const vu = diagnosticConnexion({ code: true }, ORIGINE);
    expect(vu?.titre).toContain('n’a pas abouti');
    expect(vu?.aFaire).toContain(`${ORIGINE}/**`);
    expect(vu?.aFaire).toContain('Redirect URLs');
  });

  it('donne toujours l’adresse réellement utilisée, pas une adresse figée', () => {
    const vu = diagnosticConnexion({ code: true }, 'https://tripora-3rg.pages.dev');
    expect(vu?.aFaire).toContain('https://tripora-3rg.pages.dev/**');
  });

  it('préfère l’erreur explicite au diagnostic déduit', () => {
    const vu = diagnosticConnexion(
      { code: true, description: 'Invalid+login+credentials' },
      ORIGINE,
    );
    expect(vu?.message).toContain('Invalid login credentials');
    expect(vu?.aFaire).toBeUndefined();
  });
});
