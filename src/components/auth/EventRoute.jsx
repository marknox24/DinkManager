import { Navigate, Outlet, useParams } from 'react-router-dom';
import { RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import { EventAccessProvider, useEventAccess } from '../../context/EventAccessContext';

function NoAccessPanel({ expired }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert size={22} strokeWidth={2.3} />
        </span>
        {expired ? (
          <>
            <h1 className="font-display text-lg font-bold text-ink-900">Your temporary access has expired</h1>
            <p className="mt-1.5 text-sm text-ink-500">Ask the event organizer to generate a new temporary login if you still need access.</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-lg font-bold text-ink-900">You don't have access to this page</h1>
            <p className="mt-1.5 text-sm text-ink-500">Ask the event organizer to grant you this permission if you need it.</p>
          </>
        )}
      </div>
    </div>
  );
}

// Shown only when the event fetch fails with no cached copy to fall back on
// (first-ever visit to this event while offline) — every page under this
// provider needs the event itself, so there's nothing useful to render.
function EventLoadErrorPanel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <WifiOff size={22} strokeWidth={2.3} />
        </span>
        <h1 className="font-display text-lg font-bold text-ink-900">Couldn't load this event</h1>
        <p className="mt-1.5 text-sm text-ink-500">Check your connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mx-auto mt-4 flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          <RefreshCw size={14} /> Reload
        </button>
      </div>
    </div>
  );
}

// The checks that hold for every page in this event's workspace, regardless
// of which one is open: still loading, no access at all, or the event
// itself couldn't be loaded (offline with no cache). Per-route permission
// checks live in RequireEventPermission below, not here, since those differ
// per child route.
function EventAccessBoundary({ children }) {
  const { loading, isOwner, isStaff, event } = useEventAccess();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] text-sm text-ink-400">Loading…</div>;
  }

  if (!isOwner && !isStaff) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!event) {
    return <EventLoadErrorPanel />;
  }

  return children;
}

// Parent route for the whole /events/:eventId/* organizer workspace — mounts
// ONE EventAccessProvider shared by every sub-page (via Outlet), instead of
// each sub-route mounting its own and re-fetching the event/staff row on
// every sidebar navigation. `key={eventId}` forces a clean remount (fresh
// fetch, no stale previous event for one render) when navigating from one
// event straight into another, e.g. after Settings → Duplicate.
export function EventAccessLayout() {
  const { eventId } = useParams();
  return (
    <ProtectedRoute>
      <EventAccessProvider key={eventId} eventId={eventId}>
        <EventAccessBoundary>
          <Outlet />
        </EventAccessBoundary>
      </EventAccessProvider>
    </ProtectedRoute>
  );
}

// Per-child-route permission gate — reads the context EventAccessLayout
// already populated above it; never fetches anything itself.
export function RequireEventPermission({ permission, ownerOnly = false, children }) {
  const { isOwner, can, accessExpired } = useEventAccess();

  if (ownerOnly && !isOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && !can(permission)) {
    return <NoAccessPanel expired={accessExpired} />;
  }

  return children;
}

// Element for the bare index route at /events/:eventId — sends the visitor
// to the first page they're actually allowed to see instead of a blank
// Outlet (a parent route matches its own exact path too).
export function EventIndexRedirect() {
  const { eventId } = useParams();
  const { firstAllowedNavId } = useEventAccess();
  return <Navigate to={firstAllowedNavId ? `/events/${eventId}/${firstAllowedNavId}` : '/dashboard'} replace />;
}
