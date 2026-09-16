import { BarChart3, Bell, ClipboardList, CreditCard, FileText, GitBranch, Network, Trophy, Users } from 'lucide-react';
import Reveal from './Reveal';

const FEATURES = [
  { icon: ClipboardList, title: 'Tournament Registration', copy: 'Online sign-up with custom categories and skill levels.' },
  { icon: Users, title: 'Player Management', copy: 'One roster across every category, team, and event.' },
  { icon: GitBranch, title: 'Categories & Brackets', copy: 'Single elim, double elim, or round robin — auto-generated.' },
  { icon: Network, title: 'Match Scheduling', copy: 'Assign courts and times without a spreadsheet in sight.' },
  { icon: FileText, title: 'Score Sheets', copy: 'Printable or digital score sheets for every match.' },
  { icon: CreditCard, title: 'Payments', copy: 'Collect registration fees and track who’s paid.' },
  { icon: Bell, title: 'Announcements', copy: 'Reach every player and organizer at once.' },
  { icon: Trophy, title: 'Results', copy: 'Final standings, saved and shareable.' },
  { icon: BarChart3, title: 'Tournament Analytics', copy: 'See registrations, revenue, and turnout at a glance.' },
];

export default function FeatureGrid() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">Everything your tournament needs.</h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 60}>
              <div className="hover-lift h-full rounded-2xl border border-ink-100 bg-white p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-coral-50">
                  <f.icon size={18} className="text-accent-coral-dark" />
                </span>
                <p className="mt-3.5 text-[15px] font-bold text-ink-900">{f.title}</p>
                <p className="mt-1 text-sm text-ink-500">{f.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
