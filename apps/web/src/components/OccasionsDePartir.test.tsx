import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CePendant, OccasionsDePartir } from './OccasionsDePartir';

const LYON = { name: 'Lyon', lat: 45.764, lng: 4.8357, country: 'France' };

describe('les bons moments pour partir', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('devine la zone du départ, et propose ponts et vacances qui arrivent', async () => {
    const choisir = vi.fn();
    render(<OccasionsDePartir origin={LYON} onChoisir={choisir} />);
    expect(screen.getByRole('button', { name: 'A (déduite)' })).toHaveAttribute('aria-pressed', 'true');

    // Le 11 novembre 2026 tombe un mercredi : cinq jours pour deux posés.
    const armistice = screen.getByRole('button', { name: /Armistice/ });
    expect(within(armistice).getByText('5 jours, 2 jours à poser')).toBeInTheDocument();
    await userEvent.click(armistice);
    expect(choisir).toHaveBeenCalledWith(
      expect.objectContaining({ debut: '2026-11-11', fin: '2026-11-15', jours: 5 }),
    );
    expect(screen.getByRole('button', { name: /Vacances de la Toussaint/ })).toBeInTheDocument();
  });

  it('dit ce que des dates choisies recoupent', () => {
    render(<CePendant debut="2026-10-28" fin="2026-11-02" origin={LYON} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pendant les vacances de la Toussaint (zone A) : plus de monde, et des prix souvent plus hauts.',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Jour férié : Toussaint');
  });
});
