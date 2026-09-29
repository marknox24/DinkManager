import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { listMyNotifications, markNotificationsRead } from '../data/playerApi';

// A background header widget across a whole browsing session, not a live
// kiosk display — 60s is deliberately lighter than PreviewDisplayPage.jsx's
// 10s live-tier polling. Same visibility-aware pause/resume pattern as that
// page: stop polling when the tab is hidden, refresh immediately on return.
const POLL_MS = 60000;

const NotificationsContext = createContext(null);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setNotifications(await listMyNotifications(user.id, { limit: 20 }));
    } catch {
      // Silent — a stale bell is fine, no toast spam for a background poll.
    } finally {
      inFlightRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    let intervalId = null;
    const start = () => {
      if (intervalId == null) intervalId = setInterval(refresh, POLL_MS);
    };
    const stop = () => {
      clearInterval(intervalId);
      intervalId = null;
    };
    refresh();
    start();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else {
        refresh();
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, refresh]);

  const markRead = useCallback(
    async (ids) => {
      if (!ids || ids.length === 0) return;
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)));
      try {
        await markNotificationsRead(ids);
      } catch {
        refresh();
      }
    },
    [refresh]
  );

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const value = useMemo(() => ({ notifications, unreadCount, markRead, refresh }), [notifications, unreadCount, markRead, refresh]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
