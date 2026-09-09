import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Crown, Play, Radio, Shuffle, Timer, Trophy } from 'lucide-react';
import { getEventById, listCategories, listRegistrations, listUmpires } from '../../../data/eventsApi';
import {
  cancelLiveMatch,
  deleteBracketsForCategory,
  deleteMatch,
  finishMatch,
  generateBrackets,
  getBracketProgressForCategory,
  listBracketsForCategory,
  listLiveMatchesForEvent,
  listMatchesForBracket,
  listTeamsForBracket,
  pauseMatch,
  recordMatch,
  resumeMatch,
  startMatch,
} from '../../../data/bracketsApi';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import RandomizerModal from '../../../components/organizer/RandomizerModal';
import LiveMatchCard from '../../../components/organizer/LiveMatchCard';
import { inputClass } from '../../../components/ui/FormField';
import { useNow } from '../../../hooks/useNow';
import { formatDuration } from '../../../utils/format';
import { liveElapsedSeconds, teamLabel } from '../../../utils/match';

function rankTeams(teams) {
  const enriched = teams.map((t) => ({ ...t, diff: t.points_for - t.points_against }));
  enriched.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.diff !== b.diff) return b.diff - a.diff;
    return b.points_for - a.points_for;
  });
  return enriched.map((t, i) => ({ ...t, rank: i + 1 }));
}

function hasPlayed(matches, teamAId, teamBId) {
  return matches.some((m) => (m.team_a_id === teamAId && m.team_b_id === teamBId) || (m.team_a_id === teamBId && m.team_b_id === teamAId));
}

function isTeamLive(liveMatches, teamId) {
  return liveMatches.some((m) => m.team_a_id === teamId || m.team_b_id === teamId);
}

export default function BracketsPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const confirm = useConfirm();

  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [umpires, setUmpires] = useState([]);
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [brackets, setBrackets] = useState([]);
  const [activeBracketIdx, setActiveBracketIdx] = useState(0);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [bracketProgress, setBracketProgress] = useState([]);
  const [randomizerOpen, setRandomizerOpen] = useState(false);
  const [loadingBrackets, setLoadingBrackets] = useState(false);

  const [panelMode, setPanelMode] = useState('start');
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [scoreA, setScoreA] = useState('11');
  const [scoreB, setScoreB] = useState('7');
  const [court, setCourt] = useState('');
  const [umpireName, setUmpireName] = useState('');

  const now = useNow(1000);

  useEffect(() => {
    Promise.all([getEventById(eventId), listCategories(eventId), listUmpires(eventId)])
      .then(([ev, cats, ump]) => {
        setEvent(ev);
        setCategories(cats);
        setUmpires(ump);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast]);

  const loadLiveMatches = useCallback(async () => {
    try {
      const live = await listLiveMatchesForEvent(eventId);
      setLiveMatches(live);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    loadLiveMatches();
  }, [loadLiveMatches]);

  const activeCategory = categories[activeCatIdx];

  const loadBrackets = useCallback(async () => {
    if (!activeCategory) return;
    setLoadingBrackets(true);
    try {
      const [bkts, regs] = await Promise.all([listBracketsForCategory(activeCategory.id), listRegistrations(eventId)]);
      setBrackets(bkts);
      setRegistrations(regs.filter((r) => r.category_id === activeCategory.id && r.status === 'approved'));
      setActiveBracketIdx(0);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setLoadingBrackets(false);
    }
  }, [activeCategory, eventId, pushToast]);

  useEffect(() => {
    loadBrackets();
  }, [loadBrackets]);

  const loadBracketProgress = useCallback(async () => {
    if (!activeCategory) {
      setBracketProgress([]);
      return;
    }
    try {
      const progress = await getBracketProgressForCategory(activeCategory.id);
      setBracketProgress(progress);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [activeCategory, pushToast]);

  useEffect(() => {
    loadBracketProgress();
  }, [loadBracketProgress]);

  const activeBracket = brackets[activeBracketIdx];

  const loadBracketDetail = useCallback(async () => {
    if (!activeBracket) {
      setTeams([]);
      setMatches([]);
      return;
    }
    try {
      const [t, m] = await Promise.all([listTeamsForBracket(activeBracket.id), listMatchesForBracket(activeBracket.id)]);
      setTeams(t);
      setMatches(m);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [activeBracket, pushToast]);

  useEffect(() => {
    loadBracketDetail();
  }, [loadBracketDetail]);

  useEffect(() => {
    setTeamAId('');
    setTeamBId('');
  }, [activeBracket]);

  const rankedTeams = useMemo(() => rankTeams(teams), [teams]);

  // A match can only go live if a court is free — capped by the event's
  // configured court count (Settings page), minus courts already in use.
  const numCourts = event?.num_courts ?? 4;
  const availableCourts = useMemo(() => {
    const occupied = new Set(liveMatches.map((m) => m.court).filter(Boolean));
    return Array.from({ length: numCourts }, (_, i) => i + 1).filter((c) => !occupied.has(c));
  }, [numCourts, liveMatches]);

  // An umpire already officiating a live match can't be double-booked onto another.
  const availableUmpires = useMemo(() => {
    const occupied = new Set(liveMatches.map((m) => m.umpire_name).filter(Boolean));
    return umpires.filter((u) => !occupied.has(u.name));
  }, [umpires, liveMatches]);

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

  const handleGenerate = async (grouping) => {
    try {
      if (brackets.length > 0) {
        await deleteBracketsForCategory(activeCategory.id);
      }
      await generateBrackets(activeCategory.id, grouping);
      pushToast('Brackets drawn', 'success');
      setRandomizerOpen(false);
      await Promise.all([loadBrackets(), loadLiveMatches(), loadBracketProgress()]);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleStartMatch = async () => {
    if (!teamAId || !teamBId || teamAId === teamBId) {
      pushToast('Select two different teams', 'error');
      return;
    }
    if (!court) {
      pushToast('Select a court', 'error');
      return;
    }
    if (!umpireName) {
      pushToast('Select an umpire', 'error');
      return;
    }
    if (isTeamLive(liveMatches, teamAId) || isTeamLive(liveMatches, teamBId)) {
      pushToast('One of these teams already has a match in progress', 'error');
      return;
    }
    if (hasPlayed(matches, teamAId, teamBId)) {
      pushToast('These teams already played each other', 'error');
      return;
    }
    try {
      await startMatch({
        bracket_id: activeBracket.id,
        team_a_id: teamAId,
        team_b_id: teamBId,
        court: court ? parseInt(court, 10) : null,
        umpire_name: umpireName || null,
      });
      pushToast('Match started', 'success');
      setTeamAId('');
      setTeamBId('');
      await Promise.all([loadBracketDetail(), loadLiveMatches()]);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleTogglePause = async (match) => {
    try {
      if (match.running_since) {
        await pauseMatch(match.id, liveElapsedSeconds(match, Date.now()));
      } else {
        await resumeMatch(match.id);
      }
      await loadLiveMatches();
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleCancelMatch = async (match) => {
    // A match with a match_code came from a generated match list — cancel
    // resets it to scheduled so its fixture/code isn't lost. An ad-hoc
    // match (no code) has no schedule slot to preserve, so it's deleted.
    const isFromMatchList = !!match.match_code;
    const ok = await confirm({
      title: 'Cancel this match?',
      message: isFromMatchList
        ? 'This match will be reset back to scheduled with no score recorded.'
        : 'The live match will be removed with no score recorded.',
      confirmLabel: 'Cancel match',
    });
    if (!ok) return;
    try {
      if (isFromMatchList) {
        await cancelLiveMatch(match.id);
      } else {
        await deleteMatch(match.id);
      }
      pushToast('Match canceled', 'success');
      await loadLiveMatches();
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleFinishMatch = async (match, sA, sB) => {
    const elapsedSeconds = liveElapsedSeconds(match, Date.now());
    await finishMatch(match.id, {
      score_a: sA,
      score_b: sB,
      winner_team_id: sA > sB ? match.team_a_id : match.team_b_id,
      duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
    });
    pushToast('Match recorded', 'success');
    await Promise.all([loadBracketDetail(), loadLiveMatches(), loadBracketProgress()]);
  };

  const handleRedrawClick = async () => {
    const ok = await confirm({
      title: `Redraw ${activeCategory?.name}?`,
      message: 'This category has already been drawn. Redrawing will erase the current brackets, teams and any recorded match results, then draw fresh brackets.',
      confirmLabel: 'Redraw',
    });
    if (!ok) return;
    setRandomizerOpen(true);
  };

  const handleRecordMatch = async () => {
    if (!teamAId || !teamBId || teamAId === teamBId) {
      pushToast('Select two different teams', 'error');
      return;
    }
    const sA = parseInt(scoreA, 10);
    const sB = parseInt(scoreB, 10);
    if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) {
      pushToast('Enter valid, non-negative scores', 'error');
      return;
    }
    if (sA === sB) {
      pushToast('Ties are not allowed', 'error');
      return;
    }
    if (hasPlayed(matches, teamAId, teamBId)) {
      pushToast('These teams already played each other', 'error');
      return;
    }
    try {
      await recordMatch({
        bracket_id: activeBracket.id,
        team_a_id: teamAId,
        team_b_id: teamBId,
        score_a: sA,
        score_b: sB,
        winner_team_id: sA > sB ? teamAId : teamBId,
        court: court ? parseInt(court, 10) : null,
        umpire_name: umpireName || null,
      });
      pushToast('Match recorded', 'success');
      setTeamAId('');
      setTeamBId('');
      setScoreA('11');
      setScoreB('7');
      await Promise.all([loadBracketDetail(), loadBracketProgress()]);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Brackets</h1>
        <p className="text-sm text-ink-500">Draw brackets from approved players and record match results</p>
      </div>

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-12 text-center text-sm text-ink-400">
          Add categories in Edit event before drawing brackets.
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

          {liveMatches.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {liveMatches.map((m) => (
                <LiveMatchCard
                  key={m.id}
                  match={m}
                  now={now}
                  categoryName={m.category_name}
                  bracketLetter={m.bracket_letter}
                  onTogglePause={handleTogglePause}
                  onCancel={handleCancelMatch}
                  onFinish={handleFinishMatch}
                />
              ))}
            </div>
          )}

          {loadingBrackets ? (
            <div className="py-10 text-center text-sm text-ink-400">Loading…</div>
          ) : brackets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
              <Shuffle size={22} className="mx-auto mb-2 text-ink-300" />
              <p className="text-sm font-semibold text-ink-700">No brackets drawn yet for {activeCategory?.name}</p>
              <p className="mt-1 text-xs text-ink-400">{registrations.length} approved {registrations.length === 1 ? 'team' : 'teams'} ready.</p>
              <button
                onClick={() => setRandomizerOpen(true)}
                disabled={registrations.length === 0}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              >
                <Shuffle size={14} /> Run the randomizer
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {brackets.map((b, i) => (
                    <button
                      key={b.id}
                      onClick={() => setActiveBracketIdx(i)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                        i === activeBracketIdx ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                      }`}
                    >
                      Bracket {b.letter}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleRedrawClick}
                  className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-bold text-ink-600 transition hover:bg-ink-100"
                >
                  <Shuffle size={12} /> Redraw
                </button>
              </div>

              {bracketProgress.length > 0 && (
                <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
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
                        Bracket {b.letter}: {b.completedCount}/{b.totalMatches} · {b.remaining} left
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b-2 border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                        <th className="px-3 py-2.5 text-center">Rank</th>
                        <th className="px-3 py-2.5 text-left">Team</th>
                        <th className="px-3 py-2.5 text-left">Club</th>
                        <th className="px-3 py-2.5 text-center">W</th>
                        <th className="px-3 py-2.5 text-center">L</th>
                        <th className="px-3 py-2.5 text-center">RF</th>
                        <th className="px-3 py-2.5 text-center">RA</th>
                        <th className="px-3 py-2.5 text-center">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedTeams.map((t) => (
                        <tr key={t.id} className={`border-b border-ink-50 ${t.rank === 1 ? 'bg-amber-50/70' : ''}`}>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-extrabold ${t.rank === 1 ? 'bg-amber-400 text-amber-950' : 'bg-ink-100 text-ink-600'}`}>
                              {t.rank === 1 && <Crown size={11} />}
                              {t.rank}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-ink-800">{teamLabel(t)}</td>
                          <td className="px-3 py-2.5 text-ink-500">{t.club_name || '—'}</td>
                          <td className="px-3 py-2.5 text-center font-mono">{t.wins}</td>
                          <td className="px-3 py-2.5 text-center font-mono">{t.losses}</td>
                          <td className="px-3 py-2.5 text-center font-mono">{t.points_for}</td>
                          <td className="px-3 py-2.5 text-center font-mono">{t.points_against}</td>
                          <td className={`px-3 py-2.5 text-center font-mono font-bold ${t.diff >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>
                            {t.diff >= 0 ? `+${t.diff}` : t.diff}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-ink-100 bg-ink-50/60 p-4">
                  <div className="mb-3 inline-flex rounded-full bg-white p-1 ring-1 ring-ink-200">
                    <button
                      onClick={() => setPanelMode('start')}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                        panelMode === 'start' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-800'
                      }`}
                    >
                      <Play size={12} /> Start match
                    </button>
                    <button
                      onClick={() => setPanelMode('log')}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                        panelMode === 'log' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-800'
                      }`}
                    >
                      <Trophy size={12} /> Log score directly
                    </button>
                  </div>

                  {panelMode === 'start' ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                        <div className="col-span-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Team A</label>
                          <select value={teamAId} onChange={(e) => setTeamAId(e.target.value)} className={inputClass}>
                            <option value="" disabled>
                              Select team
                            </option>
                            {teams.map((t) => (
                              <option
                                key={t.id}
                                value={t.id}
                                disabled={t.id === teamBId || hasPlayed(matches, t.id, teamBId) || isTeamLive(liveMatches, t.id)}
                              >
                                {teamLabel(t)}
                                {isTeamLive(liveMatches, t.id) ? ' (playing)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Team B</label>
                          <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)} className={inputClass}>
                            <option value="" disabled>
                              Select team
                            </option>
                            {teams.map((t) => (
                              <option
                                key={t.id}
                                value={t.id}
                                disabled={t.id === teamAId || hasPlayed(matches, t.id, teamAId) || isTeamLive(liveMatches, t.id)}
                              >
                                {teamLabel(t)}
                                {isTeamLive(liveMatches, t.id) ? ' (playing)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Court</label>
                          <select value={court} onChange={(e) => setCourt(e.target.value)} className={inputClass}>
                            <option value="" disabled>
                              {availableCourts.length === 0 ? 'No courts free' : 'Select court'}
                            </option>
                            {availableCourts.map((c) => (
                              <option key={c} value={c}>
                                Court {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Umpire</label>
                          <select value={umpireName} onChange={(e) => setUmpireName(e.target.value)} className={inputClass}>
                            <option value="" disabled>
                              {availableUmpires.length === 0 ? 'No umpires available' : 'Select umpire'}
                            </option>
                            {availableUmpires.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={handleStartMatch}
                        disabled={availableCourts.length === 0 || availableUmpires.length === 0}
                        title={
                          availableCourts.length === 0
                            ? 'All courts are in use'
                            : availableUmpires.length === 0
                              ? 'No umpires available'
                              : undefined
                        }
                        className="mt-3 flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Play size={13} /> Start match
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                        <div className="col-span-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Team A</label>
                          <select value={teamAId} onChange={(e) => setTeamAId(e.target.value)} className={inputClass}>
                            <option value="" disabled>
                              Select team
                            </option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id} disabled={t.id === teamBId || hasPlayed(matches, t.id, teamBId)}>
                                {teamLabel(t)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Team B</label>
                          <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)} className={inputClass}>
                            <option value="" disabled>
                              Select team
                            </option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id} disabled={t.id === teamAId || hasPlayed(matches, t.id, teamAId)}>
                                {teamLabel(t)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Score A</label>
                          <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className={`${inputClass} text-center`} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Score B</label>
                          <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className={`${inputClass} text-center`} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Court</label>
                          <input type="number" min={1} value={court} onChange={(e) => setCourt(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Umpire</label>
                          <select value={umpireName} onChange={(e) => setUmpireName(e.target.value)} className={inputClass}>
                            <option value="">None</option>
                            {umpires.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={handleRecordMatch}
                        className="mt-3 flex items-center gap-1.5 rounded-xl bg-ink-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-ink-800"
                      >
                        <Trophy size={13} /> Record match
                      </button>
                    </>
                  )}
                </div>
              </div>

              {matches.length > 0 && (
                <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-800">
                    <Radio size={14} className="text-ink-400" /> Recent matches
                  </div>
                  <div className="flex flex-col gap-2">
                    {matches.slice(0, 8).map((m) => {
                      const teamA = teams.find((t) => t.id === m.team_a_id);
                      const teamB = teams.find((t) => t.id === m.team_b_id);
                      return (
                        <div key={m.id} className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                          <span className="font-semibold text-ink-800">{teamA ? teamLabel(teamA) : '—'}</span> vs{' '}
                          <span className="font-semibold text-ink-800">{teamB ? teamLabel(teamB) : '—'}</span> — {m.score_a}–{m.score_b}
                          {m.court ? ` · Court ${m.court}` : ''}
                          {m.umpire_name ? ` · ${m.umpire_name}` : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {randomizerOpen && activeCategory && (
        <RandomizerModal
          category={activeCategory}
          registrations={registrations}
          hasExistingBrackets={brackets.length > 0}
          onConfirm={handleGenerate}
          onClose={() => setRandomizerOpen(false)}
        />
      )}
    </EventWorkspaceLayout>
  );
}
