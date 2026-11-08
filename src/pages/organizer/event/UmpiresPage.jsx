import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Gavel, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createUmpire, deleteUmpire, getUmpireWorkload, listCategories, listUmpires, updateUmpire } from '../../../data/eventsApi';
import { listLiveMatchesForEvent } from '../../../data/bracketsApi';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import { useOrganizerLiveSync } from '../../../hooks/useOrganizerLiveSync';
import { gamesLabel, umpireRotation, workloadFromMatches } from '../../../utils/umpireRotation';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';

function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white px-4 py-3.5 shadow-sm">
      <div className="font-display text-2xl font-bold tabular-nums text-ink-900">{value}</div>
      <div className="text-xs font-semibold text-ink-500">{label}</div>
    </div>
  );
}

function Chip({ tone, children }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>{children}</span>;
}

// The bar is the umpire's games as a share of the busiest umpire's, so the
// list reads as a picture of how evenly the work is spread.
function GamesBar({ row }) {
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200/70">
        <div className={`h-full rounded-full ${row.fewest ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: `${row.share * 100}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-bold tabular-nums text-ink-600">{gamesLabel(row.count)}</span>
    </div>
  );
}

export default function UmpiresPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const { event } = useEventAccess();
  const [umpires, setUmpires] = useState([]);
  const [categoryIds, setCategoryIds] = useState([]);
  // null while loading; failed when the counts can't be read at all, in which
  // case the page still manages the pool, just without them.
  const [workload, setWorkload] = useState(null);
  const [workloadFailed, setWorkloadFailed] = useState(false);
  const [liveMatches, setLiveMatches] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    listUmpires(eventId)
      .then(setUmpires)
      .catch((e) => pushToast(e.message, 'error'));
    listCategories(eventId)
      .then((cats) => setCategoryIds(cats.map((c) => c.id)))
      .catch(() => {});
  }, [eventId, pushToast]);

  const loadWorkload = useCallback(
    () =>
      Promise.allSettled([getUmpireWorkload(eventId), listLiveMatchesForEvent(eventId)]).then(([counts, live]) => {
        if (counts.status === 'fulfilled') {
          setWorkload(counts.value);
          setWorkloadFailed(false);
        } else {
          setWorkload((prev) => prev ?? []);
          setWorkloadFailed(true);
        }
        if (live.status === 'fulfilled') setLiveMatches(live.value);
      }),
    [eventId]
  );

  useEffect(() => {
    loadWorkload();
  }, [loadWorkload]);

  // Counts move as any organizer finishes a game, not just this one. The
  // check's rows already say who officiated what and who's on court, so a
  // change costs no further queries.
  useOrganizerLiveSync({
    categoryIds,
    paused: false,
    onChange: (rows) => {
      setWorkload(workloadFromMatches(rows));
      setWorkloadFailed(false);
      setLiveMatches(rows.filter((m) => m.status === 'in_progress'));
    },
  });

  const rotation = useMemo(() => umpireRotation(umpires, workload, liveMatches), [umpires, workload, liveMatches]);
  const showCounts = workload !== null && !workloadFailed;
  const { totals } = rotation;

  const addUmpire = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      pushToast('Enter an umpire name', 'error');
      return;
    }
    if (umpires.some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) {
      pushToast('That umpire is already on the list', 'error');
      return;
    }
    try {
      const u = await createUmpire(eventId, trimmed);
      setUmpires((prev) => [...prev, u]);
      setName('');
      pushToast(`${trimmed} added as umpire`, 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditingName(u.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (u) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      pushToast('Enter an umpire name', 'error');
      return;
    }
    if (trimmed === u.name) {
      cancelEdit();
      return;
    }
    if (umpires.some((x) => x.id !== u.id && x.name.toLowerCase() === trimmed.toLowerCase())) {
      pushToast('That umpire is already on the list', 'error');
      return;
    }
    try {
      const updated = await updateUmpire(u.id, trimmed);
      setUmpires((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      cancelEdit();
      pushToast('Umpire renamed', 'success');
      // Their games moved to the new name with them (see UMPIRE ROTATION).
      loadWorkload();
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const removeUmpire = async (u) => {
    const ok = await confirm({
      title: `Remove ${u.name}?`,
      confirmLabel: 'Remove',
      message: 'They will no longer appear as an available umpire for this event. Games they already officiated stay on record.',
    });
    if (!ok) return;
    try {
      await deleteUmpire(u.id);
      setUmpires((prev) => prev.filter((x) => x.id !== u.id));
      pushToast(`${u.name} removed`, 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  return (
    <EventWorkspaceLayout event={event}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Umpires</h1>
        <p className="text-sm text-ink-500">Officials available to run matches for this event</p>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {showCounts && umpires.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Umpires" value={totals.umpires} />
            <StatTile label="Games officiated" value={totals.games} />
            <StatTile label="Average each" value={Number.isInteger(totals.average) ? totals.average : totals.average.toFixed(1)} />
            <StatTile label="Fewest – most" value={totals.fewest === totals.most ? totals.most : `${totals.fewest}–${totals.most}`} />
          </div>
        )}

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Gavel size={17} strokeWidth={2.3} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink-900">Officiating pool</h2>
              <p className="text-xs text-ink-500">
                {umpires.length} umpire{umpires.length === 1 ? '' : 's'} on hand
                {showCounts && umpires.length > 1 ? ' · fewest games first' : ''}
              </p>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUmpire()}
              placeholder="Umpire name"
              className="min-w-0 flex-1 rounded-xl border border-ink-200 px-3.5 py-2.5 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:text-sm"
            />
            <button
              onClick={addUmpire}
              className="press-scale flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              <Plus size={15} /> Add
            </button>
          </div>

          {workloadFailed && umpires.length > 0 && (
            <p className="mb-3 rounded-xl bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-500">Game counts couldn't be loaded right now.</p>
          )}

          <div className="flex flex-col gap-2">
            {umpires.length === 0 && <div className="rounded-2xl bg-ink-50 py-10 text-center text-sm text-ink-400">No umpires added yet.</div>}
            {rotation.rows.map((row) => {
              const u = row.umpire;
              return editingId === u.id ? (
                <div key={u.id} className="flex items-center gap-2 rounded-2xl bg-ink-50 px-4 py-2">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(u);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-1.5 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:text-sm"
                  />
                  <button onClick={() => saveEdit(u)} title="Save" className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100">
                    <Check size={13} />
                  </button>
                  <button onClick={cancelEdit} title="Cancel" className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink-400 shadow-sm hover:bg-ink-100">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div key={u.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${row.fewest ? 'bg-amber-50/70' : 'bg-ink-50'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="break-words text-sm font-semibold text-ink-800">{u.name}</span>
                      {showCounts && row.fewest && <Chip tone="bg-amber-100 text-amber-700">Fewer games</Chip>}
                      {row.onCourt && <Chip tone="bg-brand-100 text-brand-700">On court</Chip>}
                    </div>
                    {showCounts && <GamesBar row={row} />}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => startEdit(u)}
                      title="Edit name"
                      aria-label={`Edit ${u.name}`}
                      className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-600 shadow-sm ring-1 ring-ink-200 transition hover:bg-ink-100 sm:px-3"
                    >
                      <Pencil size={11} /> <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      onClick={() => removeUmpire(u)}
                      title="Remove"
                      aria-label={`Remove ${u.name}`}
                      className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50 sm:px-3"
                    >
                      <Trash2 size={11} /> <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {showCounts && rotation.removed.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">No longer on the list</h3>
              <div className="flex flex-col gap-2">
                {rotation.removed.map((row) => (
                  <div key={row.name} className="rounded-2xl border border-dashed border-ink-200 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="break-words text-sm font-semibold text-ink-500">{row.name}</span>
                      <Chip tone="bg-ink-100 text-ink-500">Removed</Chip>
                    </div>
                    <GamesBar row={row} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </EventWorkspaceLayout>
  );
}
