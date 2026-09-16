import { Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './components/ui/ConfirmProvider';
import ToastStack from './components/ui/ToastStack';
import ProtectedRoute from './components/auth/ProtectedRoute';
import EventRoute from './components/auth/EventRoute';
import SetupRequiredPage from './pages/SetupRequiredPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import PlayerLoginPage from './pages/player/PlayerLoginPage';
import PlayerSignupPage from './pages/player/PlayerSignupPage';
import PlayerDashboardPage from './pages/player/PlayerDashboardPage';
import AccountSettingsPage from './pages/account/AccountSettingsPage';
import AdminCustomersPage from './pages/admin/AdminCustomersPage';
import DashboardPage from './pages/organizer/DashboardPage';
import EventEditorPage from './pages/organizer/EventEditorPage';
import OverviewPage from './pages/organizer/event/OverviewPage';
import RegistrationsPage from './pages/organizer/event/RegistrationsPage';
import CheckInManagePage from './pages/organizer/event/CheckInManagePage';
import BracketsPage from './pages/organizer/event/BracketsPage';
import MatchListPage from './pages/organizer/event/MatchListPage';
import PreviewSetupPage from './pages/organizer/event/PreviewSetupPage';
import PreviewDisplayPage from './pages/organizer/event/PreviewDisplayPage';
import UmpiresPage from './pages/organizer/event/UmpiresPage';
import TeamPage from './pages/organizer/event/TeamPage';
import SettingsPage from './pages/organizer/event/SettingsPage';
import SponsorsPage from './pages/organizer/event/SponsorsPage';
import AccountingPage from './pages/organizer/event/AccountingPage';
import PublicEventPage from './pages/public/PublicEventPage';
import RegisterPage from './pages/public/RegisterPage';
import CheckInPage from './pages/public/CheckInPage';
import DiscoverTournamentsPage from './pages/public/DiscoverTournamentsPage';
import SubscribePage from './pages/public/SubscribePage';
import DinkManagerDemoPage from './pages/legacy/DinkManagerDemoPage';

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
      <Route path="/events/:eventId/matchlist" element={<EventRoute permission="matchlist"><MatchListPage /></EventRoute>} />
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
