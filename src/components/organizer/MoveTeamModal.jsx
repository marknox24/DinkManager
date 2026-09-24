import { useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Info } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { moveBracketTeams } from '../../data/bracketsApi';
import { teamLabel } from '../../utils/match';

// Moves one player (singles) or one whole pair (doubles — a team row always
// carries both partners, so they can't be split) to another pool bracket of
// the same category. Opened from a team's [Move] button, or by dropping a
// team onto another bracket (initialToId pre-selects that bracket). The
// server re-checks everything shown here (see move_bracket_teams).
//
// brackets: this category's pool brackets as [{ id, letter, teams: [...] }].
// matchlist: { exists, hasResults } for the category, to pick the warning.
export default function MoveTeamModal({ categoryId, team, fromBracket, brackets, capacity, checkSameClub, matchlist, initialToId, onMoved, onClose }) {
  const { pushToast } = useToast();
  const destinations = brackets.filter((b) => b.id !== fromBracket.id);
  const isFull = (b) => capacity != null && b.teams.length >= capacity;
  const [toId, setToId] = useState(() => {
    const initial = destinations.find((b) => b.id === initialToId && !isFull(b));
    return initial?.id ?? destinations.find((b) => !isFull(b))?.id ?? null;
  });
  const [saving, setSaving] = useState(false);

  const isPair = Boolean(team.player2_name);
  const noun = isPair ? 'Team' : 'Player';
  const target = destinations.find((b) => b.id === toId);
  const clubClash =
    checkSameClub && target && team.club_name
      ? target.teams.some((t) => (t.club_name || '').trim().toLowerCase() === team.club_name.trim().toLowerCase())
      : false;

  const handleMove = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await moveBracketTeams(categoryId, [{ team_id: team.id, to_bracket_id: target.id }]);
      pushToast(`${teamLabel(team)} moved to Bracket ${target.letter}`, 'success');
      onMoved();
    } catch (e) {
      pushToast(e.message, 'error');
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Move ${noun}`} icon={ArrowRightLeft}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-ink-50 px-4 py-3">
          <p className="text-sm font-bold text-ink-900">{teamLabel(team)}</p>
          <p className="text-xs text-ink-500">
            Current bracket: <strong className="text-ink-700">Bracket {fromBracket.letter}</strong>
            {isPair && ' · both partners move together'}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Move to</p>
          {destinations.length === 0 ? (
            <p className="text-sm text-ink-500">This category has no other bracket to move to.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {destinations.map((b) => {
                const full = isFull(b);
                const selected = b.id === toId;
                const slots = capacity != null ? capacity - b.teams.length : null;
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={full}
                    onClick={() => setToId(b.id)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                      selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-ink-200 hover:bg-ink-50'
                    } disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-ink-50/60 disabled:hover:bg-ink-50/60`}
                  >
                    <span className={`text-sm font-bold ${full ? 'text-ink-400' : 'text-ink-900'}`}>Bracket {b.letter}</span>
                    <span className="text-xs font-semibold text-ink-500">
                      {capacity != null ? `${b.teams.length} / ${capacity} teams` : `${b.teams.length} ${b.teams.length === 1 ? 'team' : 'teams'}`}
                      {full ? (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">FULL</span>
                      ) : (
                        slots != null && <span className="ml-2 text-brand-600">{slots} {slots === 1 ? 'slot' : 'slots'} available</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {destinations.length > 0 && destinations.every(isFull) && (
            <p className="mt-2 text-xs font-semibold text-rose-600">Every other bracket is full — raise the max teams per bracket to make room.</p>
          )}
        </div>

        {clubClash && (
          <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs text-sky-800">
            <Info size={14} className="mt-0.5 shrink-0" /> Bracket {target.letter} already has a team from {team.club_name}. The randomizer keeps clubs apart,
            but you can still move them here.
          </p>
        )}

        {matchlist?.hasResults ? (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Matches for this category already contain recorded results. Moving this {noun.toLowerCase()} and regenerating the matchlist may affect the
            existing tournament structure. Recorded scores are never deleted.
          </p>
        ) : (
          matchlist?.exists && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Changing this bracket assignment will make the current matchlist outdated. Your existing matchlist will remain unchanged until you
              regenerate it.
            </p>
          )
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={!target || saving}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? 'Moving…' : matchlist?.hasResults ? 'Continue' : `Move ${noun}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
