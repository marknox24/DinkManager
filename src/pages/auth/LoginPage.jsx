import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout';
import RoleToggle from '../../components/auth/RoleToggle';
import SocialLoginButtons, { SOCIAL_LOGIN_ENABLED } from '../../components/auth/SocialLoginButtons';

const REMEMBER_KEY = 'dinkmanager_remembered_organizer_email';

export default function LoginPage() {
  const { signIn, signOut, getAal, refreshAal, mfaListFactors, mfaChallenge, mfaVerify } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) setEmail(saved);
  }, []);

  const finishLogin = async () => {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    // A specific deep link (e.g. an event page) always wins — only decide
    // by account type when there's nowhere more specific to send them.
    const from = location.state?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    // AuthContext's own profile fetch is async and may not have resolved
    // yet at this exact moment, so this reads is_admin directly rather than
    // risking a stale/not-yet-loaded value from useAuth().
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    navigate(prof?.is_admin ? '/admin' : '/dashboard', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      setSubmitting(false);
      pushToast(error.message, 'error');
      return;
    }
    const { data: aal } = await getAal();
    if (aal && aal.currentLevel !== aal.nextLevel) {
      const { data: factorsData, error: factorsError } = await mfaListFactors();
      setSubmitting(false);
      if (factorsError) {
        pushToast(factorsError.message, 'error');
        return;
      }
      const totpFactor = factorsData?.totp?.find((f) => f.status === 'verified');
      if (!totpFactor) {
        pushToast('Could not find your authenticator factor. Please try again.', 'error');
        return;
      }
      setMfaFactorId(totpFactor.id);
      setStep('mfa');
      return;
    }
    setSubmitting(false);
    await finishLogin();
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await mfaChallenge(mfaFactorId);
      if (challengeError) throw challengeError;
      const { error: verifyError } = await mfaVerify(mfaFactorId, challenge.id, mfaCode);
      if (verifyError) throw verifyError;
      await refreshAal();
      await finishLogin();
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const backToCredentials = async () => {
    await signOut();
    setStep('credentials');
    setMfaCode('');
    setMfaFactorId(null);
  };

  return (
    <AuthSplitLayout>
      {step === 'credentials' ? (
        <>
          <Link to="/" className="mb-4 inline-flex w-fit items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800">
            ← Back to website
          </Link>
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo size={44} />
            <h1 className="mt-3 font-display text-xl font-bold text-ink-900">Welcome back</h1>
            <p className="mt-1 text-sm text-ink-500">Sign in to manage your tournaments</p>
          </div>

          <RoleToggle value="organizer" mode="login" />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wide text-ink-500">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-brand-600">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-400 hover:text-ink-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
              />
              Remember me
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              <LogIn size={15} /> {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {SOCIAL_LOGIN_ENABLED && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-ink-100" />
                <span className="text-xs font-semibold text-ink-400">Or continue with</span>
                <div className="h-px flex-1 bg-ink-100" />
              </div>
              <SocialLoginButtons role="organizer" />
            </>
          )}

          <p className="mt-5 text-center text-sm text-ink-500">
            New organizer?{' '}
            <Link to="/signup" className="font-semibold text-brand-600">
              Create an account
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/20">
              <ShieldCheck size={22} strokeWidth={2.2} />
            </span>
            <h1 className="mt-3 font-display text-xl font-bold text-ink-900">Two-factor verification</h1>
            <p className="mt-1 text-sm text-ink-500">Enter the 6-digit code from your authenticator app</p>
          </div>

          <form onSubmit={handleVerifyMfa} className="flex flex-col gap-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-xl border border-ink-200 px-3.5 py-3 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting || mfaCode.length !== 6}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Verifying…' : 'Verify and sign in'}
            </button>
          </form>

          <button onClick={backToCredentials} className="mt-4 w-full text-center text-sm font-semibold text-ink-500 hover:text-ink-700">
            Use a different account
          </button>
        </>
      )}
    </AuthSplitLayout>
  );
}
