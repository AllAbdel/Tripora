import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, MapPin, Pin, Send, Trash2, X } from 'lucide-react';
import { fragmenterMessage, nomPropose, premierLien, type FragmentMessage } from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { getDiscussion, type Epingle, type Message } from '@/lib/discussion';
import { chercherAdresses, type AdresseTrouvee } from '@/lib/geocode';
import { useAuth } from '@/lib/auth-context';
import { toFailure } from '@/lib/errors';
import { cn } from '@/lib/cn';

/**
 * La discussion du voyage.
 *
 * C'est là que le voyage se prépare vraiment : quelqu'un colle un lien trouvé
 * sur TikTok, le groupe en parle, et ce qui est retenu devient une épingle —
 * un nom, une adresse, un point sur la carte que tout le monde retrouve.
 *
 * Les liens sont rendus par `fragmenterMessage`, qui n'autorise que `http` et
 * `https` : rien ici n'assemble du HTML, les morceaux sont posés tels quels
 * dans des nœuds React. Le domaine est toujours visible, pour qu'un lien
 * maquillé se remarque avant le clic et pas après.
 */
export default function TripDiscussion() {
  const { id } = useParams<{ id: string }>();
  const discussion = getDiscussion();
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const [texte, setTexte] = useState('');
  const [aEpingler, setAEpingler] = useState<Message | null>(null);
  const finDuFil = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ['discussion', id],
    queryFn: () => discussion!.listMessages(id!),
    enabled: Boolean(id && discussion),
  });

  const epingles = useQuery({
    queryKey: ['epingles', id],
    queryFn: () => discussion!.listPins(id!),
    enabled: Boolean(id && discussion),
  });

  // Une conversation qui n'arrive pas toute seule n'est pas une conversation.
  useEffect(() => {
    if (!id || !discussion) return;
    return discussion.watchDiscussion(id, () => {
      void queryClient.invalidateQueries({ queryKey: ['discussion', id] });
      void queryClient.invalidateQueries({ queryKey: ['epingles', id] });
    });
  }, [id, discussion, queryClient]);

  const nombre = messages.data?.length ?? 0;
  useEffect(() => {
    finDuFil.current?.scrollIntoView({ block: 'end' });
  }, [nombre]);

  const envoyer = useMutation({
    mutationFn: (body: string) => discussion!.sendMessage(id!, body),
    onSuccess: () => {
      setTexte('');
      void queryClient.invalidateQueries({ queryKey: ['discussion', id] });
    },
  });

  const effacer = useMutation({
    mutationFn: (messageId: string) => discussion!.deleteMessage(messageId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['discussion', id] }),
  });

  if (!discussion) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <Retour id={id} />
        <h1 className="text-2xl font-bold tracking-tight">Discussion</h1>
        <Banner tone="warning" title="Mode local">
          La discussion n’existe qu’à plusieurs, donc qu’avec un serveur. Vos voyages
          restent consultables sur cet appareil.
        </Banner>
      </div>
    );
  }

  const liste = messages.data ?? [];
  const marquees = epingles.data ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="space-y-3 px-5 pt-6">
        <Retour id={id} />
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Discussion</h1>
          {marquees.length > 0 && (
            <Link
              to={`/voyages/${id ?? ''}/carte`}
              className="text-brand-600 dark:text-brand-400 inline-flex items-center gap-1.5 text-sm font-medium"
            >
              <MapPin className="size-4" aria-hidden />
              {marquees.length} sur la carte
            </Link>
          )}
        </div>

        {(envoyer.error || messages.error) && (
          <Banner tone="warning" title="Un problème est survenu">
            {toFailure(envoyer.error ?? messages.error).message}
          </Banner>
        )}
      </div>

      <div className="flex-1 space-y-3 px-5 pt-4 pb-40">
        {messages.isLoading && (
          <p className="text-muted py-8 text-center text-sm">Chargement…</p>
        )}

        {!messages.isLoading && liste.length === 0 && (
          <Card>
            <CardBody className="space-y-2 p-5 text-center">
              <p className="font-semibold">Rien n’a encore été dit</p>
              <p className="text-muted text-sm leading-relaxed">
                Collez un lien — une vidéo, un article, un logement — et le groupe
                pourra en discuter. Ce qui est retenu se pose sur la carte du voyage.
              </p>
            </CardBody>
          </Card>
        )}

        {liste.map((message) => (
          <MessageLu
            key={message.id}
            message={message}
            deMoi={message.authorId === identity?.id}
            epingle={marquees.find((pin) => pin.messageId === message.id)}
            onEpingler={() => setAEpingler(message)}
            onEffacer={() => effacer.mutate(message.id)}
          />
        ))}
        <div ref={finDuFil} />
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 mx-auto w-full max-w-2xl border-t border-[color:var(--border-subtle)] bg-[color:var(--surface)]/95 px-5 py-3 backdrop-blur-xl">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (texte.trim() !== '') envoyer.mutate(texte);
          }}
        >
          <TextInput
            value={texte}
            onChange={(event) => setTexte(event.target.value)}
            placeholder="Un lien, une idée, une question…"
            aria-label="Votre message"
            maxLength={2000}
          />
          <Button
            type="submit"
            size="lg"
            aria-label="Envoyer"
            disabled={texte.trim() === ''}
            loading={envoyer.isPending}
            icon={<Send className="size-4" aria-hidden />}
          />
        </form>
      </div>

      {aEpingler && id && (
        <FormulaireEpingle
          tripId={id}
          message={aEpingler}
          onFerme={() => setAEpingler(null)}
        />
      )}
    </div>
  );
}

function MessageLu({
  message,
  deMoi,
  epingle,
  onEpingler,
  onEffacer,
}: {
  message: Message;
  deMoi: boolean;
  epingle: Epingle | undefined;
  onEpingler: () => void;
  onEffacer: () => void;
}) {
  const fragments = useMemo(() => fragmenterMessage(message.body), [message.body]);
  const contientUnLien = fragments.some((fragment) => fragment.kind === 'link');

  return (
    <Card className={cn(deMoi && 'border-brand-500/40')}>
      <CardBody className="space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold">
            {deMoi ? 'Vous' : message.authorName}
          </span>
          <span className="text-muted shrink-0 text-xs tabular-nums">
            {heure(message.createdAt)}
          </span>
        </div>

        <p className="text-[0.95rem] leading-relaxed break-words whitespace-pre-wrap">
          {fragments.map((fragment, index) => (
            <Morceau key={index} fragment={fragment} />
          ))}
        </p>

        <div className="flex items-center gap-2 pt-1">
          {epingle ? (
            <span className="text-lagoon-700 dark:text-lagoon-300 inline-flex items-center gap-1.5 text-xs font-medium">
              <Pin className="size-3.5" aria-hidden />
              Épinglé — {epingle.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={onEpingler}
              className="text-muted hover:text-brand-500 inline-flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors"
            >
              <Pin className="size-3.5" aria-hidden />
              {contientUnLien ? 'Épingler ce lieu' : 'En faire une épingle'}
            </button>
          )}
          {deMoi && (
            <button
              type="button"
              onClick={onEffacer}
              aria-label="Effacer mon message"
              className="text-muted hover:text-gold-600 ml-auto rounded-full transition-colors"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Un morceau de message : du texte, ou un lien.
 *
 * Le domaine est affiché à côté du lien parce qu'une adresse peut dire
 * n'importe quoi. `noopener noreferrer` évite que la page ouverte garde la
 * main sur la nôtre.
 */
function Morceau({ fragment }: { fragment: FragmentMessage }) {
  if (fragment.kind === 'text') return <>{fragment.text}</>;
  return (
    <a
      href={fragment.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-brand-600 dark:text-brand-400 inline-flex max-w-full items-baseline gap-1 font-medium break-all underline underline-offset-2"
    >
      {fragment.url}
      <ExternalLink className="size-3 shrink-0 self-center" aria-hidden />
      <span className="text-muted text-xs">({fragment.host})</span>
    </a>
  );
}

function FormulaireEpingle({
  tripId,
  message,
  onFerme,
}: {
  tripId: string;
  message: Message;
  onFerme: () => void;
}) {
  const discussion = getDiscussion()!;
  const queryClient = useQueryClient();
  const lien = useMemo(() => premierLien(message.body), [message.body]);
  const [nom, setNom] = useState(() => (lien ? nomPropose(lien) : ''));
  const [recherche, setRecherche] = useState('');
  const [choisie, setChoisie] = useState<AdresseTrouvee | null>(null);
  const [resultats, setResultats] = useState<AdresseTrouvee[]>([]);
  const [cherche, setCherche] = useState(false);

  const poser = useMutation({
    mutationFn: () =>
      discussion.addPin(tripId, {
        label: nom.trim() === '' ? 'Endroit à voir' : nom,
        address: choisie?.address ?? (recherche.trim() || null),
        lat: choisie?.lat ?? null,
        lng: choisie?.lng ?? null,
        url: lien?.kind === 'link' ? lien.url : null,
        messageId: message.id,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['epingles', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['discussion', tripId] });
      onFerme();
    },
  });

  async function lancerRecherche() {
    if (recherche.trim().length < 3) return;
    setCherche(true);
    const trouvees = await chercherAdresses(recherche);
    setResultats(trouvees);
    setCherche(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="pb-safe animate-rise max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[color:var(--surface)] px-5 pt-5 pb-6">
        <div className="flex items-start justify-between gap-3 pb-3">
          <div>
            <h2 className="text-lg font-bold">Épingler cet endroit</h2>
            <p className="text-muted text-sm">
              Il apparaîtra sur la carte du voyage, pour tout le groupe.
            </p>
          </div>
          <button
            type="button"
            onClick={onFerme}
            aria-label="Fermer"
            className="text-muted hover:text-brand-500 -mr-2 rounded-full p-2 transition-colors"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Nom de l’endroit">
            <TextInput
              value={nom}
              onChange={(event) => setNom(event.target.value)}
              placeholder="La calanque dont parlait Thomas"
              maxLength={120}
            />
          </Field>

          <Field
            label="Adresse"
            hint="Facultatif. Sans adresse, l’épingle reste dans la liste et n’apparaît pas sur la carte — plutôt que d’y apparaître au mauvais endroit."
          >
            <div className="flex gap-2">
              <TextInput
                value={recherche}
                onChange={(event) => {
                  setRecherche(event.target.value);
                  setChoisie(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void lancerRecherche();
                  }
                }}
                placeholder="Calanque de Sormiou, Marseille"
                maxLength={300}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void lancerRecherche()}
                loading={cherche}
                disabled={recherche.trim().length < 3}
              >
                Situer
              </Button>
            </div>
          </Field>

          {resultats.length > 0 && !choisie && (
            <ul className="space-y-1.5">
              {resultats.map((adresse, index) => (
                <li key={`${adresse.lat},${adresse.lng},${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setChoisie(adresse);
                      if (nom.trim() === '') setNom(adresse.label);
                    }}
                    className="hover:border-brand-500 w-full rounded-xl border border-[color:var(--border-subtle)] px-3 py-2 text-left transition-colors"
                  >
                    <span className="block text-sm font-medium">{adresse.label}</span>
                    {adresse.address && (
                      <span className="text-muted block text-xs">{adresse.address}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {choisie && (
            <Banner tone="info" title="Situé">
              {choisie.label}
              {choisie.address ? ` — ${choisie.address}` : ''}
            </Banner>
          )}

          {!cherche && recherche.trim().length >= 3 && resultats.length === 0 && !choisie && (
            <p className="text-muted text-sm">
              Rien trouvé à cette adresse. L’épingle peut être créée quand même : elle
              restera dans la liste, sans point sur la carte.
            </p>
          )}

          {poser.error && (
            <Banner tone="warning" title="Impossible d’épingler">
              {toFailure(poser.error).message}
            </Banner>
          )}

          <Button block size="lg" loading={poser.isPending} onClick={() => poser.mutate()}>
            {choisie ? 'Épingler sur la carte' : 'Épingler'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function heure(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function Retour({ id }: { id: string | undefined }) {
  return (
    <Link
      to={`/voyages/${id ?? ''}`}
      className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Retour au voyage
    </Link>
  );
}
