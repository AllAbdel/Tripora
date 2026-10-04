import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REGION_PAR_DEFAUT, reglerLaRegion } from '@tripora/core';
import { SaisieEnDevise } from './SaisieEnDevise';

afterEach(() => reglerLaRegion({ ...REGION_PAR_DEFAUT }));

/** Le champ, branché comme dans un écran : la somme stockée revient en prop. */
function Champ({ depart = null, surChanger }: { depart?: number | null; surChanger?: (cents: number | null) => void }) {
  const [cents, setCents] = useState<number | null>(depart);
  return (
    <>
      <SaisieEnDevise
        label="Budget"
        entier
        cents={cents}
        onChange={(valeur) => {
          setCents(valeur);
          surChanger?.(valeur);
        }}
      />
      <button type="button" onClick={() => setCents(40_000)}>
        400 €
      </button>
    </>
  );
}

describe('un budget tapé dans sa devise', () => {
  it('reste en euros pour qui compte en euros', async () => {
    const surChanger = vi.fn();
    render(<Champ surChanger={surChanger} />);
    expect(screen.getByText('€')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Budget' }), '450');
    expect(surChanger).toHaveBeenLastCalledWith(45_000);
    expect(screen.queryByText(/Enregistré en euros/u)).not.toBeInTheDocument();
  });

  it('se tape en dollars, se garde en euros, et le dit', async () => {
    reglerLaRegion({ locale: 'en-US', devise: 'USD', tauxDeLaDevise: 1.17 });
    const surChanger = vi.fn();
    render(<Champ surChanger={surChanger} />);
    expect(screen.getByText('$')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Budget' }), '2000');
    expect(surChanger).toHaveBeenLastCalledWith(170_940);
    // Ce qui est tapé reste tel quel, sans repasser par l'euro à chaque frappe.
    expect(screen.getByRole('textbox', { name: 'Budget' })).toHaveValue('2000');
    expect(screen.getByText(/Enregistré en euros au taux du jour/u)).toHaveTextContent('€1,709');
  });

  it('suit une somme posée ailleurs, convertie dans la devise du champ', async () => {
    reglerLaRegion({ locale: 'ja-JP', devise: 'JPY', tauxDeLaDevise: 159.65 });
    render(<Champ depart={170_000} />);
    // 1 700 € ≈ 271 405 ¥.
    expect(screen.getByRole('textbox', { name: 'Budget' })).toHaveValue('271405');
    await userEvent.click(screen.getByRole('button', { name: '400 €' }));
    expect(screen.getByRole('textbox', { name: 'Budget' })).toHaveValue('63860');
  });
});
