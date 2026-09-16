import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, LogOut, ShieldCheck, Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../ui/Logo';

// Deliberately minimal — no organizer/tournament-management nav. Players
// never render OrganizerLayout at all (separate component, separate route
// tree), so there's no sidebar to hide here; this is the whole player nav.
// "My Tournaments" isn't a separate pill: it's the dashboard's own primary
// content (see the page's own heading), so a second pill pointing at the
// same route would just show two entries active at once for no benefit.
const NAV_ITEMS = [
  { to: '/player/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/tournaments', label: 'Available Tournaments', icon: Trophy },
];

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
              title="Profile / Account"
              className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100"
            >
              <ShieldCheck size={13} /> <span className="hidden sm:inline">Profile</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto mt-3 flex max-w-[1200px] gap-2 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === (item.match || item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  active ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                }`}
              >
                <item.icon size={13} /> {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main key={location.pathname} className="animate-page-in mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
