import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTheme } from '@/stores/theme';
import { ChoixDuStyle } from './ChoixDuStyle';

beforeEach(() => {
  useTheme.setState({ style: 'epure' });
  delete document.documentElement.dataset.style;
});

describe('le choix du style', () => {
  it('épuré par défaut ; le carnet se choisit, et habille aussitôt la page', async () => {
    render(<ChoixDuStyle />);
    const groupe = screen.getByRole('radiogroup', { name: 'Style' });
    expect(groupe).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Épuré/u })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('radio', { name: /Carnet/u }));
    expect(useTheme.getState().style).toBe('carnet');
    expect(document.documentElement.dataset.style).toBe('carnet');
    expect(screen.getByRole('radio', { name: /Carnet/u })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('radio', { name: /Épuré/u }));
    expect(document.documentElement.dataset.style).toBe('epure');
  });
});
