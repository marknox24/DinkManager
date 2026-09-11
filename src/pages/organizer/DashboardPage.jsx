import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, HandHelping, Image as ImageIcon, MapPin, Plus, Settings2, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createEvent, getEventMediaUrl, getOnboardingProgress, listMyEvents, listStaffedEvents } from '../../data/eventsApi';
import { EVENT_PERMISSIONS } from '../../data/permissions';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import StatusBadge from '../../components/organizer/StatusBadge';
import GettingStartedChecklist from '../../components/organizer/GettingStartedChecklist';
import WelcomeOnboardingModal from '../../components/organizer/WelcomeOnboardingModal';

function formatDateRange(start, end) {
  if (!start && !end) return 'Dates TBD';
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end);
}

// Where a staffer's event card should link to — their first granted nav
// page, since assuming /overview would 404 into the "no access" panel for
// anyone not granted that toggle.
function firstAllowedNavId(staff) {
  return EVENT_PERMISSIONS.find((p) => p.navId && staff[p.column])?.navId || 'overview';
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [staffedEvents, setStaffedEvents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const maxEvents = profile?.max_events ?? null;
  const atEventLimit = maxEvents != null && (events?.length ?? 0) >= maxEvents;

  useEffect(() => {
    listMyEvents(user.id)
      .then((list) => {
        setEvents(list);
        const seenKey = `dm_welcome_seen_${user.id}`;
        if (list.length === 0 && !localStorage.getItem(seenKey)) {
          setShowWelcome(true);
          localStorage.setItem(seenKey, '1');
        }
      })
      .catch((e) => pushToast(e.message, 'error'));
    listStaffedEvents(user.id)
      .then(setStaffedEvents)
      .catch(() => {});
    getOnboardingProgress(user.id)
      .then(setProgress)
      .catch(() => {});
  }, [user.id, pushToast]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const event = await createEvent(user.id, { name: 'Untitled Tournament', status: 'upcoming', is_published: false });
      navigate(`/events/${event.id}/edit`);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <OrganizerLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Your tournaments</h1>
          <p className="text-sm text-ink-500">Create and manage your pickleball events</p>
        </div>
        {atEventLimit ? (
          <span
            title={`Your trial allows up to ${maxEvents} event${maxEvents === 1 ? '' : 's'}`}
            className="rounded-full border border-ink-200 bg-ink-50 px-4 py-2.5 text-sm font-bold text-ink-400"
          >
            Trial limit reached
          </span>
        ) : (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="press-scale flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            <Plus size={16} /> {creating ? 'Creating…' : 'Create event'}
          </button>
        )}
      </div>

      {progress && (
        <GettingStartedChecklist progress={progress} latestEventId={events?.[0]?.id} onCreateEvent={handleCreate} navigate={navigate} />
      )}

      {events === null && <div className="py-16 text-center text-sm text-ink-400">Loading your events…</div>}

      {events && events.length === 0 && (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white py-16 text-center">
          <p className="text-sm text-ink-500">No tournaments yet.</p>
          {!atEventLimit && (
            <button onClick={handleCreate} className="mt-3 text-sm font-semibold text-brand-600">
              Create your first event →
            </button>
          )}
        </div>
      )}

      {events && events.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <button
              key={event.id}
              onClick={() => navigate(`/events/${event.id}/overview`)}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className="hover-lift animate-rise-in flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white text-left shadow-sm"
            >
              {event.cover_photo_path ? (
                <img src={getEventMediaUrl(event.cover_photo_path)} alt="" className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300">
                  <ImageIcon size={26} />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="font-display text-base font-bold leading-snug text-ink-900">{event.name}</h2>
                  <StatusBadge status={event.status} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ink-500">
                  <CalendarDays size={13} /> {formatDateRange(event.start_date, event.end_date)}
                </div>
                {event.location_address && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                    <MapPin size={13} /> <span className="truncate">{event.location_address}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                  <Users size={13} /> {event.player_count ?? 0} {event.player_count === 1 ? 'player' : 'players'}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
                  <span className={`text-[11px] font-semibold ${event.is_published ? 'text-brand-600' : 'text-ink-400'}`}>
                    {event.is_published ? 'Published' : 'Draft'}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/events/${event.id}/edit`);
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-ink-500 hover:text-ink-800"
                  >
                    <Settings2 size={12} /> Edit
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {staffedEvents && staffedEvents.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 font-display text-lg font-bold text-ink-900">Events you're helping with</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staffedEvents.map((event, i) => (
              <button
                key={event.id}
                onClick={() => navigate(`/events/${event.id}/${firstAllowedNavId(event.staff)}`)}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="hover-lift animate-rise-in flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white text-left shadow-sm"
              >
                {event.cover_photo_path ? (
                  <img src={getEventMediaUrl(event.cover_photo_path)} alt="" className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300">
                    <ImageIcon size={26} />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h2 className="font-display text-base font-bold leading-snug text-ink-900">{event.name}</h2>
                    <StatusBadge status={event.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-500">
                    <CalendarDays size={13} /> {formatDateRange(event.start_date, event.end_date)}
                  </div>
                  {event.location_address && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                      <MapPin size={13} /> <span className="truncate">{event.location_address}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-1.5 border-t border-ink-100 pt-3 text-[11px] font-semibold text-brand-600">
                    <HandHelping size={13} /> You're helping with this event
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showWelcome && (
        <WelcomeOnboardingModal
          onClose={() => setShowWelcome(false)}
          onCreateEvent={() => {
            setShowWelcome(false);
            handleCreate();
          }}
        />
      )}
    </OrganizerLayout>
  );
}
