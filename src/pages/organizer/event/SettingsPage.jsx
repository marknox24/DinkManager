import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, Coins, Copy, LayoutGrid, Lock, RefreshCw, Shuffle, Trash2 } from 'lucide-react';
import { deleteEvent, getEventById, regenerateShareToken, setEventVisibility, updateEvent } from '../../../data/eventsApi';
import { CURRENCIES, COURT_TYPES } from '../../../data/constants';
import { PLAN_LIMITS, planLimit } from '../../../data/plans';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import Select from '../../../components/ui/Select';
import Switch from '../../../components/ui/Switch';

export default function SettingsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const { isOwner } = useEventAccess();
  const [event, setEvent] = useState(null);
  const [numCourts, setNumCourts] = useState('');
  const [duration, setDuration] = useState('');
  const [courtType, setCourtType] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getEventById(eventId)
      .then((ev) => {
        setEvent(ev);
        setNumCourts(ev.num_courts ?? 4);
        setDuration(ev.match_duration_minutes ?? 18);
        setCourtType(ev.court_type || '');
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast]);

  const save = async () => {
    let n = parseInt(numCourts, 10);
    let d = parseInt(duration, 10);
    if (Number.isNaN(n) || n < 1) n = 1;
    if (Number.isNaN(d) || d < 1) d = 1;
    const limit = planLimit(event.plan, 'courts');
    if (limit != null && n > limit) {
      pushToast(`Your ${PLAN_LIMITS[event.plan].label} plan allows up to ${limit} courts — raise this event's plan (on the Edit event page) to add more.`, 'error');
      return;
    }
    try {
      const updated = await updateEvent(eventId, { num_courts: n, match_duration_minutes: d, court_type: courtType || null });
      setEvent(updated);
      pushToast('Court settings updated', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
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

  const copyShareLink = () => {
    const url = `${window.location.origin}/t/${event.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">Court capacity, match timing and danger zone</p>
      </div>

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
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
                  Number of courts available <span className="font-normal normal-case text-ink-400">— {PLAN_LIMITS[event.plan]?.label ?? 'Free Trial'} plan allows up to {planLimit(event.plan, 'courts')}</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={planLimit(event.plan, 'courts') ?? 30}
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
    </EventWorkspaceLayout>
  );
}
