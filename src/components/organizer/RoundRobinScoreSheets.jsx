import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import RoundRobinScoreSheet from './RoundRobinScoreSheet';
import { matchLevelLabel } from '../../data/playoffApi';

// Printable Round Robin score sheets for a whole category (every pool
// bracket, not just one) — portaled straight to <body> and printed via
// window.print(), the same pattern EventCheckinQr.jsx uses for its check-in
// poster. Unlike that component's live call site, nothing currently hides
// the rest of the app's on-screen UI during a print (see its own stale
// comment), so this adds its own scoped @media print rule that hides #root
// for the lifetime of this component — leaving only these sheets on the
// printed page — without touching any other page's print behavior.
//
// Each sheet uses `break-inside: avoid` rather than a forced page break, so
// the browser packs as many sheets as fit on one physical page instead of
// always starting a fresh page per match — the whole point being to save
// paper on a stack of otherwise near-empty pages. `matches` must already be
// in Match List order (round, then bracket, then match code) — this is what
// groups sheets under "Round 1", "Round 2", ... banners matching the page
// they were printed from.
export default function RoundRobinScoreSheets({ category, matches, onDone }) {
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
      {matches.map((m, i) => (
        <RoundRobinScoreSheet
          key={m.id}
          category={category}
          bracketLetter={m.bracket_letter}
          match={m}
          roundLabel={i === 0 || m.round_number !== matches[i - 1].round_number ? matchLevelLabel(m) : null}
          style={{ breakInside: 'avoid' }}
          className={i > 0 ? 'mt-2 border-t border-dashed border-ink-300 pt-2' : ''}
        />
      ))}
    </div>,
    document.body
  );
}
