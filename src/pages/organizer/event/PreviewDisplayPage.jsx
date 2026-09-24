import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Crown, Radio, Timer, Trophy } from 'lucide-react';
import { getEventById, listCategories, listSponsors } from '../../../data/eventsApi';
import {
  getBracketProgressForCategory,
  listBracketsForCategory,
  listLiveMatchesForEvent,
  listMatchesForCategory,
  listTeamsForCategory,
} from '../../../data/bracketsApi';
import AutoCarousel from '../../../components/organizer/AutoCarousel';
import SponsorBox from '../../../components/organizer/SponsorBox';
import SponsorMarquee from '../../../components/organizer/SponsorMarquee';
import { usePagedItems } from '../../../hooks/usePagedItems';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { formatDuration } from '../../../utils/format';
import { usableCourts } from '../../../utils/courts';
import { teamLabel } from '../../../utils/match';
import { rankTeams } from '../../../utils/standings';
import { matchLevelLabel } from '../../../data/playoffApi';

const REFRESH_MS = 6000;
const SLIDE_MS = 7000;
// Both the bracket grid (2x2) and the court row (4 across) are sized so 4
// per page is exactly what fits a screen without wrapping into extra rows —
// beyond that, auto-advance every 10s rather than force a scroll nobody at
// the venue can actually perform.
const PAGE_SIZE = 4;
const PAGE_MS = 10000;

// Two layouts. On a big screen (the venue TV/monitor, >= 1024px) the page is
// a fixed, unscrollable display that pages through brackets and courts on
// its own. On anything smaller (a phone or tablet in someone's hand) it's a
// normal scrolling page instead: nothing rotates away while it's being read,
// every bracket is listed in full, courts sit in a swipeable strip, Next
// Match / Recent Winner sit side by side above the standings rather than
// pinned below them, and sponsors are left off phones entirely.
const WIDE_QUERY = '(min-width: 1024px)';

export default function PreviewDisplayPage() {
  const { eventId, categoryId } = useParams();
  const isWide = useMediaQuery(WIDE_QUERY);
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [brackets, setBrackets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [bracketProgress, setBracketProgress] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ev, cats, bkts, live, bp, sponsorsData] = await Promise.all([
        getEventById(eventId),
        listCategories(eventId),
        listBracketsForCategory(categoryId),
        listLiveMatchesForEvent(eventId),
        getBracketProgressForCategory(categoryId),
        listSponsors(eventId),
      ]);
      setEvent(ev);
      setCategory(cats.find((c) => c.id === categoryId) || null);
      setBrackets(bkts);
      setLiveMatches(live);
      setBracketProgress(bp);
      setSponsors(sponsorsData);
      const [tms, mts] = await Promise.all([listTeamsForCategory(categoryId, bkts), listMatchesForCategory(categoryId)]);
      setTeams(tms);
      setMatches(mts);
    } catch {
      // Spectator display — fail silently and retry on the next poll rather
      // than showing an error screen to whoever is watching the monitor.
    } finally {
      setLoaded(true);
    }
  }, [eventId, categoryId]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const standingsByBracket = useMemo(() => {
    // The knockout bracket (if any) has no meaningful W/L ranking for a
    // single-elimination match — only pool brackets get a standings card.
    return brackets
      .filter((b) => b.kind !== 'playoff')
      .map((b) => ({ bracket: b, ranked: rankTeams(teams.filter((t) => t.bracket_id === b.id)) }))
      .sort((a, b) => a.bracket.letter.localeCompare(b.bracket.letter));
  }, [brackets, teams]);

  const {
    page: bracketsPage,
    pageIndex: bracketPageIndex,
    totalPages: bracketTotalPages,
  } = usePagedItems(standingsByBracket, isWide ? PAGE_SIZE : Infinity, PAGE_MS);

  const nextMatches = useMemo(() => matches.filter((m) => m.status === 'scheduled').slice(0, 3), [matches]);

  const recentWinners = useMemo(
    () =>
      matches
        .filter((m) => m.status === 'completed' && m.winner_team_id)
        .sort((a, b) => new Date(b.finished_at || b.created_at).getTime() - new Date(a.finished_at || a.created_at).getTime())
        .slice(0, 3),
    [matches]
  );

  // Gold/Silver each get their own dedicated box directly below Recent
  // Winners (see SponsorBox) — one logo visible at a time, sliding
  // horizontally, rather than buried in the scrolling credits strip
  // everything else still uses.
  const goldSponsors = useMemo(() => sponsors.filter((s) => s.tier === 'gold'), [sponsors]);
  const silverSponsors = useMemo(() => sponsors.filter((s) => s.tier === 'silver'), [sponsors]);
  const otherSponsors = useMemo(() => sponsors.filter((s) => s.tier !== 'gold' && s.tier !== 'silver'), [sponsors]);

  const numCourts = usableCourts(event);
  const courtsInPlay = liveMatches.length;
  const courtNumbers = useMemo(() => Array.from({ length: numCourts }, (_, i) => i + 1), [numCourts]);
  const { page: courtsPage, pageIndex: courtPageIndex, totalPages: courtTotalPages } = usePagedItems(courtNumbers, PAGE_SIZE, PAGE_MS);
  // Phones: every court in one swipeable strip, the ones in play first.
  const courtsByActivity = useMemo(() => {
    const live = new Set(liveMatches.map((m) => m.court));
    return [...courtNumbers].sort((a, b) => Number(live.has(b)) - Number(live.has(a)) || a - b);
  }, [courtNumbers, liveMatches]);
  const visibleCourts = isWide ? courtsPage : courtsByActivity;

  // Matches run courts-at-a-time, not one after another, so the ETA divides
  // the category's remaining matches across all courts before multiplying
  // by the per-match duration. Scoped to the selected category only.
  const progress = useMemo(() => {
    const totalMatches = bracketProgress.reduce((sum, b) => sum + b.totalMatches, 0);
    const completed = bracketProgress.reduce((sum, b) => sum + b.completedCount, 0);
    const remaining = totalMatches - completed;
    const perMatchMinutes = category?.estimated_match_minutes || event?.match_duration_minutes || 18;
    const estimatedMinutes = Math.ceil(remaining / Math.max(1, numCourts)) * perMatchMinutes;
    return { totalMatches, completed, remaining, estimatedMinutes };
  }, [bracketProgress, category, event, numCourts]);

  if (!loaded) {
    return <div className="flex h-screen items-center justify-center bg-[#f0f1f4] text-sm font-medium text-ink-400">Loading preview…</div>;
  }

  const courtCard = (c) => {
    const m = liveMatches.find((lm) => lm.court === c);
    return (
      <div
        key={c}
        className={`rounded-2xl px-3 py-2.5 transition-colors ${
          isWide ? '' : 'w-[9.5rem] shrink-0 snap-start'
        } ${m ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-ink-50/70 ring-1 ring-ink-100'}`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-extrabold tracking-wide ${m ? 'text-emerald-700' : 'text-ink-400'}`}>COURT {c}</span>
          {m && <Radio size={10} className="animate-pulse text-emerald-500 motion-reduce:animate-none" />}
        </div>
        {m ? (
          <div className="mt-1">
            <div className="truncate text-[9px] font-bold uppercase tracking-wide text-emerald-600">
              {m.category_name}: {matchLevelLabel(m)}
            </div>
            <div className="mt-0.5 text-[11px] font-bold leading-snug text-ink-900">
              <div className="truncate">{teamLabel(m.team_a)}</div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-500">vs</div>
              <div className="truncate">{teamLabel(m.team_b)}</div>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-ink-300">No match</div>
        )}
      </div>
    );
  };

  const cardClass = 'rounded-3xl border border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.05)] backdrop-blur-xl';

  return (
    // Big screen: h-screen (100vh), not h-dvh — dvh is a newer CSS unit that
    // some Smart TV / kiosk browsers don't support, and when it's ignored
    // this container gets no height at all, so it grows with content instead
    // of clamping to the screen — the whole point of the TV layout needing
    // zero scrolling on a display nobody can scroll. Smaller screens scroll
    // normally (see WIDE_QUERY).
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-[#f5f5f7] to-[#e7e8ec] p-3 sm:p-5 lg:h-screen lg:overflow-hidden lg:p-6 print:hidden">
      {/* Top frame: event, time left, and the courts. */}
      <div className="shrink-0 rounded-3xl border border-white/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <div className="truncate font-display text-base font-extrabold tracking-tight text-ink-900 sm:text-xl">{event?.name}</div>
            <div className="truncate text-xs font-semibold text-ink-500 sm:text-sm">{category?.name}</div>
          </div>
          {progress.totalMatches > 0 && (
            <div className="shrink-0 text-right leading-tight">
              <div className="flex items-center justify-end gap-1.5 text-sm font-extrabold text-ink-900 sm:text-lg">
                <Timer size={16} className="text-brand-500" />
                {progress.remaining > 0 ? `~${formatDuration(progress.estimatedMinutes)}` : 'Done'}
              </div>
              <div className="text-[10px] font-semibold text-ink-400">
                {progress.remaining > 0 ? `${progress.remaining} matches left` : 'All matches played'}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-ink-100/70 py-3.5 sm:px-6">
          <div className="mb-2 flex items-center justify-between px-4 text-[10px] font-bold uppercase tracking-wide text-ink-400 sm:px-0">
            <span>Courts</span>
            <span>
              {courtsInPlay}/{numCourts} in play
            </span>
          </div>
          {isWide ? (
            <div className="grid grid-cols-4 gap-2">{visibleCourts.map(courtCard)}</div>
          ) : (
            // Swipeable strip; the side padding lets the first/last card
            // line up with the frame's edge while still scrolling edge to edge.
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              {visibleCourts.map(courtCard)}
            </div>
          )}
          {isWide && courtTotalPages > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {Array.from({ length: courtTotalPages }, (_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === courtPageIndex ? 'w-4 bg-brand-500' : 'w-1.5 bg-ink-200'}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-4">
        <div className="flex flex-col lg:col-span-3 lg:min-h-0">
          {standingsByBracket.length === 0 ? (
            <div className="rounded-3xl border border-white/60 bg-white/70 p-10 text-center text-sm text-ink-400 shadow-sm backdrop-blur-xl">
              No brackets drawn yet for this category.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:min-h-0 lg:flex-1 lg:auto-rows-min lg:overflow-y-auto xl:grid-cols-2">
              {bracketsPage.map(({ bracket, ranked }) => (
                <div key={bracket.id} className={`flex flex-col overflow-hidden lg:min-h-0 ${cardClass}`}>
                  <div className="flex shrink-0 items-center justify-between border-b border-ink-100/70 px-4 py-3 sm:px-5 sm:py-3.5">
                    <span className="font-display text-base font-extrabold text-ink-900">Bracket {bracket.letter}</span>
                    <span className="text-[11px] font-semibold text-ink-400">{ranked.length} teams</span>
                  </div>
                  <div className="lg:overflow-y-auto">
                    <table className="w-full table-fixed text-sm sm:table-auto">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                          <th className="w-12 py-2 pl-3 pr-1 text-center sm:w-auto sm:px-4">#</th>
                          <th className="px-2 py-2 text-left">Team</th>
                          {/* Phones: one compact record column instead of W and L. */}
                          <th className="w-14 px-1 py-2 text-center sm:hidden">W–L</th>
                          <th className="hidden px-2 py-2 text-center sm:table-cell">W</th>
                          <th className="hidden px-2 py-2 text-center sm:table-cell">L</th>
                          <th className="w-14 py-2 pl-1 pr-3 text-center sm:w-auto sm:px-4">Diff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-50">
                        {ranked.map((t) => (
                          <tr key={t.id} className={t.rank === 1 ? 'bg-amber-50/70' : ''}>
                            <td className="py-2.5 pl-3 pr-1 text-center sm:px-4">
                              <span
                                className={`inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-extrabold ${
                                  t.rank === 1 ? 'bg-amber-400 text-amber-950' : 'bg-ink-100 text-ink-600'
                                }`}
                              >
                                {t.rank === 1 && <Crown size={11} />}
                                {t.rank}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 font-semibold text-ink-800">
                              <div className="break-words leading-snug">{teamLabel(t)}</div>
                              {t.club_name && <div className="truncate text-[10px] font-normal text-ink-400">{t.club_name}</div>}
                            </td>
                            <td className="px-1 py-2.5 text-center font-mono text-[13px] font-semibold tabular-nums text-ink-800 sm:hidden">
                              {t.wins}–{t.losses}
                            </td>
                            <td className="hidden px-2 py-2.5 text-center font-mono sm:table-cell">{t.wins}</td>
                            <td className="hidden px-2 py-2.5 text-center font-mono sm:table-cell">{t.losses}</td>
                            <td
                              className={`py-2.5 pl-1 pr-3 text-center font-mono font-bold tabular-nums sm:px-4 ${t.diff >= 0 ? 'text-brand-600' : 'text-rose-600'}`}
                            >
                              {t.diff >= 0 ? `+${t.diff}` : t.diff}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isWide && bracketTotalPages > 1 && (
            <div className="mt-3 flex shrink-0 justify-center gap-1.5">
              {Array.from({ length: bracketTotalPages }, (_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === bracketPageIndex ? 'w-4 bg-brand-500' : 'w-1.5 bg-ink-200'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Phones: Next Match and Recent Winner side by side ABOVE the
            standings (order-first), compact. Big screen: the right column. */}
        <div className="order-first grid grid-cols-2 gap-3 sm:gap-4 lg:order-none lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto">
          <div className={`min-w-0 p-3.5 sm:p-5 lg:shrink-0 ${cardClass}`}>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-ink-800 sm:mb-3 sm:gap-2 sm:text-sm">
              <Clock size={14} className="shrink-0 text-brand-500" /> Next {isWide ? 'Matches' : 'Match'}
            </div>
            <AutoCarousel
              items={nextMatches}
              intervalMs={SLIDE_MS}
              emptyMessage="No upcoming matches"
              renderItem={(m) => (
                <div className="flex flex-col items-center gap-1 py-1 text-center sm:gap-1.5">
                  <span className="max-w-full truncate rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-bold text-violet-700 sm:px-2.5 sm:py-1 sm:text-[10px]">
                    {isWide ? `${category?.name}: ` : ''}
                    {matchLevelLabel(m)}
                  </span>
                  <div className="text-[13px] font-bold leading-snug text-ink-900 sm:text-sm">{teamLabel(m.team_a)}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-brand-400">vs</div>
                  <div className="text-[13px] font-bold leading-snug text-ink-900 sm:text-sm">{teamLabel(m.team_b)}</div>
                </div>
              )}
            />
          </div>

          <div className={`min-w-0 p-3.5 sm:p-5 lg:shrink-0 ${cardClass}`}>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-ink-800 sm:mb-3 sm:gap-2 sm:text-sm">
              <Trophy size={14} className="shrink-0 text-amber-500" /> Recent {isWide ? 'Winners' : 'Winner'}
            </div>
            <AutoCarousel
              items={recentWinners}
              intervalMs={SLIDE_MS}
              emptyMessage="No results yet"
              renderItem={(m) => {
                const winnerIsA = m.winner_team_id === m.team_a_id;
                const winner = winnerIsA ? m.team_a : m.team_b;
                const loser = winnerIsA ? m.team_b : m.team_a;
                return (
                  <div className="flex flex-col items-center gap-1 py-1 text-center">
                    <span className="max-w-full truncate rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 sm:px-2.5 sm:py-1 sm:text-[10px]">
                      {isWide ? `${category?.name}: ` : ''}
                      {matchLevelLabel(m)}
                    </span>
                    <Trophy size={18} className="hidden text-amber-400 sm:block" />
                    <div className="text-[13px] font-extrabold leading-snug text-ink-900 sm:text-sm">{teamLabel(winner)}</div>
                    <div className="font-mono text-sm font-bold tabular-nums text-brand-600">
                      {m.score_a}–{m.score_b}
                    </div>
                    <div className="text-[10px] leading-snug text-ink-400 sm:text-[11px]">def. {teamLabel(loser)}</div>
                  </div>
                );
              }}
            />
          </div>

          {(goldSponsors.length > 0 || silverSponsors.length > 0) && (
            // Hidden on phones. Only spans two columns once both tiers
            // actually have a sponsor — with just one tier populated, that
            // box fills the full width instead of sitting next to dead space.
            <div
              className={`col-span-2 hidden shrink-0 grid-cols-1 gap-3 md:grid ${
                goldSponsors.length > 0 && silverSponsors.length > 0 ? 'sm:grid-cols-2' : ''
              }`}
            >
              {goldSponsors.length > 0 && <SponsorBox tier="gold" sponsors={goldSponsors} />}
              {silverSponsors.length > 0 && <SponsorBox tier="silver" sponsors={silverSponsors} />}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 hidden shrink-0 sm:mt-4 md:block">
        <SponsorMarquee sponsors={otherSponsors} />
      </div>
    </div>
  );
}
