import { describe, expect, it } from 'vitest';
import { diagnosticConnexion } from './oauthReturn';

const ORIGINE = 'https://tripora-allabdels-projects.vercel.app';

describe('diagnostic du retour de connexion', () => {
  it('ne dit rien quand on arrive normalement', () => {
    // Ouvrir Tripora sans avoir rien tenté est le cas courant : un
    // avertissement y serait du bruit pur.
    expect(diagnosticConnexion({ code: false, verificateur: false }, ORIGINE)).toBeNull();
  });

  it('répète l’explication du fournisseur quand il y en a une', () => {
    const vu = diagnosticConnexion(
      { code: false, verificateur: false, erreur: 'access_denied', description: 'User+denied+access' },
      ORIGINE,
    );
    expect(vu?.message).toContain('User denied access');
  });

  it('nomme le code d’erreur à défaut d’explication', () => {
    const vu = diagnosticConnexion({ code: false, verificateur: false, erreur: 'server_error' }, ORIGINE);
    expect(vu?.message).toContain('server_error');
  });

  it('explique le cas silencieux, et donne la ligne exacte à coller', () => {
    // Le vrai piège : on revient bien de Google, avec un code valable, mais la
    // session ne s’ouvre pas parce que le domaine n’est pas autorisé.
    const vu = diagnosticConnexion({ code: true, verificateur: true }, ORIGINE);
    expect(vu?.titre).toContain('n’a pas abouti');
    expect(vu?.aFaire).toContain(`${ORIGINE}/**`);
    expect(vu?.aFaire).toContain('Redirect URLs');
  });

  it('donne toujours l’adresse réellement utilisée, pas une adresse figée', () => {
    const vu = diagnosticConnexion({ code: true, verificateur: true }, 'https://tripora-3rg.pages.dev');
    expect(vu?.aFaire).toContain('https://tripora-3rg.pages.dev/**');
  });

  it('préfère l’erreur explicite au diagnostic déduit', () => {
    const vu = diagnosticConnexion(
      { code: true, verificateur: true, description: 'Invalid+login+credentials' },
      ORIGINE,
    );
    expect(vu?.message).toContain('Invalid login credentials');
    expect(vu?.aFaire).toBeUndefined();
  });
  it('distingue l’échec d’échange, qui ne vient pas de la liste des redirections', () => {
    // Le piège de ce message : on revient de Google avec une vraie erreur, et
    // le réflexe est d’aller corriger les redirections — le seul endroit qui
    // n’y est pour rien.
    const vu = diagnosticConnexion(
      {
        code: false,
        verificateur: false,
        erreur: 'server_error',
        description: 'Unable to exchange external code: 4/0AVGz',
      },
      ORIGINE,
      'https://eelvllvgnsohznconfpt.supabase.co',
    );
    expect(vu?.message).toContain('la liste des redirections n’y change rien');
    expect(vu?.aFaire).toContain('Client secret');
    expect(vu?.aFaire).toContain('https://eelvllvgnsohznconfpt.supabase.co/auth/v1/callback');
  });

  it('reste utile quand l’adresse du serveur est inconnue', () => {
    const vu = diagnosticConnexion(
      { code: false, verificateur: false, description: 'Unable to exchange external code: 4/0AVGz' },
      ORIGINE,
    );
    expect(vu?.aFaire).toContain('Client secret');
    expect(vu?.aFaire).not.toContain('undefined');
  });

  it('ne double pas la barre oblique de l’adresse du serveur', () => {
    const vu = diagnosticConnexion(
      { code: false, verificateur: false, description: 'Unable to exchange external code: 4/0AVGz' },
      ORIGINE,
      'https://eelvllvgnsohznconfpt.supabase.co/',
    );
    expect(vu?.aFaire).toContain('.supabase.co/auth/v1/callback');
  });
});

describe('retour sur le mauvais domaine', () => {
  it('nomme la panne silencieuse : parti d’ici, revenu ailleurs', () => {
    // C'est le bug rencontré en vrai. Les journaux du serveur le montraient
    // sans ambiguïté : /authorize demandait un retour vers tripora-eight
    // .vercel.app, adresse non autorisée ; le serveur a renvoyé sur son
    // adresse par défaut, et aucun /token n'a jamais suivi.
    const vu = diagnosticConnexion(
      { code: true, verificateur: false },
      'https://tripora-3rg.pages.dev',
    );
    expect(vu?.titre).toContain('pas revenu sur le même site');
    expect(vu?.message).toContain('relance la connexion');
    expect(vu?.aFaire).toContain('Redirect URLs');
  });

  it('ne confond pas les deux pannes', () => {
    // Avec le vérificateur, le domaine est le bon : le problème est ailleurs,
    // et envoyer quelqu'un corriger la liste des redirections lui ferait
    // perdre son temps au mauvais endroit.
    const avec = diagnosticConnexion({ code: true, verificateur: true }, ORIGINE);
    const sans = diagnosticConnexion({ code: true, verificateur: false }, ORIGINE);
    expect(avec?.titre).not.toBe(sans?.titre);
  });

  it('laisse l’erreur explicite du fournisseur passer devant', () => {
    // Un refus de Google se dit tel quel : inutile de parler de domaines.
    const vu = diagnosticConnexion(
      { code: true, verificateur: false, erreur: 'access_denied' },
      ORIGINE,
    );
    expect(vu?.titre).toBe('Connexion refusée');
  });
});
