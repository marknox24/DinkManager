import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, CircleDot, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { HERO_CARDS } from './hero/heroCards';
import BrowserFrame from './mockups/BrowserFrame';

gsap.registerPlugin(ScrollTrigger);

const SCROLL_VH = 320;

function HeroCopy() {
  const { user, loading } = useAuth();
  return (
    <div className="relative z-10 flex flex-col items-center px-4 text-center">
      <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
        <CircleDot size={12} className="text-accent-coral" /> Built for pickleball &amp; community sports
      </span>
      <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
        Run tournaments.
        <br />
        Build communities.
      </h1>
      <p className="mt-5 max-w-xl text-balance text-base text-ink-200 sm:text-lg">
        Registration, brackets, scheduling, score sheets, results and more
        &mdash; all in one place.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          to={!loading && user ? '/dashboard' : '/signup'}
          className="press-scale flex items-center gap-1.5 rounded-full bg-brand-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_24px_-8px_rgba(108,92,231,0.55)] transition hover:bg-brand-700"
        >
          Create Your Event <ArrowRight size={15} />
        </Link>
        <a href="#product" className="press-scale rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition hover:border-white/40">
          See How It Works
        </a>
      </div>
      <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent-coral">
        <Ticket size={15} /> Pay per event. No monthly commitment.
      </p>
    </div>
  );
}

function HeroCard({ card, innerRef, style }) {
  const { Screen } = card;
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{ width: card.width, height: card.height, marginLeft: -card.width / 2, marginTop: -card.height / 2 }}
    >
      <div ref={innerRef} className="h-full w-full [transform-style:preserve-3d] [will-change:transform]" style={style}>
        <BrowserFrame className={card.hero ? 'shadow-[0_50px_100px_-30px_rgba(0,0,0,0.65)]' : 'shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)]'}>
          <div style={{ height: card.height - 34 }}>
            <Screen />
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}

// Static build (no scroll-jacking) for prefers-reduced-motion: cards sit in
// their finished, organized layout with no track, no tween, no tall section.
function StaticHero() {
  return (
    <section className="relative overflow-hidden bg-ink-950 pb-20 pt-32 sm:pt-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 h-[600px] -translate-y-1/2 bg-[radial-gradient(45%_60%_at_50%_50%,rgba(255,107,107,0.12),transparent)]"
      />
      <HeroCopy />
      <div className="relative mx-auto mt-14 h-[420px] max-w-5xl px-4">
        <div className="relative h-full w-full origin-center scale-[0.5] [perspective:1600px] sm:scale-75 lg:scale-100">
          {HERO_CARDS.map((card) => (
            <HeroCard
              key={card.id}
              card={card}
              innerRef={() => {}}
              style={{
                transform: `translate3d(${card.dock.x}px, ${card.dock.y}px, ${card.dock.z}px) rotateX(${card.dock.rotateX}deg) rotateY(${card.dock.rotateY}deg) rotateZ(${card.dock.rotateZ}deg) scale(${card.dock.scale})`,
                zIndex: card.hero ? 50 : 30,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// Animated build: a tall pinned stage where scattered, dimmed product
// screens settle into an organized stack as the visitor scrolls — the
// same "scattered → organized" story as before, told with the real UI
// instead of abstract labeled shapes.
function AnimatedHero() {
  const sectionRef = useRef(null);
  const cardRefs = useRef([]);
  const captionRef = useRef(null);
  const [trackHeight, setTrackHeight] = useState(() => (typeof window === 'undefined' ? 0 : window.innerHeight * (SCROLL_VH / 100)));

  useEffect(() => {
    const onResize = () => {
      setTrackHeight(window.innerHeight * (SCROLL_VH / 100));
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
      });

      HERO_CARDS.forEach((card, i) => {
        const el = cardRefs.current[i];
        if (!el) return;
        gsap.set(el, { ...card.scatter });
        tl.to(el, { ...card.dock, ease: 'none', duration: 0.7 }, i * 0.05);
      });

      tl.fromTo(captionRef.current, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.15, ease: 'none' }, 0.72);
    }, sectionRef);

    return () => ctx.revert();
  }, [trackHeight]);

  return (
    <section ref={sectionRef} className="relative bg-ink-950" style={{ height: `${trackHeight}px` }}>
      <div className="sticky top-0 flex h-screen flex-col items-center overflow-hidden pb-8 pt-32 sm:pt-40">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 h-[600px] -translate-y-1/2 bg-[radial-gradient(45%_60%_at_50%_50%,rgba(255,107,107,0.12),transparent)]"
        />

        <HeroCopy />

        <div className="relative mt-10 w-full max-w-5xl flex-1 px-4">
          <div className="relative h-full w-full origin-center scale-[0.5] [perspective:1600px] sm:scale-75 lg:scale-100">
            {HERO_CARDS.map((card, i) => (
              <HeroCard key={card.id} card={card} innerRef={(el) => (cardRefs.current[i] = el)} style={{ zIndex: card.hero ? 50 : 40 - i }} />
            ))}
          </div>

          <div ref={captionRef} className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center opacity-0 sm:bottom-6">
            <p className="text-center font-display text-lg font-bold text-white sm:text-2xl">One tournament. Every detail in place.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Hero() {
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reducedMotion ? <StaticHero /> : <AnimatedHero />;
}
