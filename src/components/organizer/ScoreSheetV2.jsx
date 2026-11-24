import { teamLabel } from '../../utils/match';
import { matchLevelLabel } from '../../data/playoffApi';

// Score sheet template V2 — the "rally strip" layout: three tear-off strips
// per A4 page. Each strip has the match details running up the left edge, and
// two mirrored team halves: Team 1 reads from the umpire's side, Team 2's
// half is rotated 180° so it reads from across the table. Each half has the
// team name line, a TO (timeout) box, a TW/TP 2×2 box and a 0–15 rally row
// to strike through.
//
// Sized with aspect-ratio (190 × 91 mm) rather than fixed heights, so the
// same markup fills the on-screen preview, the rasterized PDF and the real
// print at one consistent shape: at A4 with 10 mm margins, three strips are
// 273 mm of the 277 mm available.
//
// `blank`: no match — names, game number and category are left as
// underlines for the umpire to write in. The event name stays filled in
// since it's the same for every sheet.
export const V2_STRIPS_PER_PAGE = 3;

const SCORES = Array.from({ length: 16 }, (_, i) => i);

// Vertical text that reads bottom-to-top, like the labels on the paper
// template. writing-mode + a 180° turn instead of `sideways-lr`, which older
// browsers and the PDF rasterizer don't all support.
const VERTICAL = { writingMode: 'vertical-rl', transform: 'rotate(180deg)' };

function SideField({ label, value }) {
  return (
    <span className="flex min-h-0 items-center gap-1" style={{ minInlineSize: 0 }}>
      <span className="shrink-0 font-bold uppercase underline underline-offset-2">{label}</span>
      {value && (
        <span className="truncate font-semibold normal-case" style={{ minInlineSize: 0 }}>
          {value}
        </span>
      )}
    </span>
  );
}

// One column of the side panel. The column's right border is the line the
// umpire writes along.
function SideColumn({ start, end }) {
  return (
    <div className="flex h-full w-[17px] justify-center overflow-hidden border-r border-black">
      <div className="flex h-full items-center justify-between gap-3 text-[9px] leading-none" style={VERTICAL}>
        {start}
        {end}
      </div>
    </div>
  );
}

function TeamHalf({ label, name }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1 basis-0" style={{ maxWidth: '68%' }}>
          <p className="line-clamp-2 min-h-[16px] border-b border-black pb-px text-[11px] font-semibold leading-tight">{name || ' '}</p>
          <p className="mt-0.5 text-[10px] font-bold leading-none">{label}</p>
        </div>
        <div className="flex shrink-0 items-end gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <span className="block h-[20px] w-[20px] border border-black" />
            <span className="text-[8px] font-bold leading-none">TO</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="grid h-[32px] w-[40px] grid-cols-2 grid-rows-2 border border-black">
              <span className="border-b border-r border-black" />
              <span className="border-b border-black" />
              <span className="border-r border-black" />
              <span />
            </span>
            <span className="text-[8px] font-bold leading-none">TW/TP</span>
          </div>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-16 border border-black">
        {SCORES.map((n) => (
          <span key={n} className={`py-[3px] text-center text-[12px] font-bold leading-tight ${n > 0 ? 'border-l border-black' : ''}`}>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ScoreSheetV2({ eventName, category, bracketLetter, match, blank = false, className = '', style }) {
  const teamA = blank ? '' : teamLabel(match.team_a);
  const teamB = blank ? '' : teamLabel(match.team_b);
  const gameNo = blank ? '' : [match.match_code, matchLevelLabel(match)].filter(Boolean).join(' · ');
  const categoryText = blank ? '' : [category?.name, bracketLetter ? `Bracket ${bracketLetter}` : null].filter(Boolean).join(' · ');

  return (
    <div
      style={{ aspectRatio: '190 / 91', breakInside: 'avoid', ...style }}
      className={`relative flex w-full bg-white px-[1.5%] py-[2.2%] text-black ${className}`}
    >
      {/* Cut marks at the strip's edges, like the paper template. */}
      <span className="absolute left-0 top-0 w-[4%] border-t border-black" />
      <span className="absolute right-0 top-0 w-[4%] border-t border-black" />
      <span className="absolute bottom-0 left-0 w-[4%] border-t border-black" />
      <span className="absolute bottom-0 right-0 w-[4%] border-t border-black" />

      <div className="flex h-full shrink-0 gap-[5px] py-[3%]">
        <SideColumn start={<SideField label="Event name" value={eventName} />} end={<SideField label="Court no." />} />
        <SideColumn start={<SideField label="Game no." value={gameNo} />} />
        <SideColumn start={<SideField label="Category:" value={categoryText} />} />
        <SideColumn start={<SideField label="Format:" />} />
        <SideColumn start={<SideField label="Referee:" />} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between pl-[2.5%]">
        <TeamHalf label="Team 1" name={teamA} />
        <div className="flex justify-around px-[2%]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="w-[17%] border-b border-black" />
          ))}
        </div>
        <div style={{ transform: 'rotate(180deg)' }}>
          <TeamHalf label="Team 2" name={teamB} />
        </div>
      </div>
    </div>
  );
}
