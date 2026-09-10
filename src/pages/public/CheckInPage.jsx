import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Search, Users } from 'lucide-react';
import { checkInPlayer, getCheckinRegistration, getPublicEventBySlug, listCategories, listCheckinRoster } from '../../data/eventsApi';
import Logo from '../../components/ui/Logo';

const POLL_MS = 4000;
const storageKey = (eventId) => `dm_checkin_${eventId}`;

function loadSaved(eventId) {
  try {
    const raw = localStorage.getItem(storageKey(eventId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCheckin(eventId, record) {
  try {
    localStorage.setItem(storageKey(eventId), JSON.stringify(record));
  } catch {
    // Private browsing / storage disabled — check-in still works this visit,
    // it just won't be remembered if they scan again on the same device.
  }
}

function clearSaved(eventId) {
  try {
    localStorage.removeItem(storageKey(eventId));
  } catch {
    // no-op
  }
}

// A doubles registration is "done" only once both slots have a timestamp;
// singles has no player2_name at all, so that side is trivially satisfied.
function isFullyCheckedIn(reg) {
  if (!reg) return false;
  const p1Done = Boolean(reg.player1_checked_in_at);
  const p2Done = reg.player2_name ? Boolean(reg.player2_checked_in_at) : true;
  return p1Done && p2Done;
}

function buildSearchEntries(roster) {
  const entries = [];
  roster.forEach((r) => {
    entries.push({
      registrationId: r.id,
      slot: 'player1',
      name: r.player_name,
      partnerName: r.player2_name || null,
      alreadyCheckedIn: Boolean(r.player1_checked_in_at),
    });
    if (r.player2_name) {
      entries.push({
        registrationId: r.id,
        slot: 'player2',
        name: r.player2_name,
        partnerName: r.player_name,
        alreadyCheckedIn: Boolean(r.player2_checked_in_at),
      });
    }
  });
  return entries;
}

export default function CheckInPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(undefined); // undefined = loading, null = not found
  const [categories, setCategories] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading | category | name | confirm | waiting | error
  const [categoryId, setCategoryId] = useState('');
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [activeReg, setActiveReg] = useState(null); // { id, category_id, player_name, player2_name, player1_checked_in_at, player2_checked_in_at }
  const [activeSlot, setActiveSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef(null);

  const redirectToPreview = useCallback(
    (catId) => {
      navigate(`/events/${event.id}/preview/${catId}`, { replace: true });
    },
    [event, navigate]
  );

  // Resume a previous check-in on this device (revisited link / scanned the
  // QR again) instead of making them pick their name a second time.
  useEffect(() => {
    if (!event) return;
    const saved = loadSaved(event.id);
    if (!saved) {
      setPhase('category');
      return;
    }
    getCheckinRegistration(saved.registrationId)
      .then((reg) => {
        if (!reg) {
          clearSaved(event.id);
          setPhase('category');
          return;
        }
        if (isFullyCheckedIn(reg)) {
          redirectToPreview(reg.category_id);
          return;
        }
        setActiveReg(reg);
        setActiveSlot(saved.slot);
        setCategoryId(reg.category_id);
        setPhase('waiting');
      })
      .catch(() => setPhase('category'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  useEffect(() => {
    getPublicEventBySlug(slug)
      .then(async (ev) => {
        setEvent(ev);
        const cats = await listCategories(ev.id);
        setCategories(cats);
      })
      .catch(() => setEvent(null));
  }, [slug]);

  // Poll while waiting for a partner, or while parked on the resumed state —
  // there's no one to click "refresh" on a phone someone set down to go play.
  useEffect(() => {
    if (phase !== 'waiting' || !activeReg) return undefined;
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await getCheckinRegistration(activeReg.id);
        if (fresh && isFullyCheckedIn(fresh)) {
          clearInterval(pollRef.current);
          redirectToPreview(fresh.category_id);
        } else if (fresh) {
          setActiveReg(fresh);
        }
      } catch {
        // Transient network hiccup — just try again on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [phase, activeReg, redirectToPreview]);

  const selectCategory = async (cat) => {
    setCategoryId(cat.id);
    setQuery('');
    setSelectedEntry(null);
    setErrorMsg('');
    try {
      const data = await listCheckinRoster(event.id, cat.id);
      setRoster(data);
      setPhase('name');
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const searchEntries = useMemo(() => buildSearchEntries(roster), [roster]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return searchEntries.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, searchEntries]);

  const pickEntry = (entry) => {
    setSelectedEntry(entry);
    setQuery(entry.name);
    setPhase('confirm');
  };

  const confirmCheckIn = async () => {
    if (!selectedEntry) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const reg = await checkInPlayer(selectedEntry.registrationId, selectedEntry.slot);
      saveCheckin(event.id, { registrationId: selectedEntry.registrationId, categoryId, slot: selectedEntry.slot });
      if (isFullyCheckedIn(reg)) {
        redirectToPreview(reg.category_id);
        return;
      }
      setActiveReg(reg);
      setActiveSlot(selectedEntry.slot);
      setPhase('waiting');
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const backToNameSearch = () => {
    setSelectedEntry(null);
    setPhase('name');
  };

  if (event === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] text-sm text-ink-400">Loading…</div>;
  }
  if (event === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4 text-center text-sm text-ink-500">
        Event not found or not published.
      </div>
    );
  }

  const myName = activeSlot === 'player2' ? activeReg?.player2_name : activeReg?.player_name;
  const partnerName = activeSlot === 'player2' ? activeReg?.player_name : activeReg?.player2_name;
  const partnerDone = activeSlot === 'player2' ? Boolean(activeReg?.player1_checked_in_at) : Boolean(activeReg?.player2_checked_in_at);

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f3f6f8] px-4 py-8">
      <Logo size={36} />
      <h1 className="mt-2 font-display text-base font-bold text-ink-900">{event.name}</h1>
      <p className="mb-6 text-xs font-semibold uppercase tracking-wide text-brand-600">Event check-in</p>

      <div className="w-full max-w-sm">
        {phase !== 'waiting' && (
          <div className="mb-5 flex items-center gap-1.5">
            <div className={`h-1.5 flex-1 rounded-full ${phase !== 'category' ? 'bg-brand-600' : 'bg-ink-200'}`} />
            <div className={`h-1.5 flex-1 rounded-full ${['name', 'confirm'].includes(phase) ? 'bg-brand-600' : 'bg-ink-200'}`} />
          </div>
        )}

        {phase === 'category' && (
          <div className="rounded-3xl border border-ink-100 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-display text-lg font-bold text-ink-900">Which category?</h2>
            <p className="mb-4 text-xs text-ink-500">Pick the tournament category you're playing in today.</p>
            {categories.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">No categories available yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat)}
                    className="rounded-2xl border border-ink-200 px-4 py-3.5 text-left text-sm font-semibold text-ink-800 transition hover:border-brand-400 hover:bg-brand-50/60 active:scale-[0.98]"
                  >
                    {cat.name}
                    <div className="text-xs font-normal text-ink-400">{cat.match_type}</div>
                  </button>
                ))}
              </div>
            )}
            {errorMsg && <p className="mt-3 text-xs font-semibold text-rose-600">{errorMsg}</p>}
          </div>
        )}

        {phase === 'name' && (
          <div className="rounded-3xl border border-ink-100 bg-white p-5 shadow-sm">
            <button onClick={() => setPhase('category')} className="mb-3 text-xs font-semibold text-ink-400 hover:text-ink-700">
              ← Change category
            </button>
            <h2 className="mb-1 font-display text-lg font-bold text-ink-900">What's your name?</h2>
            <p className="mb-4 text-xs text-ink-500">Start typing and select yourself from the list.</p>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedEntry(null);
                }}
                placeholder="Start typing your name…"
                className="w-full rounded-xl border border-ink-200 py-3 pl-10 pr-3.5 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            {query.trim().length >= 2 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {suggestions.length === 0 ? (
                  <p className="px-1 py-3 text-center text-xs text-ink-400">
                    Can't find your name? Double-check with the organizer that your registration was approved.
                  </p>
                ) : (
                  suggestions.map((entry) => (
                    <button
                      key={`${entry.registrationId}-${entry.slot}`}
                      onClick={() => pickEntry(entry)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-ink-100 px-3.5 py-2.5 text-left text-sm transition hover:border-brand-300 hover:bg-brand-50/60 active:scale-[0.98]"
                    >
                      <span>
                        <span className="font-semibold text-ink-800">{entry.name}</span>
                        {entry.partnerName && <span className="text-xs text-ink-400"> &nbsp;with {entry.partnerName}</span>}
                      </span>
                      {entry.alreadyCheckedIn && <CheckCircle2 size={15} className="shrink-0 text-brand-500" />}
                    </button>
                  ))
                )}
              </div>
            )}
            {errorMsg && <p className="mt-3 text-xs font-semibold text-rose-600">{errorMsg}</p>}
          </div>
        )}

        {phase === 'confirm' && selectedEntry && (
          <div className="rounded-3xl border border-ink-100 bg-white p-5 shadow-sm">
            <button onClick={backToNameSearch} className="mb-3 text-xs font-semibold text-ink-400 hover:text-ink-700">
              ← Not me
            </button>
            <div className="flex flex-col items-center py-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Users size={22} />
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-ink-900">Is this you?</h2>
              <p className="mt-1 text-base font-bold text-brand-700">{selectedEntry.name}</p>
              {selectedEntry.partnerName && <p className="text-xs text-ink-500">Playing with {selectedEntry.partnerName}</p>}
              {selectedEntry.alreadyCheckedIn && (
                <p className="mt-2 text-xs font-semibold text-amber-600">You're already checked in — confirming will just refresh it.</p>
              )}
            </div>
            <button
              onClick={confirmCheckIn}
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Checking in…' : "Yes, that's me — check in"}
            </button>
            {errorMsg && <p className="mt-3 text-center text-xs font-semibold text-rose-600">{errorMsg}</p>}
          </div>
        )}

        {phase === 'waiting' && (
          <div className="rounded-3xl border border-ink-100 bg-white p-6 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <CheckCircle2 size={26} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-ink-900">You're checked in, {myName}!</h2>
            {partnerName ? (
              partnerDone ? (
                <p className="mt-2 text-sm text-ink-600">Taking you to the live screen…</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-ink-600">
                    Waiting for <span className="font-semibold text-ink-900">{partnerName}</span> to check in too.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-ink-400">
                    <Loader2 size={14} className="animate-spin text-brand-500" /> This page updates automatically
                  </div>
                </>
              )
            ) : (
              <p className="mt-2 text-sm text-ink-600">Taking you to the live screen…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
