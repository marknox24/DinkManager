import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { APP_COMMIT, APP_VERSION, applyLatestVersion, checkForUpdate } from '../../lib/appVersion';

// Bottom of the organizer sidebar: which build this tab is running, whether
// a newer one is live, and a manual way to get it (the toast prompt from
// App.jsx is easy to miss or dismiss).
export default function AppVersionBadge() {
  const { pushToast } = useToast();
  // 'checking' | 'current' | 'available' | 'offline' | 'updating'
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    checkForUpdate()
      .then((r) => !cancelled && setStatus(r.updateAvailable ? 'available' : 'current'))
      .catch(() => !cancelled && setStatus('offline'));
    // The service worker found a new build on its own (see main.jsx).
    const onSwUpdate = () => setStatus((s) => (s === 'updating' ? s : 'available'));
    window.addEventListener('dm:sw-update-available', onSwUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('dm:sw-update-available', onSwUpdate);
    };
  }, []);

  const update = async () => {
    setStatus('updating');
    await applyLatestVersion();
  };

  const check = async () => {
    if (status === 'available') return update();
    setStatus('checking');
    try {
      const r = await checkForUpdate({ force: true });
      if (r.updateAvailable) return update();
      setStatus('current');
      pushToast(`You're on the latest version (${APP_VERSION})`, 'success');
    } catch {
      setStatus('offline');
      pushToast("Couldn't check for updates. Check your connection and try again.", 'error');
    }
  };

  const busy = status === 'checking' || status === 'updating';
  const label = {
    checking: 'Checking for updates…',
    current: 'Up to date',
    available: 'New version available',
    offline: "Couldn't check for updates",
    updating: 'Updating…',
  }[status];
  const dot = { current: 'bg-emerald-400', available: 'bg-amber-400', offline: 'bg-ink-500' }[status] || 'bg-ink-500';

  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-ink-300" title={APP_COMMIT ? `Build ${APP_COMMIT}` : undefined}>
            Version {APP_VERSION}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-500">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="truncate">{label}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={check}
          disabled={busy}
          title={status === 'available' ? 'Update now' : 'Check for updates'}
          aria-label={status === 'available' ? 'Update now' : 'Check for updates'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-60"
        >
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>
      {(status === 'available' || status === 'updating') && (
        <button
          type="button"
          onClick={update}
          disabled={status === 'updating'}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-70"
        >
          {status === 'updating' ? 'Updating…' : 'Update now'}
        </button>
      )}
    </div>
  );
}
