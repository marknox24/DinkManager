import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlertTriangle, Check, Copy, MonitorPlay } from 'lucide-react';
import { listCategories } from '../../../data/eventsApi';
import { useToast } from '../../../context/ToastContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';

export default function PreviewSetupPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { event } = useEventAccess();
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listCategories(eventId)
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setSelectedId(cats[0].id);
        setLoaded(true);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast]);

  const previewUrl = selectedId ? `${window.location.origin}/events/${eventId}/preview/${selectedId}` : null;

  useEffect(() => {
    if (!previewUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(previewUrl, { width: 640, margin: 1, color: { dark: '#211c4d', light: '#ffffff' } }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  const copyLink = () => {
    if (!previewUrl) return;
    navigator.clipboard.writeText(previewUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <EventWorkspaceLayout event={event}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Preview Screen</h1>
        <p className="text-sm text-ink-500">Open a big-screen display for spectators — live courts, standings, and upcoming matches</p>
      </div>

      {!loaded ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-12 text-center text-sm text-ink-400">
          Add categories in Edit event before opening a preview.
        </div>
      ) : (
        <div className="mx-auto flex max-w-xl flex-col gap-5">
          {!event.is_published && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <div className="text-sm font-bold text-amber-900">This event is still a draft</div>
                <p className="mt-0.5 text-xs text-amber-700">
                  Only you can open the preview while signed in — publish the event so players and spectators can too.
                </p>
                <button
                  onClick={() => navigate(`/events/${eventId}/edit`)}
                  className="mt-2.5 rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 active:scale-[0.97]"
                >
                  Publish event →
                </button>
              </div>
            </div>
          )}

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

            {/* No divider/border between this and the picker above — it's
                one continuous flow (pick a category, this is its link), not
                two unrelated features stacked together. */}
            <div className="mt-5 flex flex-col items-center gap-4 border-t border-ink-100 pt-5 sm:flex-row sm:items-start">
              {qrDataUrl && <img src={qrDataUrl} alt="Preview screen QR code" className="h-44 w-44 shrink-0 rounded-2xl border border-ink-100 bg-white p-2 shadow-sm sm:h-48 sm:w-48" />}
              <div className="flex w-full min-w-0 flex-col gap-3">
                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2.5">
                  <code className="min-w-0 flex-1 truncate text-xs text-ink-700">{previewUrl}</code>
                </div>
                <p className="text-xs text-ink-400">Public, no login required — share the link or QR code with players and spectators, or open it yourself below.</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={copyLink}
                    disabled={!previewUrl}
                    className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-ink-200 px-4 py-3 text-sm font-bold text-ink-700 transition-[background-color,transform] duration-150 hover:bg-ink-50 active:scale-[0.97] disabled:opacity-50"
                  >
                    {copied ? <Check size={15} className="text-brand-600" /> : <Copy size={15} />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <a
                    href={selectedId ? `/events/${eventId}/preview/${selectedId}` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!selectedId}
                    className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-[0.97] ${
                      !selectedId ? 'pointer-events-none opacity-50' : ''
                    }`}
                  >
                    <MonitorPlay size={15} /> Open Preview Screen
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </EventWorkspaceLayout>
  );
}
