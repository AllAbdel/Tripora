import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le service worker des notifications (`public/sw-alertes.js`), exécuté tel
 * quel avec un faux `self` : ce qu'il affiche pour chaque contenu reçu.
 */
interface Notification {
  titre: string;
  corps: string;
  tag: string | undefined;
  url: string;
}
type Composer = (contenu: unknown, langue: string) => Notification;

function chargerLeServiceWorker(): Composer {
  const source = readFileSync(join(process.cwd(), 'public/sw-alertes.js'), 'utf8');
  const faux: Record<string, unknown> = { addEventListener: () => undefined, navigator: { language: 'fr-FR' } };
  new Function('self', 'caches', source)(faux, {});
  return faux['composerLaNotification'] as Composer;
}

const composer = chargerLeServiceWorker();
const NBSP = ' ';
const voyage = { voyageId: 'v1', voyage: 'Lisbonne entre potes' };

describe('les notifications du service worker', () => {
  it('garde le message fixe des alertes de prix, sans contenu', () => {
    expect(composer(null, 'fr')).toEqual({
      titre: 'Un prix que vous suivez a baissé',
      corps: 'Ouvrez Tripora pour voir de combien.',
      tag: 'alertes-de-prix',
      url: '/alertes',
    });
    expect(composer(null, 'en').titre).toBe('A price you’re watching just dropped');
  });

  it('dit qui a écrit, et compte les messages regroupés', () => {
    const un = composer({ genre: 'message', qui: 'Léa', extrait: 'On part à 7 h ?', ...voyage }, 'fr');
    expect(un).toEqual({
      titre: 'Léa · Lisbonne entre potes',
      corps: 'On part à 7 h ?',
      tag: 'message-v1',
      url: '/voyages/v1/discussion',
    });
    const trois = composer({ genre: 'message', qui: 'Léa', extrait: 'Alors ?', nombre: 3, ...voyage }, 'en');
    expect(trois.titre).toBe('3 new messages · Lisbonne entre potes');
    expect(trois.corps).toBe('Léa: Alors ?');
  });

  it('écrit le montant d’une dépense dans la devise et la langue', () => {
    const fr = composer({ genre: 'depense', qui: 'Tom', libelle: 'Restaurant', montant: 4500, devise: 'EUR', ...voyage }, 'fr');
    expect(fr.titre).toBe('Nouvelle dépense · Lisbonne entre potes');
    expect(fr.corps.replace(/\s/gu, ' ')).toBe('Tom a ajouté « Restaurant » : 45,00 €.');
    expect(fr.url).toBe('/voyages/v1/budget');
    expect(fr.tag).toBeUndefined();
    const en = composer({ genre: 'depense', qui: 'Tom', libelle: 'Taxi', montant: 1250, devise: 'USD', ...voyage }, 'en');
    expect(en.corps).toBe('Tom added “Taxi”: $12.50.');
  });

  it('annonce les décisions sans dire qui a voté quoi', () => {
    expect(composer({ genre: 'tous_ont_vote', votants: 4, ...voyage }, 'fr').corps).toBe(
      `Tout le monde a voté sur la destination${NBSP}: à vous de trancher.`,
    );
    const decide = composer({ genre: 'destination', destination: 'Lisbonne', ...voyage }, 'fr');
    expect(decide.titre).toBe(`C’est décidé${NBSP}!`);
    expect(decide.url).toBe('/voyages/v1');
    expect(composer({ genre: 'sondage', qui: 'Léa', question: 'Quel quartier ?', secret: true, ...voyage }, 'en').corps).toBe(
      'Léa asks: “Quel quartier ?” Secret vote.',
    );
  });

  it('mène chaque notification au bon écran', () => {
    expect(composer({ genre: 'membre', qui: 'Sam', ...voyage }, 'fr').url).toBe('/voyages/v1/participants');
    expect(composer({ genre: 'tache', qui: 'Sam', titre: 'Le tram', ...voyage }, 'fr').url).toBe('/voyages/v1/qui-fait-quoi');
    expect(composer({ genre: 'envies', ...voyage }, 'fr').url).toBe('/voyages/v1/mes-envies');
    expect(composer({ genre: 'tous_ont_vote', ...voyage }, 'fr').url).toBe('/voyages/v1#trancher');
  });

  it('retombe sur le français, et sur un texte neutre pour un genre inconnu', () => {
    expect(composer({ genre: 'membre', qui: 'Sam', ...voyage }, 'es').corps).toBe('Sam a rejoint le voyage.');
    expect(composer({ genre: 'nouveau-genre', ...voyage }, 'fr')).toEqual({
      titre: 'Tripora',
      corps: 'Du nouveau dans votre voyage.',
      tag: undefined,
      url: '/voyages',
    });
  });
});
