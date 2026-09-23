import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, Shuffle, Target, Trophy, UserCheck, X } from 'lucide-react';
import Modal from '../ui/Modal';
import { inputClass } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { listRegistrations } from '../../data/eventsApi';
import { addPlayerToBracket, getBracketAssignmentsForEvent, getBracketProgressForCategory, listBracketsForCategory } from '../../data/bracketsApi';

function teamLabel(reg) {
  return reg.player2_name ? `${reg.player_name} & ${reg.player2_name}` : reg.player_name;
}

// Registration is the source of truth for participants (see the app's own
// Registration -> Brackets flow) — this modal only ever offers already-
// APPROVED registrations, and only ever inserts one `teams` row per pick
// (one row already covers a doubles pair, via player1_name/player2_name —
// see addPlayerToBracket in bracketsApi.js). It never creates a new
// registration; if the player the organizer wants isn't in the list, they
// have to register them on the Registrations page first.
export default function AddPlayerToBracketModal({ eventId, categories, onAdded, onClose }) {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  // registration_id -> bracket letter, event-wide (any category) — mirrors
  // RegistrationsPage's own "already placed" badge/disable logic.
  const [assignments, setAssignments] = useState({});
  const [query, setQuery] = useState('');
  const [selectedReg, setSelectedReg] = useState(null);

  const [mode, setMode] = useState('manual'); // 'manual' | 'random'
  const [categoryBrackets, setCategoryBrackets] = useState([]); // [{id, letter, teamCount, matchCount}]
  const [loadingBrackets, setLoadingBrackets] = useState(false);
  const [selectedBracketId, setSelectedBracketId] = useState(null);
  const [saving, setSaving] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRegistrations(eventId), getBracketAssignmentsForEvent(categories.map((c) => c.id))])
      .then(([regs, assign]) => {
        if (cancelled) return;
        setRegistrations(regs.filter((r) => r.status === 'approved'));
        setAssignments(assign);
      })
      .catch((e) => pushToast(e.message, 'error'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [eventId, categories, pushToast]);

  const filteredRegistrations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter(
      (r) => teamLabel(r).toLowerCase().includes(q) || (categoryById.get(r.category_id)?.name || '').toLowerCase().includes(q)
    );
  }, [registrations, query, categoryById]);

  const loadBracketsForCategory = useCallback(
    async (categoryId) => {
      setLoadingBrackets(true);
      setSelectedBracketId(null);
      try {
        const [brackets, progress] = await Promise.all([listBracketsForCategory(categoryId), getBracketProgressForCategory(categoryId)]);
        const poolBrackets = brackets.filter((b) => b.kind !== 'playoff');
        const progressByBracket = new Map(progress.map((p) => [p.bracket_id, p]));
        setCategoryBrackets(
          poolBrackets.map((b) => ({
            id: b.id,
            letter: b.letter,
            teamCount: progressByBracket.get(b.id)?.teamCount ?? 0,
            matchCount: progressByBracket.get(b.id)?.totalMatches ?? 0,
          }))
        );
      } catch (e) {
        pushToast(e.message, 'error');
      } finally {
        setLoadingBrackets(false);
      }
    },
    [pushToast]
  );

  const handleSelectPlayer = (reg) => {
    setSelectedReg(reg);
    setQuery('');
    setMode('manual');
    loadBracketsForCategory(reg.category_id);
  };

  const alreadyAssignedLetter = selectedReg ? assignments[selectedReg.id] : null;
  const selectedBracket = categoryBrackets.find((b) => b.id === selectedBracketId);

  // "Prioritize balanced distribution" — pick among whichever bracket(s)
  // currently have the fewest teams, breaking ties randomly. No hard "full"
  // cap exists in this app's data model (brackets are organizer-sized at
  // draw time, see RandomizerModal), so every bracket in the category is
  // eligible; balance is the only thing random assignment optimizes for.
  const pickRandomBracket = () => {
    if (categoryBrackets.length === 0) return null;
    const minCount = Math.min(...categoryBrackets.map((b) => b.teamCount));
    const candidates = categoryBrackets.filter((b) => b.teamCount === minCount);
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const handleConfirm = async () => {
    if (!selectedReg || alreadyAssignedLetter) return;
    const target = mode === 'random' ? pickRandomBracket() : selectedBracket;
    if (!target) {
      pushToast(mode === 'random' ? 'No eligible brackets for this category.' : 'Choose a bracket first.', 'error');
      return;
    }
    setSaving(true);
    try {
      await addPlayerToBracket(target.id, selectedReg);
      pushToast(`Player successfully added to Bracket ${target.letter}.`, 'success');
      await onAdded?.();
      onClose();
    } catch (e) {
      // addPlayerToBracket re-checks "not already assigned" server-side
      // right before inserting — this is what actually catches a race
      // (e.g. a second organizer/tab assigning the same player a moment
      // earlier), not just the client-side `alreadyAssignedLetter` check
      // above, which only reflects what this modal saw when it opened.
      pushToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Player to Bracket" icon={UserCheck} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        {!selectedReg ? (
          <>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search registered players…"
                className={`${inputClass} pl-9`}
              />
            </div>

            <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {loading ? (
                <div className="py-8 text-center text-sm text-ink-400">Loading…</div>
              ) : filteredRegistrations.length === 0 ? (
                <div className="py-8 text-center text-sm text-ink-400">
                  {registrations.length === 0 ? 'No approved registrations in this event yet.' : 'No players match your search.'}
                </div>
              ) : (
                filteredRegistrations.map((r) => {
                  const assignedLetter = assignments[r.id];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={!!assignedLetter}
                      onClick={() => handleSelectPlayer(r)}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                        assignedLetter
                          ? 'cursor-not-allowed border-ink-100 bg-ink-50/60 opacity-60'
                          : 'border-ink-100 bg-white hover:border-brand-300 hover:bg-brand-50/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink-800">{teamLabel(r)}</div>
                        <div className="mt-0.5 truncate text-xs text-ink-400">
                          {categoryById.get(r.category_id)?.name || 'Unknown category'} · Approved
                        </div>
                      </div>
                      {assignedLetter ? (
                        <span className="shrink-0 rounded-full bg-ink-200 px-2.5 py-1 text-[11px] font-bold text-ink-600">
                          In Bracket {assignedLetter}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-600">Select</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Selected Player</div>
                <div className="text-sm font-bold text-ink-900">{teamLabel(selectedReg)}</div>
                <div className="text-xs text-ink-500">Category: {categoryById.get(selectedReg.category_id)?.name}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedReg(null);
                  setCategoryBrackets([]);
                }}
                className="flex shrink-0 items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-600 transition hover:bg-ink-100"
              >
                <X size={11} /> Change
              </button>
            </div>

            {alreadyAssignedLetter ? (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                <AlertTriangle size={16} className="shrink-0" />
                Player is already assigned to Bracket {alreadyAssignedLetter}.
              </div>
            ) : (
              <>
                <div>
                  <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">Assignment</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('manual')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                        mode === 'manual' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      <Target size={13} /> Select Bracket
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('random')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                        mode === 'random' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      <Shuffle size={13} /> Assign Randomly
                    </button>
                  </div>
                </div>

                {mode === 'manual' ? (
                  loadingBrackets ? (
                    <div className="py-6 text-center text-sm text-ink-400">Loading brackets…</div>
                  ) : categoryBrackets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-5 text-center text-sm text-ink-500">
                      This category has no brackets yet — draw brackets first from the Brackets page.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {categoryBrackets.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBracketId(b.id)}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                            selectedBracketId === b.id
                              ? 'border-brand-600 bg-brand-50'
                              : 'border-ink-100 bg-white hover:border-brand-300 hover:bg-brand-50/40'
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                            <Trophy size={13} className="text-ink-400" /> Bracket {b.letter}
                          </span>
                          <span className="text-xs font-semibold text-ink-500">
                            {b.teamCount} {b.teamCount === 1 ? 'Team' : 'Teams'}
                          </span>
                        </button>
                      ))}
                      {selectedBracket?.matchCount > 0 && (
                        <div className="mt-1 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                          Bracket {selectedBracket.letter} already has {selectedBracket.matchCount} match
                          {selectedBracket.matchCount === 1 ? '' : 'es'} generated. This player will be added to the bracket, but you'll need
                          to add their matches manually — existing matches, scores, and progress are untouched.
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-5 text-center text-sm text-ink-500">
                    {categoryBrackets.length === 0
                      ? 'This category has no brackets yet — draw brackets first from the Brackets page.'
                      : 'Player will be assigned automatically to an eligible bracket, prioritizing the bracket with the fewest teams.'}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          {selectedReg && !alreadyAssignedLetter && (
            <button
              onClick={handleConfirm}
              disabled={saving || categoryBrackets.length === 0 || (mode === 'manual' && !selectedBracketId)}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Adding…' : mode === 'random' ? 'Assign Randomly' : 'Add Player'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
