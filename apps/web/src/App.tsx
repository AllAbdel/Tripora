import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import SignIn from '@/routes/SignIn';
import Trips from '@/routes/Trips';
import TripDetail from '@/routes/TripDetail';
import TripMembers from '@/routes/TripMembers';
import MyPreferences from '@/routes/MyPreferences';
import JoinTrip from '@/routes/JoinTrip';
import Profile from '@/routes/Profile';
import NotFound from '@/routes/NotFound';
import CreateTrip from '@/routes/create/CreateTrip';
import MapTab from '@/routes/MapTab';
import TripItinerary from '@/routes/TripItinerary';
import TripBudget from '@/routes/TripBudget';
import BudgetTab from '@/routes/BudgetTab';
import TripDiscussion from '@/routes/TripDiscussion';
import TripApps from '@/routes/TripApps';
import TripValise from '@/routes/TripValise';
import ModerationApps from '@/routes/ModerationApps';

// MapLibre pèse à lui seul plus que tout le reste de l'application : la carte
// n'est téléchargée que par les personnes qui l'ouvrent vraiment.
const TripMapScreen = lazy(() => import('@/routes/TripMapScreen'));

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
        <Route path="/applications/moderation" element={<ModerationApps />} />
        <Route path="/carte" element={<MapTab />} />
        <Route path="/voyages/:id/budget" element={<TripBudget />} />
        <Route path="/budget" element={<BudgetTab />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
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
          <Route path="/voyages/nouveau" element={<CreateTrip />} />
          <Route path="/voyages/:id/mes-envies" element={<MyPreferences />} />
          <Route path="*" element={<TabbedRoutes />} />
        </>
      ) : (
        <Route path="*" element={<SignIn />} />
      )}
    </Routes>
  );
}
