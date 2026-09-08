import { Link } from 'react-router';
import { ArrowLeft, ExternalLink, HandCoins, Scale, ShieldCheck } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/**
 * Comment Tripora est financé, dit en entier.
 *
 * Une page comme celle-ci n'existe presque jamais dans une application
 * gratuite, et c'est précisément pour ça qu'elle vaut la peine : le modèle
 * économique se découvre d'habitude par accident, quand on comprend d'où
 * venait le lien sur lequel on vient de cliquer.
 *
 * Le pari est qu'écrire les choses ne coûte rien et rapporte de la confiance.
 * Quelqu'un qui sait qu'un lien rapporte quelques euros et que le classement
 * n'en dépend pas cliquera plus volontiers que quelqu'un qui le découvre.
 */
export default function Soutenir() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <Link
          to="/profil"
          aria-label="Retour au profil"
          className="hover:bg-brand-50 dark:hover:bg-ink-700/40 -ml-2 grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-semibold">Soutenir Tripora</h1>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm leading-relaxed">
            Tripora est gratuit, sans compte payant, sans publicité et sans revente de données.
            Il le restera : tout ce qu’il utilise — cartes, météo, climat, lieux, photos — est
            gratuit et le coût de fonctionnement est nul.
          </p>
          <p className="text-muted text-sm leading-relaxed">
            Il reste un nom de domaine à payer, et l’envie de continuer. C’est là qu’un coup de
            main sert, et il n’y en a qu’une forme : quelques liens de parrainage sur des
            services que Tripora recommanderait de toute façon.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="text-brand-500 size-4 shrink-0" aria-hidden />
            Ce qu’un parrainage ne change pas
          </h2>
          <ul className="text-muted space-y-2 text-sm leading-relaxed">
            <li>
              <strong className="text-[color:var(--text-strong)]">Le classement.</strong> L’ordre
              des applications se calcule sur leur portée et leur utilité, jamais sur ce qu’elles
              rapportent. C’est écrit dans le code, et un test le vérifie à chaque modification —
              sans quoi la promesse ne tiendrait pas six mois.
            </li>
            <li>
              <strong className="text-[color:var(--text-strong)]">Le choix.</strong> Le lien
              direct est toujours affiché, au-dessus. Ouvrir l’application sans passer par nous
              demande un geste de moins, pas un de plus.
            </li>
            <li>
              <strong className="text-[color:var(--text-strong)]">Ce qui est écrit.</strong> Les
              réserves restent : BoursoBank est réservée aux résidents français et demande un
              versement à l’ouverture, et c’est dit sur sa fiche.
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <HandCoins className="text-gold-600 dark:text-gold-400 size-4 shrink-0" aria-hidden />
            Les deux liens du moment
          </h2>

          <Offre
            nom="Wise"
            quoi="Payer et retirer au vrai taux de change, dans presque toutes les devises."
            url="https://wise.com/invite/ahpc/abdelslama1"
            direct="https://wise.com"
            avantage="Vous et Tripora recevez chacun un avantage à l’ouverture."
          />

          <Offre
            nom="BoursoBank"
            quoi="Un compte français dont les paiements et retraits en devise ne coûtent rien, selon la formule."
            url="https://bour.so/p/xyxvlP0GvdG"
            direct="https://www.boursobank.com"
            avantage="Récompense pour vous et pour Tripora, sous réserve d’un premier versement."
            reserve="Réservé aux résidents fiscaux français."
            qr="/soutien-boursobank-qr.jpg"
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Scale className="text-muted size-4 shrink-0" aria-hidden />
            Pourquoi pas de publicité
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            Une régie publicitaire mesure qui vous êtes pour décider quoi vous montrer. Ça
            demanderait d’installer un traceur, d’envoyer des identifiants à un tiers, et de
            renoncer à la seule chose que Tripora promet vraiment : que vos noms, vos dépenses et
            vos déplacements ne partent nulle part. Un lien de parrainage n’a besoin de rien de
            tout ça — il ne sait même pas que vous existez tant que vous n’avez pas cliqué.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Offre({
  nom,
  quoi,
  url,
  direct,
  avantage,
  reserve,
  qr,
}: {
  nom: string;
  quoi: string;
  url: string;
  /** Le lien sans parrainage, toujours proposé. */
  direct: string;
  avantage: string;
  reserve?: string;
  qr?: string;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-[color:var(--border-subtle)] p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{nom}</h3>
          <p className="text-muted mt-0.5 text-sm leading-relaxed">{quoi}</p>
        </div>
        {qr && (
          <img
            src={qr}
            alt={`QR code de parrainage ${nom}`}
            width={72}
            height={72}
            loading="lazy"
            className="size-18 shrink-0 rounded-lg bg-white p-1"
          />
        )}
      </div>

      <p className="text-muted text-xs leading-relaxed">{avantage}</p>
      {reserve && (
        <p className="text-gold-700 dark:text-gold-400 text-xs leading-relaxed">{reserve}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={cn(
            'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold',
            'bg-gold-500/15 text-gold-800 dark:text-gold-200 hover:bg-gold-500/25',
          )}
        >
          <HandCoins className="size-3.5" aria-hidden />
          Avec le parrainage
        </a>
        <a
          href={direct}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'text-muted inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium',
            'border-[color:var(--border-subtle)] hover:bg-brand-50 dark:hover:bg-ink-700/40',
          )}
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Sans
        </a>
      </div>
    </div>
  );
}
