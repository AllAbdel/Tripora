import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { fold, localeActive } from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Drapeau } from '@/components/Drapeau';
import { useLangueActive } from '@/stores/langue';
import { nomDuPays, PASSEPORTS_MAX, usePasseports } from '@/stores/passeports';

/**
 * « Mon passeport » : la nationalité qui décide des visas.
 *
 * Facultatif. Sans réponse, les infos pratiques supposent un passeport du
 * pays de départ, et le disent. La liste vient du tableau des visas, chargé
 * à la demande comme dans les infos pratiques : on ne propose que des
 * passeports pour lesquels Tripora sait répondre.
 */
export function MesPasseports() {
  useLangueActive();
  const passeports = usePasseports((etat) => etat.passeports);
  const ajouter = usePasseports((etat) => etat.ajouter);
  const retirer = usePasseports((etat) => etat.retirer);
  const [connus, setConnus] = useState<string[] | null>(null);

  useEffect(() => {
    let actif = true;
    import('@tripora/core/visas')
      .then(({ passeportsConnus }) => {
        if (actif) setConnus(passeportsConnus());
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);

  const locale = localeActive();
  const options = useMemo(
    () =>
      (connus ?? [])
        .filter((code) => !passeports.includes(code))
        .map((code) => ({ code, nom: nomDuPays(code, locale) }))
        .sort((a, b) => fold(a.nom).localeCompare(fold(b.nom), locale)),
    [connus, passeports, locale],
  );

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-muted text-sm leading-relaxed">
          Tripora vous dit s’il faut un visa pour chaque destination. Sans passeport indiqué, il suppose
          celui du pays de départ. Ce choix reste sur cet appareil.
        </p>

        {passeports.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Mes passeports">
            {passeports.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => retirer(code)}
                  aria-label={`Retirer le passeport ${nomDuPays(code, locale)}`}
                  className="pressable border-brand-500 bg-brand-500 inline-flex min-h-10 items-center gap-1.5 rounded-full border ps-3 pe-2.5 text-sm font-medium text-[color:var(--accent-contrast)]"
                >
                  <Drapeau code={code} />
                  {nomDuPays(code, locale)}
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {passeports.length < PASSEPORTS_MAX && (
          <div className="space-y-1.5">
            <label htmlFor="ajout-passeport" className="block text-sm font-semibold">
              {passeports.length === 0 ? 'Pays de mon passeport' : 'Une autre nationalité'}
            </label>
            <select
              id="ajout-passeport"
              value=""
              disabled={connus === null}
              onChange={(evenement) => {
                if (evenement.target.value) ajouter(evenement.target.value);
              }}
              className="surface-raised focus:border-brand-500 h-12 w-full rounded-2xl border border-[color:var(--border-subtle)] px-4 text-[16px] outline-none disabled:opacity-60"
            >
              <option value="">{connus === null ? 'Chargement…' : 'Choisir un pays'}</option>
              {options.map(({ code, nom }) => (
                <option key={code} value={code}>
                  {nom}
                </option>
              ))}
            </select>
          </div>
        )}

        {passeports.length > 1 && (
          <p className="text-muted text-xs leading-relaxed">
            Avec plusieurs passeports, Tripora retient pour chaque destination celui qui demande le moins
            de démarches.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
