import { describe, expect, it } from 'vitest';
import { DICTIONNAIRES, FR, traduire, type CleDeTexte } from './textes';
import { estUneLangue, etiquetteIntl, ficheDe, LANGUES, langueDuSysteme } from './langues';

const CLES = Object.keys(FR) as CleDeTexte[];

describe('les langues', () => {
  it('suit la langue du navigateur quand elle est connue', () => {
    expect(langueDuSysteme(['de-AT', 'de', 'en'])).toBe('de');
    expect(langueDuSysteme(['ja'])).toBe('ja');
    // Le code régional est ignoré : on ne distingue pas le portugais du Brésil
    // de celui du Portugal, et prétendre le contraire demanderait deux
    // traductions.
    expect(langueDuSysteme(['pt-BR'])).toBe('pt');
  });

  it('descend la liste jusqu’à trouver une langue qu’il parle', () => {
    expect(langueDuSysteme(['is', 'ga', 'es-MX'])).toBe('es');
  });

  it('retombe sur le français quand il ne connaît rien', () => {
    expect(langueDuSysteme([])).toBe('fr');
    expect(langueDuSysteme(['is', 'ga'])).toBe('fr');
    expect(langueDuSysteme(['n’importe quoi'])).toBe('fr');
  });

  it('reconnaît ses propres codes, et rien d’autre', () => {
    expect(estUneLangue('ar')).toBe(true);
    expect(estUneLangue('fr-CA')).toBe(false);
    expect(estUneLangue(null)).toBe(false);
    expect(estUneLangue(42)).toBe(false);
  });

  it('sait que l’arabe se lit de droite à gauche, et lui seul', () => {
    const rtl = LANGUES.filter((fiche) => fiche.sens === 'rtl').map((fiche) => fiche.code);
    expect(rtl).toEqual(['ar']);
  });

  it('donne à Intl une étiquette qu’il comprend', () => {
    for (const fiche of LANGUES) {
      const etiquette = etiquetteIntl(fiche.code);
      expect(() => new Intl.DateTimeFormat(etiquette), etiquette).not.toThrow();
      expect(() => new Intl.NumberFormat(etiquette), etiquette).not.toThrow();
    }
    // Le portugais est précisé : sans région, Intl choisit le Brésil.
    expect(etiquetteIntl('pt')).toBe('pt-PT');
  });

  it('écrit chaque langue dans sa propre langue', () => {
    // Le test qui empêche la dérive vers « Arabe » et « Chinois » : quelqu'un
    // qui cherche sa langue dans une liste qu'il ne sait pas lire cherche la
    // forme qu'il connaît.
    expect(ficheDe('ar').nom).toBe('العربية');
    expect(ficheDe('ja').nom).toBe('日本語');
    expect(ficheDe('ru').nom).toBe('Русский');
    expect(ficheDe('de').nom).toBe('Deutsch');
  });
});

describe('les textes', () => {
  it('a un dictionnaire pour chaque langue annoncée', () => {
    for (const fiche of LANGUES) {
      expect(DICTIONNAIRES[fiche.code], fiche.code).toBeDefined();
    }
  });

  it('n’invente aucune clé qui n’existe pas en français', () => {
    // Une clé traduite mais absente du français est une clé morte : rien ne
    // l'affichera jamais, et elle donne l'illusion d'une couverture.
    for (const [langue, dictionnaire] of Object.entries(DICTIONNAIRES)) {
      for (const cle of Object.keys(dictionnaire)) {
        expect(CLES, `${langue} → ${cle}`).toContain(cle);
      }
    }
  });

  it('traduit les clés qu’il connaît', () => {
    expect(traduire('en', 'action.creer')).toBe('Create a trip');
    expect(traduire('ja', 'nav.trips')).toBe('トリップ');
    expect(traduire('ar', 'action.annuler')).toBe('إلغاء');
  });

  it('retombe sur le français plutôt que d’afficher un identifiant', () => {
    // Le repli est le point qui rend une traduction partielle acceptable :
    // il vaut mieux lire du français que « trip.publish.title ».
    for (const fiche of LANGUES) {
      for (const cle of CLES) {
        const texte = traduire(fiche.code, cle);
        expect(texte, `${fiche.code} → ${cle}`).toBeTruthy();
        expect(texte, `${fiche.code} → ${cle}`).not.toBe(cle);
      }
    }
  });

  it('dit « trip » et non « voyage » dans l’action principale', () => {
    // Le mot demandé. S'il redevient « voyage » un jour, que ce soit décidé.
    expect(FR['action.creer']).toContain('trip');
    expect(FR['action.creer']).not.toContain('voyage');
  });

  it('couvre entièrement la barre de navigation dans toutes les langues', () => {
    // La navigation est ce qu'on lit à chaque écran : une langue qui la
    // laisserait en français ne se sentirait pas traduite du tout.
    const barre: CleDeTexte[] = ['nav.trips', 'nav.carte', 'nav.budget', 'nav.profil'];
    for (const fiche of LANGUES) {
      for (const cle of barre) {
        expect(DICTIONNAIRES[fiche.code][cle], `${fiche.code} → ${cle}`).toBeTruthy();
      }
    }
  });

  it('n’a pas deux langues qui se ressemblent par accident', () => {
    // Un copier-coller entre deux dictionnaires se voit ici : deux langues qui
    // partagent tous leurs libellés de navigation n'ont pas été traduites.
    const signatures = LANGUES.map((fiche) =>
      ['nav.trips', 'nav.carte', 'nav.budget'].map((cle) => DICTIONNAIRES[fiche.code][cle as CleDeTexte]).join('|'),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});
