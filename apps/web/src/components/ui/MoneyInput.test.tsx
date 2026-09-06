import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseAmountToCents } from '@tripora/core';
import { MoneyInput } from './MoneyInput';

describe('saisie d’un montant', () => {
  it('accepte la virgule décimale, que type="number" refusait', async () => {
    const onChange = vi.fn();
    // Un champ numérique aurait avalé la virgule en silence.
    render(<MoneyInput label="Montant" value="48" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Montant'), ',');
    expect(onChange).toHaveBeenLastCalledWith('48,');
  });

  it('refuse les lettres plutôt que de les laisser passer', async () => {
    const onChange = vi.fn();
    render(<MoneyInput label="Montant" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Montant'), 'a');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('refuse les décimales sur un budget entier', async () => {
    const onChange = vi.fn();
    render(<MoneyInput label="Budget" value="40" onChange={onChange} entier />);
    await userEvent.type(screen.getByLabelText('Budget'), ',');
    expect(onChange).toHaveBeenLastCalledWith('40');
  });

  it('garde le pavé numérique sur mobile', () => {
    render(<MoneyInput label="Montant" value="" onChange={vi.fn()} />);
    const champ = screen.getByLabelText('Montant');
    expect(champ).toHaveAttribute('inputmode', 'decimal');
    // Et surtout pas type="number", qui rejetterait la virgule.
    expect(champ).toHaveAttribute('type', 'text');
  });

  it('produit une valeur que le moteur sait convertir', () => {
    // Le contrat entre la saisie et le calcul : les deux séparateurs passent.
    expect(parseAmountToCents('48,50')).toBe(4850);
    expect(parseAmountToCents('48.50')).toBe(4850);
  });
});
