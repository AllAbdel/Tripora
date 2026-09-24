import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  MapPin,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  QrCode as IconeQr,
  Trash2,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import {
  GENRES_D_INFO,
  ORDRE_DES_GENRES,
  lienDAppel,
  lienDeLAdresse,
  lienWhatsApp,
  problemeDeLInfo,
  qrDuWifi,
  trierLesInfos,
  type BrouillonDInfo,
  type GenreDInfo,
  type InfoDuVoyage,
} from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Field, TextInput } from '@/components/ui/Field';
import { ListeFantome } from '@/components/ui/Squelette';
import { TitreDePage } from '@/components/TitreDePage';
import { DocumentsDuCoffre } from '@/components/coffre/DocumentsDuCoffre';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { cleCoffre, getCoffre, requeteDuCoffre } from '@/lib/coffre';
import { toFailure } from '@/lib/errors';
import { signaler } from '@/lib/feedback';
import { cn } from '@/lib/cn';

const QrCode = lazy(() => import('@/components/QrCode'));

const ICONES: Record<GenreDInfo, LucideIcon> = {
  adresse: MapPin,
  code: KeyRound,
  wifi: Wifi,
  contact: Phone,
  note: NotebookPen,
};

const PETIT_BOUTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[color:var(--border-subtle)] px-3 text-xs font-semibold hover:border-brand-500';

/**
 * Le coffre du voyage : codes, wifi, adresses, contacts.
 *
 * Ce qu'on se transmet d'habitude en capture d'écran dans la discussion, et
 * qu'on y cherche à 23 h devant une porte fermée. Une ligne par info, rangée
 * par genre ; chaque ligne sait quoi faire de ce qu'elle contient : copier un
 * code, appeler l'hôte, ouvrir l'adresse, rejoindre le wifi par QR code.
 */
export default function TripCoffre() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  // Sans serveur, « moi » est le seul membre local.
  const moi = supabase ? (identity?.id ?? null) : 'moi';

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });
  const infos = useQuery(requeteDuCoffre(id));

  useEffect(() => {
    if (!id) return;
    return getCoffre().ecouter(id, () => {
      void queryClient.invalidateQueries({ queryKey: cleCoffre(id) });
    });
  }, [id, queryClient]);

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: cleCoffre(id) });

  const ajouter = useMutation({
    mutationFn: (info: BrouillonDInfo) => getCoffre().ajouter(id!, info),
    onSuccess: async () => {
      signaler('reussite');
      setFormulaireOuvert(false);
      await rafraichir();
    },
  });

  const modifier = useMutation({
    mutationFn: ({ infoId, info }: { infoId: string; info: BrouillonDInfo }) => getCoffre().modifier(infoId, info),
    onSuccess: async () => {
      setEnEdition(null);
      await rafraichir();
    },
  });

  const supprimer = useMutation({
    mutationFn: (infoId: string) => getCoffre().supprimer(infoId),
    onSuccess: rafraichir,
  });

  const liste = trierLesInfos(infos.data ?? []);
  const estOrganisateur = Boolean(voyage.data?.isOwner);
  const erreur = ajouter.error ?? modifier.error ?? supprimer.error ?? infos.error;
  const vide = !infos.isPending && liste.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-5 pt-6 pb-28">
      <Link
        to={`/voyages/${id ?? ''}`}
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour au voyage
      </Link>

      <TitreDePage pastille="coffre">Coffre</TitreDePage>
      <p className="text-muted -mt-2 text-sm">
        Codes, wifi, adresses, billets : ce qu’on s’envoie d’habitude en capture d’écran. Seuls les membres du voyage
        le voient, et les infos restent lisibles sans réseau une fois ouvertes.
      </p>

      {erreur && <Banner tone="warning">{toFailure(erreur).message}</Banner>}

      {infos.isPending && <ListeFantome combien={3} lignes={2} />}

      {vide && !formulaireOuvert && (
        <Card>
          <CardBody className="space-y-3 text-center">
            <p className="text-sm">
              Le code de la boîte à clés, le wifi de l’appartement, le numéro de l’hôte : rangez-les ici avant de
              partir, pour ne pas fouiller la discussion devant la porte.
            </p>
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setFormulaireOuvert(true)}>
              Ajouter une info
            </Button>
          </CardBody>
        </Card>
      )}

      {liste.length > 0 && (
        <ul className="space-y-2.5">
          {liste.map((info) => (
            <li key={info.id}>
              {enEdition === info.id ? (
                <FormulaireDInfo
                  initiale={info}
                  enCours={modifier.isPending}
                  surEnregistrer={(brouillon) => modifier.mutate({ infoId: info.id, info: brouillon })}
                  surAnnuler={() => setEnEdition(null)}
                />
              ) : (
                <LigneDInfo
                  info={info}
                  retirable={!supabase || estOrganisateur || info.creePar === moi}
                  surModifier={() => setEnEdition(info.id)}
                  surRetirer={() => supprimer.mutate(info.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {formulaireOuvert ? (
        <FormulaireDInfo
          enCours={ajouter.isPending}
          surEnregistrer={(brouillon) => ajouter.mutate(brouillon)}
          surAnnuler={() => setFormulaireOuvert(false)}
        />
      ) : (
        liste.length > 0 && (
          <Button
            variant="secondary"
            block
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setFormulaireOuvert(true)}
          >
            Ajouter une info
          </Button>
        )
      )}

      {id && (
        <div className="border-t border-[color:var(--border-subtle)] pt-5">
          <DocumentsDuCoffre tripId={id} moi={moi} estOrganisateur={estOrganisateur} />
        </div>
      )}
    </div>
  );
}

function FormulaireDInfo({
  initiale,
  enCours,
  surEnregistrer,
  surAnnuler,
}: {
  initiale?: InfoDuVoyage;
  enCours: boolean;
  surEnregistrer: (info: BrouillonDInfo) => void;
  surAnnuler: () => void;
}) {
  const [genre, setGenre] = useState<GenreDInfo>(initiale?.genre ?? 'code');
  const [titre, setTitre] = useState(initiale?.titre ?? '');
  const [valeur, setValeur] = useState(initiale?.valeur ?? '');
  const [complement, setComplement] = useState(initiale?.complement ?? '');
  const [tente, setTente] = useState(false);

  const description = GENRES_D_INFO[genre];
  const brouillon: BrouillonDInfo = { genre, titre, valeur, complement };
  const probleme = problemeDeLInfo(brouillon);

  function envoyer(event: FormEvent) {
    event.preventDefault();
    setTente(true);
    if (probleme) return;
    surEnregistrer(brouillon);
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-3" onSubmit={envoyer} aria-label={initiale ? 'Modifier l’info' : 'Nouvelle info'}>
          {!initiale && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Genre d’info">
              {ORDRE_DES_GENRES.map((candidat) => (
                <Chip key={candidat} selected={genre === candidat} onClick={() => setGenre(candidat)}>
                  {GENRES_D_INFO[candidat].libelle}
                </Chip>
              ))}
            </div>
          )}
          <Field label={description.titre}>
            <TextInput
              value={titre}
              maxLength={80}
              placeholder={description.exempleDeTitre}
              onChange={(event) => setTitre(event.target.value)}
            />
          </Field>
          <Field label={genre === 'wifi' ? `${description.valeur} (vide si le réseau est ouvert)` : description.valeur}>
            {genre === 'note' ? (
              <textarea
                value={valeur}
                maxLength={500}
                rows={3}
                placeholder={description.exempleDeValeur}
                onChange={(event) => setValeur(event.target.value)}
                className="surface-raised focus:border-brand-500 w-full rounded-2xl border border-[color:var(--border-subtle)] px-4 py-3 text-[16px] outline-none"
              />
            ) : (
              <TextInput
                value={valeur}
                maxLength={500}
                placeholder={description.exempleDeValeur}
                inputMode={genre === 'contact' ? 'tel' : undefined}
                autoCapitalize={genre === 'wifi' || genre === 'code' ? 'off' : undefined}
                autoCorrect={genre === 'wifi' || genre === 'code' ? 'off' : undefined}
                spellCheck={genre === 'wifi' || genre === 'code' ? false : undefined}
                onChange={(event) => setValeur(event.target.value)}
              />
            )}
          </Field>
          {genre !== 'note' && (
            <Field label="Précision (facultatif)">
              <TextInput
                value={complement}
                maxLength={300}
                placeholder={genre === 'contact' ? 'Parle anglais, répond sur WhatsApp' : '3ᵉ étage, porte de gauche'}
                onChange={(event) => setComplement(event.target.value)}
              />
            </Field>
          )}
          {tente && probleme && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {probleme}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={surAnnuler}>
              Annuler
            </Button>
            <Button type="submit" block loading={enCours} icon={<Check className="size-4" aria-hidden />}>
              {initiale ? 'Enregistrer' : 'Ranger dans le coffre'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function LigneDInfo({
  info,
  retirable,
  surModifier,
  surRetirer,
}: {
  info: InfoDuVoyage;
  retirable: boolean;
  surModifier: () => void;
  surRetirer: () => void;
}) {
  const [copie, setCopie] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const Icone = ICONES[info.genre];
  const appel = info.genre === 'contact' ? lienDAppel(info.valeur) : null;
  const whatsapp = info.genre === 'contact' ? lienWhatsApp(info.valeur) : null;

  async function copier() {
    try {
      await navigator.clipboard.writeText(info.valeur);
      signaler('tape');
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refusé : la valeur reste affichée, et sélectionnable.
    }
  }

  const libelleDeCopie =
    info.genre === 'wifi' ? 'Copier le mot de passe'
    : info.genre === 'code' ? 'Copier le code'
    : info.genre === 'adresse' ? 'Copier l’adresse'
    : info.genre === 'contact' ? 'Copier le numéro'
    : 'Copier';

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#9a6a3a]/12 text-[#8a5a2b] dark:text-[#e0b98c]">
            <Icone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-muted text-xs font-semibold tracking-wide uppercase">{GENRES_D_INFO[info.genre].libelle}</p>
            <h3 className="font-semibold leading-snug break-words">{info.titre}</h3>
          </div>
          <div className="-mt-1 -mr-2 flex shrink-0">
            <button
              type="button"
              aria-label={`Modifier « ${info.titre} »`}
              onClick={surModifier}
              className="text-muted hover:text-brand-600 grid size-10 place-items-center"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            {retirable && (
              <button
                type="button"
                aria-label={`Retirer « ${info.titre} »`}
                onClick={surRetirer}
                className="text-muted grid size-10 place-items-center hover:text-red-600"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {info.valeur && (
          <p
            className={cn(
              'break-words select-all',
              info.genre === 'code' || info.genre === 'wifi'
                ? 'font-mono text-xl font-semibold tracking-wider'
                : info.genre === 'note'
                  ? 'text-sm leading-relaxed whitespace-pre-line select-text'
                  : 'text-[0.95rem]',
            )}
          >
            {info.valeur}
          </p>
        )}
        {info.genre === 'wifi' && !info.valeur && <p className="text-muted text-sm">Réseau ouvert, sans mot de passe.</p>}
        {info.complement && <p className="text-muted text-sm">{info.complement}</p>}

        <div className="flex flex-wrap gap-1.5">
          {info.genre === 'adresse' && (
            <a href={lienDeLAdresse(info.valeur)} target="_blank" rel="noopener noreferrer" className={PETIT_BOUTON}>
              <MapPin className="size-3.5" aria-hidden />
              Ouvrir dans les cartes
            </a>
          )}
          {appel && (
            <a href={appel} className={PETIT_BOUTON}>
              <Phone className="size-3.5" aria-hidden />
              Appeler
            </a>
          )}
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={PETIT_BOUTON}>
              <MessageCircle className="size-3.5" aria-hidden />
              WhatsApp
            </a>
          )}
          {info.genre === 'wifi' && (
            <button
              type="button"
              className={PETIT_BOUTON}
              aria-expanded={qrVisible}
              onClick={() => setQrVisible((visible) => !visible)}
            >
              <IconeQr className="size-3.5" aria-hidden />
              {qrVisible ? 'Masquer le QR code' : 'QR code'}
            </button>
          )}
          {info.valeur && (
            <button type="button" className={PETIT_BOUTON} onClick={() => void copier()}>
              {copie ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copie ? 'Copié' : libelleDeCopie}
            </button>
          )}
        </div>

        {info.genre === 'wifi' && qrVisible && (
          <div className="animate-rise flex flex-col items-center gap-2 pt-1">
            <Suspense
              fallback={
                <div className="size-[200px] animate-pulse rounded-2xl bg-[color:var(--border-subtle)]" aria-hidden />
              }
            >
              <QrCode value={qrDuWifi(info.titre, info.valeur)} label={`QR code du wifi ${info.titre}`} />
            </Suspense>
            <p className="text-muted text-center text-xs">
              Les autres le scannent avec l’appareil photo et rejoignent le réseau, sans rien taper.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
