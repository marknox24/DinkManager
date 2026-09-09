import { useState } from 'react';
import { Gavel, Plus, Radio, Trash2 } from 'lucide-react';
import { useTournamentDispatch, useTournamentState } from '../context/TournamentContext';
import { isUmpireBusy } from '../utils/stats';

export default function UmpiresPage() {
  const { umpires, liveMatches } = useTournamentState();
  const dispatch = useTournamentDispatch();
  const [name, setName] = useState('');

  const addUmpire = () => {
    dispatch({ type: 'ADD_UMPIRE', name });
    setName('');
  };

  const busyCount = umpires.filter((u) => isUmpireBusy(liveMatches, u.id)).length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Gavel size={17} strokeWidth={2.3} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Officials on hand</h2>
            <p className="text-xs text-ink-500">
              {umpires.length} total &middot; {busyCount} officiating now
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addUmpire()}
            placeholder="Umpire name"
            className="flex-1 rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            onClick={addUmpire}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus size={15} /> Add
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {umpires.length === 0 && <div className="rounded-2xl bg-ink-50 py-10 text-center text-sm text-ink-400">No umpires added yet.</div>}
          {umpires.map((u) => {
            const busy = isUmpireBusy(liveMatches, u.id);
            return (
              <div key={u.id} className={`flex items-center justify-between rounded-2xl px-4 py-2.5 ${busy ? 'bg-amber-50' : 'bg-ink-50'}`}>
                <div>
                  <div className="text-sm font-semibold text-ink-800">{u.name}</div>
                  {busy && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-amber-700">
                      <Radio size={10} className="animate-pulse-soft" /> Officiating now
                    </div>
                  )}
                </div>
                <button
                  disabled={busy}
                  onClick={() => dispatch({ type: 'REMOVE_UMPIRE', id: u.id })}
                  title={busy ? 'Currently officiating a match' : ''}
                  className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-ink-300 disabled:ring-ink-100"
                >
                  <Trash2 size={11} /> Remove
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-ink-400">
          A match can only start once a free umpire is assigned. Umpires officiating a match can&apos;t be removed.
        </p>
      </div>
    </div>
  );
}
