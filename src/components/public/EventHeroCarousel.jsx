import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { getEventMediaUrl, getCoverPhotoObjectPosition } from '../../data/eventsApi';
import { formatDateRange } from '../../utils/format';

const INTERVAL_MS = 6000;

function cityOf(address) {
  if (!address) return '';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

// Full-bleed, auto-advancing hero for the top N upcoming events (caller
// filters to events that actually have a cover photo — this component is
// purely "show these slides", no fallback-image logic). Unlike
// AutoCarousel.jsx (built for spectator displays nobody touches), this one
// is meant to be interacted with: hover pauses it, dots jump to a slide,
// arrows step through it.
export default function EventHeroCarousel({ events }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [events.length]);

  useEffect(() => {
    if (events.length <= 1 || paused) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % events.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [events.length, paused]);

  if (events.length === 0) {
    return (
      <div className="relative flex h-[360px] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 text-center sm:h-[440px]">
        <div className="px-4">
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Browse pickleball tournaments</h1>
          <p className="mt-2 text-sm text-ink-200 sm:text-base">New tournaments are added all the time — check back soon.</p>
        </div>
      </div>
    );
  }

  const goTo = (i) => setIndex(((i % events.length) + events.length) % events.length);

  return (
    <div
      className="group relative h-[480px] w-full overflow-hidden bg-ink-900 sm:h-[560px] lg:h-[620px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {events.map((event, i) => (
        <div
          key={event.id}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === index ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <img
            src={getEventMediaUrl(event.cover_photo_path)}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: getCoverPhotoObjectPosition(event) }}
          />
        </div>
      ))}

      {/* Vignette: dark enough at the top for the overlaid header's white
          text, dark enough at the bottom for the slide content, lighter in
          between so the photo itself still reads through. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-950/75 via-ink-950/10 to-ink-950/90" />

      {events.map((event, i) => (
        <div
          key={event.id}
          aria-hidden={i !== index}
          className={`absolute inset-x-0 bottom-0 px-4 pb-10 transition-all duration-700 ease-out sm:px-10 sm:pb-14 lg:px-16 ${
            i === index ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
          }`}
        >
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              Upcoming tournament
            </span>
            <h2 className="mt-3 font-display text-2xl leading-tight font-bold text-white sm:text-4xl lg:text-5xl">{event.name}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80 sm:text-base">
              <span className="flex items-center gap-1.5">
                <Calendar size={15} /> {formatDateRange(event.start_date, event.end_date)}
              </span>
              {event.location_address && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} /> {cityOf(event.location_address)}
                </span>
              )}
            </p>
            <Link
              to={`/e/${event.slug}`}
              className="press-scale mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-brand-700"
            >
              View tournament
            </Link>
          </div>
        </div>
      ))}

      {events.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Previous tournament"
            className="press-scale absolute top-1/2 left-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white opacity-0 backdrop-blur-sm transition hover:bg-white/20 group-hover:opacity-100 sm:left-6"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Next tournament"
            className="press-scale absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white opacity-0 backdrop-blur-sm transition hover:bg-white/20 group-hover:opacity-100 sm:right-6"
          >
            <ChevronRight size={18} />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-5">
            {events.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
