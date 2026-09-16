import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, UploadCloud } from 'lucide-react';
import { getAppSettings, getEventMediaUrl, submitSubscriptionRequest, uploadSubscriptionProof } from '../../data/eventsApi';
import { PAID_PLAN_ORDER, PLAN_LIMITS } from '../../data/plans';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/ui/Logo';
import FormField, { inputClass } from '../../components/ui/FormField';

// Manual/QR payment flow: no account needed to submit, same anonymous-
// upload pattern RegisterPage.jsx already uses for registration proof
// photos. Scan the QR, pay, tell us your email, upload your receipt — an
// admin reviews it from /admin/customers and approves/rejects.
export default function SubscribePage() {
  const { plan } = useParams();
  const { pushToast } = useToast();
  const [qrUrl, setQrUrl] = useState(undefined);
  const [email, setEmail] = useState('');
  const [screenshotPath, setScreenshotPath] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const planInfo = PLAN_LIMITS[plan];
  const validPlan = PAID_PLAN_ORDER.includes(plan);

  useEffect(() => {
    if (!validPlan) return;
    getAppSettings()
      .then((s) => setQrUrl(s.payment_qr_path ? getEventMediaUrl(s.payment_qr_path) : null))
      .catch(() => setQrUrl(null));
  }, [validPlan]);

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
    if (!screenshotPath) {
      pushToast('Upload a screenshot of your payment first', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submitSubscriptionRequest({ email: email.trim(), plan, screenshotPath });
      setSubmitted(true);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!validPlan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4 text-center text-sm text-ink-500">
        Unknown plan. <Link to="/#pricing" className="ml-1 font-semibold text-brand-600">Back to pricing</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CheckCircle2 size={24} />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-ink-900">Thanks — we'll review it</h1>
          <p className="mt-2 text-sm text-ink-600">
            We'll confirm your {planInfo.label} payment and email <strong>{email}</strong> once it's approved, with a link to set your password.
          </p>
          <Link to="/" className="mt-5 inline-block text-sm font-semibold text-brand-600">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6f8] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg">
        <Link to="/#pricing" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-ink-500 hover:text-ink-800">
          <Logo size={20} /> ← Back to pricing
        </Link>

        <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
          <h1 className="font-display text-lg font-bold text-ink-900">Subscribe to {planInfo.label}</h1>
          <p className="mt-1 text-sm text-ink-500">
            ₱{planInfo.price} <span className="text-ink-400">/ event</span> — up to {planInfo.categories ?? 'unlimited'} categories,{' '}
            {planInfo.playersPerCategory} players/pairs per category, {planInfo.courts} courts.
          </p>

          <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl bg-ink-50/60 p-5 text-center">
            {qrUrl === undefined && <div className="flex h-56 w-56 items-center justify-center text-xs text-ink-400">Loading QR…</div>}
            {qrUrl === null && (
              <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-dashed border-ink-300 px-4 text-xs text-ink-400">
                No payment QR has been set up yet — contact the site owner.
              </div>
            )}
            {qrUrl && <img src={qrUrl} alt="Payment QR" className="h-56 w-56 rounded-2xl border border-ink-200 bg-white object-contain" />}
            <p className="text-xs text-ink-500">Scan to pay, then submit your email and a screenshot of the payment below.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <FormField label="Your email" hint="We'll send your login link here once approved.">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Payment screenshot">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-3.5 py-3 text-xs font-semibold text-ink-500 transition hover:border-brand-400">
                {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                {screenshotPath ? 'Uploaded — click to replace' : 'Choose screenshot'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(e.target.files?.[0])} />
              </label>
            </FormField>
            <button
              type="submit"
              disabled={submitting || uploadingPhoto || !screenshotPath}
              className="flex items-center justify-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
