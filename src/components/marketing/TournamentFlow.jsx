import { useState } from 'react';
import { ClipboardList, GitBranch, PartyPopper, FileText, PlusCircle, Zap } from 'lucide-react';
import Reveal from './Reveal';

const STAGES = [
  { label: 'CREATE', icon: PlusCircle, copy: 'Set up your tournament, categories, and rules in minutes.' },
  { label: 'REGISTER', icon: ClipboardList, copy: 'Players register online and organizers see everything in one place.' },
  { label: 'ORGANIZE', icon: GitBranch, copy: 'Build brackets and schedules automatically — no spreadsheets.' },
  { label: 'PLAY', icon: Zap, copy: 'Keep matches moving with an organized, live schedule.' },
  { label: 'SCORE', icon: FileText, copy: 'Record results on the spot and keep the tournament moving.' },
  { label: 'CELEBRATE', icon: PartyPopper, copy: 'Share results, crown winners, and grow the community.' },
];

export default function TournamentFlow() {
  const [active, setActive] = useState(0);

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">Every tournament, one journey.</h2>
        </Reveal>

        <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
          {STAGES.map((stage, i) => (
            <button
              key={stage.label}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              className={`press-scale flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-bold transition-colors duration-200 sm:px-5 ${
                active === i ? 'border-accent-coral bg-accent-coral text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
              }`}
            >
              <stage.icon size={15} />
              {stage.label}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-8 grid max-w-xl transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: '1fr' }}>
          <div className="overflow-hidden">
            <div key={active} className="animate-rise-in rounded-2xl border border-ink-100 bg-ink-50/60 px-6 py-5 text-center">
              <p className="text-base font-medium text-ink-700">{STAGES[active].copy}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
