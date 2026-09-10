import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ExpiredAccessPage from '../../pages/auth/ExpiredAccessPage';

export default function ProtectedRoute({ children, role = 'organizer', requireAdmin = false }) {
  const { user, loading, profile, profileLoading, needsMfaChallenge, isExpired, isAdmin } = useAuth();
  const location = useLocation();

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] text-sm text-ink-400">Loading…</div>
    );
  }

  const loginPath = role === 'player' ? '/player/login' : '/login';

  if (!user) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // A password (or OAuth) sign-in succeeded but the account has 2FA enabled
  // and the pending code challenge hasn't been verified this session yet —
  // treat that the same as "not logged in" until it's completed.
  if (needsMfaChallenge) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Trial account past its access_expires_at: signed in, but every protected
  // route (including /account) renders the expired screen instead of the
  // page — data stays intact in case the customer is later extended.
  if (isExpired) {
    return <ExpiredAccessPage />;
  }

  // role="any" is for pages shared by both roles (e.g. /account) — skip the
  // role match entirely rather than bouncing a player out of their own page.
  if (role !== 'any') {
    const effectiveRole = profile?.role ?? 'organizer';
    if (effectiveRole !== role) {
      const ownHome = effectiveRole === 'player' ? '/player/dashboard' : '/dashboard';
      return <Navigate to={ownHome} replace />;
    }
  }

  // Checked here rather than in a separate wrapper component so it shares
  // the loading gate above — a wrapper reading isAdmin from useAuth() on
  // its own render can catch the one-tick window right after sign-in where
  // profileLoading has flipped back to false but profile hasn't been
  // re-fetched yet, misreading a real admin as not-admin and navigating
  // away before the correct value ever arrives.
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
