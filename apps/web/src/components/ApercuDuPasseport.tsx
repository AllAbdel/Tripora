import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Drapeau } from '@/components/Drapeau';
import { Pastille } from '@/components/Pastille';
import { usePasseport } from '@/lib/passeport';

/**
 * Le passeport, en une ligne, en tête du profil : le rang, les pays, et
 * quelques drapeaux. De quoi donner envie d'ouvrir la page entière.
 */
export function ApercuDuPasseport() {
  const { passeport: p } = usePasseport();

  return (
    <Link to="/passeport" className="block">
      <Card className="hover:border-brand-500 transition-colors">
        <CardBody className="flex items-center gap-3">
          <Pastille nom="passeport" taille="sm" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Mon passeport</p>
            <p className="text-muted truncate text-sm">
              {p.niveau.nom} ·{' '}
              {p.pays.length === 0 ? 'aucun pays encore' : p.pays.length === 1 ? '1 pays' : `${p.pays.length} pays`}
            </p>
          </div>
          <span className="flex shrink-0 -space-x-1">
            {p.pays.slice(0, 4).map((pays) => (
              <Drapeau key={pays.code} code={pays.code} pays={pays.nom} className="h-4 rounded-sm ring-2 ring-[color:var(--surface)]" />
            ))}
          </span>
          <ArrowRight className="text-muted size-4 shrink-0" aria-hidden />
        </CardBody>
      </Card>
    </Link>
  );
}
