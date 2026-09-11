import { CalendarPlus, Megaphone, Shuffle, Trophy, X } from 'lucide-react';
import Logo from '../ui/Logo';

const STEPS = [
  { icon: CalendarPlus, title: 'Create your tournament', description: 'Name it, pick dates and a location.' },
  { icon: Trophy, title: 'Add categories & registration', description: 'Singles, doubles, fees — whatever your event needs.' },
  { icon: Megaphone, title: 'Publish it', description: 'Players find your event and register themselves.' },
  { icon: Shuffle, title: 'Run the tournament', description: 'Approve players, draw brackets, score live, and share the Preview Screen on-site.' },
];

export default function WelcomeOnboardingModal({ onClose, onCreateEvent }) {
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="animate-modal-in relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-ink-400 hover:bg-ink-50">
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-3 font-display text-xl font-bold text-ink-900">Welcome to DinkManager</h1>
          <p className="mt-1 text-sm text-ink-500">Here's how running a tournament works, start to finish.</p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={16} strokeWidth={2.3} />
                </span>
                <div>
                  <div className="text-sm font-bold text-ink-900">
                    {i + 1}. {step.title}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">{step.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onCreateEvent}
          className="press-scale mt-7 flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          Create your first event
        </button>
        <button onClick={onClose} className="mt-3 w-full text-center text-xs font-semibold text-ink-400 hover:text-ink-600">
          I'll explore on my own
        </button>
      </div>
    </div>
  );
}
