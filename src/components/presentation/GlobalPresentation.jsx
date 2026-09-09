import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Trophy, X } from 'lucide-react';
import { useTournamentState } from '../../context/TournamentContext';
import { getRankedTeams, getRecentScores } from '../../utils/stats';

export default function GlobalPresentation({ onClose }) {
  const { categoriesData } = useTournamentState();
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (categoriesData.length <= 1) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % categoriesData.length), 7000);
    return () => clearInterval(timerRef.current);
  }, [categoriesData.length, index]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (categoriesData.length === 0) return null;
  const category = categoriesData[index];

  return (
    <div className="fixed inset-0 z-[20000] flex flex-col bg-ink-950">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-amber-400 bg-ink-900 px-8 py-5">
        <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold text-amber-200 sm:text-3xl">
          <Trophy size={26} /> All categories &middot; Auto-scroll
        </h2>
        <div className="flex items-center gap-4">
          <button onClick={() => setIndex((i) => (i - 1 + categoriesData.length) % categoriesData.length)} className="rounded-full bg-ink-700 px-4 py-2 font-bold text-white transition hover:bg-ink-600">
            <ChevronLeft size={20} />
          </button>
          <span className="rounded-full bg-ink-700 px-5 py-2 font-bold text-white">
            {index + 1} / {categoriesData.length}
          </span>
          <button onClick={() => setIndex((i) => (i + 1) % categoriesData.length)} className="rounded-full bg-ink-700 px-4 py-2 font-bold text-white transition hover:bg-ink-600">
            <ChevronRight size={20} />
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 font-bold text-white transition hover:bg-rose-700">
            <X size={18} /> Exit
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
        <div className="rounded-[2.5rem] bg-ink-800 p-6 sm:p-8">
          <h3 className="mb-6 font-display text-3xl font-extrabold text-amber-200">{category.name}</h3>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {category.brackets.map((bracket) => {
              const ranked = getRankedTeams(bracket.teams);
              return (
                <div key={bracket.letter} className="overflow-hidden rounded-3xl bg-white shadow-xl">
                  <div className="bg-ink-900 px-6 py-4 text-xl font-bold text-white">Bracket {bracket.letter}</div>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-ink-50 text-xs font-bold uppercase tracking-wide text-ink-500">
                        <th className="px-3 py-3">Rank</th>
                        <th className="px-3 py-3 text-left">P1</th>
                        <th className="px-3 py-3 text-left">P2</th>
                        <th className="px-3 py-3">W</th>
                        <th className="px-3 py-3">L</th>
                        <th className="px-3 py-3">RF</th>
                        <th className="px-3 py-3">RA</th>
                        <th className="px-3 py-3">Diff</th>
                        <th className="px-3 py-3 text-left">Recent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((team) => {
                        const diff = team.pointsFor - team.pointsAgainst;
                        const recent = getRecentScores(team.id, bracket.matchHistory);
                        return (
                          <tr key={team.id} className={`border-b border-ink-100 ${team.rank === 1 ? 'bg-amber-50' : ''}`}>
                            <td className="px-3 py-2.5 text-center font-bold">{team.rank}</td>
                            <td className="px-3 py-2.5 font-semibold text-ink-800">{team.player1}</td>
                            <td className="px-3 py-2.5 font-semibold text-ink-800">{team.player2}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{team.wins}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{team.losses}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{team.pointsFor}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{team.pointsAgainst}</td>
                            <td className={`px-3 py-2.5 text-center font-mono font-bold ${diff >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>{diff >= 0 ? `+${diff}` : diff}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {recent.length === 0 ? (
                                  <span className="text-ink-300">—</span>
                                ) : (
                                  recent.map((r, i) => (
                                    <span key={i} className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${r.win ? 'bg-brand-50 text-brand-700' : 'bg-rose-50 text-rose-600'}`}>
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
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t border-ink-800 bg-ink-900 py-3 text-center text-sm text-ink-400">⏩ Auto-scrolls categories every 7 seconds</div>
    </div>
  );
}
