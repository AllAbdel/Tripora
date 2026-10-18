import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTheme } from '@/stores/theme';
import { BruitagesDePlumio } from './BruitagesDePlumio';

const ecouter = vi.hoisted(() => vi.fn());
vi.mock('@/components/mascotte/bruitages', () => ({ ecouterPlumio: ecouter }));

beforeEach(() => {
  ecouter.mockClear();
  useTheme.setState({ bruitagesPlumio: true, retours: 'vibrations' });
});

describe('le réglage des sons discrets', () => {
  it('actifs par défaut ; on les coupe, puis on les rallume en l’entendant', async () => {
    render(<BruitagesDePlumio />);
    const interrupteur = screen.getByRole('switch', { name: 'Sons discrets' });
    expect(interrupteur).toHaveAccessibleDescription(/note douce/u);
    expect(interrupteur).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(interrupteur);
    expect(useTheme.getState().bruitagesPlumio).toBe(false);
    expect(interrupteur).toHaveAttribute('aria-checked', 'false');
    expect(ecouter).not.toHaveBeenCalled();

    await userEvent.click(interrupteur);
    expect(useTheme.getState().bruitagesPlumio).toBe(true);
    expect(ecouter).toHaveBeenCalledTimes(1);
  });

  it('dit qu’ils se taisent quand les retours sont sur « Rien »', () => {
    useTheme.setState({ retours: 'silencieux' });
    render(<BruitagesDePlumio />);
    expect(screen.getByText(/Muets tant que les retours sont sur « Rien »/u)).toBeInTheDocument();
  });
});
