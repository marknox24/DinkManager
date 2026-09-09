import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Gavel, Plus, Trash2 } from 'lucide-react';
import { createUmpire, deleteUmpire, getEventById, listUmpires } from '../../../data/eventsApi';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';

export default function UmpiresPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const [event, setEvent] = useState(null);
  const [umpires, setUmpires] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    Promise.all([getEventById(eventId), listUmpires(eventId)])
      .then(([ev, ump]) => {
        setEvent(ev);
        setUmpires(ump);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast]);

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

  const removeUmpire = async (u) => {
    const ok = await confirm({ title: `Remove ${u.name}?`, confirmLabel: 'Remove', message: 'They will no longer appear as an available umpire for this event.' });
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
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Umpires</h1>
        <p className="text-sm text-ink-500">Officials available to run matches for this event</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Gavel size={17} strokeWidth={2.3} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink-900">Officiating pool</h2>
              <p className="text-xs text-ink-500">{umpires.length} umpire{umpires.length === 1 ? '' : 's'} on hand</p>
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
            {umpires.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-2xl bg-ink-50 px-4 py-2.5">
                <div className="text-sm font-semibold text-ink-800">{u.name}</div>
                <button
                  onClick={() => removeUmpire(u)}
                  className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50"
                >
                  <Trash2 size={11} /> Remove
                </button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-ink-400">Live officiating status will appear here once bracket play starts.</p>
        </div>
      </div>
    </EventWorkspaceLayout>
  );
}
