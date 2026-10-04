import { afterEach, describe, expect, it, vi } from 'vitest';
import { chargerLeResume, raccourcir } from './resumeWikipedia';

describe('un résumé qu’on lit d’un coup d’œil', () => {
  it('garde un texte court tel quel', () => {
    expect(raccourcir('Un temple sur la mer.  Très beau.')).toBe('Un temple sur la mer. Très beau.');
  });

  it('coupe à la dernière phrase entière qui tient', () => {
    const texte = 'Première phrase courte. Deuxième phrase un peu plus longue que la première. Troisième.';
    expect(raccourcir(texte, 60)).toBe('Première phrase courte.');
  });

  it('coupe au mot, avec une ellipse, quand même la première phrase déborde', () => {
    expect(raccourcir('Un très long texte sans point qui continue encore et encore', 30)).toBe('Un très long texte sans point…');
  });
});

describe('le résumé d’un article', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('interroge la bonne Wikipédia et garde l’adresse de l’article', async () => {
    const appel = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        extract: 'La tour de Belém est une tour fortifiée située à Lisbonne.',
        content_urls: { mobile: { page: 'https://pt.m.wikipedia.org/wiki/Torre_de_Bel%C3%A9m' } },
      }),
    });
    vi.stubGlobal('fetch', appel);
    const resume = await chargerLeResume('pt:Torre de Belém');
    expect(appel.mock.calls[0]![0]).toBe('https://pt.wikipedia.org/api/rest_v1/page/summary/Torre_de_Bel%C3%A9m');
    expect(resume).toEqual({
      extrait: 'La tour de Belém est une tour fortifiée située à Lisbonne.',
      url: 'https://pt.m.wikipedia.org/wiki/Torre_de_Bel%C3%A9m',
    });
  });

  it('se tait plutôt que d’échouer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('hors ligne')));
    expect(await chargerLeResume('fr:Tour Eiffel')).toBeNull();
    expect(await chargerLeResume(undefined)).toBeNull();
  });
});
