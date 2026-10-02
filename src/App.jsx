import { Component, lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { trackPageView } from './lib/analytics';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './components/ui/ConfirmProvider';
import ToastStack from './components/ui/ToastStack';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { EventAccessLayout, EventIndexRedirect, RequireEventPermission } from './components/auth/EventRoute';
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
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/legal/TermsPage'));
const PlayerLoginPage = lazy(() => import('./pages/player/PlayerLoginPage'));
const PlayerSignupPage = lazy(() => import('./pages/player/PlayerSignupPage'));
const PlayerDashboardPage = lazy(() => import('./pages/player/PlayerDashboardPage'));
const AccountSettingsPage = lazy(() => import('./pages/account/AccountSettingsPage'));
const AdminCustomersPage = lazy(() => import('./pages/admin/AdminCustomersPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminSupportRequestsPage = lazy(() => import('./pages/admin/AdminSupportRequestsPage'));
const AdminRequestDetailPage = lazy(() => import('./pages/admin/AdminRequestDetailPage'));
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

// Catches a lazy route chunk failing to load — most commonly an already-open
// tab whose in-memory JS references a previous deploy's hashed filename
// (see sw.js for the service-worker-side half of this fix). With no
// boundary here, that render-time rejection unmounted the whole tree with
// nothing in its place: the blank white screen this exists to catch.
// Reloads once automatically (a fresh index.html always resolves it); the
// sessionStorage guard stops a genuinely broken deploy from reload-looping.
class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    const isChunkError = /fetch dynamically imported module|importing a module script failed/i.test(error?.message || '');
    if (isChunkError && !sessionStorage.getItem('dm_chunk_reload')) {
      sessionStorage.setItem('dm_chunk_reload', '1');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f3f6f8] px-4 text-center">
          <p className="text-sm font-semibold text-ink-700">Something went wrong loading this page.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Listens for main.jsx's onNeedRefresh event (a new deploy's service worker
// is installed and waiting — see sw.js) and prompts instead of silently
// activating mid-session.
function ServiceWorkerUpdatePrompt() {
  const { pushToast } = useToast();

  useEffect(() => {
    const onUpdate = (e) => {
      pushToast(
        <span className="flex items-center gap-2">
          A new version is available.
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              e.detail.reload();
            }}
            className="flex items-center gap-1 font-bold underline underline-offset-2"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </span>,
        'info',
        20000
      );
    };
    window.addEventListener('dm:sw-update-available', onUpdate);
    return () => window.removeEventListener('dm:sw-update-available', onUpdate);
  }, [pushToast]);

  return null;
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

// Pages are lazy-loaded and set their own <title> once mounted (useSeo), so
// the page view waits briefly for that before reporting — and is dropped if
// the user navigates again first.
function AnalyticsPageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    const timer = setTimeout(() => trackPageView(pathname), 700);
    return () => clearTimeout(timer);
  }, [pathname]);
  return null;
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
        <Route path="/verify-email" element={<RequireSupabase><VerifyEmailPage /></RequireSupabase>} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
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
        <Route
          path="/admin/support-requests"
          element={
            <Protected requireAdmin>
              <AdminSupportRequestsPage />
            </Protected>
          }
        />
        <Route
          path="/admin/support-requests/:requestId"
          element={
            <Protected requireAdmin>
              <AdminRequestDetailPage />
            </Protected>
          }
        />

        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        {/* One EventAccessProvider shared by every /events/:eventId/* organizer
            page (via EventAccessLayout + Outlet) instead of each page
            mounting its own and re-fetching the event/staff row on every
            sidebar click — see EventAccessContext.jsx for the fetch itself. */}
        <Route path="/events/:eventId" element={<EventAccessLayout />}>
          <Route index element={<EventIndexRedirect />} />
          <Route path="edit" element={<RequireEventPermission permission="edit_event"><EventEditorPage /></RequireEventPermission>} />
          <Route path="overview" element={<RequireEventPermission permission="overview"><OverviewPage /></RequireEventPermission>} />
          <Route path="manage" element={<RequireEventPermission permission="registrations"><RegistrationsPage /></RequireEventPermission>} />
          <Route path="checkin" element={<RequireEventPermission permission="checkin"><CheckInManagePage /></RequireEventPermission>} />
          <Route path="brackets" element={<RequireEventPermission permission="brackets"><BracketsPage /></RequireEventPermission>} />
          <Route path="matchlist" element={<RequireEventPermission permission="matchlist"><MatchListPage /></RequireEventPermission>} />
          <Route path="preview" element={<RequireEventPermission permission="preview"><PreviewSetupPage /></RequireEventPermission>} />
          <Route path="umpires" element={<RequireEventPermission permission="umpires"><UmpiresPage /></RequireEventPermission>} />
          <Route path="sponsors" element={<RequireEventPermission permission="sponsors"><SponsorsPage /></RequireEventPermission>} />
          <Route path="accounting" element={<RequireEventPermission permission="accounting"><AccountingPage /></RequireEventPermission>} />
          <Route path="settings" element={<RequireEventPermission permission="settings"><SettingsPage /></RequireEventPermission>} />
          <Route path="team" element={<RequireEventPermission ownerOnly><TeamPage /></RequireEventPermission>} />
        </Route>
        {/* Public on purpose: players land here straight from the check-in
            flow with no session at all, and it's spectator-facing anyway (no
            PII — same data already shown on a venue TV). Stays outside
            EventAccessLayout — no auth/access check at all. Safe as a
            top-level sibling: the nested "preview" child route above has no
            splat, so it can't swallow /events/:eventId/preview/:categoryId. */}
        <Route path="/events/:eventId/preview/:categoryId" element={<RequireSupabase><PreviewDisplayPage /></RequireSupabase>} />

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
          <AnalyticsPageViews />
          <ServiceWorkerUpdatePrompt />
          <AppErrorBoundary>
            <AppRoutes />
          </AppErrorBoundary>
          <ToastStack />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
