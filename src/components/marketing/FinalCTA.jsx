import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Reveal from './Reveal';

export default function FinalCTA() {
  const { user, loading } = useAuth();

  return (
    <section className="relative overflow-hidden bg-ink-950 py-28">
      <img src="/images/landing/outdoor-court.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-ink-950/60" />

      <div className="relative mx-auto max-w-2xl px-4 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-bold text-white sm:text-5xl">Ready to run your next tournament?</h2>
          <p className="mx-auto mt-5 max-w-md text-ink-300">
            Less time managing spreadsheets.
            <br />
            More time growing your community.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={!loading && user ? '/dashboard' : '/signup'}
              className="press-scale flex items-center gap-1.5 rounded-full bg-brand-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_24px_-8px_rgba(108,92,231,0.55)] transition hover:bg-brand-700"
            >
              Create Your Free Event <ArrowRight size={15} />
            </Link>
            <a href="#product" className="press-scale rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/40">
              Explore the Platform
            </a>
          </div>
          <p className="mt-5 text-xs font-semibold text-ink-400">No credit card required to start.</p>
        </Reveal>
      </div>
    </section>
  );
}
