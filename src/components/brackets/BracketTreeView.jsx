// Visual bracket tree — round columns connected by elbow lines, matching
// the classic tournament-bracket diagram (Challonge/DEUCE-style) rather
// than the flat lists the rest of the app uses for round robin. Pure
// presentation: all the "what goes in each box" logic lives in
// utils/bracketTree.js, this file only lays boxes out and draws lines.
//
// Layout math: round r's match boxes sit in slots of height
// (round1Count / matchCount(r)) * matchH, stacked with no gaps — so every
// round's total column height comes out identical (round1Count * matchH)
// and rounds naturally line up without any flex/justify tricks. This is a
// ratio, not a flat doubling (matchH * 2^r): that only happens to be the
// same thing when round sizes halve cleanly every round, which utils/
// bracketTree.js's projectShape does NOT guarantee for a Round 1 count that
// isn't a power of two (its one-bye-per-round carry can leave a round that
// isn't exactly half the previous one) — doubling blindly in that case
// inflates a late round to many times taller than it needs, which is
// exactly the kind of overflow a TV with no scrolling can't absorb. A
// connector between round r and r+1 is exactly one slot-height(r+1) tall,
// split top/bottom so its shared right border meets the centers of the two
// round-r matches it connects and hands off to round r+1's match, which
// sits centered in that same span.
//
// Sizing: a Single Elimination tree (tree.key !== 'PO') fits itself to
// whatever width it's given — round columns are flex children (capped by a
// max width, not a fixed one) instead of a fixed px column that forces
// overflow-x-auto, and box padding/text/row-height step down across three
// density tiers keyed off how many Round 1 boxes there are, so a 20-player
// bracket doesn't blow out a TV card the way a flat constant would. A
// playoff-ladder tree (key 'PO', at most a handful of rounds) keeps the
// original fixed-width, horizontally-scrollable layout untouched.

const LEGACY_DENSITY = {
  fixedWidth: true,
  matchH: 84,
  connectorW: 20,
  pad: 'px-2.5 py-1.5',
  headerPad: 'px-2.5 py-1',
  nameSize: 'text-xs',
  scoreSize: 'text-xs',
  headerMb: 'mb-2',
  headerText: 'text-[11px]',
  wrap: true,
  showHeader: true,
};

// Single Elimination tiers, chosen by Round 1's box count (byes collapse to
// one box each, so this is entrants-rounded-up-to-a-power-of-two / 2, not
// raw entrant count). Compact and dense also drop the match-code header bar
// (a Live pill still shows regardless — see MatchBox — operational status
// matters at any size) to buy back the ~20px/box that costs a big bracket
// the most: it's the difference between a 10-match Round 1 fitting a TV's
// available height or not.
const COMFORTABLE = {
  fixedWidth: false,
  matchH: 108,
  connectorW: 22,
  pad: 'px-3 py-2',
  headerPad: 'px-2.5 py-1',
  nameSize: 'text-sm',
  scoreSize: 'text-sm',
  headerMb: 'mb-2.5',
  headerText: 'text-[11px]',
  wrap: true,
  showHeader: true,
};
const COMPACT = {
  fixedWidth: false,
  matchH: 62,
  connectorW: 18,
  pad: 'px-2.5 py-1.5',
  headerPad: 'px-2 py-0.5',
  nameSize: 'text-xs',
  scoreSize: 'text-xs',
  headerMb: 'mb-1.5',
  headerText: 'text-[10px]',
  wrap: false,
  showHeader: false,
};
const DENSE = {
  fixedWidth: false,
  matchH: 50,
  connectorW: 14,
  pad: 'px-2 py-0.5',
  headerPad: 'px-1.5 py-0.5',
  nameSize: 'text-[11px]',
  scoreSize: 'text-[11px]',
  headerMb: 'mb-1',
  headerText: 'text-[9px]',
  wrap: false,
  showHeader: false,
};

function densityFor(tree) {
  if (tree.key === 'PO') return LEGACY_DENSITY;
  const round1Count = tree.rounds[0]?.matches.length || 1;
  if (round1Count <= 6) return COMFORTABLE;
  if (round1Count <= 12) return COMPACT;
  return DENSE;
}

function slotHeight(round, round1Count, matchH) {
  return (round1Count * matchH) / round.matches.length;
}

// "Jasper Susada & Zeth Mansing" → "Jasper" — first name of the first
// player only, so a box stays compact regardless of how long real names
// run. Falls back to the whole label for anything unusual (a placeholder
// like "Winner of R1 Match 2" is left untouched, see the isPlaceholder
// check at the call site).
function briefName(label) {
  if (!label) return label;
  const firstPlayer = label.split('&')[0].trim();
  return firstPlayer.split(' ')[0] || firstPlayer;
}

function TeamRow({ team, score, isWinner, isLoser, isLive, fullNames, wrap, density }) {
  const isBye = Boolean(team?.isBye);
  const name = isBye ? 'BYE' : team ? (team.isPlaceholder ? team.label : fullNames ? team.label : briefName(team.label)) : '—';
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 ${density.pad} transition-colors duration-150 ${isWinner ? 'bg-brand-50' : ''}`}>
      <span
        className={`min-w-0 ${density.nameSize} ${wrap ? 'break-words' : 'truncate'} ${
          isBye
            ? 'italic text-ink-300'
            : isWinner
              ? 'font-bold text-brand-700'
              : isLoser
                ? 'text-ink-400 line-through decoration-ink-300'
                : team?.isPlaceholder
                  ? 'italic text-ink-300'
                  : isLive
                    ? 'font-semibold text-ink-900'
                    : 'font-semibold text-ink-700'
        }`}
      >
        {name}
      </span>
      {!isBye && score != null && <span className={`shrink-0 ${density.scoreSize} font-bold tabular-nums ${isWinner ? 'text-brand-700' : 'text-ink-400'}`}>{score}</span>}
    </div>
  );
}

// A bye never gets a 2-row "vs BYE" box — just its recipient's name,
// advancing straight through to whichever Round 2 box already knows it.
function BareByeBox({ match, fullNames, density }) {
  const name = fullNames ? match.teamA.label : briefName(match.teamA.label);
  return (
    <div className={`${density.fixedWidth ? (fullNames ? 'w-64' : 'w-48') : 'w-full'} overflow-hidden rounded-xl border border-dashed border-ink-100 bg-ink-50/40 ${density.pad}`}>
      <span className={`block min-w-0 ${density.nameSize} ${density.wrap && fullNames ? 'break-words' : 'truncate'} font-semibold text-ink-700`}>{name}</span>
    </div>
  );
}

function MatchBox({ match, fullNames, density }) {
  if (match.isBareBye) return <BareByeBox match={match} fullNames={fullNames} density={density} />;
  const hasResult = match.winnerSide != null;
  const isLive = match.status === 'in_progress';
  const wrap = density.wrap && fullNames;
  return (
    <div
      className={`${density.fixedWidth ? (fullNames ? 'w-64' : 'w-48') : 'w-full'} overflow-hidden rounded-xl border bg-white shadow-sm ${
        isLive ? 'border-rose-200 ring-1 ring-rose-100' : 'border-ink-100'
      } ${match.status === 'projected' ? 'border-dashed' : ''}`}
    >
      {(isLive || (match.matchCode && density.showHeader)) && (
        <div className={`flex items-center justify-between border-b border-ink-50 ${density.headerPad} text-[10px] font-bold uppercase tracking-wide`}>
          <span className="text-ink-400">{density.showHeader ? match.matchCode || '' : ''}</span>
          {isLive && <span className="rounded-full bg-rose-100 px-1.5 py-px text-rose-700">Live</span>}
        </div>
      )}
      <div className="divide-y divide-ink-50">
        <TeamRow
          team={match.teamA}
          score={match.scoreA}
          isWinner={hasResult && match.winnerSide === 'a'}
          isLoser={hasResult && match.winnerSide === 'b'}
          isLive={isLive}
          fullNames={fullNames}
          wrap={wrap}
          density={density}
        />
        <TeamRow
          team={match.teamB}
          score={match.scoreB}
          isWinner={hasResult && match.winnerSide === 'b'}
          isLoser={hasResult && match.winnerSide === 'a'}
          isLive={isLive}
          fullNames={fullNames}
          wrap={wrap}
          density={density}
        />
      </div>
    </div>
  );
}

// One elbow: the shared right border's top half meets round r's upper match,
// the bottom half meets its lower match, and a stub reaches across the gap
// to round r+1's match, centered in this same span.
function ConnectorElbow({ height, width }) {
  const stubW = Math.max(6, Math.round(width * 0.6));
  return (
    <div className="relative flex shrink-0 flex-col" style={{ height, width }}>
      <div className="h-1/2 rounded-tr-lg border-r-2 border-t-2 border-ink-200" />
      <div className="h-1/2 rounded-br-lg border-r-2 border-b-2 border-ink-200" />
      <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-200" style={{ right: -stubW, width: stubW }} />
    </div>
  );
}

// A round transition needs one elbow per match in the NEXT round (each
// pairing two of the current round's matches into one) — not a single
// elbow for the whole column — so every pair gets its own connecting line,
// stacked to fill the same total column height as the rounds either side.
function Connector({ nextRound, round1Count, density }) {
  const height = slotHeight(nextRound, round1Count, density.matchH);
  return (
    <div className="flex shrink-0 flex-col">
      {nextRound.matches.map((m) => (
        <ConnectorElbow key={m.key} height={height} width={density.connectorW} />
      ))}
    </div>
  );
}

function RoundColumn({ round, round1Count, density, fullNames, flexible }) {
  const height = slotHeight(round, round1Count, density.matchH);
  return (
    <div
      className={flexible ? 'flex min-w-0 flex-1 flex-col' : 'flex shrink-0 flex-col'}
      style={flexible ? { maxWidth: fullNames ? 280 : 224 } : { width: fullNames ? 256 : 192 }}
    >
      <div className={`${density.headerMb} text-center font-bold uppercase tracking-wide text-ink-500 ${density.headerText}`}>{round.label}</div>
      <div className="flex flex-1 flex-col">
        {round.matches.map((m) => (
          <div key={m.key} className={`flex items-center justify-center ${flexible ? 'px-1' : ''}`} style={{ height }}>
            <MatchBox match={m} fullNames={fullNames} density={density} />
          </div>
        ))}
      </div>
    </div>
  );
}

// tree: one entry of buildBracketTreesForCategory(...).trees — { key,
// title, rounds, thirdPlace? }.
export default function BracketTreeView({ tree, fullNames = false }) {
  const density = densityFor(tree);
  const flexible = !density.fixedWidth;
  const round1Count = tree.rounds[0]?.matches.length || 1;

  const columns = [];
  tree.rounds.forEach((round, i) => {
    columns.push(<RoundColumn key={round.id} round={round} round1Count={round1Count} density={density} fullNames={fullNames} flexible={flexible} />);
    if (i < tree.rounds.length - 1) columns.push(<Connector key={`${round.id}-c`} nextRound={tree.rounds[i + 1]} round1Count={round1Count} density={density} />);
  });

  return (
    <div className={flexible ? 'w-full pb-1' : 'overflow-x-auto pb-2'}>
      <div className={`flex items-start gap-0 px-1 pt-1 ${flexible ? 'w-full' : ''}`}>
        {columns}
        {tree.thirdPlace && (
          <div className="ml-6 flex shrink-0 flex-col self-center">
            <div className={`${density.headerMb} text-center font-bold uppercase tracking-wide text-ink-500 ${density.headerText}`}>3rd Place</div>
            <MatchBox match={tree.thirdPlace} fullNames={fullNames} density={density} />
          </div>
        )}
      </div>
    </div>
  );
}
