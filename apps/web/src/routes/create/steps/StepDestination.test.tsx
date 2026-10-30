import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTripDraft } from '@/stores/tripDraft';
import { resumeDuBrouillon } from '@/lib/resumeDuBrouillon';

// Pas de carte du monde dans ce test : seul le catalogue répond.
vi.mock('@/lib/geocode', () => ({ chercherVilles: async () => [], retenirVille: async () => {} }));

const { StepDestination } = await import('./StepDestination');

beforeEach(() => useTripDraft.getState().reset());

describe('« Surprends-nous », mais par où ?', () => {
  it('cherche partout par défaut, ou sur les continents choisis', async () => {
    render(<StepDestination />);
    expect(screen.getByRole('button', { name: 'Partout' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Asie' }));
    await userEvent.click(screen.getByRole('button', { name: 'Afrique' }));
    expect(useTripDraft.getState().regions).toEqual(['afrique', 'asie']);
    expect(screen.getByRole('button', { name: 'Partout' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/ne cherche que là, même loin/u)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Partout' }));
    expect(useTripDraft.getState().regions).toEqual([]);
  });

  it('les continents disparaissent quand on sait déjà où aller', async () => {
    render(<StepDestination />);
    await userEvent.click(screen.getByRole('radio', { name: /On sait déjà où aller/u }));
    expect(screen.queryByRole('button', { name: 'Partout' })).not.toBeInTheDocument();
  });

  it('le résumé du trip reprend les continents choisis', () => {
    useTripDraft.getState().patch({ regions: ['afrique', 'asie'] });
    const destination = resumeDuBrouillon(useTripDraft.getState()).find(
      (ligne) => ligne.terme === 'Destination',
    );
    expect(destination?.valeur).toBe('Tripora vous propose des destinations (Afrique, Asie)');
  });
});

describe('« On sait déjà où aller »', () => {
  it('taper le nom entier d’une ville la choisit : plus besoin de toucher la pastille', async () => {
    render(<StepDestination />);
    await userEvent.click(screen.getByRole('radio', { name: /On sait déjà où aller/u }));
    // Sans accent, comme on le tape au téléphone.
    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher une destination' }), 'Bogota');
    expect(useTripDraft.getState().destinationMode).toBe('fixed');
    expect(useTripDraft.getState().destinationIds).toEqual(['bogota']);
    expect(screen.getByText('1 destination choisie')).toBeInTheDocument();
  });

  it('un début de nom ne choisit rien, et une ville retirée n’est pas reprise d’office', async () => {
    render(<StepDestination />);
    await userEvent.click(screen.getByRole('radio', { name: /On sait déjà où aller/u }));
    const champ = screen.getByRole('textbox', { name: 'Chercher une destination' });
    await userEvent.type(champ, 'Bogo');
    expect(useTripDraft.getState().destinationIds).toEqual([]);
    await userEvent.type(champ, 'ta');
    expect(useTripDraft.getState().destinationIds).toEqual(['bogota']);
    // On la retire : elle reste retirée tant qu'on ne retape pas.
    await userEvent.click(screen.getAllByRole('button', { name: 'Bogotá' })[0]!);
    expect(useTripDraft.getState().destinationIds).toEqual([]);
  });
});
