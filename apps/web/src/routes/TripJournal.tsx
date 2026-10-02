import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, ImagePlus, Pencil, Trash2, X } from 'lucide-react';
import {
  LONGUEUR_MAX_DE_LEGENDE,
  findDestination,
  regrouperParJour,
  type PhotoDuVoyage,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ListeFantome } from '@/components/ui/Squelette';
import { TitreDePage } from '@/components/TitreDePage';
import { BoiteDeConfirmation } from '@/components/ConfirmerSuppression';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { ErreurDuJournal, cleJournal, getJournal, requeteDuJournal } from '@/lib/journal';
import { toFailure } from '@/lib/errors';
import { signaler } from '@/lib/feedback';

function messageDe(raison: unknown): string {
  return raison instanceof ErreurDuJournal ? raison.message : toFailure(raison).message;
}

function megaoctets(octets: number): string {
  return `${Math.round(octets / (1024 * 1024))} Mo`;
}

/**
 * Le journal photo du voyage : les photos de chacun, rangées par jour.
 *
 * Après un voyage, les photos dorment dans cinq téléphones et trois
 * conversations, écrasées par la messagerie. Ici, chacun ajoute les siennes,
 * le groupe les voit toutes, par jour du séjour. La grille ne charge que des
 * vignettes ; la photo entière s'ouvre au toucher.
 */
export default function TripJournal() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const selecteur = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [ouverte, setOuverte] = useState<string | null>(null);

  // Sans serveur, « moi » est le seul membre local.
  const moi = supabase ? (identity?.id ?? null) : 'moi';

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });
  const photos = useQuery(requeteDuJournal(id));
  const espace = useQuery({
    queryKey: ['espace-journal'],
    queryFn: () => getJournal().espace(),
    enabled: Boolean(supabase),
  });
  const vignettes = useQuery({
    queryKey: ['journal-vignettes', id, (photos.data ?? []).map((photo) => photo.id).join(',')],
    queryFn: () => getJournal().adresses(photos.data ?? [], 'mini'),
    enabled: Boolean(photos.data?.length),
    staleTime: 45 * 60 * 1000,
  });

  useEffect(() => {
    if (!id) return;
    return getJournal().ecouter(id, () => {
      void queryClient.invalidateQueries({ queryKey: cleJournal(id) });
    });
  }, [id, queryClient]);

  const fuseau = voyage.data?.lockedDestinationId
    ? findDestination(voyage.data.lockedDestinationId)?.timezone
    : undefined;
  const contraintes = voyage.data?.constraints;
  const jours = useMemo(
    () =>
      regrouperParJour(photos.data ?? [], {
        debut: contraintes?.dateMode === 'exact' ? contraintes.startDate : null,
        fin: contraintes?.dateMode === 'exact' ? contraintes.endDate : null,
        ...(fuseau ? { fuseau } : {}),
      }),
    [photos.data, contraintes, fuseau],
  );
  const dansLOrdre = useMemo(() => jours.flatMap((jour) => jour.photos), [jours]);

  const noms = useMemo(() => {
    const table = new Map<string, string>();
    for (const membre of voyage.data?.members ?? []) table.set(membre.userId, membre.displayName ?? 'Un membre');
    return table;
  }, [voyage.data?.members]);

  async function envoyer(fichiers: FileList | null) {
    if (!id || !fichiers || fichiers.length === 0) return;
    const liste = [...fichiers];
    setErreurs([]);
    setEnvoi({ fait: 0, total: liste.length });
    const problemes: string[] = [];
    // Une à une : sur un réseau de voyage, dix envois en parallèle échouent
    // tous plutôt que d'aboutir un par un.
    for (const [index, fichier] of liste.entries()) {
      try {
        await getJournal().deposer(id, { fichier });
      } catch (raison) {
        problemes.push(`${fichier.name} : ${messageDe(raison)}`);
        // Quota atteint ou journal plein : inutile d'essayer les suivantes.
        if (raison instanceof ErreurDuJournal && /80 Mo|plein/u.test(raison.message)) break;
      }
      setEnvoi({ fait: index + 1, total: liste.length });
    }
    setEnvoi(null);
    setErreurs(problemes);
    if (problemes.length < liste.length) signaler('reussite');
    if (selecteur.current) selecteur.current.value = '';
    await queryClient.invalidateQueries({ queryKey: cleJournal(id) });
    await queryClient.invalidateQueries({ queryKey: ['espace-journal'] });
  }

  const estOrganisateur = Boolean(voyage.data?.isOwner);
  const photoOuverte = dansLOrdre.find((photo) => photo.id === ouverte) ?? null;
  const vide = photos.isSuccess && dansLOrdre.length === 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-5 pt-6 pb-28">
      <Link
        to={`/voyages/${id ?? ''}`}
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour au voyage
      </Link>

      <TitreDePage pastille="journal">Journal photo</TitreDePage>
      <p className="text-muted -mt-2 text-sm">
        Les photos de chacun, rangées par jour. Seuls les membres du voyage les voient ; la position GPS que le
        téléphone inscrit dans une photo est effacée avant l’envoi.
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          icon={<ImagePlus className="size-4" aria-hidden />}
          loading={envoi !== null}
          onClick={() => selecteur.current?.click()}
        >
          {envoi ? `Envoi ${Math.min(envoi.fait + 1, envoi.total)} sur ${envoi.total}…` : 'Ajouter des photos'}
        </Button>
        {espace.data && (
          <p className="text-muted chiffres text-xs">
            Vos photos : {megaoctets(espace.data.utilise)} sur {megaoctets(espace.data.limite)}
          </p>
        )}
        <input
          ref={selecteur}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Choisir des photos"
          onChange={(evenement) => void envoyer(evenement.target.files)}
        />
      </div>

      {erreurs.length > 0 && (
        <Banner tone="warning" title={erreurs.length > 1 ? 'Des photos n’ont pas été ajoutées' : 'Une photo n’a pas été ajoutée'}>
          <ul className="space-y-1">
            {erreurs.map((erreur) => (
              <li key={erreur}>{erreur}</li>
            ))}
          </ul>
        </Banner>
      )}
      {photos.error && <Banner tone="warning">{messageDe(photos.error)}</Banner>}

      {photos.isPending && <ListeFantome combien={2} lignes={3} />}

      {vide && (
        <Card>
          <CardBody className="space-y-3 text-center">
            <p className="text-sm">
              Le journal est vide. Ajoutez vos photos du voyage : elles se rangent seules par jour, et tout le groupe
              les retrouve ici, en qualité, sans passer par la discussion.
            </p>
          </CardBody>
        </Card>
      )}

      {jours.map((jour) => (
        <section key={jour.jour} aria-labelledby={`jour-${jour.jour}`} className="space-y-2">
          <h2 id={`jour-${jour.jour}`} className="etiquette-filet">
            {jour.titre}
          </h2>
          <ul className="animate-cascade grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
            {jour.photos.map((photo) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setOuverte(photo.id)}
                  className="pressable block aspect-square w-full overflow-hidden rounded-lg bg-[color:var(--surface-muted)]"
                  aria-label={photo.legende ?? `Photo de ${noms.get(photo.ajoutePar ?? '') ?? 'un membre'}`}
                >
                  {vignettes.data?.[photo.id] ? (
                    <img
                      src={vignettes.data[photo.id]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={photo.largeur ?? undefined}
                      height={photo.hauteur ?? undefined}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="squelette block size-full" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {photoOuverte && id && (
        <VisionneuseDuJournal
          tripId={id}
          photo={photoOuverte}
          vignette={vignettes.data?.[photoOuverte.id]}
          auteur={noms.get(photoOuverte.ajoutePar ?? '') ?? (photoOuverte.ajoutePar === 'moi' ? 'Vous' : 'Un membre')}
          modifiable={!supabase || photoOuverte.ajoutePar === moi}
          retirable={!supabase || estOrganisateur || photoOuverte.ajoutePar === moi}
          precedente={dansLOrdre[dansLOrdre.indexOf(photoOuverte) - 1]?.id ?? null}
          suivante={dansLOrdre[dansLOrdre.indexOf(photoOuverte) + 1]?.id ?? null}
          surAller={setOuverte}
          surFermer={() => setOuverte(null)}
        />
      )}
    </div>
  );
}

/**
 * Une photo en grand, avec sa légende et qui l'a prise. Les flèches du
 * clavier et deux boutons passent d'une photo à l'autre, dans l'ordre du
 * voyage ; Échap ferme.
 */
function VisionneuseDuJournal({
  tripId,
  photo,
  vignette,
  auteur,
  modifiable,
  retirable,
  precedente,
  suivante,
  surAller,
  surFermer,
}: {
  tripId: string;
  photo: PhotoDuVoyage;
  vignette: string | undefined;
  auteur: string;
  modifiable: boolean;
  retirable: boolean;
  precedente: string | null;
  suivante: string | null;
  surAller: (id: string) => void;
  surFermer: () => void;
}) {
  const queryClient = useQueryClient();
  const fermer = useRef<HTMLButtonElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const [enEdition, setEnEdition] = useState(false);
  const [legende, setLegende] = useState(photo.legende ?? '');
  const [confirmation, setConfirmation] = useState(false);

  const entiere = useQuery({
    queryKey: ['journal-photo', photo.id],
    queryFn: async () => (await getJournal().adresses([photo], 'photo'))[photo.id] ?? null,
    staleTime: 45 * 60 * 1000,
  });

  const legender = useMutation({
    mutationFn: () => getJournal().legender(photo.id, legende),
    onSuccess: async () => {
      setEnEdition(false);
      await queryClient.invalidateQueries({ queryKey: cleJournal(tripId) });
    },
  });
  const supprimer = useMutation({
    mutationFn: () => getJournal().supprimer(photo),
    onSuccess: async () => {
      setConfirmation(false);
      surFermer();
      await queryClient.invalidateQueries({ queryKey: cleJournal(tripId) });
      await queryClient.invalidateQueries({ queryKey: ['espace-journal'] });
    },
  });

  useEffect(() => {
    fermer.current?.focus();
  }, []);

  // Le geste vient d'ouvrir le champ : on y écrit tout de suite.
  useEffect(() => {
    if (enEdition) champ.current?.focus();
  }, [enEdition]);

  useEffect(() => {
    const surTouche = (event: KeyboardEvent) => {
      if (enEdition || confirmation) return;
      if (event.key === 'Escape') surFermer();
      if (event.key === 'ArrowLeft' && precedente) surAller(precedente);
      if (event.key === 'ArrowRight' && suivante) surAller(suivante);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [enEdition, confirmation, precedente, suivante, surAller, surFermer]);

  const quand = new Date(photo.priseLe ?? photo.ajouteLe).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const adresse = entiere.data ?? vignette;
  const navigation =
    'grid size-11 shrink-0 place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-30';

  // Au niveau du document : l'écran du voyage crée son propre empilement
  // (animation d'arrivée), sous lequel la barre d'onglets passerait devant.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.legende ?? `Photo de ${auteur}`}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <p className="min-w-0 flex-1 truncate ps-2 text-sm">
          <span className="font-semibold">{auteur}</span>
          <span className="text-white/70"> · {quand}</span>
        </p>
        {retirable && (
          <button type="button" onClick={() => setConfirmation(true)} aria-label="Retirer la photo" className={navigation}>
            <Trash2 className="size-5" aria-hidden />
          </button>
        )}
        <button ref={fermer} type="button" onClick={surFermer} aria-label="Fermer" className={navigation}>
          <X className="size-6" aria-hidden />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {adresse ? (
          <img
            src={adresse}
            alt={photo.legende ?? `Photo de ${auteur}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-white/70">Chargement de la photo…</p>
        )}
        <button
          type="button"
          onClick={() => precedente && surAller(precedente)}
          disabled={!precedente}
          aria-label="Photo précédente"
          className={`${navigation} absolute start-1 top-1/2 -translate-y-1/2 bg-black/30`}
        >
          <ChevronLeft className="size-6 rtl:rotate-180" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => suivante && surAller(suivante)}
          disabled={!suivante}
          aria-label="Photo suivante"
          className={`${navigation} absolute end-1 top-1/2 -translate-y-1/2 bg-black/30`}
        >
          <ChevronRight className="size-6 rtl:rotate-180" aria-hidden />
        </button>
      </div>

      <div className="pb-safe space-y-2 px-4 pt-3">
        {enEdition ? (
          <form
            className="flex gap-2"
            onSubmit={(evenement) => {
              evenement.preventDefault();
              legender.mutate();
            }}
          >
            <input
              value={legende}
              onChange={(evenement) => setLegende(evenement.target.value)}
              maxLength={LONGUEUR_MAX_DE_LEGENDE}
              aria-label="Légende de la photo"
              placeholder="Plage de Balangan, au coucher du soleil"
              ref={champ}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/30 bg-white/10 px-3 text-base text-white placeholder:text-white/50"
            />
            <button
              type="submit"
              disabled={legender.isPending}
              className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
            >
              {legender.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm leading-relaxed">
              {photo.legende ?? <span className="text-white/60">Sans légende</span>}
            </p>
            {modifiable && (
              <button
                type="button"
                onClick={() => setEnEdition(true)}
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-white/90 underline"
              >
                <Pencil className="size-4" aria-hidden />
                {photo.legende ? 'Modifier' : 'Ajouter une légende'}
              </button>
            )}
          </div>
        )}
        {(legender.error ?? supprimer.error) && (
          <p role="alert" className="text-sm text-red-300">
            {messageDe(legender.error ?? supprimer.error)}
          </p>
        )}
      </div>

      <BoiteDeConfirmation
        ouverte={confirmation}
        titre="Retirer cette photo ?"
        message="Elle disparaît du journal pour tout le groupe. Cette action ne s’annule pas."
        action="Retirer"
        enCours={supprimer.isPending}
        surAnnuler={() => setConfirmation(false)}
        surConfirmer={() => supprimer.mutate()}
      />
    </div>,
    document.body,
  );
}
