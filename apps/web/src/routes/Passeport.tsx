import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Lock, Stamp } from 'lucide-react';
import { NOMS_DES_CONTINENTS, type Tampon } from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Drapeau } from '@/components/Drapeau';
import { CarteDuMonde } from '@/components/CarteDuMonde';
import { TitreDePage } from '@/components/TitreDePage';
import { usePasseport } from '@/lib/passeport';
import { cn } from '@/lib/cn';

/**
 * Le passeport du voyageur : les pays, les kilomètres, les tampons.
 *
 * Entre deux voyages, il n'y avait rien à ouvrir dans Tripora. Le passeport
 * est ce qu'on vient regarder — et montrer — quand on ne prépare rien : ce
 * qu'on a vécu, et ce qu'il reste à gagner.
 *
 * Tout y est calculé depuis les voyages eux-mêmes, rien n'est déclaré : c'est
 * ce qui lui donne sa valeur, et ce qui en fera une base honnête pour des
 * points échangeables le jour où il y en aura.
 */

const NOMBRE = new Intl.NumberFormat('fr-FR');

export default function Passeport() {
  const { passeport: p } = usePasseport();

  const vierge = p.faits.length === 0;
  const obtenus = p.tampons.filter((tampon) => tampon.obtenu).length;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-5 pt-4 pb-28">
      <Link
        to="/profil"
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Profil
      </Link>

      <TitreDePage pastille="passeport">Mon passeport</TitreDePage>

      <Card className="animate-rise overflow-hidden">
        <CardBody className="space-y-3">
          <p className="etiquette text-muted">Rang</p>
          <p className="font-display text-3xl leading-tight font-bold">{p.niveau.nom}</p>
          {p.niveau.suivant ? (
            <>
              <p className="text-muted text-sm">
                {p.niveau.suivant.manque === 1 ? 'Encore un pays' : `Encore ${p.niveau.suivant.manque} pays`}{' '}
                pour devenir <strong className="text-[color:var(--text-strong)]">{p.niveau.suivant.nom}</strong>.
              </p>
              {/* Comptée depuis zéro, pas depuis le rang atteint : au premier
                  pays, une jauge vide dirait qu'on n'a rien fait. */}
              <Jauge
                fait={p.pays.length}
                objectif={p.pays.length + p.niveau.suivant.manque}
                libelle={`Progression vers ${p.niveau.suivant.nom}`}
              />
            </>
          ) : (
            <p className="text-muted text-sm">Le plus haut rang. Il n’y a plus rien au-dessus.</p>
          )}
        </CardBody>
      </Card>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Chiffre valeur={p.faits.length} libelle={p.faits.length > 1 ? 'voyages' : 'voyage'} />
        <Chiffre valeur={p.pays.length} libelle="pays" />
        <Chiffre valeur={p.jours} libelle={p.jours > 1 ? 'jours sur la route' : 'jour sur la route'} />
        <Chiffre valeur={p.kilometres} libelle="km parcourus" />
      </dl>

      <Card>
        <CardBody className="space-y-2">
          <CarteDuMonde
            paysVisites={p.pays}
            voyages={p.faits.map((voyage) => ({
              id: voyage.id,
              nom: voyage.ville ?? voyage.titre,
              destination: voyage.destination ?? null,
              origine: voyage.origine ?? null,
            }))}
          />
          <p className="text-muted text-xs">
            {vierge
              ? 'Les pays visités s’allumeront ici, avec un arc depuis chez vous.'
              : 'Les pays visités s’allument en or ; chaque arc part de la ville de départ du voyage.'}
          </p>
        </CardBody>
      </Card>

      {p.prochain && (
        <Link
          to={`/voyages/${p.prochain.voyage.id}`}
          className="bg-brand-50 dark:bg-ink-700/40 flex items-center gap-3 rounded-2xl px-4 py-3"
        >
          <Drapeau code={p.prochain.voyage.codePays} pays={p.prochain.voyage.pays ?? undefined} className="h-5" />
          <span className="min-w-0 flex-1 text-sm">
            Prochain tampon :{' '}
            <strong>{p.prochain.voyage.ville ?? p.prochain.voyage.titre}</strong>,{' '}
            {p.prochain.dansJours === 1 ? 'demain' : `dans ${p.prochain.dansJours} jours`}
          </span>
          <ArrowRight className="text-muted size-4 shrink-0" aria-hidden />
        </Link>
      )}

      {vierge ? (
        <Card>
          <CardBody className="space-y-3 text-center">
            <Stamp className="text-muted mx-auto size-8" aria-hidden />
            <p className="font-semibold">Votre passeport est encore vierge</p>
            <p className="text-muted text-sm leading-relaxed">
              Un voyage y entre quand sa destination est retenue et que ses dates exactes
              arrivent : le tampon se gagne le jour du départ.
            </p>
            <Link
              to="/voyages/nouveau"
              className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
            >
              Préparer un voyage
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardBody>
        </Card>
      ) : (
        <section aria-labelledby="pays-visites" className="space-y-3">
          <h2 id="pays-visites" className="etiquette text-muted">
            {p.pays.length > 1 ? `${p.pays.length} pays` : '1 pays'} ·{' '}
            {p.continents.map((continent) => NOMS_DES_CONTINENTS[continent]).join(', ')}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {p.pays.map((pays) => (
              <li
                key={pays.code}
                className="flex items-center gap-2.5 rounded-xl bg-[color:var(--surface)] px-3 py-2.5 text-sm shadow-[var(--shadow-card)]"
              >
                <Drapeau code={pays.code} pays={pays.nom} className="h-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{pays.nom}</span>
                {pays.fois > 1 && <span className="text-muted text-xs tabular-nums">×{pays.fois}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="tampons" className="space-y-3">
        <h2 id="tampons" className="etiquette text-muted">
          Tampons · {obtenus} sur {p.tampons.length}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Les tampons gagnés d'abord : c'est ce qu'on vient voir. */}
          {[...p.tampons]
            .sort((a, b) => Number(b.obtenu) - Number(a.obtenu))
            .map((tampon) => (
              <TamponVu key={tampon.id} tampon={tampon} />
            ))}
        </ul>
      </section>

      <p className="text-muted text-xs leading-relaxed">
        Un voyage compte quand sa destination est retenue et que ses dates exactes sont
        arrivées. Les kilomètres sont des allers-retours à vol d’oiseau depuis la ville de départ
        de chaque voyage.
      </p>
    </div>
  );
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
      <dt className="text-muted text-xs">{libelle}</dt>
      <dd className="font-display text-2xl font-bold tabular-nums">{NOMBRE.format(valeur)}</dd>
    </div>
  );
}

function Jauge({ fait, objectif, libelle }: { fait: number; objectif: number; libelle: string }) {
  const part = objectif > 0 ? Math.min(1, Math.max(0, fait / objectif)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={libelle}
      aria-valuemin={0}
      aria-valuemax={objectif}
      aria-valuenow={fait}
      className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]"
    >
      <div className="bg-gold-500 h-full rounded-full transition-[width]" style={{ width: `${part * 100}%` }} />
    </div>
  );
}

function TamponVu({ tampon }: { tampon: Tampon }) {
  return (
    <li
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center',
        tampon.obtenu
          ? 'bg-[color:var(--surface)] shadow-[var(--shadow-card)]'
          : 'border border-dashed border-[color:var(--border-subtle)]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-12 place-items-center rounded-full',
          tampon.obtenu
            ? 'bg-gradient-to-br from-[#f5c542] to-[#e0a106] text-white'
            : 'text-muted bg-[color:var(--surface-muted)]',
        )}
      >
        {tampon.obtenu ? <Stamp className="size-6" /> : <Lock className="size-5" />}
      </span>
      <p className={cn('text-sm font-semibold', !tampon.obtenu && 'text-muted')}>
        {tampon.titre}
        <span className="sr-only">{tampon.obtenu ? ' — obtenu' : ' — à gagner'}</span>
      </p>
      <p className="text-muted text-xs leading-snug">{tampon.detail}</p>
      {!tampon.obtenu && tampon.progression && tampon.progression.fait > 0 && (
        <p className="text-muted text-xs tabular-nums">
          {NOMBRE.format(tampon.progression.fait)} / {NOMBRE.format(tampon.progression.objectif)}
        </p>
      )}
    </li>
  );
}
