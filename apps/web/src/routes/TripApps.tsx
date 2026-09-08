import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2, Plus, ShieldCheck } from 'lucide-react';
import {
  CATEGORIES_APP,
  LIBELLES_CATEGORIE,
  findDestination,
  rubriquesPour,
  type CategorieApp,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Field, TextInput } from '@/components/ui/Field';
import { FicheApplication } from '@/components/FicheApplication';
import { getApps, type PropositionApp } from '@/lib/apps';
import { getTripRepository } from '@/lib/trips';
import { toFailure } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { signaler } from '@/lib/feedback';

/**
 * Toutes les applications utiles pour la destination du voyage.
 *
 * Rangées par rubrique dans l'ordre du voyage — se connecter, s'orienter, se
 * déplacer, dormir — et à l'intérieur de chacune, le plus local d'abord. Ce
 * classement est calculé dans `@tripora/core` : l'écran ne fait que l'afficher.
 *
 * En bas, le formulaire de proposition. Il est ouvert à tout le monde parce
 * que personne ne connaît tous les pays, et il n'est pas publié tout de suite
 * parce que c'est la confiance dans ces conseils qui fait leur valeur.
 */
export default function TripApps() {
  const { id } = useParams<{ id: string }>();
  const api = getApps();
  const repo = getTripRepository();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const voyage = useQuery({
    queryKey: ['trip', id],
    queryFn: () => repo.get(id!),
    enabled: Boolean(id),
  });

  const catalogue = useQuery({
    queryKey: ['applications-publiees'],
    queryFn: () => api!.listPublished(),
    enabled: Boolean(api),
    staleTime: 30 * 60 * 1000,
  });

  const miennes = useQuery({
    queryKey: ['applications-miennes'],
    queryFn: () => api!.listMine(),
    enabled: Boolean(api),
  });

  const jeModere = useQuery({
    queryKey: ['suis-je-admin'],
    queryFn: () => api!.amIAdmin(),
    enabled: Boolean(api),
    staleTime: 60 * 60 * 1000,
  });

  const destination = voyage.data?.lockedDestinationId
    ? findDestination(voyage.data.lockedDestinationId)
    : undefined;

  const rubriques = useMemo(
    () =>
      rubriquesPour(
        catalogue.data ?? [],
        {
          destinationId: destination?.id ?? null,
          countryCode: destination?.countryCode ?? null,
        },
        // Ici on ne plafonne pas : c'est l'écran qui sert à tout voir.
        99,
      ),
    [catalogue.data, destination],
  );

  const enAttente = (miennes.data ?? []).filter((app) => app.status === 'pending');
  const refusees = (miennes.data ?? []).filter((app) => app.status === 'rejected');

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <Link
          to={`/voyages/${id}`}
          aria-label="Retour au voyage"
          className="hover:bg-brand-50 dark:hover:bg-ink-700/40 -ml-2 grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">Applications utiles</h1>
          {destination && <p className="text-muted truncate text-sm">Pour {destination.name}</p>}
        </div>
      </div>

      {!api && (
        <Banner tone="offline" title="Mode local">
          Le catalogue d’applications vit sur le serveur. Connectez Tripora à Supabase pour le
          consulter.
        </Banner>
      )}

      {!destination && api && (
        <Banner tone="info" title="Destination pas encore fixée">
          Voici ce qui sert partout. Dès que le groupe aura verrouillé une ville, cette liste
          s’enrichira de ce qui ne marche que là-bas — une carte de transport, un taxi local.
        </Banner>
      )}

      {catalogue.isPending && api && (
        <div className="flex justify-center py-10">
          <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
        </div>
      )}

      {catalogue.isError && (
        <Banner tone="warning" title="Catalogue indisponible">
          {toFailure(catalogue.error).message}
        </Banner>
      )}

      {rubriques.map((rubrique) => (
        <Card key={rubrique.categorie}>
          <CardBody className="space-y-3">
            <h2 className="font-semibold">{rubrique.libelle}</h2>
            <div className="space-y-2">
              {rubrique.applications.map((app) => (
                <FicheApplication key={app.id} app={app} portee={app.portee} />
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      {enAttente.length > 0 && (
        <Banner tone="info" title={`${enAttente.length} proposition(s) en attente`}>
          {enAttente.map((app) => app.name).join(', ')} — visible de vous seul le temps qu’un
          administrateur relise.
        </Banner>
      )}

      {refusees.length > 0 && (
        <Banner tone="warning" title="Proposition écartée">
          {refusees.map((app) => `${app.name}${app.reviewNote ? ` — ${app.reviewNote}` : ''}`).join(' · ')}
        </Banner>
      )}

      {api &&
        (formulaireOuvert ? (
          <FormulaireProposition onFini={() => setFormulaireOuvert(false)} />
        ) : (
          <Button
            variant="secondary"
            block
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setFormulaireOuvert(true)}
          >
            Proposer une application
          </Button>
        ))}

      {jeModere.data && (
        <Link
          to="/applications/moderation"
          className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
        >
          <ShieldCheck className="size-4" aria-hidden />
          Modérer les propositions
        </Link>
      )}
    </div>
  );
}

const VIDE: PropositionApp = {
  name: '',
  category: 'transport_local',
  tagline: '',
  why: '',
  caveat: '',
  iosUrl: '',
  androidUrl: '',
  webUrl: '',
  countryCodes: [],
  destinationIds: [],
};

/**
 * Proposer une application.
 *
 * Deux champs obligatoires en plus du nom : à quoi ça sert, et pourquoi
 * l'utiliser. C'est volontaire — une recommandation sans le pourquoi ne
 * convainc personne et ne se relit pas. Le champ « pays » accepte des codes
 * séparés par des virgules, parce que c'est la portée la plus fréquente et
 * qu'un sélecteur de deux cents pays serait pire.
 */
function FormulaireProposition({ onFini }: { onFini: () => void }) {
  const api = getApps();
  const queryClient = useQueryClient();
  const [valeurs, setValeurs] = useState<PropositionApp>(VIDE);
  const [pays, setPays] = useState('');

  const envoyer = useMutation({
    mutationFn: () =>
      api!.suggest({
        ...valeurs,
        countryCodes: pays
          .split(/[,\s]+/u)
          .map((code) => code.trim().toUpperCase())
          .filter((code) => /^[A-Z]{2}$/u.test(code)),
      }),
    onSuccess: async () => {
      signaler('reussite');
      await queryClient.invalidateQueries({ queryKey: ['applications-miennes'] });
      onFini();
    },
    onError: () => signaler('echec'),
  });

  const complet =
    valeurs.name.trim().length >= 2 &&
    valeurs.tagline.trim().length > 0 &&
    valeurs.why.trim().length > 0;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="font-semibold">Proposer une application</h2>
          <p className="text-muted text-sm">
            Elle sera relue avant d’apparaître pour les autres. Dites surtout ce qu’elle fait
            gagner : c’est ce qui décide quelqu’un à l’installer.
          </p>
        </div>

        <Field label="Nom">
          <TextInput
            value={valeurs.name}
            onChange={(e) => setValeurs({ ...valeurs, name: e.target.value })}
            placeholder="BiTaksi"
            maxLength={80}
          />
        </Field>

        <div className="space-y-1.5">
          <span className="text-sm font-semibold">Rubrique</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES_APP.map((categorie) => (
              <Chip
                key={categorie}
                selected={valeurs.category === categorie}
                onClick={() => setValeurs({ ...valeurs, category: categorie as CategorieApp })}
              >
                {LIBELLES_CATEGORIE[categorie]}
              </Chip>
            ))}
          </div>
        </div>

        <Field label="En une phrase" hint="Ce que c’est, pas ce qu’on en pense.">
          <TextInput
            value={valeurs.tagline}
            onChange={(e) => setValeurs({ ...valeurs, tagline: e.target.value })}
            placeholder="Le taxi officiel, sans négociation."
            maxLength={160}
          />
        </Field>

        <Field label="Pourquoi l’utiliser" hint="Ce qu’on y gagne : de l’argent, du temps, de la tranquillité.">
          <textarea
            value={valeurs.why}
            onChange={(e) => setValeurs({ ...valeurs, why: e.target.value })}
            rows={4}
            maxLength={600}
            className={cn(
              'surface-raised w-full rounded-2xl border border-[color:var(--border-subtle)] p-4',
              'focus:border-brand-500 text-[16px] outline-none',
            )}
          />
        </Field>

        <Field label="Ce qu’il faut savoir (facultatif)" hint="Une limite, un piège, un coût caché.">
          <textarea
            value={valeurs.caveat ?? ''}
            onChange={(e) => setValeurs({ ...valeurs, caveat: e.target.value })}
            rows={2}
            maxLength={600}
            className={cn(
              'surface-raised w-full rounded-2xl border border-[color:var(--border-subtle)] p-4',
              'focus:border-brand-500 text-[16px] outline-none',
            )}
          />
        </Field>

        <Field label="Pays concernés (facultatif)" hint="Codes à deux lettres, séparés par des virgules. Vide = utile partout.">
          <TextInput
            value={pays}
            onChange={(e) => setPays(e.target.value)}
            placeholder="TR, GR"
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Site officiel (facultatif)">
          <TextInput
            value={valeurs.webUrl ?? ''}
            onChange={(e) => setValeurs({ ...valeurs, webUrl: e.target.value })}
            placeholder="https://…"
            inputMode="url"
          />
        </Field>

        {envoyer.isError && (
          <Banner tone="warning" title="Proposition non enregistrée">
            {toFailure(envoyer.error).message}
          </Banner>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => envoyer.mutate()}
            loading={envoyer.isPending}
            disabled={!complet}
            icon={<Check className="size-4" aria-hidden />}
          >
            Proposer
          </Button>
          <Button variant="ghost" onClick={onFini}>
            Annuler
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
