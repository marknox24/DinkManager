import { useState } from 'react';
import { Clock3, Eye, Radio } from 'lucide-react';
import { useTournamentDispatch, useTournamentState } from '../context/TournamentContext';
import { getCategoryStats } from '../utils/stats';
import { formatDuration } from '../utils/format';
import CategoryTabs from '../components/categories/CategoryTabs';
import BracketCard from '../components/categories/BracketCard';
import CategoryPresentation from '../components/presentation/CategoryPresentation';

export default function TournamentPage({ onOpenHistory }) {
  const { categoriesData, activeCategoryIdx, liveMatches, tournamentSettings } = useTournamentState();
  const dispatch = useTournamentDispatch();
  const [previewOpen, setPreviewOpen] = useState(false);

  if (categoriesData.length === 0) {
    return <div className="rounded-3xl border border-ink-100 bg-white p-10 text-center text-ink-400">No categories yet.</div>;
  }

  const catIdx = Math.min(activeCategoryIdx ?? 0, categoriesData.length - 1);
  const category = categoriesData[catIdx];
  const stats = getCategoryStats(category, liveMatches, catIdx, tournamentSettings);

  const selectCategory = (idx) => dispatch({ type: 'SET_ACTIVE_CATEGORY', catIdx: idx }, { silent: true });

  return (
    <div className="flex flex-col gap-5">
      <CategoryTabs activeIdx={catIdx} onSelect={selectCategory} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-ink-900 to-ink-800 px-5 py-4 text-white">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-display text-base font-bold tracking-tight sm:text-lg">{category.name}</h2>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">{category.brackets.length} brackets</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
            {stats.played}/{stats.total} played
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">{stats.notStarted} remaining</span>
          {stats.notStarted === 0 ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700">✓ All matches played</span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
              <Clock3 size={11} /> ~{formatDuration(stats.estMinutes)} left
            </span>
          )}
          {stats.inProgress > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-amber-950">
              <Radio size={11} className="animate-pulse-soft" /> {stats.inProgress} live
            </span>
          )}
        </div>
        <button
          onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600"
        >
          <Eye size={13} /> Preview fullscreen
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {category.brackets.map((bracket, bracketIdx) => (
          <BracketCard key={bracket.letter} category={category} catIdx={catIdx} bracket={bracket} bracketIdx={bracketIdx} onOpenHistory={onOpenHistory} />
        ))}
      </div>

      {previewOpen && <CategoryPresentation catIdx={catIdx} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}
