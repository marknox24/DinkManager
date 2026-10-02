import { useSyncExternalStore } from 'react';
import { isForcedOffline, isNetworkOnline, isOnline, onConnectivityChange, setForcedOffline } from '../lib/connectivity';
import { useToast } from '../context/ToastContext';

// React-friendly wrapper around connectivity.js's module-level state.
// useSyncExternalStore (not useState+useEffect) so every component reading
// this agrees on the same value at the same instant, including the one tab
// that didn't click the toggle but got the 'storage' event — no two
// components can show a different online/forced state mid-render.
export function useConnectivity() {
  const online = useSyncExternalStore(onConnectivityChange, isOnline, isOnline);
  const networkOnline = useSyncExternalStore(onConnectivityChange, isNetworkOnline, isNetworkOnline);
  const forcedOffline = useSyncExternalStore(onConnectivityChange, isForcedOffline, isForcedOffline);
  return { online, networkOnline, forcedOffline, setForcedOffline };
}

// Same shape as each page's own blockIfLocked() — call at the top of an
// online-only action; it toasts and returns true when there's no point
// attempting the call (device truly offline, or "Offline mode" is on),
// false otherwise.
export function useOnlineOnlyGuard() {
  const { pushToast } = useToast();
  const { forcedOffline } = useConnectivity();

  return () => {
    if (isOnline()) return false;
    pushToast(
      forcedOffline ? "Offline mode is on — turn it off to make this change." : "You're offline — this change needs a connection.",
      'error'
    );
    return true;
  };
}
