import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Link2, Loader2, QrCode as QrIcon, Share2, UserPlus } from 'lucide-react';
import { AXIS_LABELS_FR, formatCents } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';

// Chargé seulement quand quelqu'un demande le QR code.
const QrCode = lazy(() => import('@/components/QrCode'));
import { getCollaboration, type TripMember } from '@/lib/collaboration';
import { useAuth } from '@/lib/auth-context';
import { toFailure } from '@/lib/errors';

export default function TripMembers() {
  const { id } = useParams<{ id: string }>();
  const collaboration = getCollaboration();
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const membres = useQuery({
    queryKey: ['membres', id],
    queryFn: () => collaboration!.listMembers(id!),
    enabled: Boolean(id && collaboration),
  });

  const invitation = useQuery({
    queryKey: ['invitation', id],
    queryFn: () => collaboration!.currentInvite(id!),
    enabled: Boolean(id && collaboration),
  });

  const creerInvitation = useMutation({
    mutationFn: () => collaboration!.createInvite(id!),
    onSuccess: (invite) => queryClient.setQueryData(['invitation', id], invite),
  });

  if (!collaboration) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <RetourVoyage id={id} />
        <Banner tone="warning" title="Pas de partage en mode local">
          Inviter quelqu’un demande un serveur : sans lui, il n’y aurait nulle part où
          l’autre personne irait chercher le voyage. Reliez un projet Supabase pour
          activer le partage.
        </Banner>
      </div>
    );
  }

  const invite = invitation.data;

  async function partager() {
    if (!invite) return;
    const texte = `Rejoins notre voyage sur Tripora : ${invite.url}`;
    // Feuille de partage native quand le navigateur la propose (mobile),
    // presse-papiers sinon. Les deux échouent silencieusement si l'utilisateur
    // annule, ce qui n'est pas une erreur.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tripora', text: texte, url: invite.url });
        return;
      } catch {
        /* partage annulé */
      }
    }
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* presse-papiers refusé : le lien reste affiché et sélectionnable */
    }
  }

  const enAttente = (membres.data ?? []).filter((membre) => !membre.hasPreferences).length;

  return (
    <div className="space-y-4 px-5 pt-6">
      <RetourVoyage id={id} />
      <h1 className="text-2xl font-bold tracking-tight">Participants</h1>

      {membres.error && <Banner tone="warning">{toFailure(membres.error).message}</Banner>}

      {membres.isLoading && (
        <div className="grid place-items-center py-10">
          <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
        </div>
      )}

      {membres.data && (
        <>
          {enAttente > 0 && (
            <Banner tone="info" title={enAttente === 1 ? '1 personne n’a pas répondu' : `${enAttente} personnes n’ont pas répondu`}>
              Les propositions ne tiennent compte que des envies déjà exprimées. Elles se
              recalculeront toutes seules dès que les autres auront répondu.
            </Banner>
          )}

          <ul className="space-y-2">
            {membres.data.map((membre) => (
              <li key={membre.userId}>
                <CarteMembre membre={membre} cestMoi={membre.userId === identity?.id} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Card>
        <CardBody className="space-y-3">
          <p className="flex items-center gap-2 font-semibold">
            <UserPlus className="size-4" aria-hidden />
            Inviter quelqu’un
          </p>

          {creerInvitation.error && (
            <Banner tone="warning">{toFailure(creerInvitation.error).message}</Banner>
          )}

          {!invite && (
            <>
              <p className="text-muted text-sm leading-relaxed">
                Un lien à envoyer, ou un code à dicter. La personne rejoint sans créer de
                compte, et pourra rattacher un compte Google plus tard sans rien perdre.
              </p>
              <Button
                block
                loading={creerInvitation.isPending || invitation.isLoading}
                icon={<Link2 className="size-4" aria-hidden />}
                onClick={() => creerInvitation.mutate()}
              >
                Créer un lien d’invitation
              </Button>
            </>
          )}

          {invite && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4 text-center">
                <p className="text-muted text-xs font-medium">Code du voyage</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em]">
                  {invite.code}
                </p>
              </div>

              <p className="text-muted text-center text-xs break-all">{invite.url}</p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  icon={copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                  onClick={() => void partager()}
                >
                  {copied ? 'Lien copié' : 'Partager'}
                </Button>
                <Button
                  variant="secondary"
                  icon={<QrIcon className="size-4" aria-hidden />}
                  onClick={() => setShowQr((value) => !value)}
                  aria-expanded={showQr}
                >
                  {showQr ? 'Masquer' : 'QR code'}
                </Button>
              </div>

              {showQr && (
                <div className="animate-rise flex flex-col items-center gap-2 pt-1">
                  <Suspense
                    fallback={
                      <div
                        className="size-[200px] animate-pulse rounded-2xl bg-[color:var(--border-subtle)]"
                        aria-hidden
                      />
                    }
                  >
                    <QrCode value={invite.url} />
                  </Suspense>
                  <p className="text-muted text-xs">À scanner avec l’appareil photo.</p>
                </div>
              )}

              <p className="text-muted text-xs">
                Valable jusqu’au {new Date(invite.expiresAt).toLocaleDateString('fr-FR')} ·{' '}
                {invite.remainingUses} utilisation{invite.remainingUses > 1 ? 's' : ''} restante
                {invite.remainingUses > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function CarteMembre({ membre, cestMoi }: { membre: TripMember; cestMoi: boolean }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 p-4">
        <span
          aria-hidden
          className="bg-brand-500 grid size-11 shrink-0 place-items-center rounded-full text-base font-bold text-[color:var(--accent-contrast)]"
        >
          {membre.displayName.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {membre.displayName}
            {cestMoi && <span className="text-muted ml-1.5 text-sm font-normal">(vous)</span>}
            {membre.role === 'owner' && (
              <span className="text-brand-700 dark:text-brand-200 bg-brand-50 dark:bg-brand-900/50 ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-medium">
                organisateur
              </span>
            )}
          </p>

          {membre.hasPreferences ? (
            <p className="text-muted truncate text-sm">
              {membre.topAxes.length > 0
                ? membre.topAxes.map((axis) => AXIS_LABELS_FR[axis].toLowerCase()).join(', ')
                : 'aucune envie marquée'}
              {membre.budgetMaxCents !== null &&
                ` · ${formatCents(membre.budgetMaxCents, 'EUR', { hideCentimes: true })} max`}
            </p>
          ) : (
            <p className="text-gold-700 dark:text-gold-300 text-sm">En attente de ses envies</p>
          )}
        </div>

        {cestMoi && (
          <Link
            to="mes-envies"
            className="text-brand-600 dark:text-brand-300 shrink-0 text-sm font-semibold"
          >
            {membre.hasPreferences ? 'Modifier' : 'Répondre'}
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

function RetourVoyage({ id }: { id: string | undefined }) {
  return (
    <Link
      to={`/voyages/${id ?? ''}`}
      className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
    >
      ← Retour au voyage
    </Link>
  );
}
