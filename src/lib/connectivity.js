// Single source of truth for online/offline state. Every consumer (the sync
// queue, ConnectionStatusPill, offline-cache reads) subscribes through here
// instead of adding its own 'online'/'offline' listener, so they all agree
// on the same value at the same instant rather than racing each other.
const listeners = new Set();

const FORCE_KEY = 'dm_force_offline';

function readForced() {
  try {
    return localStorage.getItem(FORCE_KEY) === '1';
  } catch {
    return false;
  }
}

let forced = readForced();

// True network state, ignoring the manual override below — rarely what a
// caller wants (use isOnline() instead), but needed to tell the organizer
// apart cases like "you flipped the switch" vs "your wifi actually dropped".
export function isNetworkOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

export function isForcedOffline() {
  return forced;
}

// Every existing isOnline() caller (the sync queue's flush-now check, its
// reconnect/30s-poll drain triggers, OfflineSyncContext's `online` state,
// MatchListPage's toast guards) already gates on this one function, so
// folding the manual "Offline mode" toggle in here — rather than adding a
// second flag everywhere — makes the whole app respect it for free.
export function isOnline() {
  return isNetworkOnline() && !forced;
}

export function setForcedOffline(on) {
  forced = Boolean(on);
  try {
    if (forced) localStorage.setItem(FORCE_KEY, '1');
    else localStorage.removeItem(FORCE_KEY);
  } catch {
    // Storage full/unavailable — the in-memory flag still works for this tab.
  }
  notify();
}

function notify() {
  const online = isOnline();
  listeners.forEach((fn) => fn(online));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  // Keeps every open tab in agreement — the sync queue lives in IndexedDB,
  // shared across tabs, so one tab flipping the switch should drain/pause
  // the same queue everywhere, not just where the click happened.
  window.addEventListener('storage', (e) => {
    if (e.key === FORCE_KEY) {
      forced = readForced();
      notify();
    }
  });
}

// Returns an unsubscribe function.
export function onConnectivityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
