import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Award, Gavel, LayoutGrid, ListOrdered, LogOut, Menu, MonitorPlay, QrCode, Settings, Shuffle, Trophy, UserCog, Users, Wallet, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useEventAccess } from '../../context/EventAccessContext';
import { permissionForNavId } from '../../data/permissions';
import Logo from '../ui/Logo';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'manage', label: 'Registrations', icon: UserCog },
  { id: 'checkin', label: 'Check-in', icon: QrCode },
  { id: 'brackets', label: 'Brackets', icon: Shuffle },
  { id: 'matchlist', label: 'Match List', icon: ListOrdered },
  { id: 'preview', label: 'Preview Screen', icon: MonitorPlay },
  { id: 'sponsors', label: 'Sponsors', icon: Award },
  { id: 'accounting', label: 'Accounting', icon: Wallet },
  { id: 'umpires', label: 'Umpires', icon: Gavel },
  { id: 'team', label: 'Team', icon: Users, ownerOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        active ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' : 'text-ink-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={17} strokeWidth={2.3} />
      {item.label}
    </button>
  );
}

export default function EventWorkspaceLayout({ eventName, children }) {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { pushToast } = useToast();
  const { isOwner, can, firstAllowedNavId } = useEventAccess();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => (item.ownerOnly ? isOwner : can(permissionForNavId(item.id))));
  const activeId = NAV_ITEMS.find((item) => location.pathname.endsWith(`/${item.id}`))?.id || firstAllowedNavId || 'manage';

  const goTo = (id) => {
    navigate(`/events/${eventId}/${id}`);
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    pushToast('Signed out', 'success');
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex h-full w-64 shrink-0 flex-col bg-ink-950 px-4 py-5">
      <div className="mb-6 flex items-center justify-between px-1">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <Logo size={34} />
          <div className="leading-tight">
            <div className="font-display text-base font-bold text-white">DinkManager</div>
            <div className="text-[10px] font-medium text-ink-400">Tournament Manager</div>
          </div>
        </Link>
        <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-ink-400 hover:bg-white/5 lg:hidden">
          <X size={18} />
        </button>
      </div>

      <div className="mb-5 rounded-xl bg-white/5 px-3 py-2.5">
        <div className="truncate text-xs font-semibold text-white">{eventName || 'Loading…'}</div>
        {can('edit_event') && (
          <Link to={`/events/${eventId}/edit`} className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-400 hover:text-brand-300">
            <Trophy size={10} /> Edit event details
          </Link>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wide text-ink-500">Manage</div>
        {visibleItems.map((item) => (
          <NavButton key={item.id} item={item} active={activeId === item.id} onClick={() => goTo(item.id)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="truncate text-[10px] text-ink-500">{user?.email}</div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-ink-400 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f3f6f8]">
      <div className="hidden lg:block">{sidebarContent}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-[8000] flex lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="relative animate-modal-in">{sidebarContent}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-100 bg-white/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 text-ink-600">
            <Menu size={18} />
          </button>
          <span className="truncate font-display text-sm font-bold text-ink-900">{eventName}</span>
        </header>
        <main key={location.pathname} className="animate-page-in mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
