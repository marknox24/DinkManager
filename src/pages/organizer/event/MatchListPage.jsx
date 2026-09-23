import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, FileText, Lock, ListOrdered, Pencil, Printer, Radio, Sparkles, Timer, Trash2, Trophy } from 'lucide-react';
import { getEventById, listCategories, listUmpires } from '../../../data/eventsApi';
import {
  generateRoundRobinMatchList,
  generateSingleEliminationRound1,
  getBracketProgressForCategory,
  listBracketsForCategory,
  listLiveMatchesForEvent,
  listMatchesForCategory,
} from '../../../data/bracketsApi';
import { PLAYOFF_STAGES, generateStageMatches, getPlayoffStatus, matchLevelLabel, savePlan } from '../../../data/playoffApi';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import { useOfflineSync } from '../../../context/OfflineSyncContext';
import { isOnline } from '../../../lib/connectivity';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import ConnectionStatusPill from '../../../components/organizer/ConnectionStatusPill';
import OfflineQueueBanner from '../../../components/organizer/OfflineQueueBanner';
import LiveMatchCard from '../../../components/organizer/LiveMatchCard';
import LogScoreModal from '../../../components/organizer/LogScoreModal';
import StartMatchModal from '../../../components/organizer/StartMatchModal';
import PlayoffCrossoverConfirmModal from '../../../components/organizer/PlayoffCrossoverConfirmModal';
import RoundRobinScoreSheets from '../../../components/organizer/RoundRobinScoreSheets';
import BlankScoreSheets from '../../../components/organizer/BlankScoreSheets';
import {
  cacheEvent,
  cacheCategories,
  cacheUmpires,
  cacheBrackets,
  cacheMatches,
  getCachedEvent,
  getCachedCategories,
  getCachedUmpires,
  getCachedBrackets,
  getCachedMatchesForCategory,
  getCachedLiveMatchesForEvent,
} from '../../../hooks/useOfflineCache';

// Lazy: both pull in jspdf/html-to-image via utils/pdf.js's
// downloadGroupedNodesAsPdf — deferred until the organizer actually opens a
// print-preview modal. (RoundRobinScoreSheets/BlankScoreSheets above are the
// plain printable markup, no pdf lib, so they stay eager.)
const RoundRobinSheetsModal = lazy(() => import('../../../components/organizer/RoundRobinSheetsModal'));
const BlankScoreSheetsModal = lazy(() => import('../../../components/organizer/BlankScoreSheetsModal'));
import { useNow } from '../../../hooks/useNow';
import { usableCourts } from '../../../utils/courts';
import { formatDuration } from '../../../utils/format';
import { liveElapsedSeconds, teamLabel } from '../../../utils/match';

function isRoundRobinFormat(format) {
  return /round robin/i.test(format || '');
}

function isSingleElimFormat(format) {
  return /single elimination/i.test(format || '');
}

export default function MatchListPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const { can } = useEventAccess();
  const { enqueueWrite } = useOfflineSync();
  const now = useNow(1000);

  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [umpires, setUmpires] = useState([]);
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [brackets, setBrackets] = useState([]);
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [bracketProgress, setBracketProgress] = useState([]);
  const [playoffStatus, setPlayoffStatus] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState(null);
  const [confirmingLevel, setConfirmingLevel] = useState(null);
  const [loggingMatch, setLoggingMatch] = useState(null);
  const [startingMatch, setStartingMatch] = useState(null);
  const [sheetsPreviewOpen, setSheetsPreviewOpen] = useState(false);
  const [printingSheets, setPrintingSheets] = useState(false);
  const [blankPreviewOpen, setBlankPreviewOpen] = useState(false);
  const [printingBlankCount, setPrintingBlankCount] = useState(null);
  // Rounds where every match is completed default to collapsed so the page
  // stays scannable as a tournament progresses; { [roundNumber]: boolean }
  // overrides that default once the organizer manually opens/closes one.
  const [roundOverrides, setRoundOverrides] = useState({});

  useEffect(() => {
    Promise.all([getEventById(eventId), listCategories(eventId), listUmpires(eventId)])
      .then(([ev, cats, ump]) => {
        setEvent(ev);
        setCategories(cats);
        setUmpires(ump);
        cacheEvent(ev);
        cacheCategories(eventId, cats);
        cacheUmpires(eventId, ump);
      })
      .catch(async (e) => {
        // Offline (or any other fetch failure): fall back to whatever this
        // event's data looked like the last time it loaded successfully,
        // rather than leaving the page stuck on "Loading…" forever — this
        // is the one thing that has to work for a referee to keep scoring
        // with no signal at all.
        const cachedEvent = await getCachedEvent(eventId);
        if (!cachedEvent) {
          pushToast(e.message, 'error');
          return;
        }
        const [cachedCats, cachedUmp] = await Promise.all([getCachedCategories(eventId), getCachedUmpires(eventId)]);
        setEvent(cachedEvent);
        setCategories(cachedCats);
        setUmpires(cachedUmp);
      });
  }, [eventId, pushToast]);

  // Event-wide, independent of the active category tab, so a match started
  // from any category stays pinned above the tabs even after switching.
  const loadLiveMatches = useCallback(async () => {
    try {
      const live = await listLiveMatchesForEvent(eventId);
      setLiveMatches(live);
      cacheMatches(eventId, null, live);
    } catch (e) {
      const cachedLive = await getCachedLiveMatchesForEvent(eventId);
      if (cachedLive.length > 0) {
        setLiveMatches(cachedLive);
      } else {
        pushToast(e.message, 'error');
      }
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    loadLiveMatches();
  }, [loadLiveMatches]);

  const activeCategory = categories[activeCatIdx];

  const reloadCategoryData = useCallback(async () => {
    if (!activeCategory) return;
    setLoadingMatches(true);
    try {
      const [bkts, mts] = await Promise.all([listBracketsForCategory(activeCategory.id), listMatchesForCategory(activeCategory.id)]);
      setBrackets(bkts);
      setMatches(mts);
      cacheBrackets(activeCategory.id, bkts);
      cacheMatches(eventId, activeCategory.id, mts);
    } catch (e) {
      const [cachedBrackets, cachedMatches] = await Promise.all([getCachedBrackets(activeCategory.id), getCachedMatchesForCategory(activeCategory.id)]);
      if (cachedBrackets.length > 0 || cachedMatches.length > 0) {
        setBrackets(cachedBrackets);
        setMatches(cachedMatches);
      } else {
        pushToast(e.message, 'error');
      }
    } finally {
      setLoadingMatches(false);
    }
  }, [activeCategory, pushToast, eventId]);

  useEffect(() => {
    reloadCategoryData();
    setRoundOverrides({});
  }, [reloadCategoryData]);

  // Not part of this pass's offline dataset (see the offline-sync plan's
  // scope) — a stale/blank progress summary while offline is a harmless,
  // expected degradation, so failures here are silent rather than an error
  // toast, which would otherwise fire alongside every successful queued
  // match action just because this supplementary summary couldn't refresh.
  const loadBracketProgress = useCallback(async () => {
    if (!activeCategory) {
      setBracketProgress([]);
      return;
    }
    try {
      const progress = await getBracketProgressForCategory(activeCategory.id);
      setBracketProgress(progress);
    } catch (e) {
      // Offline: leave the last-known progress on screen rather than
      // erroring. Online: this is a real failure worth surfacing — silently
      // swallowing it here would hide a genuine bug behind what looks like
      // an ordinary "not generated yet" state.
      if (isOnline()) pushToast(e.message, 'error');
    }
  }, [activeCategory, pushToast]);

  useEffect(() => {
    loadBracketProgress();
  }, [loadBracketProgress]);

  // Same offline-scope rationale as loadBracketProgress above.
  const loadPlayoffStatus = useCallback(async () => {
    if (!activeCategory?.playoff_enabled) {
      setPlayoffStatus([]);
      return;
    }
    try {
      const status = await getPlayoffStatus(activeCategory.id);
      setPlayoffStatus(status);
    } catch (e) {
      if (isOnline()) pushToast(e.message, 'error');
    }
  }, [activeCategory, pushToast]);

  useEffect(() => {
    loadPlayoffStatus();
  }, [loadPlayoffStatus]);

  // A match can only go live if a court is free — capped by the event's
  // configured court count (Settings page) and its plan, minus courts
  // already in use.
  const numCourts = usableCourts(event);

  // Matches run numCourts-at-a-time, not one after another, so the ETA
  // divides the remaining count across all courts before multiplying by
  // the per-match duration.
  const categoryProgress = useMemo(() => {
    const totalMatches = bracketProgress.reduce((sum, b) => sum + b.totalMatches, 0);
    const completed = bracketProgress.reduce((sum, b) => sum + b.completedCount, 0);
    const remaining = totalMatches - completed;
    const perMatchMinutes = activeCategory?.estimated_match_minutes || event?.match_duration_minutes || 18;
    const estimatedMinutes = Math.ceil(remaining / numCourts) * perMatchMinutes;
    return { totalMatches, completed, remaining, estimatedMinutes };
  }, [bracketProgress, activeCategory, event, numCourts]);

  const rounds = useMemo(() => {
    const grouped = new Map();
    matches.forEach((m) => {
      const r = m.round_number || 1;
      if (!grouped.has(r)) grouped.set(r, []);
      grouped.get(r).push(m);
    });
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  // Score sheets are Round Robin pool play only (see RoundRobinScoreSheet.jsx)
  // — never the knockout/playoff stage — and `matches` already carries both,
  // so this is the one filter every sheet consumer (preview, print) shares.
  // `matches` is already in the exact order this page displays (round, then
  // bracket, then match code — see listMatchesForCategory), so no re-sort.
  const poolMatches = useMemo(() => matches.filter((m) => !m.playoff_stage), [matches]);
  const canPrintSheets = !!activeCategory && isRoundRobinFormat(activeCategory.format) && poolMatches.length > 0;

  const availableCourts = useMemo(() => {
    const occupied = new Set(liveMatches.map((m) => m.court).filter(Boolean));
    return Array.from({ length: numCourts }, (_, i) => i + 1).filter((c) => !occupied.has(c));
  }, [numCourts, liveMatches]);

  // An umpire already officiating a live match can't be double-booked onto another.
  const availableUmpires = useMemo(() => {
    const occupied = new Set(liveMatches.map((m) => m.umpire_name).filter(Boolean));
    return umpires.filter((u) => !occupied.has(u.name));
  }, [umpires, liveMatches]);

  const isLocked = event?.status === 'finished';
  const blockIfLocked = () => {
    if (!isLocked) return false;
    pushToast('This event is finished and locked — matches can no longer be edited.', 'error');
    return true;
  };

  const handleGenerate = async () => {
    if (blockIfLocked()) return;
    setGenerating(true);
    try {
      if (isRoundRobinFormat(activeCategory.format)) {
        await generateRoundRobinMatchList(activeCategory.id);
        pushToast('Match list generated', 'success');
      } else if (isSingleElimFormat(activeCategory.format)) {
        const { byes } = await generateSingleEliminationRound1(activeCategory.id);
        pushToast(
          byes.length > 0 ? `Round 1 generated — ${byes.map((b) => b.name).join(', ')} received a bye` : 'Round 1 generated',
          'success'
        );
      }
      await reloadCategoryData();
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Every level after the first is standard bracket order and generates
  // straight away; only the first knockout stage — fed by pool letters that
  // weren't necessarily known when the playoff plan was set up in Event
  // Details — gets a confirm dialog first (see PlayoffCrossoverConfirmModal).
  const handleGenerateStageClick = (level) => {
    const isFirstStage = playoffStatus[0]?.kind === level.kind;
    if (isFirstStage) {
      setConfirmingLevel(level);
      return;
    }
    handleGenerateStage(level.kind);
  };

  const handleGenerateStage = async (kind) => {
    if (blockIfLocked()) return;
    setGeneratingStage(kind);
    try {
      await generateStageMatches(activeCategory.id, kind);
      pushToast(`${PLAYOFF_STAGES[kind].label} generated`, 'success');
      await Promise.all([reloadCategoryData(), loadPlayoffStatus(), loadBracketProgress()]);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setGeneratingStage(null);
    }
  };

  const handleConfirmCrossover = async ({ playoff_pool_pairs, playoff_advance_per_pool }) => {
    await savePlan(activeCategory.id, { playoff_pool_pairs, playoff_advance_per_pool });
    setCategories((prev) => prev.map((c) => (c.id === activeCategory.id ? { ...c, playoff_pool_pairs, playoff_advance_per_pool } : c)));
    await handleGenerateStage(confirmingLevel.kind);
    setConfirmingLevel(null);
  };

  // Every handler below enqueues through OfflineSyncContext instead of
  // calling bracketsApi directly: enqueueWrite writes an optimistic version
  // of the match into the offline cache first (so the reload right after —
  // which falls back to that same cache when offline — reflects the change
  // immediately), then queues the write, flushing it right away when
  // online. It never throws on a network failure, so these handlers behave
  // identically whether the write actually reached the server or is
  // sitting in the queue for later — the ConnectionStatusPill/
  // OfflineQueueBanner communicate which of those happened, not a toast.
  const handleConfirmStart = async (match, { court, umpire_name }) => {
    if (blockIfLocked()) return;
    const now = new Date().toISOString();
    await enqueueWrite({
      matchId: match.id,
      operationType: 'start',
      payload: { court, umpire_name },
      optimisticMatch: { ...match, status: 'in_progress', started_at: now, running_since: now, accumulated_seconds: 0, court, umpire_name, category_id: activeCategory?.id },
    });
    pushToast('Match started', 'success');
    setStartingMatch(null);
    await Promise.all([reloadCategoryData(), loadLiveMatches()]);
  };

  const handleLogScore = async (match, sA, sB, umpireName) => {
    if (blockIfLocked()) return;
    const winner_team_id = sA > sB ? match.team_a_id : match.team_b_id;
    await enqueueWrite({
      matchId: match.id,
      operationType: 'log_score',
      payload: { score_a: sA, score_b: sB, winner_team_id, umpire_name: umpireName },
      optimisticMatch: {
        ...match,
        status: 'completed',
        score_a: sA,
        score_b: sB,
        winner_team_id,
        umpire_name: umpireName,
        finished_at: new Date().toISOString(),
        category_id: activeCategory?.id,
      },
    });
    pushToast('Match recorded', 'success');
    setLoggingMatch(null);
    await Promise.all([reloadCategoryData(), loadBracketProgress(), loadPlayoffStatus()]);
  };

  const handleRemove = async (match) => {
    if (blockIfLocked()) return;
    const ok = await confirm({
      title: `Remove match ${match.match_code || ''}?`,
      message: 'This scheduled match will be deleted.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    await enqueueWrite({ matchId: match.id, operationType: 'remove', payload: {}, optimisticDelete: true });
    await reloadCategoryData();
  };

  const handleTogglePause = async (match) => {
    if (blockIfLocked()) return;
    if (match.running_since) {
      const accumulated_seconds = liveElapsedSeconds(match, Date.now());
      await enqueueWrite({
        matchId: match.id,
        operationType: 'pause',
        payload: { accumulated_seconds },
        optimisticMatch: { ...match, accumulated_seconds, running_since: null },
      });
    } else {
      const running_since = new Date().toISOString();
      await enqueueWrite({
        matchId: match.id,
        operationType: 'resume',
        payload: {},
        optimisticMatch: { ...match, running_since },
      });
    }
    await loadLiveMatches();
  };

  const handleCancelLive = async (match) => {
    if (blockIfLocked()) return;
    const ok = await confirm({
      title: 'Cancel this match?',
      message: 'This match will be reset back to scheduled with no score recorded.',
      confirmLabel: 'Cancel match',
    });
    if (!ok) return;
    await enqueueWrite({
      matchId: match.id,
      operationType: 'cancel',
      payload: {},
      optimisticMatch: { ...match, status: 'scheduled', started_at: null, running_since: null, accumulated_seconds: 0 },
    });
    pushToast('Match canceled', 'success');
    await Promise.all([reloadCategoryData(), loadLiveMatches()]);
  };

  const handleFinishLive = async (match, sA, sB) => {
    if (blockIfLocked()) return;
    const elapsedSeconds = liveElapsedSeconds(match, Date.now());
    const winner_team_id = sA > sB ? match.team_a_id : match.team_b_id;
    const duration_minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    await enqueueWrite({
      matchId: match.id,
      operationType: 'finish',
      payload: { score_a: sA, score_b: sB, winner_team_id, duration_minutes },
      optimisticMatch: {
        ...match,
        status: 'completed',
        score_a: sA,
        score_b: sB,
        winner_team_id,
        duration_minutes,
        running_since: null,
        finished_at: new Date().toISOString(),
      },
    });
    pushToast('Match recorded', 'success');
    await Promise.all([reloadCategoryData(), loadLiveMatches(), loadBracketProgress(), loadPlayoffStatus()]);
  };

  const formatSupported = activeCategory && (isRoundRobinFormat(activeCategory.format) || isSingleElimFormat(activeCategory.format));

  return (
    <EventWorkspaceLayout event={event}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold text-ink-900">Match List</h1>
            <ConnectionStatusPill />
          </div>
          <p className="text-sm text-ink-500">Auto-generate the match schedule for round robin and single elimination categories — and any playoff levels set up after pool play</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canPrintSheets && (
            <button
              onClick={() => setSheetsPreviewOpen(true)}
              title="Preview, print, or download Round Robin score sheets for this category"
              className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:bg-ink-100"
            >
              <Printer size={14} /> Score Sheets
            </button>
          )}
          {activeCategory?.playoff_enabled && (
            <button
              onClick={() => setBlankPreviewOpen(true)}
              title="Download a blank score sheet template for Quarterfinals, Semifinals, and Finals"
              className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:bg-ink-100"
            >
              <FileText size={14} /> Blank Template
            </button>
          )}
        </div>
      </div>

      <OfflineQueueBanner onDiscarded={() => Promise.all([reloadCategoryData(), loadLiveMatches(), loadBracketProgress(), loadPlayoffStatus()])} />

      {liveMatches.length > 0 && (
        <div className="sticky top-14 z-20 -mx-4 mb-5 bg-[#f3f6f8]/95 px-4 pb-4 pt-1 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:top-0">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {liveMatches.map((m) => (
              <LiveMatchCard
                key={m.id}
                match={m}
                now={now}
                categoryName={m.category_name}
                onTogglePause={handleTogglePause}
                onCancel={handleCancelLive}
                onFinish={handleFinishLive}
              />
            ))}
          </div>
        </div>
      )}

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-12 text-center text-sm text-ink-400">
          Add categories in Edit event before generating a match list.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {categories.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => setActiveCatIdx(i)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  i === activeCatIdx ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {bracketProgress.length > 0 && (
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-ink-800">
                  <Timer size={14} className="text-ink-400" /> Category progress
                </div>
                <div className="text-xs font-semibold text-ink-600">
                  {categoryProgress.completed}/{categoryProgress.totalMatches} matches played · {categoryProgress.remaining} remaining
                  {categoryProgress.remaining > 0 &&
                    ` · ~${formatDuration(categoryProgress.estimatedMinutes)} left across ${numCourts} ${numCourts === 1 ? 'court' : 'courts'}`}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bracketProgress.map((b) => (
                  <span key={b.bracket_id} className="rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-600 ring-1 ring-ink-200">
                    {b.kind === 'playoff' ? 'Playoffs' : `Bracket ${b.letter}`}: {b.completedCount}/{b.totalMatches} · {b.remaining} left
                  </span>
                ))}
              </div>
            </div>
          )}

          {playoffStatus.length > 0 && (
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-800">
                <Trophy size={14} className="text-amber-500" /> Playoffs
              </div>
              <div className="flex flex-col divide-y divide-ink-50">
                {playoffStatus.map((level, i) => {
                  const canGenerateThisLevel = i === 0 ? can('redraw_brackets') : can('brackets') || can('matchlist');
                  return (
                    <div key={level.kind} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink-400">Level {i + 2}</span>
                        <span className="text-sm font-semibold text-ink-800">{level.label}</span>
                        {(level.status === 'generated' || level.status === 'complete') && (
                          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-500">
                            {level.completedCount}/{level.matchCount} played
                          </span>
                        )}
                      </div>
                      {level.status === 'locked' ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-ink-400">
                          <Lock size={12} /> {level.blockedReason}
                        </span>
                      ) : level.status === 'ready' ? (
                        canGenerateThisLevel ? (
                          <button
                            onClick={() => handleGenerateStageClick(level)}
                            disabled={generatingStage === level.kind}
                            className="rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
                          >
                            {generatingStage === level.kind ? 'Generating…' : `Generate ${level.label}`}
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-ink-400">Waiting on the organizer to generate this</span>
                        )
                      ) : (
                        <span className="text-xs font-bold text-brand-600">{level.status === 'complete' ? 'Complete' : 'Generated'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loadingMatches ? (
            <div className="py-10 text-center text-sm text-ink-400">Loading…</div>
          ) : brackets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
              <ListOrdered size={22} className="mx-auto mb-2 text-ink-300" />
              <p className="text-sm font-semibold text-ink-700">No brackets drawn yet for {activeCategory?.name}</p>
              <p className="mt-1 text-xs text-ink-400">Draw brackets first, then come back to generate the match list.</p>
              <Link
                to={`/events/${eventId}/brackets`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
              >
                Go to Brackets
              </Link>
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
              <Sparkles size={22} className="mx-auto mb-2 text-ink-300" />
              {formatSupported ? (
                <>
                  <p className="text-sm font-semibold text-ink-700">
                    Generate the {isRoundRobinFormat(activeCategory.format) ? 'full match list' : 'Round 1 pairings'} for {activeCategory.name}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    {isRoundRobinFormat(activeCategory.format)
                      ? 'Matches are coded per bracket (A1, B1, A2, ...) and alternate across brackets round by round.'
                      : 'Later rounds are played from the Brackets page once Round 1 results are in.'}
                  </p>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Sparkles size={14} /> {generating ? 'Generating…' : isRoundRobinFormat(activeCategory.format) ? 'Generate match list' : 'Generate Round 1'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-ink-500">
                  Automatic match list generation isn't available for the "{activeCategory.format}" format yet — use Start Match / Log Score on
                  the <Link to={`/events/${eventId}/brackets`} className="font-semibold text-brand-600">Brackets page</Link>.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {rounds.map(([roundNumber, roundMatches]) => {
                const completedCount = roundMatches.filter((m) => m.status === 'completed').length;
                const allCompleted = completedCount === roundMatches.length;
                const isOpen = roundOverrides[roundNumber] ?? !allCompleted;
                const roundLabel = matchLevelLabel(roundMatches[0] || { round_number: roundNumber });
                return (
                  <div key={roundNumber} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setRoundOverrides((prev) => ({ ...prev, [roundNumber]: !isOpen }))}
                      className="flex w-full items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/70 px-5 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink-800">{roundLabel}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500 ring-1 ring-ink-200">
                          {completedCount}/{roundMatches.length} played
                        </span>
                      </div>
                      <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[580px] text-sm">
                          <thead>
                            <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                              <th className="px-4 py-2.5 text-left">Match</th>
                              <th className="px-4 py-2.5 text-left">Teams</th>
                              <th className="px-4 py-2.5 text-center">Result</th>
                              <th className="px-4 py-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {roundMatches.map((m) => {
                              const winnerIsA = m.status === 'completed' && m.winner_team_id === m.team_a_id;
                              const winnerIsB = m.status === 'completed' && m.winner_team_id === m.team_b_id;
                              return (
                                <tr key={m.id} className="border-b border-ink-50">
                                  <td className="px-4 py-2.5 align-middle font-mono text-xs font-bold text-ink-400">{m.match_code}</td>
                                  <td className="px-4 py-2.5 align-middle">
                                    <div className="flex flex-col gap-0.5">
                                      <div className={`flex items-center gap-1 text-[13px] ${winnerIsA ? 'font-bold text-brand-700' : 'font-medium text-ink-700'}`}>
                                        {winnerIsA && <Trophy size={11} className="shrink-0 text-brand-500" />}
                                        <span className="truncate">{teamLabel(m.team_a)}</span>
                                      </div>
                                      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-300">vs</div>
                                      <div className={`flex items-center gap-1 text-[13px] ${winnerIsB ? 'font-bold text-brand-700' : 'font-medium text-ink-700'}`}>
                                        {winnerIsB && <Trophy size={11} className="shrink-0 text-brand-500" />}
                                        <span className="truncate">{teamLabel(m.team_b)}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-center align-middle">
                                    {m.status === 'completed' ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className="font-mono text-sm font-bold text-ink-900">
                                          {m.score_a}–{m.score_b}
                                        </span>
                                        <button
                                          onClick={() => setLoggingMatch(m)}
                                          title="Edit score"
                                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-600"
                                        >
                                          <Pencil size={11} />
                                        </button>
                                      </div>
                                    ) : m.status === 'in_progress' ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-600">
                                        <Radio size={10} className="animate-pulse" /> LIVE
                                      </span>
                                    ) : (
                                      <span className="inline-block rounded-full bg-ink-100 px-3 py-1 text-[11px] font-bold text-ink-500">
                                        Scheduled
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 align-middle">
                                    {m.status === 'scheduled' && (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => setStartingMatch(m)}
                                          disabled={availableCourts.length === 0 || availableUmpires.length === 0}
                                          title={
                                            availableCourts.length === 0
                                              ? 'All courts are in use'
                                              : availableUmpires.length === 0
                                                ? 'No umpires available'
                                                : undefined
                                          }
                                          className="shrink-0 whitespace-nowrap rounded-full bg-brand-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          Start
                                        </button>
                                        <button
                                          onClick={() => setLoggingMatch(m)}
                                          disabled={umpires.length === 0}
                                          title={umpires.length === 0 ? 'Add an umpire first' : undefined}
                                          className="shrink-0 whitespace-nowrap rounded-full border border-ink-200 px-2.5 py-1.5 text-[11px] font-bold text-ink-600 transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          Log score
                                        </button>
                                        {/* Removing a playoff fixture would silently break the next
                                            stage's generation (it only checks readiness, it can't
                                            repair a missing match), so that action isn't offered here. */}
                                        {!m.playoff_stage && (
                                          <button
                                            onClick={() => handleRemove(m)}
                                            title="Remove match"
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 transition hover:bg-ink-200"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loggingMatch && (
        <LogScoreModal match={loggingMatch} categoryName={activeCategory?.name} umpires={umpires} onSave={handleLogScore} onClose={() => setLoggingMatch(null)} />
      )}
      {startingMatch && (
        <StartMatchModal
          match={startingMatch}
          categoryName={activeCategory?.name}
          availableCourts={availableCourts}
          availableUmpires={availableUmpires}
          onStart={handleConfirmStart}
          onClose={() => setStartingMatch(null)}
        />
      )}
      {confirmingLevel && (
        <PlayoffCrossoverConfirmModal
          level={confirmingLevel}
          poolLetters={brackets.filter((b) => b.kind === 'pool').map((b) => b.letter).sort()}
          plan={activeCategory}
          onConfirm={handleConfirmCrossover}
          onClose={() => setConfirmingLevel(null)}
        />
      )}

      {sheetsPreviewOpen && (
        <Suspense fallback={null}>
          <RoundRobinSheetsModal
            category={activeCategory}
            matches={poolMatches}
            onPrint={() => setPrintingSheets(true)}
            onClose={() => setSheetsPreviewOpen(false)}
          />
        </Suspense>
      )}

      {printingSheets && (
        <RoundRobinScoreSheets category={activeCategory} matches={poolMatches} onDone={() => setPrintingSheets(false)} />
      )}

      {blankPreviewOpen && (
        <Suspense fallback={null}>
          <BlankScoreSheetsModal
            category={activeCategory}
            onPrint={(count) => setPrintingBlankCount(count)}
            onClose={() => setBlankPreviewOpen(false)}
          />
        </Suspense>
      )}

      {printingBlankCount != null && (
        <BlankScoreSheets category={activeCategory} count={printingBlankCount} onDone={() => setPrintingBlankCount(null)} />
      )}
    </EventWorkspaceLayout>
  );
}
