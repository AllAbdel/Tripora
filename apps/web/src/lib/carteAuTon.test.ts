import { describe, expect, it } from 'vitest';
import { PALETTES, retouchesPour, roleDeLaCouche } from './carteAuTon';

describe('repeindre le fond de carte', () => {
  it('reconnaît les couches d’un style OpenFreeMap', () => {
    // Les identifiants relevés dans « positron » : c'est sur eux que tout
    // repose, et c'est ce test qui préviendra si l'amont les renomme.
    const attendus: [string, string, string][] = [
      ['background', 'background', 'fond'],
      ['water', 'fill', 'eau'],
      ['waterway', 'line', 'eau'],
      ['landcover-grass', 'fill', 'vegetation'],
      ['landuse-residential', 'fill', 'terre'],
      ['park', 'fill', 'vegetation'],
      ['building', 'fill', 'batiment'],
      ['building-top', 'fill', 'batiment'],
      ['road_major_motorway', 'line', 'route'],
      ['highway-path', 'line', 'route'],
      ['bridge_major', 'line', 'route'],
      ['railway-transit', 'line', 'rail'],
      ['boundary_country', 'line', 'frontiere'],
      ['admin_sub', 'line', 'frontiere'],
      ['place-city', 'symbol', 'etiquette'],
    ];
    for (const [id, type, role] of attendus) {
      expect(roleDeLaCouche(id, type), id).toBe(role);
    }
  });

  it('range une étiquette d’eau parmi les étiquettes, pas parmi l’eau', () => {
    // Le piège : « water-name » contient « water ». Peint comme de l'eau, le
    // nom du lac disparaîtrait dans le lac.
    expect(roleDeLaCouche('water-name-lakeline', 'symbol')).toBe('etiquette');
    expect(roleDeLaCouche('road-label', 'symbol')).toBe('etiquette');
    expect(roleDeLaCouche('poi_label', 'symbol')).toBe('etiquette');
  });

  it('traite tout symbole comme une étiquette, quel que soit son nom', () => {
    expect(roleDeLaCouche('quelque-chose-de-nouveau', 'symbol')).toBe('etiquette');
  });

  it('ne touche pas à ce qu’il ne reconnaît pas', () => {
    expect(roleDeLaCouche('aeroway-runway', 'line')).toBe('autre');
    expect(retouchesPour('autre', 'line', PALETTES.clair)).toEqual([]);
  });

  it('ne pose jamais une propriété sur le mauvais type de couche', () => {
    // Poser « fill-color » sur une couche de lignes fait lever MapLibre, et
    // la carte reste blanche. C'est arrivé une fois, ça suffit.
    const roles = ['fond', 'terre', 'eau', 'vegetation', 'batiment', 'route', 'rail', 'frontiere', 'etiquette'] as const;
    const prefixes: Record<string, string> = {
      background: 'background-',
      fill: 'fill-',
      line: 'line-',
      symbol: 'text-',
    };
    for (const role of roles) {
      for (const [type, prefixe] of Object.entries(prefixes)) {
        for (const retouche of retouchesPour(role, type, PALETTES.clair)) {
          expect(retouche.propriete.startsWith(prefixe), `${role}/${type} → ${retouche.propriete}`).toBe(true);
        }
      }
    }
  });

  it('donne au fond la couleur du papier, pas du blanc', () => {
    const [fond] = retouchesPour('fond', 'background', PALETTES.clair);
    expect(fond?.valeur).toBe(PALETTES.clair.fond);
    // Le point qui compte : la carte doit être de la même matière que la page.
    expect(PALETTES.clair.fond).not.toBe('#ffffff');
  });

  it('a deux palettes complètes, avec les mêmes clés', () => {
    expect(Object.keys(PALETTES.clair).sort()).toEqual(Object.keys(PALETTES.sombre).sort());
    for (const palette of Object.values(PALETTES)) {
      for (const [role, couleur] of Object.entries(palette)) {
        expect(couleur, role).toMatch(/^#[0-9a-f]{6}$/u);
      }
    }
  });

  it('garde l’encre lisible sur son papier, dans les deux thèmes', () => {
    // Un contraste calculé, pas jugé à l'œil : une étiquette de ville doit se
    // lire sur le fond de carte, sinon la carte ne sert à rien.
    const luminance = (hex: string): number => {
      const canal = (n: number) => {
        const c = n / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const r = canal(parseInt(hex.slice(1, 3), 16));
      const v = canal(parseInt(hex.slice(3, 5), 16));
      const b = canal(parseInt(hex.slice(5, 7), 16));
      return 0.2126 * r + 0.7152 * v + 0.0722 * b;
    };
    for (const [nom, palette] of Object.entries(PALETTES)) {
      const [clair, sombre] = [luminance(palette.texte), luminance(palette.terre)].sort((a, b) => b - a);
      const rapport = (clair! + 0.05) / (sombre! + 0.05);
      expect(rapport, `${nom} : texte sur terre`).toBeGreaterThan(4.5);
    }
  });
});
