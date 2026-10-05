import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Coins, Copy, Files, LayoutGrid, Lock, MessageCircleQuestion, RefreshCw, Send, Shuffle, Sparkles, Trash2 } from 'lucide-react';
import { deleteEvent, duplicateEvent, getPendingPlanRequestForEvent, regenerateShareToken, setEventVisibility, updateEvent } from '../../../data/eventsApi';
import { addChangeRequestMessage, listChangeRequestMessages, listMyChangeRequests } from '../../../data/changeRequestsApi';
import { CURRENCIES, COURT_TYPES } from '../../../data/constants';
import { PLAN_LIMITS } from '../../../data/plans';
import { usableCourts } from '../../../utils/courts';
import { copyToClipboard } from '../../../utils/clipboard';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import UpgradeEventModal from '../../../components/organizer/UpgradeEventModal';
import ContactAdminModal from '../../../components/organizer/ContactAdminModal';
import Select from '../../../components/ui/Select';
import Switch from '../../../components/ui/Switch';

const REQUEST_TYPE_LABELS = {
  start_date: 'Start date change',
  end_date: 'End date change',
  both_dates: 'Date change',
  extend_registration: 'Extend registration',
  event_info: 'Event information',
  plan_upgrade: 'Plan upgrade',
  billing: 'Billing / payment',
  technical: 'Technical problem',
  other: 'Other',
};

const REQUEST_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  under_review: 'bg-brand-100 text-brand-700',
  waiting_for_organizer: 'bg-violet-50 text-violet-700',
  approved: 'bg-brand-100 text-brand-700',
  rejected: 'bg-rose-100 text-rose-600',
  completed: 'bg-ink-100 text-ink-600',
};

const REQUEST_STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under review',
  waiting_for_organizer: 'Waiting for you',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

// The organizer's own "Track Status" / "Admin Conversation" surface (see
// RequestDateChangeModal.jsx/ContactAdminModal.jsx for how a request gets
// created) — a request row expands into its message thread and lets the
// organizer reply directly, matching the same list-then-expand pattern
// AdminCustomersPage.jsx's own tables use.
function SupportRequestsCard({ eventId }) {
  const { pushToast } = useToast();
  const [requests, setRequests] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const reload = () => {
    listMyChangeRequests(eventId)
      .then((rows) => {
        setRequests(rows);
        setLoadError(null);
      })
      .catch((e) => {
        setLoadError(e.message);
        pushToast(e.message, 'error');
      });
  };

  useEffect(reload, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOpen = async (request) => {
    if (openId === request.id) {
      setOpenId(null);
      return;
    }
    setOpenId(request.id);
    try {
      setMessages(await listChangeRequestMessages(request.id));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const sendReply = async (requestId) => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await addChangeRequestMessage(requestId, reply.trim());
      setReply('');
      setMessages(await listChangeRequestMessages(requestId));
      reload();
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  // Only hides itself for the common "nothing to show yet" case — a failed
  // load still renders, with a retry, rather than silently vanishing.
  if (requests && requests.length === 0 && !loadError) return null;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <MessageCircleQuestion size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Support requests</h2>
          <p className="text-xs text-ink-500">Requests you've sent about this event, and the admin's replies.</p>
        </div>
      </div>
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>Couldn't load your requests — {loadError}</span>
          <button onClick={reload} className="shrink-0 rounded-full border border-rose-200 px-3 py-1 text-xs font-bold hover:bg-rose-100">
            Retry
          </button>
        </div>
      )}
      {requests === null && !loadError ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : requests === null ? null : (
        <div className="flex flex-col divide-y divide-ink-100">
          {requests.map((r) => (
            <div key={r.id} className="py-3">
              <button onClick={() => toggleOpen(r)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                <div>
                  <span className="text-sm font-semibold text-ink-900">{r.request_number}</span>{' '}
                  <span className="text-xs text-ink-500">{REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${REQUEST_STATUS_STYLES[r.status]}`}>
                  {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </button>
              {openId === r.id && (
                <div className="mt-3 rounded-xl bg-ink-50/60 p-3">
                  <div className="flex flex-col gap-2">
                    {messages.map((m) => (
                      <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${m.sender_role === 'admin' ? 'self-start bg-white text-ink-800 shadow-sm' : 'self-end bg-brand-600 text-white'}`}>
                        <div className="mb-0.5 font-bold uppercase tracking-wide opacity-70">{m.sender_role === 'admin' ? 'Admin' : 'You'}</div>
                        {m.message}
                      </div>
                    ))}
                  </div>
                  {r.status !== 'rejected' && r.status !== 'completed' && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Reply…"
                        className="flex-1 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      />
                      <button
                        onClick={() => sendReply(r.id)}
                        disabled={sending || !reply.trim()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
                      >
                        <Send size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const { isOwner, event, setEvent } = useEventAccess();
  const { profile } = useAuth();
  // Lazy initializers: `event` is already populated by the time this page
  // renders (EventAccessBoundary blocks until it is), so these seed from the
  // real event on first render instead of a placeholder that gets replaced
  // a tick later.
  const [numCourts, setNumCourts] = useState(() => usableCourts(event));
  const [duration, setDuration] = useState(() => event.match_duration_minutes ?? 18);
  const [courtType, setCourtType] = useState(() => event.court_type || '');
  const savedStartTime = (event.daily_start_time || '').slice(0, 5);
  const [startTime, setStartTime] = useState(savedStartTime);
  const [copied, setCopied] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [contactAdminOpen, setContactAdminOpen] = useState(false);

  const isLocked = event?.status === 'finished';
  // Duplicating creates a Free Trial event — only one per account (the
  // database refuses the rest), so once it's used the way to run this
  // event again is a new plan purchase.
  const trialUsed = Boolean(profile?.free_trial_used_at);

  const reloadPendingRequest = () => getPendingPlanRequestForEvent(eventId).then(setPendingRequest);

  useEffect(() => {
    getPendingPlanRequestForEvent(eventId)
      .then((pending) => {
        setPendingRequest(pending);
        setPendingLoaded(true);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast]);

  // ?upgrade=1 is how EventEditorPage.jsx/RegistrationsPage.jsx's plan-limit
  // dialogs land here already pointed at the Upgrade Plan modal, instead of
  // dropping the organizer on a page they then have to hunt around on.
  // An upgrade already awaiting payment review isn't opened again — that
  // would let the organizer submit a second request (and pay twice). Gated
  // on `pendingLoaded` rather than `event` (now available immediately from
  // context) so the modal can't flash open before we actually know whether
  // a request is already pending.
  useEffect(() => {
    if (searchParams.get('upgrade') === '1' && pendingLoaded && !isLocked) {
      if (pendingRequest) pushToast('An upgrade for this event is already pending review', 'info');
      else setUpgradeModalOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('upgrade');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, pendingLoaded, isLocked, pendingRequest, pushToast]);

  const save = async () => {
    let n = parseInt(numCourts, 10);
    let d = parseInt(duration, 10);
    if (Number.isNaN(n) || n < 1) n = 1;
    if (Number.isNaN(d) || d < 1) d = 1;
    const limit = event.entitlement_courts;
    if (limit != null && n > limit) {
      const go = await confirm({
        title: 'Court limit reached',
        message: `Your ${PLAN_LIMITS[event.plan].label} plan allows up to ${limit} courts for this event.`,
        confirmLabel: 'Upgrade Event',
        danger: false,
      });
      if (go) setUpgradeModalOpen(true);
      return;
    }
    try {
      const payload = { num_courts: n, match_duration_minutes: d, court_type: courtType || null };
      // Only sent when changed, so saving courts keeps working on a database
      // that hasn't had the daily_start_time column added yet.
      if (startTime !== savedStartTime) payload.daily_start_time = startTime || null;
      const updated = await updateEvent(eventId, payload);
      setEvent(updated);
      pushToast('Court settings updated', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const created = await duplicateEvent(eventId);
      pushToast('Duplicated — pick a plan to get started', 'success');
      navigate(`/events/${created.id}/edit`);
    } catch (e) {
      pushToast(e.message, 'error');
      setDuplicating(false);
    }
  };

  const saveCurrency = async (currency) => {
    try {
      const updated = await updateEvent(eventId, { currency });
      setEvent(updated);
      pushToast('Currency updated', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const toggleAllowSameClub = async (allow) => {
    try {
      const updated = await updateEvent(eventId, { randomizer_allow_same_club: allow });
      setEvent(updated);
      pushToast(allow ? 'Randomizer can now place same-club players together' : 'Randomizer will separate same-club players', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const toggleVisibility = async (makePrivate) => {
    try {
      const updated = await setEventVisibility(eventId, makePrivate ? 'private' : 'public', event.share_token);
      setEvent(updated);
      pushToast(makePrivate ? 'Event is now private' : 'Event is now public', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}/t/${event.share_token}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      pushToast('Could not copy link', 'error');
    }
  };

  const rotateShareLink = async () => {
    const ok = await confirm({
      title: 'Generate a new share link?',
      message: 'The current link stops working immediately — anyone still using it will lose access.',
      confirmLabel: 'Generate new link',
    });
    if (!ok) return;
    try {
      const updated = await regenerateShareToken(eventId);
      setEvent(updated);
      pushToast('New share link generated', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const removeEvent = async () => {
    const ok = await confirm({
      title: `Delete "${event.name}"?`,
      message: 'This permanently removes the event, its categories, and every registration. This cannot be undone.',
      confirmLabel: 'Delete event',
    });
    if (!ok) return;
    try {
      await deleteEvent(eventId);
      pushToast('Event deleted', 'success');
      navigate('/dashboard');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  return (
    <EventWorkspaceLayout event={event}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">Court capacity, match timing and danger zone</p>
      </div>

      {!pendingLoaded ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Sparkles size={17} strokeWidth={2.3} />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink-900">Event plan</h2>
                <p className="text-xs text-ink-500">
                  {isLocked ? 'This event is finished — its plan and entitlements are preserved for the record.' : 'Applies only to this event — every other event you own keeps its own plan.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-ink-50 px-4 py-3.5">
              <div>
                <div className="text-sm font-bold text-ink-800">
                  {PLAN_LIMITS[event.plan]?.label ?? 'Free Trial'}
                  {event.plan !== 'free' && <span className="ml-1.5 font-normal text-ink-500">₱{PLAN_LIMITS[event.plan].price}</span>}
                </div>
                <div className="mt-0.5 text-xs text-ink-500">
                  {event.entitlement_categories ?? 'Unlimited'} categories · {event.entitlement_players_per_category} players/cat · {event.entitlement_courts} courts ·{' '}
                  {event.entitlement_csv_import ? 'Excel import' : 'No Excel import'}
                </div>
                <div className="mt-1.5 text-xs font-semibold">
                  {pendingRequest ? (
                    <span className="text-amber-600">
                      {PLAN_LIMITS[pendingRequest.plan]?.label} upgrade pending review
                    </span>
                  ) : event.plan === 'free' ? (
                    <span className="text-ink-500">Free Trial — no payment required</span>
                  ) : (
                    <span className="text-brand-600">Active · paid</span>
                  )}
                </div>
              </div>
              {isLocked && trialUsed ? (
                <Link
                  to="/#pricing"
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
                >
                  <Sparkles size={13} /> Get a plan for a new event
                </Link>
              ) : isLocked ? (
                <button
                  onClick={handleDuplicate}
                  disabled={duplicating}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-bold text-ink-700 shadow-sm transition hover:bg-ink-100 disabled:opacity-50"
                >
                  <Files size={13} /> {duplicating ? 'Duplicating…' : 'Duplicate Event'}
                </button>
              ) : (
                <button
                  onClick={() => setUpgradeModalOpen(true)}
                  disabled={!!pendingRequest}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles size={13} /> {pendingRequest ? 'Upgrade pending review' : 'Upgrade Plan'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <LayoutGrid size={17} strokeWidth={2.3} />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink-900">Court settings</h2>
                <p className="text-xs text-ink-500">Caps how many matches can be live at once — organizers can't start a new match once every court is in use.</p>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">
                  Number of courts available <span className="font-normal normal-case text-ink-400">— {PLAN_LIMITS[event.plan]?.label ?? 'Free Trial'} plan allows up to {event.entitlement_courts} for this event</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={event.entitlement_courts ?? 30}
                  value={numCourts}
                  onChange={(e) => setNumCourts(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Average match duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
                />
              </div>
              <div>
                <label htmlFor="daily-start-time" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">
                  Daily start time <span className="font-normal normal-case text-ink-400">— when the first match is planned; used for the estimated Match Schedule</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="daily-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
                  />
                  {startTime && (
                    <button type="button" onClick={() => setStartTime('')} className="text-xs font-bold text-ink-400 transition hover:text-ink-700">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Court type</label>
                <Select
                  value={courtType}
                  onChange={(e) => setCourtType(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
                  wrapperClassName="sm:max-w-xs"
                >
                  <option value="">Not specified</option>
                  {COURT_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
              <button onClick={save} className="self-start rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">
                Save settings
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Shuffle size={17} strokeWidth={2.3} />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-ink-900">Club separation</h2>
                  <p className="text-xs text-ink-500">Controls whether the Randomizer can place players from the same club in the same bracket.</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-ink-800">Allow Same-Club Players</div>
                <div className="text-xs text-ink-500">Allow players from the same club in the same bracket</div>
              </div>
              <Switch checked={!!event.randomizer_allow_same_club} onChange={toggleAllowSameClub} />
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Coins size={17} strokeWidth={2.3} />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink-900">Currency</h2>
                <p className="text-xs text-ink-500">Used to display amounts on the Accounting and Sponsors pages for this event.</p>
              </div>
            </div>
            <Select
              value={event.currency || 'USD'}
              onChange={(e) => saveCurrency(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
              wrapperClassName="sm:max-w-xs"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </div>

          <SupportRequestsCard eventId={eventId} />

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <MessageCircleQuestion size={17} strokeWidth={2.3} />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-ink-900">Need help with something else?</h2>
                  <p className="text-xs text-ink-500">Registration, billing, a technical problem — reach the admin directly.</p>
                </div>
              </div>
              <button
                onClick={() => setContactAdminOpen(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink-200 px-3.5 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
              >
                <MessageCircleQuestion size={13} /> Contact Admin
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Lock size={17} strokeWidth={2.3} />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-ink-900">Private event</h2>
                  <p className="text-xs text-ink-500">Hide this event from the public Browse Tournaments list — only people with a share link can find it.</p>
                </div>
              </div>
              <Switch checked={event.visibility === 'private'} onChange={toggleVisibility} />
            </div>
            {event.visibility === 'private' && (
              <div className="flex flex-col gap-2 rounded-xl bg-ink-50 p-3.5">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink-700">
                    {`${window.location.origin}/t/${event.share_token}`}
                  </code>
                  <button
                    onClick={copyShareLink}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
                  >
                    {copied ? <Check size={13} className="text-brand-600" /> : <Copy size={13} />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
                <button
                  onClick={rotateShareLink}
                  className="flex items-center gap-1.5 self-start text-xs font-semibold text-ink-500 hover:text-ink-800"
                >
                  <RefreshCw size={12} /> Generate new link
                </button>
              </div>
            )}
          </div>

          {isOwner && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <AlertTriangle size={17} strokeWidth={2.3} />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-rose-900">Danger zone</h2>
                  <p className="text-xs text-rose-700/80">Irreversible actions — use with care.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-ink-800">Delete this event</div>
                  <div className="text-xs text-ink-500">Removes the event, its categories, and every registration permanently.</div>
                </div>
                <button
                  onClick={removeEvent}
                  className="flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
                >
                  <Trash2 size={13} /> Delete event
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {upgradeModalOpen && event && (
        <UpgradeEventModal
          event={event}
          onClose={() => {
            setUpgradeModalOpen(false);
            reloadPendingRequest();
          }}
        />
      )}
      {contactAdminOpen && event && <ContactAdminModal event={event} onClose={() => setContactAdminOpen(false)} onSubmitted={() => setContactAdminOpen(false)} />}
    </EventWorkspaceLayout>
  );
}
