import { useEffect, useState } from 'react';
import { AlertTriangle, LayoutGrid, RotateCcw } from 'lucide-react';
import { useTournamentDispatch, useTournamentState } from '../context/TournamentContext';
import { useConfirm } from '../context/ConfirmContext';

export default function SettingsPage() {
  const { tournamentSettings } = useTournamentState();
  const dispatch = useTournamentDispatch();
  const confirm = useConfirm();
  const [numCourts, setNumCourts] = useState(tournamentSettings.numCourts);
  const [duration, setDuration] = useState(tournamentSettings.matchDurationMinutes);

  useEffect(() => {
    setNumCourts(tournamentSettings.numCourts);
    setDuration(tournamentSettings.matchDurationMinutes);
  }, [tournamentSettings]);

  const save = () => {
    let n = parseInt(numCourts, 10);
    let d = parseInt(duration, 10);
    if (Number.isNaN(n) || n < 1) n = 1;
    if (Number.isNaN(d) || d < 1) d = 1;
    dispatch({ type: 'UPDATE_SETTINGS', numCourts: n, matchDurationMinutes: d }, { message: 'Court settings updated' });
  };

  const resetAll = async () => {
    const ok = await confirm({
      title: 'Reset all tournament data?',
      message: 'This clears every stat, match history, and live court match for every bracket. This cannot be undone.',
      confirmLabel: 'Reset everything',
    });
    if (ok) dispatch({ type: 'RESET_ALL' });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <LayoutGrid size={17} strokeWidth={2.3} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Court settings</h2>
            <p className="text-xs text-ink-500">Controls court auto-assignment and remaining-time estimates.</p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Number of courts available</label>
            <input
              type="number"
              min={1}
              max={30}
              value={numCourts}
              onChange={(e) => setNumCourts(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Average match duration (minutes)</label>
            <input
              type="number"
              min={1}
              max={180}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
            />
          </div>
          <button onClick={save} className="self-start rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">
            Save settings
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle size={17} strokeWidth={2.3} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-rose-900">Danger zone</h2>
            <p className="text-xs text-rose-700/80">Irreversible actions — use with care.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-ink-800">Reset all tournament data</div>
            <div className="text-xs text-ink-500">Clears every stat, match history, and live court match for every bracket.</div>
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
          >
            <RotateCcw size={13} /> Reset all data
          </button>
        </div>
      </div>
    </div>
  );
}
