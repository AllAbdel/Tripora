import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REGION_PAR_DEFAUT, reglerLaRegion } from '@tripora/core';
import { useLangue } from '@/stores/langue';
import { CePendant, OccasionsDePartir } from './OccasionsDePartir';

const LYON = { name: 'Lyon', lat: 45.764, lng: 4.8357, country: 'France' };
const LONDRES = { name: 'Londres-Heathrow', lat: 51.47, lng: -0.4543, country: 'Royaume-Uni' };

describe('les bons moments pour partir', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    useLangue.setState({ preference: 'fr' });
  });
  afterEach(() => {
    vi.useRealTimers();
    reglerLaRegion({ ...REGION_PAR_DEFAUT });
  });

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

  it('au départ de Londres, propose les fériés anglais, sans zones ni vacances françaises', () => {
    render(<OccasionsDePartir origin={LONDRES} onChoisir={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Zone de vacances scolaires' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vacances de la Toussaint|Armistice/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Noël et Boxing Day/ })).toBeInTheDocument();
    expect(screen.getByText(/ne sont connues que pour la France/)).toBeInTheDocument();
  });

  it('ne dit rien des vacances françaises pour des dates choisies au départ de Londres', () => {
    render(<CePendant debut="2026-10-28" fin="2026-11-02" origin={LONDRES} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('nomme les fériés et écrit la phrase en anglais quand l’interface est en anglais', () => {
    useLangue.setState({ preference: 'en' });
    // Dans l'application, les dates suivent la langue (stores/region.ts) ; ici, on le pose à la main.
    reglerLaRegion({ locale: 'en-US' });
    render(<OccasionsDePartir origin={LONDRES} onChoisir={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Christmas Day and Boxing Day/ })).toBeInTheDocument();
    render(<CePendant debut="2026-10-28" fin="2026-11-02" origin={LYON} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'During the All Saints’ holidays (zone A): busier, and prices often higher. Public holiday: All Saints’ Day (Sun, Nov 1).',
    );
  });
});

