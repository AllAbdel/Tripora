import { useId, useState, type FormEvent } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import {
  FOURNISSEURS,
  TYPES_DE_RESERVATION,
  lireUnNombre,
  lireUneConfirmation,
  type DonneesDeReservation,
  type LectureDeConfirmation,
  type TypeDeReservation,
} from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Field, TextInput } from '@/components/ui/Field';

/**
 * Ajouter une réservation : coller l'e-mail, vérifier, enregistrer.
 *
 * Le premier geste est de coller l'e-mail de confirmation — c'est là que tout
 * est écrit, et c'est plus rapide que de recopier six champs. La fiche arrive
 * préremplie ; on la relit avant d'enregistrer, parce qu'une lecture de texte
 * peut se tromper et qu'une date fausse dans le programme du groupe coûte
 * cher. Rien n'est envoyé nulle part pendant la lecture : l'e-mail, qui porte
 * un nom et une adresse, reste sur l'appareil.
 */

const DEVISES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'THB', 'IDR', 'MAD', 'TRY', 'MXN'];

const LIBELLES_DES_CHAMPS: Partial<Record<keyof DonneesDeReservation, string>> = {
  titre: 'le nom',
  debutLe: 'la date',
  debutA: 'l’heure',
  finLe: 'la fin',
  adresse: 'l’adresse',
  reference: 'la référence',
  lien: 'le lien',
  prixCents: 'le prix',
};

interface Saisie {
  type: TypeDeReservation;
  fournisseur: string;
  titre: string;
  debutLe: string;
  debutA: string;
  finLe: string;
  finA: string;
  adresse: string;
  reference: string;
  lien: string;
  prix: string;
  devise: string;
  notes: string;
  lat: number | null;
  lng: number | null;
}

function saisieDepuis(donnees: Partial<DonneesDeReservation> | undefined, devise: string): Saisie {
  return {
    type: donnees?.type ?? 'hebergement',
    fournisseur: donnees?.fournisseur ?? 'autre',
    titre: donnees?.titre ?? '',
    debutLe: donnees?.debutLe ?? '',
    debutA: donnees?.debutA ?? '',
    finLe: donnees?.finLe ?? '',
    finA: donnees?.finA ?? '',
    adresse: donnees?.adresse ?? '',
    reference: donnees?.reference ?? '',
    lien: donnees?.lien ?? '',
    prix:
      donnees?.prixCents !== undefined && donnees.prixCents !== null
        ? (donnees.prixCents / 100).toFixed(2).replace('.', ',').replace(/,00$/u, '')
        : '',
    devise: donnees?.devise ?? devise,
    notes: donnees?.notes ?? '',
    lat: donnees?.lat ?? null,
    lng: donnees?.lng ?? null,
  };
}

/** Ce qui empêche d'enregistrer, en une phrase ; `null` quand tout va. */
function problemeDeLaSaisie(saisie: Saisie): string | null {
  if (saisie.titre.trim() === '') return 'Donnez un nom à cette réservation.';
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(saisie.debutLe)) return 'Indiquez la date.';
  if (saisie.finLe && saisie.finLe < saisie.debutLe) return 'La fin ne peut pas précéder le début.';
  if (saisie.lien.trim() && !/^https:\/\/\S+$/u.test(saisie.lien.trim())) {
    return 'Le lien doit commencer par https://';
  }
  if (saisie.prix.trim() && lireUnNombre(saisie.prix) === null) return 'Le prix n’est pas un nombre.';
  return null;
}

export function FicheDeReservation({
  initiale,
  deviseParDefaut = 'EUR',
  enregistrement,
  surEnregistrer,
  surAnnuler,
}: {
  /** Une réservation existante à corriger ; sinon, une nouvelle. */
  initiale?: DonneesDeReservation;
  deviseParDefaut?: string;
  enregistrement: boolean;
  surEnregistrer: (donnees: DonneesDeReservation) => void;
  surAnnuler: () => void;
}) {
  const [saisie, setSaisie] = useState<Saisie>(() => saisieDepuis(initiale, deviseParDefaut));
  const [email, setEmail] = useState('');
  const [lecture, setLecture] = useState<LectureDeConfirmation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const modifier = (champs: Partial<Saisie>) => setSaisie((avant) => ({ ...avant, ...champs }));
  const idEmail = useId();
  const idAide = useId();

  function lire(texte: string) {
    const resultat = lireUneConfirmation(texte);
    setLecture(resultat);
    if (resultat.trouves.length > 0) setSaisie(saisieDepuis(resultat.brouillon, deviseParDefaut));
  }

  async function importer(fichier: File | undefined) {
    if (!fichier) return;
    // Un e-mail de confirmation pèse quelques centaines de kilo-octets ; au-delà
    // de deux mégaoctets, c'est autre chose — une pièce jointe, une photo.
    if (fichier.size > 2_000_000) {
      setErreur('Ce fichier est trop lourd pour être un e-mail de confirmation.');
      return;
    }
    const texte = await fichier.text();
    setEmail('');
    lire(texte);
  }

  function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    const probleme = problemeDeLaSaisie(saisie);
    setErreur(probleme);
    if (probleme) return;
    const prix = saisie.prix.trim() ? lireUnNombre(saisie.prix) : null;
    surEnregistrer({
      type: saisie.type,
      fournisseur: saisie.fournisseur,
      titre: saisie.titre.trim(),
      debutLe: saisie.debutLe,
      debutA: saisie.debutA || null,
      finLe: saisie.finLe || null,
      finA: saisie.finLe && saisie.finA ? saisie.finA : null,
      adresse: saisie.adresse.trim() || null,
      lat: saisie.lat,
      lng: saisie.lng,
      reference: saisie.reference.trim() || null,
      lien: saisie.lien.trim() || null,
      prixCents: prix === null ? null : Math.round(prix * 100),
      devise: saisie.devise,
      notes: saisie.notes.trim() || null,
    });
  }

  const nouvelle = !initiale;
  const champsLus = (lecture?.trouves ?? [])
    .map((cle) => LIBELLES_DES_CHAMPS[cle])
    .filter((libelle): libelle is string => Boolean(libelle));

  return (
    <Card>
      <CardBody className="space-y-5">
        <h2 className="font-bold">{nouvelle ? 'Ajouter une réservation' : 'Modifier la réservation'}</h2>

        {nouvelle && (
          <div className="space-y-2.5">
            {/* Pas de <label> englobant ici : son nom accessible inclurait tout
                l'e-mail collé, et un lecteur d'écran le lirait en entier. */}
            <div className="space-y-1.5">
              <label htmlFor={idEmail} className="block text-sm font-semibold">
                Collez l’e-mail de confirmation
              </label>
              <textarea
                id={idEmail}
                aria-describedby={idAide}
                value={email}
                onChange={(evenement) => setEmail(evenement.target.value)}
                rows={4}
                placeholder="Ouvrez l’e-mail, sélectionnez tout, copiez, collez ici."
                className="surface-raised focus:border-brand-500 w-full rounded-2xl border border-[color:var(--border-subtle)] px-4 py-3 text-[16px] outline-none"
              />
              <p id={idAide} className="text-muted text-xs">
                Booking, Airbnb, Agoda, Expedia, GetYourGuide, Viator, Klook… L’e-mail est lu sur
                votre appareil et n’est envoyé nulle part.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Sparkles className="size-4" aria-hidden />}
                disabled={email.trim() === ''}
                onClick={() => lire(email)}
              >
                Remplir depuis l’e-mail
              </Button>
              <label className="text-brand-700 dark:text-brand-200 hover:bg-brand-500/10 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-semibold">
                <FileUp className="size-4" aria-hidden />
                Importer un fichier .eml ou .ics
                <input
                  type="file"
                  accept=".eml,.ics,.html,.htm,.txt,message/rfc822,text/calendar,text/html,text/plain"
                  className="sr-only"
                  onChange={(evenement) => void importer(evenement.target.files?.[0])}
                />
              </label>
            </div>
            {lecture && (
              <Banner tone={lecture.trouves.length > 0 ? 'info' : 'warning'}>
                {lecture.trouves.length > 0
                  ? `Rempli depuis ${
                      lecture.origine === 'donnees-structurees'
                        ? 'les données de réservation cachées dans l’e-mail'
                        : lecture.origine === 'calendrier'
                          ? 'le fichier de calendrier'
                          : 'le texte de l’e-mail'
                    } : ${champsLus.join(', ')}. Vérifiez avant d’enregistrer.`
                  : 'Rien de reconnaissable dans ce texte. Remplissez la fiche à la main.'}
              </Banner>
            )}
          </div>
        )}

        <form onSubmit={enregistrer} className="space-y-4" noValidate>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Type de réservation">
            {TYPES_DE_RESERVATION.map(({ id, libelle }) => (
              <Chip key={id} selected={saisie.type === id} onClick={() => modifier({ type: id })}>
                {libelle}
              </Chip>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom">
              <TextInput
                value={saisie.titre}
                onChange={(evenement) => modifier({ titre: evenement.target.value })}
                placeholder="Ubud Tropical Villas"
                maxLength={200}
              />
            </Field>
            <Field label="Réservé sur">
              <select
                value={saisie.fournisseur}
                onChange={(evenement) => modifier({ fournisseur: evenement.target.value })}
                className="surface-raised focus:border-brand-500 h-12 w-full rounded-2xl border border-[color:var(--border-subtle)] px-4 text-[16px] outline-none"
              >
                {FOURNISSEURS.map((fournisseur) => (
                  <option key={fournisseur.id} value={fournisseur.id}>
                    {fournisseur.nom}
                  </option>
                ))}
                <option value="autre">Autre</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={saisie.type === 'hebergement' ? 'Arrivée' : 'Date'}>
              <TextInput
                type="date"
                value={saisie.debutLe}
                onChange={(evenement) => modifier({ debutLe: evenement.target.value })}
              />
            </Field>
            <Field label="Heure">
              <TextInput
                type="time"
                value={saisie.debutA}
                onChange={(evenement) => modifier({ debutA: evenement.target.value })}
              />
            </Field>
            <Field label={saisie.type === 'hebergement' ? 'Départ' : 'Fin (facultatif)'}>
              <TextInput
                type="date"
                value={saisie.finLe}
                min={saisie.debutLe || undefined}
                onChange={(evenement) => modifier({ finLe: evenement.target.value })}
              />
            </Field>
            <Field label="Heure">
              <TextInput
                type="time"
                value={saisie.finA}
                disabled={!saisie.finLe}
                onChange={(evenement) => modifier({ finA: evenement.target.value })}
              />
            </Field>
          </div>

          <Field label="Adresse ou point de rendez-vous">
            <TextInput
              value={saisie.adresse}
              onChange={(evenement) => modifier({ adresse: evenement.target.value, lat: null, lng: null })}
              maxLength={300}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Numéro de confirmation">
              <TextInput
                value={saisie.reference}
                onChange={(evenement) => modifier({ reference: evenement.target.value })}
                maxLength={80}
                autoComplete="off"
              />
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Prix total">
                <TextInput
                  inputMode="decimal"
                  value={saisie.prix}
                  onChange={(evenement) => modifier({ prix: evenement.target.value })}
                  placeholder="0"
                />
              </Field>
              <Field label="Devise">
                <select
                  value={saisie.devise}
                  onChange={(evenement) => modifier({ devise: evenement.target.value })}
                  className="surface-raised focus:border-brand-500 h-12 rounded-2xl border border-[color:var(--border-subtle)] px-3 text-[16px] outline-none"
                >
                  {[...new Set([saisie.devise, ...DEVISES])].map((devise) => (
                    <option key={devise}>{devise}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <Field label="Lien pour gérer la réservation" hint="Celui de l’e-mail : « Gérer ma réservation », « Voir mon billet ».">
            <TextInput
              type="url"
              value={saisie.lien}
              onChange={(evenement) => modifier({ lien: evenement.target.value })}
              placeholder="https://"
            />
          </Field>

          <Field label="Notes">
            <TextInput
              value={saisie.notes}
              onChange={(evenement) => modifier({ notes: evenement.target.value })}
              placeholder="Code de la boîte à clés, prise en charge à l’hôtel…"
              maxLength={2000}
            />
          </Field>

          {erreur && <Banner tone="warning">{erreur}</Banner>}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={surAnnuler}>
              Annuler
            </Button>
            <Button type="submit" loading={enregistrement}>
              Enregistrer
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
