import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import Logo from '../ui/Logo';

// Generated client-side (no third-party QR API call) so the check-in URL
// never leaves the browser just to render a code for it.
async function generateQr(url) {
  return QRCode.toDataURL(url, {
    width: 480,
    margin: 1,
    color: { dark: '#211c4d', light: '#ffffff' }, // brand-950 on white — on-brand, dark enough to still scan reliably
  });
}

// Small always-visible chip on the Preview Screen header; clicking it opens
// the browser print dialog on a clean full-page poster (see the print-only
// block below) so the organizer can print and post it at the venue.
export default function EventCheckinQr({ eventName, categoryName, checkinUrl }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    generateQr(checkinUrl).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [checkinUrl]);

  if (!qrDataUrl) return null;

  return (
    <>
      <button
        onClick={() => window.print()}
        title="Print check-in poster"
        className="print:hidden flex shrink-0 items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-left transition hover:bg-brand-50"
      >
        <img src={qrDataUrl} alt="Check-in QR code" className="h-11 w-11 rounded-md bg-white p-0.5" />
        <span className="leading-tight">
          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-600">
            <QrCode size={10} /> Scan to check in
          </span>
          <span className="text-[9px] font-semibold text-brand-400">Tap to print</span>
        </span>
      </button>

      {/* Portal straight to <body>: the on-screen page carries print:hidden
          on its root, and a display:none ancestor hides its descendants no
          matter what print classes they carry — so this has to live outside
          that subtree entirely, not just be conditionally visible within it. */}
      {createPortal(
        <div className="hidden print:flex print:min-h-screen print:w-full print:flex-col print:items-center print:justify-center print:gap-6 print:p-16">
          <Logo size={56} />
          <h1 className="font-display text-3xl font-bold text-ink-900">{eventName}</h1>
          {categoryName && <p className="text-lg text-ink-500">{categoryName}</p>}
          <img src={qrDataUrl} alt="Check-in QR code" className="h-80 w-80" />
          <p className="font-display text-2xl font-bold text-brand-700">Scan to check in</p>
          <p className="text-sm text-ink-400">{checkinUrl}</p>
        </div>,
        document.body
      )}
    </>
  );
}
