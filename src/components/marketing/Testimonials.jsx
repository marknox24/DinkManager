import Reveal from './Reveal';

// Placeholder quotes — swap in real testimonials once collected.
const TESTIMONIALS = [
  {
    name: 'Alex Rivera',
    role: 'Tournament Organizer',
    org: 'Lakeside Pickleball Club',
    quote: "We ran our first 150-player tournament without a single spreadsheet. Registration and brackets just worked.",
  },
  {
    name: 'Jordan Blake',
    role: 'Club Owner',
    org: 'Riverside Sports Center',
    quote: 'Players stopped calling the front desk asking about their match time. That alone paid for itself.',
  },
  {
    name: 'Sam Okafor',
    role: 'Community Leader',
    org: 'Downtown Dink Collective',
    quote: 'It feels built by people who actually run tournaments, not a generic scheduling tool with a pickleball logo.',
  },
  {
    name: 'Casey Nguyen',
    role: 'Player',
    org: 'Weekend league regular',
    quote: 'I can see my bracket, my next match, and my court number from my phone. That used to mean a paper printout.',
  },
  {
    name: 'Morgan Ellis',
    role: 'Tournament Organizer',
    org: 'Summit Community Sports',
    quote: 'Score sheets, payments, and announcements in one place made our volunteer staff twice as effective.',
  },
];

function initials(name) {
  return name.split(' ').map((n) => n[0]).join('');
}

export default function Testimonials() {
  return (
    <section className="bg-ink-50/40 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">Trusted by organizers and players.</h2>
        </Reveal>
      </div>

      <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:px-[max(1rem,calc(50%-36rem))] [&::-webkit-scrollbar]:hidden">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="hover-lift w-[300px] shrink-0 snap-start rounded-2xl border border-ink-100 bg-white p-6 shadow-sm sm:w-[340px]"
          >
            <p className="text-[15px] leading-relaxed text-ink-700">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-coral-50 text-xs font-bold text-accent-coral-dark">
                {initials(t.name)}
              </span>
              <div>
                <p className="text-sm font-bold text-ink-900">{t.name}</p>
                <p className="text-xs text-ink-500">
                  {t.role} &middot; {t.org}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
