import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, X } from 'lucide-react';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { getQueueEntries } from '../../lib/syncQueue';

// Page-local, unmissable confirmation that queued offline actions were
// actually saved — separate from the compact ConnectionStatusPill, since a
// referee scoring matches court-side needs a bigger "yes, that was saved"
// signal than a small pill provides. Renders nothing once the queue is
// empty (the common case).
//
// `onDiscarded` is called after a failed entry is dropped — the parent page
// should use it to re-fetch this match's real data, since discarding means
// accepting that this device's local (optimistic) version of that match was
// wrong and the server's is authoritative.
export default function OfflineQueueBanner({ onDiscarded }) {
  const { pendingCount, failedCount, status, syncNow, dismissFailed, online } = useOfflineSync();
  const [failedEntries, setFailedEntries] = useState([]);

  useEffect(() => {
    if (failedCount === 0) {
      setFailedEntries([]);
      return;
    }
    getQueueEntries().then((entries) => setFailedEntries(entries.filter((e) => e.status === 'failed')));
  }, [failedCount]);

  if (pendingCount === 0 && failedCount === 0) return null;

  const handleDiscard = async (operationId) => {
    await dismissFailed(operationId);
    await onDiscarded?.();
  };

  return (
    <div className={`mb-4 rounded-2xl border p-3.5 text-sm ${failedCount > 0 ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`flex items-center gap-2 font-semibold ${failedCount > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
          <CloudOff size={15} className="shrink-0" />
          {failedCount > 0
            ? `${failedCount} change${failedCount === 1 ? '' : 's'} couldn't sync`
            : `${pendingCount} change${pendingCount === 1 ? '' : 's'} saved on this device${online ? '' : " — will sync when you're back online"}`}
        </div>
        {online && pendingCount > 0 && (
          <button
            onClick={syncNow}
            disabled={status === 'syncing'}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink-700 shadow-sm ring-1 ring-ink-200 transition hover:bg-ink-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={status === 'syncing' ? 'animate-spin' : ''} /> {status === 'syncing' ? 'Syncing…' : 'Sync Now'}
          </button>
        )}
      </div>
      {failedEntries.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {failedEntries.map((e) => (
            <li key={e.operation_id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-600">
              <span>{e.last_error || 'This change could not be applied.'}</span>
              <button
                onClick={() => handleDiscard(e.operation_id)}
                title="Discard this change and reload the real result from the server"
                className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600 shadow-sm ring-1 ring-rose-200 transition hover:bg-rose-100"
              >
                <X size={11} /> Discard
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
