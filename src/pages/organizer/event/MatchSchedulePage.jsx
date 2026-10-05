import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listCategories } from '../../../data/eventsApi';
import { useToast } from '../../../context/ToastContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import MatchScheduleView from '../../../components/schedule/MatchScheduleView';
import { readWithFallback } from '../../../lib/offlineRead';
import { cacheCategories, getCachedCategories } from '../../../hooks/useOfflineCache';

export default function MatchSchedulePage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const { event } = useEventAccess();
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    let cancelled = false;
    readWithFallback({
      live: () => listCategories(eventId),
      readCache: () => getCachedCategories(eventId),
      writeCache: (cats) => cacheCategories(eventId, cats),
      retryDelaysMs: [600, 1200],
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (data) setCategories(data);
      else pushToast(error?.message || 'Could not load categories', 'error');
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, pushToast]);

  return (
    <EventWorkspaceLayout event={event}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Match Schedule</h1>
        <p className="text-sm text-ink-500">
          Estimated start and end times for every match. Recalculated automatically as matches start, finish, or run long — players see the same schedule on your event page.
        </p>
      </div>
      {categories == null ? <div className="py-16 text-center text-sm text-ink-400">Loading…</div> : <MatchScheduleView event={event} categories={categories} mode="organizer" />}
    </EventWorkspaceLayout>
  );
}
