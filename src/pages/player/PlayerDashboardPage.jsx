import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getMyBracketResults, listMyRegistrations } from '../../data/playerApi';
import { getPublishedEvents } from '../../data/eventsApi';
import { formatDateRange, formatRelativeTime } from '../../utils/format';
import PlayerLayout from '../../components/player/PlayerLayout';
import AccountTypeCard from '../../components/ui/AccountTypeCard';
import TournamentCard from '../../components/public/TournamentCard';
import RegistrationStatusBadge from '../../components/player/RegistrationStatusBadge';

// Only these show up anywhere in the system today (registrations.status
// check constraint) — deliberately not inventing "Paid"/"Unpaid" etc. since
// there's no payment-status column on registrations yet.
const STATUS_FILTERS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['approved', 'Confirmed'],
  ['waitlisted', 'Waitlisted'],
  ['denied', 'Rejected'],
];

function teamLabel(reg) {
  return reg.player2_name ? `${reg.player_name} & ${reg.player2_name}` : reg.player_name;
}

// Separate component (not inlined in PlayerDashboardPage) because it needs
// useNotifications() — PlayerDashboardPage renders <PlayerLayout>, and
// NotificationsProvider lives INSIDE PlayerLayout, so PlayerDashboardPage
// itself sits above the provider in the tree and can't consume its context
// directly. This panel, rendered as PlayerLayout's children, correctly sits
// below the provider.
function RecentUpdatesPanel() {
  const { notifications } = useNotifications();
  const recentUpdates = notifications.slice(0, 5);
  if (recentUpdates.length === 0) return null;
  return (
    <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <h2 className="font-display text-sm font-bold text-ink-900">Recent Updates</h2>
      <div className="mt-2 flex flex-col gap-2">
        {recentUpdates.map((n) => (
          <div key={n.id} className="flex items-start justify-between gap-3 text-xs">
            <span className={!n.read_at ? 'font-semibold text-ink-800' : 'text-ink-500'}>{n.message}</span>
            <span className="shrink-0 text-ink-400">{formatRelativeTime(n.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayerDashboardPage() {
  const { user, accountType } = useAuth();
  const { pushToast } = useToast();
  const [registrations, setRegistrations] = useState(null);
  const [bracketResults, setBracketResults] = useState({});
  const [availableEvents, setAvailableEvents] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    listMyRegistrations(user.id)
      .then(async (regs) => {
        setRegistrations(regs);
        const results = await getMyBracketResults(regs.map((r) => r.id));
        setBracketResults(results);
      })
      .catch((e) => pushToast(e.message, 'error'));
    getPublishedEvents()
      .then(setAvailableEvents)
      .catch(() => {});
  }, [user.id, pushToast]);

  // Already-registered events now show a "Registered" badge on their card
  // instead of being hidden — a player might still want to sign up for a
  // second category in the same event.
  const myRegsByEvent = useMemo(() => {
    const map = {};
    (registrations || []).forEach((r) => {
      (map[r.event_id] ||= []).push(r);
    });
    return map;
  }, [registrations]);
  const browseEvents = (availableEvents || []).slice(0, 3);

  const statusCounts = useMemo(() => {
    const counts = { all: (registrations || []).length, pending: 0, approved: 0, waitlisted: 0, denied: 0 };
    (registrations || []).forEach((r) => {
      if (counts[r.status] != null) counts[r.status] += 1;
    });
    return counts;
  }, [registrations]);
  const visibleRegs = statusFilter === 'all' ? registrations || [] : (registrations || []).filter((r) => r.status === statusFilter);

  return (
    <PlayerLayout>
      <div className="mb-6">
        <AccountTypeCard accountType={accountType} />
      </div>

      <RecentUpdatesPanel />

      <div id="my-tournaments" className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">My Tournaments</h1>
        <p className="text-sm text-ink-500">Track your tournament status and bracket results</p>
      </div>

      {registrations === null && <div className="py-16 text-center text-sm text-ink-400">Loading your registrations…</div>}

      {registrations && registrations.length === 0 && (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white py-16 text-center">
          <p className="text-sm text-ink-500">You haven't registered for any events yet.</p>
          <Link to="/tournaments" className="mt-3 inline-block text-sm font-semibold text-brand-600">
            Browse tournaments →
          </Link>
        </div>
      )}

      {registrations && registrations.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === key ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
              }`}
            >
              {label} ({statusCounts[key] ?? 0})
            </button>
          ))}
        </div>
      )}

      {registrations && registrations.length > 0 && visibleRegs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-10 text-center text-sm text-ink-400">
          No registrations match this filter.{' '}
          <button onClick={() => setStatusFilter('all')} className="font-semibold text-brand-600">
            Clear filter
          </button>
        </div>
      )}

      {visibleRegs.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleRegs.map((reg) => {
            const result = bracketResults[reg.id];
            return (
              <div key={reg.id} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {reg.events?.visibility === 'private' && reg.events?.share_token ? (
                      <Link to={`/t/${reg.events.share_token}`} className="font-display text-base font-bold text-ink-900 hover:text-brand-600">
                        {reg.events?.name || 'Event'}
                      </Link>
                    ) : reg.events?.slug ? (
                      <Link to={`/e/${reg.events.slug}`} className="font-display text-base font-bold text-ink-900 hover:text-brand-600">
                        {reg.events?.name || 'Event'}
                      </Link>
                    ) : (
                      <span className="font-display text-base font-bold text-ink-900">{reg.events?.name || 'Event'}</span>
                    )}
                    <div className="mt-0.5 text-xs text-ink-500">Category: {reg.categories?.name || 'Category'}</div>
                  </div>
                  <RegistrationStatusBadge status={reg.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={13} /> {teamLabel(reg)}
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-ink-600">
                    <Trophy size={13} className={result ? 'text-brand-600' : 'text-ink-300'} />
                    {result ? `Bracket ${result.letter} · ${result.wins}-${result.losses}` : 'Bracket not yet drawn'}
                  </span>
                </div>

                {(reg.events?.start_date || reg.events?.location_address) && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-ink-50 pt-2.5 text-xs text-ink-500">
                    {reg.events?.start_date && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} /> {formatDateRange(reg.events.start_date, reg.events.end_date)}
                      </span>
                    )}
                    {reg.events?.location_address && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} /> <span className="truncate">{reg.events.location_address}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">Available Tournaments</h2>
          <p className="text-sm text-ink-500">Browse tournaments open for registration</p>
        </div>
        <Link to="/tournaments" className="shrink-0 text-sm font-semibold text-brand-600">
          View all →
        </Link>
      </div>

      {availableEvents === null && <div className="py-10 text-center text-sm text-ink-400">Loading tournaments…</div>}

      {availableEvents && browseEvents.length === 0 && (
        <div className="mt-3 rounded-2xl border border-dashed border-ink-200 bg-white py-10 text-center text-sm text-ink-400">
          Nothing new to show right now — check back soon.
        </div>
      )}

      {browseEvents.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {browseEvents.map((event) => (
            <TournamentCard key={event.id} event={event} myRegistrations={myRegsByEvent[event.id]} />
          ))}
        </div>
      )}
    </PlayerLayout>
  );
}
