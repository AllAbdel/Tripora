import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PayerCeVirement } from './PayerCeVirement';

function afficher(moyens: Parameters<typeof PayerCeVirement>[0]['moyens']) {
  return render(
    <MemoryRouter>
      <PayerCeVirement moyens={moyens} montantCents={4250} nom="Tom" />
    </MemoryRouter>,
  );
}

describe('payer un virement d’un geste', () => {
  it('ouvre PayPal avec le montant, Revolut sur la page de la personne', () => {
    afficher({ paypal: 'tomdupont', revolut: 'tom.d' });
    expect(screen.getByRole('link', { name: 'Payer Tom avec PayPal, montant rempli' })).toHaveAttribute(
      'href',
      'https://paypal.me/tomdupont/42.50EUR',
    );
    expect(screen.getByRole('link', { name: 'Payer Tom avec Revolut' })).toHaveAttribute(
      'href',
      'https://revolut.me/tom.d',
    );
  });

  it('copie l’IBAN, et l’affiche lisible avec le titulaire', async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: ecrire } });
    afficher({ iban: 'FR7630006000011234567890189', titulaire: 'Tom Dupont' });
    expect(screen.getByText('FR76 3000 6000 0112 3456 7890 189 · Tom Dupont')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copier l’IBAN' }));
    expect(ecrire).toHaveBeenCalledWith('FR7630006000011234567890189');
    expect(await screen.findByRole('button', { name: 'IBAN copié' })).toBeInTheDocument();
  });

  it('dit simplement quand la personne n’a rien indiqué', () => {
    afficher(undefined);
    expect(screen.getByText('Tom n’a pas indiqué comment être remboursé.')).toBeInTheDocument();
  });
});
