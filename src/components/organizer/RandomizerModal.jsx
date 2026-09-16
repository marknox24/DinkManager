import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Crown, Download, Loader2, PartyPopper, Radio, Shuffle, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import Modal from '../ui/Modal';
import { inputClass } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { drawBrackets, drawTimings, flattenDrawOrder, suggestBracketCount } from '../../utils/randomizer';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function teamLabel(reg) {
  return reg.player2_name ? `${reg.player_name} & ${reg.player2_name}` : reg.player_name;
}

// Full name(s) plus club, shown consistently everywhere a team appears in
// this modal (the shuffling pool, the live callout, each bracket filling up,
// and the final result) — not just the result screen.
function teamLabelWithClub(reg) {
  return reg.club_name ? `${teamLabel(reg)} · ${reg.club_name}` : teamLabel(reg);
}

const BRACKET_GRID_COLS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
};

const BRACKET_COLORS = [
  'border-brand-300 bg-brand-50/60 text-brand-700',
  'border-sky-300 bg-sky-50/60 text-sky-700',
  'border-violet-300 bg-violet-50/60 text-violet-700',
  'border-amber-300 bg-amber-50/60 text-amber-700',
  'border-rose-300 bg-rose-50/60 text-rose-700',
  'border-teal-300 bg-teal-50/60 text-teal-700',
];

// allowSameClub is a per-event preference set on the Settings page (Club
// separation), not a per-run modal option — passed straight through to
// drawBrackets rather than re-chosen here.
export default function RandomizerModal({ category, registrations, hasExistingBrackets, allowSameClub, onConfirm, onClose }) {
  const { pushToast } = useToast();
  const [numBrackets, setNumBrackets] = useState(suggestBracketCount(registrations.length));
  const [phase, setPhase] = useState('config'); // config | shuffling | drawing | complete | result
  const [pool, setPool] = useState(registrations);
  const [placed, setPlaced] = useState([]); // [{reg, letter}]
  const [spotlightId, setSpotlightId] = useState(null);
  const [callout, setCallout] = useState(null); // {reg, letter}
  const [jitterTick, setJitterTick] = useState(0);
  const [grouping, setGrouping] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const resultRef = useRef(null);

  const estimatedSeconds = useMemo(() => {
    const { perPickMs } = drawTimings(registrations.length);
    return Math.max(3, Math.round((1300 + perPickMs * registrations.length + 1100) / 1000));
  }, [registrations.length]);

  const cancelledRef = useRef(false);
  useEffect(() => () => {
    cancelledRef.current = true;
  }, []);

  // Continuous jitter for the "shuffling pile" visual while a draw is live.
  useEffect(() => {
    if (phase !== 'shuffling' && phase !== 'drawing') return;
    const id = setInterval(() => setJitterTick((t) => t + 1), 140);
    return () => clearInterval(id);
  }, [phase]);

  const letters = useMemo(() => Array.from(new Set([...(grouping ? Object.keys(grouping) : []), ...placed.map((p) => p.letter)])).sort(), [grouping, placed]);

  const runLiveDraw = async () => {
    cancelledRef.current = false; // a fresh draw is never cancelled, even if StrictMode's
    // mount-simulation flipped this during an earlier dev double-render.
    const fullGrouping = drawBrackets(registrations, numBrackets, { allowSameClub });
    const order = flattenDrawOrder(fullGrouping);
    const { chaseMs, landingMs } = drawTimings(order.length);

    setGrouping(fullGrouping);
    setPool(registrations);
    setPlaced([]);
    setCallout(null);
    setPhase('shuffling');
    await wait(1300);
    if (cancelledRef.current) return;

    setPhase('drawing');
    let remaining = [...registrations];

    for (let i = 0; i < order.length; i++) {
      if (cancelledRef.current) return;
      const target = order[i];

      // Chase: rapidly spotlight remaining pool entries before landing on the pick.
      const chaseSteps = Math.max(4, Math.floor(chaseMs / 90));
      for (let s = 0; s < chaseSteps; s++) {
        if (cancelledRef.current) return;
        const isLast = s === chaseSteps - 1;
        const spot = isLast ? target.reg.id : remaining[Math.floor(Math.random() * remaining.length)]?.id;
        setSpotlightId(spot);
        await wait(90);
      }

      if (cancelledRef.current) return;
      setCallout(target);
      remaining = remaining.filter((r) => r.id !== target.reg.id);
      setPool(remaining);
      setPlaced((prev) => [...prev, target]);
      await wait(landingMs);
    }

    if (cancelledRef.current) return;
    setSpotlightId(null);
    setPhase('complete');
    await wait(1100);
    if (cancelledRef.current) return;
    setPhase('result');
  };

  const redraw = () => {
    runLiveDraw();
  };

  const confirm = async () => {
    setSaving(true);
    try {
      await onConfirm(grouping);
    } finally {
      setSaving(false);
    }
  };

  const downloadPng = async () => {
    if (!resultRef.current) return;
    setDownloading(true);
    try {
      // skipFonts avoids html-to-image trying to read cssRules off the
      // Google Fonts <link> stylesheet, which throws a CORS SecurityError
      // in every browser since that stylesheet isn't same-origin — the
      // capture still succeeds either way, this just keeps it silent and
      // falls back to a system font instead of Space Grotesk in the PNG.
      const dataUrl = await toPng(resultRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: true });
      const link = document.createElement('a');
      const slug = category.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'brackets';
      link.download = `${slug}-brackets.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      pushToast('Could not generate the image — try again', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    if (phase === 'shuffling' || phase === 'drawing') return; // don't allow closing mid-draw
    onClose();
  };

  const bracketCounts = useMemo(() => {
    const counts = {};
    placed.forEach((p) => {
      counts[p.letter] = (counts[p.letter] || 0) + 1;
    });
    return counts;
  }, [placed]);

  return (
    <Modal open onClose={handleClose} title={`Randomizer — ${category.name}`} icon={Shuffle} maxWidth="max-w-3xl">
      {phase === 'config' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2.5 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
            <Users size={16} />
            <span>
              <strong>{registrations.length}</strong> approved {registrations.length === 1 ? 'team' : 'teams'} ready to be drawn live.
            </span>
          </div>

          {hasExistingBrackets && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              This category already has brackets. Drawing again replaces them — any recorded matches will be lost.
            </div>
          )}

          {registrations.length === 0 ? (
            <p className="text-sm text-ink-500">Approve at least one registration in this category before drawing brackets.</p>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Number of brackets</label>
                <input
                  type="number"
                  min={1}
                  max={registrations.length}
                  value={numBrackets}
                  onChange={(e) => setNumBrackets(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className={`${inputClass} max-w-[140px]`}
                />
                <p className="mt-1 text-[11px] text-ink-400">~{Math.round(registrations.length / numBrackets)} teams per bracket</p>
              </div>
              <button
                onClick={runLiveDraw}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 transition hover:from-brand-700 hover:to-brand-800"
              >
                <Zap size={17} /> Start the live draw
              </button>
              <p className="text-center text-[11px] text-ink-400">Teams get called out one at a time — about {estimatedSeconds}s.</p>
            </>
          )}
        </div>
      )}

      {(phase === 'shuffling' || phase === 'drawing' || phase === 'complete') && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-3 text-white">
            <Radio size={14} className="animate-pulse-soft text-rose-400" />
            <span className="font-display text-xs font-bold uppercase tracking-widest">
              {phase === 'shuffling' && 'Shuffling the pool…'}
              {phase === 'drawing' && 'Live draw in progress'}
              {phase === 'complete' && 'Draw complete!'}
            </span>
            {phase === 'complete' && <PartyPopper size={14} className="text-amber-300" />}
          </div>

          <div className="min-h-[52px]">
            {callout && (phase === 'drawing' || phase === 'complete') && (
              <div key={callout.reg.id} className="animate-modal-in flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-center">
                <Sparkles size={16} className="shrink-0 text-amber-500" />
                <span className="text-sm font-bold text-amber-900">
                  {teamLabelWithClub(callout.reg)} <span className="font-normal text-amber-700">goes to</span> Bracket {callout.letter}!
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">
              {pool.length > 0 ? `${pool.length} still in the pool` : 'Pool empty'}
            </div>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 p-3 min-h-[64px]">
              {pool.map((reg, i) => {
                const jitterX = ((((i * 37 + jitterTick * 17) % 11) - 5) * 0.6).toFixed(1);
                const jitterY = ((((i * 53 + jitterTick * 11) % 9) - 4) * 0.6).toFixed(1);
                const jitterR = (((i * 29 + jitterTick * 7) % 7) - 3).toFixed(1);
                const spot = reg.id === spotlightId;
                return (
                  <span
                    key={reg.id}
                    style={!spot ? { transform: `translate(${jitterX}px, ${jitterY}px) rotate(${jitterR}deg)` } : undefined}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-100 ${
                      spot ? 'scale-110 bg-brand-600 text-white shadow-lg shadow-brand-600/40' : 'bg-white text-ink-600 shadow-sm'
                    }`}
                  >
                    {teamLabelWithClub(reg)}
                  </span>
                );
              })}
              {pool.length === 0 && <span className="text-xs text-ink-400">All teams placed.</span>}
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-2 ${BRACKET_GRID_COLS[Math.min(6, Math.max(2, numBrackets))]}`}>
            {Array.from({ length: numBrackets }, (_, i) => String.fromCharCode(65 + i)).map((letter, i) => (
              <div key={letter} className={`rounded-xl border-2 p-2.5 ${BRACKET_COLORS[i % BRACKET_COLORS.length]}`}>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1">
                    <Trophy size={11} /> {letter}
                  </span>
                  <span>{bracketCounts[letter] || 0}</span>
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {placed
                    .filter((p) => p.letter === letter)
                    .map((p) => (
                      <div key={p.reg.id} className="animate-modal-in truncate rounded-lg bg-white/80 px-2 py-1 text-[11px] font-medium">
                        {teamLabelWithClub(p.reg)}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && grouping && (
        <div className="flex flex-col gap-5">
          <div ref={resultRef} className="rounded-2xl bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-ink-100 pb-3">
              <div>
                <div className="font-display text-base font-bold text-ink-900">{category.name}</div>
                <div className="text-xs text-ink-500">
                  {registrations.length} team{registrations.length === 1 ? '' : 's'} · {letters.length} bracket{letters.length === 1 ? '' : 's'} ·{' '}
                  {new Date().toLocaleDateString()}
                </div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Trophy size={18} />
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {letters.map((letter, li) => (
                <div
                  key={letter}
                  className={`animate-modal-in rounded-2xl border-2 p-3 ${BRACKET_COLORS[li % BRACKET_COLORS.length]}`}
                  style={{ animationDelay: `${li * 80}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="mb-2 flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Crown size={13} /> Bracket {letter}
                    </span>
                    <span className="rounded-full bg-white/70 px-2 py-0.5">{grouping[letter].length} teams</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {grouping[letter].map((reg, i) => (
                      <div key={reg.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-ink-700 shadow-sm">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[9px] font-bold text-ink-500">
                          {i + 1}
                        </span>
                        <span className="truncate">{teamLabelWithClub(reg)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2.5">
            <button onClick={redraw} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
              <Shuffle size={14} /> Redraw live
            </button>
            <button
              onClick={downloadPng}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100 disabled:opacity-60"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Preparing…' : 'Download PNG'}
            </button>
            <button
              onClick={confirm}
              disabled={saving}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Confirm & save'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
