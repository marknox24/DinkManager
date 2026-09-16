import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getMyBracketResults, listMyRegistrations } from '../../data/playerApi';
import { getPublishedEvents } from '../../data/eventsApi';
import { formatDateRange } from '../../utils/format';
import PlayerLayout from '../../components/player/PlayerLayout';
import AccountTypeCard from '../../components/ui/AccountTypeCard';
import TournamentCard from '../../components/public/TournamentCard';

// Only these show up anywhere in the system today (registrations.status
// check constraint) — deliberately not inventing "Paid"/"Unpaid" etc. since
// there's no payment-status column on registrations yet.
const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-brand-100 text-brand-700',
  denied: 'bg-rose-100 text-rose-600',
  waitlisted: 'bg-violet-100 text-violet-700',
};

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Confirmed',
  denied: 'Rejected',
  waitlisted: 'Waitlisted',
};

function teamLabel(reg) {
  return reg.player2_name ? `${reg.player_name} & ${reg.player2_name}` : reg.player_name;
}

export default function PlayerDashboardPage() {
  const { user, accountType } = useAuth();
  const { pushToast } = useToast();
  const [registrations, setRegistrations] = useState(null);
  const [bracketResults, setBracketResults] = useState({});
  const [availableEvents, setAvailableEvents] = useState(null);

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

  const registeredEventIds = new Set((registrations || []).map((r) => r.event_id));
  const browseEvents = (availableEvents || []).filter((e) => !registeredEventIds.has(e.id)).slice(0, 3);

  return (
    <PlayerLayout>
      <div className="mb-6">
        <AccountTypeCard accountType={accountType} />
      </div>

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
        <div className="flex flex-col gap-3">
          {registrations.map((reg) => {
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
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[reg.status]}`}>
                    {STATUS_LABELS[reg.status] || reg.status}
                  </span>
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
            <TournamentCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </PlayerLayout>
  );
}
