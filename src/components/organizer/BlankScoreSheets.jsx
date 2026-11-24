import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import RoundRobinScoreSheet from './RoundRobinScoreSheet';
import ScoreSheetV2, { V2_STRIPS_PER_PAGE } from './ScoreSheetV2';

// Blank printable score sheets — no team names, no category, no round
// grouping, just `count` empty copies of the chosen template (V1 or V2) for
// stages that aren't known ahead of time (Quarterfinals/Semifinals/Finals):
// the umpire hand-writes the two pair names, the category, the stage/bracket
// label, court, and umpire as play progresses. Otherwise an exact structural
// copy of RoundRobinScoreSheets.jsx — same portal-to-<body>, same
// #root-hiding @media print rule and break-inside: avoid packing (Legal for
// V1, A4 for V2) — kept as a separate component rather than a mode flag on
// that one because it has no `matches`/round data to drive it at all, just a
// count.
export default function BlankScoreSheets({ eventName, category, count, template = 'v1', onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 50);
    const handleAfterPrint = () => onDone();
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [onDone]);

  const isV2 = template === 'v2';
  const page = isV2 ? 'size: A4; margin: 10mm;' : 'size: legal; margin: 12mm;';

  return createPortal(
    <div className="hidden print:block">
      <style>{`@media print { #root { display: none !important; } @page { ${page} } }`}</style>
      {Array.from({ length: count }, (_, i) =>
        isV2 ? (
          <ScoreSheetV2
            key={i}
            eventName={eventName}
            blank
            style={{ breakAfter: i % V2_STRIPS_PER_PAGE === V2_STRIPS_PER_PAGE - 1 ? 'page' : 'auto' }}
          />
        ) : (
          <RoundRobinScoreSheet
            key={i}
            category={category}
            blank
            style={{ breakInside: 'avoid' }}
            className={i > 0 ? 'mt-2 border-t border-dashed border-ink-300 pt-2' : ''}
          />
        )
      )}
    </div>,
    document.body
  );
}
