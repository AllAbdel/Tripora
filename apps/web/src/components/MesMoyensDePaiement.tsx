import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck } from 'lucide-react';
import {
  ibanLisible,
  normaliserPaypal,
  normaliserRevolut,
  normaliserWise,
  problemeDesMoyens,
  type MoyensDePaiement,
} from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Field';
import { CLE_MES_MOYENS, getPaiements } from '@/lib/paiements';
import { toFailure } from '@/lib/errors';
import { signaler } from '@/lib/feedback';

/**
 * Comment je veux être remboursé : PayPal.me, Revolut, Wise, IBAN.
 *
 * « Qui doit quoi » ouvre ensuite le paiement d'un geste chez ceux qui me
 * doivent quelque chose — sans qu'ils aient à me demander mon IBAN dans la
 * messagerie.
 */
export function MesMoyensDePaiement() {
  const queryClient = useQueryClient();
  const miens = useQuery({ queryKey: CLE_MES_MOYENS, queryFn: () => getPaiements().lesMiens() });

  // Le formulaire démarre sur ce qui est enregistré, et ne s'affiche qu'une
  // fois lu : un champ qui se remplit sous les doigts ferait perdre la saisie.
  if (miens.isPending) return null;
  return (
    <Formulaire
      initial={miens.data ?? {}}
      surEnregistre={() => queryClient.invalidateQueries({ queryKey: CLE_MES_MOYENS })}
    />
  );
}

function Formulaire({ initial, surEnregistre }: { initial: MoyensDePaiement; surEnregistre: () => Promise<unknown> }) {
  const [moyens, setMoyens] = useState<MoyensDePaiement>({
    ...initial,
    iban: initial.iban ? ibanLisible(initial.iban) : '',
  });
  const [tente, setTente] = useState(false);
  const cadre = useRef<HTMLDivElement | null>(null);

  // « Qui doit quoi » mène ici par `/profil#paiement` : le routeur ne
  // descend pas jusqu'à l'ancre de lui-même.
  useEffect(() => {
    if (window.location.hash === '#paiement') cadre.current?.scrollIntoView({ block: 'start' });
  }, []);

  const nettoyes: MoyensDePaiement = {
    paypal: moyens.paypal ? normaliserPaypal(moyens.paypal) : null,
    revolut: moyens.revolut ? normaliserRevolut(moyens.revolut) : null,
    wise: moyens.wise ? normaliserWise(moyens.wise) : null,
    iban: moyens.iban?.trim() || null,
    titulaire: moyens.titulaire?.trim() || null,
  };
  const probleme = problemeDesMoyens(nettoyes);

  const enregistrer = useMutation({
    mutationFn: () => getPaiements().enregistrer(nettoyes),
    onSuccess: async () => {
      signaler('reussite');
      await surEnregistre();
    },
  });

  const champ = (cle: keyof MoyensDePaiement, libelle: string, exemple: string, extra = {}) => (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{libelle}</span>
      <TextInput
        value={moyens[cle] ?? ''}
        placeholder={exemple}
        autoComplete="off"
        onChange={(event) => {
          setMoyens((actuels) => ({ ...actuels, [cle]: event.target.value }));
          enregistrer.reset();
        }}
        {...extra}
      />
    </label>
  );

  return (
    <Card>
      <CardBody className="space-y-3">
        <div id="paiement" ref={cadre} className="scroll-mt-4" />
        <p className="text-muted text-sm leading-relaxed">
          Remplissez ce que vous utilisez : dans « Qui doit quoi », ceux qui vous doivent quelque
          chose vous paient d’un geste, montant compris avec PayPal.
        </p>
        {champ('paypal', 'PayPal.me', 'paypal.me/votre-nom')}
        {champ('revolut', 'Revolut', '@votre-nom')}
        {champ('wise', 'Wise', 'wise.com/pay/me/votre-nom')}
        {champ('iban', 'IBAN', 'FR76 3000 6000 0112 3456 7890 189', { inputMode: 'text', autoCapitalize: 'characters' })}
        {moyens.iban?.trim() && champ('titulaire', 'Titulaire du compte', 'Prénom Nom')}

        <p className="text-muted flex items-start gap-2 text-xs leading-relaxed">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Visible seulement par les gens avec qui vous voyagez. Jamais par les inconnus d’un trip
          ouvert que vous n’avez pas rejoint.
        </p>

        {tente && probleme && (
          <p role="alert" className="text-sm text-red-600">
            {probleme}
          </p>
        )}
        {enregistrer.error && (
          <p role="alert" className="text-sm text-red-600">
            {toFailure(enregistrer.error).message}
          </p>
        )}

        <Button
          block
          variant="secondary"
          loading={enregistrer.isPending}
          icon={enregistrer.isSuccess ? <Check className="size-4" aria-hidden /> : undefined}
          onClick={() => {
            setTente(true);
            if (!probleme) enregistrer.mutate();
          }}
        >
          {enregistrer.isSuccess ? 'Enregistré' : 'Enregistrer'}
        </Button>
      </CardBody>
    </Card>
  );
}
