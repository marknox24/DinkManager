import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeftRight, Info, Search, Shuffle } from 'lucide-react';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import FormField, { inputClass, textareaClass } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { loadTransferDestination, loadTransferSource, transferRegistration } from '../../data/transfersApi';
import { teamLabel } from '../../utils/match';
import { eligibleBrackets, pickRandomBracket, planTransferFixtures, transferBlockers } from '../../utils/transfer';

// Event-day category transfer: a player (or a whole doubles pair) found
// playing below their level moves to another category. The organizer always
// picks the category; only the bracket inside it can be random. Step 1
// chooses, step 2 shows exactly what will change before anything is saved.
// Nothing already scheduled is rebuilt (see transfer_registration).
//
// registrations: the event's registrations (approved ones are searchable).
// initialRegistration: preselected when opened from a player's row.
const regLabel = (r) => teamLabel({ player1_name: r.player_name, player2_name: r.player2_name });
const codeNumber = (code) => Number(String(code ?? '').replace(/\D/g, '')) || 0;

export default function TransferPlayerModal({ registrations, categories, initialRegistration = null, onDone, onClose }) {
  const { pushToast } = useToast();
  const [regId, setRegId] = useState(initialRegistration?.id ?? null);
  // Opened without a player (Transfers page): pick their current category
  // first, then the player from that category's list.
  const [fromCatId, setFromCatId] = useState('');
  const [source, setSource] = useState(null);
  const [destId, setDestId] = useState('');
  const [dest, setDest] = useState(null);
  const [choice, setChoice] = useState(null); // bracket id or 'random'
  const [randomPick, setRandomPick] = useState(null);
  const [reason, setReason] = useState('');
  const [step, setStep] = useState('choose');
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);

  const registration = registrations.find((r) => r.id === regId) ?? initialRegistration;
  const sourceCategory = categories.find((c) => c.id === registration?.category_id) ?? null;
  const destCategory = categories.find((c) => c.id === destId) ?? null;
  const destOptions = categories.filter((c) => c.id !== sourceCategory?.id && c.match_type === sourceCategory?.match_type);

  useEffect(() => {
    if (!registration) return undefined;
    let stale = false;
    setSource(null);
    loadTransferSource(registration)
      .then((s) => !stale && setSource(s))
      .catch((e) => !stale && setLoadError(e.message));
    return () => {
      stale = true;
    };
    // Reload only when a different registration is picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration?.id]);

  useEffect(() => {
    setDest(null);
    setChoice(null);
    setRandomPick(null);
    if (!destId) return undefined;
    let stale = false;
    loadTransferDestination(destId)
      .then((d) => !stale && setDest(d))
      .catch((e) => !stale && setLoadError(e.message));
    return () => {
      stale = true;
    };
  }, [destId]);

  const eligible = useMemo(
    () => (dest ? eligibleBrackets(dest.brackets, dest.teams, destCategory?.max_teams_per_bracket ?? null) : []),
    [dest, destCategory?.max_teams_per_bracket]
  );
  const destHasPools = eligible.length > 0;
  const generated = Boolean(dest?.matches.length);
  const bracket = choice === 'random' ? randomPick : (eligible.find((b) => b.id === choice) ?? null);

  const blockers = transferBlockers({
    registration,
    sourceCategory,
    sourceTeam: source?.team,
    sourceLive: source?.live,
    sourceInPlayoffs: source?.inPlayoffs,
    destCategory,
    destHasPools,
    destHasPlayoffs: dest?.hasPlayoffs,
    bracket: choice === 'random' ? null : bracket,
  });
  if (destHasPools && eligible.every((b) => b.full)) blockers.push(`Every bracket in ${destCategory.name} is full.`);

  const fixtures = useMemo(() => {
    if (!bracket || !generated || !dest) return [];
    const inBracket = dest.matches.filter((m) => m.bracket_id === bracket.id && m.status !== 'canceled');
    const counts = {};
    inBracket.forEach((m) => {
      counts[m.team_a_id] = (counts[m.team_a_id] ?? 0) + 1;
      counts[m.team_b_id] = (counts[m.team_b_id] ?? 0) + 1;
    });
    const planned = planTransferFixtures({
      opponents: dest.teams.filter((t) => t.bracket_id === bracket.id && !t.withdrawn_at),
      isDouble: /double round robin/i.test(destCategory?.format || ''),
      gamesTarget: bracket.games_per_team ?? destCategory?.games_per_team ?? null,
      matchCounts: counts,
    });
    const start = Math.max(0, ...dest.matches.filter((m) => m.bracket_id === bracket.id).map((m) => codeNumber(m.match_code)));
    return planned.map((f, i) => ({ ...f, code: `${bracket.letter}${start + i + 1}` }));
  }, [bracket, generated, dest, destCategory?.format, destCategory?.games_per_team]);

  const ready = registration && source && destCategory && dest && (!destHasPools || choice) && blockers.length === 0;
  const name = registration ? regLabel(registration) : '';
  const fromText = `${sourceCategory?.name ?? ''}${source?.bracket ? ` · Bracket ${source.bracket.letter}` : ''}`;
  const toText = `${destCategory?.name ?? ''}${bracket ? ` · Bracket ${bracket.letter}` : ''}`;

  const review = () => {
    if (choice === 'random') setRandomPick(pickRandomBracket(eligible));
    setStep('review');
  };

  const confirm = async () => {
    setSaving(true);
    try {
      const result = await transferRegistration({
        registrationId: registration.id,
        toCategoryId: destCategory.id,
        toBracketId: destHasPools ? bracket.id : null,
        assignment: choice === 'random' ? 'random' : 'manual',
        fixtures,
        reason,
      });
      const added = result.new_codes?.length ?? 0;
      pushToast(
        `${name} moved to ${toText}.${added ? ` ${added} new ${added === 1 ? 'match needs a score sheet' : 'matches need score sheets'}.` : ''}`,
        'success'
      );
      onDone?.(result);
    } catch (e) {
      pushToast(e.message, 'error');
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={step === 'review' ? 'Confirm transfer' : 'Transfer category'} icon={ArrowLeftRight}>
      {step === 'choose' ? (
        <div className="flex flex-col gap-4">
          {!registration ? (
            <PlayerPicker
              registrations={registrations}
              categories={categories}
              categoryId={fromCatId}
              onCategoryChange={setFromCatId}
              onPick={(r) => setRegId(r.id)}
            />
          ) : (
            <div className="rounded-xl bg-ink-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-bold text-ink-900">{name}</p>
                {!initialRegistration && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegId(null);
                      setDestId('');
                    }}
                    className="shrink-0 text-xs font-bold text-brand-600 hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>
              {!source ? (
                <p className="text-xs text-ink-400">{loadError ?? 'Loading current assignment…'}</p>
              ) : (
                <p className="text-xs text-ink-500">
                  Now in <strong className="text-ink-700">{fromText}</strong>
                  {source.team
                    ? ` · ${source.team.wins}W–${source.team.losses}L · ${source.openMatches.length} ${source.openMatches.length === 1 ? 'match' : 'matches'} left`
                    : source.drawn
                      ? ' · not in a bracket'
                      : ' · not drawn yet'}
                  {registration.player2_name && ' · both partners move together'}
                </p>
              )}
            </div>
          )}

          {registration && (
            <>
              <FormField label="Move to category">
                <Select value={destId} onChange={(e) => setDestId(e.target.value)} className={inputClass}>
                  <option value="" disabled>
                    Choose a category…
                  </option>
                  {destOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                {destOptions.length === 0 && (
                  <p className="text-[11px] text-ink-400">No other {(sourceCategory?.match_type || '').toLowerCase()} category in this event.</p>
                )}
              </FormField>

              {destCategory && !dest && <p className="text-xs text-ink-400">{loadError ?? 'Loading brackets…'}</p>}

              {dest && destHasPools && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Bracket</p>
                  <div className="flex flex-col gap-1.5">
                    <BracketOption
                      selected={choice === 'random'}
                      onClick={() => setChoice('random')}
                      disabled={eligible.every((b) => b.full)}
                      title={
                        <span className="inline-flex items-center gap-1.5">
                          <Shuffle size={14} /> Random bracket
                        </span>
                      }
                      detail="One of the smallest brackets with room"
                    />
                    {eligible.map((b) => {
                      const cap = destCategory.max_teams_per_bracket;
                      return (
                        <BracketOption
                          key={b.id}
                          selected={choice === b.id}
                          onClick={() => setChoice(b.id)}
                          disabled={b.full}
                          title={`Bracket ${b.letter}`}
                          detail={cap != null ? `${b.count} / ${cap} players` : `${b.count} ${b.count === 1 ? 'player' : 'players'}`}
                          full={b.full}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {dest && !destHasPools && (
                <Note tone="sky">{destCategory.name} hasn’t been drawn yet. The player joins its draw when you randomize the brackets.</Note>
              )}
              {dest && destHasPools && !generated && (
                <Note tone="sky">{destCategory.name} has no matchlist yet. Their matches are included when you generate it.</Note>
              )}

              {destCategory && (
                <FormField label="Reason (optional)">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Skill level well above Beginner"
                    className={`${textareaClass} min-h-[64px]`}
                  />
                </FormField>
              )}

              {blockers.length > 0 && dest && source && (
                <Note tone="amber">
                  {blockers.map((b) => (
                    <span key={b} className="block">
                      {b}
                    </span>
                  ))}
                </Note>
              )}
            </>
          )}

          <Footer onCancel={onClose}>
            <button
              onClick={review}
              disabled={!ready}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
            >
              Review transfer
            </button>
          </Footer>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-ink-100">
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">From</p>
              <p className="text-sm font-bold text-ink-900">{fromText}</p>
            </div>
            <div className="flex items-center gap-2 border-y border-ink-100 bg-ink-50 px-4 py-1.5 text-xs font-bold text-ink-700">
              <ArrowDown size={14} className="text-amber-600" /> {name}
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">To</p>
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                {toText}
                {choice === 'random' && bracket && (
                  <>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Random</span>
                    <button type="button" onClick={() => setRandomPick(pickRandomBracket(eligible))} className="text-xs font-bold text-brand-600 hover:underline">
                      Pick again
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          {source?.openMatches.length > 0 && (
            <Note tone="ink">
              <strong>
                {source.openMatches.length} unplayed {source.openMatches.length === 1 ? 'match' : 'matches'} in {sourceCategory.name}
              </strong>{' '}
              ({source.openMatches.map((m) => m.match_code).join(', ')}) {source.openMatches.length === 1 ? 'becomes a walkover' : 'become walkovers'} for the
              opponent. {source.played > 0 ? 'Finished matches keep their scores.' : ''}
            </Note>
          )}

          {fixtures.length > 0 ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-800">
                {fixtures.length} new {fixtures.length === 1 ? 'match' : 'matches'} added at the end of {destCategory.name}. Prepare a score sheet for each:
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {fixtures.map((f) => (
                  <li key={f.code} className="flex items-baseline gap-2 text-xs text-amber-900">
                    <span className="w-9 shrink-0 font-bold tabular-nums">{f.code}</span>
                    <span className="min-w-0">
                      {f.side === 'a' ? `${name} vs ${teamLabel(f.opponent)}` : `${teamLabel(f.opponent)} vs ${name}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-700">Existing matches, numbers and scores stay exactly as they are.</p>
            </div>
          ) : (
            destHasPools &&
            generated && <Note tone="sky">Bracket {bracket?.letter} has no active opponents, so no matches are added.</Note>
          )}

          {reason.trim() && (
            <p className="text-xs text-ink-500">
              Reason: <span className="text-ink-700">{reason.trim()}</span>
            </p>
          )}

          <Footer onCancel={() => setStep('choose')} cancelLabel="Back">
            <button
              onClick={confirm}
              disabled={saving || (destHasPools && !bracket)}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
            >
              {saving ? 'Transferring…' : 'Transfer player'}
            </button>
          </Footer>
        </div>
      )}
    </Modal>
  );
}

// Category first, then a searchable list of that category's approved
// players. The list is always open (no hidden dropdown to discover); the
// search box narrows it, arrow keys move through it, Enter picks.
function PlayerPicker({ registrations, categories, categoryId, onCategoryChange, onPick }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const approved = useMemo(() => registrations.filter((r) => r.status === 'approved'), [registrations]);
  const countByCat = useMemo(() => {
    const counts = {};
    approved.forEach((r) => {
      counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
    });
    return counts;
  }, [approved]);
  const category = categories.find((c) => c.id === categoryId) ?? null;

  const players = useMemo(() => {
    const q = query.trim().toLowerCase();
    return approved
      .filter((r) => r.category_id === categoryId)
      .filter((r) => !q || `${r.player_name} ${r.player2_name ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => regLabel(a).localeCompare(regLabel(b)));
  }, [approved, categoryId, query]);

  const safeActive = Math.min(active, Math.max(players.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${safeActive}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [safeActive]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(safeActive + 1, players.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(safeActive - 1, 0));
    } else if (e.key === 'Enter' && players[safeActive]) {
      e.preventDefault();
      onPick(players[safeActive]);
    }
  };

  return (
    <>
      <FormField label="Current category">
        <Select
          autoFocus
          value={categoryId}
          onChange={(e) => {
            onCategoryChange(e.target.value);
            setQuery('');
            setActive(0);
          }}
          className={inputClass}
        >
          <option value="" disabled>
            Choose a category…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} disabled={!countByCat[c.id]}>
              {c.name} ({countByCat[c.id] ?? 0})
            </option>
          ))}
        </Select>
      </FormField>

      {category && (
        <FormField label="Player">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              key={category.id}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={`Search ${countByCat[category.id] ?? 0} players in ${category.name}…`}
              role="combobox"
              aria-expanded="true"
              aria-controls="transfer-player-list"
              aria-activedescendant={players[safeActive] ? `transfer-player-${players[safeActive].id}` : undefined}
              className={`${inputClass} pl-10`}
            />
          </div>
          {players.length > 0 ? (
            <ul
              id="transfer-player-list"
              ref={listRef}
              role="listbox"
              className="mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-ink-100 p-1"
            >
              {players.map((r, i) => (
                <li
                  key={r.id}
                  id={`transfer-player-${r.id}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === safeActive}
                  onMouseMove={() => i !== safeActive && setActive(i)}
                  onClick={() => onPick(r)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${
                    i === safeActive ? 'bg-brand-50 text-brand-700' : 'text-ink-900'
                  }`}
                >
                  <span className="min-w-0 truncate font-semibold">{regLabel(r)}</span>
                  {r.player2_name && <span className="shrink-0 text-[11px] text-ink-400">Pair</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 rounded-xl border border-dashed border-ink-200 px-3.5 py-3 text-xs text-ink-500">
              {query.trim() ? `No player in ${category.name} matches “${query.trim()}”.` : `No approved players in ${category.name}.`}
            </p>
          )}
        </FormField>
      )}
    </>
  );
}

function BracketOption({ selected, onClick, disabled, title, detail, full }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
        selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-ink-200 hover:bg-ink-50'
      } disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-ink-50/60 disabled:hover:bg-ink-50/60`}
    >
      <span className={`text-sm font-bold ${disabled ? 'text-ink-400' : 'text-ink-900'}`}>{title}</span>
      <span className="text-right text-xs font-semibold text-ink-500">
        {detail}
        {full && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">FULL</span>}
      </span>
    </button>
  );
}

const NOTE_TONES = {
  amber: { box: 'bg-amber-50 text-amber-800', icon: AlertTriangle },
  sky: { box: 'bg-sky-50 text-sky-800', icon: Info },
  ink: { box: 'bg-ink-50 text-ink-700', icon: Info },
};

function Note({ tone, children }) {
  const { box, icon: Icon } = NOTE_TONES[tone];
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs ${box}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Footer({ onCancel, cancelLabel = 'Cancel', children }) {
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-100">
        {cancelLabel}
      </button>
      {children}
    </div>
  );
}
