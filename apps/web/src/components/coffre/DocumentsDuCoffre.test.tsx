import 'fake-indexeddb/auto';
import { Blob as BlobDeNode } from 'node:buffer';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDuVoyage } from '@tripora/core';

/**
 * Le coffre avec un serveur : « garder sur cet appareil ». Le mode local des
 * tests de bout en bout n'a pas de serveur (tout y est déjà sur l'appareil),
 * d'où ce test, avec un serveur et une base locale simulés.
 */

const BILLET: DocumentDuVoyage = {
  id: 'd1',
  tripId: 'v1',
  nom: 'Carte d’embarquement',
  chemin: 'v1/carte.png',
  typeMime: 'image/png',
  taille: 4,
  prive: false,
  ajoutePar: 'moi',
  ajouteLe: '2026-09-24T10:00:00Z',
};

const serveur = vi.hoisted(() => ({
  telecharger: vi.fn(),
  lister: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/natif', () => ({
  estNatif: false,
  ouvrirDansLeNavigateur: vi.fn(),
  ouvrirUnFichier: vi.fn(),
}));
vi.mock('@/lib/documents', async (original) => ({
  ...(await original<typeof import('@/lib/documents')>()),
  // La requête de la liste appelle le serveur de l'intérieur du module : on
  // la remplace aussi.
  requeteDesDocuments: (tripId: string) => ({ queryKey: ['documents', tripId], queryFn: () => serveur.lister() }),
  getDocuments: () => ({
    lister: serveur.lister,
    telecharger: serveur.telecharger,
    espace: async () => null,
    ecouter: () => () => {},
    adresse: vi.fn(),
    deposer: vi.fn(),
    modifier: vi.fn(),
    supprimer: vi.fn(),
  }),
}));

const { DocumentsDuCoffre } = await import('./DocumentsDuCoffre');
const { copieDe, oublierToutesLesCopies } = await import('@/lib/documentsHorsLigne');

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DocumentsDuCoffre tripId="v1" moi="moi" estOrganisateur />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await oublierToutesLesCopies();
  serveur.lister.mockResolvedValue([BILLET]);
  serveur.telecharger.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:photo');
  URL.revokeObjectURL = vi.fn();
});

describe('garder un document sur cet appareil', () => {
  it('le télécharge une fois, puis l’ouvre sans le serveur', async () => {
    serveur.telecharger.mockResolvedValue(new BlobDeNode(['%PNG'], { type: 'image/png' }));
    afficher();

    fireEvent.click(await screen.findByRole('button', { name: 'Garder « Carte d’embarquement » sur cet appareil' }));
    expect(
      await screen.findByRole('button', { name: 'Retirer « Carte d’embarquement » de cet appareil' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/1 document gardé sur cet appareil .* il s’ouvre sans réseau/u)).toBeInTheDocument();
    expect(serveur.telecharger).toHaveBeenCalledTimes(1);
    expect((await copieDe('v1/carte.png'))?.size).toBe(4);

    // Le réseau tombe : la photo s'ouvre quand même, depuis la copie.
    serveur.telecharger.mockRejectedValue(new Error('hors ligne'));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir « Carte d’embarquement »' }));
    const visionneuse = await screen.findByRole('dialog', { name: 'Carte d’embarquement' });
    expect(visionneuse).toBeInTheDocument();
    expect(serveur.telecharger).toHaveBeenCalledTimes(1);
  });

  it('retirée de l’appareil, la copie disparaît', async () => {
    serveur.telecharger.mockResolvedValue(new BlobDeNode(['%PNG'], { type: 'image/png' }));
    afficher();
    fireEvent.click(await screen.findByRole('button', { name: 'Garder « Carte d’embarquement » sur cet appareil' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer « Carte d’embarquement » de cet appareil' }));
    await waitFor(async () => expect(await copieDe('v1/carte.png')).toBeUndefined());
    expect(await screen.findByRole('button', { name: 'Garder « Carte d’embarquement » sur cet appareil' })).toBeInTheDocument();
  });

  it('un document retiré du coffre emporte sa copie', async () => {
    serveur.telecharger.mockResolvedValue(new BlobDeNode(['%PNG'], { type: 'image/png' }));
    const { unmount } = afficher();
    fireEvent.click(await screen.findByRole('button', { name: 'Garder « Carte d’embarquement » sur cet appareil' }));
    await screen.findByRole('button', { name: 'Retirer « Carte d’embarquement » de cet appareil' });
    unmount();

    // Un autre membre l'a retiré : la liste fraîche ne le contient plus.
    serveur.lister.mockResolvedValue([]);
    afficher();
    await waitFor(async () => expect(await copieDe('v1/carte.png')).toBeUndefined());
  });
});
