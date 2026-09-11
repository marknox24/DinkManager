import { useEffect, useRef, useState } from 'react';

// Free-to-use action photos (Unsplash License — no attribution required),
// stored locally in public/images/landing so the welcome screen never
// depends on a third-party CDN staying up. One tile per photo — see the
// swap logic below for why this list must stay the same length as the
// grid (no repeats).
const PHOTOS = [
  '/images/landing/action-1.jpg',
  '/images/landing/paddle-balls.jpg',
  '/images/landing/holding-racket.jpg',
  '/images/landing/ball-court.jpg',
  '/images/landing/woman-racquet.jpg',
  '/images/landing/group-playing.jpg',
  '/images/landing/two-rackets.jpg',
  '/images/landing/man-racket.jpg',
  '/images/landing/sunny-day.jpg',
  '/images/landing/paddle-close.jpg',
  '/images/landing/two-paddles.jpg',
  '/images/landing/outdoor-court.jpg',
  '/images/landing/woman-swing.jpg',
  '/images/landing/aerial-doubles.jpg',
  '/images/landing/woman-court.jpg',
  '/images/landing/man-court.jpg',
  '/images/landing/couple-rackets.jpg',
  '/images/landing/ball-racket-hand.jpg',
  '/images/landing/racket-ball-hand2.jpg',
  '/images/landing/balls-net.jpg',
];

const TILE_COUNT = PHOTOS.length;
const SWAP_INTERVAL_MS = 2400;
const FADE_MS = 1000;
const SWAPS_PER_TICK = 3;

function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function GridTile({ shownIdx, fadeToIdx }) {
  const isFading = fadeToIdx != null;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!isFading) {
      setActive(false);
      return;
    }
    const raf = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(raf);
  }, [isFading, fadeToIdx]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-900">
      <img src={PHOTOS[shownIdx]} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {isFading && (
        <img
          src={PHOTOS[fadeToIdx]}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity"
          style={{ opacity: active ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        />
      )}
    </div>
  );
}

// Auto-looping grid behind the welcome screen. Every tile always shows a
// different photo — a shared `order` array is a permutation of the photo
// pool (one entry per tile), and the interval below only ever swaps pairs
// of tiles, which preserves that permutation property, so no two tiles can
// ever show the same picture at once. A dark gradient overlay on top keeps
// the foreground card readable.
export default function PhotoGridBackground() {
  const [order, setOrder] = useState(() => shuffledIndices(TILE_COUNT));
  const [pendingSwaps, setPendingSwaps] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const usedTiles = new Set();
      const swaps = [];
      while (swaps.length < SWAPS_PER_TICK && usedTiles.size < TILE_COUNT - 1) {
        const a = Math.floor(Math.random() * TILE_COUNT);
        const b = Math.floor(Math.random() * TILE_COUNT);
        if (a === b || usedTiles.has(a) || usedTiles.has(b)) continue;
        usedTiles.add(a);
        usedTiles.add(b);
        swaps.push({ a, b });
      }
      setPendingSwaps(swaps);
      setTimeout(() => {
        setOrder((prev) => {
          const next = [...prev];
          swaps.forEach(({ a, b }) => {
            [next[a], next[b]] = [next[b], next[a]];
          });
          return next;
        });
        setPendingSwaps([]);
      }, FADE_MS);
    }, SWAP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const fadeTargetByTile = new Map();
  pendingSwaps.forEach(({ a, b }) => {
    fadeTargetByTile.set(a, order[b]);
    fadeTargetByTile.set(b, order[a]);
  });

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="grid h-full w-full grid-cols-4 auto-rows-[1fr] opacity-90 blur-[1px] sm:grid-cols-5">
        {order.map((photoIdx, tileIndex) => (
          <GridTile key={tileIndex} shownIdx={photoIdx} fadeToIdx={fadeTargetByTile.get(tileIndex) ?? null} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/85 via-ink-950/80 to-ink-950/90" />
    </div>
  );
}
