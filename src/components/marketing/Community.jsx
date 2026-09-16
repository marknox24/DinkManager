import Reveal from './Reveal';

const TILES = [
  { src: '/images/landing/aerial-doubles.jpg', span: 'row-span-2', statement: 'More matches.' },
  { src: '/images/crew/team-group.jpg', span: '', statement: 'More players.' },
  { src: '/images/landing/action-1.jpg', span: '', statement: null },
  { src: '/images/landing/outdoor-court.jpg', span: 'row-span-2', statement: 'More tournaments.' },
  { src: '/images/landing/woman-swing.jpg', span: '', statement: null },
  { src: '/images/crew/two-players-paddles.jpg', span: '', statement: 'More reasons to play.' },
  { src: '/images/landing/man-court.jpg', span: 'row-span-2', statement: null },
  { src: '/images/landing/sunny-day.jpg', span: '', statement: null },
];

export default function Community() {
  return (
    <section className="bg-ink-950 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-accent-coral">More than tournament software</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">It's the infrastructure behind the community.</h2>
          <p className="mt-3 text-ink-300">Real courts, real clubs, real players &mdash; the reason any of this exists.</p>
        </Reveal>

        <div className="grid grid-cols-2 auto-rows-[130px] gap-3 sm:auto-rows-[150px] md:grid-cols-4 md:gap-4">
          {TILES.map((tile, i) => (
            <Reveal key={tile.src} direction="scale" delay={i * 60} className={`relative overflow-hidden rounded-2xl ${tile.span}`}>
              <img src={tile.src} alt="" loading="lazy" className="h-full w-full object-cover" />
              {tile.statement && (
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink-950/80 via-ink-950/0 to-transparent p-3.5">
                  <p className="font-display text-base font-bold text-white sm:text-lg">{tile.statement}</p>
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
