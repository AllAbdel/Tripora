import { Car, Clock, ExternalLink, Phone, Plug, Wallet } from 'lucide-react';
import {
  besoinDAdaptateur,
  codeDuPays,
  currencyForCountry,
  currencyName,
  decalageLisible,
  ecartAvecUtc,
  infosPratiques,
  tensionBasse,
  type Destination,
  type NumeroDUrgence,
} from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Drapeau } from '@/components/Drapeau';

/**
 * Ce qu'on cherche la veille du départ, ou sur place : faut-il un adaptateur,
 * quel est le numéro des secours, de quel côté roule-t-on, quelle heure est-il
 * là-bas. Sans réseau, calculé depuis la destination et la ville de départ.
 */

const CONSEILS_AUX_VOYAGEURS =
  'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/';

const NOMS_DES_SERVICES: Record<NonNullable<NumeroDUrgence['service']>, string> = {
  police: 'Police',
  ambulance: 'Ambulance',
  pompiers: 'Pompiers',
  'police touristique': 'Police touristique',
};

export function InfosPratiques({
  destination,
  paysDeDepart,
  maintenant,
}: {
  destination: Destination;
  /** Le pays de la ville de départ, en toutes lettres (« France »). */
  paysDeDepart: string | undefined;
  maintenant?: Date;
}) {
  const infos = infosPratiques(destination.countryCode);
  if (!infos) return null;

  const depart = codeDuPays(paysDeDepart);
  const memePays = depart === destination.countryCode.toUpperCase();
  const besoin = besoinDAdaptateur(depart, destination.countryCode);
  const departInfos = depart ? infosPratiques(depart) : undefined;
  const devise = currencyForCountry(destination.countryCode);

  const labas = destination.timezone ? ecartAvecUtc(destination.timezone, maintenant) : undefined;
  const ici = -(maintenant ?? new Date()).getTimezoneOffset();
  const decalage = labas === undefined ? undefined : labas - ici;

  const prises = `Prises de type ${infos.prises.join(', ')} · ${infos.tension} V`;
  const verdict =
    memePays ? null
    : besoin === 'aucun' ? 'Pas besoin d’adaptateur.'
    : besoin === 'fiches-plates' ? 'Les chargeurs à fiche plate passent ; pour les fiches rondes épaisses, un adaptateur.'
    : besoin === 'necessaire' ? 'Adaptateur nécessaire.'
    : null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Drapeau code={destination.countryCode} pays={destination.country} className="h-4" />
          Infos pratiques · {destination.country}
        </h2>

        <dl className="space-y-2.5 text-sm">
          <Ligne icone={Plug} titre="Électricité">
            {prises}
            {verdict && <span className="block font-medium">{verdict}</span>}
            {tensionBasse(infos.tension) && !(departInfos && tensionBasse(departInfos.tension)) && (
              <span className="text-muted block text-xs">
                Courant faible : les chargeurs récents acceptent tout, pas un sèche-cheveux ni un fer
                à lisser européens.
              </span>
            )}
          </Ligne>

          <Ligne icone={Phone} titre="Urgences">
            {infos.urgences.length > 0 ? (
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {infos.urgences.map((urgence) => (
                  <a
                    key={`${urgence.service ?? 'general'}-${urgence.numero}`}
                    href={`tel:${urgence.numero}`}
                    className="text-brand-600 dark:text-brand-300 font-semibold underline"
                  >
                    {urgence.service ? `${NOMS_DES_SERVICES[urgence.service]} ${urgence.numero}` : urgence.numero}
                  </a>
                ))}
              </span>
            ) : (
              <span className="text-muted">À vérifier dans les conseils officiels, plus bas.</span>
            )}
          </Ligne>

          <Ligne icone={Car} titre="Sur la route">
            {infos.conduite === 'gauche' ? (
              <strong>On roule à gauche.</strong>
            ) : (
              'On roule à droite.'
            )}
          </Ligne>

          {devise && (
            <Ligne icone={Wallet} titre="Monnaie">
              {majuscule(currencyName(devise))} ({devise})
            </Ligne>
          )}

          {decalage !== undefined && !memePays && (
            <Ligne icone={Clock} titre="Heure">
              {decalage === 0 ? 'La même heure qu’ici.' : `${decalageLisible(decalage)} par rapport à votre heure.`}
            </Ligne>
          )}
        </dl>

        <a
          href={CONSEILS_AUX_VOYAGEURS}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
        >
          Conseils aux voyageurs, sécurité et formalités
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </CardBody>
    </Card>
  );
}

function Ligne({ icone: Icone, titre, children }: { icone: typeof Plug; titre: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icone className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <dt className="text-muted text-xs">{titre}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
