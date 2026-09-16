import { teamLabel } from '../../utils/match';

const CHECKBOX_COLUMNS = Array.from({ length: 18 }, (_, i) => i + 1);

// Two sizes only, deliberately: TEXT_SM for every line in the header block
// (Pair Name, Category & Bracket, Court, Umpire Name — bold vs. regular
// weight is what distinguishes them, not size), and TEXT_XS for the table
// (team names + the 18 column headers), which has to stay smaller purely
// because 18 columns need to fit side by side in the same width. Team names
// no longer shrink further based on length — they wrap instead, at this one
// fixed size, so every sheet's table reads at the same size as every other.
const TEXT_SM = 'text-[11px]';
const TEXT_XS = 'text-[9px]';

// A short writable underline used everywhere a field is left blank for
// someone to fill in by hand (Court, Umpire Name, and every field on the
// fully-blank playoff template). Generous line-height + real padding around
// it in the surrounding row is what keeps it from visually crowding the
// text next to it.
function BlankField({ width = 'w-32' }) {
  return <span className={`inline-block ${width} border-b border-black`}>&nbsp;</span>;
}

// One printable score sheet — shared by the print-only portal
// (RoundRobinScoreSheets.jsx / BlankScoreSheets.jsx) and the preview/download
// modals so every consumer always renders pixel-identical sheets. Compact,
// but not so tight that lines crowd their borders — every text element below
// keeps real padding and at least `leading-snug` line-height on purpose;
// this was previously pushed down to 1px padding / `leading-none` to
// squeeze in more sheets per page, which is what caused text to visually
// overlap its own borders/underlines on real output. `bracketLetter` is a
// plain string (not a whole bracket object) because a print run now spans
// every pool bracket in a category — it varies per match, not once for the
// whole run. `roundLabel`, when given, renders a banner ABOVE this sheet's
// own content (inside the same wrapper, not a separate element) so it stays
// glued to this sheet through pagination — pass it only for the first match
// of each round so the sheets end up visually grouped by round, matching
// Match List.
//
// `blank`: renders a fully blank template (no `match` needed) for stages
// that aren't known ahead of time — Quarterfinals/Semifinals/Finals — where
// the organizer hand-writes both pair names and which stage/bracket this is.
export default function RoundRobinScoreSheet({ category, bracketLetter, match, roundLabel, blank = false, className = '', style }) {
  const teamA = blank ? null : teamLabel(match.team_a);
  const teamB = blank ? null : teamLabel(match.team_b);

  // Plain block, deliberately NOT `flex flex-col`: Chromium's print engine
  // doesn't reliably honor `break-inside: avoid` on a flex container, so a
  // sheet could get sliced across a page boundary mid-table even though
  // `style` (passed in by the caller) sets breakInside on this very div. The
  // children below (div, div, table) already stack correctly as plain block
  // elements, so dropping flex costs nothing visually and fixes pagination.
  return (
    <div style={style} className={`w-full bg-white p-2 text-black ${className}`}>
      {roundLabel && (
        <div
          className={`-mx-2 mb-1.5 border-y-2 border-black px-2 py-1 text-center font-extrabold uppercase leading-snug tracking-widest text-black ${TEXT_SM}`}
        >
          {roundLabel}
        </div>
      )}
      <div className="mb-1.5 border-b-2 border-black pb-1">
        <p className={`font-bold leading-snug ${TEXT_SM}`}>
          Pair Name: {blank ? <BlankField width="w-36" /> : teamA} <span className="font-extrabold">VS</span>{' '}
          {blank ? <BlankField width="w-36" /> : teamB}
        </p>
        <div className={`mt-1 flex flex-wrap items-center justify-between gap-3 leading-snug ${TEXT_SM}`}>
          <p className="font-bold">
            Category &amp; Bracket: {blank ? <>{category?.name} - <BlankField width="w-24" /></> : `${category.name} - Bracket ${bracketLetter}`}
          </p>
          {/* Court is assigned on the day, not known when this sheet is
              generated — left blank for the umpire/organizer to fill in by
              hand, same as Umpire Name. */}
          <p className="flex items-center gap-1.5">
            Court: <BlankField width="w-14" />
          </p>
          <p className="flex items-center gap-1.5">
            Umpire Name: <BlankField width="w-28" />
          </p>
        </div>
      </div>

      {/* breakInside here too, belt-and-suspenders: tables fragment their
          own rows across a page break independently of an ancestor's
          break-inside in some print engines. */}
      <table style={{ breakInside: 'avoid' }} className={`w-full table-fixed border-collapse text-center leading-snug ${TEXT_XS}`}>
        <thead>
          <tr>
            <th className="w-28 border border-black p-1 text-left font-bold uppercase">Team</th>
            {CHECKBOX_COLUMNS.map((n) => (
              <th key={n} className="border border-black p-1 font-bold">
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(blank ? [null, null] : [teamA, teamB]).map((name, i) => (
            <tr key={i}>
              <td className="border border-black p-1 text-left font-semibold">{blank ? <BlankField width="w-full" /> : name}</td>
              {CHECKBOX_COLUMNS.map((n) => (
                <td key={n} className="border border-black p-1">
                  <span className="mx-auto block h-3 w-3 border border-black" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
