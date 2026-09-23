import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField from '../ui/FormField';
import { getAppSettings, getEventMediaUrl, submitEventPlanUpgrade, uploadSubscriptionProof } from '../../data/eventsApi';
import { PAID_PLAN_ORDER, PLAN_LIMITS } from '../../data/plans';
import { useToast } from '../../context/ToastContext';

// Same manual/QR payment flow as the anonymous SubscribePage.jsx, scoped to
// ONE event: the organizer is already authenticated and owns `event`, so
// unlike that page there's no email field and no account-creation path —
// approving this (see approve-subscription-request) writes the purchased
// plan onto this event alone, never onto the organizer's account or any
// other event they own. No optimistic local plan change on submit; the
// event's plan/entitlements only actually change once an admin approves.
export default function UpgradeEventModal({ event, onClose }) {
  const { pushToast } = useToast();
  const [qrUrl, setQrUrl] = useState(undefined);
  const [plan, setPlan] = useState(null);
  const [screenshotPath, setScreenshotPath] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Only tiers ranked above the event's current plan — no downgrade path,
  // matching how nothing in this app supports downgrading a plan today.
  const currentRank = PAID_PLAN_ORDER.indexOf(event.plan);
  const availablePlans = PAID_PLAN_ORDER.filter((_, i) => i > currentRank);

  useEffect(() => {
    getAppSettings()
      .then((s) => setQrUrl(s.payment_qr_path ? getEventMediaUrl(s.payment_qr_path) : null))
      .catch(() => setQrUrl(null));
  }, []);

  const handlePhotoChange = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { path } = await uploadSubscriptionProof(file);
      setScreenshotPath(path);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!plan) {
      pushToast('Choose a plan first', 'error');
      return;
    }
    if (!screenshotPath) {
      pushToast('Upload a screenshot of your payment first', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submitEventPlanUpgrade({ eventId: event.id, plan, screenshotPath });
      setSubmitted(true);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Modal open onClose={onClose} title="Upgrade submitted" icon={CheckCircle2} maxWidth="max-w-md">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CheckCircle2 size={24} />
          </span>
          <p className="mt-4 text-sm text-ink-600">
            We'll review your {PLAN_LIMITS[plan].label} payment for <strong>{event.name}</strong> shortly — this event stays on{' '}
            {PLAN_LIMITS[event.plan].label} until it's approved. No other event you own is affected.
          </p>
          <button onClick={onClose} className="mt-5 rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Upgrade "${event.name}"`} icon={Sparkles} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-ink-500">This upgrade applies only to this event — every other event you own keeps its own plan.</p>

        {availablePlans.length === 0 ? (
          <p className="rounded-xl bg-ink-50 px-3.5 py-3 text-sm text-ink-600">This event is already on the highest available plan.</p>
        ) : (
          <FormField label="Choose a plan">
            <div className="flex flex-col gap-2">
              {availablePlans.map((p) => {
                const info = PLAN_LIMITS[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                      plan === p ? 'border-brand-600 bg-brand-50' : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-ink-800">{info.label}</div>
                      <div className="text-xs text-ink-500">
                        up to {info.categories ?? 'unlimited'} categories, {info.playersPerCategory} players/cat, {info.courts} courts
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-bold text-ink-800">₱{info.price}</div>
                  </button>
                );
              })}
            </div>
          </FormField>
        )}

        {plan && (
          <>
            <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-ink-50/60 p-4 text-center">
              {qrUrl === undefined && <div className="flex h-40 w-40 items-center justify-center text-xs text-ink-400">Loading QR…</div>}
              {qrUrl === null && (
                <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-ink-300 px-4 text-xs text-ink-400">
                  No payment QR has been set up yet — contact support.
                </div>
              )}
              {qrUrl && <img src={qrUrl} alt="Payment QR" className="h-40 w-40 rounded-2xl border border-ink-200 bg-white object-contain" />}
              <p className="text-xs text-ink-500">Scan to pay ₱{PLAN_LIMITS[plan].price}, then upload a screenshot of the payment below.</p>
            </div>

            <FormField label="Payment screenshot">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-3.5 py-3 text-xs font-semibold text-ink-500 transition hover:border-brand-400">
                {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                {screenshotPath ? 'Uploaded — click to replace' : 'Choose screenshot'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(e.target.files?.[0])} />
              </label>
            </FormField>
          </>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          {availablePlans.length > 0 && (
            <button
              type="submit"
              disabled={submitting || uploadingPhoto || !plan || !screenshotPath}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
