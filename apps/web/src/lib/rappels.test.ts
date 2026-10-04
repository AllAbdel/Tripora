import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rappel } from '@tripora/core';

// Le greffon n'existe que sur le téléphone : on le remplace par un faux qui
// garde ce qu'on lui demande.
const greffon = vi.hoisted(() => ({
  enAttente: [] as { id: number; title: string; body: string; extra?: unknown }[],
  schedule: vi.fn(),
  cancel: vi.fn(),
  requestPermissions: vi.fn(),
  ecouteur: null as null | ((action: { notification: { extra?: unknown } }) => void),
}));

vi.mock('./natif', () => ({ estNatif: true }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    getPending: async () => ({ notifications: greffon.enAttente }),
    schedule: greffon.schedule,
    cancel: greffon.cancel,
    requestPermissions: greffon.requestPermissions,
    addListener: async (_evenement: string, ecouter: typeof greffon.ecouteur) => {
      greffon.ecouteur = ecouter;
      return { remove: vi.fn() };
    },
  },
}));

const { activerLesRappels, desactiverLesRappels, oublierLesAutresVoyages, poserLesRappels, suivreLesAppuis } =
  await import('./rappels');

function rappel(partiel: Partial<Rappel>): Rappel {
  return {
    id: 1,
    genre: 'veille-du-depart',
    tripId: 'v1',
    quand: new Date('2030-01-01T18:00:00Z'),
    titre: 'Départ demain',
    texte: 'Passeport',
    lien: '/voyages/v1',
    ...partiel,
  };
}

beforeEach(() => {
  localStorage.clear();
  greffon.enAttente = [];
  greffon.schedule.mockReset();
  greffon.cancel.mockReset();
  greffon.requestPermissions.mockReset();
});

describe('les rappels sur le téléphone', () => {
  it('ne pose rien tant que la personne n’a pas dit oui', async () => {
    await poserLesRappels('v1', [rappel({})]);
    expect(greffon.schedule).not.toHaveBeenCalled();
  });

  it('retient le oui, et le non du téléphone', async () => {
    greffon.requestPermissions.mockResolvedValueOnce({ display: 'denied' });
    expect(await activerLesRappels()).toBe(false);
    expect(localStorage.getItem('tripora.rappels')).toBe('refuses');
    greffon.requestPermissions.mockResolvedValueOnce({ display: 'granted' });
    expect(await activerLesRappels()).toBe(true);
    expect(localStorage.getItem('tripora.rappels')).toBe('actifs');
  });

  it('remplace les rappels du voyage, sans alarme exacte, et laisse les autres', async () => {
    localStorage.setItem('tripora.rappels', 'actifs');
    greffon.enAttente = [
      { id: 10, title: '', body: '', extra: { tripId: 'v1', genre: 'veille-du-depart' } },
      { id: 11, title: '', body: '', extra: { tripId: 'v1', genre: 'tache' } },
      { id: 12, title: '', body: '', extra: { tripId: 'v2', genre: 'veille-du-depart' } },
    ];
    await poserLesRappels('v1', [rappel({ id: 42 }), rappel({ id: 43, genre: 'tache' })], ['veille-du-depart', 'retour']);

    // Seul le rappel de même genre du même voyage part.
    expect(greffon.cancel).toHaveBeenCalledWith({ notifications: [{ id: 10 }] });
    const [{ notifications }] = greffon.schedule.mock.calls[0] as [{ notifications: Record<string, unknown>[] }];
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: 42,
      title: 'Départ demain',
      isExactNotification: false,
      extra: { tripId: 'v1', genre: 'veille-du-depart', lien: '/voyages/v1' },
    });
  });

  it('oublie les voyages disparus de la liste', async () => {
    localStorage.setItem('tripora.rappels', 'actifs');
    greffon.enAttente = [
      { id: 10, title: '', body: '', extra: { tripId: 'v1' } },
      { id: 12, title: '', body: '', extra: { tripId: 'supprime' } },
    ];
    await oublierLesAutresVoyages(new Set(['v1']));
    expect(greffon.cancel).toHaveBeenCalledWith({ notifications: [{ id: 12 }] });
  });

  it('coupés, ils disparaissent tous', async () => {
    localStorage.setItem('tripora.rappels', 'actifs');
    greffon.enAttente = [{ id: 10, title: '', body: '' }];
    await desactiverLesRappels();
    expect(greffon.cancel).toHaveBeenCalledWith({ notifications: [{ id: 10 }] });
    expect(localStorage.getItem('tripora.rappels')).toBe('refuses');
  });

  it('un appui ouvre l’écran du rappel, jamais une adresse extérieure', async () => {
    const ouvrir = vi.fn();
    const arreter = suivreLesAppuis(ouvrir);
    await vi.waitFor(() => expect(greffon.ecouteur).not.toBeNull());
    greffon.ecouteur?.({ notification: { extra: { lien: '/voyages/v1/budget' } } });
    greffon.ecouteur?.({ notification: { extra: { lien: 'https://ailleurs.example' } } });
    greffon.ecouteur?.({ notification: { extra: { lien: '//ailleurs.example' } } });
    expect(ouvrir.mock.calls).toEqual([['/voyages/v1/budget']]);
    arreter();
  });
});
