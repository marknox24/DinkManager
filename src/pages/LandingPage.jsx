import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/ui/Logo';
import PhotoGridBackground from '../components/landing/PhotoGridBackground';

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-950 px-4 text-center">
      <PhotoGridBackground />

      <div className="relative z-10 flex flex-col items-center rounded-3xl border border-white/10 bg-white/95 px-8 py-10 shadow-2xl backdrop-blur animate-rise-in sm:px-12">
        <Logo size={52} />
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
    </div>
  );
}
