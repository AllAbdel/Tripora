import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { CadrePublic } from '@/components/CadrePublic';
import { GuideAuPremierPassage } from '@/components/guide/GuideAuPremierPassage';
import { useAuth } from '@/lib/auth-context';
import Accueil from '@/routes/Accueil';
import Connexion from '@/routes/Connexion';
import Trips from '@/routes/Trips';
import JoinTrip from '@/routes/JoinTrip';
import NotFound from '@/routes/NotFound';
import { retenirLaDestinationDemandee } from '@/lib/destinationDemandee';
import { lireLaSuite, oublierLaSuite, retenirLaSuite } from '@/lib/suiteApresConnexion';

// MapLibre pèse à lui seul plus que tout le reste de l'application : la carte
// n'est téléchargée que par les personnes qui l'ouvrent vraiment.
const TripMapScreen = lazy(() => import('@/routes/TripMapScreen'));

/**
 * Les écrans secondaires, chargés à la demande.
 *
 * Le paquet principal contenait les vingt-cinq écrans de l'application, plus
 * le catalogue de la valise et celui des activités : 770 Ko, dont l'essentiel
 * pour des écrans qu'une première visite n'ouvre pas. Restent chargés d'emblée
 * ceux qui font le premier coup d'œil — l'accueil, un voyage, la connexion,
 * l'arrivée par un lien d'invitation.
 *
 * L'écran d'un voyage en est sorti à son tour, le 2 octobre : alertes de prix,
 * carte hors ligne, journal, coffre… il avait fini par peser plus que tout le
 * reste du premier chargement (191 Ko compressés, dont 71 pour lui et ce qu'il
 * entraîne). Une personne qui arrive sur l'accueil public, ou sur la liste de
 * ses voyages, ne l'attend plus. Il est préchargé dès que l'application est
 * ouverte et au repos (`TabbedRoutes`) : le temps de choisir un voyage, il est là.
 *
 * Hors ligne, rien ne change : le service worker précharge tous les fichiers
 * JavaScript après la première visite. Ils cessent seulement de retarder le
 * premier écran.
 */
const chargerLeVoyage = () => import('@/routes/TripDetail');
const TripDetail = lazy(chargerLeVoyage);
const TripMembers = lazy(() => import('@/routes/TripMembers'));
const MyPreferences = lazy(() => import('@/routes/MyPreferences'));
const Profile = lazy(() => import('@/routes/Profile'));
const CreateTrip = lazy(() => import('@/routes/create/CreateTrip'));
const MapTab = lazy(() => import('@/routes/MapTab'));
const TripItinerary = lazy(() => import('@/routes/TripItinerary'));
const TripBudget = lazy(() => import('@/routes/TripBudget'));
const BudgetTab = lazy(() => import('@/routes/BudgetTab'));
const TripDiscussion = lazy(() => import('@/routes/TripDiscussion'));
const TripApps = lazy(() => import('@/routes/TripApps'));
const TripValise = lazy(() => import('@/routes/TripValise'));
const TripRecapitulatif = lazy(() => import('@/routes/TripRecapitulatif'));
const Soutenir = lazy(() => import('@/routes/Soutenir'));
const Confidentialite = lazy(() => import('@/routes/Confidentialite'));
const MentionsLegales = lazy(() => import('@/routes/MentionsLegales'));
const Conditions = lazy(() => import('@/routes/Conditions'));
const TripEdit = lazy(() => import('@/routes/TripEdit'));
const ModerationApps = lazy(() => import('@/routes/ModerationApps'));
const TripsOuverts = lazy(() => import('@/routes/TripsOuverts'));
const PublierLeTrip = lazy(() => import('@/routes/PublierLeTrip'));
const CandidaturesRecues = lazy(() => import('@/routes/CandidaturesRecues'));
const AFaire = lazy(() => import('@/routes/AFaire'));
const TripReservations = lazy(() => import('@/routes/TripReservations'));
const TripSondages = lazy(() => import('@/routes/TripSondages'));
const TripTaches = lazy(() => import('@/routes/TripTaches'));
const TripCoffre = lazy(() => import('@/routes/TripCoffre'));
const TripBilan = lazy(() => import('@/routes/TripBilan'));
const Decouvrir = lazy(() => import('@/routes/Decouvrir'));
const Explorer = lazy(() => import('@/routes/Explorer'));
const Passeport = lazy(() => import('@/routes/Passeport'));
const Partager = lazy(() => import('@/routes/Partager'));
const AlertesDePrix = lazy(() => import('@/routes/AlertesDePrix'));
const TripJournal = lazy(() => import('@/routes/TripJournal'));

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="text-brand-500 size-7 animate-spin" aria-label="Chargement" />
    </div>
  );
}

/** Écrans à onglets. Les parcours qui demandent de l'attention en sortent :
 *  la navigation du bas y serait une porte de sortie accidentelle. */
function TabbedRoutes() {
  useEffect(() => {
    // Au repos, pas avant : le premier écran passe d'abord. Safari n'a pas
    // requestIdleCallback : un délai fixe y tient lieu de repos.
    if (typeof window.requestIdleCallback === 'function') {
      const attente = window.requestIdleCallback(() => void chargerLeVoyage(), { timeout: 3000 });
      return () => window.cancelIdleCallback(attente);
    }
    const attente = window.setTimeout(() => void chargerLeVoyage(), 1500);
    return () => window.clearTimeout(attente);
  }, []);

  return (
    <AppShell>
      <Suspense fallback={<EcranEnChargement />}>
      <Routes>
        <Route path="/" element={<Navigate to="/voyages" replace />} />
        <Route path="/voyages" element={<Trips />} />
        <Route path="/voyages/:id" element={<TripDetail />} />
        <Route path="/voyages/:id/participants" element={<TripMembers />} />
        <Route
          path="/voyages/:id/carte"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <TripMapScreen />
            </Suspense>
          }
        />
        <Route path="/voyages/:id/itineraire" element={<TripItinerary />} />
        <Route path="/voyages/:id/discussion" element={<TripDiscussion />} />
        <Route path="/voyages/:id/applications" element={<TripApps />} />
        <Route path="/voyages/:id/valise" element={<TripValise />} />
        <Route path="/voyages/:id/modifier" element={<TripEdit />} />
        <Route path="/voyages/:id/recapitulatif" element={<TripRecapitulatif />} />
        <Route path="/voyages/:id/a-faire" element={<AFaire />} />
        <Route path="/voyages/:id/decouvrir" element={<Decouvrir />} />
        <Route path="/voyages/:id/reservations" element={<TripReservations />} />
        <Route path="/voyages/:id/sondages" element={<TripSondages />} />
        <Route path="/voyages/:id/qui-fait-quoi" element={<TripTaches />} />
        <Route path="/voyages/:id/coffre" element={<TripCoffre />} />
        <Route path="/voyages/:id/journal" element={<TripJournal />} />
        <Route path="/voyages/:id/bilan" element={<TripBilan />} />
        <Route path="/voyages/:id/ouverts" element={<TripsOuverts />} />
        <Route path="/voyages/:id/publier" element={<PublierLeTrip />} />
        <Route path="/voyages/:id/candidatures" element={<CandidaturesRecues />} />
        <Route path="/applications/moderation" element={<ModerationApps />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/carte" element={<MapTab />} />
        <Route path="/voyages/:id/budget" element={<TripBudget />} />
        <Route path="/budget" element={<BudgetTab />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/passeport" element={<Passeport />} />
        {/* « Partager vers Tripora » : le menu Partager du téléphone ou du
            navigateur arrive ici, avec le lien dans l'adresse. */}
        <Route path="/partager" element={<Partager />} />
        <Route path="/alertes" element={<AlertesDePrix />} />
        <Route path="/soutenir" element={<Soutenir />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/conditions" element={<Conditions />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </AppShell>
  );
}

/**
 * Le repli pendant qu'un écran arrive.
 *
 * Il garde la hauteur d'un écran : sans elle, la barre d'onglets remonterait
 * au milieu de la page le temps d'un chargement, puis redescendrait. Et il
 * n'apparaît qu'après un court délai, pour qu'un écran déjà en cache ne fasse
 * pas clignoter un indicateur de chargement.
 */
function EcranEnChargement() {
  return (
    <div className="grid min-h-[70dvh] place-items-center">
      <span className="apparition-tardive">
        <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
      </span>
    </div>
  );
}

/** Une page publique lue sans compte : la barre, le texte, le pied de page. */
function PagePublique({ children }: { children: ReactNode }) {
  return (
    <CadrePublic>
      <Suspense fallback={<EcranEnChargement />}>{children}</Suspense>
    </CadrePublic>
  );
}

/**
 * Une page qui demande un compte, ouverte sans en avoir.
 *
 * On mène à la connexion en retenant où l'on allait : une fois connecté, on y
 * arrive directement. La liste des voyages n'a pas besoin d'être retenue —
 * c'est là qu'on arrive de toute façon —, et son adresse peut porter le code
 * d'un retour de Google raté, qu'il ne faut pas rejouer plus tard.
 */
function VersLaConnexion() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (pathname !== '/voyages') retenirLaSuite(`${pathname}${search}`);
  }, [pathname, search]);
  return <Navigate to="/connexion" replace />;
}

/**
 * Connecté sur l'écran de connexion : on va là où on voulait aller.
 *
 * Le message éventuel suit : l'application mobile ramène ici un refus de
 * Google, y compris quand on était déjà connecté (un compte invité qui
 * rattachait Google), et c'est l'écran d'arrivée qui doit l'afficher.
 */
function ApresConnexion() {
  const { state } = useLocation();
  // Lue au rendu, effacée après : un rendu peut être joué deux fois.
  const [cible] = useState(() => lireLaSuite() ?? '/voyages');
  useEffect(() => oublierLaSuite(), []);
  return <Navigate to={cible} replace state={state} />;
}

export default function App() {
  const { identity, loading } = useAuth();
  const { search } = useLocation();

  // « Organiser ce voyage » depuis une page publique du carnet : la destination
  // entre dans le brouillon, connexion faite ou pas.
  useEffect(() => {
    if (loading) return;
    retenirLaDestinationDemandee(search);
  }, [search, loading]);

  if (loading) return <FullScreenLoader />;

  return (
    <>
      <Routes>
        {/* Public : un lien d'invitation doit marcher pour quelqu'un qui n'a
            jamais ouvert Tripora. L'écran ouvre lui-même une session invité. */}
        <Route path="/rejoindre" element={<JoinTrip />} />
        <Route path="/rejoindre/:code" element={<JoinTrip />} />

        {/* Ouvert à tous : on compose son trip avant d'avoir un compte. Le
            compte n'est demandé qu'à la toute fin, au moment d'enregistrer —
            quand on a déjà six réponses à ne pas perdre. Déclarée une seule
            fois, hors du choix « connecté ou pas » : quand la session s'ouvre
            à la dernière étape, l'écran reste le même et garde son état. */}
        <Route
          path="/voyages/nouveau"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <CreateTrip />
            </Suspense>
          }
        />

        {identity ? (
          <>
            <Route path="/connexion" element={<ApresConnexion />} />
            <Route
              path="/voyages/:id/mes-envies"
              element={
                <Suspense fallback={<FullScreenLoader />}>
                  <MyPreferences />
                </Suspense>
              }
            />
            <Route path="*" element={<TabbedRoutes />} />
          </>
        ) : (
          <>
            {/* Sans compte, on lit l'accueil et ce que Tripora fait de vos
                données, et on compose un trip (plus haut). Tout le reste mène
                à la connexion, puis y revient. */}
            <Route path="/" element={<Accueil />} />
            <Route path="/connexion" element={<Connexion />} />
            <Route
              path="/confidentialite"
              element={
                <PagePublique>
                  <Confidentialite />
                </PagePublique>
              }
            />
            <Route
              path="/mentions-legales"
              element={
                <PagePublique>
                  <MentionsLegales />
                </PagePublique>
              }
            />
            <Route
              path="/conditions"
              element={
                <PagePublique>
                  <Conditions />
                </PagePublique>
              }
            />
            <Route
              path="/soutenir"
              element={
                <PagePublique>
                  <Soutenir />
                </PagePublique>
              }
            />
            <Route path="*" element={<VersLaConnexion />} />
          </>
        )}
      </Routes>
      <GuideAuPremierPassage />
    </>
  );
}
