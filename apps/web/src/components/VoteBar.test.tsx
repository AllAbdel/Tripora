import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoteBar } from './VoteBar';
import type { VoteTally } from '@/lib/votes';

const vide: VoteTally = {
  destinationId: 'rome',
  likes: 0,
  dislikes: 0,
  favorites: 0,
  mine: null,
};

describe('barre de vote', () => {
  it('pose un vote au premier clic', async () => {
    const onVote = vi.fn();
    render(<VoteBar tally={vide} participants={4} onVote={onVote} />);
    await userEvent.click(screen.getByRole('button', { name: /j’aime/i }));
    expect(onVote).toHaveBeenCalledWith('like');
  });

  it('le retire au clic suivant : un geste pour poser, le même pour reprendre', async () => {
    const onVote = vi.fn();
    render(<VoteBar tally={{ ...vide, mine: 'like', likes: 1 }} participants={4} onVote={onVote} />);
    await userEvent.click(screen.getByRole('button', { name: /j’aime/i }));
    expect(onVote).toHaveBeenCalledWith(null);
  });

  it('résume l’état du vote en une phrase', () => {
    render(<VoteBar tally={{ ...vide, likes: 3, favorites: 1 }} participants={5} onVote={vi.fn()} />);
    expect(screen.getByText('4 sur 5 sont pour')).toBeInTheDocument();
  });

  it('dit clairement quand tout le monde est d’accord', () => {
    render(<VoteBar tally={{ ...vide, likes: 4 }} participants={4} onVote={vi.fn()} />);
    expect(screen.getByText(/tout le monde est d’accord/i)).toBeInTheDocument();
  });

  it('n’affiche aucun résumé tant que personne n’a voté', () => {
    render(<VoteBar tally={vide} participants={4} onVote={vi.fn()} />);
    expect(screen.queryByText(/sont pour|d’accord|n’en veu/i)).not.toBeInTheDocument();
  });

  it('marque visuellement le choix de la personne connectée', () => {
    render(<VoteBar tally={{ ...vide, mine: 'favorite', favorites: 1 }} participants={4} onVote={vi.fn()} />);
    expect(screen.getByRole('button', { name: /mon préféré/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /j’aime/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
