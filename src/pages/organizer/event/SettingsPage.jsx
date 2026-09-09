import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, LayoutGrid, Trash2 } from 'lucide-react';
import { deleteEvent, getEventById, updateEvent } from '../../../data/eventsApi';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';

export default function SettingsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const [event, setEvent] = useState(null);
  const [numCourts, setNumCourts] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    getEventById(eventId)
      .then((ev) => {
        setEvent(ev);
        setNumCourts(ev.num_courts ?? 4);
        setDuration(ev.match_duration_minutes ?? 18);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast]);

  const save = async () => {
    let n = parseInt(numCourts, 10);
    let d = parseInt(duration, 10);
    if (Number.isNaN(n) || n < 1) n = 1;
    if (Number.isNaN(d) || d < 1) d = 1;
    try {
      const updated = await updateEvent(eventId, { num_courts: n, match_duration_minutes: d });
      setEvent(updated);
      pushToast('Court settings updated', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const removeEvent = async () => {
    const ok = await confirm({
      title: `Delete "${event.name}"?`,
      message: 'This permanently removes the event, its categories, and every registration. This cannot be undone.',
      confirmLabel: 'Delete event',
    });
    if (!ok) return;
    try {
      await deleteEvent(eventId);
      pushToast('Event deleted', 'success');
      navigate('/dashboard');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">Court capacity, match timing and danger zone</p>
      </div>

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <LayoutGrid size={17} strokeWidth={2.3} />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink-900">Court settings</h2>
                <p className="text-xs text-ink-500">Caps how many matches can be live at once — organizers can't start a new match once every court is in use.</p>
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
                <div className="text-sm font-semibold text-ink-800">Delete this event</div>
                <div className="text-xs text-ink-500">Removes the event, its categories, and every registration permanently.</div>
              </div>
              <button
                onClick={removeEvent}
                className="flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
              >
                <Trash2 size={13} /> Delete event
              </button>
            </div>
          </div>
        </div>
      )}
    </EventWorkspaceLayout>
  );
}
