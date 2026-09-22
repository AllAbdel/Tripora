/**
 * Une durée telle qu'on la dit.
 *
 * Le catalogue d'activités range les durées en heures décimales, parce que
 * c'est ce qui se calcule : additionner une journée revient à additionner des
 * nombres. Personne ne lit « 1,5 h » — on dit « 1 h 30 ». Et au-delà d'une
 * nuit sur place, l'unité change : le trek du Rinjani se compte en jours, pas
 * en trente-six heures.
 *
 * Dans le moteur, et pas dans l'application, parce que le moteur en a besoin
 * lui aussi : c'est lui qui écrit pourquoi une activité est posée là.
 */
export function direLaDuree(heures: number): string {
  if (heures >= 24) {
    const jours = Math.round(heures / 24);
    return `${jours} jour${jours > 1 ? 's' : ''}`;
  }
  const entieres = Math.floor(heures);
  const minutes = Math.round((heures - entieres) * 60);
  // Une durée qui s'arrête sur l'heure ne montre pas ses minutes : « 3 h 00 »
  // a l'air d'un horaire de train, « 3 h » d'une durée.
  if (minutes === 0) return `${entieres} h`;
  if (entieres === 0) return `${minutes} min`;
  return `${entieres} h ${String(minutes).padStart(2, '0')}`;
}
