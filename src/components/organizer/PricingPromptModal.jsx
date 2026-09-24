import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Compass, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { getAppSettings, getEventMediaUrl, submitSubscriptionRequest, uploadSubscriptionProof } from '../../data/eventsApi';
import { PAID_PLAN_ORDER, PLAN_LIMITS } from '../../data/plans';

// The in-app plan purchase: shown on the organizer dashboard after sign-up/
// login (see DashboardPage for when), replacing the old anonymous
// /subscribe page. Pick a plan, pay with the platform QR, upload the
// screenshot — the request is filed under the signed-in email, and once the
// Admiral approves it a new event on that plan is created automatically
// (approve-subscription-request). Organizers can skip it: "Start with Free
// Trial" (while their one trial is unused) or "Explore first".
function planFeatures(plan) {
  const p = PLAN_LIMITS[plan];
  return [
    `${p.categories ?? 'Unlimited'} ${p.categories === 1 ? 'category' : 'categories'}`,
    `Up to ${p.playersPerCategory} players/pairs per category`,
    `Up to ${p.courts} courts`,
    p.csvImport ? 'Excel import' : 'No Excel import',
  ];
}

export default function PricingPromptModal({ email, initialPlan, canStartTrial, onStartTrial, onSubmitted, onClose }) {
  const { pushToast } = useToast();
  const [plan, setPlan] = useState(initialPlan ?? null);
  const [step, setStep] = useState(initialPlan ? 'pay' : 'choose'); // choose | pay | sent
  const [qrUrl, setQrUrl] = useState(undefined);
  const [screenshotPath, setScreenshotPath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then((s) => setQrUrl(s.payment_qr_path ? getEventMediaUrl(s.payment_qr_path) : null))
      .catch(() => setQrUrl(null));
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { path } = await uploadSubscriptionProof(file);
      setScreenshotPath(path);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitSubscriptionRequest({ email, plan, screenshotPath });
      setStep('sent');
      onSubmitted?.();
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      await onStartTrial();
    } finally {
      setStartingTrial(false);
    }
  };

  const info = plan ? PLAN_LIMITS[plan] : null;

  return (
    <Modal open onClose={onClose} title={step === 'sent' ? 'Request sent' : 'Choose a plan for your event'} icon={Sparkles} maxWidth="max-w-2xl">
      {step === 'sent' ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CheckCircle2 size={24} />
          </span>
          <p className="max-w-md text-sm text-ink-600">
            Thanks! Once your payment is approved, your <strong className="text-ink-900">{info.label}</strong> event is created automatically and we'll
            email <strong className="text-ink-900">{email}</strong>.
          </p>
          <button
            onClick={onClose}
            className="mt-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800 active:scale-[0.97]"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {step === 'choose' ? (
            <>
              <p className="text-sm text-ink-600">One payment covers one event. Pick the plan that fits your tournament — you can also explore first.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PAID_PLAN_ORDER.map((key) => {
                  const p = PLAN_LIMITS[key];
                  const selected = key === plan;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setPlan(key);
                        setStep('pay');
                      }}
                      className={`flex flex-col rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                        selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-ink-200 hover:border-brand-300 hover:bg-ink-50'
                      }`}
                    >
                      <span className="font-display text-base font-bold text-ink-900">{p.label}</span>
                      <span className="mt-0.5 font-display text-xl font-bold text-ink-950">
                        ₱{p.price.toLocaleString('en-PH')} <span className="text-xs font-medium text-ink-400">/ event</span>
                      </span>
                      <ul className="mt-3 flex flex-col gap-1">
                        {planFeatures(key).map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs text-ink-600">
                            <Check size={12} className="mt-0.5 shrink-0 text-brand-600" /> {f}
                          </li>
                        ))}
                      </ul>
                      <span className="mt-3 rounded-full bg-brand-600 py-1.5 text-center text-xs font-bold text-white">Choose {p.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink-50/70 px-4 py-3">
                <div>
                  <p className="font-display text-base font-bold text-ink-900">
                    {info.label} · ₱{info.price.toLocaleString('en-PH')} <span className="text-xs font-medium text-ink-400">/ event</span>
                  </p>
                  <p className="text-xs text-ink-500">{planFeatures(plan).join(' · ')}</p>
                </div>
                <button
                  onClick={() => setStep('choose')}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-ink-600 transition hover:bg-white"
                >
                  <ArrowLeft size={12} /> Change plan
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="flex flex-col items-center gap-2">
                  {qrUrl === undefined && <div className="flex h-44 w-44 items-center justify-center text-xs text-ink-400">Loading QR…</div>}
                  {qrUrl === null && (
                    <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-dashed border-ink-300 px-4 text-center text-xs text-ink-400">
                      No payment QR has been set up yet — contact the site owner.
                    </div>
                  )}
                  {qrUrl && <img src={qrUrl} alt="Payment QR" className="h-44 w-44 rounded-2xl border border-ink-200 bg-white object-contain" />}
                  <p className="text-xs font-semibold text-ink-600">Scan to pay ₱{info.price.toLocaleString('en-PH')}</p>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Your account</p>
                    <p className="text-sm font-semibold text-ink-800">{email}</p>
                    <p className="text-xs text-ink-500">Your {info.label} event is created on this account once approved.</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Payment screenshot</p>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-3.5 py-3 text-xs font-semibold text-ink-500 transition hover:border-brand-400">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      {screenshotPath ? 'Uploaded — click to replace' : 'Choose screenshot'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
                    </label>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || uploading || !screenshotPath}
                    className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Submit request'}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4">
            {canStartTrial ? (
              <button
                onClick={handleStartTrial}
                disabled={startingTrial}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-4 py-2 text-sm font-bold text-ink-700 transition hover:bg-ink-50 active:scale-[0.97] disabled:opacity-60"
              >
                <Sparkles size={14} /> {startingTrial ? 'Starting…' : 'Start with Free Trial'}
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-ink-500 transition hover:bg-ink-100"
            >
              <Compass size={14} /> Explore first
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
