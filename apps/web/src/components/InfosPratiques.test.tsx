import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { findDestination } from '@tripora/core';
import { InfosPratiques } from './InfosPratiques';

describe('les infos pratiques d’une destination', () => {
  it('à Londres depuis la France : adaptateur, 999, à gauche', () => {
    render(<InfosPratiques destination={findDestination('londres')!} paysDeDepart="France" />);
    expect(screen.getByText('Adaptateur nécessaire.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '999' })).toHaveAttribute('href', 'tel:999');
    expect(screen.getByText('On roule à gauche.')).toBeInTheDocument();
    expect(screen.getByText(/GBP/u)).toBeInTheDocument();
  });

  it('à Tokyo : le courant faible est signalé', () => {
    render(<InfosPratiques destination={findDestination('tokyo')!} paysDeDepart="France" />);
    expect(screen.getByText(/Courant faible/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Police 110' })).toHaveAttribute('href', 'tel:110');
  });

  it('en Allemagne : pas d’adaptateur', () => {
    render(<InfosPratiques destination={findDestination('berlin')!} paysDeDepart="France" />);
    expect(screen.getByText('Pas besoin d’adaptateur.')).toBeInTheDocument();
    expect(screen.getByText('On roule à droite.')).toBeInTheDocument();
  });

  it('sans pays de départ connu, ne tranche pas sur l’adaptateur', () => {
    render(<InfosPratiques destination={findDestination('londres')!} paysDeDepart={undefined} />);
    expect(screen.queryByText('Adaptateur nécessaire.')).not.toBeInTheDocument();
    expect(screen.getByText(/Prises de type G/u)).toBeInTheDocument();
  });
});
