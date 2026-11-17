// The running build's version (stamped by vite.config.js) and the manual
// "get the latest version" path used by the sidebar's AppVersionBadge.
//
// Why not just reload: the service worker serves the app shell from its
// precache, so a plain reload can come back on the same old build. Updating
// means fetching the new worker, letting it finish installing, telling it to
// take over (sw.js listens for SKIP_WAITING), and only then reloading.

export const APP_VERSION = import.meta.env.DEV ? 'dev' : import.meta.env.VITE_APP_VERSION || 'unknown';
export const APP_COMMIT = import.meta.env.VITE_APP_COMMIT || '';

const CHECK_TTL_MS = 5 * 60 * 1000;
let lastCheck = null; // { at, latest }
let inflight = null;

// Asks the server which build is live. Cached for a few minutes because the
// sidebar remounts on every page change. Returns { latest, updateAvailable },
// or throws when offline.
export async function checkForUpdate({ force = false } = {}) {
  if (import.meta.env.DEV) return { latest: APP_VERSION, updateAvailable: false };
  if (!force && lastCheck && Date.now() - lastCheck.at < CHECK_TTL_MS) return result(lastCheck.latest);
  if (!inflight) {
    inflight = fetch('/version.json', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`Version check failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        lastCheck = { at: Date.now(), latest: data.version };
        return result(data.version);
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function result(latest) {
  return { latest, updateAvailable: Boolean(latest) && latest !== APP_VERSION };
}

// Resolves once the registration has a waiting (fully installed) worker, or
// after `ms` if the new worker is still downloading or the install failed.
function waitForWaitingWorker(reg, ms) {
  return new Promise((resolve) => {
    if (reg.waiting) return resolve(reg.waiting);
    let timer;
    const done = () => {
      clearTimeout(timer);
      resolve(reg.waiting);
    };
    timer = setTimeout(done, ms);
    const track = (sw) => {
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' || sw.state === 'redundant') done();
      });
    };
    track(reg.installing);
    reg.addEventListener('updatefound', () => track(reg.installing), { once: true });
  });
}

// Switches this tab to the newest deployed build. Never resolves when it
// works, because the page reloads.
export async function applyLatestVersion() {
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => null) : null;
  if (reg) {
    if (!reg.waiting) {
      try {
        await reg.update();
      } catch {
        // Offline or the worker script failed to fetch: fall through to a plain reload.
      }
      await waitForWaitingWorker(reg, 30000);
    }
    if (reg.waiting && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Safety net in case controllerchange never fires.
      setTimeout(() => window.location.reload(), 5000);
      return new Promise(() => {});
    }
  }
  window.location.reload();
  return new Promise(() => {});
}
