import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { findDestination } from '@tripora/core';
import { InfosPratiques } from './InfosPratiques';
import { usePasseports } from '@/stores/passeports';

describe('les infos pratiques d’une destination', () => {
  afterEach(() => usePasseports.setState({ passeports: [] }));

  it('à Londres depuis la France : adaptateur, 999, à gauche', () => {
    render(<MemoryRouter><InfosPratiques destination={findDestination('londres')!} paysDeDepart="France" /></MemoryRouter>);
    expect(screen.getByText('Adaptateur nécessaire.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '999' })).toHaveAttribute('href', 'tel:999');
    expect(screen.getByText('On roule à gauche.')).toBeInTheDocument();
    expect(screen.getByText(/GBP/u)).toBeInTheDocument();
  });

  it('à Tokyo : le courant faible est signalé', () => {
    render(<MemoryRouter><InfosPratiques destination={findDestination('tokyo')!} paysDeDepart="France" /></MemoryRouter>);
    expect(screen.getByText(/Courant faible/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Police 110' })).toHaveAttribute('href', 'tel:110');
  });

  it('en Allemagne : pas d’adaptateur', () => {
    render(<MemoryRouter><InfosPratiques destination={findDestination('berlin')!} paysDeDepart="France" /></MemoryRouter>);
    expect(screen.getByText('Pas besoin d’adaptateur.')).toBeInTheDocument();
    expect(screen.getByText('On roule à droite.')).toBeInTheDocument();
  });

  it('sans pays de départ connu, ne tranche pas sur l’adaptateur', () => {
    render(<MemoryRouter><InfosPratiques destination={findDestination('londres')!} paysDeDepart={undefined} /></MemoryRouter>);
    expect(screen.queryByText('Adaptateur nécessaire.')).not.toBeInTheDocument();
    expect(screen.getByText(/Prises de type G/u)).toBeInTheDocument();
  });

  it('le visa, chargé à la demande : une ESTA pour un Français à New York', async () => {
    render(<MemoryRouter><InfosPratiques destination={findDestination('new-york')!} paysDeDepart="France" /></MemoryRouter>);
    expect(await screen.findByText(/Autorisation électronique à demander en ligne/u)).toBeInTheDocument();
    expect(screen.getByText(/d’après Passport Index/u)).toBeInTheDocument();
  });

  it('sans visa dans l’espace Schengen, et rien dans son propre pays', async () => {
    const { unmount } = render(<MemoryRouter><InfosPratiques destination={findDestination('berlin')!} paysDeDepart="France" /></MemoryRouter>);
    expect(await screen.findByText('Sans visa.')).toBeInTheDocument();
    unmount();
    render(<MemoryRouter><InfosPratiques destination={findDestination('bordeaux')!} paysDeDepart="France" /></MemoryRouter>);
    // Laisser au module le temps de se charger avant de conclure à l'absence.
    await import('@tripora/core/visas');
    await new Promise((fin) => setTimeout(fin, 0));
    expect(screen.queryByText('Visa')).not.toBeInTheDocument();
  });

  it('sans passeport déclaré, invite à le donner', async () => {
    render(<MemoryRouter><InfosPratiques destination={findDestination('new-york')!} paysDeDepart="France" /></MemoryRouter>);
    expect(await screen.findByText(/Pour un passeport du pays de départ/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Indiquer mon passeport' })).toHaveAttribute('href', '/profil#passeports');
  });

  it('avec le passeport déclaré : un Algérien parti de Paris a besoin d’un visa pour Londres', async () => {
    usePasseports.setState({ passeports: ['DZ'] });
    render(<MemoryRouter><InfosPratiques destination={findDestination('londres')!} paysDeDepart="France" /></MemoryRouter>);
    expect(await screen.findByText('Attention :')).toBeInTheDocument();
    expect(screen.getByText(/Avec votre passeport \(Algérie\)/u)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Indiquer mon passeport' })).not.toBeInTheDocument();
  });

  it('avec deux passeports, retient le plus simple', async () => {
    usePasseports.setState({ passeports: ['DZ', 'FR'] });
    render(<MemoryRouter><InfosPratiques destination={findDestination('berlin')!} paysDeDepart="Algérie" /></MemoryRouter>);
    expect(await screen.findByText('Sans visa.')).toBeInTheDocument();
    expect(screen.getByText(/Avec votre passeport \(France\)/u)).toBeInTheDocument();
  });
});
