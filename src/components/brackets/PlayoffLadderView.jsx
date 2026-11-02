import { memo } from 'react';
import { Trophy } from 'lucide-react';
import { resultTag } from '../../utils/match';
import { PLAYOFF_STAGES } from '../../utils/playoffLadder';

// The playoff ladder a pool-play category crosses into. Most people read this
// on a phone at the venue, and organizers put it on a TV or LED wall, so it
// responds to the width it's given rather than the viewport (container query
// variants below): the same component sits in a narrow page card and fills a
// 1080p Preview Screen.
//
// Narrow: one column of stages in play order, ending on the Championship, with
// nothing to scroll sideways. Wide: a real bracket on a CSS grid. Every row is
// `1fr` of the tallest card, so a long doubles name makes the whole bracket
// taller instead of pushing one box into the next, and because connectors
// occupy grid cells of their own they stay on the card centers whatever the
// names wrap to.
//
// A Round of 16 or 32 has too many rows for those cards on a screen that can't
// scroll, so the grid steps down a density by how many matches its first round
// has, and needs more width before it appears at all (LAYOUTS). The stage list
// always uses COMFORTABLE: a phone scrolls, so it never has to shrink anything.
const COLUMN_MAX_REM = 30;
const LABEL_TEXT = 'text-[11px] @5xl:text-xs @[100rem]:text-sm';

const COMFORTABLE = {
  rowGap: 'gap-y-4',
  connector: '2.5rem',
  rowPad: 'px-4 py-2.5 @[100rem]:px-5 @[100rem]:py-3',
  nameText: 'text-sm @5xl:text-base @[100rem]:text-lg',
  scoreText: 'text-base @5xl:text-lg @[100rem]:text-xl',
  onePlayerPerLine: true,
};
const COMPACT = {
  rowGap: 'gap-y-2',
  connector: '2rem',
  rowPad: 'px-3 py-1.5',
  nameText: 'text-sm',
  scoreText: 'text-sm',
  codeGutter: true,
};
const DENSE = {
  rowGap: 'gap-y-1',
  connector: '1.5rem',
  rowPad: 'px-2 py-0.5',
  nameText: 'truncate text-sm',
  scoreText: 'text-sm',
  codeGutter: true,
};

const densityFor = (firstRoundCount) => (firstRoundCount >= 16 ? DENSE : firstRoundCount >= 8 ? COMPACT : COMFORTABLE);

// Full class strings, so Tailwind can find them. Keyed by column count: each
// extra round needs more width before a bracket beats the stage list.
const LAYOUTS = {
  3: { list: '@3xl:hidden', grid: '@3xl:grid' },
  4: { list: '@5xl:hidden', grid: '@5xl:grid' },
  5: { list: '@[100rem]:hidden', grid: '@[100rem]:grid' },
};
const layoutFor = (roundCount) => LAYOUTS[Math.max(3, roundCount)];

function TeamName({ team, density }) {
  if (!team) return <span className="text-ink-300">To be decided</span>;
  if (team.isPlaceholder) return <span className="font-medium italic text-ink-400">{team.label}</span>;
  if (!density.onePlayerPerLine) return <span title={team.label}>{team.label}</span>;
  // One player per line, so every doubles row is the same height and a
  // partner's name never breaks halfway through.
  const players = team.label.split(' & ');
  return players.map((name, i) => (
    <span key={i} className="block">
      {name}
      {i < players.length - 1 ? ' &' : ''}
    </span>
  ));
}

function TeamRow({ team, score, isWinner, isLoser, density }) {
  const tone = isWinner ? 'font-bold text-brand-700' : isLoser ? 'font-medium text-ink-400' : 'font-semibold text-ink-800';
  return (
    <div className={`flex items-center justify-between gap-3 ${density.rowPad} ${isWinner ? 'bg-brand-50' : ''}`}>
      <div className={`min-w-0 break-words leading-snug ${density.nameText} ${tone}`}>
        <TeamName team={team} density={density} />
      </div>
      {score != null && <span className={`shrink-0 font-bold tabular-nums ${density.scoreText} ${isWinner ? 'text-brand-700' : 'text-ink-400'}`}>{score}</span>}
    </div>
  );
}

// `code` is only worth showing when a stage has more than one match: "Winner
// of SF1" needs a box called SF1, but the Championship is already named above
// its one card.
function MatchCard({ match, code, density = COMFORTABLE }) {
  const isLive = match.status === 'in_progress';
  const tag = resultTag(match.resultType);
  const border = isLive ? 'border-rose-200 ring-1 ring-rose-100' : match.status === 'projected' ? 'border-dashed border-ink-200' : 'border-ink-100';
  const rows = (
    <div className="min-w-0 flex-1 divide-y divide-ink-100">
      <TeamRow team={match.teamA} score={match.scoreA} isWinner={match.winnerSide === 'a'} isLoser={match.winnerSide === 'b'} density={density} />
      <TeamRow team={match.teamB} score={match.scoreB} isWinner={match.winnerSide === 'b'} isLoser={match.winnerSide === 'a'} density={density} />
    </div>
  );
  if (density.codeGutter) {
    return (
      <div className={`flex w-full overflow-hidden rounded-lg border bg-white ${match.status === 'projected' ? '' : 'shadow-sm'} ${border}`}>
        <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-ink-100 text-[10px] font-bold uppercase leading-tight text-ink-400">
          <span>{code}</span>
          {isLive && <span className="text-rose-600">Live</span>}
          {tag && <span title={tag}>{match.resultType === 'double_forfeit' ? 'DF' : tag}</span>}
        </div>
        {rows}
      </div>
    );
  }
  return (
    <div className={`w-full overflow-hidden rounded-2xl border bg-white ${match.status === 'projected' ? '' : 'shadow-sm'} ${border}`}>
      {(code || isLive || tag) && (
        <div className={`flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-1.5 font-bold uppercase tracking-wide text-ink-400 @[100rem]:px-5 ${LABEL_TEXT}`}>
          <span>{code}</span>
          {isLive && <span className="rounded-full bg-rose-100 px-2 py-px text-rose-700">Live</span>}
          {tag && <span className="text-ink-500">{tag}</span>}
        </div>
      )}
      {rows}
    </div>
  );
}

function StageHeading({ stage }) {
  return (
    <h3 className={`flex items-center gap-1.5 font-bold uppercase tracking-wide text-ink-500 ${LABEL_TEXT}`}>
      {stage.id === 'po-final' && <Trophy size={14} className="shrink-0 text-amber-500" />}
      {stage.label}
    </h3>
  );
}

const codeFor = (stage, match) => (stage.matches.length > 1 ? match.matchCode : null);

function StageList({ stages, layout }) {
  return (
    <div className={`flex flex-col gap-6 ${layout.list}`}>
      {stages.map((stage) => (
        <section key={stage.id}>
          <StageHeading stage={stage} />
          <div className={`mt-2.5 grid gap-3 ${stage.matches.length > 1 ? '@lg:grid-cols-2' : ''}`}>
            {stage.matches.map((m) => (
              <MatchCard key={m.key} match={m} code={codeFor(stage, m)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// Elbow from the two feeding cards' centers (a quarter of the way down this
// cell and three quarters of the way down) to the next card's center.
function Connector({ style }) {
  return (
    <div className="relative" style={style} aria-hidden="true">
      <div className="absolute inset-y-1/4 left-0 right-1/2 rounded-r-lg border-y-2 border-r-2 border-ink-200" />
      <div className="absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-ink-200" />
    </div>
  );
}

function BracketGrid({ rounds, thirdPlaceStage, layout }) {
  const firstRoundCount = rounds[0].matches.length;
  const lastRound = rounds.length - 1;
  const density = densityFor(firstRoundCount);
  // Below the Championship, in its column. From quarterfinals up there's room
  // inside the bracket's own rows: the bottom quarter of them, so its heading
  // can't stretch every other row. A shorter bracket adds one more row for it.
  const thirdFitsInRows = firstRoundCount >= 4;
  const thirdRow = thirdFitsInRows ? `${2 + firstRoundCount - firstRoundCount / 4} / span ${firstRoundCount / 4}` : firstRoundCount + 2;
  const columnStart = (roundIndex) => roundIndex * 2 + 1;
  const rowSpan = (round) => firstRoundCount / round.matches.length;
  const rowStart = (round, matchIndex) => 2 + matchIndex * rowSpan(round);

  const placement = (round, roundIndex, matchIndex) => {
    // Keeps the Championship centered on its connector while leaving the
    // bottom row free for the third-place card.
    if (roundIndex === lastRound && thirdPlaceStage && thirdFitsInRows) {
      return { gridColumn: columnStart(roundIndex), gridRow: `${2 + firstRoundCount / 4} / span ${firstRoundCount / 2}` };
    }
    return { gridColumn: columnStart(roundIndex), gridRow: `${rowStart(round, matchIndex)} / span ${rowSpan(round)}` };
  };

  return (
    <div
      className={`mx-auto hidden w-full ${density.rowGap} ${layout.grid}`}
      style={{
        maxWidth: `calc(${rounds.length * COLUMN_MAX_REM}rem + ${lastRound} * ${density.connector})`,
        gridTemplateColumns: rounds.map(() => 'minmax(0, 1fr)').join(` ${density.connector} `),
        gridTemplateRows: `auto repeat(${firstRoundCount}, 1fr)${thirdPlaceStage && !thirdFitsInRows ? ' auto' : ''}`,
      }}
    >
      {rounds.map((round, roundIndex) => (
        <div key={round.id} style={{ gridColumn: columnStart(roundIndex), gridRow: 1 }}>
          <StageHeading stage={round} />
        </div>
      ))}
      {rounds.map((round, roundIndex) =>
        round.matches.map((m, matchIndex) => (
          <div key={m.key} className="flex items-center" style={placement(round, roundIndex, matchIndex)}>
            <MatchCard match={m} code={codeFor(round, m)} density={density} />
          </div>
        ))
      )}
      {rounds.slice(1).map((round, i) =>
        round.matches.map((m, matchIndex) => (
          <Connector key={m.key} style={{ gridColumn: columnStart(i) + 1, gridRow: `${rowStart(round, matchIndex)} / span ${rowSpan(round)}` }} />
        ))
      )}
      {thirdPlaceStage && (
        <div className={`flex flex-col justify-end ${thirdFitsInRows ? '' : 'pt-3'}`} style={{ gridColumn: columnStart(lastRound), gridRow: thirdRow }}>
          <StageHeading stage={thirdPlaceStage} />
          <div className="mt-2">
            <MatchCard match={thirdPlaceStage.matches[0]} code={null} density={density} />
          </div>
        </div>
      )}
    </div>
  );
}

// tree: the playoff entry of buildBracketTreesForCategory(...).trees. Memoized
// because its parent re-renders on every clock tick and a tree only changes
// when new match data arrives.
function PlayoffLadderView({ tree }) {
  const thirdPlaceStage = tree.thirdPlace ? { id: 'po-third', label: PLAYOFF_STAGES.third_place.label, matches: [tree.thirdPlace] } : null;
  const finalRound = tree.rounds[tree.rounds.length - 1];
  const stagesInPlayOrder = [...tree.rounds.slice(0, -1), ...(thirdPlaceStage ? [thirdPlaceStage] : []), finalRound];
  const layout = layoutFor(tree.rounds.length);
  return (
    <div className="@container w-full">
      <StageList stages={stagesInPlayOrder} layout={layout} />
      <BracketGrid rounds={tree.rounds} thirdPlaceStage={thirdPlaceStage} layout={layout} />
    </div>
  );
}

export default memo(PlayoffLadderView);
