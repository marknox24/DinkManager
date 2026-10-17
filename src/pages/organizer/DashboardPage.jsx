import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Clock, Files, HandHelping, Image as ImageIcon, MapPin, Plus, Settings2, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createEvent,
  duplicateEvent,
  getEventMediaUrl,
  getCoverPhotoObjectPosition,
  getOnboardingProgress,
  listMyEvents,
  listMyPendingPlanRequests,
  listStaffedEvents,
} from '../../data/eventsApi';
import { PAID_PLAN_ORDER, PLAN_LIMITS } from '../../data/plans';
import { clearPendingPlan, pendingPlan } from '../../utils/pendingPlan';
import { EVENT_PERMISSIONS } from '../../data/permissions';
import { formatDateRange, formatRelativeTime } from '../../utils/format';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import StatusBadge from '../../components/organizer/StatusBadge';
import GettingStartedChecklist from '../../components/organizer/GettingStartedChecklist';
import WelcomeOnboardingModal from '../../components/organizer/WelcomeOnboardingModal';
import PricingPromptModal from '../../components/organizer/PricingPromptModal';
import PlanApprovedModal from '../../components/organizer/PlanApprovedModal';
import AccountTypeCard from '../../components/ui/AccountTypeCard';

// Where a staffer's event card should link to — their first granted nav
// page, since assuming /overview would 404 into the "no access" panel for
// anyone not granted that toggle.
function firstAllowedNavId(staff) {
  return EVENT_PERMISSIONS.find((p) => p.navId && staff[p.column])?.navId || 'overview';
}

// Includes plan_activated_at in the key so a LATER approval (e.g. an
// upgrade from Starter to Pro) shows its own fresh pop-up even though the
// event's first approval was already acknowledged.
function seenKeyFor(event) {
  return `dm_plan_approved_seen_${event.id}_${event.plan_activated_at}`;
}

// "Starter • ₱699" — shared by the paid-event badge and the pending new-
// event request card so a price never renders with one format in one spot
// and a different one a few lines away.
function planLabel(plan) {
  const p = PLAN_LIMITS[plan];
  return `${p?.label ?? plan} • ₱${p?.price?.toLocaleString('en-PH')}`;
}

export default function DashboardPage() {
  const { user, profile, accountType, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [staffedEvents, setStaffedEvents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  // The pricing pop-up (null = closed, otherwise { plan } to pre-select).
  const [pricing, setPricing] = useState(null);
  // Events with an unacknowledged plan approval — almost always 0 or 1, but
  // kept as a queue in case more than one approval landed between logins.
  const [approvedQueue, setApprovedQueue] = useState([]);
  // This organizer's own pending subscription_requests (both a brand-new
  // event request, event_id null, and an existing event's upgrade request,
  // event_id set — see pendingEventRequests below for the subset shown as
  // its own card). Re-fetched after a fresh submission so the "Waiting for
  // Approval" card appears without a full reload.
  const [pendingRequests, setPendingRequests] = useState([]);
  const welcomeDeferred = useRef(false);

  // One Free Trial event per account (enforced by the database — see
  // events_force_free_entitlements). The profile is loaded once at sign-in,
  // so an event this session just created counts too.
  const trialUsed = Boolean(profile?.free_trial_used_at) || Boolean(events?.some((e) => e.origin === 'trial'));
  // Zero events ever → the one free-trial event, created directly. The
  // moment an organizer has had ANY event (current or past — trialUsed
  // already accounts for a deleted trial event, since deleting doesn't
  // refund it) → every further "Create event" goes through the pricing
  // pop-up and needs admin approval instead of a free direct-create, which
  // the database would otherwise silently reject.
  const hasAnyEvent = trialUsed || Boolean(events?.length);
  const pricingShownKey = `dm_pricing_prompt_${user.id}`;
  // A request for a brand-new event (not an upgrade on one that already
  // exists — those show their own "Payment Pending" badge on the event's
  // own card below, via event.pending_plan_request) has no event_id yet,
  // since the event itself isn't created until the Admiral approves it.
  const pendingEventRequests = pendingRequests.filter((r) => !r.event_id);

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
    Promise.all([listMyEvents(user.id), listStaffedEvents(user.id), listMyPendingPlanRequests(user.email).catch(() => [])])
      .then(([myEvents, staffed, pendingRequests]) => {
        setEvents(myEvents);
        setStaffedEvents(staffed);
        setPendingRequests(pendingRequests);
        const isStaffOnly = myEvents.length === 0 && staffed.length > 0;

        setApprovedQueue(myEvents.filter((e) => e.plan !== 'free' && e.plan_activated_at && localStorage.getItem(seenKeyFor(e)) !== '1'));

        // The pricing pop-up. A plan picked on the website (?plan= or
        // remembered through sign-up — see utils/pendingPlan) always opens it
        // with that plan selected. Otherwise it opens once per login session
        // while an organizer has no paid event and nothing pending review —
        // never for the Admiral or for a helper staffed on someone else's
        // event.
        const urlPlan = searchParams.get('plan');
        const chosenPlan = PAID_PLAN_ORDER.includes(urlPlan) ? urlPlan : pendingPlan();
        if (urlPlan) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('plan');
              return next;
            },
            { replace: true }
          );
        }
        let shownThisSession = false;
        try {
          shownThisSession = sessionStorage.getItem(pricingShownKey) === '1';
        } catch {
          // No session storage — at worst the pop-up shows again next visit.
        }
        const showPricing =
          Boolean(chosenPlan) ||
          (!isAdmin && !isStaffOnly && !myEvents.some((e) => e.plan !== 'free') && pendingRequests.length === 0 && !shownThisSession);
        if (showPricing) setPricing({ plan: chosenPlan });

        const seenKey = `dm_welcome_seen_${user.id}`;
        if (myEvents.length === 0 && staffed.length === 0 && !localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, '1');
          // Never stacked on the pricing pop-up — shown once that's closed.
          if (showPricing) welcomeDeferred.current = true;
          else setShowWelcome(true);
        }
        if (!isStaffOnly) {
          getOnboardingProgress(myEvents)
            .then(setProgress)
            .catch(() => {});
        }
      })
      .catch((e) => pushToast(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, pushToast]);

  const markPricingShown = () => {
    clearPendingPlan();
    try {
      sessionStorage.setItem(pricingShownKey, '1');
    } catch {
      // Best-effort only.
    }
  };

  // Appends an optimistic local entry right after submitting a new plan
  // request, so the "Waiting for Approval" card appears immediately instead
  // of only after a reload — no re-fetch, since everything the card needs
  // (plan, created_at) is already known at the submit call site, and a
  // re-fetch's own failure would otherwise silently leave the card missing.
  const handleRequestSubmitted = (plan) => {
    markPricingShown();
    setPendingRequests((prev) => [...prev, { id: crypto.randomUUID(), plan, event_id: null, email: user.email, created_at: new Date().toISOString() }]);
  };

  const closePricing = () => {
    markPricingShown();
    setPricing(null);
    if (welcomeDeferred.current) {
      welcomeDeferred.current = false;
      setShowWelcome(true);
    }
  };

  const dismissApproval = () => {
    const [current, ...rest] = approvedQueue;
    if (current) localStorage.setItem(seenKeyFor(current), '1');
    setApprovedQueue(rest);
  };

  const updateApprovedEvent = () => {
    const current = approvedQueue[0];
    dismissApproval();
    if (current) navigate(`/events/${current.id}/edit`);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const event = await createEvent(user.id, { name: 'Untitled Tournament', status: 'upcoming', is_published: false });
      navigate(`/events/${event.id}/edit`);
    } catch (e) {
      // The database is the real source of truth on trial eligibility —
      // hasAnyEvent is client state and can still be stale (e.g. a second
      // tab that already used the trial). On that specific rejection
      // (events_force_free_entitlements in schema.sql, errcode
      // check_violation/23514 — same code syncQueue.js already checks for
      // its own plan-limit rejections), route to the pricing flow instead
      // of dead-ending on the trigger's raw message.
      if (e.code === '23514') {
        setPricing({ plan: null });
      } else {
        pushToast(e.message, 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  // Every "create a tournament" entry point routes through this, not
  // handleCreate directly — GettingStartedChecklist and
  // WelcomeOnboardingModal are both shown based on a zero-CURRENT-events
  // signal, which isn't quite the same as hasAnyEvent (an organizer who
  // deleted their only trial event has 0 current events but has already
  // used their trial), so this re-checks hasAnyEvent itself.
  const requestNewEvent = () => {
    if (hasAnyEvent) {
      setPricing({ plan: null });
    } else {
      handleCreate();
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
        {hasAnyEvent ? (
          <button
            onClick={() => setPricing({ plan: null })}
            title="Each additional event needs its own plan — your one Free Trial already created an event"
            className="press-scale flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Sparkles size={16} /> Get a plan for a new event
          </button>
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
        <GettingStartedChecklist progress={progress} latestEventId={events?.[0]?.id} onCreateEvent={requestNewEvent} navigate={navigate} />
      )}

      {pendingEventRequests.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pendingEventRequests.map((req, i) => (
            // Not a button — nothing to open yet, since the event itself
            // doesn't exist until the Admiral approves this request. Just a
            // visible confirmation the request went through.
            <div
              key={req.id}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className="animate-rise-in flex flex-col overflow-hidden rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 text-left shadow-sm"
            >
              <div className="flex h-32 w-full items-center justify-center bg-amber-50 text-amber-300">
                <Clock size={26} />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="font-display text-base font-bold leading-snug text-ink-900">New event request</h2>
                  <StatusBadge status="pending" />
                </div>
                <div className="text-xs font-semibold text-amber-600">
                  {planLabel(req.plan)}
                </div>
                <div className="mt-4 border-t border-amber-100 pt-3 text-[11px] font-semibold text-ink-400">Requested {formatRelativeTime(req.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {events === null && <div className="py-16 text-center text-sm text-ink-400">Loading your events…</div>}

      {events && events.length === 0 && (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white py-16 text-center">
          <p className="text-sm text-ink-500">No tournaments yet.</p>
          {hasAnyEvent ? (
            <button onClick={() => setPricing({ plan: null })} className="mt-3 text-sm font-semibold text-brand-600">
              Get a plan to create an event →
            </button>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <button onClick={handleCreate} className="text-sm font-semibold text-brand-600">
                Start your Free Trial event →
              </button>
              <button onClick={() => setPricing({ plan: null })} className="text-xs font-semibold text-ink-500 hover:text-ink-700">
                or choose a paid plan
              </button>
            </div>
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
                <img loading="lazy" decoding="async"
                  src={getEventMediaUrl(event.cover_photo_path)}
                  alt=""
                  className="h-32 w-full object-cover"
                  style={{ objectPosition: getCoverPhotoObjectPosition(event) }}
                />
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
                    <span className="text-brand-600">{planLabel(event.plan)} · Paid</span>
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
                  <img loading="lazy" decoding="async"
                    src={getEventMediaUrl(event.cover_photo_path)}
                    alt=""
                    className="h-32 w-full object-cover"
                    style={{ objectPosition: getCoverPhotoObjectPosition(event) }}
                  />
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

      {pricing && (
        <PricingPromptModal
          email={user.email}
          initialPlan={pricing.plan}
          canStartTrial={!hasAnyEvent}
          onStartTrial={async () => {
            markPricingShown();
            setPricing(null);
            await handleCreate();
          }}
          onSubmitted={handleRequestSubmitted}
          onClose={closePricing}
        />
      )}

      {showWelcome && (
        <WelcomeOnboardingModal
          onClose={() => setShowWelcome(false)}
          onCreateEvent={() => {
            setShowWelcome(false);
            requestNewEvent();
          }}
        />
      )}

      {approvedQueue.length > 0 && !pricing && !showWelcome && (
        <PlanApprovedModal event={approvedQueue[0]} onClose={dismissApproval} onUpdateEvent={updateApprovedEvent} />
      )}
    </OrganizerLayout>
  );
}
