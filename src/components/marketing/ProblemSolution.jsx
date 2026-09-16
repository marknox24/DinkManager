import { BadgeCheck, CalendarClock, CreditCard, FileText, GitBranch, ClipboardList, Megaphone, Trophy } from 'lucide-react';
import useScrollProgress from '../../hooks/useScrollProgress';
import Reveal from './Reveal';

const STEPS = [
  { label: 'Registration', icon: ClipboardList, tool: 'Google Forms', rot: -6, x: -140, y: -70 },
  { label: 'Payments', icon: CreditCard, tool: 'Venmo screenshots', rot: 8, x: 120, y: -90 },
  { label: 'Player verification', icon: BadgeCheck, tool: 'A text thread', rot: -4, x: -180, y: 40 },
  { label: 'Bracket creation', icon: GitBranch, tool: 'Printed bracket', rot: 5, x: 160, y: 10 },
  { label: 'Match scheduling', icon: CalendarClock, tool: 'A spreadsheet', rot: -8, x: -100, y: 130 },
  { label: 'Score sheets', icon: FileText, tool: 'Paper clipboard', rot: 6, x: 90, y: 150 },
  { label: 'Results', icon: Trophy, tool: 'A group chat', rot: -3, x: -40, y: -140 },
  { label: 'Announcements', icon: Megaphone, tool: 'Word of mouth', rot: 4, x: 30, y: 180 },
];

export default function ProblemSolution() {
  const [ref, progress] = useScrollProgress(700);
  const blur = (1 - Math.min(Math.abs(progress - 0.5) * 2.4, 1)) * 3;

  return (
    <section id="product" ref={ref} className="relative bg-white" style={{ minHeight: '190vh' }}>
      <div className="sticky top-24 mx-auto flex h-[min(72vh,640px)] max-w-5xl flex-col items-center justify-center px-4">
        <Reveal className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">Tournaments have enough moving parts.</h2>
          <p className="mt-3 text-ink-500">Stop juggling spreadsheets, messages, player lists, brackets, and paper score sheets.</p>
        </Reveal>

        {/* Desktop/tablet: scroll-linked convergence. Two layers cross-fade
            through a shared blur so it reads as one transformation, not a swap. */}
        <div className="relative hidden h-72 w-full md:block">
          <div className="absolute inset-0" style={{ opacity: 1 - progress, filter: `blur(${blur}px)`, transform: `scale(${1 - progress * 0.06})` }}>
            {STEPS.map((s) => (
              <div
                key={s.label}
                className="absolute left-1/2 top-1/2 w-36 rounded-xl border border-ink-200 bg-white p-2.5 shadow-md"
                style={{ transform: `translate(-50%, -50%) translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)` }}
              >
                <s.icon size={14} className="text-ink-400" />
                <p className="mt-1 text-[11px] font-bold text-ink-800">{s.label}</p>
                <p className="text-[10px] text-ink-400">{s.tool}</p>
              </div>
            ))}
          </div>

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ opacity: progress, filter: `blur(${blur}px)`, transform: `scale(${0.97 + progress * 0.03})` }}
          >
            <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-ink-50/60 p-5 shadow-[0_24px_48px_-16px_rgba(17,23,31,0.18)]">
              <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-wide text-accent-coral">One platform</p>
              <div className="grid grid-cols-2 gap-2">
                {STEPS.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-sm">
                    <s.icon size={13} className="shrink-0 text-accent-coral" />
                    <span className="text-[11px] font-semibold text-ink-700">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: the scroll-driven version costs more than it's worth on a
            small screen, so show the destination state directly. */}
        <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-ink-50/60 p-5 shadow-sm md:hidden">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-wide text-accent-coral">One platform</p>
          <div className="grid grid-cols-2 gap-2">
            {STEPS.map((s) => (
              <div key={s.label} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-sm">
                <s.icon size={13} className="shrink-0 text-accent-coral" />
                <span className="text-[11px] font-semibold text-ink-700">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
