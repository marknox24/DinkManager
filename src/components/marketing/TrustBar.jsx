import Counter from './Counter';
import Reveal from './Reveal';

const AUDIENCES = ['Tournament Organizers', 'Clubs', 'Players', 'Coaches', 'Community Groups'];

// Placeholder stats — swap in real production numbers once available.
const STATS = [
  { value: 10000, suffix: '+', label: 'Players' },
  { value: 500, suffix: '+', label: 'Tournaments' },
  { value: 100, suffix: '+', label: 'Organizers' },
  { value: 50, suffix: '+', label: 'Communities' },
];

export default function TrustBar() {
  return (
    <section className="border-y border-ink-100 bg-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-ink-400">Built for the people who make sports happen</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {AUDIENCES.map((a) => (
              <span key={a} className="rounded-full border border-ink-200 px-4 py-1.5 text-sm font-semibold text-ink-600">
                {a}
              </span>
            ))}
          </div>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 60} className="text-center">
              <p className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">
                <Counter value={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-sm font-medium text-ink-500">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
