import { describe, expect, it } from 'vitest';
import { useLangue } from '@/stores/langue';
import { PHRASES_EN } from './phrases-en';
import { demarrerLaTraductionAuRendu, traduireDansLaLangueActive, traduireTexte } from './traductionAuRendu';

const attendre = () => new Promise((ok) => setTimeout(ok, 0));

describe('traduireTexte', () => {
  it('traduit une phrase exacte et garde ses espaces de bord', () => {
    expect(traduireTexte('en', 'Avec qui partez-vous ?')).toBe('Who are you traveling with?');
    expect(traduireTexte('en', ' Continuer ')).toBe(' Continue ');
    // Les espaces insécables de la typographie française ne gênent pas la recherche.
    expect(traduireTexte('en', 'Avec qui partez-vous ?')).toBe('Who are you traveling with?');
  });

  it('laisse le français quand il ne sait pas, et ne touche à rien hors anglais', () => {
    expect(traduireTexte('en', 'Une phrase que personne n’a traduite')).toBeNull();
    expect(traduireTexte('fr', 'Continuer')).toBeNull();
    expect(traduireTexte('es', 'Continuer')).toBeNull();
    expect(traduireTexte('en', '1 800 €')).toBeNull();
  });

  it('compose les phrases à nombre ou à nom', () => {
    expect(traduireTexte('en', 'Étape 2 sur 6')).toBe('Step 2 of 6');
    expect(traduireTexte('en', '12 jours en juillet')).toBe('12 days in July');
    expect(traduireTexte('en', '1 personne n’a pas encore rejoint')).toBe('1 person hasn’t joined yet');
    expect(traduireTexte('en', 'Répond à toutes vos envies (92 %).')).toBe('Matches all your wishes (92%).');
    expect(traduireTexte('en', 'J’ai envie : La forêt des singes d’Ubud')).toBe('I’m in: The Ubud Monkey Forest');
    expect(traduireTexte('en', '2 octobre 2026')).toBe('October 2, 2026');
    expect(traduireTexte('en', '12 idées à Bali, classées selon les envies du groupe')).toBe('12 ideas in Bali, ranked by the group’s wishes');
    expect(traduireTexte('en', ' · 12 jours à 4 personnes')).toBe(' · 12 days for 4 people');
  });

  it('traduit chaque explication du classement, morceau par morceau', () => {
    expect(
      traduireTexte('en', 'En tête, mais d’un cheveu : les suivantes se valent. Elle devance le lot sur activités : 100/100 contre 93 en moyenne.'),
    ).toBe('In the lead, but only just: the next ones are close. Ahead of the pack on activities: 100/100 vs 93 on average.');
    expect(traduireTexte('en', 'La plus chère, 184 € au-dessus de la moins chère.')).toBe('The most expensive, 184 € above the cheapest.');
    expect(traduireTexte('en', 'Répond à 70 % de vos envies. Ce qui manque : fête et vie nocturne et détente.')).toBe(
      'Matches 70% of your wishes. Missing: parties and nightlife and relaxation.',
    );
  });

  it('traduit les titres de journée, quelles que soient les envies réunies', () => {
    expect(traduireTexte('en', 'Arrivée, puis nature et paysages')).toBe('Arrival, then nature and scenery');
    expect(traduireTexte('en', 'Gastronomie et culture et histoire')).toBe('Food and culture and history');
    expect(traduireTexte('en', 'Détente et nature et paysages, puis départ')).toBe('Relaxation and nature and scenery, then departure');
  });

  it('traduit la valise et les pays', () => {
    expect(traduireTexte('en', '1 Passeport ou carte d’identité (essentiel)')).toBe('1 Passport or ID card (essential)');
    expect(traduireTexte('en', '10 Paires de chaussettes')).toBe('10 Pairs of socks');
    expect(traduireTexte('en', 'Danemark · AAR')).toBe('Denmark · AAR');
    expect(traduireTexte('en', 'Drapeau : Indonésie')).toBe('Flag: Indonesia');
  });

  it('traduit à la demande ce qui n’est pas du texte de la page, dans la langue active', () => {
    useLangue.setState({ preference: 'en' });
    expect(traduireDansLaLangueActive('Le voyage à plusieurs, sans prise de tête')).toBe('Group travel, minus the headache');
    expect(traduireDansLaLangueActive('Bali')).toBe('Bali');
    useLangue.setState({ preference: 'fr' });
    expect(traduireDansLaLangueActive('activités')).toBe('activités');
  });

  it('n’a pas de traduction vide', () => {
    for (const [francais, anglais] of Object.entries(PHRASES_EN)) {
      expect(anglais.trim(), francais).not.toBe('');
    }
  });
});

describe('la traduction au rendu', () => {
  it('traduit le texte rendu, suit les réécritures, respecte translate="no", et revient au français', async () => {
    useLangue.setState({ preference: 'en' });
    document.body.innerHTML = '<main><h1>Où on en est</h1><button aria-label="Retour au voyage">←</button><p translate="no">Continuer</p></main>';
    demarrerLaTraductionAuRendu();
    const titre = document.querySelector('h1')!;
    expect(titre.textContent).toBe('Where we’re at');
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('Back to the trip');
    expect(document.querySelector('p')!.textContent).toBe('Continuer');

    // Comme React quand une donnée change : un nouveau texte français dans le même nœud.
    titre.firstChild!.nodeValue = 'Journées';
    await attendre();
    expect(titre.textContent).toBe('Days');

    // Un nœud ajouté plus tard.
    const ajout = document.createElement('span');
    ajout.textContent = 'Voter';
    document.querySelector('main')!.append(ajout);
    await attendre();
    expect(ajout.textContent).toBe('Vote');

    useLangue.setState({ preference: 'fr' });
    await attendre();
    expect(titre.textContent).toBe('Journées');
    expect(ajout.textContent).toBe('Voter');
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('Retour au voyage');
  });
});
