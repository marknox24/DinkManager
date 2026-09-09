import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildInitialCategories, rawBrackets } from '../data/seedData';
import { hasMatchBetween, isTeamPlayingLive, isUmpireBusy, recalcStatsFromHistory } from '../utils/stats';
import { useToast } from './ToastContext';

const STORAGE_KEY = 'dinkmanager:tournament:v1';

function buildInitialState() {
  return {
    tournamentName: 'Summer Pickleball Championship',
    categoriesData: buildInitialCategories(),
    activeCategoryIdx: 0,
    tournamentSettings: { numCourts: 4, matchDurationMinutes: 18 },
    liveMatches: [],
    liveMatchIdSeq: 1,
    umpires: [],
    umpireIdSeq: 1,
  };
}

// Total elapsed ms for a live match, accounting for any paused time.
export function liveMatchElapsedMs(lm, now = Date.now()) {
  const running = lm.isPaused ? 0 : now - lm.startTime;
  return (lm.accumulatedMs || 0) + running;
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !saved.categoriesData) return null;
    const base = buildInitialState();
    return {
      ...base,
      ...saved,
      tournamentSettings: { ...base.tournamentSettings, ...(saved.tournamentSettings || {}) },
    };
  } catch (e) {
    console.error('Failed to load saved tournament', e);
    return null;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return action.state;

    case 'RESET_ALL':
      return { ...buildInitialState(), tournamentName: state.tournamentName };

    case 'SET_TOURNAMENT_NAME':
      return { ...state, tournamentName: action.name };

    case 'SET_ACTIVE_CATEGORY':
      return { ...state, activeCategoryIdx: action.catIdx };

    case 'EDIT_TEAM_NAME': {
      const { catIdx, bracketIdx, teamId, field, value } = action;
      const categoriesData = state.categoriesData.map((cat, ci) => {
        if (ci !== catIdx) return cat;
        return {
          ...cat,
          brackets: cat.brackets.map((br, bi) => {
            if (bi !== bracketIdx) return br;
            return { ...br, teams: br.teams.map((t) => (t.id === teamId ? { ...t, [field]: value } : t)) };
          }),
        };
      });
      return { ...state, categoriesData };
    }

    case 'RECORD_MATCH': {
      const { catIdx, bracketIdx, teamAId, teamBId, scoreA, scoreB } = action;
      const categoriesData = state.categoriesData.map((cat, ci) => {
        if (ci !== catIdx) return cat;
        return {
          ...cat,
          brackets: cat.brackets.map((br, bi) => {
            if (bi !== bracketIdx) return br;
            const teamA = br.teams.find((t) => t.id === teamAId);
            const teamB = br.teams.find((t) => t.id === teamBId);
            const teams = br.teams.map((t) => {
              if (t.id === teamAId) return { ...t, pointsFor: t.pointsFor + scoreA, pointsAgainst: t.pointsAgainst + scoreB, wins: t.wins + (scoreA > scoreB ? 1 : 0), losses: t.losses + (scoreA > scoreB ? 0 : 1) };
              if (t.id === teamBId) return { ...t, pointsFor: t.pointsFor + scoreB, pointsAgainst: t.pointsAgainst + scoreA, wins: t.wins + (scoreB > scoreA ? 1 : 0), losses: t.losses + (scoreB > scoreA ? 0 : 1) };
              return t;
            });
            const winnerStr = scoreA > scoreB ? `${teamA.player1} & ${teamA.player2}` : `${teamB.player1} & ${teamB.player2}`;
            const matchHistory = [
              {
                teamAId,
                teamBId,
                teamA: `${teamA.player1} & ${teamA.player2}`,
                teamB: `${teamB.player1} & ${teamB.player2}`,
                scoreA,
                scoreB,
                winner: winnerStr,
                timestamp: new Date().toLocaleString(),
              },
              ...br.matchHistory,
            ];
            return { ...br, teams, matchHistory };
          }),
        };
      });
      return { ...state, categoriesData };
    }

    case 'RESET_BRACKET': {
      const { catIdx, bracketIdx } = action;
      const category = state.categoriesData[catIdx];
      const bracket = category.brackets[bracketIdx];
      const freshPairs = rawBrackets[category.name][bracket.letter];
      const categoriesData = state.categoriesData.map((cat, ci) => {
        if (ci !== catIdx) return cat;
        return {
          ...cat,
          brackets: cat.brackets.map((br, bi) => {
            if (bi !== bracketIdx) return br;
            return {
              ...br,
              teams: freshPairs.map((pair, idx) => ({ id: idx, player1: pair[0].trim(), player2: pair[1].trim(), wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 })),
              matchHistory: [],
            };
          }),
        };
      });
      const liveMatches = state.liveMatches.filter((m) => !(m.catIdx === catIdx && m.bracketIdx === bracketIdx));
      return { ...state, categoriesData, liveMatches };
    }

    case 'START_MATCH': {
      const { catIdx, bracketIdx, teamAId, teamBId, court, umpireId } = action;
      const category = state.categoriesData[catIdx];
      const bracket = category.brackets[bracketIdx];
      const teamA = bracket.teams.find((t) => t.id === teamAId);
      const teamB = bracket.teams.find((t) => t.id === teamBId);
      const umpire = state.umpires.find((u) => u.id === umpireId);
      const liveMatches = [
        ...state.liveMatches,
        {
          id: state.liveMatchIdSeq,
          catIdx,
          bracketIdx,
          categoryName: category.name,
          bracketLetter: bracket.letter,
          teamAIdx: teamAId,
          teamBIdx: teamBId,
          teamALabel: `${teamA.player1} & ${teamA.player2}`,
          teamBLabel: `${teamB.player1} & ${teamB.player2}`,
          court,
          umpireId: umpire.id,
          umpireName: umpire.name,
          startTime: Date.now(),
          accumulatedMs: 0,
          isPaused: false,
        },
      ];
      return { ...state, liveMatches, liveMatchIdSeq: state.liveMatchIdSeq + 1 };
    }

    case 'PAUSE_MATCH': {
      const liveMatches = state.liveMatches.map((m) => {
        if (m.id !== action.liveId || m.isPaused) return m;
        return { ...m, isPaused: true, accumulatedMs: liveMatchElapsedMs(m) };
      });
      return { ...state, liveMatches };
    }

    case 'RESUME_MATCH': {
      const liveMatches = state.liveMatches.map((m) => {
        if (m.id !== action.liveId || !m.isPaused) return m;
        return { ...m, isPaused: false, startTime: Date.now() };
      });
      return { ...state, liveMatches };
    }

    case 'CANCEL_MATCH': {
      const liveMatches = state.liveMatches.filter((m) => m.id !== action.liveId);
      return { ...state, liveMatches };
    }

    case 'FINISH_MATCH': {
      const { liveId, scoreA, scoreB } = action;
      const lm = state.liveMatches.find((m) => m.id === liveId);
      if (!lm) return state;
      const durationMinutes = Math.max(1, Math.round(liveMatchElapsedMs(lm) / 60000));
      const winnerStr = scoreA > scoreB ? lm.teamALabel : lm.teamBLabel;
      const categoriesData = state.categoriesData.map((cat, ci) => {
        if (ci !== lm.catIdx) return cat;
        return {
          ...cat,
          brackets: cat.brackets.map((br, bi) => {
            if (bi !== lm.bracketIdx) return br;
            const teams = br.teams.map((t) => {
              if (t.id === lm.teamAIdx) return { ...t, pointsFor: t.pointsFor + scoreA, pointsAgainst: t.pointsAgainst + scoreB, wins: t.wins + (scoreA > scoreB ? 1 : 0), losses: t.losses + (scoreA > scoreB ? 0 : 1) };
              if (t.id === lm.teamBIdx) return { ...t, pointsFor: t.pointsFor + scoreB, pointsAgainst: t.pointsAgainst + scoreA, wins: t.wins + (scoreB > scoreA ? 1 : 0), losses: t.losses + (scoreB > scoreA ? 0 : 1) };
              return t;
            });
            const matchHistory = [
              {
                teamAId: lm.teamAIdx,
                teamBId: lm.teamBIdx,
                teamA: lm.teamALabel,
                teamB: lm.teamBLabel,
                scoreA,
                scoreB,
                winner: winnerStr,
                timestamp: new Date().toLocaleString(),
                court: lm.court,
                umpire: lm.umpireName || null,
                durationMinutes,
              },
              ...br.matchHistory,
            ];
            return { ...br, teams, matchHistory };
          }),
        };
      });
      const liveMatches = state.liveMatches.filter((m) => m.id !== liveId);
      return { ...state, categoriesData, liveMatches };
    }

    case 'REASSIGN_UMPIRE': {
      const { liveId, umpireId } = action;
      const umpire = state.umpires.find((u) => u.id === umpireId);
      if (!umpire) return state;
      const liveMatches = state.liveMatches.map((m) => (m.id === liveId ? { ...m, umpireId: umpire.id, umpireName: umpire.name } : m));
      return { ...state, liveMatches };
    }

    case 'EDIT_HISTORY_MATCH': {
      const { catIdx, bracketIdx, matchIdx, scoreA, scoreB } = action;
      const categoriesData = state.categoriesData.map((cat, ci) => {
        if (ci !== catIdx) return cat;
        return {
          ...cat,
          brackets: cat.brackets.map((br, bi) => {
            if (bi !== bracketIdx) return br;
            const matchHistory = br.matchHistory.map((m, mi) => {
              if (mi !== matchIdx) return m;
              return { ...m, scoreA, scoreB, winner: scoreA > scoreB ? m.teamA : m.teamB };
            });
            const teams = br.teams.map((t) => ({ ...t }));
            recalcStatsFromHistory(teams, matchHistory);
            return { ...br, teams, matchHistory };
          }),
        };
      });
      return { ...state, categoriesData };
    }

    case 'DELETE_HISTORY_MATCH': {
      const { catIdx, bracketIdx, matchIdx } = action;
      const categoriesData = state.categoriesData.map((cat, ci) => {
        if (ci !== catIdx) return cat;
        return {
          ...cat,
          brackets: cat.brackets.map((br, bi) => {
            if (bi !== bracketIdx) return br;
            const matchHistory = br.matchHistory.filter((_, mi) => mi !== matchIdx);
            const teams = br.teams.map((t) => ({ ...t }));
            recalcStatsFromHistory(teams, matchHistory);
            return { ...br, teams, matchHistory };
          }),
        };
      });
      return { ...state, categoriesData };
    }

    case 'ADD_UMPIRE': {
      const name = action.name.trim();
      const umpires = [...state.umpires, { id: state.umpireIdSeq, name }];
      return { ...state, umpires, umpireIdSeq: state.umpireIdSeq + 1 };
    }

    case 'REMOVE_UMPIRE': {
      const umpires = state.umpires.filter((u) => u.id !== action.id);
      return { ...state, umpires };
    }

    case 'UPDATE_SETTINGS': {
      return { ...state, tournamentSettings: { numCourts: action.numCourts, matchDurationMinutes: action.matchDurationMinutes } };
    }

    default:
      return state;
  }
}

const TournamentStateContext = createContext(null);
const TournamentDispatchContext = createContext(null);

export function useTournamentState() {
  const ctx = useContext(TournamentStateContext);
  if (!ctx) throw new Error('useTournamentState must be used within TournamentProvider');
  return ctx;
}

export function useTournamentDispatch() {
  const ctx = useContext(TournamentDispatchContext);
  if (!ctx) throw new Error('useTournamentDispatch must be used within TournamentProvider');
  return ctx;
}

export function TournamentProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => loadPersistedState() || buildInitialState());
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const { pushToast } = useToast();
  const saveTimeoutRef = useRef(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSaveStatus('saved');
      } catch (e) {
        console.error('Save failed', e);
        setSaveStatus('error');
      }
    }, 250);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [state]);

  const guardedDispatch = useMemo(() => {
    return (action, opts = {}) => {
      const { catIdx, bracketIdx } = action;

      if (action.type === 'START_MATCH') {
        const { teamAId, teamBId, court, umpireId } = action;
        const bracket = state.categoriesData[catIdx].brackets[bracketIdx];
        if (teamAId == null || teamBId == null) return pushToast('Select both teams', 'error');
        if (teamAId === teamBId) return pushToast('Team A and Team B must be different', 'error');
        if (hasMatchBetween(bracket.matchHistory, teamAId, teamBId)) return pushToast('These teams already played each other', 'error');
        if (isTeamPlayingLive(state.liveMatches, catIdx, bracketIdx, teamAId) || isTeamPlayingLive(state.liveMatches, catIdx, bracketIdx, teamBId)) {
          return pushToast('A selected team is already on a court', 'error');
        }
        if (court == null) return pushToast('Select a court', 'error');
        if (state.liveMatches.some((m) => m.court === court)) return pushToast(`Court ${court} was just taken – pick another`, 'error');
        if (umpireId == null) return pushToast('Select an umpire before starting', 'error');
        if (isUmpireBusy(state.liveMatches, umpireId)) return pushToast('That umpire is already officiating another match', 'error');
        dispatch(action);
        pushToast(`Match started on Court ${court}`, 'success');
        return;
      }

      if (action.type === 'RECORD_MATCH') {
        const { teamAId, teamBId, scoreA, scoreB } = action;
        const bracket = state.categoriesData[catIdx].brackets[bracketIdx];
        if (teamAId == null || teamBId == null) return pushToast('Select both teams', 'error');
        if (teamAId === teamBId) return pushToast('Team A and Team B must be different', 'error');
        if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA < 0 || scoreB < 0) return pushToast('Enter valid, non-negative scores', 'error');
        if (scoreA === scoreB) return pushToast('Ties are not allowed', 'error');
        if (hasMatchBetween(bracket.matchHistory, teamAId, teamBId)) return pushToast('These teams already played each other', 'error');
        dispatch(action);
        pushToast('Match recorded', 'success');
        return;
      }

      if (action.type === 'FINISH_MATCH') {
        const { scoreA, scoreB } = action;
        if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA < 0 || scoreB < 0) return pushToast('Enter valid, non-negative scores', 'error');
        if (scoreA === scoreB) return pushToast('Ties are not allowed', 'error');
        const lm = state.liveMatches.find((m) => m.id === action.liveId);
        dispatch(action);
        if (lm) pushToast(`Match finished on Court ${lm.court}`, 'success');
        return;
      }

      if (action.type === 'CANCEL_MATCH') {
        const lm = state.liveMatches.find((m) => m.id === action.liveId);
        dispatch(action);
        if (lm) pushToast(`Match on Court ${lm.court} canceled`, 'success');
        return;
      }

      if (action.type === 'PAUSE_MATCH' || action.type === 'RESUME_MATCH') {
        dispatch(action);
        pushToast(action.type === 'PAUSE_MATCH' ? 'Match paused' : 'Match resumed', 'success');
        return;
      }

      if (action.type === 'ADD_UMPIRE') {
        const trimmed = action.name.trim();
        if (!trimmed) return pushToast('Enter an umpire name', 'error');
        if (state.umpires.some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) return pushToast('That umpire is already on the list', 'error');
        dispatch(action);
        pushToast(`${trimmed} added as umpire`, 'success');
        return;
      }

      if (action.type === 'REMOVE_UMPIRE') {
        if (isUmpireBusy(state.liveMatches, action.id)) return pushToast("Can't remove an umpire currently officiating a match", 'error');
        const u = state.umpires.find((x) => x.id === action.id);
        dispatch(action);
        pushToast(`${u ? u.name : 'Umpire'} removed`, 'success');
        return;
      }

      if (action.type === 'RESET_ALL') {
        dispatch(action);
        pushToast('All data reset to initial state', 'success');
        return;
      }

      if (action.type === 'RESET_BRACKET') {
        dispatch(action);
        pushToast('Bracket reset', 'success');
        return;
      }

      if (action.type === 'DELETE_HISTORY_MATCH') {
        dispatch(action);
        pushToast('Match deleted', 'success');
        return;
      }

      if (action.type === 'EDIT_HISTORY_MATCH') {
        const { scoreA, scoreB } = action;
        if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA < 0 || scoreB < 0) return pushToast('Scores must be non-negative numbers', 'error');
        if (scoreA === scoreB) return pushToast('Tie not allowed – scores must differ', 'error');
        dispatch(action);
        pushToast('Match updated', 'success');
        return;
      }

      dispatch(action);
      if (!opts.silent) pushToast(opts.message || 'Updated', 'success');
    };
  }, [state, pushToast]);

  const value = useMemo(() => ({ ...state, saveStatus }), [state, saveStatus]);

  return (
    <TournamentStateContext.Provider value={value}>
      <TournamentDispatchContext.Provider value={guardedDispatch}>{children}</TournamentDispatchContext.Provider>
    </TournamentStateContext.Provider>
  );
}
