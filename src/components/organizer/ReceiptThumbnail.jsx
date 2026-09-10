import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { getExpenseReceiptUrl } from '../../data/eventsApi';

// event-receipts is a private bucket, so the URL has to be freshly signed
// per view rather than derived synchronously the way public event-media
// paths are — this resolves one on mount and links straight to the image.
export default function ReceiptThumbnail({ path }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) return undefined;
    getExpenseReceiptUrl(path)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) return <span className="text-ink-300">—</span>;

  return (
    <a
      href={url || '#'}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
      title="View receipt"
    >
      <Receipt size={13} /> View
    </a>
  );
}
