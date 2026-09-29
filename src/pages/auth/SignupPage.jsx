import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, UserPlus } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout';
import RoleToggle from '../../components/auth/RoleToggle';
import CheckInboxPanel from '../../components/auth/CheckInboxPanel';
import SocialLoginButtons, { SOCIAL_LOGIN_ENABLED } from '../../components/auth/SocialLoginButtons';
import { isDuplicateEmailError, isDuplicateSignupResponse } from '../../utils/authErrors';
import { PAID_PLAN_ORDER, PLAN_LIMITS } from '../../data/plans';
import { rememberPlan } from '../../utils/pendingPlan';
import useSeo from '../../hooks/useSeo';

export default function SignupPage() {
  useSeo({
    title: 'Create an Organizer Account — Run Pickleball Tournaments | DinkManager',
    description: 'Sign up free and run your first pickleball tournament with online registration, brackets, scheduling and live scores. Pay per event.',
    path: '/signup',
  });
  const { signUp } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  // A plan picked on the website (?plan=starter): remembered through email
  // confirmation and login, then pre-selected in the dashboard's pricing
  // pop-up — see utils/pendingPlan.
  const [searchParams] = useSearchParams();
  const chosenPlan = PAID_PLAN_ORDER.includes(searchParams.get('plan')) ? searchParams.get('plan') : null;
  useEffect(() => {
    if (chosenPlan) rememberPlan(chosenPlan);
  }, [chosenPlan]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const pushDuplicateEmailToast = () =>
    pushToast(
      <>
        This email already has an account —{' '}
        <Link to="/login" className="underline">
          log in instead
        </Link>
        .
      </>,
      'error'
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      pushToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSubmitting(true);
    const { data, error } = await signUp(email, password, name);
    setSubmitting(false);
    if (error) {
      if (isDuplicateEmailError(error)) {
        pushDuplicateEmailToast();
      } else {
        pushToast(error.message, 'error');
      }
      return;
    }
    // signUp for an already-registered email returns success with no error
    // (see isDuplicateSignupResponse) — without this check it would fall
    // through to the generic "check your email" message below, which is
    // wrong: no confirmation email is actually sent in this case.
    if (isDuplicateSignupResponse(data)) {
      pushDuplicateEmailToast();
      return;
    }
    if (!data.session) {
      setSent(true);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  if (sent) {
    return (
      <AuthSplitLayout>
        <CheckInboxPanel email={email} onChangeEmail={() => setSent(false)} loginPath="/login" />
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <Link to="/" className="mb-4 inline-flex w-fit items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800">
        ← Back to website
      </Link>
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={44} />
        <h1 className="mt-3 font-display text-xl font-bold text-ink-900">Create your organizer account</h1>
        <p className="mt-1 text-sm text-ink-500">Set up and run pickleball tournaments</p>
      </div>

      <RoleToggle value="organizer" mode="signup" />

      {chosenPlan && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-xs text-brand-800">
          <Sparkles size={14} className="mt-0.5 shrink-0" />
          <span>
            You picked <strong>{PLAN_LIMITS[chosenPlan].label}</strong>. Create your account first — right after you log in you'll choose how to pay.
          </span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Your name / club</label>
          <input
            required
            autoComplete="name"
            placeholder="e.g. Juan Dela Cruz or Manila Pickleball Club"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
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
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          <UserPlus size={15} /> {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-center text-xs text-ink-400">
          By creating an account, you agree to our{' '}
          <Link to="/terms" className="font-semibold text-ink-600 hover:text-ink-900">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="font-semibold text-ink-600 hover:text-ink-900">
            Privacy Policy
          </Link>
          .
        </p>
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
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600">
          Sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
