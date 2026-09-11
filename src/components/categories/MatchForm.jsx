import { useMemo, useState } from 'react';
import { ClipboardEdit, Play } from 'lucide-react';
import { useTournamentDispatch, useTournamentState } from '../../context/TournamentContext';
import { getAvailableCourtNumbers, getAvailableUmpires, getLiveTeamIds, hasMatchBetween } from '../../utils/stats';
import Select from '../ui/Select';

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{label}</label>
      {children}
    </div>
  );
}

function TeamSelect({ value, onChange, teams, history, excludeId, liveIds, placeholder }) {
  return (
    <Select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
      className="w-full rounded-xl border border-ink-200 bg-white px-2.5 py-2 text-xs font-medium text-ink-700 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {teams.map((t) => {
        if (t.id === excludeId) return null;
        const alreadyPlayed = excludeId != null && hasMatchBetween(history, excludeId, t.id);
        const isLive = liveIds.has(t.id);
        const disabled = alreadyPlayed || isLive;
        return (
          <option key={t.id} value={t.id} disabled={disabled}>
            {t.player1} & {t.player2}
            {alreadyPlayed ? ' (already played)' : isLive ? ' (on court now)' : ''}
          </option>
        );
      })}
    </Select>
  );
}

export default function MatchForm({ bracket, catIdx, bracketIdx }) {
  const { tournamentSettings, umpires, liveMatches } = useTournamentState();
  const dispatch = useTournamentDispatch();

  const [mode, setMode] = useState('start'); // 'start' | 'log'
  const [teamAId, setTeamAId] = useState(null);
  const [teamBId, setTeamBId] = useState(null);
  const [scoreA, setScoreA] = useState('11');
  const [scoreB, setScoreB] = useState('7');
  const [court, setCourt] = useState('');
  const [umpireId, setUmpireId] = useState('');

  const liveIds = useMemo(() => getLiveTeamIds(liveMatches, catIdx, bracketIdx), [liveMatches, catIdx, bracketIdx]);
  const availableCourts = useMemo(() => getAvailableCourtNumbers(liveMatches, tournamentSettings.numCourts), [liveMatches, tournamentSettings.numCourts]);
  const availableUmpires = useMemo(() => getAvailableUmpires(umpires, liveMatches), [umpires, liveMatches]);
  const canStart = availableCourts.length > 0 && availableUmpires.length > 0;

  const recordMatch = () => {
    dispatch({
      type: 'RECORD_MATCH',
      catIdx,
      bracketIdx,
      teamAId,
      teamBId,
      scoreA: parseInt(scoreA, 10),
      scoreB: parseInt(scoreB, 10),
    });
    setTeamAId(null);
    setTeamBId(null);
  };

  const startMatch = () => {
    dispatch({
      type: 'START_MATCH',
      catIdx,
      bracketIdx,
      teamAId,
      teamBId,
      court: court === '' ? null : parseInt(court, 10),
      umpireId: umpireId === '' ? null : parseInt(umpireId, 10),
    });
    setTeamAId(null);
    setTeamBId(null);
    setCourt('');
    setUmpireId('');
  };

  return (
    <div className="border-t border-ink-100 bg-ink-50/60 p-4">
      <div className="mb-3 inline-flex rounded-full bg-ink-100 p-1">
        <button
          onClick={() => setMode('start')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
            mode === 'start' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          <Play size={12} /> Start live match
        </button>
        <button
          onClick={() => setMode('log')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
            mode === 'log' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          <ClipboardEdit size={12} /> Log completed match
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Team A">
          <TeamSelect value={teamAId} onChange={setTeamAId} teams={bracket.teams} history={bracket.matchHistory} excludeId={teamBId} liveIds={liveIds} placeholder="Select team" />
        </Field>
        <Field label="Team B">
          <TeamSelect value={teamBId} onChange={setTeamBId} teams={bracket.teams} history={bracket.matchHistory} excludeId={teamAId} liveIds={liveIds} placeholder="Select team" />
        </Field>

        {mode === 'start' ? (
          <>
            <Field label="Court">
              <Select
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                disabled={availableCourts.length === 0}
                className="w-full rounded-xl border border-ink-200 px-2.5 py-2 text-xs font-medium disabled:bg-ink-100 disabled:text-ink-400"
              >
                <option value="" disabled>
                  {availableCourts.length === 0 ? 'No courts free' : 'Select court'}
                </option>
                {availableCourts.map((c) => (
                  <option key={c} value={c}>
                    Court {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Umpire">
              <Select
                value={umpireId}
                onChange={(e) => setUmpireId(e.target.value)}
                disabled={availableUmpires.length === 0}
                className="w-full rounded-xl border border-ink-200 px-2.5 py-2 text-xs font-medium disabled:bg-ink-100 disabled:text-ink-400"
              >
                <option value="" disabled>
                  {umpires.length === 0 ? 'No umpires added' : availableUmpires.length === 0 ? 'All umpires busy' : 'Select umpire'}
                </option>
                {availableUmpires.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Score A">
              <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className="w-full rounded-xl border border-ink-200 px-2.5 py-2 text-center text-xs font-semibold" />
            </Field>
            <Field label="Score B">
              <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className="w-full rounded-xl border border-ink-200 px-2.5 py-2 text-center text-xs font-semibold" />
            </Field>
          </>
        )}
      </div>

      <div className="mt-3">
        {mode === 'start' ? (
          <button
            onClick={startMatch}
            disabled={!canStart}
            title={!canStart ? (availableCourts.length === 0 ? 'All courts are busy' : 'No umpire available') : ''}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 sm:w-auto sm:px-6"
          >
            <Play size={13} /> Start match on court
          </button>
        ) : (
          <button
            onClick={recordMatch}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink-800 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-ink-900 sm:w-auto sm:px-6"
          >
            <ClipboardEdit size={13} /> Log this score
          </button>
        )}
      </div>
      {mode === 'log' && (
        <p className="mt-2 text-[11px] text-ink-400">Use this for matches played off the court tracker — it records the result immediately with no live timer.</p>
      )}
    </div>
  );
}
