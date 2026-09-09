import { useState } from 'react';
import { History, MapPin, Pencil, Trash2, Gavel, Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import { useConfirm } from '../../context/ConfirmContext';
import { useTournamentDispatch, useTournamentState } from '../../context/TournamentContext';

function HistoryRow({ match, matchIdx, catIdx, bracketIdx }) {
  const dispatch = useTournamentDispatch();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [scoreA, setScoreA] = useState(match.scoreA);
  const [scoreB, setScoreB] = useState(match.scoreB);

  const saveEdit = () => {
    dispatch({ type: 'EDIT_HISTORY_MATCH', catIdx, bracketIdx, matchIdx, scoreA: parseInt(scoreA, 10), scoreB: parseInt(scoreB, 10) });
    setEditing(false);
  };

  const deleteMatch = async () => {
    const ok = await confirm({
      title: 'Delete this match?',
      message: `${match.teamA} vs ${match.teamB} (${match.scoreA}-${match.scoreB}) will be removed and stats recalculated.`,
      confirmLabel: 'Delete match',
    });
    if (ok) dispatch({ type: 'DELETE_HISTORY_MATCH', catIdx, bracketIdx, matchIdx });
  };

  return (
    <div className="rounded-2xl border-l-4 border-brand-500 bg-ink-50/70 px-4 py-3">
      <div className="text-sm font-semibold text-ink-800">
        {match.teamA} <span className="font-normal text-ink-400">vs</span> {match.teamB}
      </div>

      {editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-ink-500">
            Score A:{' '}
            <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className="ml-1 w-16 rounded-lg border border-ink-200 px-2 py-1 text-sm" />
          </label>
          <label className="text-xs font-semibold text-ink-500">
            Score B:{' '}
            <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className="ml-1 w-16 rounded-lg border border-ink-200 px-2 py-1 text-sm" />
          </label>
          <button onClick={saveEdit} className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-brand-700">
            Save
          </button>
          <button onClick={() => { setEditing(false); setScoreA(match.scoreA); setScoreB(match.scoreB); }} className="rounded-full bg-ink-200 px-3 py-1 text-xs font-bold text-ink-600 transition hover:bg-ink-300">
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono font-bold text-ink-700">
              {match.scoreA} – {match.scoreB}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-700">
              <Trophy size={12} /> {match.winner}
            </span>
            {match.court && (
              <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                <MapPin size={10} /> Court {match.court}
                {match.durationMinutes ? ` · ${match.durationMinutes}m` : ''}
              </span>
            )}
            {match.umpire && (
              <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                <Gavel size={10} /> {match.umpire}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-ink-400">{match.timestamp}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-sky-700 shadow-sm ring-1 ring-sky-100 transition hover:bg-sky-50">
              <Pencil size={11} /> Edit
            </button>
            <button onClick={deleteMatch} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50">
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function HistoryModal({ open, onClose, target }) {
  const { categoriesData } = useTournamentState();
  if (!target) return null;
  const { catIdx, bracketIdx } = target;
  const category = categoriesData[catIdx];
  const bracket = category?.brackets[bracketIdx];
  if (!bracket) return null;

  return (
    <Modal open={open} onClose={onClose} title={`${category.name} · Bracket ${bracket.letter}`} icon={History} maxWidth="max-w-2xl">
      {bracket.matchHistory.length === 0 ? (
        <div className="rounded-2xl bg-ink-50 py-14 text-center text-sm text-ink-400">🏓 No matches recorded yet.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {bracket.matchHistory.map((m, idx) => (
            <HistoryRow key={idx} match={m} matchIdx={idx} catIdx={catIdx} bracketIdx={bracketIdx} />
          ))}
        </div>
      )}
    </Modal>
  );
}
