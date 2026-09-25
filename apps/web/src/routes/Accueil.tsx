import { Link } from 'react-router';
import { ArrowRight, Check, EyeOff, HandCoins, Lock, PlayCircle, Ticket } from 'lucide-react';
import { MONTHS_FR, type Destination } from '@tripora/core';
import { CadrePublic } from '@/components/CadrePublic';
import { Drapeau } from '@/components/Drapeau';
import { Pastille, type NomDePastille } from '@/components/Pastille';
import { TableauDesDeparts } from '@/components/TableauDesDeparts';
import { classesDeBouton } from '@/components/ui/Button';
import { estNatif } from '@/lib/natif';
import { destinationsDuMois, niveauDePrix } from '@/lib/vitrine';
import { useGuide } from '@/stores/guide';
import { cheminDuMois } from '@/seo/mois';
import { cn } from '@/lib/cn';
import { insecables } from '@/lib/typographie';

/**
 * L'accueil de qui n'a pas de compte — ou pas encore.
 *
 * C'était l'écran de connexion : on arrivait sur Tripora et la première chose
 * demandée était un compte, avant d'avoir vu quoi que ce soit. L'accueil dit
 * d'abord ce que fait l'application ; la connexion n'est demandée qu'au moment
 * d'agir — créer un voyage, en ouvrir un.
 *
 * Ordre de lecture : la promesse et les deux actions (créer, rejoindre) ; ce
 * qui se passe ensuite, en quatre temps ; ce que l'application contient ; une
 * idée de destination pour le mois ; ce que Tripora ne fait pas de vos
 * données. Les deux actions reviennent à la fin, pour qui a tout lu.
 */
export default function Accueil() {
  const ouvrirLeGuide = useGuide((etat) => etat.ouvrir);
  const mois = new Date().getMonth() + 1;
  const vitrine = destinationsDuMois(mois);

  return (
    <CadrePublic large>
      <main>
        <section className="mx-auto grid w-full max-w-5xl gap-10 px-5 pt-10 pb-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
          <div className="animate-rise space-y-6">
            <p className="etiquette-filet max-w-sm">
              <span className="etiquette">Voyager à plusieurs</span>
            </p>
            <h1 className="titre-lieu text-[2.5rem] leading-[1.02] sm:text-6xl">
              Le voyage entre amis, sans les quinze conversations.
            </h1>
            <p className="text-muted max-w-[46ch] text-[1.05rem] leading-relaxed">
              Chacun dit ses envies et son budget. Tripora propose les destinations qui
              conviennent à tout le groupe, avec le vrai prix des vols, puis vous aide à voter, à
              composer les journées et à faire les comptes.
            </p>
            <ActionsPrincipales />
            <ul className="text-muted flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {['Gratuit', 'Sans publicité', 'Sans mot de passe'].map((promesse) => (
                <li key={promesse} className="inline-flex items-center gap-1.5">
                  <Check className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
                  {promesse}
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-raised filet rotate-[0.6deg] rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-float)] lg:p-6">
            <TableauDesDeparts combien={6} />
          </div>
        </section>

        <Section id="comment-ca-marche" etiquette="Comment ça marche" titre={insecables('Du « on part où ? » au départ')}>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPES.map((etape, rang) => (
              <li key={etape.titre} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Pastille nom={etape.pastille} />
                  <span className="chiffres etiquette">Étape {rang + 1}</span>
                </div>
                <h3 className="titre text-xl">{etape.titre}</h3>
                <p className="text-muted text-sm leading-relaxed">{insecables(etape.texte)}</p>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={ouvrirLeGuide}
            className="text-brand-700 dark:text-brand-200 mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
          >
            <PlayCircle className="size-5" aria-hidden />
            Voir le guide en trente secondes
          </button>
        </Section>

        <Section etiquette="Dans l’application" titre="Tout le voyage au même endroit">
          <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            {FONCTIONS.map((fonction) => (
              <li key={fonction.titre} className="space-y-2">
                <Pastille nom={fonction.pastille} taille="sm" />
                <h3 className="font-semibold">{fonction.titre}</h3>
                <p className="text-muted text-sm leading-relaxed">{insecables(fonction.texte)}</p>
              </li>
            ))}
          </ul>
        </Section>

        {vitrine.length > 0 && (
          <Section
            etiquette="Pas encore d’idée ?"
            titre={insecables(`Où partir en ${MONTHS_FR[mois - 1]} ?`)}
          >
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vitrine.map((destination) => (
                <li key={destination.id}>
                  <CarteDeVitrine destination={destination} />
                </li>
              ))}
            </ul>
            {!estNatif && (
              <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                <a
                  href={cheminDuMois(mois)}
                  className="text-brand-700 dark:text-brand-200 inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                >
                  Toutes les idées pour {MONTHS_FR[mois - 1]}
                  <ArrowRight className="size-4" aria-hidden />
                </a>
                <a
                  href="/destinations"
                  className="text-brand-700 dark:text-brand-200 inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                >
                  Toutes les destinations du carnet
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </p>
            )}
          </Section>
        )}

        <Section etiquette="Vos données" titre="Ce que Tripora ne fait pas">
          <ul className="grid gap-6 sm:grid-cols-3">
            <Promesse icone={<HandCoins className="size-5" aria-hidden />} titre="Pas de publicité">
              Tripora se finance par des liens de réservation partenaires, signalés comme tels,{' '}
              <Link to="/soutenir" className="underline underline-offset-2">
                et c’est tout
              </Link>
              .
            </Promesse>
            <Promesse icone={<Lock className="size-5" aria-hidden />} titre="Pas de revente">
              Vos voyages sont hébergés à Paris, ne sont vendus à personne et s’effacent quand vous
              le demandez.{' '}
              <Link to="/confidentialite" className="underline underline-offset-2">
                Le détail
              </Link>
              .
            </Promesse>
            <Promesse icone={<EyeOff className="size-5" aria-hidden />} titre="Pas vos noms à une IA">
              L’assistant ne reçoit ni noms, ni adresses, ni dépenses : le groupe devient
              « Participant A, B, C ».
            </Promesse>
          </ul>
        </Section>

        <section className="mx-auto w-full max-w-5xl px-5 pt-4 pb-16">
          <div className="bg-brand-500/8 filet rounded-[var(--radius-card)] border px-6 py-10 text-center sm:px-10">
            <h2 className="titre-lieu text-3xl sm:text-4xl">{insecables('On part où ?')}</h2>
            <p className="text-muted mx-auto mt-3 max-w-[40ch] text-sm leading-relaxed">
              Créez le voyage en deux minutes, envoyez le lien au groupe, et laissez Tripora faire
              les comptes.
            </p>
            <div className="mt-6 flex justify-center">
              <ActionsPrincipales centre />
            </div>
          </div>
        </section>

        {/* Pas de pied de page dans l'application mobile : les pages légales
            restent à portée d'un geste depuis l'accueil. */}
        {estNatif && (
          <nav aria-label="Informations légales" className="text-muted px-5 pb-10 text-xs">
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <li>
                <Link to="/conditions" className="underline-offset-2 hover:underline">
                  Conditions d’utilisation
                </Link>
              </li>
              <li>
                <Link to="/confidentialite" className="underline-offset-2 hover:underline">
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link to="/mentions-legales" className="underline-offset-2 hover:underline">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </main>
    </CadrePublic>
  );
}

/** Créer, ou rejoindre : les deux raisons d'ouvrir Tripora. */
function ActionsPrincipales({ centre = false }: { centre?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row', centre && 'sm:justify-center')}>
      <Link to="/voyages/nouveau" className={classesDeBouton({ size: 'lg' })}>
        Créer un voyage
        <ArrowRight className="size-5" aria-hidden />
      </Link>
      <Link to="/rejoindre" className={classesDeBouton({ size: 'lg', variant: 'secondary' })}>
        <Ticket className="size-5" aria-hidden />
        J’ai un code d’invitation
      </Link>
    </div>
  );
}

function Section({
  id,
  etiquette,
  titre,
  children,
}: {
  id?: string;
  etiquette: string;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-12 lg:py-16">
      <p className="etiquette-filet mb-3">
        <span className="etiquette">{etiquette}</span>
      </p>
      <h2 className="titre-lieu mb-8 text-3xl sm:text-4xl">{titre}</h2>
      {children}
    </section>
  );
}

/**
 * Une destination de la vitrine.
 *
 * Sur le site, elle mène à sa page publique — les activités, le climat, le
 * budget — qu'on lit sans compte. Dans l'application, qui n'embarque pas ces
 * pages, elle ouvre directement la création d'un voyage vers elle.
 */
function CarteDeVitrine({ destination }: { destination: Destination }) {
  const contenu = (
    <>
      <Drapeau code={destination.countryCode} pays={destination.country} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="titre block truncate text-lg leading-tight">{destination.name}</span>
        <span className="text-muted block truncate text-xs">{destination.country}</span>
      </span>
      <span
        className="chiffres text-muted shrink-0 text-sm font-semibold"
        title="Budget sur place"
        aria-label={`Budget sur place : ${niveauDePrix(destination).length} sur 3`}
      >
        {niveauDePrix(destination)}
      </span>
    </>
  );
  const classes =
    'surface-raised filet hover:border-brand-500/50 flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3 transition-colors';

  return estNatif ? (
    <Link to={`/voyages/nouveau?destination=${destination.id}`} className={classes}>
      {contenu}
    </Link>
  ) : (
    <a href={`/destinations/${destination.id}`} className={classes}>
      {contenu}
    </a>
  );
}

function Promesse({
  icone,
  titre,
  children,
}: {
  icone: React.ReactNode;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <li className="space-y-2">
      <span className="text-brand-600 dark:text-brand-300">{icone}</span>
      <h3 className="font-semibold">{titre}</h3>
      <p className="text-muted text-sm leading-relaxed">{children}</p>
    </li>
  );
}

const ETAPES: { pastille: NomDePastille; titre: string; texte: string }[] = [
  {
    pastille: 'creer',
    titre: 'Créez le voyage',
    texte:
      'Avec qui, d’où, quand, pour combien. Pas encore de destination ? C’est justement ce que Tripora sait trouver.',
  },
  {
    pastille: 'participants',
    titre: 'Invitez le groupe',
    texte:
      'Un lien ou un code dans la conversation : vos amis rejoignent en un geste, même sans créer de compte.',
  },
  {
    pastille: 'votes',
    titre: 'Décidez ensemble',
    texte:
      'Chacun donne ses envies et son budget. Tripora propose ce qui convient à tous, le groupe vote et tranche.',
  },
  {
    pastille: 'itineraire',
    titre: 'Partez organisés',
    texte:
      'Les journées se composent à partir des activités qui ont plu. Sur place : le coffre, la valise, les comptes.',
  },
];

const FONCTIONS: { pastille: NomDePastille; titre: string; texte: string }[] = [
  {
    pastille: 'votes',
    titre: 'Des propositions chiffrées',
    texte: 'Le vol relevé depuis votre ville, le budget sur place et le climat du mois.',
  },
  {
    pastille: 'decouvrir',
    titre: 'Découvrir',
    texte: 'Les activités défilent comme des cartes. Le groupe voit ce qui plaît, sans savoir qui a dit non.',
  },
  {
    pastille: 'itineraire',
    titre: 'Le programme jour par jour',
    texte: '2 100 activités dans près de 400 destinations, chacune au bon moment de la journée.',
  },
  {
    pastille: 'carte',
    titre: 'Tout sur la carte',
    texte: 'Les lieux du programme, les adresses du groupe et le trajet de chaque journée.',
  },
  {
    pastille: 'coffre',
    titre: 'Le coffre',
    texte: 'Codes, wifi, adresses et billets, lisibles même sans réseau.',
  },
  {
    pastille: 'valise',
    titre: 'La valise',
    texte: 'Une liste partagée à cocher : personne n’emporte trois sèche-cheveux.',
  },
  {
    pastille: 'depenses',
    titre: 'Qui doit quoi',
    texte: 'Chaque dépense, en toutes devises. Les remboursements sont calculés au plus simple.',
  },
  {
    pastille: 'ouvert',
    titre: 'Les trips ouverts',
    texte: 'Rejoindre un groupe qui part déjà au même endroit, aux conditions de son organisateur.',
  },
];
