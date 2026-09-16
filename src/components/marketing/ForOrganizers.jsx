import {
  BarChart3,
  CalendarClock,
  CreditCard,
  FileText,
  GitBranch,
  Megaphone,
  Network,
  Users,
} from 'lucide-react';
import BrowserFrame from './mockups/BrowserFrame';
import { DashboardScreen } from './mockups/OrganizerScreens';
import Reveal from './Reveal';

const FEATURES = [
  { icon: Users, label: 'Player registration' },
  { icon: CreditCard, label: 'Payment tracking' },
  { icon: GitBranch, label: 'Category management' },
  { icon: Network, label: 'Bracket generation' },
  { icon: CalendarClock, label: 'Match scheduling' },
  { icon: FileText, label: 'Score sheets' },
  { icon: Megaphone, label: 'Announcements' },
  { icon: BarChart3, label: 'Tournament analytics' },
];

const PINS = [
  { top: '18%', left: '10%', label: '186 players registered', delay: 200 },
  { top: '18%', right: '4%', label: 'Live tournament status', delay: 500 },
  { bottom: '10%', left: '46%', label: 'Categories at a glance', delay: 800 },
];

export default function ForOrganizers() {
  return (
    <section id="organizers" className="bg-ink-950 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Built for the people behind the tournament.</h2>
          <p className="mt-3 text-ink-300">Everything an organizer needs, without living in six different apps.</p>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.label} delay={i * 50} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
                <f.icon size={16} className="shrink-0 text-accent-coral" />
                <span className="text-sm font-semibold text-white">{f.label}</span>
              </Reveal>
            ))}
          </div>

          <Reveal direction="scale" className="relative">
            <BrowserFrame className="mx-auto max-w-md">
              <div className="h-[420px]">
                <DashboardScreen />
              </div>
            </BrowserFrame>

            {PINS.map((pin) => (
              <div
                key={pin.label}
                className="animate-rise-in absolute hidden items-center gap-2 rounded-full bg-ink-950 py-1.5 pl-1.5 pr-3 shadow-lg ring-1 ring-white/10 sm:flex"
                style={{ top: pin.top, left: pin.left, right: pin.right, bottom: pin.bottom, animationDelay: `${pin.delay}ms` }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent-coral animate-pulse-soft" />
                <span className="whitespace-nowrap text-[11px] font-bold text-white">{pin.label}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
