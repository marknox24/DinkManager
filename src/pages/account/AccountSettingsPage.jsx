import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, ShieldCheck, ShieldOff } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import FormField, { inputClass } from '../../components/ui/FormField';
import AccountTypeCard from '../../components/ui/AccountTypeCard';

function AccountHeader() {
  const { user, profile, signOut } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const homePath = profile?.role === 'player' ? '/player/dashboard' : '/dashboard';

  const handleSignOut = async () => {
    await signOut();
    pushToast('Signed out', 'success');
    navigate(profile?.role === 'player' ? '/player/login' : '/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
        <Link to={homePath} className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-display text-sm font-bold text-ink-900">DinkManager</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-ink-500 sm:inline">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function ChangePasswordCard() {
  const { updatePassword } = useAuth();
  const { pushToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      pushToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (password !== confirmPassword) {
      pushToast('Passwords do not match', 'error');
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      pushToast(error.message, 'error');
      return;
    }
    setPassword('');
    setConfirmPassword('');
    pushToast('Password updated', 'success');
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <KeyRound size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Change password</h2>
          <p className="text-xs text-ink-500">Update the password you use to sign in.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:max-w-sm">
        <FormField label="New password">
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Confirm password">
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

function TwoFactorCard() {
  const { mfaListFactors, mfaEnroll, mfaChallenge, mfaVerify, mfaUnenroll } = useAuth();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [activeFactor, setActiveFactor] = useState(null);
  const [enrolling, setEnrolling] = useState(null); // { factorId, qrCode, secret }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const loadFactors = async () => {
    setLoadingFactors(true);
    const { data, error } = await mfaListFactors();
    setLoadingFactors(false);
    if (error) {
      pushToast(error.message, 'error');
      return;
    }
    setActiveFactor(data?.totp?.find((f) => f.status === 'verified') || null);
  };

  useEffect(() => {
    loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    const { data, error } = await mfaEnroll();
    setBusy(false);
    if (error) {
      pushToast(error.message, 'error');
      return;
    }
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  };

  const handleCancelEnroll = async () => {
    if (enrolling) await mfaUnenroll(enrolling.factorId);
    setEnrolling(null);
    setCode('');
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await mfaChallenge(enrolling.factorId);
      if (challengeError) throw challengeError;
      const { error: verifyError } = await mfaVerify(enrolling.factorId, challenge.id, code);
      if (verifyError) throw verifyError;
      pushToast('Two-factor authentication enabled', 'success');
      setEnrolling(null);
      setCode('');
      await loadFactors();
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    const ok = await confirm({
      title: 'Disable two-factor authentication?',
      message: "You'll only need your password to sign in from now on.",
      confirmLabel: 'Disable 2FA',
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await mfaUnenroll(activeFactor.id);
    setBusy(false);
    if (error) {
      pushToast(error.message, 'error');
      return;
    }
    pushToast('Two-factor authentication disabled', 'success');
    await loadFactors();
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <ShieldCheck size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Two-factor authentication</h2>
          <p className="text-xs text-ink-500">Add a 6-digit code from an authenticator app to your sign-in.</p>
        </div>
      </div>

      {loadingFactors ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : enrolling ? (
        <form onSubmit={handleActivate} className="flex flex-col gap-4 sm:max-w-sm">
          <p className="text-sm text-ink-600">Scan this QR code with Google Authenticator, Authy, or a similar app, then enter the 6-digit code it shows.</p>
          <img src={enrolling.qrCode} alt="2FA QR code" className="h-40 w-40 self-center rounded-xl border border-ink-100 p-2" />
          <p className="break-all rounded-xl bg-ink-50 px-3 py-2 text-center text-[11px] font-mono text-ink-500">{enrolling.secret}</p>
          <FormField label="6-digit code">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className={`${inputClass} text-center font-mono tracking-[0.4em]`}
              autoFocus
            />
          </FormField>
          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? 'Activating…' : 'Activate'}
            </button>
            <button
              type="button"
              onClick={handleCancelEnroll}
              className="rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : activeFactor ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
            <ShieldCheck size={16} /> 2FA is enabled on your account
          </div>
          <button
            onClick={handleDisable}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            <ShieldOff size={13} /> Disable
          </button>
        </div>
      ) : (
        <button
          onClick={handleEnable}
          disabled={busy}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Starting…' : 'Enable 2FA'}
        </button>
      )}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { accountType } = useAuth();
  return (
    <div className="min-h-screen bg-[#f3f6f8]">
      <AccountHeader />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-ink-900">Account & security</h1>
          <p className="text-sm text-ink-500">Manage your password and two-factor authentication.</p>
        </div>
        <div className="flex flex-col gap-5">
          <AccountTypeCard accountType={accountType} />
          <ChangePasswordCard />
          <TwoFactorCard />
        </div>
      </main>
    </div>
  );
}
