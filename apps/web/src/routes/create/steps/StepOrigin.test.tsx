import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTripDraft } from '@/stores/tripDraft';

// Pas de carte du monde dans ce test : seules les villes et les pays du catalogue.
vi.mock('@/lib/geocode', () => ({ chercherVilles: async () => [] }));

const { StepOrigin } = await import('./StepOrigin');

beforeEach(() => useTripDraft.getState().reset());

describe('le départ', () => {
  it('propose de partir de tout un pays, et dit quels aéroports seront comparés', async () => {
    render(<StepOrigin />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher une ville de départ' }), 'France');
    const pays = screen.getByRole('radio', { name: /France \(tous les aéroports\)/u });
    await userEvent.click(pays);

    const origine = useTripDraft.getState().origin;
    expect(origine?.name).toBe('France (tous les aéroports)');
    expect(origine?.iata).toContain('BVA');
    expect(screen.getByText(/^Prix comparés au départ de : Paris, Paris-Beauvais, Lyon/u)).toBeInTheDocument();
    // Un pays trouvé n'est pas « aucune ville ».
    expect(screen.queryByText(/Aucune ville ne correspond/u)).not.toBeInTheDocument();
  });

  it('compare aussi les aéroports voisins d’une ville', async () => {
    render(<StepOrigin />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher une ville de départ' }), 'Lyon');
    await userEvent.click(screen.getAllByRole('radio', { name: /^Lyon/u })[0]!);
    expect(screen.getByText(/^Prix comparés au départ de : Lyon, .*Genève/u)).toBeInTheDocument();
  });
});
