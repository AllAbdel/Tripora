import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { useLangue } from '@/stores/langue';
import {
  chargerLeDictionnaire,
  demarrerLaTraductionAuRendu,
  traduireDansLaLangueActive,
  traduireTexte,
} from './traductionAuRendu';

const attendre = () => new Promise((ok) => setTimeout(ok, 0));

beforeAll(async () => {
  expect(await chargerLeDictionnaire('en')).toBe(true);
  expect(await chargerLeDictionnaire('es')).toBe(false);
});

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

  it('garde les unités de la personne dans les phrases à distance ou température', () => {
    expect(traduireTexte('en', '24 745 km aller-retour, 62 % du tour de la Terre')).toBe('24 745 km round trip, 62% of the way around the Earth');
    expect(traduireTexte('en', '15 376 mi aller-retour')).toBe('15 376 mi round trip');
    expect(traduireTexte('en', 'Un voyage à plus de 3,107 mi de chez soi.')).toBe('A trip more than 3,107 mi from home.');
    expect(traduireTexte('en', '75 °F le jour, 59 °F la nuit')).toBe('75 °F by day, 59 °F at night');
    expect(traduireTexte('en', '297 K en journée, 288 K la nuit, 3 jours de pluie dans le mois')).toBe(
      '297 K by day, 288 K at night, 3 rainy days in the month',
    );
    expect(traduireTexte('en', '9,320 mi à vol d’oiseau')).toBe('9,320 mi as the crow flies');
  });

});

describe('la traduction au rendu', () => {
  it('traduit le texte rendu, suit les réécritures, respecte translate="no", et revient au français', async () => {
    useLangue.setState({ preference: 'en' });
    // La description de index.html, telle quelle : les moteurs l'affichent sous le titre.
    const description = /<meta name="description" content="([^"]+)"/u.exec(
      readFileSync(join(process.cwd(), 'index.html'), 'utf8'),
    )![1]!;
    document.head.innerHTML = `<meta name="description" content="${description}">`;
    document.body.innerHTML = '<main><h1>Où on en est</h1><button aria-label="Retour au voyage">←</button><p translate="no">Continuer</p></main>';
    demarrerLaTraductionAuRendu();
    const meta = document.querySelector('meta[name="description"]')!;
    expect(meta.getAttribute('content')).toMatch(/^Plan a trip with friends without fifteen group chats/u);
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

    // Une phrase écrite en morceaux dans le JSX : trois nœuds voisins, une seule traduction.
    const morceaux = document.createElement('p');
    morceaux.append('12', ' idées', ' à Bali, classées selon les envies du groupe');
    document.querySelector('main')!.append(morceaux);
    await attendre();
    expect(morceaux.textContent).toBe('12 ideas in Bali, ranked by the group’s wishes');
    // React réécrit un seul morceau (le nombre change) : la phrase se retraduit.
    morceaux.firstChild!.nodeValue = '1';
    (morceaux.childNodes[1] as Text).nodeValue = ' idée';
    await attendre();
    expect(morceaux.textContent).toBe('1 idea in Bali, ranked by the group’s wishes');

    useLangue.setState({ preference: 'fr' });
    await attendre();
    expect(titre.textContent).toBe('Journées');
    expect(morceaux.textContent).toBe('1 idée à Bali, classées selon les envies du groupe');
    expect(ajout.textContent).toBe('Voter');
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('Retour au voyage');
    expect(meta.getAttribute('content')).toBe(description);
  });
});
