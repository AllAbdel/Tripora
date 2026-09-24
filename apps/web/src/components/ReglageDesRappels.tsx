import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { activerLesRappels, desactiverLesRappels, useChoixDesRappels } from '@/lib/rappels';

/**
 * Les rappels sur ce téléphone, dans le profil. N'apparaît que dans
 * l'application : sur le site, un navigateur fermé ne réveille personne.
 */
export function ReglageDesRappels() {
  const choix = useChoixDesRappels();
  const [enCours, setEnCours] = useState(false);
  const [refusParLeTelephone, setRefusParLeTelephone] = useState(false);

  async function basculer() {
    setEnCours(true);
    try {
      if (choix === 'actifs') {
        await desactiverLesRappels();
      } else {
        setRefusParLeTelephone(!(await activerLesRappels()));
      }
    } finally {
      setEnCours(false);
    }
  }

  const actifs = choix === 'actifs';

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          {actifs ? (
            <Bell className="text-brand-500 mt-0.5 size-5 shrink-0" aria-hidden />
          ) : (
            <BellOff className="text-muted mt-0.5 size-5 shrink-0" aria-hidden />
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold">{actifs ? 'Rappels activés' : 'Rappels désactivés'}</p>
            <p className="text-muted text-sm">
              La veille du départ, trois heures avant un vol, une heure avant une visite réservée, et le matin d’une
              tâche qui vous revient.
            </p>
          </div>
        </div>
        {refusParLeTelephone && !actifs && (
          <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
            Le téléphone refuse les notifications de Tripora : autorisez-les dans ses réglages, puis réessayez.
          </p>
        )}
        <Button variant={actifs ? 'secondary' : 'primary'} block loading={enCours} onClick={() => void basculer()}>
          {actifs ? 'Couper les rappels' : 'Activer les rappels'}
        </Button>
      </CardBody>
    </Card>
  );
}

/**
 * La proposition, là où elle a du sens : sur l'accueil d'un voyage daté,
 * avant le départ, tant qu'on n'a ni accepté ni refusé.
 */
export function PropositionDeRappels() {
  const choix = useChoixDesRappels();
  const [enCours, setEnCours] = useState(false);
  if (choix !== null) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="text-muted">Un rappel la veille du départ, et avant chaque vol ?</span>
      <Button
        size="sm"
        variant="secondary"
        loading={enCours}
        icon={<Bell className="size-4" aria-hidden />}
        onClick={() => {
          setEnCours(true);
          void activerLesRappels().finally(() => setEnCours(false));
        }}
      >
        Activer les rappels
      </Button>
    </div>
  );
}
