import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Calendar, Check, CheckCircle2, Copy, CreditCard, ImageIcon, KeyRound, Lock, MailCheck, Pencil, QrCode, RefreshCw, Search, Sparkles, Trash2, UserCheck, UserPlus, XCircle } from 'lucide-react';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import AdminNavLinks from '../../components/admin/AdminNavLinks';
import AccountTypeCard from '../../components/ui/AccountTypeCard';
import ImageDropzone from '../../components/ui/ImageDropzone';
import FormField, { inputClass, textareaClass } from '../../components/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import { daysLeftLabel, generatePassword } from '../../utils/tempAccess';
import {
  adminOverrideEventDates,
  adminSearchEvents,
  adminUpgradeApprovedEventPlan,
  deleteSubscriptionRequest,
  getAppSettings,
  getEventMediaUrl,
  getSubscriptionProofUrl,
  listSubscriptionRequests,
  rejectSubscriptionRequest,
  reopenSubscriptionRequest,
  updateSubscriptionRequestPlan,
  uploadPaymentQr,
} from '../../data/eventsApi';
import { PAID_PLAN_ORDER, PLAN_LIMITS } from '../../data/plans';

function PaymentQrCard() {
  const { pushToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then(setSettings)
      .catch((e) => pushToast(e.message, 'error'));
  }, [pushToast]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadPaymentQr(file);
      setSettings(updated);
      pushToast('Payment QR updated', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <QrCode size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Payment QR</h2>
          <p className="text-xs text-ink-500">Shown to customers on the /subscribe page — scan-to-pay for manual plan subscriptions.</p>
        </div>
      </div>
      {settings && (
        <ImageDropzone
          imagePath={settings.payment_qr_path}
          getUrl={getEventMediaUrl}
          onUpload={handleUpload}
          uploading={uploading}
          className="h-40 w-40"
          emptyIcon={ImageIcon}
          emptyLabel="Upload QR"
        />
      )}
    </div>
  );
}

// What approving (or having approved) a request does, in one line. A
// website purchase (no event yet) creates a new event on its plan; an
// in-app upgrade targets the organizer's existing event. Once approved,
// every request is linked to the event it activated. Approvals from before
// automatic activation only granted an event slot and have no event.
function requestTarget(r) {
  if (r.event) return r.status === 'approved' ? `→ "${r.event.name}"` : `upgrades "${r.event.name}"`;
  if (r.status === 'approved') return 'event slot only (approved before automatic activation)';
  return `creates a new ${PLAN_LIMITS[r.plan]?.label ?? r.plan} event`;
}

// The approve-subscription-request response, spelled out step by step.
function ActivationChecklist({ result }) {
  const planLabel = PLAN_LIMITS[result.plan]?.label ?? result.plan;
  const access =
    result.scope === 'upgrade'
      ? { ok: true, text: 'Organizer already has access' }
      : result.notified === 'invite'
        ? { ok: true, text: 'Organizer access granted — invite email sent' }
        : result.notified === 'sign_in_link'
          ? { ok: true, text: 'Organizer access granted — sign-in link emailed' }
          : { ok: false, text: 'Access granted, but the email could not be sent — share the login manually' };
  const steps = [
    { ok: true, text: 'Payment approved' },
    { ok: true, text: result.eventCreated ? `Event created ("${result.eventName}")` : `Event upgraded ("${result.eventName}")` },
    { ok: true, text: `${planLabel} activated` },
    access,
  ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {steps.map((step) => (
        <li key={step.text} className={`flex items-center gap-1 text-xs font-semibold ${step.ok ? 'text-brand-700' : 'text-amber-700'}`}>
          {step.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {step.text}
        </li>
      ))}
    </ul>
  );
}

// Same three colors the old static badge used, now applied to the Status
// select itself so each row is still scannable at a glance.
const STATUS_SELECT_STYLES = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-brand-200 bg-brand-50 text-brand-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
};

// A one-off compact select style, not FormField's inputClass (py-2.5,
// text-sm) — stacking conflicting size utilities on top of it would leave
// the winner up to Tailwind's generated rule order rather than this
// component's intent, so this table's dropdowns get their own small class.
const PLAN_SELECT_CLASS =
  'w-full rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60';

function RejectRequestModal({ request, onClose, onRejected }) {
  const { pushToast } = useToast();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updated = await rejectSubscriptionRequest(request.id, note.trim() || null);
      onRejected(updated);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Reject request" icon={XCircle}>
      <p className="mb-4 text-sm text-ink-500">
        <strong className="text-ink-800">{request.email}</strong> — {PLAN_LIMITS[request.plan]?.label ?? request.plan}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Note to yourself" hint="Optional — e.g. why the screenshot didn't match.">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} />
        </FormField>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
        >
          {submitting ? 'Rejecting…' : 'Reject request'}
        </button>
      </form>
    </Modal>
  );
}

// screenshot_path for a row created by adminUpgradeApprovedEventPlan() —
// there's no real uploaded file behind this shortcut, so the screenshot
// icon shows disabled/greyed instead of trying to fetch a nonexistent one.
const ADMIN_MANUAL_SCREENSHOT = 'admin-manual-upgrade';

function SubscriptionRequestsList() {
  const location = useLocation();
  const { approveSubscriptionRequest } = useAuth();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const [requests, setRequests] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [planSavingId, setPlanSavingId] = useState(null);
  const [activations, setActivations] = useState({});
  const [rejecting, setRejecting] = useState(null);
  const [upgrading, setUpgrading] = useState(null); // the approved request being moved to a different plan
  const [screenshotPreview, setScreenshotPreview] = useState(null); // { url, email }

  const reload = () => {
    listSubscriptionRequests()
      .then(setRequests)
      .catch((e) => pushToast(e.message, 'error'));
  };

  useEffect(reload, []);

  // The Admiral Dashboard links here as #subscription-requests. React Router
  // doesn't scroll to hashes, and this card only reaches its full height
  // once the list has loaded — so scroll after that, not on mount.
  useEffect(() => {
    if (requests && location.hash === '#subscription-requests') {
      document.getElementById('subscription-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [requests, location.hash]);

  const handleViewScreenshot = async (request) => {
    if (request.screenshot_path === ADMIN_MANUAL_SCREENSHOT) return;
    try {
      const url = await getSubscriptionProofUrl(request.screenshot_path);
      setScreenshotPreview({ url, email: request.email });
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleApprove = async (request) => {
    setApprovingId(request.id);
    try {
      const data = await approveSubscriptionRequest(request.id);
      setActivations((prev) => ({ ...prev, [request.id]: data }));
      pushToast(`${PLAN_LIMITS[data.plan]?.label ?? data.plan} activated for ${data.email}`, 'success');
      reload();
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReopen = async (request) => {
    setBusyId(request.id);
    try {
      const updated = await reopenSubscriptionRequest(request.id);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      pushToast('Request reopened — it can be approved now', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (request) => {
    const ok = await confirm({
      title: `Delete this request from ${request.email}?`,
      confirmLabel: 'Delete',
      message: 'The request and its payment screenshot are permanently removed. This cannot be undone.',
    });
    if (!ok) return;
    setBusyId(request.id);
    try {
      await deleteSubscriptionRequest(request);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      pushToast('Request deleted', 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handlePlanChange = async (request, nextPlan) => {
    if (nextPlan === request.plan) return;
    setPlanSavingId(request.id);
    try {
      const updated = await updateSubscriptionRequestPlan(request.id, nextPlan);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      pushToast(`Plan updated to ${PLAN_LIMITS[nextPlan]?.label ?? nextPlan}`, 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setPlanSavingId(null);
    }
  };

  // The Status column is a dropdown, but "Approved" and "Rejected" aren't
  // plain field writes — approving runs a server-side activation (creates/
  // upgrades the event, can't be undone) and rejecting wants an optional
  // note — so picking either of those re-runs the exact same flows the old
  // Approve/Reject/Reopen buttons did, just from onChange instead of
  // onClick. A native <select> is controlled by request.status, so if the
  // confirm dialog or the reject modal is cancelled, the dropdown simply
  // re-renders back to its real (unchanged) value on its own.
  const handleStatusChange = async (request, nextStatus) => {
    if (nextStatus === request.status) return;
    if (nextStatus === 'rejected') {
      setRejecting(request);
      return;
    }
    if (nextStatus === 'approved') {
      const ok = await confirm({
        title: `Approve ${request.email}'s ${PLAN_LIMITS[request.plan]?.label ?? request.plan} request?`,
        confirmLabel: 'Approve',
        message: "This creates or upgrades their event on this plan and emails them access — it can't be undone from here.",
      });
      if (!ok) return;
      handleApprove(request);
      return;
    }
    // nextStatus === 'pending', i.e. reopening a rejected request.
    handleReopen(request);
  };

  return (
    <div id="subscription-requests" className="scroll-mt-24 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <CreditCard size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Subscription requests</h2>
          <p className="text-xs text-ink-500">Manual QR payments — review the screenshot, then approve or reject.</p>
        </div>
      </div>
      {requests === null && <p className="text-sm text-ink-400">Loading…</p>}
      {requests && requests.length === 0 && <p className="text-sm text-ink-400">No subscription requests yet.</p>}
      {requests && requests.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5 text-left">User</th>
                <th className="px-4 py-2.5 text-left">Plan</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Details</th>
                <th className="px-4 py-2.5 text-left">Submitted</th>
                <th className="px-4 py-2.5 text-left">Screenshot</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const isApproved = r.status === 'approved';
                const isBusy = approvingId === r.id || busyId === r.id;
                return (
                  <tr key={r.id} className="border-b border-ink-50 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{r.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {isApproved && !r.event_id ? (
                        <p className="font-semibold text-ink-700" title="No event was ever linked to this approval — there's nothing to move to a different plan.">
                          {PLAN_LIMITS[r.plan]?.label ?? r.plan}
                        </p>
                      ) : (
                        <Select
                          value={r.plan}
                          disabled={planSavingId === r.id}
                          onChange={(e) => (isApproved ? setUpgrading({ request: r, newPlan: e.target.value }) : handlePlanChange(r, e.target.value))}
                          className={PLAN_SELECT_CLASS}
                          dense
                          title={isApproved ? "Moves the event to a different plan — a new approved row records it, this one stays as-is." : undefined}
                        >
                          {PAID_PLAN_ORDER.map((plan) => (
                            <option key={plan} value={plan}>
                              {PLAN_LIMITS[plan].label}
                            </option>
                          ))}
                        </Select>
                      )}
                      <p className="mt-1 text-[11px] text-ink-400">
                        ₱{Number(r.amount ?? PLAN_LIMITS[r.plan]?.price ?? 0).toLocaleString('en-PH')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={r.status}
                        disabled={isApproved || isBusy}
                        onChange={(e) => handleStatusChange(r, e.target.value)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize disabled:opacity-70 ${STATUS_SELECT_STYLES[r.status]}`}
                        dense
                        title={isApproved ? "Approved requests can't be changed — they're the record of what was paid." : undefined}
                      >
                        {r.status === 'pending' && (
                          <>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </>
                        )}
                        {r.status === 'rejected' && (
                          <>
                            <option value="rejected">Rejected</option>
                            <option value="pending">Pending</option>
                          </>
                        )}
                        {isApproved && <option value="approved">Approved</option>}
                      </Select>
                      {isBusy && <p className="mt-1 text-[11px] text-ink-400">Working…</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {requestTarget(r)}
                      {r.admin_note ? ` · "${r.admin_note}"` : ''}
                      {activations[r.id] && <ActivationChecklist result={activations[r.id]} />}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewScreenshot(r)}
                        disabled={r.screenshot_path === ADMIN_MANUAL_SCREENSHOT}
                        title={r.screenshot_path === ADMIN_MANUAL_SCREENSHOT ? 'No screenshot — entered by admin directly' : 'View payment screenshot'}
                        aria-label="View payment screenshot"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                      >
                        <ImageIcon size={14} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isApproved && (
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={busyId === r.id}
                          title="Delete request"
                          aria-label="Delete request"
                          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-rose-500 transition hover:bg-rose-50 disabled:opacity-60"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rejecting && (
        <RejectRequestModal
          request={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={(updated) => {
            setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setRejecting(null);
          }}
        />
      )}

      {upgrading && (
        <UpgradeApprovedPlanModal
          request={upgrading.request}
          initialPlan={upgrading.newPlan}
          onClose={() => setUpgrading(null)}
          onUpgraded={() => {
            setUpgrading(null);
            reload();
          }}
        />
      )}

      {screenshotPreview && (
        <Modal open onClose={() => setScreenshotPreview(null)} title="Payment screenshot" icon={ImageIcon}>
          <p className="mb-3 text-xs text-ink-500">{screenshotPreview.email}</p>
          <img src={screenshotPreview.url} alt="Payment screenshot" className="max-h-[70vh] w-full rounded-xl border border-ink-100 object-contain" />
        </Modal>
      )}
    </div>
  );
}

// The confirmation for changing an APPROVED request's plan — richer than
// the generic useConfirm() one-liner, since the admin needs to see the real
// price change and can adjust what actually got collected (often a top-up
// difference, not the new plan's full sticker price) before it's recorded.
function UpgradeApprovedPlanModal({ request, initialPlan, onClose, onUpgraded }) {
  const { pushToast } = useToast();
  const currentPlan = request.plan;
  const [newPlan, setNewPlan] = useState(initialPlan);
  const currentPrice = PLAN_LIMITS[currentPlan]?.price ?? 0;
  const newPrice = PLAN_LIMITS[newPlan]?.price ?? 0;
  const [amount, setAmount] = useState(Math.max(0, newPrice - currentPrice));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isDowngrade = newPrice < currentPrice;

  const handlePlanPick = (plan) => {
    setNewPlan(plan);
    setAmount(Math.max(0, (PLAN_LIMITS[plan]?.price ?? 0) - currentPrice));
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminUpgradeApprovedEventPlan(request.id, { newPlan, amount, note: note.trim() || null });
      pushToast(`${request.email}'s event moved to ${PLAN_LIMITS[newPlan]?.label ?? newPlan}`, 'success');
      onUpgraded();
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isDowngrade ? 'Downgrade plan' : 'Upgrade plan'} icon={Sparkles}>
      <form onSubmit={handleConfirm} className="flex flex-col gap-4">
        <p className="text-sm text-ink-600">
          <strong className="text-ink-800">{request.email}</strong>'s event {requestTarget(request)}
        </p>
        <FormField label="New plan">
          <Select value={newPlan} onChange={(e) => handlePlanPick(e.target.value)} className={inputClass}>
            {PAID_PLAN_ORDER.filter((p) => p !== currentPlan).map((plan) => (
              <option key={plan} value={plan}>
                {PLAN_LIMITS[plan].label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="rounded-xl bg-ink-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-500">Current</span>
            <span className="font-semibold text-ink-800">
              {PLAN_LIMITS[currentPlan]?.label} · ₱{currentPrice.toLocaleString('en-PH')}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-ink-500">New</span>
            <span className={`font-semibold ${isDowngrade ? 'text-amber-700' : 'text-brand-700'}`}>
              {PLAN_LIMITS[newPlan]?.label} · ₱{newPrice.toLocaleString('en-PH')}
            </span>
          </div>
        </div>
        <FormField label="Amount to record" hint="Prefilled with the price difference — edit to match what was actually collected.">
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
            className={inputClass}
          />
        </FormField>
        <FormField label="Note" hint="Optional">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} placeholder="e.g. Organizer requested by phone, paid the difference via GCash." />
        </FormField>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : `Confirm ${isDowngrade ? 'downgrade' : 'upgrade'}`}
        </button>
      </form>
    </Modal>
  );
}

// Mirrors the DB check constraint on events.status (schema.sql:133) and the
// same list EventEditorPage.jsx uses — not shared from there since that's an
// organizer-facing page and this one lives entirely in the admin area.
const EVENT_STATUS_OPTIONS = ['upcoming', 'ongoing', 'finished', 'cancelled', 'rescheduled'];

// A compact input/select style for this table's date and status cells — not
// FormField's inputClass (py-2.5, text-sm): see PLAN_SELECT_CLASS above for
// why stacking conflicting size utilities on top of it isn't safe.
const DENSE_FIELD_CLASS =
  'w-full rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

// The product-owner path for updating any event's dates/status on the
// organizer's behalf (see "EVENT OVERRIDE" in schema.sql) — most often an
// event past the 48h freeze that organizers are held to, but also a plain
// reschedule an organizer has simply asked for before it ever locks. Search
// finds any event by name or organizer email; left blank, it shows the
// locked-events default. Saving always asks for confirmation first, since
// this is meant for a genuine request/mistake, not routine editing.
function LockedEventsCard() {
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [edits, setEdits] = useState({}); // event id -> { start_date?, end_date?, status? }
  const [savingId, setSavingId] = useState(null);

  const reload = (q = query) => {
    adminSearchEvents(q)
      .then((rows) => {
        setEvents(rows);
        setLoadError(null);
      })
      .catch((e) => {
        setLoadError(e.message);
        pushToast(e.message, 'error');
      });
  };

  useEffect(reload, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setEvents(null);
    reload(query);
  };

  const fieldValue = (ev, key) => (edits[ev.id]?.[key] !== undefined ? edits[ev.id][key] : (ev[key] ?? ''));

  const setFieldValue = (ev, key, value) => {
    setEdits((prev) => ({ ...prev, [ev.id]: { ...prev[ev.id], [key]: value } }));
  };

  const isDirty = (ev) => Boolean(edits[ev.id]);

  const handleSave = async (ev) => {
    const ok = await confirm({
      title: `Update "${ev.name}"'s dates/status?`,
      message: ev.is_locked
        ? "This event is past the normal 48-hour lock organizers are held to — this bypasses it. Only use it for a genuine reschedule request or mistake."
        : "This changes the event's dates/status directly, on the organizer's behalf.",
      confirmLabel: 'Save',
    });
    if (!ok) return;
    setSavingId(ev.id);
    try {
      const updated = await adminOverrideEventDates(ev.id, {
        startDate: fieldValue(ev, 'start_date') || null,
        endDate: fieldValue(ev, 'end_date') || null,
        status: fieldValue(ev, 'status'),
      });
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, ...updated } : e)));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[ev.id];
        return next;
      });
      pushToast(`"${ev.name}" overridden`, 'success');
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Lock size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Event overrides</h2>
          <p className="text-xs text-ink-500">
            Update any event's dates or status on the organizer's behalf — e.g. a reschedule they asked you to make. Locked events (48h+ past their
            end date, which organizers can no longer change themselves) are listed below by default.
          </p>
        </div>
      </div>
      <form onSubmit={handleSearchSubmit} className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any event by name or organizer email…"
            className={`${inputClass} pl-8`}
          />
        </div>
        <button type="submit" className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 transition hover:bg-ink-50">
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setEvents(null);
              reload('');
            }}
            className="text-xs font-semibold text-ink-400 hover:text-ink-600"
          >
            Clear
          </button>
        )}
      </form>
      {events === null && !loadError && <p className="text-sm text-ink-400">Loading…</p>}
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>Couldn't load events — {loadError}</span>
          <button onClick={() => reload()} className="shrink-0 rounded-full border border-rose-200 px-3 py-1 text-xs font-bold hover:bg-rose-100">
            Retry
          </button>
        </div>
      )}
      {events && events.length === 0 && (
        <p className="text-sm text-ink-400">{query ? `No events match "${query}".` : 'No locked events right now.'}</p>
      )}
      {events && events.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5 text-left">Event</th>
                <th className="px-4 py-2.5 text-left">Organizer</th>
                <th className="px-4 py-2.5 text-left">Start date</th>
                <th className="px-4 py-2.5 text-left">End date</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Override</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-ink-50 align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-ink-900">{ev.name}</p>
                      {ev.is_locked && (
                        <span className="flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600">
                          <Lock size={9} /> Locked
                        </span>
                      )}
                    </div>
                    {ev.auto_finished_at && <p className="text-[11px] text-ink-400">Auto-finished {new Date(ev.auto_finished_at).toLocaleDateString()}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">{ev.organizer_email}</td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={fieldValue(ev, 'start_date')}
                      onChange={(e) => setFieldValue(ev, 'start_date', e.target.value)}
                      className={DENSE_FIELD_CLASS}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={fieldValue(ev, 'end_date')}
                      onChange={(e) => setFieldValue(ev, 'end_date', e.target.value)}
                      className={DENSE_FIELD_CLASS}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={fieldValue(ev, 'status')}
                      onChange={(e) => setFieldValue(ev, 'status', e.target.value)}
                      className={DENSE_FIELD_CLASS}
                      dense
                    >
                      {EVENT_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s[0].toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSave(ev)}
                      disabled={!isDirty(ev) || savingId === ev.id}
                      className="ml-auto flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
                    >
                      <Calendar size={13} /> {savingId === ev.id ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateTrialCard({ onCreated }) {
  const { createTrialAccount } = useAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState('');
  const [days, setDays] = useState(7);
  const [maxEvents, setMaxEvents] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const data = await createTrialAccount({ email, days: Number(days), maxEvents: Number(maxEvents), role: 'organizer' });
      setResult(data);
      setEmail('');
      onCreated?.();
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <UserPlus size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Invite a trial customer</h2>
          <p className="text-xs text-ink-500">Emails an invite link. They set their own password, can create one event, and lose access once it expires.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <FormField label="Customer email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="customer@email.com" />
        </FormField>
        <FormField label="Valid for (days)">
          <input type="number" min={1} required value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Event limit">
          <input type="number" min={1} required value={maxEvents} onChange={(e) => setMaxEvents(e.target.value)} className={inputClass} />
        </FormField>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {result && result.existingAccount && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-700">
          <UserCheck size={16} />
          <span>
            <strong>{result.email}</strong> already had an account, so no invite email was sent — trial access was granted directly.
            They can sign in with their existing password. Up to {result.maxEvents} event{result.maxEvents === 1 ? '' : 's'}, expires in{' '}
            {days} day{Number(days) === 1 ? '' : 's'}.
          </span>
        </div>
      )}
      {result && !result.existingAccount && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-700">
          <MailCheck size={16} />
          <span>
            Invite sent to <strong>{result.email}</strong> — they can create up to {result.maxEvents} event
            {result.maxEvents === 1 ? '' : 's'}, and access expires in {days} day{Number(days) === 1 ? '' : 's'}.
          </span>
        </div>
      )}
    </div>
  );
}

function EditCustomerModal({ customer, onClose, onSaved }) {
  const { updateCustomer } = useAuth();
  const { pushToast } = useToast();
  const [days, setDays] = useState(7);
  const [maxEvents, setMaxEvents] = useState(customer.max_events ?? 1);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await updateCustomer({ userId: customer.id, days: Number(days), maxEvents: Number(maxEvents) });
      pushToast('Customer updated', 'success');
      onSaved(data.customer);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit customer" icon={Pencil}>
      <p className="mb-4 text-sm text-ink-500">
        <strong className="text-ink-800">{customer.email}</strong>
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Extend access to (days from now)">
          <input type="number" min={1} required value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Event limit">
          <input type="number" min={1} required value={maxEvents} onChange={(e) => setMaxEvents(e.target.value)} className={inputClass} />
        </FormField>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  );
}

function SetPasswordModal({ customer, onClose }) {
  const { setCustomerPassword } = useAuth();
  const { pushToast } = useToast();
  const [password, setPassword] = useState(() => generatePassword());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      pushToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await setCustomerPassword({ userId: customer.id, password });
      setDone(true);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Set password" icon={KeyRound}>
      <p className="mb-4 text-sm text-ink-500">
        <strong className="text-ink-800">{customer.email}</strong>
      </p>

      {done ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-700">
            Password set. This is the only time it's shown — copy it now and share it with the customer.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2.5">
            <code className="flex-1 select-all font-mono text-sm text-ink-900">{password}</code>
            <button onClick={handleCopy} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-ink-600 hover:bg-white">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={onClose} className="rounded-xl bg-ink-900 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="New password">
            <div className="flex items-center gap-2">
              <input
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                title="Generate a new random password"
                onClick={() => setPassword(generatePassword())}
                className="flex h-full shrink-0 items-center justify-center rounded-xl border border-ink-200 px-3 text-ink-500 transition hover:bg-ink-50"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </FormField>
          <p className="text-xs text-ink-400">The customer can sign in with this immediately — no email confirmation needed.</p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Setting…' : 'Set password'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function CustomersList({ refreshKey }) {
  const [customers, setCustomers] = useState(null);
  const [editing, setEditing] = useState(null);
  const [settingPassword, setSettingPassword] = useState(null);
  const { deleteCustomer } = useAuth();
  const confirm = useConfirm();
  const { pushToast } = useToast();

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, email, role, access_expires_at, max_events, created_at')
      .not('access_expires_at', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          pushToast(error.message, 'error');
          return;
        }
        setCustomers(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleRemove = async (c) => {
    const ok = await confirm({
      title: `Remove ${c.email}?`,
      confirmLabel: 'Remove',
      message: 'This permanently deletes their login and every event they created. This cannot be undone.',
    });
    if (!ok) return;
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      pushToast('Customer removed', 'success');
    } catch (err) {
      pushToast(err.message, 'error');
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-display text-base font-bold text-ink-900">Issued trial logins</h2>
      {customers === null && <p className="text-sm text-ink-400">Loading…</p>}
      {customers && customers.length === 0 && <p className="text-sm text-ink-400">No trial logins issued yet.</p>}
      {customers && customers.length > 0 && (
        <div className="flex flex-col divide-y divide-ink-100">
          {customers.map((c) => {
            const badge = daysLeftLabel(c.access_expires_at);
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{c.email}</p>
                  <p className="text-xs text-ink-500">
                    {c.role} · up to {c.max_events ?? '∞'} event{c.max_events === 1 ? '' : 's'} · issued{' '}
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {badge && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.tone}`}>{badge.text}</span>}
                  <button
                    title="Edit trial terms"
                    onClick={() => setEditing(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    title="Set password"
                    onClick={() => setSettingPassword(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50"
                  >
                    <KeyRound size={13} />
                  </button>
                  <button
                    title="Remove customer"
                    onClick={() => handleRemove(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-rose-500 transition hover:bg-rose-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditCustomerModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setCustomers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setEditing(null);
          }}
        />
      )}
      {settingPassword && <SetPasswordModal customer={settingPassword} onClose={() => setSettingPassword(null)} />}
    </div>
  );
}

export default function AdminCustomersPage() {
  const { accountType } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <OrganizerLayout backTo="/admin" backLabel="Dashboard">
      <div className="mb-4">
        <AccountTypeCard accountType={accountType} />
      </div>
      <AdminNavLinks />
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Customer logins</h1>
        <p className="text-sm text-ink-500">Issue temporary trial access for customers testing DinkManager.</p>
      </div>
      <div className="flex flex-col gap-5">
        <PaymentQrCard />
        <SubscriptionRequestsList />
        <LockedEventsCard />
        <CreateTrialCard onCreated={() => setRefreshKey((k) => k + 1)} />
        <CustomersList refreshKey={refreshKey} />
      </div>
    </OrganizerLayout>
  );
}
