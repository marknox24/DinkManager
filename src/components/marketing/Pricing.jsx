import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import Reveal from './Reveal';
import UpgradeModal from './UpgradeModal';
import { PLAN_LIMITS } from '../../data/plans';
import { useAuth } from '../../context/AuthContext';
import { planEntryPath } from '../../utils/pendingPlan';

// Numeric caps come from the shared src/data/plans.js (the same numbers
// EventEditorPage/RegistrationsPage/SettingsPage actually enforce per event)
// so this copy can never drift out of sync with what a plan really grants —
// only the prose feature bullets (CSV import, branding, etc.) stay local,
// since those aren't gated anywhere yet.
const PLANS = [
  {
    key: 'free',
    name: PLAN_LIMITS.free.label,
    price: `₱${PLAN_LIMITS.free.price}`,
    tagline: 'For trying the platform.',
    features: [`${PLAN_LIMITS.free.categories} category`, `Up to ${PLAN_LIMITS.free.playersPerCategory} players/pairs`, `${PLAN_LIMITS.free.courts} court`, 'Basic tournament features', 'No CSV import'],
    cta: 'Try for Free',
    highlighted: false,
  },
  {
    key: 'starter',
    name: PLAN_LIMITS.starter.label,
    price: `₱${PLAN_LIMITS.starter.price}`,
    tagline: 'For small community tournaments.',
    features: [
      `Up to ${PLAN_LIMITS.starter.categories} categories`,
      `Up to ${PLAN_LIMITS.starter.playersPerCategory} players/pairs per category`,
      `Up to ${PLAN_LIMITS.starter.courts} courts`,
      'CSV import',
      'Player registration',
      'Brackets & Round Robin',
      'Match scheduling',
      'Printable score sheets',
      'Player dashboard',
      'Announcements & results',
    ],
    cta: 'Choose Starter',
    highlighted: false,
  },
  {
    key: 'pro',
    name: PLAN_LIMITS.pro.label,
    price: `₱${PLAN_LIMITS.pro.price}`,
    tagline: 'For larger tournaments.',
    features: [
      `Up to ${PLAN_LIMITS.pro.categories} categories`,
      `Up to ${PLAN_LIMITS.pro.playersPerCategory} players/pairs per category`,
      `Up to ${PLAN_LIMITS.pro.courts} courts`,
      'Everything in Starter',
      'Advanced scheduling & brackets',
      'Live tournament status',
      'Tournament analytics',
      'Multiple organizer/staff accounts',
      'Custom tournament branding',
      'CSV import/export',
      'Priority support',
    ],
    cta: 'Choose Pro',
    highlighted: true,
  },
  {
    key: 'business',
    name: PLAN_LIMITS.business.label,
    price: `₱${PLAN_LIMITS.business.price}`,
    tagline: 'For large tournament organizations.',
    features: [
      'Unlimited categories',
      `Up to ${PLAN_LIMITS.business.playersPerCategory} players/pairs per category`,
      `Up to ${PLAN_LIMITS.business.courts} courts`,
      'Everything in Pro',
      'Advanced analytics',
      'Organization branding',
      'Custom registration experience',
      'Advanced exports',
      'Dedicated onboarding',
    ],
    cta: 'Choose Business',
    highlighted: false,
  },
];

export default function Pricing() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Choosing a plan means signing up first (the plan is remembered), or —
  // already signed in — the dashboard's pricing pop-up with it pre-selected.
  const { user, loading } = useAuth();
  const signedIn = !loading && Boolean(user);

  return (
    <section id="pricing" className="bg-ink-50/40 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">
            Simple pricing.
            <br />
            Pay per event.
          </h2>
          <p className="mt-3 text-ink-500">Create your tournament, choose your plan, and pay only for the event you're running.</p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 70}>
              <div
                className={`flex h-full flex-col rounded-3xl border p-6 ${
                  plan.highlighted ? 'border-brand-300 bg-white shadow-[0_24px_48px_-16px_rgba(108,92,231,0.25)] lg:-translate-y-2' : 'border-ink-100 bg-white'
                }`}
              >
                {plan.highlighted && (
                  <span className="mb-3 inline-block w-fit rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold text-white">Most popular</span>
                )}
                <p className="font-display text-lg font-bold text-ink-900">{plan.name}</p>
                <p className="mt-1 text-sm text-ink-500">{plan.tagline}</p>
                <p className="mt-5 font-display text-3xl font-bold text-ink-950">
                  {plan.price}
                  <span className="text-sm font-medium text-ink-400"> / event</span>
                </p>

                <ul className="mt-6 flex flex-1 flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] leading-snug text-ink-600">
                      <Check size={14} className="mt-0.5 shrink-0 text-accent-coral" /> {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to={planEntryPath(plan.key, signedIn)}
                  className={`press-scale mt-7 rounded-full py-3 text-center text-sm font-bold transition ${
                    plan.highlighted ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-ink-200 text-ink-800 hover:border-ink-300'
                  }`}
                >
                  {plan.cta}
                </Link>

                {plan.key === 'free' && (
                  <button
                    onClick={() => setUpgradeOpen(true)}
                    className="press-scale mt-3 text-center text-xs font-semibold text-ink-400 underline decoration-ink-200 underline-offset-2 transition hover:text-ink-600"
                  >
                    Preview: what happens at your limit
                  </button>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </section>
  );
}
