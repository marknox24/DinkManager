import { useOfflineSync } from '../../context/OfflineSyncContext';

const STATUS_CONFIG = {
  online: { emoji: '🟢', label: 'Online', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  offline: { emoji: '🟠', label: 'Offline — saved locally', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  pending: { emoji: '🟠', label: 'Saved locally', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  syncing: { emoji: '🔄', label: 'Syncing…', className: 'bg-brand-50 text-brand-700 ring-brand-200' },
  synced: { emoji: '✅', label: 'Synced', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  'sync-failed': { emoji: '🔴', label: 'Sync failed', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

// Match List's always-visible connection indicator — see OfflineSyncContext
// for how `status` is derived. Deliberately scoped to Match List only (see
// that context's own comment on why it isn't mounted in the shared
// EventWorkspaceLayout), so this only renders on the one page that
// currently supports offline scoring.
export default function ConnectionStatusPill() {
  const { status, pendingCount, syncNow, online } = useOfflineSync();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.online;
  // Sync Now only ever retries genuinely pending entries — a failed entry
  // was explicitly rejected by the server and needs to be discarded (see
  // OfflineQueueBanner), not retried, so this button is hidden when there's
  // nothing pending even if there's a failed entry sitting alongside it.
  const showSyncNow = online && pendingCount > 0;

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${config.className}`}>
        <span aria-hidden="true">{config.emoji}</span>
        {config.label}
        {pendingCount > 0 && status !== 'syncing' && (
          <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] leading-none">{pendingCount}</span>
        )}
      </span>
      {showSyncNow && (
        <button
          onClick={syncNow}
          title="Manually retry syncing queued changes now"
          className="rounded-full border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-600 transition hover:bg-ink-100"
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
