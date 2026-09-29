import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, RotateCw } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout';
import useResendVerification from '../../hooks/useResendVerification';

// Where signUp()'s emailRedirectTo lands. Same shape as ResetPasswordPage:
// supabase-js processes the link on load (detectSessionInUrl), so a session
// here means the email was verified; no session means the link was
// invalid, expired, or already used — Supabase's single-use tokens fail
// the same way in all three cases, so they share one message.
export default function VerifyEmailPage() {
  const { user, loading, profile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const { resend, cooldown, sending } = useResendVerification();

  if (loading || (user && profileLoading)) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] text-sm text-ink-400">Verifying your email…</div>;
  }

  if (user) {
    const firstName = (user.user_metadata?.display_name || '').trim().split(/\s+/)[0];
    const isPlayer = profile?.role === 'player';
    return (
      <AuthSplitLayout>
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CheckCircle2 size={28} />
          </span>
          <span className="mt-4 text-xs font-bold uppercase tracking-wide text-brand-600">Email verified</span>
          <h1 className="mt-1 font-display text-xl font-bold text-ink-900">You're all set{firstName ? `, ${firstName}` : ''}!</h1>
          <p className="mt-1.5 text-sm text-ink-500">Your DinkManager account is now verified.</p>
          <p className="mt-1 text-sm text-ink-500">
            {isPlayer ? "Let's find your next tournament." : "Let's get your next tournament organized."}
          </p>
          <button
            onClick={() => navigate(isPlayer ? '/player/dashboard' : '/dashboard', { replace: true })}
            className="mt-6 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            Continue to DinkManager
          </button>
        </div>
      </AuthSplitLayout>
    );
  }

  const handleResend = async (e) => {
    e.preventDefault();
    await resend(email.trim());
  };

  return (
    <AuthSplitLayout>
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={44} />
        <span className="mt-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Clock size={20} />
        </span>
        <h1 className="mt-3 font-display text-xl font-bold text-ink-900">This link has expired</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Verification links expire after 24 hours and can only be used once. Don't worry — you can request a new one.
        </p>
      </div>

      <form onSubmit={handleResend} className="flex flex-col gap-4">
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
        <button
          type="submit"
          disabled={cooldown > 0 || sending}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          <RotateCw size={15} /> {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send new verification email'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-500">
        Already verified?{' '}
        <Link to="/login" className="font-semibold text-brand-600">
          Sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
