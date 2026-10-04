import { afterEach, describe, expect, it, vi } from 'vitest';
import { estUnRobot, langueDeLAdresse, languesAnnoncees, resoudre } from './langue';

afterEach(() => vi.unstubAllGlobals());

const GOOGLEBOT =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

describe('la langue vue par un robot', () => {
  it('reconnaît les robots des moteurs et des aperçus, pas les téléphones ni les tests', () => {
    expect(estUnRobot(GOOGLEBOT)).toBe(true);
    expect(estUnRobot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true);
    expect(estUnRobot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
    // Un téléphone CUBOT n'est pas un robot, ni le Chromium sans écran des tests.
    expect(estUnRobot('Mozilla/5.0 (Linux; Android 9; CUBOT P30) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36')).toBe(false);
    expect(estUnRobot('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0 Safari/537.36')).toBe(false);
  });

  it('lit le français, même quand il se dit « en-US »', () => {
    vi.stubGlobal('navigator', { userAgent: GOOGLEBOT, language: 'en-US', languages: ['en-US'] });
    expect(languesAnnoncees()).toEqual([]);
    expect(resoudre('systeme', null)).toBe('fr');
  });

  it('suit la langue du téléphone pour une personne', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone)', language: 'en-US', languages: ['en-US', 'fr'] });
    expect(resoudre('systeme', null)).toBe('en');
  });
});

describe('la langue demandée par l’adresse', () => {
  it('lit « ?langue=en », ignore une langue inconnue', () => {
    expect(langueDeLAdresse('?langue=en')).toBe('en');
    expect(langueDeLAdresse('?code=ABC&langue=ar')).toBe('ar');
    expect(langueDeLAdresse('?langue=klingon')).toBeNull();
    expect(langueDeLAdresse('')).toBeNull();
  });

  it('l’emporte sur le système et sur le robot, pas sur un choix fait dans le profil', () => {
    vi.stubGlobal('navigator', { userAgent: GOOGLEBOT, language: 'en-US', languages: ['en-US'] });
    expect(resoudre('systeme', 'en')).toBe('en');
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone)', language: 'fr-FR', languages: ['fr-FR'] });
    expect(resoudre('systeme', 'en')).toBe('en');
    expect(resoudre('fr', 'en')).toBe('fr');
  });
});
