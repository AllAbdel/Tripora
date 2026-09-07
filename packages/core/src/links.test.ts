import { describe, expect, it } from 'vitest';
import { fragmenterMessage, nomPropose, premierLien, sourceDuLien } from './links.js';

describe('liens partagés dans la discussion', () => {
  it('ne rend cliquable que http et https', () => {
    // Le cœur du sujet : un message est du texte écrit par quelqu'un d'autre.
    // Un lien qui exécute du code au clic ne doit jamais exister.
    for (const piege of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'vbscript:msgbox(1)',
    ]) {
      const fragments = fragmenterMessage(`regarde ${piege} stp`);
      expect(fragments.some((f) => f.kind === 'link'), piege).toBe(false);
      // Rien n'est effacé pour autant : le texte reste lisible tel qu'écrit.
      expect(fragments.map((f) => (f.kind === 'text' ? f.text : '')).join('')).toContain(piege);
    }
  });

  it('découpe le texte autour des liens sans rien perdre', () => {
    const message = 'ce resto https://exemple.fr/resto a l’air top';
    const fragments = fragmenterMessage(message);
    expect(fragments).toHaveLength(3);
    expect(fragments[0]).toEqual({ kind: 'text', text: 'ce resto ' });
    expect(fragments[1]).toMatchObject({ kind: 'link', url: 'https://exemple.fr/resto' });
    expect(fragments[2]).toEqual({ kind: 'text', text: ' a l’air top' });
  });

  it('laisse la ponctuation de la phrase en dehors du lien', () => {
    const point = premierLien('va voir https://exemple.fr/a.');
    expect(point).toMatchObject({ url: 'https://exemple.fr/a' });

    const parenthese = premierLien('(voir https://exemple.fr/b)');
    expect(parenthese).toMatchObject({ url: 'https://exemple.fr/b' });

    // Une parenthèse qui fait partie de l'adresse doit rester : Wikipédia en
    // met dans ses titres, et tronquer donnerait un lien mort.
    const wiki = premierLien('https://fr.wikipedia.org/wiki/Nice_(ville)');
    expect(wiki).toMatchObject({ url: 'https://fr.wikipedia.org/wiki/Nice_(ville)' });
  });

  it('montre toujours le domaine, sans le « www »', () => {
    const lien = premierLien('https://www.tiktok.com/@x/video/123');
    expect(lien).toMatchObject({ host: 'tiktok.com', source: 'tiktok' });
  });

  it('reconnaît d’où vient le lien sans se laisser abuser par le nom', () => {
    expect(sourceDuLien('youtu.be')).toBe('youtube');
    expect(sourceDuLien('m.youtube.com')).toBe('youtube');
    expect(sourceDuLien('maps.google.fr')).toBe('carte');
    expect(sourceDuLien('booking.com')).toBe('reservation');
    // Un domaine qui contient le nom d'un service sans en être un reste « web » :
    // « youtube.com.piege.ru » n'est pas YouTube.
    expect(sourceDuLien('youtube.com.piege.ru')).toBe('web');
    expect(sourceDuLien('tiktok.com.exemple.net')).toBe('web');
    expect(sourceDuLien('exemple.fr')).toBe('web');
  });

  it('trouve plusieurs liens dans un même message', () => {
    const fragments = fragmenterMessage(
      'https://a.fr et aussi https://b.fr/x voilà',
    );
    const liens = fragments.filter((f) => f.kind === 'link');
    expect(liens).toHaveLength(2);
  });

  it('ne propose jamais le chemin comme nom d’épingle', () => {
    // Le chemin est du texte non vérifié : il n'a pas sa place comme titre.
    const lien = premierLien('https://exemple.fr/<script>alert(1)</script>')!;
    const nom = nomPropose(lien);
    expect(nom).toBe('exemple.fr');
    expect(nom).not.toContain('script');
  });

  it('ne dit rien quand il n’y a pas de lien', () => {
    expect(premierLien('on part en juillet ?')).toBeUndefined();
    expect(fragmenterMessage('bonjour')).toEqual([{ kind: 'text', text: 'bonjour' }]);
  });
});
