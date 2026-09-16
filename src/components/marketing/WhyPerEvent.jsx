import { CalendarX, Sprout, TrendingUp } from 'lucide-react';
import Reveal from './Reveal';

const POINTS = [
  { icon: CalendarX, title: 'No monthly commitment', copy: "You don't pay when you're not running an event." },
  { icon: Sprout, title: 'Start small', copy: 'Try the platform before committing to a paid plan.' },
  { icon: TrendingUp, title: 'Scale your event', copy: 'Choose a plan based on the size of your tournament.' },
];

export default function WhyPerEvent() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-5xl px-4">
        <Reveal className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">Only pay when you run a tournament.</h2>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-3">
          {POINTS.map((point, i) => (
            <Reveal key={point.title} delay={i * 80} className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-coral-50">
                <point.icon size={20} className="text-accent-coral-dark" />
              </span>
              <p className="mt-4 text-base font-bold text-ink-900">{point.title}</p>
              <p className="mt-1.5 text-sm text-ink-500">{point.copy}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
