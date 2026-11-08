import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Clock3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Reveal from './Reveal';
import CalculatorPanel from './calculator/CalculatorPanel';

// Public, no-login planning tool — lives only on the landing page (this
// section), never inside the authenticated product. Nothing here is
// persisted or synced to a real event; every number is recalculated
// client-side from whatever is currently in the Bracket Builder/Settings.
export default function TournamentTimeCalculator() {
  const { user, loading } = useAuth();
  const panelRef = useRef(null);

  return (
    <section id="calculator" className="bg-ink-50/40 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
            <Clock3 size={12} /> Free planning tool
          </span>
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">Tournament Time Calculator</h2>
          <p className="mt-3 text-ink-500">Plan your brackets, estimate your finish time, and organize every court before tournament day.</p>
          <p className="mt-4 text-xs text-ink-400">
            Estimates depend on match format, match duration, available courts, and rest periods — adjust anything below and every number updates instantly.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="press-scale flex items-center gap-1.5 rounded-full bg-brand-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_24px_-8px_rgba(108,92,231,0.55)] transition hover:bg-brand-700"
            >
              Calculate My Tournament <ArrowDown size={15} />
            </button>
            <Link
              to={!loading && user ? '/dashboard' : '/signup'}
              className="press-scale flex items-center gap-1.5 rounded-full border border-ink-200 px-6 py-3.5 text-sm font-bold text-ink-700 transition hover:border-ink-300"
            >
              Create Your Tournament <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        <div ref={panelRef} className="scroll-mt-24">
          <CalculatorPanel />
        </div>
      </div>
    </section>
  );
}
