import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ExternalLink, Lock, LockOpen, Plus, Trash2, X } from 'lucide-react';
import {
  depouiller,
  MODELES_DE_SONDAGE,
  periodeLisible,
  problemeDeLOption,
  problemeDuSondage,
  type GenreDeSondage,
  type ModeleDeSondage,
  type NouvelleOption,
  type OptionDepouillee,
  type Sondage,
} from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListeFantome } from '@/components/ui/Squelette';
import { TextInput } from '@/components/ui/Field';
import { TitreDePage } from '@/components/TitreDePage';
import { BoiteDeConfirmation } from '@/components/ConfirmerSuppression';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { cleSondages, getSondages, requeteDesSondages, type NouveauSondage } from '@/lib/sondages';
import { toFailure } from '@/lib/errors';
import { signaler } from '@/lib/feedback';
import { cn } from '@/lib/cn';

/**
 * Les sondages du groupe : quelles dates, quel logement, où dîner ce soir.
 *
 * Tout ce que le vote sur la destination ne tranchait pas repartait dans la
 * messagerie, où un vote se perd entre deux photos. Ici, une question, des
 * options — un texte, un lien, des dates — et un geste pour voter. Tout le
 * monde peut proposer une option tant que le sondage est ouvert ; celui qui
 * l'a lancé, ou l'organisateur, le clôt.
 */
export default function TripSondages() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const [nouveau, setNouveau] = useState<ModeleDeSondage | null>(null);
  const [aSupprimer, setASupprimer] = useState<Sondage | null>(null);

  // Sans serveur, « moi » est l'unique votant local.
  const moi = supabase ? (identity?.id ?? null) : 'moi';

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });
  const sondages = useQuery(requeteDesSondages(id));

  // Un vote posé par un ami apparaît sans recharger.
  useEffect(() => {
    if (!id) return;
    return getSondages().ecouter(id, () => {
      void queryClient.invalidateQueries({ queryKey: cleSondages(id) });
    });
  }, [id, queryClient]);

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: cleSondages(id) });

  const noms = useMemo(() => {
    const table = new Map<string, string>();
    for (const membre of voyage.data?.members ?? []) {
      if (membre.displayName) table.set(membre.userId, membre.displayName);
    }
    return table;
  }, [voyage.data?.members]);

  const creer = useMutation({
    mutationFn: (sondage: NouveauSondage) => getSondages().creer(id!, sondage),
    onSuccess: async () => {
      signaler('reussite');
      setNouveau(null);
      await rafraichir();
    },
  });

  const supprimer = useMutation({
    mutationFn: (sondage: Sondage) => getSondages().supprimer(sondage.id),
    onSuccess: async () => {
      setASupprimer(null);
      await rafraichir();
    },
  });

  const estOrganisateur = Boolean(voyage.data?.isOwner);
  const liste = sondages.data ?? [];
  const ouverts = liste.filter((sondage) => !sondage.clos);
  const clos = liste.filter((sondage) => sondage.clos);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-5 pt-6 pb-28">
      <Link
        to={`/voyages/${id ?? ''}`}
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour au voyage
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TitreDePage pastille="sondages">Sondages</TitreDePage>
        {nouveau === null && liste.length > 0 && (
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setNouveau(MODELES_DE_SONDAGE[0]!)}>
            Nouveau
          </Button>
        )}
      </div>

      {sondages.error && <Banner tone="warning">{toFailure(sondages.error).message}</Banner>}
      {creer.error && <Banner tone="warning">{toFailure(creer.error).message}</Banner>}

      {nouveau !== null && (
        <FormulaireDeSondage
          modele={nouveau}
          surModele={setNouveau}
          enregistrement={creer.isPending}
          surEnregistrer={(sondage) => creer.mutate(sondage)}
          surAnnuler={() => setNouveau(null)}
        />
      )}

      {sondages.isPending && <ListeFantome combien={2} />}

      {sondages.data && liste.length === 0 && nouveau === null && (
        <EmptyState
          title="Aucun sondage pour l’instant"
          description="Les dates qui arrangent tout le monde, le logement parmi ceux repérés sur Airbnb, le restaurant de ce soir : posez la question au groupe, chacun vote d’un geste."
          action={
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setNouveau(MODELES_DE_SONDAGE[0]!)}>
              Lancer un sondage
            </Button>
          }
        />
      )}

      <div className="space-y-3">
        {ouverts.map((sondage) => (
          <CarteDeSondage
            key={sondage.id}
            sondage={sondage}
            moi={moi}
            noms={noms}
            gerable={!supabase || estOrganisateur || sondage.creePar === moi}
            surChangement={rafraichir}
            surSupprimer={() => setASupprimer(sondage)}
          />
        ))}
      </div>

      {clos.length > 0 && (
        <section className="space-y-3" aria-labelledby="sondages-clos">
          <h2 id="sondages-clos" className="etiquette-filet">
            <span className="etiquette">Clos</span>
          </h2>
          {clos.map((sondage) => (
            <CarteDeSondage
              key={sondage.id}
              sondage={sondage}
              moi={moi}
              noms={noms}
              gerable={!supabase || estOrganisateur || sondage.creePar === moi}
              surChangement={rafraichir}
              surSupprimer={() => setASupprimer(sondage)}
            />
          ))}
        </section>
      )}

      <BoiteDeConfirmation
        ouverte={aSupprimer !== null}
        titre={`Retirer « ${aSupprimer?.question ?? ''} » ?`}
        message="Le sondage, ses options et tous les votes disparaissent, pour tout le groupe."
        action="Retirer"
        enCours={supprimer.isPending}
        surConfirmer={() => aSupprimer && supprimer.mutate(aSupprimer)}
        surAnnuler={() => setASupprimer(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------ Un sondage -- */

function CarteDeSondage({
  sondage,
  moi,
  noms,
  gerable,
  surChangement,
  surSupprimer,
}: {
  sondage: Sondage;
  moi: string | null;
  noms: ReadonlyMap<string, string>;
  gerable: boolean;
  surChangement: () => Promise<unknown>;
  surSupprimer: () => void;
}) {
  const [propose, setPropose] = useState(false);
  const depouillement = depouiller(sondage, moi);
  const auteur = sondage.creePar ? nomDe(sondage.creePar, noms, moi) : null;

  const voter = useMutation({
    mutationFn: async (option: OptionDepouillee) => {
      if (option.moi) await getSondages().retirerVote(option.option.id);
      else await getSondages().voter(option.option.id);
    },
    onSuccess: async () => {
      signaler('tape');
      await surChangement();
    },
    onError: () => signaler('echec'),
  });

  const clore = useMutation({
    mutationFn: () => getSondages().clore(sondage.id, !sondage.clos),
    onSuccess: surChangement,
  });

  const proposer = useMutation({
    mutationFn: (option: NouvelleOption) => getSondages().proposer(sondage.id, option),
    onSuccess: async () => {
      setPropose(false);
      await surChangement();
    },
  });

  return (
    <Card className={cn(sondage.clos && 'opacity-90')}>
      <CardBody className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold">{sondage.question}</h3>
          <p className="text-muted text-xs">
            {[
              auteur && `Lancé par ${auteur}`,
              sondage.choixMultiple ? 'plusieurs choix possibles' : 'un seul choix',
              depouillement.votants === 0
                ? 'aucun vote'
                : `${depouillement.votants} votant${depouillement.votants > 1 ? 's' : ''}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <ul className="space-y-2">
          {depouillement.options.map((option) => (
            <li key={option.option.id}>
              <LigneDOption
                option={option}
                genre={sondage.genre}
                clos={sondage.clos}
                noms={noms}
                moi={moi}
                enCours={voter.isPending}
                surVoter={() => voter.mutate(option)}
              />
            </li>
          ))}
        </ul>

        {voter.error && <p className="text-sm text-red-600">{toFailure(voter.error).message}</p>}

        {!sondage.clos &&
          (propose ? (
            <PropositionDOption
              genre={sondage.genre}
              enCours={proposer.isPending}
              erreur={proposer.error ? toFailure(proposer.error).message : null}
              surProposer={(option) => proposer.mutate(option)}
              surAnnuler={() => setPropose(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setPropose(true)}
              className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
            >
              <Plus className="size-4" aria-hidden />
              Proposer une option
            </button>
          ))}

        {gerable && (
          <div className="flex flex-wrap gap-x-5 border-t border-[color:var(--border-subtle)] pt-2">
            <button
              type="button"
              onClick={() => clore.mutate()}
              disabled={clore.isPending}
              className="text-muted hover:text-brand-600 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
            >
              {sondage.clos ? <LockOpen className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              {sondage.clos ? 'Rouvrir' : 'Clore le sondage'}
            </button>
            <button
              type="button"
              onClick={surSupprimer}
              className="text-muted inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:text-red-600"
            >
              <Trash2 className="size-4" aria-hidden />
              Retirer
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function nomDe(userId: string, noms: ReadonlyMap<string, string>, moi: string | null): string {
  if (userId === moi) return 'vous';
  return noms.get(userId) ?? 'un membre';
}

function LigneDOption({
  option,
  genre,
  clos,
  noms,
  moi,
  enCours,
  surVoter,
}: {
  option: OptionDepouillee;
  genre: GenreDeSondage;
  clos: boolean;
  noms: ReadonlyMap<string, string>;
  moi: string | null;
  enCours: boolean;
  surVoter: () => void;
}) {
  const { option: o } = option;
  const dates = o.du ? periodeLisible(o.du, o.au ?? o.du) : null;
  // Pour des dates, le libellé est souvent la période elle-même : ne pas la
  // répéter en dessous.
  const detailDates = dates && dates.toLowerCase() !== o.libelle.toLowerCase() ? dates : null;
  const votants = option.votants.map((id) => nomDe(id, noms, moi));
  const retenu = clos && option.enTete;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border',
        option.moi ? 'border-brand-500' : 'border-[color:var(--border-subtle)]',
        retenu && 'border-gold-500',
      )}
    >
      {/* La part des votants, en fond : lisible d'un coup d'œil, sans chiffre à lire. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 transition-[width]',
          option.moi ? 'bg-brand-500/12' : 'bg-[color:var(--surface-muted)]',
        )}
        style={{ width: `${Math.round(option.part * 100)}%` }}
      />
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          aria-pressed={option.moi}
          disabled={clos || enCours}
          onClick={surVoter}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
        >
          <span
            aria-hidden
            className={cn(
              'grid size-5 shrink-0 place-items-center rounded-full border',
              option.moi ? 'bg-brand-500 border-brand-500 text-white' : 'border-[color:var(--border-strong,var(--border-subtle))]',
            )}
          >
            {option.moi && <Check className="size-3.5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {o.libelle}
              {retenu && <span className="text-gold-700 dark:text-gold-300 ml-2 text-xs font-semibold">Retenu</span>}
            </span>
            {(detailDates || votants.length > 0) && (
              <span className="text-muted block truncate text-xs">
                {[detailDates, votants.length > 0 && votants.join(', ')].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{option.voix}</span>
        </button>
        {o.lien && (
          <a
            href={o.lien}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ouvrir ${o.libelle}${genre === 'liens' ? ' (logement)' : ''}`}
            className="text-muted hover:text-brand-600 grid size-11 shrink-0 place-items-center"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Création -- */

const OPTION_VIDE: NouvelleOption = { libelle: '', lien: '', du: '', au: '' };

function FormulaireDeSondage({
  modele,
  surModele,
  enregistrement,
  surEnregistrer,
  surAnnuler,
}: {
  modele: ModeleDeSondage;
  surModele: (modele: ModeleDeSondage) => void;
  enregistrement: boolean;
  surEnregistrer: (sondage: NouveauSondage) => void;
  surAnnuler: () => void;
}) {
  const [question, setQuestion] = useState(modele.question);
  const [choixMultiple, setChoixMultiple] = useState(modele.choixMultiple);
  const [options, setOptions] = useState<NouvelleOption[]>([OPTION_VIDE, OPTION_VIDE]);
  const [tente, setTente] = useState(false);

  const probleme = problemeDuSondage(question, modele.genre, options);

  function choisir(suivant: ModeleDeSondage) {
    surModele(suivant);
    setQuestion(suivant.question);
    setChoixMultiple(suivant.choixMultiple);
    setOptions([OPTION_VIDE, OPTION_VIDE]);
    setTente(false);
  }

  function changer(index: number, changement: Partial<NouvelleOption>) {
    setOptions((actuelles) => actuelles.map((option, i) => (i === index ? { ...option, ...changement } : option)));
  }

  return (
    <Card className="animate-rise">
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">Nouveau sondage</h2>
          <button type="button" aria-label="Annuler" onClick={surAnnuler} className="text-muted -m-2 grid size-11 place-items-center">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Sur quoi porte le sondage">
          {MODELES_DE_SONDAGE.map((m) => (
            <Chip key={m.id} selected={m.id === modele.id} onClick={() => choisir(m)}>
              {m.titre}
            </Chip>
          ))}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">La question</span>
          <TextInput
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Qui prend la voiture ?"
            maxLength={200}
          />
        </label>

        <fieldset className="space-y-2.5">
          <legend className="mb-1.5 text-sm font-semibold">
            {modele.genre === 'dates' ? 'Les dates proposées' : modele.genre === 'liens' ? 'Les logements repérés' : 'Les options'}
          </legend>
          {options.map((option, index) => (
            <ChampsDOption
              key={index}
              nom={`Option ${index + 1}`}
              genre={modele.genre}
              option={option}
              surChanger={(changement) => changer(index, changement)}
              {...(options.length > 2 ? { surRetirer: () => setOptions((o) => o.filter((_, i) => i !== index)) } : {})}
            />
          ))}
          {options.length < 12 && (
            <button
              type="button"
              onClick={() => setOptions((actuelles) => [...actuelles, OPTION_VIDE])}
              className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
            >
              <Plus className="size-4" aria-hidden />
              Une option de plus
            </button>
          )}
        </fieldset>

        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={choixMultiple}
            onChange={(event) => setChoixMultiple(event.target.checked)}
            className="accent-brand-500 size-5"
          />
          Chacun peut cocher plusieurs options
        </label>

        {tente && probleme && (
          <p role="alert" className="text-sm text-red-600">
            {probleme}
          </p>
        )}

        <Button
          block
          loading={enregistrement}
          onClick={() => {
            setTente(true);
            if (!probleme) {
              surEnregistrer({ question: question.trim(), genre: modele.genre, choixMultiple, options });
            }
          }}
        >
          Lancer le sondage
        </Button>
      </CardBody>
    </Card>
  );
}

function ChampsDOption({
  nom,
  genre,
  option,
  surChanger,
  surRetirer,
}: {
  /** « Option 2 », « Nouvelle option » : le début du nom de chaque champ. */
  nom: string;
  genre: GenreDeSondage;
  option: NouvelleOption;
  surChanger: (changement: Partial<NouvelleOption>) => void;
  surRetirer?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1 space-y-2">
        {genre === 'dates' ? (
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              type="date"
              aria-label={`${nom} : premier jour`}
              value={option.du ?? ''}
              onChange={(event) => surChanger({ du: event.target.value })}
            />
            <TextInput
              type="date"
              aria-label={`${nom} : dernier jour`}
              value={option.au ?? ''}
              min={option.du ?? undefined}
              onChange={(event) => surChanger({ au: event.target.value })}
            />
          </div>
        ) : genre === 'liens' ? (
          <>
            <TextInput
              type="url"
              inputMode="url"
              aria-label={`${nom} : lien`}
              placeholder="https://www.airbnb.fr/rooms/…"
              value={option.lien ?? ''}
              onChange={(event) => surChanger({ lien: event.target.value })}
            />
            <TextInput
              aria-label={`${nom} : nom (facultatif)`}
              placeholder="Le riad avec piscine (facultatif)"
              value={option.libelle}
              maxLength={200}
              onChange={(event) => surChanger({ libelle: event.target.value })}
            />
          </>
        ) : (
          <TextInput
            aria-label={nom}
            placeholder={nom}
            value={option.libelle}
            maxLength={200}
            onChange={(event) => surChanger({ libelle: event.target.value })}
          />
        )}
      </div>
      {surRetirer && (
        <button
          type="button"
          aria-label={`Retirer : ${nom}`}
          onClick={surRetirer}
          className="text-muted grid size-11 shrink-0 place-items-center"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

function PropositionDOption({
  genre,
  enCours,
  erreur,
  surProposer,
  surAnnuler,
}: {
  genre: GenreDeSondage;
  enCours: boolean;
  erreur: string | null;
  surProposer: (option: NouvelleOption) => void;
  surAnnuler: () => void;
}) {
  const [option, setOption] = useState<NouvelleOption>(OPTION_VIDE);
  const [tente, setTente] = useState(false);
  const vide = !option.libelle.trim() && !option.lien?.trim() && !option.du;
  const probleme = vide ? 'Remplissez l’option.' : problemeDeLOption(genre, option);

  return (
    <div className="space-y-2 rounded-xl bg-[color:var(--surface-muted)] p-3">
      <ChampsDOption nom="Nouvelle option" genre={genre} option={option} surChanger={(c) => setOption((o) => ({ ...o, ...c }))} />
      {tente && (probleme || erreur) && (
        <p role="alert" className="text-sm text-red-600">
          {probleme ?? erreur}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={enCours}
          onClick={() => {
            setTente(true);
            if (!probleme) surProposer(option);
          }}
        >
          Proposer
        </Button>
        <Button size="sm" variant="secondary" onClick={surAnnuler}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
