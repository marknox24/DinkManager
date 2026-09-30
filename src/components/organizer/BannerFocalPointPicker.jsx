import { useEffect, useRef, useState } from 'react';
import { Move } from 'lucide-react';

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// Lets an organizer pick which part of the cover photo stays visible when
// it's cropped to a different shape. The same cover photo renders at several
// different aspect ratios across the app (dashboard card, discover card, the
// public event hero on mobile vs desktop) — a fixed crop rectangle only
// looks right at one of those. A focal point (x/y percentage) stays correct
// everywhere at once via CSS object-position, with no image re-processing.
export default function BannerFocalPointPicker({ imageUrl, focalX = 50, focalY = 50, onChange }) {
  const containerRef = useRef(null);
  const [pos, setPos] = useState({ x: focalX, y: focalY });
  const [dragging, setDragging] = useState(false);

  // Stay in sync with the saved value (e.g. after the parent re-fetches),
  // but never fight an in-progress drag.
  useEffect(() => {
    if (!dragging) setPos({ x: focalX, y: focalY });
  }, [focalX, focalY, dragging]);

  const posFromEvent = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    containerRef.current.setPointerCapture(e.pointerId);
    setDragging(true);
    setPos(posFromEvent(e));
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    setPos(posFromEvent(e));
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    const final = posFromEvent(e);
    setPos(final);
    onChange(Math.round(final.x), Math.round(final.y));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative aspect-[21/9] w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-ink-200 select-none"
      >
        <img src={imageUrl} alt="" draggable={false} className="h-full w-full object-cover" style={{ objectPosition: `${pos.x}% ${pos.y}%` }} />
        <div
          className={`pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-brand-600 shadow-md ${
            dragging ? '' : 'transition-[left,top] duration-150 ease-out'
          }`}
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          <Move size={12} className="text-white" strokeWidth={2.5} />
        </div>
      </div>
      <p className="text-[11px] text-ink-400">Click or drag to choose what stays visible when this photo is cropped.</p>
    </div>
  );
}
