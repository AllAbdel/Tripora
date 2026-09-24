import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import SignIn from '@/routes/SignIn';
import Trips from '@/routes/Trips';
import TripDetail from '@/routes/TripDetail';
import JoinTrip from '@/routes/JoinTrip';
import NotFound from '@/routes/NotFound';

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
 * Hors ligne, rien ne change : le service worker précharge tous les fichiers
 * JavaScript après la première visite. Ils cessent seulement de retarder le
 * premier écran.
 */
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
const TripEdit = lazy(() => import('@/routes/TripEdit'));
const ModerationApps = lazy(() => import('@/routes/ModerationApps'));
const TripsOuverts = lazy(() => import('@/routes/TripsOuverts'));
const PublierLeTrip = lazy(() => import('@/routes/PublierLeTrip'));
const CandidaturesRecues = lazy(() => import('@/routes/CandidaturesRecues'));
const AFaire = lazy(() => import('@/routes/AFaire'));
const TripReservations = lazy(() => import('@/routes/TripReservations'));
const TripSondages = lazy(() => import('@/routes/TripSondages'));
const TripTaches = lazy(() => import('@/routes/TripTaches'));
const Explorer = lazy(() => import('@/routes/Explorer'));
const Passeport = lazy(() => import('@/routes/Passeport'));

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
        <Route path="/voyages/:id/reservations" element={<TripReservations />} />
        <Route path="/voyages/:id/sondages" element={<TripSondages />} />
        <Route path="/voyages/:id/qui-fait-quoi" element={<TripTaches />} />
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
        <Route path="/soutenir" element={<Soutenir />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
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

export default function App() {
  const { identity, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Routes>
      {/* Public : un lien d'invitation doit marcher pour quelqu'un qui n'a
          jamais ouvert Tripora. L'écran ouvre lui-même une session invité. */}
      <Route path="/rejoindre" element={<JoinTrip />} />
      <Route path="/rejoindre/:code" element={<JoinTrip />} />

      {identity ? (
        <>
          <Route
            path="/voyages/nouveau"
            element={
              <Suspense fallback={<FullScreenLoader />}>
                <CreateTrip />
              </Suspense>
            }
          />
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
        <Route path="*" element={<SignIn />} />
      )}
    </Routes>
  );
}
