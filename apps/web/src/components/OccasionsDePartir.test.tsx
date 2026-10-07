import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REGION_PAR_DEFAUT, reglerLaRegion } from '@tripora/core';
import { useLangue } from '@/stores/langue';
import { CePendant, OccasionsDePartir } from './OccasionsDePartir';

const LYON = { name: 'Lyon', lat: 45.764, lng: 4.8357, country: 'France' };
const LONDRES = { name: 'Londres-Heathrow', lat: 51.47, lng: -0.4543, country: 'Royaume-Uni' };
const MUNICH = { name: 'Munich', lat: 48.137, lng: 11.575, country: 'Allemagne' };
const LIEGE = { name: 'Liège', lat: 50.633, lng: 5.567, country: 'Belgique' };

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
    expect(screen.getByText(/ne connaît pas encore les vacances scolaires de ce pays/)).toBeInTheDocument();
  });

  it('au départ de Munich, devine la Bavière et propose ses vacances', async () => {
    const choisir = vi.fn();
    render(<OccasionsDePartir origin={MUNICH} onChoisir={choisir} />);
    const liste = screen.getByRole('combobox', { name: 'Vacances de la région' });
    expect(liste).toHaveValue('DE-BY');
    expect(within(liste).getByRole('option', { name: 'Bavière (déduite)' })).toBeInTheDocument();
    const automne = screen.getByRole('button', { name: /Vacances d’automne \(Bavière\)/ });
    await userEvent.click(automne);
    expect(choisir).toHaveBeenCalledWith(expect.objectContaining({ debut: '2026-11-02', fin: '2026-11-06' }));
    // La source, sous licence ODbL, se cite là où ses données se lisent.
    expect(screen.getByText('Vacances scolaires : OpenHolidays.')).toBeInTheDocument();

    // Une autre région, choisie à la main.
    await userEvent.selectOptions(liste, 'DE-HH');
    expect(screen.queryByRole('button', { name: /\(Bavière\)/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /\(Hambourg\)/ }).length).toBeGreaterThan(0);
  });

  it('en Belgique, la communauté en puces, devinée d’après la ville', () => {
    render(<OccasionsDePartir origin={LIEGE} onChoisir={vi.fn()} />);
    const groupe = screen.getByRole('group', { name: 'Région des vacances scolaires' });
    expect(within(groupe).getByRole('button', { name: 'Communauté française (déduite)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(groupe).getByRole('button', { name: 'Communauté flamande' })).toBeInTheDocument();
  });

  it('dit les vacances étrangères que des dates recoupent, région comprise', () => {
    render(<CePendant debut="2026-11-03" fin="2026-11-05" origin={MUNICH} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pendant les vacances d’automne (Bavière) : plus de monde, et des prix souvent plus hauts.',
    );
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

  it('écrit en anglais les vacances étrangères et leur région', () => {
    useLangue.setState({ preference: 'en' });
    reglerLaRegion({ locale: 'en-US' });
    render(<CePendant debut="2026-11-03" fin="2026-11-05" origin={MUNICH} />);
    expect(screen.getByRole('status')).toHaveTextContent('During the autumn holidays (Bavaria): busier, and prices often higher.');
  });
});

