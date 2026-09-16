import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { getEventById } from '../data/eventsApi';
import { getMyStaffRow } from '../data/staffApi';
import { EVENT_PERMISSIONS } from '../data/permissions';

const EventAccessContext = createContext(null);

export function useEventAccess() {
  const ctx = useContext(EventAccessContext);
  if (!ctx) throw new Error('useEventAccess must be used within EventAccessProvider');
  return ctx;
}

// Fetches the event's owner and (if the current user isn't the owner) their
// staff permission row once per event mount, then exposes a single `can()`
// check so every gated call site is one expression. A context rather than a
// bare hook because both EventWorkspaceLayout and the page it wraps need
// this data, and a hook alone would fetch it twice.
export function EventAccessProvider({ eventId, children }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizerId, setOrganizerId] = useState(null);
  const [staffRow, setStaffRow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getEventById(eventId), getMyStaffRow(eventId, user.id)])
      .then(([event, staff]) => {
        if (cancelled) return;
        setOrganizerId(event.organizer_id);
        setStaffRow(staff);
      })
      .catch(() => {
        if (cancelled) return;
        setOrganizerId(null);
        setStaffRow(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, user.id]);

  const value = useMemo(() => {
    const isOwner = Boolean(organizerId && organizerId === user.id);
    const isStaff = Boolean(staffRow);
    // Mirrors has_event_permission()'s expiry gate in schema.sql — checked
    // client-side too so the nav/UI degrades with a clear message instead
    // of silently failing every request once the database starts rejecting
    // them (a temporary login's whole point is that this actually happens).
    const accessExpired = Boolean(staffRow?.access_expires_at && new Date(staffRow.access_expires_at) <= new Date());

    const can = (key) => {
      if (isOwner) return true;
      if (!key || !staffRow || accessExpired) return false;
      const perm = EVENT_PERMISSIONS.find((p) => p.key === key);
      if (!perm) return false;
      return Boolean(staffRow[perm.column]);
    };

    const allowedNavIds = EVENT_PERMISSIONS.filter((p) => p.navId && can(p.key)).map((p) => p.navId);
    const firstAllowedNavId = isOwner ? 'overview' : allowedNavIds[0] || null;

    return { loading, isOwner, isStaff, staffRow, can, allowedNavIds, firstAllowedNavId, accessExpired };
  }, [loading, organizerId, staffRow, user.id]);

  return <EventAccessContext.Provider value={value}>{children}</EventAccessContext.Provider>;
}
