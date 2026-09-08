import { ChevronDown, Info } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/**
 * Ce qu'il faut savoir avant de lire le classement — en deux lignes.
 *
 * Il y avait ici onze lignes d'explication : la méthode, l'avertissement sur
 * les envies manquantes, la nature des prix. Toutes vraies, toutes utiles la
 * première fois, et toutes relues à chaque ouverture pour rien. Onze lignes
 * avant la première destination, c'est un écran entier de préambule.
 *
 * Reste visible ce qui change d'un voyage à l'autre : combien de destinations,
 * et sur quoi elles sont classées. Le reste — la méthode, l'origine des prix —
 * se déplie à la demande. C'est le même texte, au même endroit ; il ne
 * s'impose simplement plus.
 *
 * Ce qui est transitoire ou anormal (un relevé en cours, un quota épuisé)
 * n'est pas ici : ça reste en bandeau, parce que ça mérite d'interrompre.
 */
export function EnTeteDesPropositions({
  combien,
  membresPresents,
  membresAttendus,
  prixEstimes,
  sourceConfiguree,
}: {
  combien: number;
  membresPresents: number;
  membresAttendus: number;
  /** Vrai quand aucun tarif relevé n'a été trouvé pour ce départ. */
  prixEstimes: boolean;
  /** Faux quand aucune source de tarifs n'est reliée côté serveur. */
  sourceConfiguree: boolean;
}) {
  const incomplet = membresPresents < membresAttendus;

  return (
    <Card id="propositions" className="scroll-mt-4">
      <CardBody className="space-y-1.5">
        <details className="group">
          <summary
            className={cn(
              'block cursor-pointer list-none space-y-1',
              '[&::-webkit-details-marker]:hidden',
            )}
          >
            <span className="flex min-h-9 items-baseline justify-between gap-3">
              <span className="font-semibold">{combien} destinations pour votre groupe</span>
              <ChevronDown
                className="text-muted size-4 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </span>
            <span className="text-muted block text-sm leading-relaxed">
              Classées sur le coût <strong>total</strong> du voyage, pas sur le prix du billet.
              {prixEstimes && ' Montants estimés.'}
              {incomplet && ` Envies de ${membresPresents} sur ${membresAttendus}.`}
            </span>
          </summary>

          <div className="text-muted space-y-2 pt-3 text-sm leading-relaxed">
            <p>
              Le coût additionne le transport, l’hébergement, les repas, les activités et les
              trajets sur place. Chaque note est détaillée sous la carte : aucune n’est décidée
              par une intelligence artificielle.
            </p>

            {incomplet && (
              <p>
                Seules les envies de {membresPresents} personne{membresPresents > 1 ? 's' : ''}{' '}
                sur {membresAttendus} sont prises en compte. Le classement changera quand les
                autres auront répondu.
              </p>
            )}

            {prixEstimes && (
              <p className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  {sourceConfiguree
                    ? 'Aucun tarif relevé pour ce départ et cette période : les montants sont des estimations, jamais des prix constatés.'
                    : 'Aucune source de tarifs n’est reliée : les montants sont des estimations. Les vrais prix apparaîtront avec leur date dès qu’un jeton Travelpayouts sera renseigné côté serveur.'}
                </span>
              </p>
            )}
          </div>
        </details>
      </CardBody>
    </Card>
  );
}
