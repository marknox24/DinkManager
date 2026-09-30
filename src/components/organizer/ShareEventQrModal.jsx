import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { Copy, Download, Loader2, QrCode } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { formatDateRange } from '../../utils/format';
import { copyToClipboard } from '../../utils/clipboard';

// Same 4-brand-color palette (and per-open random pick) as
// DownloadBracketsListModal.jsx — kept as its own small copy here rather
// than shared, matching how every export modal in this app owns its own
// palette/watermark constants instead of importing a shared one.
const BG_THEMES = [
  { bg: '#6C5CE7', text: '#ffffff', soft: 'rgba(255,255,255,0.82)', pillText: '#6C5CE7', watermark: '#a6bccc', logoBars: ['#ffffff', 'rgba(255,255,255,0.72)', 'rgba(255,255,255,0.46)'] },
  { bg: '#FF6B6B', text: '#1c2733', soft: 'rgba(28,39,51,0.72)', pillText: '#1c2733', watermark: '#7a1512', logoBars: ['#6C5CE7', '#17C3B2', '#1c2733'] },
  { bg: '#17C3B2', text: '#1c2733', soft: 'rgba(28,39,51,0.72)', pillText: '#1c2733', watermark: '#0a4f48', logoBars: ['#6C5CE7', '#FF6B6B', '#1c2733'] },
  { bg: '#FFC93C', text: '#1c2733', soft: 'rgba(28,39,51,0.72)', pillText: '#1c2733', watermark: '#7a5c00', logoBars: ['#6C5CE7', '#17C3B2', '#FF6B6B'] },
];

function randomTheme() {
  return BG_THEMES[Math.floor(Math.random() * BG_THEMES.length)];
}

// Same QR generation call as EventCheckinQr.jsx — client-side only, the
// link never leaves the browser.
async function generateQr(url) {
  return QRCode.toDataURL(url, {
    width: 480,
    margin: 1,
    color: { dark: '#211c4d', light: '#ffffff' },
  });
}

// shareUrl is optional — the organizer's editor page has no single
// "current URL" to fall back on (it's viewing /events/:id/edit, not the
// shareable link itself), so it computes the right public/private variant
// from `event`. The public event page IS already that link, so it just
// passes window.location.href straight through instead.
export default function ShareEventQrModal({ event, shareUrl: shareUrlProp, onClose }) {
  const { pushToast } = useToast();
  const [theme] = useState(randomTheme);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const paperRef = useRef(null);

  const shareUrl =
    shareUrlProp || (event.visibility === 'private' ? `${window.location.origin}/t/${event.share_token}` : `${window.location.origin}/e/${event.slug}`);

  useEffect(() => {
    let cancelled = false;
    generateQr(shareUrl).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  const copyLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    pushToast(ok ? 'Link copied' : 'Could not copy link', ok ? 'success' : 'error');
  };

  const downloadQr = async () => {
    if (!paperRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(paperRef.current, { pixelRatio: 2, skipFonts: true });
      const safeName = (event.name || 'Event').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
      const link = document.createElement('a');
      link.download = `${safeName}_QR.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      pushToast('Could not generate the image — try again', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Share event" icon={QrCode} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-ink-100 bg-ink-50/40 p-4">
          <div ref={paperRef} className="relative mx-auto overflow-hidden" style={{ background: theme.bg, width: '440px', padding: '36px', boxSizing: 'border-box' }}>
            {/* centered watermark */}
            <svg
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ opacity: 0.1 }}
              width="260"
              height="260"
              viewBox="0 0 40 40"
              aria-hidden="true"
            >
              <rect x="2" y="5" width="26" height="8" rx="4" fill={theme.watermark} />
              <rect x="8" y="16" width="24" height="8" rx="4" fill={theme.watermark} />
              <rect x="14" y="27" width="20" height="8" rx="4" fill={theme.watermark} />
            </svg>

            <div className="relative flex flex-col items-center gap-5 text-center" style={{ zIndex: 1 }}>
              <span
                className="inline-flex items-center rounded-full bg-white px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-widest"
                style={{ color: theme.pillText }}
              >
                Scan to join
              </span>

              <div className="flex flex-col gap-1">
                <h1 className="font-display text-2xl font-bold leading-tight tracking-tight" style={{ color: theme.text }}>
                  {event.name}
                </h1>
                <p className="text-sm font-medium" style={{ color: theme.soft }}>
                  {formatDateRange(event.start_date, event.end_date)}
                </p>
              </div>

              <div className="flex items-center justify-center rounded-3xl bg-white p-5 shadow-lg">
                {qrDataUrl ? <img src={qrDataUrl} alt="Event QR code" className="h-52 w-52" /> : <div className="h-52 w-52 animate-pulse-soft bg-ink-50" />}
              </div>

              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="22" height="22" viewBox="0 0 40 40" aria-hidden="true">
                    <rect x="2" y="5" width="26" height="8" rx="4" fill={theme.logoBars[0]} />
                    <rect x="8" y="16" width="24" height="8" rx="4" fill={theme.logoBars[1]} />
                    <rect x="14" y="27" width="20" height="8" rx="4" fill={theme.logoBars[2]} />
                  </svg>
                  <span className="font-display text-sm font-extrabold" style={{ color: theme.text }}>
                    DinkManager
                  </span>
                </div>
                <span className="truncate text-xs" style={{ color: theme.soft, maxWidth: '55%' }}>
                  {shareUrl.replace(/^https?:\/\//, '')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2.5 text-sm font-bold text-ink-700 transition hover:bg-ink-50"
          >
            <Copy size={14} /> Copy link
          </button>
          <button
            onClick={downloadQr}
            disabled={!qrDataUrl || downloading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download QR
          </button>
        </div>
      </div>
    </Modal>
  );
}
