import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Crown, X } from 'lucide-react';
import { useTournamentState } from '../../context/TournamentContext';
import { getRankedTeams, getRecentScores } from '../../utils/stats';

export default function CategoryPresentation({ catIdx, onClose }) {
  const { categoriesData } = useTournamentState();
  const category = catIdx != null ? categoriesData[catIdx] : null;
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => setIndex(0), [catIdx]);

  useEffect(() => {
    if (!category || category.brackets.length <= 1) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % category.brackets.length), 7000);
    return () => clearInterval(timerRef.current);
  }, [category, index]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!category) return null;
  const bracket = category.brackets[index];
  const ranked = getRankedTeams(bracket.teams);

  return (
    <div className="fixed inset-0 z-[20000] flex flex-col bg-ink-950">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-amber-400 bg-ink-900 px-8 py-5">
        <h2 className="font-display text-2xl font-extrabold text-amber-200 sm:text-3xl">{category.name}</h2>
        <div className="flex items-center gap-4">
          <button onClick={() => setIndex((i) => (i - 1 + category.brackets.length) % category.brackets.length)} className="rounded-full bg-ink-700 px-4 py-2 font-bold text-white transition hover:bg-ink-600">
            <ChevronLeft size={20} />
          </button>
          <span className="rounded-full bg-ink-700 px-5 py-2 font-bold text-white">
            Bracket {bracket.letter} &middot; {index + 1}/{category.brackets.length}
          </span>
          <button onClick={() => setIndex((i) => (i + 1) % category.brackets.length)} className="rounded-full bg-ink-700 px-4 py-2 font-bold text-white transition hover:bg-ink-600">
            <ChevronRight size={20} />
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 font-bold text-white transition hover:bg-rose-700">
            <X size={18} /> Exit
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto px-6 py-8 sm:px-12">
        <div className="w-full max-w-6xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl">
          <div className="bg-ink-900 py-6 text-center font-display text-3xl font-extrabold text-white">Bracket {bracket.letter}</div>
          <table className="w-full border-collapse text-lg">
            <thead>
              <tr className="bg-ink-50 text-sm font-bold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-4">Rank</th>
                <th className="px-4 py-4 text-left">Player 1</th>
                <th className="px-4 py-4 text-left">Player 2</th>
                <th className="px-4 py-4">W</th>
                <th className="px-4 py-4">L</th>
                <th className="px-4 py-4">RF</th>
                <th className="px-4 py-4">RA</th>
                <th className="px-4 py-4">Diff</th>
                <th className="px-4 py-4 text-left">Recent</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((team) => {
                const diff = team.pointsFor - team.pointsAgainst;
                const recent = getRecentScores(team.id, bracket.matchHistory);
                return (
                  <tr key={team.id} className={`border-b-2 border-ink-100 ${team.rank === 1 ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-extrabold ${team.rank === 1 ? 'bg-amber-400 text-amber-950' : 'bg-ink-100 text-ink-600'}`}>
                        {team.rank === 1 && <Crown size={16} />} {team.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink-800">{team.player1}</td>
                    <td className="px-4 py-3 font-semibold text-ink-800">{team.player2}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold">{team.wins}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold">{team.losses}</td>
                    <td className="px-4 py-3 text-center font-mono">{team.pointsFor}</td>
                    <td className="px-4 py-3 text-center font-mono">{team.pointsAgainst}</td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${diff >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>{diff >= 0 ? `+${diff}` : diff}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {recent.length === 0 ? (
                          <span className="text-ink-300">—</span>
                        ) : (
                          recent.map((r, i) => (
                            <span key={i} className={`rounded-md px-2 py-0.5 text-sm font-bold ${r.win ? 'bg-brand-50 text-brand-700' : 'bg-rose-50 text-rose-600'}`}>
                              {r.win ? 'W' : 'L'} {r.myScore}-{r.oppScore}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="w-full max-w-6xl rounded-[2rem] bg-amber-50 p-6">
          <div className="mb-4 border-l-8 border-amber-400 pl-4 font-display text-2xl font-bold text-amber-800">Recent matches</div>
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-2">
            {bracket.matchHistory.length === 0 ? (
              <div className="text-center text-ink-400">🏓 No matches recorded yet.</div>
            ) : (
              bracket.matchHistory.slice(0, 6).map((m, i) => (
                <div key={i} className="rounded-2xl border-l-4 border-brand-500 bg-white px-5 py-3 shadow-sm">
                  <div className="font-bold text-ink-800">
                    {m.teamA} <span className="font-normal text-ink-400">vs</span> {m.teamB}
                  </div>
                  <div className="text-ink-600">
                    {m.scoreA} – {m.scoreB} &nbsp; 🏆 Winner: {m.winner}
                  </div>
                  <div className="mt-1 text-xs text-ink-400">{m.timestamp}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-full bg-ink-800 px-6 py-2 text-sm text-ink-300">⏩ Auto-slides every 7 seconds</div>
      </div>
    </div>
  );
}
