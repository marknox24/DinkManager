import { useState } from 'react';
import { Cloud, CloudUpload, Menu } from 'lucide-react';
import { useTournamentDispatch, useTournamentState } from '../../context/TournamentContext';

const VIEW_TITLES = {
  overview: { title: 'Overview', subtitle: 'Live courts and tournament-wide stats' },
  tournament: { title: 'Tournament', subtitle: 'Manage categories, brackets and matches' },
  umpires: { title: 'Umpires', subtitle: 'Add, remove and track who is officiating' },
  settings: { title: 'Settings', subtitle: 'Courts, match duration and danger zone' },
};

export default function TopBar({ activeView, onOpenMobileNav }) {
  const state = useTournamentState();
  const dispatch = useTournamentDispatch();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(state.tournamentName);

  const commitName = () => {
    const trimmed = draftName.trim();
    dispatch({ type: 'SET_TOURNAMENT_NAME', name: trimmed || state.tournamentName }, { silent: true });
    setEditingName(false);
  };

  const meta = VIEW_TITLES[activeView] || VIEW_TITLES.tournament;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 px-4 py-3.5 backdrop-blur-md sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onOpenMobileNav} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-200 text-ink-600 lg:hidden">
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold leading-tight text-ink-900 sm:text-xl">{meta.title}</h1>
            <p className="truncate text-xs text-ink-500">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <SaveIndicator status={state.saveStatus} />
          {editingName ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') {
                  setDraftName(state.tournamentName);
                  setEditingName(false);
                }
              }}
              className="hidden w-56 rounded-lg border border-brand-300 bg-brand-50/60 px-2.5 py-1.5 text-sm font-semibold text-ink-900 outline-none focus:ring-2 focus:ring-brand-400 sm:block"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              title="Click to rename tournament"
              className="hidden max-w-[220px] truncate rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-100 sm:block"
            >
              {state.tournamentName}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function SaveIndicator({ status }) {
  const config = {
    idle: { icon: Cloud, text: 'Saved', className: 'text-ink-400' },
    saving: { icon: CloudUpload, text: 'Saving…', className: 'text-amber-600' },
    saved: { icon: Cloud, text: 'Saved', className: 'text-brand-600' },
    error: { icon: Cloud, text: 'Save failed', className: 'text-rose-600' },
  }[status] || { icon: Cloud, text: 'Saved', className: 'text-ink-400' };
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1.5 text-xs font-medium ${config.className}`}>
      <Icon size={13} className={status === 'saving' ? 'animate-pulse-soft' : ''} />
      <span className="hidden sm:inline">{config.text}</span>
    </div>
  );
}
