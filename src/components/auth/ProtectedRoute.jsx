import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, role = 'organizer' }) {
  const { user, loading, profile, profileLoading, needsMfaChallenge } = useAuth();
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

  // role="any" is for pages shared by both roles (e.g. /account) — skip the
  // role match entirely rather than bouncing a player out of their own page.
  if (role !== 'any') {
    const effectiveRole = profile?.role ?? 'organizer';
    if (effectiveRole !== role) {
      const ownHome = effectiveRole === 'player' ? '/player/dashboard' : '/dashboard';
      return <Navigate to={ownHome} replace />;
    }
  }

  return children;
}
