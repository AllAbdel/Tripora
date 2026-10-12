import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectCandidates, type TripConstraints } from '@tripora/core';
import { DAutresIdees, OuChercher } from './ReglagesDesPropositions';
import type { VoteTally } from '@/lib/votes';

const CONTRAINTES: TripConstraints = {
  participants: 4,
  origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['CDG'] },
  durationDays: 7,
  dateMode: 'month',
  month: 6,
  budgetMode: 'max_per_person',
  budgetPerPersonCents: 250_000,
  comfortLevel: 'mid',
  groupType: 'friends',
};

function vote(destinationId: string, valeurs: Partial<VoteTally> = {}): VoteTally {
  return { destinationId, likes: 0, dislikes: 0, favorites: 0, mine: null, ...valeurs };
}

function idees(props: Partial<Parameters<typeof DAutresIdees>[0]> = {}) {
  const onEcarter = vi.fn();
  const onRevoir = vi.fn();
  render(
    <DAutresIdees
      constraints={CONTRAINTES}
      affichees={['rome', 'porto']}
      tallies={undefined}
      ecartees={[]}
      estOrganisateur
      enCours={false}
      onEcarter={onEcarter}
      onRevoir={onRevoir}
      {...props}
    />,
  );
  return { onEcarter, onRevoir };
}

describe('où chercher', () => {
  it('l’organisateur ajoute un continent, rangé dans l’ordre de la liste', async () => {
    const onChange = vi.fn();
    render(<OuChercher regions={['asie']} estOrganisateur onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Afrique' }));
    expect(onChange).toHaveBeenCalledWith(['afrique', 'asie']);
  });

  it('« Partout » efface le choix, et c’est la seule puce allumée sans choix', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<OuChercher regions={['asie']} estOrganisateur onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Partout' }));
    expect(onChange).toHaveBeenCalledWith([]);

    rerender(<OuChercher regions={[]} estOrganisateur onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Partout' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Asie' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('un membre voit le choix de l’organisateur, sans pouvoir le changer', () => {
    render(<OuChercher regions={['afrique', 'asie']} estOrganisateur={false} onChange={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Afrique, Asie/)).toBeInTheDocument();
  });

  it('un membre ne voit rien quand Tripora cherche partout', () => {
    const { container } = render(
      <OuChercher regions={[]} estOrganisateur={false} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('d’autres idées', () => {
  it('met de côté celles que personne n’a aimées, et le dit', async () => {
    const { onEcarter } = idees({ tallies: { rome: vote('rome', { likes: 1 }) } });
    await userEvent.click(screen.getByRole('button', { name: /d’autres idées/i }));
    expect(onEcarter).toHaveBeenCalledWith(['porto']);
    expect(screen.getByRole('status')).toHaveTextContent(/nouvelles idées/i);
  });

  it('ne remplace rien quand chacune a reçu un « J’aime »', () => {
    idees({
      tallies: { rome: vote('rome', { likes: 1 }), porto: vote('porto', { favorites: 2 }) },
    });
    expect(screen.getByRole('button', { name: /d’autres idées/i })).toBeDisabled();
    expect(screen.getByText(/rien à remplacer/i)).toBeInTheDocument();
  });

  it('ne promet pas d’autres idées quand le catalogue est épuisé', () => {
    const enOceanie: TripConstraints = { ...CONTRAINTES, regions: ['oceanie'] };
    const toutes = selectCandidates(enOceanie, { limit: 10_000, parPays: 10_000 }).map((d) => d.id);
    expect(toutes.length).toBeGreaterThan(3);
    idees({ constraints: enOceanie, affichees: toutes.slice(0, 3), ecartees: toutes.slice(3) });
    expect(screen.getByRole('button', { name: /d’autres idées/i })).toBeDisabled();
    expect(screen.getByText(/fait le tour/i)).toBeInTheDocument();
  });

  it('ramène les destinations mises de côté', async () => {
    const { onRevoir } = idees({ ecartees: ['lisbonne', 'seville', 'naples'] });
    await userEvent.click(
      screen.getByRole('button', { name: 'Revoir les 3 destinations mises de côté' }),
    );
    expect(onRevoir).toHaveBeenCalled();
  });

  it('un membre est invité à dire « Pas pour moi » à l’organisateur', () => {
    idees({ estOrganisateur: false });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Pas pour moi/)).toBeInTheDocument();
  });
});
