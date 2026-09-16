import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, X } from 'lucide-react';
import { PLAN_LIMITS } from '../../data/plans';

// A preview of the in-app upgrade prompt an organizer sees after hitting a
// Free Trial limit — shown here on the marketing page so visitors can see
// how upgrading feels before they ever hit the wall themselves. Framed as
// help, not a hard stop: the "continue on Free Trial" path is right there,
// equally sized, no dark-pattern emphasis on the paid option.
export default function UpgradeModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="animate-fade-in absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-modal-in relative w-full max-w-sm rounded-3xl border border-ink-100 bg-white p-7 shadow-2xl">
        <button onClick={onClose} className="press-scale absolute right-4 top-4 rounded-full p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700" aria-label="Close">
          <X size={16} />
        </button>

        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-coral-50">
          <Sparkles size={20} className="text-accent-coral-dark" />
        </span>

        <p className="mt-4 font-display text-xl font-bold text-ink-950">Ready for more players?</p>
        <p className="mt-1.5 text-sm text-ink-500">You've reached the Free Trial limit of {PLAN_LIMITS.free.playersPerCategory} players/pairs.</p>

        <div className="mt-5 rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Upgrade to Starter to manage</p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {[
              `${PLAN_LIMITS.starter.playersPerCategory} players/pairs per category`,
              `${PLAN_LIMITS.starter.categories} categories`,
              `${PLAN_LIMITS.starter.courts} courts`,
              'CSV import',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-ink-700">
                <Check size={14} className="shrink-0 text-accent-coral" /> {f}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-display text-lg font-bold text-ink-950">
            ₱{PLAN_LIMITS.starter.price} <span className="text-sm font-medium text-ink-400">/ event</span>
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <Link
            to="/subscribe/starter"
            className="press-scale rounded-full bg-brand-600 py-3 text-center text-sm font-bold text-white transition hover:bg-brand-700"
          >
            Upgrade to Starter
          </Link>
          <button onClick={onClose} className="press-scale rounded-full border border-ink-200 py-3 text-center text-sm font-bold text-ink-700 transition hover:border-ink-300">
            Continue with Free Trial
          </button>
        </div>
      </div>
    </div>
  );
}
