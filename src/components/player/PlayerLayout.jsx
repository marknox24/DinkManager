import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../ui/Logo';

export default function PlayerLayout({ children }) {
  const { user, signOut } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    pushToast('Signed out', 'success');
    navigate('/player/login');
  };

  return (
    <div className="min-h-screen bg-[#f3f6f8]">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
          <Link to="/player/dashboard" className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-display text-sm font-bold text-ink-900">DinkManager</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ink-500 sm:inline">{user?.email}</span>
            <Link
              to="/account"
              title="Account & security"
              className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100"
            >
              <ShieldCheck size={13} /> <span className="hidden sm:inline">Account</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main key={location.pathname} className="animate-page-in mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
