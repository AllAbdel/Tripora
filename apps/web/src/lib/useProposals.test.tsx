import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { normalizeWeights } from '@tripora/core';
import { useProposals } from './useProposals';
import type { TripDetails } from './trips';

/**
 * Le moteur ne propose que ce qu'on lui a demandé de proposer.
 *
 * Le bug tenait en une ligne manquante : les propositions se calculaient pour
 * tous les voyages, y compris ceux dont la destination était déjà choisie. Et
 * comme la présélection borne la distance à la durée du séjour, le voyageur
 * qui avait choisi Bali au départ de Paris se voyait proposer des villes
 * françaises — jamais Bali, qui est douze fois trop loin pour ce filtre.
 */

const BASE: TripDetails = {
  summary: {
    id: 'v1',
    title: 'Bali entre potes',
    status: 'planned',
    participants: 4,
    destinationName: 'Bali',
    destinationCountryCode: 'ID',
    coverImageUrl: null,
    createdAt: '2026-09-08T10:00:00.000Z',
    localOnly: true,
  },
  constraints: {
    participants: 4,
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['CDG'] },
    durationDays: 12,
    dateMode: 'month',
    month: 7,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 250_000,
    comfortLevel: 'mid',
    groupType: 'friends',
  },
  members: [
    {
      userId: 'moi',
      weights: normalizeWeights({ nature: 1, relax: 0.66 }),
      budgetMaxCents: 250_000,
      avoid: [],
    },
  ],
  isOwner: true,
  lockedDestinationId: 'bali',
  destinationMode: 'fixed',
  shortlist: ['bali'],
};

function enveloppe({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('propositions', () => {
  it('ne propose rien quand la destination a été choisie à la création', () => {
    const { result } = renderHook(() => useProposals(BASE), { wrapper: enveloppe });
    expect(result.current.proposals).toBeNull();
  });

  it('propose bien quand le groupe doit encore choisir', () => {
    const aComparer: TripDetails = {
      ...BASE,
      lockedDestinationId: null,
      destinationMode: 'suggest',
      shortlist: [],
    };
    const { result } = renderHook(() => useProposals(aComparer), { wrapper: enveloppe });
    expect(result.current.proposals?.scores.length).toBeGreaterThan(0);
  });

  it('ne propose rien tant qu’il n’y a pas de voyage', () => {
    const { result } = renderHook(() => useProposals(null), { wrapper: enveloppe });
    expect(result.current.proposals).toBeNull();
  });
});
