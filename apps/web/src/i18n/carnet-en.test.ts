import { describe, expect, it } from 'vitest';
import { ACTIVITES } from '@tripora/core/activites';
import { NOMS_ET_RESUMES, phrasesDuCarnet } from './carnet-en';

describe('le carnet en anglais', () => {
  it('ne traduit que des activités qui existent', () => {
    const connues = new Set(ACTIVITES.map((activite) => activite.id));
    expect(Object.keys(NOMS_ET_RESUMES).filter((id) => !connues.has(id))).toEqual([]);
  });

  it('traduit toutes les activités du catalogue', () => {
    // Une activité ajoutée au catalogue sans sa ligne ici resterait en français.
    expect(ACTIVITES.filter((activite) => !NOMS_ET_RESUMES[activite.id]).map((activite) => activite.id)).toEqual([]);
  });

  it('rattache chaque traduction au français du catalogue', () => {
    const phrases = phrasesDuCarnet();
    expect(phrases['Borobudur au lever du jour']).toBe('Borobudur at daybreak');
    expect(phrases['Le plus grand temple bouddhiste du monde, cinq cents bouddhas et la brume dans la plaine en dessous.']).toBe(
      'The world’s largest Buddhist temple, five hundred Buddhas and mist over the plain below.',
    );
  });

  it('écrit en anglais typographié, sans guillemets droits ni champ vide', () => {
    for (const [id, [nom, resume]] of Object.entries(NOMS_ET_RESUMES)) {
      expect(nom.trim(), id).not.toBe('');
      expect(resume.trim(), id).not.toBe('');
      expect(`${nom}${resume}`, id).not.toMatch(/["«»]/u);
    }
  });
});
