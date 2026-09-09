import { Download, Gavel, LayoutGrid, MonitorPlay, Settings, Trophy, X } from 'lucide-react';
import { exportTournamentToExcel } from '../../utils/excel';
import { useTournamentState } from '../../context/TournamentContext';
import Logo from '../ui/Logo';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'tournament', label: 'Tournament', icon: Trophy },
  { id: 'umpires', label: 'Umpires', icon: Gavel },
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

export default function Sidebar({ activeView, onNavigate, onOpenPresentation, mobileOpen, onCloseMobile }) {
  const { categoriesData, tournamentName } = useTournamentState();

  const content = (
    <div className="flex h-full w-64 shrink-0 flex-col bg-ink-950 px-4 py-5">
      <div className="mb-6 flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <Logo size={34} />
          <div className="leading-tight">
            <div className="font-display text-base font-bold text-white">DinkManager</div>
            <div className="text-[10px] font-medium text-ink-400">Tournament Manager</div>
          </div>
        </div>
        <button onClick={onCloseMobile} className="rounded-lg p-1 text-ink-400 hover:bg-white/5 lg:hidden">
          <X size={18} />
        </button>
      </div>

      <div className="mb-5 rounded-xl bg-white/5 px-3 py-2.5">
        <div className="truncate text-xs font-semibold text-white">{tournamentName}</div>
        <div className="mt-0.5 text-[10px] text-ink-400">{categoriesData.length} categories</div>
      </div>

      <nav className="flex flex-col gap-1">
        <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wide text-ink-500">Manage</div>
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} active={activeView === item.id} onClick={() => onNavigate(item.id)} />
        ))}
      </nav>

      <div className="mt-6 flex flex-col gap-1">
        <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wide text-ink-500">Actions</div>
        <button
          onClick={onOpenPresentation}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-300 transition hover:bg-white/5 hover:text-white"
        >
          <MonitorPlay size={17} strokeWidth={2.3} />
          Presentation mode
        </button>
        <button
          onClick={() => exportTournamentToExcel(categoriesData, tournamentName)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-300 transition hover:bg-white/5 hover:text-white"
        >
          <Download size={17} strokeWidth={2.3} />
          Export Excel
        </button>
      </div>

      <div className="mt-auto pt-4 text-center text-[10px] text-ink-600">DinkManager &middot; Beta</div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-[8000] flex lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={onCloseMobile} />
          <div className="relative animate-modal-in">{content}</div>
        </div>
      )}
    </>
  );
}
