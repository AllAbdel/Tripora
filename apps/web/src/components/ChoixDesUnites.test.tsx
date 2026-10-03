import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatTemperature, REGION_PAR_DEFAUT, reglerLaRegion } from '@tripora/core';
import { useLangue } from '@/stores/langue';
import { appliquerLaRegion, useRegion } from '@/stores/region';
import { ChoixDesUnites } from './ChoixDesUnites';

afterEach(() => {
  useRegion.setState({ devise: 'auto', temperature: 'auto', distance: 'auto' });
  reglerLaRegion({ ...REGION_PAR_DEFAUT });
});

describe('le choix des unités', () => {
  it('passe en Fahrenheit et en miles, et le cœur écrit les chiffres en conséquence', async () => {
    useLangue.setState({ preference: 'fr' });
    render(<ChoixDesUnites />);
    await userEvent.click(screen.getByRole('button', { name: 'Fahrenheit (°F)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Miles' }));
    expect(useRegion.getState()).toMatchObject({ temperature: 'F', distance: 'mi' });
    appliquerLaRegion();
    expect(formatTemperature(24)).toBe('75 °F');
  });

  it('propose les devises par leur nom, dans la langue de l’interface', () => {
    useLangue.setState({ preference: 'fr' });
    render(<ChoixDesUnites />);
    expect(screen.getByRole('option', { name: /Franc suisse \(CHF\)/u })).toBeInTheDocument();
  });
});
