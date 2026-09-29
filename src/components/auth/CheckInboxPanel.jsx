import { Link } from 'react-router-dom';
import { Mail, RotateCw } from 'lucide-react';
import useResendVerification from '../../hooks/useResendVerification';

// Shown after signup when email confirmation is required — same persistent
// "sent" swap ForgotPasswordPage.jsx uses, instead of a toast that vanishes
// and leaves the user wondering what to do next.
export default function CheckInboxPanel({ email, onChangeEmail, loginPath }) {
  // Starts cooling down: an email was literally just sent by signUp().
  const { resend, cooldown, sending } = useResendVerification({ startCoolingDown: true });

  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Mail size={22} />
      </span>
      <h2 className="mt-3 font-display text-lg font-bold text-ink-900">Check your inbox ✉️</h2>
      <p className="mt-1.5 text-sm text-ink-600">We've sent a verification email to</p>
      <p className="mt-0.5 break-all text-sm font-semibold text-ink-900">{email}</p>
      <p className="mt-2 text-sm text-ink-500">Click the button in the email to verify your account.</p>

      <div className="mt-5 w-full rounded-2xl bg-ink-50 px-4 py-3.5 text-left">
        <p className="text-xs font-bold text-ink-700">Didn't receive the email?</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-ink-500">
          <li>Check your spam or junk folder</li>
          <li>Make sure the email address is correct</li>
          <li>Try resending the email</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={() => resend(email)}
        disabled={cooldown > 0 || sending}
        className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        <RotateCw size={15} /> {sending ? 'Sending…' : cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
      </button>
      <button type="button" onClick={onChangeEmail} className="mt-3 text-sm font-semibold text-ink-500 hover:text-ink-800">
        Change email
      </button>

      <p className="mt-5 text-sm text-ink-500">
        Already verified?{' '}
        <Link to={loginPath} className="font-semibold text-brand-600">
          Sign in
        </Link>
      </p>
    </div>
  );
}
