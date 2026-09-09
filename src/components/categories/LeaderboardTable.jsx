import { Crown } from 'lucide-react';
import { useTournamentDispatch } from '../../context/TournamentContext';
import { getRankedTeams, getRecentScores } from '../../utils/stats';

function EditableName({ value, onCommit }) {
  const handleBlur = (e) => {
    const next = e.currentTarget.innerText.trim();
    if (next && next !== value) onCommit(next);
    else e.currentTarget.innerText = value;
  };
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          e.currentTarget.innerText = value;
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className="rounded-md px-1 py-0.5 outline-none transition hover:bg-brand-50 focus:bg-white focus:ring-2 focus:ring-brand-400"
    >
      {value}
    </span>
  );
}

function RecentScorePill({ result }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
        result.win ? 'bg-brand-50 text-brand-700' : 'bg-rose-50 text-rose-600'
      }`}
    >
      {result.win ? 'W' : 'L'} {result.myScore}-{result.oppScore}
    </span>
  );
}

export default function LeaderboardTable({ bracket, catIdx, bracketIdx }) {
  const dispatch = useTournamentDispatch();
  const rankedTeams = getRankedTeams(bracket.teams);

  const editField = (teamId, field, value) => {
    dispatch({ type: 'EDIT_TEAM_NAME', catIdx, bracketIdx, teamId, field, value }, { silent: true });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-500">
            <th className="px-2 py-2.5 text-center">Rank</th>
            <th className="px-2 py-2.5 text-left">Player 1</th>
            <th className="px-2 py-2.5 text-left">Player 2</th>
            <th className="px-2 py-2.5 text-center">W</th>
            <th className="px-2 py-2.5 text-center">L</th>
            <th className="px-2 py-2.5 text-center">RF</th>
            <th className="px-2 py-2.5 text-center">RA</th>
            <th className="px-2 py-2.5 text-center">Diff</th>
            <th className="px-2 py-2.5 text-left">Recent</th>
          </tr>
        </thead>
        <tbody>
          {rankedTeams.map((team) => {
            const diff = team.pointsFor - team.pointsAgainst;
            const recent = getRecentScores(team.id, bracket.matchHistory);
            const isLeader = team.rank === 1;
            return (
              <tr
                key={team.id}
                className={`border-b border-ink-50 transition ${isLeader ? 'bg-amber-50/70' : 'hover:bg-ink-50/60'}`}
              >
                <td className="px-2 py-2 text-center">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-extrabold ${
                      isLeader ? 'bg-amber-400 text-amber-950' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {isLeader && <Crown size={11} />}
                    {team.rank}
                  </span>
                </td>
                <td className="px-2 py-2 font-semibold text-ink-800">
                  <EditableName value={team.player1} onCommit={(v) => editField(team.id, 'player1', v)} />
                </td>
                <td className="px-2 py-2 font-semibold text-ink-800">
                  <EditableName value={team.player2} onCommit={(v) => editField(team.id, 'player2', v)} />
                </td>
                <td className="px-2 py-2 text-center font-mono font-semibold text-ink-700">{team.wins}</td>
                <td className="px-2 py-2 text-center font-mono font-semibold text-ink-700">{team.losses}</td>
                <td className="px-2 py-2 text-center font-mono text-ink-600">{team.pointsFor}</td>
                <td className="px-2 py-2 text-center font-mono text-ink-600">{team.pointsAgainst}</td>
                <td className={`px-2 py-2 text-center font-mono font-bold ${diff >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>
                  {diff >= 0 ? `+${diff}` : diff}
                </td>
                <td className="px-2 py-2">
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {recent.length === 0 ? <span className="text-xs text-ink-300">—</span> : recent.map((r, i) => <RecentScorePill key={i} result={r} />)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
