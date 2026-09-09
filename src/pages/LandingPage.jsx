import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/ui/Logo';

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f6f8] px-4 text-center">
      <Logo size={52} className="animate-rise-in" />
      <h1 className="mt-4 font-display text-3xl font-bold text-ink-900">DinkManager</h1>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        Create pickleball tournaments, open registration to players, and manage everything from one dashboard.
      </p>
      <div className="mt-6 flex items-center gap-3">
        {!loading && user ? (
          <Link to="/dashboard" className="flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">
            Go to your dashboard <ArrowRight size={14} />
          </Link>
        ) : (
          <>
            <Link to="/signup" className="flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">
              Create an event <ArrowRight size={14} />
            </Link>
            <Link to="/login" className="rounded-full border border-ink-200 px-5 py-2.5 text-sm font-bold text-ink-700 transition hover:bg-white">
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
