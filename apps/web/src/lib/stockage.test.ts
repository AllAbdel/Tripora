import { beforeEach, describe, expect, it } from 'vitest';
import { oublierApresDeconnexion } from './stockage';

/** L'état d'un navigateur où quelqu'un a vraiment utilisé Tripora. */
function remplirLeStockage(): void {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('tripora.theme', 'dark');
  localStorage.setItem('tripora.cache', '{"voyages":["Bali"]}');
  localStorage.setItem('tripora.local-identity', '{"id":"abc"}');
  localStorage.setItem('tripora.local-trips', '[{"id":"t1"}]');
  localStorage.setItem('tripora.local-expenses', '[]');
  localStorage.setItem('tripora.favoris', '["t1"]');
  localStorage.setItem('tripora.trip-draft', '{}');
  localStorage.setItem('sb-abcdefgh-auth-token', '{"access_token":"secret"}');
  localStorage.setItem('autre-application', 'à ne pas toucher');
  sessionStorage.setItem('tripora.oauth-relance', '1');
}

describe('effacement à la déconnexion', () => {
  beforeEach(remplirLeStockage);

  it('emporte le cache des requêtes', () => {
    // Il contient les voyages, les noms des participants, les dépenses : le
    // laisser derrière soi, c'est les montrer à la personne suivante.
    oublierApresDeconnexion({ gardeLesDonneesLocales: false });
    expect(localStorage.getItem('tripora.cache')).toBeNull();
  });

  it('emporte le jeton de session, même sans son préfixe à nous', () => {
    oublierApresDeconnexion({ gardeLesDonneesLocales: false });
    expect(localStorage.getItem('sb-abcdefgh-auth-token')).toBeNull();
  });

  it('garde le thème', () => {
    // Une couleur ne dit rien de personne, et se reconnecter dans la minute
    // sur une application redevenue blanche est déroutant pour rien.
    oublierApresDeconnexion({ gardeLesDonneesLocales: false });
    expect(localStorage.getItem('tripora.theme')).toBe('dark');
  });

  it('avec un serveur, emporte les copies locales', () => {
    oublierApresDeconnexion({ gardeLesDonneesLocales: false });
    expect(localStorage.getItem('tripora.local-trips')).toBeNull();
    expect(localStorage.getItem('tripora.favoris')).toBeNull();
    expect(localStorage.getItem('tripora.local-identity')).toBeNull();
  });

  it('sans serveur, épargne les voyages : ce sont les seuls exemplaires', () => {
    oublierApresDeconnexion({ gardeLesDonneesLocales: true });
    expect(localStorage.getItem('tripora.local-trips')).toBe('[{"id":"t1"}]');
    expect(localStorage.getItem('tripora.local-expenses')).toBe('[]');
    expect(localStorage.getItem('tripora.favoris')).toBe('["t1"]');
    // L'identité, elle, part dans les deux cas : c'est ce qu'on quitte.
    expect(localStorage.getItem('tripora.local-identity')).toBeNull();
    // Et le cache aussi : il se reconstruit tout seul à la lecture.
    expect(localStorage.getItem('tripora.cache')).toBeNull();
  });

  it('ne touche pas à ce qui n’est pas à nous', () => {
    oublierApresDeconnexion({ gardeLesDonneesLocales: false });
    expect(localStorage.getItem('autre-application')).toBe('à ne pas toucher');
  });

  it('lève le marqueur de relance OAuth', () => {
    // Sinon la prochaine connexion depuis cet onglet croirait avoir déjà
    // épuisé sa seule reprise automatique.
    oublierApresDeconnexion({ gardeLesDonneesLocales: false });
    expect(sessionStorage.getItem('tripora.oauth-relance')).toBeNull();
  });
});
