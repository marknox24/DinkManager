import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import { useAuth } from '../../context/AuthContext';

export default function ExpiredAccessPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate(profile?.role === 'player' ? '/player/login' : '/login');
  };

  const expiredOn = profile?.access_expires_at
    ? new Date(profile.access_expires_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f6f8] px-4 text-center">
      <Logo size={40} />
      <div className="mt-6 max-w-sm rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <Clock size={22} />
        </span>
        <h1 className="font-display text-lg font-bold text-ink-900">Your access has expired</h1>
        <p className="mt-2 text-sm text-ink-500">
          {expiredOn ? `Your trial access ended on ${expiredOn}.` : 'Your trial access has ended.'} Your data is safe —
          reach out to us to extend or upgrade your account.
        </p>
        <button
          onClick={handleSignOut}
          className="press-scale mt-6 flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
