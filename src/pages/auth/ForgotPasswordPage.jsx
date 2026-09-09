import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout';

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await resetPasswordForEmail(email);
    setSubmitting(false);
    if (error) {
      pushToast(error.message, 'error');
      return;
    }
    setSent(true);
  };

  return (
    <AuthSplitLayout>
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={44} />
        <h1 className="mt-3 font-display text-xl font-bold text-ink-900">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-500">We'll email you a link to set a new one</p>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CheckCircle2 size={20} />
          </span>
          <p className="text-sm text-ink-600">
            If an account exists for <strong>{email}</strong>, a password reset link is on its way. Check your inbox (and spam folder).
          </p>
        </div>
      ) : (
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
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            <Mail size={15} /> {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-ink-500">
        <Link to="/login" className="font-semibold text-brand-600">
          Organizer sign in
        </Link>
        {' · '}
        <Link to="/player/login" className="font-semibold text-brand-600">
          Player sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
