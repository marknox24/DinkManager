import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import RoundRobinScoreSheet from './RoundRobinScoreSheet';

// Blank printable score sheets — no team names, no round grouping, just
// `count` empty copies of the same sheet for stages that aren't known ahead
// of time (Quarterfinals/Semifinals/Finals): the organizer hand-writes the
// two pair names, the stage/bracket label, court, and umpire as play
// progresses. Otherwise an exact structural copy of RoundRobinScoreSheets.jsx
// — same portal-to-<body>, same #root-hiding @media print rule, same Legal
// page size and break-inside: avoid packing — kept as a separate component
// rather than a mode flag on that one because it has no `matches`/round data
// to drive it at all, just a count.
export default function BlankScoreSheets({ category, count, onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 50);
    const handleAfterPrint = () => onDone();
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [onDone]);

  return createPortal(
    <div className="hidden print:block">
      <style>{'@media print { #root { display: none !important; } @page { size: legal; margin: 12mm; } }'}</style>
      {Array.from({ length: count }, (_, i) => (
        <RoundRobinScoreSheet
          key={i}
          category={category}
          blank
          style={{ breakInside: 'avoid' }}
          className={i > 0 ? 'mt-2 border-t border-dashed border-ink-300 pt-2' : ''}
        />
      ))}
    </div>,
    document.body
  );
}
