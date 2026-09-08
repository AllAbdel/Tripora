import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, Share2 } from 'lucide-react';
import {
  MONTHS_FR,
  computeBalances,
  findDestination,
  formatCents,
  preparerLaValise,
  simplifyDebts,
  targetMonth,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Drapeau } from '@/components/Drapeau';
import { ListeFantome } from '@/components/ui/Squelette';
import { getExpenses } from '@/lib/expenses';
import { getItinerary } from '@/lib/itinerary';
import { getDiscussion } from '@/lib/discussion';
import { getValise } from '@/lib/packing';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { useAuth } from '@/lib/auth-context';
import { signaler } from '@/lib/feedback';

/**
 * Le voyage sur une page, à emporter.
 *
 * Deux usages, et ils demandent la même chose : une copie hors ligne pour le
 * jour où le réseau manque, et un souvenir à garder une fois rentré. Dans les
 * deux cas il faut une page qui tienne toute seule, sans application autour.
 *
 * **Le PDF est fabriqué par le navigateur**, pas par une bibliothèque. C'est
 * un choix, pas un raccourci : `window.print()` ouvre « Enregistrer au format
 * PDF » sur iPhone comme sur Android, produit un vrai PDF avec du texte
 * sélectionnable, et ne coûte pas un octet de plus à télécharger. Une
 * bibliothèque de génération pèserait plusieurs centaines de kilo-octets pour
 * un résultat moins bon — des images de texte, pas du texte.
 *
 * L'écran affiché est exactement celui qui s'imprime. Ce qui n'a pas de sens
 * sur papier — les boutons, la navigation — disparaît à l'impression, et rien
 * d'autre ne change : ce qu'on relit est ce qu'on a vu.
 */
export default function TripRecapitulatif() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();

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

  const epingles = useQuery({
    queryKey: ['epingles', id],
    queryFn: () => getDiscussion()!.listPins(id!),
    enabled: Boolean(id && getDiscussion()),
  });

  const valise = useQuery({
    queryKey: ['valise', id],
    queryFn: () => getValise()!.list(id!),
    enabled: Boolean(id && getValise()),
  });

  const data = voyage.data;
  const destination = data?.lockedDestinationId
    ? findDestination(data.lockedDestinationId)
    : undefined;

  const noms = useMemo(() => {
    const table = new Map<string, string>();
    for (const membre of data?.members ?? []) {
      table.set(membre.userId, membre.displayName ?? 'Voyageur');
    }
    return table;
  }, [data?.members]);

  const comptes = useMemo(() => {
    const liste = depenses.data ?? [];
    if (liste.length === 0 || !data) return null;
    const soldes = computeBalances(
      liste,
      data.members.map((membre) => membre.userId),
    );
    return {
      total: liste.reduce((somme, depense) => somme + depense.amountCents, 0),
      dettes: simplifyDebts(soldes),
    };
  }, [depenses.data, data]);

  const maValise = useMemo(() => {
    if (!data || !destination) return [];
    const ecartes = new Set(
      (valise.data ?? [])
        .filter((etat) => etat.userId === identity?.id && etat.removed)
        .map((etat) => etat.itemId),
    );
    const mesEnvies = data.members.find((m) => m.userId === identity?.id)?.weights;
    return preparerLaValise({
      destination,
      constraints: data.constraints,
      ...(mesEnvies ? { envies: mesEnvies } : {}),
    })
      .map((groupe) => ({
        ...groupe,
        articles: groupe.articles.filter((article) => !ecartes.has(article.id)),
      }))
      .filter((groupe) => groupe.articles.length > 0);
  }, [data, destination, valise.data, identity?.id]);

  async function partager() {
    const url = window.location.href.replace('/recapitulatif', '');
    const titre = data?.summary.title ?? 'Mon voyage';
    signaler('tape');
    try {
      if (navigator.share) {
        await navigator.share({ title: titre, text: `${titre} — organisé avec Tripora`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      signaler('reussite');
    } catch {
      // Partage refusé ou annulé : ce n'est pas une erreur à signaler.
    }
  }

  if (voyage.isPending) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <ListeFantome combien={3} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <Banner tone="warning" title="Voyage introuvable">
          Ce voyage n’existe plus, ou vous n’y avez pas accès.
        </Banner>
      </div>
    );
  }

  const mois = targetMonth(data.constraints);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28 print:max-w-none print:px-0 print:pb-0">
      {/* Barre d'actions : elle n'a aucun sens sur papier. */}
      <div className="mb-5 flex items-center gap-2 print:hidden">
        <Link
          to={`/voyages/${id}`}
          aria-label="Retour au voyage"
          className="hover:bg-brand-50 dark:hover:bg-ink-700/40 -ml-2 grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">Récapitulatif</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 print:hidden">
        <Button
          icon={<Printer className="size-4" aria-hidden />}
          onClick={() => {
            signaler('tape');
            window.print();
          }}
        >
          Enregistrer en PDF
        </Button>
        <Button
          variant="secondary"
          icon={<Share2 className="size-4" aria-hidden />}
          onClick={() => void partager()}
        >
          Partager
        </Button>
      </div>

      <p className="text-muted mb-6 text-sm leading-relaxed print:hidden">
        « Enregistrer en PDF » passe par l’impression de votre navigateur : choisissez
        « Enregistrer au format PDF » plutôt qu’une imprimante. Le fichier obtenu contient du vrai
        texte, se lit hors ligne et pèse quelques dizaines de kilo-octets.
      </p>

      <article className="space-y-6 print:space-y-4 print:text-[11pt]">
        <header className="space-y-1.5 border-b border-[color:var(--border-subtle)] pb-4">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight print:text-[18pt]">
            {destination && (
              <Drapeau
                code={destination.countryCode}
                pays={destination.country}
                className="h-5 w-[1.67rem]"
              />
            )}
            {data.summary.title}
          </h2>
          <p className="text-muted text-sm">
            {destination ? `${destination.name}, ${destination.country}` : 'Destination à décider'}
            {' · '}
            {data.constraints.durationDays} jours
            {mois !== undefined && ` · ${MONTHS_FR[mois - 1]}`}
            {' · départ de '}
            {data.constraints.origin.name}
          </p>
          <p className="text-muted text-sm">
            {data.members.map((membre) => membre.displayName ?? 'Voyageur').join(', ')}
          </p>
        </header>

        <Section titre="Le programme" vide="L’itinéraire n’a pas encore été construit.">
          {(itineraire.data ?? []).length > 0 &&
            (itineraire.data ?? []).map((jour) => (
              <div key={jour.id} className="break-inside-avoid space-y-1">
                <h4 className="text-sm font-semibold">
                  Jour {jour.dayIndex + 1}
                  {jour.summary && <span className="text-muted font-normal"> — {jour.summary}</span>}
                </h4>
                {jour.items.length === 0 ? (
                  <p className="text-muted text-sm">Journée libre.</p>
                ) : (
                  <ul className="text-sm">
                    {jour.items.map((item) => (
                      <li key={item.id} className="flex gap-2 py-0.5">
                        <span className="text-muted w-12 shrink-0 tabular-nums">
                          {item.startTime?.slice(0, 5) ?? '—'}
                        </span>
                        <span className="min-w-0 flex-1">{item.title}</span>
                        {item.costCents > 0 && (
                          <span className="text-muted shrink-0 tabular-nums">
                            {formatCents(item.costCents, 'EUR', { hideCentimes: true })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </Section>

        <Section
          titre="Les endroits retenus"
          vide="Aucun endroit épinglé dans la discussion."
        >
          {(epingles.data ?? []).length > 0 && (
            <ul className="space-y-1 text-sm">
              {(epingles.data ?? []).map((epingle) => (
                <li key={epingle.id}>
                  <span className="font-medium">{epingle.label}</span>
                  {epingle.address && <span className="text-muted"> — {epingle.address}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section titre="Ma valise" vide="La liste apparaîtra une fois la destination arrêtée.">
          {maValise.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
              {maValise.map((groupe) => (
                <div key={groupe.rubrique} className="break-inside-avoid">
                  <h4 className="text-xs font-semibold tracking-wide uppercase">
                    {groupe.libelle}
                  </h4>
                  <ul className="text-sm">
                    {groupe.articles.map((article) => (
                      <li key={article.id} className="flex items-start gap-2 py-0.5">
                        {/* Une case dessinée plutôt qu'un caractère : le carré
                            de la table Unicode n'existe pas dans toutes les
                            polices, et il sort en tofu dans le PDF. */}
                        <span
                          aria-hidden
                          className="mt-[0.2em] size-3 shrink-0 rounded-[2px] border border-current opacity-40"
                        />
                        <span>
                          {article.quantite !== null && `${article.quantite} `}
                          {article.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section titre="Les comptes" vide="Aucune dépense enregistrée.">
          {comptes && (
            <div className="space-y-1.5 text-sm">
              <p>
                <span className="font-medium">Total dépensé :</span>{' '}
                {formatCents(comptes.total, 'EUR')}
              </p>
              {comptes.dettes.length === 0 ? (
                <p className="text-muted">Tout le monde est à jour.</p>
              ) : (
                <ul>
                  {comptes.dettes.map((dette) => (
                    <li key={`${dette.from}-${dette.to}`} className="py-0.5">
                      {noms.get(dette.from) ?? 'Quelqu’un'} doit{' '}
                      {formatCents(dette.cents, 'EUR')} à {noms.get(dette.to) ?? 'quelqu’un'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Section>

        <footer className="text-muted border-t border-[color:var(--border-subtle)] pt-3 text-xs">
          Préparé avec Tripora · {new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}
        </footer>
      </article>
    </div>
  );
}

/**
 * Une section du récapitulatif.
 *
 * Elle s'affiche même vide, avec une phrase qui dit pourquoi : sur un document
 * qu'on relira dans six mois, une section absente laisse croire à un oubli
 * alors qu'il n'y avait simplement rien à mettre.
 */
function Section({
  titre,
  vide,
  children,
}: {
  titre: string;
  vide: string;
  children: React.ReactNode;
}) {
  const rempli = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <section className="space-y-2 break-inside-avoid">
      <h3 className="text-base font-bold">{titre}</h3>
      {rempli ? children : <p className="text-muted text-sm">{vide}</p>}
    </section>
  );
}
