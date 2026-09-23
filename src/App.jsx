import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './components/ui/ConfirmProvider';
import ToastStack from './components/ui/ToastStack';
import ProtectedRoute from './components/auth/ProtectedRoute';
import EventRoute from './components/auth/EventRoute';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
// SetupRequiredPage stays a static import — it's the fallback RequireSupabase
// itself renders below, tiny, and needed before any lazy chunk could resolve.
import SetupRequiredPage from './pages/SetupRequiredPage';

// Every other page is route-split with React.lazy: previously all 31 pages
// (marketing, auth, the entire organizer app, player app, admin, public
// pages, and the spectator TV display) shipped in one >2MB bundle to every
// visitor regardless of which single area they actually needed. Splitting
// here means, e.g., a marketing-site visitor never downloads organizer/
// player/admin code, and vice versa.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const PlayerLoginPage = lazy(() => import('./pages/player/PlayerLoginPage'));
const PlayerSignupPage = lazy(() => import('./pages/player/PlayerSignupPage'));
const PlayerDashboardPage = lazy(() => import('./pages/player/PlayerDashboardPage'));
const AccountSettingsPage = lazy(() => import('./pages/account/AccountSettingsPage'));
const AdminCustomersPage = lazy(() => import('./pages/admin/AdminCustomersPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const DashboardPage = lazy(() => import('./pages/organizer/DashboardPage'));
const EventEditorPage = lazy(() => import('./pages/organizer/EventEditorPage'));
const OverviewPage = lazy(() => import('./pages/organizer/event/OverviewPage'));
const RegistrationsPage = lazy(() => import('./pages/organizer/event/RegistrationsPage'));
const CheckInManagePage = lazy(() => import('./pages/organizer/event/CheckInManagePage'));
const BracketsPage = lazy(() => import('./pages/organizer/event/BracketsPage'));
const MatchListPage = lazy(() => import('./pages/organizer/event/MatchListPage'));
const PreviewSetupPage = lazy(() => import('./pages/organizer/event/PreviewSetupPage'));
const PreviewDisplayPage = lazy(() => import('./pages/organizer/event/PreviewDisplayPage'));
const UmpiresPage = lazy(() => import('./pages/organizer/event/UmpiresPage'));
const TeamPage = lazy(() => import('./pages/organizer/event/TeamPage'));
const SettingsPage = lazy(() => import('./pages/organizer/event/SettingsPage'));
const SponsorsPage = lazy(() => import('./pages/organizer/event/SponsorsPage'));
const AccountingPage = lazy(() => import('./pages/organizer/event/AccountingPage'));
const PublicEventPage = lazy(() => import('./pages/public/PublicEventPage'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage'));
const CheckInPage = lazy(() => import('./pages/public/CheckInPage'));
const DiscoverTournamentsPage = lazy(() => import('./pages/public/DiscoverTournamentsPage'));
const SubscribePage = lazy(() => import('./pages/public/SubscribePage'));
const DinkManagerDemoPage = lazy(() => import('./pages/legacy/DinkManagerDemoPage'));

// Same visual language as ProtectedRoute.jsx/EventRoute.jsx's existing
// "Loading…" state, so a lazy chunk resolving looks identical to the
// auth-check loading state that was already there.
function RouteFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] text-sm text-ink-400">Loading…</div>;
}

function RequireSupabase({ children }) {
  return isSupabaseConfigured ? children : <SetupRequiredPage />;
}

function Protected({ children, role, requireAdmin }) {
  return (
    <RequireSupabase>
      <ProtectedRoute role={role} requireAdmin={requireAdmin}>
        {children}
      </ProtectedRoute>
    </RequireSupabase>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<RequireSupabase><LoginPage /></RequireSupabase>} />
        <Route path="/signup" element={<RequireSupabase><SignupPage /></RequireSupabase>} />
        <Route path="/forgot-password" element={<RequireSupabase><ForgotPasswordPage /></RequireSupabase>} />
        <Route path="/reset-password" element={<RequireSupabase><ResetPasswordPage /></RequireSupabase>} />
        <Route path="/player/login" element={<RequireSupabase><PlayerLoginPage /></RequireSupabase>} />
        <Route path="/player/signup" element={<RequireSupabase><PlayerSignupPage /></RequireSupabase>} />
        <Route path="/player/dashboard" element={<Protected role="player"><PlayerDashboardPage /></Protected>} />

        <Route path="/account" element={<Protected role="any"><AccountSettingsPage /></Protected>} />
        <Route
          path="/admin"
          element={
            <Protected requireAdmin>
              <AdminDashboardPage />
            </Protected>
          }
        />
        <Route
          path="/admin/customers"
          element={
            <Protected requireAdmin>
              <AdminCustomersPage />
            </Protected>
          }
        />

        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/events/:eventId/edit" element={<EventRoute permission="edit_event"><EventEditorPage /></EventRoute>} />
        <Route path="/events/:eventId/overview" element={<EventRoute permission="overview"><OverviewPage /></EventRoute>} />
        <Route path="/events/:eventId/manage" element={<EventRoute permission="registrations"><RegistrationsPage /></EventRoute>} />
        <Route path="/events/:eventId/checkin" element={<EventRoute permission="checkin"><CheckInManagePage /></EventRoute>} />
        <Route path="/events/:eventId/brackets" element={<EventRoute permission="brackets"><BracketsPage /></EventRoute>} />
        <Route
          path="/events/:eventId/matchlist"
          element={
            <EventRoute permission="matchlist">
              <OfflineSyncProvider>
                <MatchListPage />
              </OfflineSyncProvider>
            </EventRoute>
          }
        />
        <Route path="/events/:eventId/preview" element={<EventRoute permission="preview"><PreviewSetupPage /></EventRoute>} />
        {/* Public on purpose: players land here straight from the check-in
            flow with no session at all, and it's spectator-facing anyway (no
            PII — same data already shown on a venue TV). */}
        <Route path="/events/:eventId/preview/:categoryId" element={<RequireSupabase><PreviewDisplayPage /></RequireSupabase>} />
        <Route path="/events/:eventId/umpires" element={<EventRoute permission="umpires"><UmpiresPage /></EventRoute>} />
        <Route path="/events/:eventId/sponsors" element={<EventRoute permission="sponsors"><SponsorsPage /></EventRoute>} />
        <Route path="/events/:eventId/accounting" element={<EventRoute permission="accounting"><AccountingPage /></EventRoute>} />
        <Route path="/events/:eventId/settings" element={<EventRoute permission="settings"><SettingsPage /></EventRoute>} />
        <Route path="/events/:eventId/team" element={<EventRoute ownerOnly><TeamPage /></EventRoute>} />

        <Route path="/e/:slug" element={<RequireSupabase><PublicEventPage /></RequireSupabase>} />
        <Route path="/e/:slug/register" element={<RequireSupabase><RegisterPage /></RequireSupabase>} />
        <Route path="/e/:slug/checkin" element={<RequireSupabase><CheckInPage /></RequireSupabase>} />
        {/* Private events' secret share link — mirrors the /e/:slug pair above
            but resolves via share_token instead of slug. */}
        <Route path="/t/:token" element={<RequireSupabase><PublicEventPage /></RequireSupabase>} />
        <Route path="/t/:token/register" element={<RequireSupabase><RegisterPage /></RequireSupabase>} />
        <Route path="/tournaments" element={<RequireSupabase><DiscoverTournamentsPage /></RequireSupabase>} />
        <Route path="/subscribe/:plan" element={<RequireSupabase><SubscribePage /></RequireSupabase>} />

        <Route path="/demo/dinkmanager" element={<DinkManagerDemoPage />} />

        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastStack />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
