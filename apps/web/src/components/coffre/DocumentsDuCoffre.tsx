import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CircleCheck,
  Download,
  ExternalLink,
  FileText,
  Image as IconeImage,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  nomDuFichier,
  problemeDuFichier,
  tailleLisible,
  TAILLE_MAX_D_UN_DOCUMENT,
  typeDuFichier,
  TYPES_DE_DOCUMENTS,
  type DocumentDuVoyage,
} from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { cleDocuments, ErreurDeDocument, getDocuments, requeteDesDocuments } from '@/lib/documents';
import {
  copieDe,
  copiesDuVoyage,
  garderUneCopie,
  oublierLaCopie,
  oublierLesCopiesDisparues,
} from '@/lib/documentsHorsLigne';
import { estNatif, ouvrirDansLeNavigateur, ouvrirUnFichier } from '@/lib/natif';
import { supabase } from '@/lib/supabase';
import { toFailure } from '@/lib/errors';
import { signaler } from '@/lib/feedback';
import { Banner } from '@/components/ui/Banner';
import { VisionneuseDePhoto } from './VisionneuseDePhoto';

const ACCEPTES = Object.keys(TYPES_DE_DOCUMENTS).join(',');

function messageDe(erreur: unknown): string {
  return erreur instanceof ErreurDeDocument ? erreur.message : toFailure(erreur).message;
}

/** Une photo que le navigateur sait afficher (le HEIC, seul Safari le lit). */
function estAffichable(document: DocumentDuVoyage): boolean {
  const type = document.typeMime ?? '';
  return type.startsWith('image/') && !/heic|heif/u.test(type);
}

/** Le nom du fichier quand on le confie aux applications du téléphone. */
function nomDeFichier(document: DocumentDuVoyage): string {
  const extension = TYPES_DE_DOCUMENTS[document.typeMime ?? ''] ?? 'pdf';
  return `${document.nom.replace(/[^\p{L}\p{N} ._-]+/gu, '_').slice(0, 80)}.${extension}`;
}

/** Une adresse dans la fenêtre ouverte pendant le geste, ou dans celle-ci. */
function naviguer(fenetre: Window | null, adresse: string): void {
  if (fenetre) {
    fenetre.opener = null;
    fenetre.location.href = adresse;
  } else {
    window.location.assign(adresse);
  }
}

const CLE_DES_COPIES = (tripId: string) => ['documents-hors-ligne', tripId] as const;

/**
 * Les documents du coffre : les billets du vol, la confirmation de l'hôtel,
 * le bon de la visite — en PDF ou en photo, à portée de pouce au comptoir.
 * Un scan de passeport peut rester privé : seul celui qui l'a déposé le voit.
 */
export function DocumentsDuCoffre({
  tripId,
  moi,
  estOrganisateur,
}: {
  tripId: string;
  moi: string | null;
  estOrganisateur: boolean;
}) {
  const queryClient = useQueryClient();
  const selecteur = useRef<HTMLInputElement>(null);
  const [enAttente, setEnAttente] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [visionneuse, setVisionneuse] = useState<{ adresse: string; nom: string } | null>(null);

  const documents = useQuery(requeteDesDocuments(tripId));
  // Les copies gardées sur cet appareil. Sans serveur, tout est déjà ici.
  const copies = useQuery({
    queryKey: CLE_DES_COPIES(tripId),
    queryFn: () => copiesDuVoyage(tripId),
    enabled: Boolean(supabase),
  });
  const espace = useQuery({
    queryKey: ['espace-documents'],
    queryFn: () => getDocuments().espace(),
    enabled: Boolean(supabase),
  });

  useEffect(
    () =>
      getDocuments().ecouter(tripId, () => {
        void queryClient.invalidateQueries({ queryKey: cleDocuments(tripId) });
      }),
    [tripId, queryClient],
  );

  // Un document retiré du coffre (par soi ou par un autre) emporte sa copie.
  // Seulement d'après une liste fraîche : celle du cache, hors ligne, peut
  // ignorer un document ajouté depuis — et gardé.
  const listeFraiche = documents.isFetchedAfterMount && documents.isSuccess && !documents.isFetching;
  useEffect(() => {
    if (!supabase || !listeFraiche || !documents.data) return;
    void oublierLesCopiesDisparues(tripId, new Set(documents.data.map((document) => document.chemin))).then(() =>
      queryClient.invalidateQueries({ queryKey: CLE_DES_COPIES(tripId) }),
    );
  }, [listeFraiche, documents.data, tripId, queryClient]);

  const rafraichir = async () => {
    await queryClient.invalidateQueries({ queryKey: cleDocuments(tripId) });
    await queryClient.invalidateQueries({ queryKey: ['espace-documents'] });
  };

  const deposer = useMutation({
    mutationFn: ({ fichier, nom, prive }: { fichier: File; nom: string; prive: boolean }) =>
      getDocuments().deposer(tripId, { fichier, nom, prive }),
    onSuccess: async () => {
      signaler('reussite');
      setEnAttente(null);
      await rafraichir();
    },
    onError: (raison) => setErreur(messageDe(raison)),
  });

  const modifier = useMutation({
    mutationFn: ({ id, nom, prive }: { id: string; nom?: string; prive?: boolean }) =>
      getDocuments().modifier(id, { ...(nom !== undefined ? { nom } : {}), ...(prive !== undefined ? { prive } : {}) }),
    onSuccess: rafraichir,
    onError: (raison) => setErreur(messageDe(raison)),
  });

  const supprimer = useMutation({
    mutationFn: async (document: DocumentDuVoyage) => {
      await getDocuments().supprimer(document);
      await oublierLaCopie(document.chemin);
    },
    onSuccess: async () => {
      await rafraichir();
      await queryClient.invalidateQueries({ queryKey: CLE_DES_COPIES(tripId) });
    },
    onError: (raison) => setErreur(messageDe(raison)),
  });

  const garder = useMutation({
    mutationFn: async (document: DocumentDuVoyage) => {
      if (copies.data?.[document.chemin] !== undefined) {
        await oublierLaCopie(document.chemin);
        return;
      }
      await garderUneCopie(document, await getDocuments().telecharger(document));
    },
    onSuccess: async () => {
      signaler('tape');
      await queryClient.invalidateQueries({ queryKey: CLE_DES_COPIES(tripId) });
    },
    onError: (raison) => setErreur(messageDe(raison)),
  });

  function choisir(event: ChangeEvent<HTMLInputElement>) {
    const choisi = event.target.files?.[0];
    event.target.value = '';
    if (!choisi) return;
    // Certains navigateurs ne donnent pas de type aux photos HEIC : on le
    // déduit de l'extension.
    const type = typeDuFichier(choisi.name, choisi.type);
    const fichier = type === choisi.type ? choisi : new File([choisi], choisi.name, { type });
    // Une photo trop lourde sera allégée à l'envoi : on ne juge que son type.
    // Un PDF, lui, ne s'allège pas : sa taille compte tout de suite.
    const allegeable = ['image/jpeg', 'image/png', 'image/webp'].includes(type);
    const probleme = problemeDuFichier(
      allegeable ? { type, size: Math.min(fichier.size, TAILLE_MAX_D_UN_DOCUMENT) } : fichier,
    );
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setErreur(null);
    setEnAttente(fichier);
  }

  async function ouvrir(document: DocumentDuVoyage) {
    setErreur(null);
    const photo = estAffichable(document);
    // Une page ouverte tout de suite, pendant le geste : ouverte après une
    // attente, elle serait prise pour une publicité et bloquée. Une photo,
    // elle, s'affiche dans l'application.
    const fenetre = estNatif || photo ? null : window.open('', '_blank');
    try {
      // Gardé sur cet appareil : on l'ouvre d'ici, réseau ou pas.
      const copie = supabase ? await copieDe(document.chemin) : undefined;
      if (photo) {
        const fichier = copie ?? (await getDocuments().telecharger(document));
        setVisionneuse({ adresse: URL.createObjectURL(fichier), nom: document.nom });
        return;
      }
      if (copie && estNatif) {
        await ouvrirUnFichier({ nom: nomDeFichier(document), fichier: copie, titre: document.nom });
        return;
      }
      const adresse = copie ? URL.createObjectURL(copie) : await getDocuments().adresse(document);
      if (estNatif) await ouvrirDansLeNavigateur(adresse);
      else naviguer(fenetre, adresse);
      if (adresse.startsWith('blob:')) window.setTimeout(() => URL.revokeObjectURL(adresse), 60_000);
    } catch (raison) {
      fenetre?.close();
      setErreur(messageDe(raison));
    }
  }

  function fermerLaVisionneuse() {
    if (visionneuse) URL.revokeObjectURL(visionneuse.adresse);
    setVisionneuse(null);
  }

  const liste = documents.data ?? [];
  const gardes = copies.data ?? {};
  const cheminsGardes = liste.filter((document) => gardes[document.chemin] !== undefined);
  const placeGardee = cheminsGardes.reduce((total, document) => total + (gardes[document.chemin] ?? 0), 0);

  return (
    <section className="space-y-3" aria-labelledby="titre-documents">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="titre-documents" className="text-lg font-bold">
            Documents
          </h2>
          <p className="text-muted text-sm">Billets, confirmations, scans : PDF ou photos.</p>
        </div>
        {espace.data && (
          <p className="text-muted shrink-0 text-xs tabular-nums">
            {tailleLisible(espace.data.utilise)} sur {tailleLisible(espace.data.limite)}
          </p>
        )}
      </div>

      {erreur && <Banner tone="warning">{erreur}</Banner>}

      {cheminsGardes.length > 0 && (
        <p className="text-muted text-xs">
          {cheminsGardes.length === 1
            ? `1 document gardé sur cet appareil (${tailleLisible(placeGardee)}) : il s’ouvre sans réseau.`
            : `${cheminsGardes.length} documents gardés sur cet appareil (${tailleLisible(placeGardee)}) : ils s’ouvrent sans réseau.`}
        </p>
      )}

      {liste.length > 0 && (
        <ul className="space-y-2">
          {liste.map((document) => (
            <li key={document.id}>
              <LigneDeDocument
                document={document}
                aMoi={!supabase || document.ajoutePar === moi}
                retirable={!supabase || estOrganisateur || document.ajoutePar === moi}
                surOuvrir={() => void ouvrir(document)}
                surRenommer={(nom) => modifier.mutate({ id: document.id, nom })}
                surBasculer={() => modifier.mutate({ id: document.id, prive: !document.prive })}
                surRetirer={() => supprimer.mutate(document)}
                {...(supabase
                  ? { garde: gardes[document.chemin] !== undefined, surGarder: () => garder.mutate(document) }
                  : {})}
              />
            </li>
          ))}
        </ul>
      )}

      {enAttente ? (
        <FormulaireDeDocument
          fichier={enAttente}
          enCours={deposer.isPending}
          surDeposer={(nom, prive) => deposer.mutate({ fichier: enAttente, nom, prive })}
          surAnnuler={() => setEnAttente(null)}
        />
      ) : (
        <>
          <input
            ref={selecteur}
            type="file"
            accept={ACCEPTES}
            className="sr-only"
            tabIndex={-1}
            aria-label="Choisir un document"
            onChange={choisir}
          />
          <Button
            variant="secondary"
            block
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => selecteur.current?.click()}
          >
            Ajouter un document
          </Button>
        </>
      )}

      {visionneuse && (
        <VisionneuseDePhoto adresse={visionneuse.adresse} nom={visionneuse.nom} surFermer={fermerLaVisionneuse} />
      )}
    </section>
  );
}

function FormulaireDeDocument({
  fichier,
  enCours,
  surDeposer,
  surAnnuler,
}: {
  fichier: File;
  enCours: boolean;
  surDeposer: (nom: string, prive: boolean) => void;
  surAnnuler: () => void;
}) {
  const [nom, setNom] = useState(() => nomDuFichier(fichier.name));
  const [prive, setPrive] = useState(false);

  function envoyer(event: FormEvent) {
    event.preventDefault();
    if (!nom.trim()) return;
    surDeposer(nom, prive);
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-3" onSubmit={envoyer} aria-label="Nouveau document">
          <p className="text-muted text-sm">
            {fichier.name} · {tailleLisible(fichier.size)}
          </p>
          <Field label="Nom du document">
            <TextInput value={nom} maxLength={120} onChange={(event) => setNom(event.target.value)} />
          </Field>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={prive}
              onChange={(event) => setPrive(event.target.checked)}
              className="accent-brand-500 size-5"
            />
            <span>
              Visible par moi seulement
              <span className="text-muted block text-xs">Pour un passeport, une carte d’identité.</span>
            </span>
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={surAnnuler}>
              Annuler
            </Button>
            <Button type="submit" block loading={enCours} disabled={!nom.trim()} icon={<Check className="size-4" aria-hidden />}>
              Ranger le document
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function LigneDeDocument({
  document,
  aMoi,
  retirable,
  surOuvrir,
  surRenommer,
  surBasculer,
  surRetirer,
  garde,
  surGarder,
}: {
  document: DocumentDuVoyage;
  aMoi: boolean;
  retirable: boolean;
  surOuvrir: () => void;
  surRenommer: (nom: string) => void;
  surBasculer: () => void;
  surRetirer: () => void;
  /** Gardé sur cet appareil ? Absent sans serveur : tout y est déjà. */
  garde?: boolean;
  surGarder?: () => void;
}) {
  const [renommage, setRenommage] = useState<string | null>(null);
  const estUneImage = document.typeMime?.startsWith('image/') ?? false;
  const Icone = estUneImage ? IconeImage : FileText;
  const details = [
    estUneImage ? 'Photo' : 'PDF',
    document.taille ? tailleLisible(document.taille) : null,
    document.prive ? 'visible par vous seulement' : null,
    garde ? 'sur cet appareil' : null,
  ].filter(Boolean);

  if (renommage !== null) {
    return (
      <form
        className="surface-raised flex items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] p-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!renommage.trim()) return;
          surRenommer(renommage);
          setRenommage(null);
        }}
      >
        <TextInput
          aria-label="Nouveau nom"
          value={renommage}
          maxLength={120}
          onChange={(event) => setRenommage(event.target.value)}
          className="h-11"
        />
        <button type="submit" aria-label="Enregistrer le nom" className="text-brand-600 grid size-11 shrink-0 place-items-center">
          <Check className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Annuler"
          onClick={() => setRenommage(null)}
          className="text-muted grid size-11 shrink-0 place-items-center"
        >
          <X className="size-5" aria-hidden />
        </button>
      </form>
    );
  }

  return (
    <div className="surface-raised flex items-center gap-1 rounded-xl border border-[color:var(--border-subtle)] py-1 pr-1 pl-1">
      <button
        type="button"
        onClick={surOuvrir}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left"
        aria-label={`Ouvrir « ${document.nom} »`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#9a6a3a]/12 text-[#8a5a2b] dark:text-[#e0b98c]">
          <Icone className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{document.nom}</span>
          <span className="text-muted block truncate text-xs">{details.join(' · ')}</span>
        </span>
        <ExternalLink className="text-muted size-4 shrink-0" aria-hidden />
      </button>
      {surGarder && (
        <button
          type="button"
          aria-label={garde ? `Retirer « ${document.nom} » de cet appareil` : `Garder « ${document.nom} » sur cet appareil`}
          aria-pressed={garde}
          onClick={surGarder}
          className="text-muted hover:text-brand-600 grid size-11 shrink-0 place-items-center"
        >
          {garde ? (
            <CircleCheck className="text-brand-500 size-4" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
        </button>
      )}
      {aMoi && (
        <>
          <button
            type="button"
            aria-label={`Renommer « ${document.nom} »`}
            onClick={() => setRenommage(document.nom)}
            className="text-muted hover:text-brand-600 grid size-11 shrink-0 place-items-center"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={document.prive ? `Partager « ${document.nom} » avec le groupe` : `Garder « ${document.nom} » pour moi`}
            onClick={surBasculer}
            className="text-muted hover:text-brand-600 grid size-11 shrink-0 place-items-center"
          >
            {document.prive ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}
          </button>
        </>
      )}
      {retirable && (
        <button
          type="button"
          aria-label={`Retirer « ${document.nom} »`}
          onClick={surRetirer}
          className="text-muted grid size-11 shrink-0 place-items-center hover:text-red-600"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
