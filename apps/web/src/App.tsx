import { Navigate, Route, Routes } from 'react-router';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import SignIn from '@/routes/SignIn';
import Trips from '@/routes/Trips';
import Profile from '@/routes/Profile';
import NotFound from '@/routes/NotFound';
import { Placeholder } from '@/routes/Placeholder';

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="text-brand-500 size-7 animate-spin" aria-label="Chargement" />
    </div>
  );
}

export default function App() {
  const { identity, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!identity) {
    return (
      <Routes>
        <Route path="*" element={<SignIn />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/voyages" replace />} />
        <Route path="/voyages" element={<Trips />} />
        <Route
          path="/carte"
          element={
            <Placeholder
              title="Carte"
              phase="Bientôt disponible"
              description="La carte affichera la destination, l’hébergement, les activités et le trajet de chaque journée. Elle arrive une fois la destination choisie par le groupe."
            />
          }
        />
        <Route
          path="/budget"
          element={
            <Placeholder
              title="Budget"
              phase="Bientôt disponible"
              description="Le budget comparera l’estimation du voyage aux dépenses réelles, et calculera qui doit combien à qui, en simplifiant les remboursements."
            />
          }
        />
        <Route path="/profil" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}
