import { useState } from 'react';
import { CalendarPlus, CheckCircle2, ChevronDown, Circle, Megaphone, Shuffle, Trophy, UserCheck } from 'lucide-react';

const STEPS = [
  {
    key: 'hasEvent',
    icon: CalendarPlus,
    title: 'Create your tournament',
    description: 'Name it, set the dates and location.',
    cta: 'Create event',
  },
  {
    key: 'hasCategory',
    icon: Trophy,
    title: 'Set up categories',
    description: 'Add singles/doubles divisions and the registration form.',
    cta: 'Add categories',
    path: (eventId) => `/events/${eventId}/edit`,
  },
  {
    key: 'hasPublished',
    icon: Megaphone,
    title: 'Publish & open registration',
    description: 'Make it live so players can find and join it.',
    cta: 'Publish',
    path: (eventId) => `/events/${eventId}/edit`,
  },
  {
    key: 'hasApprovedRegistration',
    icon: UserCheck,
    title: 'Approve your players',
    description: 'Review incoming registrations and approve them.',
    cta: 'Review',
    path: (eventId) => `/events/${eventId}/manage`,
  },
  {
    key: 'hasBracket',
    icon: Shuffle,
    title: 'Draw brackets & start scoring',
    description: 'Generate brackets, then log match results as you go.',
    cta: 'Go to brackets',
    path: (eventId) => `/events/${eventId}/brackets`,
  },
];

export default function GettingStartedChecklist({ progress, latestEventId, onCreateEvent, navigate }) {
  const [expanded, setExpanded] = useState(true);

  const doneCount = STEPS.filter((s) => progress[s.key]).length;
  if (doneCount === STEPS.length) return null;

  const handleGoTo = (step) => {
    if (step.key === 'hasEvent') {
      onCreateEvent();
      return;
    }
    if (latestEventId) navigate(step.path(latestEventId));
  };

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <div>
          <div className="font-display text-sm font-bold text-ink-900">Getting started</div>
          <div className="text-xs text-ink-500">{doneCount} of {STEPS.length} steps complete</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-ink-100 sm:block">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
          </div>
          <ChevronDown size={16} className={`text-ink-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-ink-100 px-2 pb-2 pt-1 sm:px-3 sm:pb-3">
          {STEPS.map((step) => {
            const done = progress[step.key];
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                {done ? <CheckCircle2 size={19} className="shrink-0 text-brand-600" /> : <Circle size={19} className="shrink-0 text-ink-200" />}
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${done ? 'bg-brand-50 text-brand-600' : 'bg-ink-50 text-ink-400'}`}>
                  <Icon size={15} strokeWidth={2.3} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${done ? 'text-ink-400 line-through decoration-ink-200' : 'text-ink-900'}`}>{step.title}</div>
                  <div className="truncate text-xs text-ink-500">{step.description}</div>
                </div>
                {!done && (
                  <button onClick={() => handleGoTo(step)} className="shrink-0 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700 transition hover:bg-ink-50">
                    {step.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
