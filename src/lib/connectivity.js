// Single source of truth for online/offline state. Every consumer (the sync
// queue, ConnectionStatusPill, offline-cache reads) subscribes through here
// instead of adding its own 'online'/'offline' listener, so they all agree
// on the same value at the same instant rather than racing each other.
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(navigator.onLine));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
}

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

// Returns an unsubscribe function.
export function onConnectivityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
