import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../ui/Logo';
import { ACCOUNT_TYPE_STYLES } from '../ui/AccountTypeCard';

export default function OrganizerLayout({ children, backTo, backLabel }) {
  const { user, signOut, isAdmin, accountType } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    pushToast('Signed out', 'success');
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2">
              <Logo size={30} />
              <span className="font-display text-sm font-bold text-ink-900">DinkManager</span>
            </Link>
            {accountType && (
              <span
                className={`hidden rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold tracking-wide sm:inline-block ${
                  (ACCOUNT_TYPE_STYLES[accountType] || ACCOUNT_TYPE_STYLES.organizer).tone
                }`}
              >
                {(ACCOUNT_TYPE_STYLES[accountType] || ACCOUNT_TYPE_STYLES.organizer).label}
              </span>
            )}
            {backTo && (
              <Link to={backTo} className="text-xs font-semibold text-ink-500 hover:text-ink-800">
                ← {backLabel || 'Back'}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ink-500 sm:inline">{user?.email}</span>
            {isAdmin && (
              <Link
                to="/admin/customers"
                title="Customer logins"
                className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100"
              >
                <Users size={13} /> <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
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
