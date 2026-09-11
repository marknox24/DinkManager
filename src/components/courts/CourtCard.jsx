import { useState } from 'react';
import { Ban, CheckCircle2, Flag, Gavel, Pause, Pencil, Play, Radio, X } from 'lucide-react';
import { useTournamentDispatch, useTournamentState, liveMatchElapsedMs } from '../../context/TournamentContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useNow } from '../../hooks/useNow';
import { formatElapsed } from '../../utils/format';
import { isUmpireBusy } from '../../utils/stats';
import Select from '../ui/Select';

export default function CourtCard({ courtNumber, liveMatch }) {
  if (!liveMatch) return <IdleCourtCard courtNumber={courtNumber} />;
  return <BusyCourtCard courtNumber={courtNumber} liveMatch={liveMatch} />;
}

function IdleCourtCard({ courtNumber }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-white/60 px-4 py-7 text-center">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Court {courtNumber}</span>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-400">
        <CheckCircle2 size={15} className="text-brand-400" /> Available
      </span>
    </div>
  );
}

function BusyCourtCard({ courtNumber, liveMatch }) {
  const now = useNow(1000);
  const { tournamentSettings, umpires, liveMatches } = useTournamentState();
  const dispatch = useTournamentDispatch();
  const confirm = useConfirm();
  const [editingUmpire, setEditingUmpire] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [scoreA, setScoreA] = useState('11');
  const [scoreB, setScoreB] = useState('7');
  const [umpireChoice, setUmpireChoice] = useState(liveMatch.umpireId);

  const paused = !!liveMatch.isPaused;
  const estSec = tournamentSettings.matchDurationMinutes * 60;
  const elapsedSec = Math.floor(liveMatchElapsedMs(liveMatch, now) / 1000);
  const overtime = elapsedSec > estSec;
  const pct = Math.min(100, Math.round((elapsedSec / estSec) * 100));

  const reassignOptions = umpires.filter((u) => u.id === liveMatch.umpireId || !isUmpireBusy(liveMatches, u.id));

  const confirmReassign = () => {
    if (umpireChoice == null) return;
    dispatch({ type: 'REASSIGN_UMPIRE', liveId: liveMatch.id, umpireId: umpireChoice }, { silent: true });
    setEditingUmpire(false);
  };

  const confirmFinish = () => {
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    dispatch({ type: 'FINISH_MATCH', liveId: liveMatch.id, scoreA: a, scoreB: b });
    setFinishing(false);
  };

  const togglePause = () => {
    dispatch({ type: paused ? 'RESUME_MATCH' : 'PAUSE_MATCH', liveId: liveMatch.id });
  };

  const cancelMatch = async () => {
    const ok = await confirm({
      title: 'Cancel this match?',
      message: `${liveMatch.teamALabel} vs ${liveMatch.teamBLabel} will be removed from Court ${courtNumber} with no score recorded. Court and umpire become free again.`,
      confirmLabel: 'Cancel match',
    });
    if (ok) dispatch({ type: 'CANCEL_MATCH', liveId: liveMatch.id });
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition-colors ${
        paused ? 'border-ink-300 bg-gradient-to-b from-ink-100/70 to-white' : overtime ? 'border-rose-300 bg-gradient-to-b from-rose-50/70 to-white' : 'border-brand-300 bg-gradient-to-b from-brand-50/60 to-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Court {courtNumber}</span>
        {paused ? (
          <span className="rounded-full bg-ink-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-600">Paused</span>
        ) : (
          <Radio size={12} className={overtime ? 'text-rose-500 animate-pulse-soft' : 'text-brand-500 animate-pulse-soft'} />
        )}
      </div>

      <div className="mt-2 text-center text-sm font-bold leading-snug text-ink-900">
        {liveMatch.teamALabel}
        <div className="my-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">vs</div>
        {liveMatch.teamBLabel}
      </div>
      <div className="mt-1 text-center text-[11px] text-ink-500">
        {liveMatch.categoryName} &middot; Bracket {liveMatch.bracketLetter}
      </div>

      {editingUmpire ? (
        <div className="mt-2 flex items-center gap-1.5">
          <Select
            value={umpireChoice ?? ''}
            onChange={(e) => setUmpireChoice(parseInt(e.target.value, 10))}
            className="w-full rounded-xl border border-ink-200 pl-2 py-1.5 text-xs"
            wrapperClassName="flex-1"
            dense
          >
            {reassignOptions.length === 0 && <option value="">No other umpires free</option>}
            {reassignOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <button onClick={confirmReassign} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <CheckCircle2 size={14} />
          </button>
          <button onClick={() => setEditingUmpire(false)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-200 text-ink-600">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setUmpireChoice(liveMatch.umpireId);
            setEditingUmpire(true);
          }}
          className="mt-2 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Gavel size={12} /> {liveMatch.umpireName || 'Unassigned'}
          </span>
          <Pencil size={11} />
        </button>
      )}

      <div className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-ink-400">
        {paused ? 'Paused at' : 'Time consumed'}
      </div>
      <div className={`text-center font-mono text-2xl font-extrabold ${paused ? 'text-ink-500' : overtime ? 'text-rose-600' : 'text-brand-700'}`}>
        {formatElapsed(elapsedSec)}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${paused ? 'bg-ink-300' : overtime ? 'bg-rose-500' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mb-3 mt-1.5 text-center text-[11px] text-ink-500">
        {paused ? 'Timer paused — resume when play continues' : overtime ? `⚠ ${formatElapsed(elapsedSec - estSec)} over the ${tournamentSettings.matchDurationMinutes}m avg` : `vs. ${tournamentSettings.matchDurationMinutes}m avg match`}
      </div>

      {finishing ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              placeholder="Score A"
              className="w-full rounded-xl border border-ink-200 px-2 py-1.5 text-center text-sm font-semibold"
            />
            <input
              type="number"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              placeholder="Score B"
              className="w-full rounded-xl border border-ink-200 px-2 py-1.5 text-center text-sm font-semibold"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={confirmFinish} className="flex-1 rounded-xl bg-brand-600 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700">
              Confirm
            </button>
            <button onClick={() => setFinishing(false)} className="flex-1 rounded-xl bg-ink-200 py-1.5 text-xs font-bold text-ink-600 transition hover:bg-ink-300">
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={togglePause}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition ${
                paused ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={cancelMatch}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-1.5 text-xs font-bold text-rose-600 shadow-sm ring-1 ring-rose-200 transition hover:bg-rose-50"
            >
              <Ban size={13} /> Cancel
            </button>
          </div>
          <button
            onClick={() => setFinishing(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700"
          >
            <Flag size={13} /> Finish &amp; record score
          </button>
        </div>
      )}
    </div>
  );
}
