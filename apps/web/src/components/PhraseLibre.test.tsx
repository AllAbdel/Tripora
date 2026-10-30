import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeDiscovered } from '@tripora/core';
import { useTripDraft } from '@/stores/tripDraft';

const ia = vi.hoisted(() => ({ brouillon: {} as Record<string, unknown> }));
vi.mock('@/lib/ai', () => ({
  iaDisponible: async () => true,
  comprendrePhrase: async () => ({ statut: 'ok', brouillon: ia.brouillon }),
  messageIA: () => '',
}));

const carte = vi.hoisted(() => ({ villes: [] as unknown[] }));
vi.mock('@/lib/geocode', () => ({
  chercherVilles: async () => carte.villes,
  retenirVille: async () => {},
}));

const { PhraseLibre } = await import('./PhraseLibre');

async function direEtReprendre(phrase: string) {
  render(<PhraseLibre />);
  await userEvent.type(await screen.findByRole('textbox'), phrase);
  await userEvent.click(screen.getByRole('button', { name: 'Remplir à partir de ma phrase' }));
  await userEvent.click(await screen.findByRole('button', { name: /Reprendre/u }));
}

beforeEach(() => {
  useTripDraft.getState().reset();
  carte.villes = [];
});

describe('une destination nommée dans la phrase n’est jamais perdue', () => {
  it('connue du catalogue : choisie aussitôt', async () => {
    ia.brouillon = { origin: 'Alger', destination: 'Bogota' };
    await direEtReprendre('On part d’Alger pour Bogota');
    expect(useTripDraft.getState().destinationMode).toBe('fixed');
    expect(useTripDraft.getState().destinationIds).toEqual(['bogota']);
  });

  it('inconnue du catalogue : retrouvée sur la carte du monde', async () => {
    ia.brouillon = { destination: 'Villa de Leyva' };
    carte.villes = [
      makeDiscovered({ id: 'villa-de-leyva', name: 'Villa de Leyva', country: 'Colombie', countryCode: 'CO', lat: 5.63, lng: -73.52 }),
    ];
    await direEtReprendre('Une semaine à Villa de Leyva');
    await waitFor(() => expect(useTripDraft.getState().destinationIds).toHaveLength(1));
    expect(useTripDraft.getState().destinationMode).toBe('fixed');
  });

  it('introuvable : le voyage reste en « on sait déjà où aller », l’étape « Où ? » la demandera', async () => {
    ia.brouillon = { destination: 'Vulcania' };
    await direEtReprendre('On va à Vulcania');
    await waitFor(() => expect(useTripDraft.getState().destinationMode).toBe('fixed'));
    expect(useTripDraft.getState().destinationIds).toEqual([]);
  });
});
