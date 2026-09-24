import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Share2 } from 'lucide-react';
import { bilanDuVoyage, dateDuJour, findDestination, periodeLisible, type Bilan } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ListeFantome } from '@/components/ui/Squelette';
import { TitreDePage } from '@/components/TitreDePage';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { getItinerary } from '@/lib/itinerary';
import { CATEGORIES, getExpenses } from '@/lib/expenses';
import { requeteDesEnvies } from '@/lib/envies';
import { chargerCouverture } from '@/lib/cover';
import { dessinerLeBilan, type ContenuDuBilan } from '@/lib/imageDuBilan';
import { estNatif, ouvrirUnFichier } from '@/lib/natif';
import { signaler } from '@/lib/feedback';

/**
 * Le bilan du voyage : ce qu'on raconte en rentrant, en chiffres justes, et
 * une image à poster.
 *
 * Tout vient de ce que le groupe a noté dans Tripora — les dates, le
 * programme, les dépenses, les envies. Un chiffre qu'on ne connaît pas
 * n'apparaît pas : un voyage sans dépenses notées n'a pas de « par personne ».
 */
export default function TripBilan() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const moi = supabase ? (identity?.id ?? '') : 'moi';

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });
  const itineraire = useQuery({
    queryKey: ['itineraire', id],
    queryFn: () => getItinerary().load(id!),
    enabled: Boolean(id),
  });
  const depenses = useQuery({
    queryKey: ['depenses', id],
    queryFn: () => getExpenses().list(id!),
    enabled: Boolean(id),
  });
  const envies = useQuery(requeteDesEnvies(id, moi));

  const data = voyage.data;
  const destination = data?.lockedDestinationId ? findDestination(data.lockedDestinationId) : undefined;

  const couverture = useQuery({
    queryKey: ['couverture', destination?.id],
    queryFn: () => chargerCouverture(destination!),
    enabled: Boolean(destination),
    staleTime: Infinity,
    retry: false,
  });

  // Les titres des activités du carnet, pour nommer le coup de cœur.
  const titres = useQuery({
    queryKey: ['titres-du-carnet', destination?.id],
    queryFn: async () => {
      const { activitesDe } = await import('@tripora/core/activites');
      return Object.fromEntries(activitesDe(destination!.id).map((activite) => [activite.id, activite.nom]));
    },
    enabled: Boolean(destination),
    staleTime: Infinity,
  });

  const bilan = useMemo<Bilan | null>(() => {
    if (!data) return null;
    const exactes = data.constraints.dateMode === 'exact';
    const participants = Math.max(data.members.length, data.constraints.participants ?? 1, 1);
    const libelle = (categorie: string) => CATEGORIES.find((c) => c.value === categorie)?.label ?? 'Divers';
    const favoris = Object.entries(envies.data?.parActivite ?? {})
      .map(([activiteId, avis]) => ({ titre: titres.data?.[activiteId], pour: avis.pour.length, contre: avis.contre.length }))
      .filter((ligne): ligne is { titre: string; pour: number; contre: number } => Boolean(ligne.titre) && ligne.pour > 0)
      .sort((a, b) => b.pour - a.pour || a.contre - b.contre);
    return bilanDuVoyage({
      ville: destination?.name ?? null,
      pays: destination?.country ?? null,
      debut: exactes ? (data.constraints.startDate ?? null) : null,
      fin: exactes ? (data.constraints.endDate ?? null) : null,
      participants,
      origine: data.constraints.origin ?? null,
      destination: destination ? { lat: destination.lat, lng: destination.lng } : null,
      depenses: (depenses.data ?? []).map((depense) => ({
        montantCents: depense.amountCents,
        categorie: libelle(depense.category),
      })),
      programme: (itineraire.data ?? []).flatMap((jour) => jour.items),
      coupDeCoeur: favoris[0] ? { titre: favoris[0].titre, pour: favoris[0].pour } : null,
    });
  }, [data, destination, depenses.data, itineraire.data, envies.data, titres.data]);

  const titre = destination?.name ?? data?.summary.title ?? 'Le voyage';
  const exactes = data?.constraints.dateMode === 'exact' && data.constraints.startDate && data.constraints.endDate;
  const periode = exactes ? periodeLisible(data.constraints.startDate!, data.constraints.endDate!) : null;
  const sousTitre = [destination?.country, periode].filter(Boolean).join(' · ');
  const enCours = Boolean(exactes && data.constraints.endDate! >= dateDuJour(destination?.timezone));

  const chiffres = bilan
    ? [
        bilan.jours !== null && { valeur: String(bilan.jours), libelle: bilan.jours > 1 ? 'jours' : 'jour' },
        bilan.km !== null && bilan.km >= 10 && { valeur: bilan.km.toLocaleString('fr-FR'), libelle: 'km' },
        bilan.activites > 0 && {
          valeur: String(bilan.activites),
          libelle: bilan.activites > 1 ? 'activités' : 'activité',
        },
        bilan.activites === 0 &&
          bilan.participants > 1 && { valeur: String(bilan.participants), libelle: 'voyageurs' },
      ].filter((chiffre): chiffre is { valeur: string; libelle: string } => Boolean(chiffre))
    : [];

  // Sous les grands chiffres de l'image, ce qu'ils ne disent pas déjà : la
  // distance y reste, pour sa comparaison avec le tour de la Terre.
  const lignes = (bilan?.phrases ?? [])
    .filter((phrase) => phrase.sujet !== 'duree' && phrase.sujet !== 'programme')
    .map((phrase) => phrase.texte);

  const [image, setImage] = useState<{ blob: Blob; adresse: string } | null>(null);
  // L'échec vaut pour un contenu donné : un nouveau contenu retente sa chance.
  const [echecPour, setEchecPour] = useState<string | null>(null);
  const pret = Boolean(bilan) && !itineraire.isPending && !depenses.isPending && !couverture.isPending;
  const contenu: ContenuDuBilan | null = pret
    ? {
        titre,
        sousTitre,
        chiffres,
        lignes,
        photo: couverture.data
          ? {
              url: couverture.data.url,
              credit: [couverture.data.auteur, couverture.data.licence].filter(Boolean).join(', ') || null,
            }
          : null,
      }
    : null;
  const cleDeLImage = contenu ? JSON.stringify(contenu) : null;
  const imageEchouee = cleDeLImage !== null && echecPour === cleDeLImage;

  useEffect(() => {
    if (!cleDeLImage) return;
    let actif = true;
    let adresse: string | null = null;
    dessinerLeBilan(JSON.parse(cleDeLImage) as ContenuDuBilan)
      .then((blob) => {
        if (!actif) return;
        adresse = URL.createObjectURL(blob);
        setImage({ blob, adresse });
      })
      .catch(() => {
        if (actif) setEchecPour(cleDeLImage);
      });
    return () => {
      actif = false;
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [cleDeLImage]);

  const nomDuFichier = `tripora-${titre.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}.png`;

  async function partager() {
    if (!image) return;
    signaler('tape');
    if (estNatif) {
      await ouvrirUnFichier({ nom: nomDuFichier, fichier: image.blob, titre: `Mon voyage à ${titre}` });
      return;
    }
    const fichier = new File([image.blob], nomDuFichier, { type: 'image/png' });
    if (navigator.canShare?.({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier], title: `Mon voyage à ${titre}` });
      } catch {
        // Partage annulé : rien à faire.
      }
      return;
    }
    telecharger();
  }

  function telecharger() {
    if (!image) return;
    const lien = document.createElement('a');
    lien.href = image.adresse;
    lien.download = nomDuFichier;
    lien.click();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-5 pt-6 pb-28">
      <Link
        to={`/voyages/${id ?? ''}`}
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour au voyage
      </Link>

      <TitreDePage pastille="bilan">Bilan du voyage</TitreDePage>

      {voyage.isPending && <ListeFantome combien={3} lignes={1} />}

      {bilan && (
        <>
          <div className="space-y-1">
            <p className="titre-lieu text-3xl">{titre}</p>
            {sousTitre && <p className="text-muted text-sm">{sousTitre}</p>}
            {enCours && (
              <p className="text-muted text-sm">Le voyage n’est pas fini : le bilan s’écrit au fil des jours.</p>
            )}
          </div>

          {chiffres.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              {chiffres.map((chiffre) => (
                <Card key={chiffre.libelle}>
                  <CardBody className="space-y-0.5 text-center">
                    <p className="text-2xl font-bold tabular-nums">{chiffre.valeur}</p>
                    <p className="text-muted text-xs">{chiffre.libelle}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {bilan.phrases.length > 0 ? (
            <ul className="space-y-2" aria-label="Le voyage en quelques mots">
              {bilan.phrases.map((phrase) => (
                <li key={phrase.sujet} className="flex gap-2.5 text-[0.95rem]">
                  <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-[#f5b301]" />
                  <span>{phrase.texte}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">
              Datez le voyage, remplissez le programme et notez les dépenses : le bilan se composera tout seul.
            </p>
          )}

          <section className="space-y-3" aria-labelledby="titre-image">
            <h2 id="titre-image" className="text-lg font-bold">
              L’image à partager
            </h2>
            {image ? (
              <img
                src={image.adresse}
                alt={`Le bilan du voyage à ${titre}, en image`}
                className="mx-auto aspect-[9/16] w-full max-w-xs rounded-2xl shadow-[var(--shadow-float)]"
              />
            ) : imageEchouee ? (
              <p className="text-muted text-sm">L’image n’a pas pu être dessinée sur cet appareil.</p>
            ) : (
              <div className="mx-auto aspect-[9/16] w-full max-w-xs animate-pulse rounded-2xl bg-[color:var(--border-subtle)]" aria-hidden />
            )}
            <div className="flex gap-2">
              <Button block disabled={!image} icon={<Share2 className="size-4" aria-hidden />} onClick={() => void partager()}>
                Partager
              </Button>
              {!estNatif && (
                <Button
                  variant="secondary"
                  disabled={!image}
                  icon={<Download className="size-4" aria-hidden />}
                  onClick={telecharger}
                >
                  Enregistrer
                </Button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
