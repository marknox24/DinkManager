import { useState } from 'react';
import { Pause, Play, Radio, Square, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { liveElapsedSeconds, teamLabel } from '../../utils/match';
import { formatElapsed } from '../../utils/format';
import { matchLevelLabel } from '../../data/playoffApi';

const scoreInputClass =
  'w-11 rounded-lg border border-ink-200 py-1 text-center text-xs font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

// Shared live-match card — used on both the Brackets page and the Match List
// page so pause/resume/cancel/finish behavior only lives in one place. Kept
// compact so 3-4 fit per row without pushing the schedule far down the page.
export default function LiveMatchCard({ match, now, categoryName, onTogglePause, onCancel, onFinish }) {
  const { pushToast } = useToast();
  const [isFinishing, setIsFinishing] = useState(false);
  const [scoreA, setScoreA] = useState('11');
  const [scoreB, setScoreB] = useState('7');
  const [saving, setSaving] = useState(false);

  const elapsed = liveElapsedSeconds(match, now);
  const isPaused = !match.running_since;

  const openFinish = () => {
    setIsFinishing(true);
    setScoreA('11');
    setScoreB('7');
  };

  const handleSave = async () => {
    const sA = parseInt(scoreA, 10);
    const sB = parseInt(scoreB, 10);
    if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) {
      pushToast('Enter valid, non-negative scores', 'error');
      return;
    }
    if (sA === sB) {
      pushToast('Ties are not allowed', 'error');
      return;
    }
    setSaving(true);
    try {
      await onFinish(match, sA, sB);
      setIsFinishing(false);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white p-2.5 shadow-sm transition ${
        isPaused ? 'border-ink-200' : 'border-brand-300'
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${isPaused ? 'bg-ink-300' : 'bg-brand-600'}`} />

      <div className="mt-1 flex items-center justify-between gap-1.5">
        <span className="truncate text-[10px] font-bold text-brand-700">
          {categoryName}: {matchLevelLabel(match)}
        </span>
        <span
          className={`flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${
            isPaused ? 'bg-ink-100 text-ink-500' : 'bg-brand-100 text-brand-700'
          }`}
        >
          <Radio size={8} className={isPaused ? '' : 'animate-pulse'} /> {isPaused ? 'PAUSED' : 'LIVE'}
        </span>
      </div>

      <div className="mt-1.5 text-center text-[11px] font-bold leading-snug text-ink-900">
        {teamLabel(match.team_a)} <span className="font-medium text-ink-400">vs</span> {teamLabel(match.team_b)}
      </div>
      <div className="mt-0.5 truncate text-center text-[10px] text-ink-400">
        {match.court ? `Court ${match.court}` : 'Court —'}
        {match.umpire_name ? ` · ${match.umpire_name}` : ''}
      </div>

      <div
        className={`mt-1.5 rounded-lg py-1 text-center font-mono text-lg font-black tabular-nums ${
          isPaused ? 'bg-ink-50 text-ink-500' : 'bg-brand-50 text-brand-700'
        }`}
      >
        {formatElapsed(elapsed)}
      </div>

      {isFinishing && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className={scoreInputClass} />
          <span className="text-[10px] font-bold text-ink-300">–</span>
          <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className={scoreInputClass} />
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-1.5">
        {isFinishing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-ink-900 px-2 py-1.5 text-[11px] font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setIsFinishing(false)}
              className="rounded-lg border border-ink-200 px-2 py-1.5 text-[11px] font-bold text-ink-500 transition hover:bg-ink-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onTogglePause(match)}
              title={isPaused ? 'Resume' : 'Pause'}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                isPaused ? 'bg-brand-100 text-brand-700 hover:bg-brand-200' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {isPaused ? <Play size={12} /> : <Pause size={12} />}
            </button>
            <button
              onClick={() => onCancel(match)}
              title="Cancel match"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
            >
              <X size={12} />
            </button>
            <button
              onClick={openFinish}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 px-2 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              <Square size={10} /> Finish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
