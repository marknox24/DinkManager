import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { effectiveGames, expectedRoundRobin } from '../../utils/scheduling';

// Games per team for a Round Robin category (see "GAMES PER TEAM" in
// schema.sql): Full Round Robin by default, or a custom target so each team
// plays fewer games when time, courts or officials are short. "All
// brackets" sets the category default (and clears per-bracket overrides);
// each bracket can override it. Every row previews what the generator will
// produce — the same expectedRoundRobin numbers the Matchlist Preview uses.
//
// A bracket's stored value: null = same as all brackets, 0 = Full Round
// Robin, n = n games per team.
function outcome(teamCount, games) {
  const k = effectiveGames(teamCount, games);
  const exp = expectedRoundRobin(teamCount, false, games);
  if (k == null) return `Full: ${exp.total} ${exp.total === 1 ? 'match' : 'matches'} · ${exp.perTeam} games/team`;
  const range = exp.perTeamMax > exp.perTeam ? `${exp.perTeam}–${exp.perTeamMax}` : `${exp.perTeam}`;
  return `${exp.total} ${exp.total === 1 ? 'match' : 'matches'} · ${range} games/team`;
}

export default function GamesPerTeamPanel({ pools, categoryGames, canEdit, matchlistExists, onSave }) {
  const [mode, setMode] = useState(categoryGames ? 'custom' : 'full');
  const [value, setValue] = useState(categoryGames || 3);
  const [saving, setSaving] = useState(null);

  const largest = Math.max(...pools.map((b) => b.teams.length));
  const maxCustom = Math.max(1, largest - 2);
  const allTarget = mode === 'custom' ? Number(value) : null;
  const allChanged = (allTarget || null) !== (categoryGames || null) || pools.some((b) => b.games_per_team != null);

  const save = async (bracketId, games) => {
    setSaving(bracketId ?? 'all');
    try {
      await onSave(bracketId, games);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-4 border-t border-ink-100 pt-4">
      <div className="flex items-center gap-2">
        <Gauge size={14} className="text-ink-400" />
        <h3 className="text-sm font-bold text-ink-800">Games per team</h3>
      </div>
      <p className="mt-0.5 text-xs text-ink-500">
        Fewer games for a tight schedule. No team ever plays the same opponent twice.
        {matchlistExists && ' Changing this after the matchlist is generated marks it for regeneration.'}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-ink-50/60 px-3.5 py-2.5">
        <span className="text-xs font-bold text-ink-700">All brackets</span>
        <label className="flex items-center gap-1.5 text-xs text-ink-700">
          <input type="radio" checked={mode === 'full'} disabled={!canEdit} onChange={() => setMode('full')} /> Full Round Robin
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-700">
          <input type="radio" checked={mode === 'custom'} disabled={!canEdit} onChange={() => setMode('custom')} /> Custom
        </label>
        {mode === 'custom' && (
          <label className="flex items-center gap-1.5 text-xs text-ink-700">
            Target
            <input
              type="number"
              min={1}
              max={maxCustom}
              value={value}
              disabled={!canEdit}
              onChange={(e) => setValue(e.target.value)}
              className="w-16 rounded-lg border border-ink-200 px-2 py-1 text-sm tabular-nums focus:border-brand-500 focus:outline-none"
            />
            games/team
          </label>
        )}
        {canEdit && allChanged && (
          <button
            onClick={() => save(null, mode === 'custom' ? Math.max(1, Math.round(Number(value) || 1)) : null)}
            disabled={saving != null}
            className="ml-auto rounded-full bg-ink-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-ink-800 active:scale-[0.97] disabled:opacity-50"
          >
            {saving === 'all' ? 'Applying…' : 'Apply to all brackets'}
          </button>
        )}
      </div>

      <ul className="mt-2 flex flex-col divide-y divide-ink-50">
        {pools.map((b) => {
          const n = b.teams.length;
          const stored = b.games_per_team;
          const effective = stored ?? categoryGames;
          const selectValue = stored == null ? 'inherit' : stored === 0 ? 'full' : String(stored);
          return (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="text-xs text-ink-700">
                <strong className="font-bold text-ink-900">Bracket {b.letter}</strong> · {n} {n === 1 ? 'team' : 'teams'}
              </span>
              <span className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${effectiveGames(n, effective) != null ? 'text-brand-700' : 'text-ink-500'}`}>
                  → {outcome(n, effective)}
                </span>
                <select
                  value={selectValue}
                  disabled={!canEdit || saving != null || n < 3}
                  onChange={(e) => {
                    const v = e.target.value;
                    save(b.id, v === 'inherit' ? null : v === 'full' ? 0 : Number(v));
                  }}
                  className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700 focus:border-brand-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="inherit">Same as all brackets</option>
                  <option value="full">Full Round Robin ({Math.max(0, n - 1)} games)</option>
                  {Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 1).map((k) => (
                    <option key={k} value={String(k)}>
                      {k} {k === 1 ? 'game' : 'games'} per team
                    </option>
                  ))}
                </select>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
