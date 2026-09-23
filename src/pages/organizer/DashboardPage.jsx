import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Files, HandHelping, Image as ImageIcon, MapPin, Plus, Settings2, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createEvent, duplicateEvent, getEventMediaUrl, getOnboardingProgress, listMyEvents, listStaffedEvents } from '../../data/eventsApi';
import { PLAN_LIMITS } from '../../data/plans';
import { EVENT_PERMISSIONS } from '../../data/permissions';
import { formatDateRange } from '../../utils/format';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import StatusBadge from '../../components/organizer/StatusBadge';
import GettingStartedChecklist from '../../components/organizer/GettingStartedChecklist';
import WelcomeOnboardingModal from '../../components/organizer/WelcomeOnboardingModal';
import AccountTypeCard from '../../components/ui/AccountTypeCard';

// Where a staffer's event card should link to — their first granted nav
// page, since assuming /overview would 404 into the "no access" panel for
// anyone not granted that toggle.
function firstAllowedNavId(staff) {
  return EVENT_PERMISSIONS.find((p) => p.navId && staff[p.column])?.navId || 'overview';
}

export default function DashboardPage() {
  const { user, profile, accountType } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [staffedEvents, setStaffedEvents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const maxEvents = profile?.max_events ?? null;
  const atEventLimit = maxEvents != null && (events?.length ?? 0) >= maxEvents;
  // One Free Trial event per account (enforced by the database — see
  // events_force_free_entitlements). The profile is loaded once at sign-in,
  // so an event this session just created counts too.
  const trialUsed = Boolean(profile?.free_trial_used_at) || Boolean(events?.some((e) => e.origin === 'trial'));
  const autoTrialStarted = useRef(false);

  useEffect(() => {
    // An invited/temp-login account (added as event_staff by another
    // organizer — see TeamPage.jsx's "Invite a helper") owns zero events of
    // its own, same as a brand-new solo organizer — but it's already staffed
    // on at least one event. That's the existing signal reused here to tell
    // the two apart, rather than a new "onboardingCompleted" field: someone
    // invited to help with someone else's event should never see "create
    // your tournament" onboarding, whether it's the one-time welcome modal
    // (gated on owning AND staffing nothing at all) or the getting-started
    // checklist (gated on staff-only, since an organizer who owns an event
    // but hasn't finished setting it up should still see it regardless of
    // whether they also help staff someone else's event).
    Promise.all([listMyEvents(user.id), listStaffedEvents(user.id)])
      .then(([myEvents, staffed]) => {
        setEvents(myEvents);
        setStaffedEvents(staffed);
        // A brand-new organizer (not a helper staffed on someone else's
        // event) starts with their Free Trial event already created — no
        // "create your first event" step. The ref keeps StrictMode's double
        // effect from trying twice; the database would refuse the second
        // anyway.
        if (myEvents.length === 0 && staffed.length === 0 && !profile?.free_trial_used_at && !autoTrialStarted.current) {
          autoTrialStarted.current = true;
          createEvent(user.id, { name: 'Untitled Tournament', status: 'upcoming', is_published: false })
            .then((event) => {
              pushToast('Your Free Trial event is ready — set it up here', 'success');
              navigate(`/events/${event.id}/edit`);
            })
            .catch((e) => pushToast(e.message, 'error'));
          return;
        }
        const isStaffOnly = myEvents.length === 0 && staffed.length > 0;
        const seenKey = `dm_welcome_seen_${user.id}`;
        if (myEvents.length === 0 && staffed.length === 0 && !localStorage.getItem(seenKey)) {
          setShowWelcome(true);
          localStorage.setItem(seenKey, '1');
        }
        if (!isStaffOnly) {
          getOnboardingProgress(user.id)
            .then(setProgress)
            .catch(() => {});
        }
      })
      .catch((e) => pushToast(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Copies only the source event's template/setup fields — never its plan,
  // payment, entitlements, or tournament data (categories/brackets/teams/
  // registrations/matches). The duplicate always starts fresh on Free Trial
  // and needs its own plan purchase — see eventsApi.js's duplicateEvent.
  const handleDuplicate = async (eventId) => {
    setDuplicatingId(eventId);
    try {
      const created = await duplicateEvent(eventId);
      pushToast('Duplicated — pick a plan to get started', 'success');
      navigate(`/events/${created.id}/edit`);
    } catch (e) {
      pushToast(e.message, 'error');
      setDuplicatingId(null);
    }
  };

  return (
    <OrganizerLayout>
      <div className="mb-4">
        <AccountTypeCard accountType={accountType} />
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Your tournaments</h1>
          <p className="text-sm text-ink-500">Create and manage your pickleball events</p>
        </div>
        {trialUsed ? (
          <Link
            to="/#pricing"
            title="Your Free Trial event is used — each new event comes with its own plan"
            className="press-scale flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Sparkles size={16} /> Get a plan for a new event
          </Link>
        ) : atEventLimit ? (
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
          {trialUsed ? (
            <Link to="/#pricing" className="mt-3 inline-block text-sm font-semibold text-brand-600">
              Get a plan to create an event →
            </Link>
          ) : (
            !atEventLimit && (
              <button onClick={handleCreate} className="mt-3 text-sm font-semibold text-brand-600">
                Create your first event →
              </button>
            )
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
                <div className="mt-1.5 text-[11px] font-semibold">
                  {event.pending_plan_request ? (
                    <span className="text-amber-600">{PLAN_LIMITS[event.pending_plan_request.plan]?.label ?? event.pending_plan_request.plan} • Payment Pending</span>
                  ) : event.plan === 'free' ? (
                    <span className="text-ink-400">Free Trial</span>
                  ) : (
                    <span className="text-brand-600">
                      {PLAN_LIMITS[event.plan]?.label ?? event.plan} • ₱{PLAN_LIMITS[event.plan]?.price} · Paid
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
                  <span className={`text-[11px] font-semibold ${event.status === 'finished' ? 'text-ink-500' : event.is_published ? 'text-brand-600' : 'text-ink-400'}`}>
                    {event.status === 'finished' ? '🔒 Completed' : event.is_published ? 'Published' : 'Draft'}
                  </span>
                  {event.status === 'finished' ? (
                    // Duplicating creates a Free Trial event, so it's only
                    // offered while the account's trial is unused.
                    !trialUsed && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (duplicatingId !== event.id) handleDuplicate(event.id);
                        }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-ink-500 hover:text-ink-800"
                      >
                        <Files size={12} /> {duplicatingId === event.id ? 'Duplicating…' : 'Duplicate'}
                      </span>
                    )
                  ) : (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/events/${event.id}/edit`);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-ink-500 hover:text-ink-800"
                    >
                      <Settings2 size={12} /> Edit
                    </span>
                  )}
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
