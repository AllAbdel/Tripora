import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MesPasseports } from './MesPasseports';
import { usePasseports } from '@/stores/passeports';

describe('mes passeports', () => {
  afterEach(() => usePasseports.setState({ passeports: [] }));

  it('ajoute un passeport, puis une autre nationalité, et les retire', async () => {
    const utilisateur = userEvent.setup();
    render(<MesPasseports />);
    const choix = await screen.findByRole('combobox', { name: 'Pays de mon passeport' });
    await screen.findByRole('option', { name: 'Algérie' });
    await utilisateur.selectOptions(choix, 'DZ');
    expect(usePasseports.getState().passeports).toEqual(['DZ']);

    await utilisateur.selectOptions(screen.getByRole('combobox', { name: 'Une autre nationalité' }), 'FR');
    expect(usePasseports.getState().passeports).toEqual(['DZ', 'FR']);
    // Un passeport choisi ne se propose plus.
    expect(screen.queryByRole('option', { name: 'Algérie' })).not.toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: 'Retirer le passeport Algérie' }));
    expect(usePasseports.getState().passeports).toEqual(['FR']);
  });

  it('trois au plus', () => {
    const { ajouter } = usePasseports.getState();
    for (const code of ['DZ', 'FR', 'CA', 'MA', 'fr']) ajouter(code);
    expect(usePasseports.getState().passeports).toEqual(['DZ', 'FR', 'CA']);
  });
});
