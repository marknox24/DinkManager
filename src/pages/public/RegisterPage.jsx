import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, IdCard, Loader2, Receipt, UploadCloud, Users } from 'lucide-react';
import {
  getEventMediaUrl,
  getPublicEventByShareToken,
  getPublicEventBySlug,
  listCategories,
  listRegistrationFields,
  submitRegistration,
  uploadRegistrationFile,
} from '../../data/eventsApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import FormField, { inputClass } from '../../components/ui/FormField';
import ImageDropzone from '../../components/ui/ImageDropzone';

export default function RegisterPage() {
  const { slug, token } = useParams();
  const [searchParams] = useSearchParams();
  const { pushToast } = useToast();
  const { user, profile } = useAuth();
  const isPlayer = profile?.role === 'player';
  const linkBase = token ? `/t/${token}` : `/e/${slug}`;

  const [event, setEvent] = useState(undefined);
  const [categories, setCategories] = useState([]);
  const [fields, setFields] = useState([]);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [categoryId, setCategoryId] = useState(searchParams.get('category') || '');
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [clubName, setClubName] = useState('');
  const [address, setAddress] = useState('');
  const [customValues, setCustomValues] = useState({});
  const [uploadingField, setUploadingField] = useState(null);
  const [player1PhotoPath, setPlayer1PhotoPath] = useState(null);
  const [player1PhotoPreviewUrl, setPlayer1PhotoPreviewUrl] = useState(null);
  const [uploadingPlayer1Photo, setUploadingPlayer1Photo] = useState(false);
  const [player2PhotoPath, setPlayer2PhotoPath] = useState(null);
  const [player2PhotoPreviewUrl, setPlayer2PhotoPreviewUrl] = useState(null);
  const [uploadingPlayer2Photo, setUploadingPlayer2Photo] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [paymentProofPath, setPaymentProofPath] = useState(null);
  const [paymentProofPreviewUrl, setPaymentProofPreviewUrl] = useState(null);
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);

  useEffect(() => {
    const load = token ? getPublicEventByShareToken(token) : getPublicEventBySlug(slug);
    load
      .then(async (ev) => {
        setEvent(ev);
        const [cats, flds] = await Promise.all([listCategories(ev.id), listRegistrationFields(ev.id)]);
        setCategories(cats);
        setFields(flds);
      })
      .catch(() => setEvent(null));
  }, [slug, token]);

  useEffect(() => {
    if (isPlayer && user?.email && !email) setEmail(user.email);
  }, [isPlayer, user?.email, email]);

  const steps = useMemo(() => {
    const s = ['Category', 'Your details'];
    if (fields.length > 0) s.push('More info');
    if (event?.payment_qr_path) s.push('Payment');
    return s;
  }, [fields.length, event]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isDoubles = /doubles/i.test(selectedCategory?.match_type || '');

  const canProceedFromStep = (i) => {
    if (steps[i] === 'Category') return !!categoryId;
    if (steps[i] === 'Your details') {
      const namesOk = isDoubles ? player1Name.trim() && player2Name.trim() : player1Name.trim();
      const photosOk = isDoubles ? !!player1PhotoPath && !!player2PhotoPath : !!player1PhotoPath;
      return namesOk && /\S+@\S+\.\S+/.test(email) && !!phone.trim() && photosOk && termsAgreed;
    }
    if (steps[i] === 'More info') return fields.every((f) => !f.required || (customValues[f.id] && String(customValues[f.id]).trim()));
    if (steps[i] === 'Payment') return !!paymentProofPath;
    return true;
  };

  const handleFileChange = async (field, file) => {
    if (!file) return;
    setUploadingField(field.id);
    try {
      const { path } = await uploadRegistrationFile(event.id, file);
      setCustomValues((prev) => ({ ...prev, [field.id]: path }));
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setUploadingField(null);
    }
  };

  // Previews are a local object URL from the File itself, never a fetched
  // signed URL — the registration-uploads bucket's read policy only allows
  // the organizer/staff to read back a registration's files, never the
  // anonymous player who just uploaded them, so calling
  // getRegistrationFileUrl() here would 404 ("Object not found", Storage's
  // generic error for both "missing" and "not allowed"). The upload itself
  // still goes through normally; only the preview source changes.
  const handlePlayer1PhotoChange = async (file) => {
    if (!file) return;
    setPlayer1PhotoPreviewUrl(URL.createObjectURL(file));
    setUploadingPlayer1Photo(true);
    try {
      const { path } = await uploadRegistrationFile(event.id, file);
      setPlayer1PhotoPath(path);
    } catch (e) {
      pushToast(e.message, 'error');
      setPlayer1PhotoPreviewUrl(null);
    } finally {
      setUploadingPlayer1Photo(false);
    }
  };

  const handlePlayer2PhotoChange = async (file) => {
    if (!file) return;
    setPlayer2PhotoPreviewUrl(URL.createObjectURL(file));
    setUploadingPlayer2Photo(true);
    try {
      const { path } = await uploadRegistrationFile(event.id, file);
      setPlayer2PhotoPath(path);
    } catch (e) {
      pushToast(e.message, 'error');
      setPlayer2PhotoPreviewUrl(null);
    } finally {
      setUploadingPlayer2Photo(false);
    }
  };

  const handlePaymentProofChange = async (file) => {
    if (!file) return;
    setPaymentProofPreviewUrl(URL.createObjectURL(file));
    setUploadingPaymentProof(true);
    try {
      const { path } = await uploadRegistrationFile(event.id, file);
      setPaymentProofPath(path);
    } catch (e) {
      pushToast(e.message, 'error');
      setPaymentProofPreviewUrl(null);
    } finally {
      setUploadingPaymentProof(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitRegistration({
        event_id: event.id,
        category_id: categoryId,
        player_name: player1Name.trim(),
        player2_name: isDoubles ? player2Name.trim() : null,
        player_email: email.trim(),
        phone: phone.trim(),
        club_name: clubName.trim() || null,
        address: address.trim() || null,
        custom_field_values: customValues,
        player_id: isPlayer ? user.id : null,
        photo_path: player1PhotoPath,
        player2_photo_path: isDoubles ? player2PhotoPath : null,
        payment_proof_path: paymentProofPath,
      });
      setSubmitted(true);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (event === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] text-sm text-ink-400">Loading…</div>;
  }
  if (event === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4 text-center text-sm text-ink-500">
        Event not found or not published.
      </div>
    );
  }

  // Mirrors registrations_insert_public's with check in schema.sql (status
  // <> 'finished') — this is the UI half, so a stale/bookmarked/shared
  // register link shows a clear reason instead of a form that would fail
  // to submit. A signed-out visitor lands here from PublicEventPage.jsx's
  // own gating too, but a direct link needs its own check.
  if (event.status === 'finished') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-lg font-bold text-ink-900">Registration closed</h1>
          <p className="mt-2 text-sm text-ink-600">
            <strong>{event.name}</strong> has already ended, so registration is no longer open.
          </p>
          <Link to={linkBase} className="mt-5 inline-block text-sm font-semibold text-brand-600">
            ← Back to event page
          </Link>
        </div>
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
          <h1 className="mt-4 font-display text-xl font-bold text-ink-900">You're registered!</h1>
          <p className="mt-2 text-sm text-ink-600">
            {player1Name}
            {isDoubles && player2Name ? ` & ${player2Name}` : ''}, your registration for <strong>{selectedCategory?.name}</strong> in {event.name} has
            been submitted.
          </p>
          <span className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Status: Pending</span>
          <p className="mt-3 text-xs text-ink-400">The organizer will review your registration and confirm your spot.</p>
          <Link to={linkBase} className="mt-5 inline-block text-sm font-semibold text-brand-600">
            ← Back to event page
          </Link>
          {!isPlayer && (
            <p className="mt-4 text-xs text-ink-400">
              Want to track this registration?{' '}
              <Link to="/player/login" className="font-semibold text-brand-600">
                Sign in
              </Link>{' '}
              or{' '}
              <Link to="/player/signup" className="font-semibold text-brand-600">
                create a player account
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    );
  }

  const currentLabel = steps[step];

  return (
    <div className="min-h-screen bg-[#f3f6f8] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg">
        <Link to={linkBase} className="mb-4 inline-block text-xs font-semibold text-ink-500 hover:text-ink-800">
          ← {event.name}
        </Link>

        <div className="mb-5 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-ink-200'}`} />
          ))}
        </div>

        <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
          <h1 className="mb-4 font-display text-lg font-bold text-ink-900">{currentLabel}</h1>

          {currentLabel === 'Category' && (
            <div className="flex flex-col gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`rounded-xl border p-3 text-left text-sm transition ${
                    categoryId === cat.id ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-300' : 'border-ink-200 hover:bg-ink-50'
                  }`}
                >
                  {cat.image_path && (
                    <img src={getEventMediaUrl(cat.image_path)} alt="" className="mb-2 h-28 w-full rounded-lg object-cover" />
                  )}
                  <div className="font-semibold text-ink-900">{cat.name}</div>
                  <div className="text-xs text-ink-500">
                    {cat.match_type} &middot; {cat.fee_amount > 0 ? `${cat.fee_amount} ${cat.fee_currency}` : 'Free'}
                  </div>
                  {cat.description && <div className="mt-1.5 whitespace-pre-line text-xs text-ink-600">{cat.description}</div>}
                </button>
              ))}
            </div>
          )}

          {currentLabel === 'Your details' && (
            <div className="flex flex-col gap-4">
              {isDoubles && (
                <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-xs font-semibold text-brand-700">
                  <Users size={14} /> {selectedCategory?.match_type} — enter both players on the team.
                </div>
              )}
              <FormField label={isDoubles ? 'Player 1 name' : 'Full name'}>
                <input value={player1Name} onChange={(e) => setPlayer1Name(e.target.value)} className={inputClass} />
              </FormField>
              {isDoubles && (
                <FormField label="Player 2 name">
                  <input value={player2Name} onChange={(e) => setPlayer2Name(e.target.value)} className={inputClass} />
                </FormField>
              )}
              <FormField label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Phone number *" hint="Required — the fastest way for the organizer to reach you.">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Club name" hint="Optional — helps the organizer balance brackets.">
                <input value={clubName} onChange={(e) => setClubName(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Address" hint="Optional">
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label={isDoubles ? 'Player 1 ID photo *' : 'ID photo *'} hint="Required — for identity confirmation.">
                <ImageDropzone
                  imagePath={player1PhotoPath}
                  getUrl={() => player1PhotoPreviewUrl}
                  onUpload={handlePlayer1PhotoChange}
                  uploading={uploadingPlayer1Photo}
                  onRemove={() => {
                    setPlayer1PhotoPath(null);
                    setPlayer1PhotoPreviewUrl(null);
                  }}
                  className="h-32 w-full"
                  emptyIcon={IdCard}
                  emptyLabel="Choose photo"
                />
              </FormField>
              {isDoubles && (
                <FormField label="Player 2 ID photo *" hint="Required — for identity confirmation.">
                  <ImageDropzone
                    imagePath={player2PhotoPath}
                    getUrl={() => player2PhotoPreviewUrl}
                    onUpload={handlePlayer2PhotoChange}
                    uploading={uploadingPlayer2Photo}
                    onRemove={() => {
                      setPlayer2PhotoPath(null);
                      setPlayer2PhotoPreviewUrl(null);
                    }}
                    className="h-32 w-full"
                    emptyIcon={IdCard}
                    emptyLabel="Choose photo"
                  />
                </FormField>
              )}
              <label className="flex items-start gap-2 text-sm text-ink-600">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" className="font-semibold text-ink-600 hover:text-ink-900">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="font-semibold text-ink-600 hover:text-ink-900">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            </div>
          )}

          {currentLabel === 'More info' && (
            <div className="flex flex-col gap-4">
              {fields.map((f) => (
                <FormField key={f.id} label={`${f.label}${f.required ? ' *' : ''}`}>
                  {f.field_type === 'file' ? (
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-3.5 py-3 text-xs font-semibold text-ink-500 transition hover:border-brand-400">
                      {uploadingField === f.id ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      {customValues[f.id] ? 'File uploaded — click to replace' : 'Choose file'}
                      <input type="file" className="hidden" onChange={(e) => handleFileChange(f, e.target.files?.[0])} />
                    </label>
                  ) : (
                    <input
                      type={f.field_type === 'url' ? 'url' : 'text'}
                      value={customValues[f.id] || ''}
                      onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                      className={inputClass}
                    />
                  )}
                </FormField>
              ))}
            </div>
          )}

          {currentLabel === 'Payment' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <img src={getEventMediaUrl(event.payment_qr_path)} alt="Payment QR" className="h-56 w-56 rounded-2xl border border-ink-200 object-contain" />
                <p className="text-xs text-ink-500">Scan to pay the registration fee, then attach proof of payment below.</p>
              </div>
              <FormField label="Proof of payment *" hint="Required — upload a screenshot or photo of your payment confirmation.">
                <ImageDropzone
                  imagePath={paymentProofPath}
                  getUrl={() => paymentProofPreviewUrl}
                  onUpload={handlePaymentProofChange}
                  uploading={uploadingPaymentProof}
                  onRemove={() => {
                    setPaymentProofPath(null);
                    setPaymentProofPreviewUrl(null);
                  }}
                  className="h-32 w-full"
                  emptyIcon={Receipt}
                  emptyLabel="Choose photo"
                />
              </FormField>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-ink-500 disabled:opacity-0"
            >
              <ChevronLeft size={14} /> Back
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceedFromStep(step)}
                className="flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !canProceedFromStep(step)}
                className="flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit registration'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
