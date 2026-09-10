import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MonitorPlay } from 'lucide-react';
import { getEventById, listCategories } from '../../../data/eventsApi';
import { useToast } from '../../../context/ToastContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';

export default function PreviewSetupPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    Promise.all([getEventById(eventId), listCategories(eventId)])
      .then(([ev, cats]) => {
        setEvent(ev);
        setCategories(cats);
        if (cats.length > 0) setSelectedId(cats[0].id);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast]);

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Preview Screen</h1>
        <p className="text-sm text-ink-500">Open a big-screen display for spectators — live courts, standings, and upcoming matches</p>
      </div>

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-12 text-center text-sm text-ink-400">
          Add categories in Edit event before opening a preview.
        </div>
      ) : (
        <div className="mx-auto flex max-w-xl flex-col gap-5">
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-ink-500">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedId(cat.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedId === cat.id ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <a
              href={selectedId ? `/events/${eventId}/preview/${selectedId}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!selectedId}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 ${
                !selectedId ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <MonitorPlay size={16} /> Open Preview Screen
            </a>
            <p className="mt-3 text-center text-xs text-ink-400">Opens in a new tab — ideal for casting to a TV or monitor.</p>
          </div>
        </div>
      )}
    </EventWorkspaceLayout>
  );
}
