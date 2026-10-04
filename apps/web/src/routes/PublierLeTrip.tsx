import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Globe2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { TitreDePage } from '@/components/TitreDePage';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import {
  getTripsOuverts,
  lireLErreur,
  REGLAGES_PAR_DEFAUT,
  type Mixite,
  type Reglages,
  type Rythme,
} from '@/lib/tripsOuverts';
import { signaler } from '@/lib/feedback';
import { cn } from '@/lib/cn';

/**
 * Ouvrir son voyage à des inconnus.
 *
 * L'écran est long, et il l'est exprès. Chaque réglage retire quelque chose au
 * hasard d'une rencontre : qui peut entrer, combien, à quel âge, à quel rythme,
 * et si l'on veut relire chaque candidature. Les regrouper derrière un
 * « options avancées » reviendrait à faire publier des gens sans qu'ils aient
 * vu ce qu'ils publiaient.
 *
 * Un seul réglage a un défaut ferme : la validation manuelle. Ouvrir sa porte
 * ne veut pas dire la laisser ouverte.
 */

const MIXITES: { valeur: Mixite; titre: string; detail: string }[] = [
  { valeur: 'mixte', titre: 'Groupe mixte', detail: 'Tout le monde peut demander à venir.' },
  { valeur: 'femmes', titre: 'Entre femmes', detail: 'Seules les femmes pourront rejoindre.' },
  { valeur: 'hommes', titre: 'Entre hommes', detail: 'Seuls les hommes pourront rejoindre.' },
];

const RYTHMES: { valeur: Rythme; titre: string; detail: string }[] = [
  { valeur: 'tranquille', titre: 'Tranquille', detail: 'Peu de choses par jour, on prend le temps.' },
  { valeur: 'equilibre', titre: 'Équilibré', detail: 'Une ou deux visites, et des pauses.' },
  { valeur: 'intense', titre: 'Intense', detail: 'On se lève tôt et on enchaîne.' },
];

const LANGUES: { code: string; nom: string }[] = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'Anglais' },
  { code: 'es', nom: 'Espagnol' },
  { code: 'it', nom: 'Italien' },
  { code: 'de', nom: 'Allemand' },
  { code: 'pt', nom: 'Portugais' },
  { code: 'ar', nom: 'Arabe' },
  { code: 'tr', nom: 'Turc' },
];

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="etiquette etiquette-filet">{titre}</h2>
      {children}
    </section>
  );
}

function Choix<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: { valeur: T; titre: string; detail: string }[];
  valeur: T;
  onChange: (valeur: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <button
          key={option.valeur}
          type="button"
          onClick={() => onChange(option.valeur)}
          aria-pressed={valeur === option.valeur}
          className={cn(
            'w-full rounded-[var(--radius-card)] border p-3 text-start transition-colors',
            valeur === option.valeur ?
              'border-brand-500 bg-brand-500/8'
            : 'filet surface-raised hover:bg-[color:var(--surface-muted)]',
          )}
        >
          <span className="block font-semibold">{option.titre}</span>
          <span className="text-muted block text-sm">{option.detail}</span>
        </button>
      ))}
    </div>
  );
}

export default function PublierLeTrip() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ouverts = getTripsOuverts();

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });

  const existant = useQuery({
    queryKey: ['publication', id],
    queryFn: () => ouverts.reglagesDe(id!),
    enabled: Boolean(id),
  });

  const [r, setR] = useState<Reglages>(REGLAGES_PAR_DEFAUT);
  const modifie = (champ: Partial<Reglages>) => setR((actuel) => ({ ...actuel, ...champ }));

  // Les réglages déjà enregistrés reprennent la main une fois, quand ils
  // arrivent : republier ne doit pas remettre tout à zéro sous les doigts, et
  // une revalidation ne doit pas effacer ce qu'on est en train d'écrire.
  const [charges, setCharges] = useState<Reglages | null>(null);
  if (existant.data && existant.data !== charges) {
    setCharges(existant.data);
    setR(existant.data);
  }

  const publier = useMutation({
    mutationFn: () => ouverts.publier(id!, r),
    onSuccess: () => {
      signaler('decision');
      void queryClient.invalidateQueries({ queryKey: ['publication', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips-ouverts'] });
      navigate(`/voyages/${id}/candidatures`);
    },
    onError: () => signaler('echec'),
  });

  const refermer = useMutation({
    mutationFn: () => ouverts.refermer(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['publication', id] });
      navigate(`/voyages/${id}`);
    },
  });

  const dejaPublie = Boolean(existant.data);
  const trancheDAge = r.ageMin !== null || r.ageMax !== null;
  const membres = voyage.data?.members.length ?? 1;
  const resumeTropCourt = r.resume.trim().length < 20;

  return (
    <div className="pb-16">
      <div className="px-5 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="text-muted hover:text-brand-600 -ms-1 mb-2 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </button>
        <TitreDePage pastille="participants">
          {dejaPublie ? 'Réglages de la publication' : 'Ouvrir ce trip'}
        </TitreDePage>
        <p className="text-muted mt-1 text-sm">
          Des gens que vous ne connaissez pas pourront demander à vous rejoindre, aux conditions
          que vous fixez ici.
        </p>
      </div>

      <div className="space-y-7 px-5 pt-6">
        {!voyage.data?.lockedDestinationId && (
          <Banner tone="warning">
            Arrêtez d’abord la destination : sans elle, personne ne peut vous trouver.
          </Banner>
        )}

        <Section titre="Ce que vous annoncez">
          {/* Un `aria-label` et pas seulement un `placeholder` : le texte
              d'invite disparaît dès qu'on tape, et un lecteur d'écran ne
              l'annonce pas comme un nom de champ. */}
          <textarea
            aria-label="Le voyage en quelques phrases"
            value={r.resume}
            onChange={(event) => modifie({ resume: event.target.value })}
            rows={4}
            maxLength={1000}
            placeholder="Le voyage en quelques phrases : ce que vous voulez en faire, l’ambiance, ce qui est déjà décidé."
            className="surface-raised w-full rounded-[var(--radius-card)] border filet p-3
                       text-[16px] outline-none focus:border-brand-500"
          />
          <p className="text-muted text-xs">
            {resumeTropCourt ?
              'Au moins vingt caractères : c’est la première chose que les gens liront.'
            : `${r.resume.trim().length} caractères.`}
          </p>
        </Section>

        <Section titre="Qui peut venir">
          <Choix options={MIXITES} valeur={r.mixite} onChange={(mixite) => modifie({
            mixite,
            // Un quota d'hommes sur un voyage entre femmes n'a pas de sens :
            // la base le refuse, autant ne pas laisser l'écran le proposer.
            placesHommes: mixite === 'femmes' ? null : r.placesHommes,
            placesFemmes: mixite === 'hommes' ? null : r.placesFemmes,
          })} />

          <p className="text-muted text-xs">
            La règle s’applique dans la base, pas seulement à l’écran. Une personne qui n’a pas
            renseigné son genre ne pourra rejoindre qu’un groupe mixte : on ne garantit pas une
            règle qu’on n’est pas en mesure de vérifier.
          </p>
        </Section>

        <Section titre="Combien vous êtes">
          <div className="space-y-3">
            <NumberStepper
              value={r.placesMax}
              min={Math.max(2, membres)}
              max={30}
              onChange={(placesMax) => modifie({ placesMax })}
              label="Places au total"
              aide={`Vous êtes déjà ${membres}, organisateur compris.`}
            />

            {r.mixite === 'mixte' && (
              <>
                <p className="text-muted px-1 text-xs">
                  Vous pouvez réserver des places à chaque genre pour garder un groupe équilibré.
                  Une place réservée aux femmes reste libre même si trois hommes attendent.
                </p>
                <NumberStepper
                  value={r.placesFemmes ?? 0}
                  min={0}
                  max={r.placesMax}
                  onChange={(n) => modifie({ placesFemmes: n === 0 ? null : n })}
                  label="Réservées aux femmes"
                  aide="Zéro pour ne rien réserver."
                />
                <NumberStepper
                  value={r.placesHommes ?? 0}
                  min={0}
                  max={r.placesMax}
                  onChange={(n) => modifie({ placesHommes: n === 0 ? null : n })}
                  label="Réservées aux hommes"
                  aide="Zéro pour ne rien réserver."
                />
              </>
            )}
          </div>
        </Section>

        <Section titre="Âge">
          {/* Les compteurs restent cachés tant qu'aucune tranche n'est fixée.
              Les afficher à « 18 » et « 99 » par défaut donnerait à lire une
              règle qui n'est pas enregistrée — et personne ne penserait à la
              retirer, puisqu'elle a l'air d'être là. */}
          <div className="space-y-3">
            <label className="surface-raised flex items-center justify-between gap-4 rounded-[var(--radius-card)] border filet p-4">
              <span>
                <span className="block font-semibold">Fixer une tranche d’âge</span>
                <span className="text-muted block text-sm">
                  Sans ça, tous les âges sont les bienvenus.
                </span>
              </span>
              <input
                type="checkbox"
                checked={trancheDAge}
                onChange={(event) =>
                  modifie(
                    event.target.checked ?
                      { ageMin: 18, ageMax: 45 }
                    : { ageMin: null, ageMax: null },
                  )
                }
                className="accent-brand-500 size-5 shrink-0"
              />
            </label>

            {trancheDAge && (
              <>
                <NumberStepper
                  value={r.ageMin ?? 18}
                  min={16}
                  max={r.ageMax ?? 99}
                  onChange={(ageMin) => modifie({ ageMin })}
                  label="À partir de"
                  suffix="ans"
                />
                <NumberStepper
                  value={r.ageMax ?? 99}
                  min={r.ageMin ?? 16}
                  max={99}
                  onChange={(ageMax) => modifie({ ageMax })}
                  label="Jusqu’à"
                  suffix="ans"
                />
                <p className="text-muted px-1 text-xs">
                  Une personne qui n’a pas renseigné son année de naissance ne pourra pas
                  postuler.
                </p>
              </>
            )}
          </div>
        </Section>

        <Section titre="Comment ça se passe">
          <Choix options={RYTHMES} valeur={r.rythme} onChange={(rythme) => modifie({ rythme })} />

          <label className="surface-raised flex items-center justify-between gap-4 rounded-[var(--radius-card)] border filet p-4">
            <span>
              <span className="block font-semibold">Hébergement partagé</span>
              <span className="text-muted block text-sm">
                Chambre ou appartement en commun. À dire avant, pas après.
              </span>
            </span>
            <input
              type="checkbox"
              checked={r.hebergementPartage}
              onChange={(event) => modifie({ hebergementPartage: event.target.checked })}
              className="accent-brand-500 size-5 shrink-0"
            />
          </label>
        </Section>

        <Section titre="Langues parlées">
          <div className="flex flex-wrap gap-2">
            {LANGUES.map((langue) => {
              const active = r.langues.includes(langue.code);
              return (
                <button
                  key={langue.code}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    modifie({
                      langues:
                        active ?
                          r.langues.filter((code) => code !== langue.code)
                        : [...r.langues, langue.code],
                    })
                  }
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                    active ?
                      'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-200 font-semibold'
                    : 'filet surface-raised text-muted',
                  )}
                >
                  {langue.nom}
                </button>
              );
            })}
          </div>
        </Section>

        <Section titre="Les candidatures">
          <Choix
            options={[
              {
                valeur: 'organisateur' as const,
                titre: 'Je lis et je décide',
                detail: 'Chaque personne vous envoie une présentation, vous tranchez.',
              },
              {
                valeur: 'auto' as const,
                titre: 'Acceptation automatique',
                detail: 'Toute personne qui remplit les conditions entre directement.',
              },
            ]}
            valeur={r.validation}
            onChange={(validation) => modifie({ validation })}
          />

          <NumberStepper
            value={r.presentationMinimum}
            min={0}
            max={500}
            pas={20}
            onChange={(presentationMinimum) => modifie({ presentationMinimum })}
            label="Présentation minimale"
            aide="En caractères. Zéro pour ne rien exiger."
          />
        </Section>

        {publier.error && <Banner tone="warning">{lireLErreur(publier.error)}</Banner>}

        <div className="space-y-3">
          <Button
            block
            size="lg"
            icon={<Globe2 className="size-4" />}
            loading={publier.isPending}
            disabled={resumeTropCourt || !voyage.data?.lockedDestinationId}
            onClick={() => publier.mutate()}
          >
            {dejaPublie ? 'Mettre à jour' : 'Publier le trip'}
          </Button>

          {dejaPublie && (
            <Button
              block
              variant="secondary"
              icon={<Lock className="size-4" />}
              loading={refermer.isPending}
              onClick={() => refermer.mutate()}
            >
              Refermer — ne plus recevoir de candidatures
            </Button>
          )}

          <p className="text-muted text-center text-xs">
            Publier ne montre ni vos membres, ni votre itinéraire, ni votre discussion. Seuls la
            destination, les dates, le budget et ces conditions sont visibles.
          </p>
        </div>
      </div>
    </div>
  );
}
