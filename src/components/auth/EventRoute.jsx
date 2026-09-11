import { Navigate, useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import { EventAccessProvider, useEventAccess } from '../../context/EventAccessContext';

function NoAccessPanel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert size={22} strokeWidth={2.3} />
        </span>
        <h1 className="font-display text-lg font-bold text-ink-900">You don't have access to this page</h1>
        <p className="mt-1.5 text-sm text-ink-500">Ask the event organizer to grant you this permission if you need it.</p>
      </div>
    </div>
  );
}

function EventAccessGate({ permission, ownerOnly, children }) {
  const { loading, isOwner, isStaff, can } = useEventAccess();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] text-sm text-ink-400">Loading…</div>;
  }

  if (!isOwner && !isStaff) {
    return <Navigate to="/dashboard" replace />;
  }

  if (ownerOnly && !isOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && !can(permission)) {
    return <NoAccessPanel />;
  }

  return children;
}

export default function EventRoute({ permission, ownerOnly = false, children }) {
  const { eventId } = useParams();
  return (
    <ProtectedRoute>
      <EventAccessProvider eventId={eventId}>
        <EventAccessGate permission={permission} ownerOnly={ownerOnly}>
          {children}
        </EventAccessGate>
      </EventAccessProvider>
    </ProtectedRoute>
  );
}
