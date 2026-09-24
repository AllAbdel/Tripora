import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  dateDuJour,
  findDestination,
  passeport,
  type Passeport,
  type VoyageDuPasseport,
} from '@tripora/core';
import { getTripRepository, type TripSummary } from '@/lib/trips';

/** Un voyage de la liste, dans la forme que le passeport sait compter. */
export function versLePasseport(voyage: TripSummary): VoyageDuPasseport {
  const destination = voyage.destinationId ? findDestination(voyage.destinationId) : undefined;
  return {
    id: voyage.id,
    titre: voyage.title,
    codePays: destination?.countryCode ?? voyage.destinationCountryCode,
    pays: destination?.country ?? null,
    ville: destination?.name ?? voyage.destinationName,
    destination: destination ? { lat: destination.lat, lng: destination.lng } : null,
    origine: voyage.origin ?? null,
    debut: voyage.startDate ?? null,
    fin: voyage.endDate ?? null,
    participants: voyage.participants,
    organisateur: voyage.isOwner ?? false,
  };
}

/**
 * Le passeport de la personne connectée, à la date du jour.
 *
 * Il repose sur la même requête que « Mes trips » : le cache sert les deux
 * écrans, et ouvrir le passeport après l'accueil ne coûte aucun appel.
 */
export function usePasseport(): { passeport: Passeport; chargement: boolean } {
  const depot = getTripRepository();
  const voyages = useQuery({ queryKey: ['trips', depot.kind], queryFn: () => depot.list() });
  const calcule = useMemo(
    () => passeport((voyages.data ?? []).map(versLePasseport), dateDuJour()),
    [voyages.data],
  );
  return { passeport: calcule, chargement: voyages.isLoading };
}
