import { Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './components/ui/ConfirmProvider';
import ToastStack from './components/ui/ToastStack';
import ProtectedRoute from './components/auth/ProtectedRoute';
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
import DashboardPage from './pages/organizer/DashboardPage';
import EventEditorPage from './pages/organizer/EventEditorPage';
import OverviewPage from './pages/organizer/event/OverviewPage';
import RegistrationsPage from './pages/organizer/event/RegistrationsPage';
import BracketsPage from './pages/organizer/event/BracketsPage';
import MatchListPage from './pages/organizer/event/MatchListPage';
import PreviewSetupPage from './pages/organizer/event/PreviewSetupPage';
import PreviewDisplayPage from './pages/organizer/event/PreviewDisplayPage';
import UmpiresPage from './pages/organizer/event/UmpiresPage';
import SettingsPage from './pages/organizer/event/SettingsPage';
import PublicEventPage from './pages/public/PublicEventPage';
import RegisterPage from './pages/public/RegisterPage';
import DinkManagerDemoPage from './pages/legacy/DinkManagerDemoPage';

function RequireSupabase({ children }) {
  return isSupabaseConfigured ? children : <SetupRequiredPage />;
}

function Protected({ children, role }) {
  return (
    <RequireSupabase>
      <ProtectedRoute role={role}>{children}</ProtectedRoute>
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

      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/events/:eventId/edit" element={<Protected><EventEditorPage /></Protected>} />
      <Route path="/events/:eventId/overview" element={<Protected><OverviewPage /></Protected>} />
      <Route path="/events/:eventId/manage" element={<Protected><RegistrationsPage /></Protected>} />
      <Route path="/events/:eventId/brackets" element={<Protected><BracketsPage /></Protected>} />
      <Route path="/events/:eventId/matchlist" element={<Protected><MatchListPage /></Protected>} />
      <Route path="/events/:eventId/preview" element={<Protected><PreviewSetupPage /></Protected>} />
      <Route path="/events/:eventId/preview/:categoryId" element={<Protected><PreviewDisplayPage /></Protected>} />
      <Route path="/events/:eventId/umpires" element={<Protected><UmpiresPage /></Protected>} />
      <Route path="/events/:eventId/settings" element={<Protected><SettingsPage /></Protected>} />

      <Route path="/e/:slug" element={<RequireSupabase><PublicEventPage /></RequireSupabase>} />
      <Route path="/e/:slug/register" element={<RequireSupabase><RegisterPage /></RequireSupabase>} />

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
