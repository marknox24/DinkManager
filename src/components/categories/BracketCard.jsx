import { useState } from 'react';
import { History, Radio, RotateCcw } from 'lucide-react';
import { useTournamentDispatch, useTournamentState } from '../../context/TournamentContext';
import { useConfirm } from '../../context/ConfirmContext';
import { getBracketStats } from '../../utils/stats';
import LeaderboardTable from './LeaderboardTable';
import MatchForm from './MatchForm';

export default function BracketCard({ category, catIdx, bracket, bracketIdx, onOpenHistory }) {
  const { liveMatches } = useTournamentState();
  const dispatch = useTournamentDispatch();
  const confirm = useConfirm();
  const stats = getBracketStats(bracket, liveMatches, catIdx, bracketIdx);

  const resetBracket = async () => {
    const ok = await confirm({
      title: `Reset Bracket ${bracket.letter}?`,
      message: `This clears all stats and match history for Bracket ${bracket.letter}. This cannot be undone.`,
      confirmLabel: 'Reset bracket',
    });
    if (ok) dispatch({ type: 'RESET_BRACKET', catIdx, bracketIdx });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm shadow-ink-900/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/70 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-bold text-ink-800">Bracket {bracket.letter}</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-500 ring-1 ring-ink-200">
            {stats.played}/{stats.total} played
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-500 ring-1 ring-ink-200">{stats.remaining} remaining</span>
          {stats.inProgress > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              <Radio size={10} className="animate-pulse-soft" /> {stats.inProgress} live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenHistory(catIdx, bracketIdx)}
            className="flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-sky-700"
          >
            <History size={12} /> Match history
          </button>
          <button
            onClick={resetBracket}
            title="Reset bracket"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink-400 ring-1 ring-ink-200 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
      <LeaderboardTable bracket={bracket} catIdx={catIdx} bracketIdx={bracketIdx} />
      <MatchForm bracket={bracket} catIdx={catIdx} bracketIdx={bracketIdx} />
    </div>
  );
}
