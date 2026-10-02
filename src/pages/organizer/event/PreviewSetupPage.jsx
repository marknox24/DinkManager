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
    QRCode.toDataURL(previewUrl, { width: 320, margin: 1, color: { dark: '#211c4d', light: '#ffffff' } }).then((url) => {
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
                  Publish it first, otherwise this QR code and link will be blank for the public — only you can see it while signed in.
                </p>
                <button
                  onClick={() => navigate(`/events/${eventId}/edit`)}
                  className="mt-2.5 rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
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
            <p className="mt-3 text-center text-xs text-ink-400">
              Opens in a new tab — ideal for casting to a TV or monitor.
              {!event.is_published && ' Only you can see it while signed in — the public can\'t until you publish.'}
            </p>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <label className="mb-3 block text-xs font-bold uppercase tracking-wide text-ink-500">Share with players & spectators</label>
            <p className="mb-4 text-xs text-ink-500">The preview screen is public — anyone with the link or QR code can view it, no login required.</p>
            <div className="flex flex-col items-center gap-4">
              {qrDataUrl && (
                <div className="relative">
                  <img
                    src={qrDataUrl}
                    alt="Preview screen QR code"
                    className={`h-32 w-32 shrink-0 rounded-xl border border-ink-100 p-1.5 ${!event.is_published ? 'opacity-30' : ''}`}
                  />
                  {!event.is_published && (
                    <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] font-bold text-ink-500">
                      Available after publishing
                    </div>
                  )}
                </div>
              )}
              <div className="flex w-full min-w-0 flex-col gap-2">
                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2.5">
                  <code className="min-w-0 flex-1 truncate text-xs text-ink-700">{previewUrl}</code>
                </div>
                <button
                  onClick={copyLink}
                  disabled={!previewUrl || !event.is_published}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
                >
                  {copied ? <Check size={15} className="text-brand-600" /> : <Copy size={15} />}
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </EventWorkspaceLayout>
  );
}
