import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { runCalculator, DEFAULT_SETTINGS, createEmptyBracket } from '../../../utils/calculator/index.js';
import BracketBuilder from './BracketBuilder';
import GlobalSettingsPanel from './GlobalSettingsPanel';
import WarningsPanel from './WarningsPanel';
import SummaryCards from './SummaryCards';
import ResultsTabs from './ResultsTabs';
import EmptyState from './EmptyState';

function StepLabel({ number, action, children }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">{number}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-ink-500">{children}</span>
      </div>
      {action}
    </div>
  );
}

// A small "live" pulse instead of a step number — this section sits above
// Step 1/2 now, so it reads as an always-current readout rather than a
// third step in the sequence the user has to scroll down to reach.
function LiveLabel() {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-xs font-bold uppercase tracking-wide text-ink-500">Live results</span>
    </div>
  );
}

// Owns all calculator state and the single memoized engine call —
// brackets/settings updates always go through immutable map/filter/spread
// (never mutated in place), so reference equality alone keeps this
// useMemo correctly invalidated without needing useCallback on every
// setter.
export default function CalculatorPanel() {
  const [brackets, setBrackets] = useState(() => [
    createEmptyBracket({ name: 'Beginner', teamCount: 8, format: 'Round Robin' }),
  ]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const result = useMemo(() => runCalculator({ brackets, settings }), [brackets, settings]);

  const matchCountsByBracket = useMemo(
    () => Object.fromEntries(result.brackets.map((b) => [b.bracketId, b.shape?.totalMatches ?? b.items.filter((it) => !it.isBye).length])),
    [result.brackets]
  );

  // First unused number, so deleting "Category 2" and adding again doesn't
  // produce a second "Category 3".
  const addCategory = () => {
    const names = new Set(brackets.map((b) => b.name));
    let n = brackets.length + 1;
    while (names.has(`Category ${n}`)) n += 1;
    setBrackets([...brackets, createEmptyBracket({ name: `Category ${n}` })]);
  };

  return (
    <div className="flex flex-col gap-6">
      {brackets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-3xl bg-ink-50/60 p-4 sm:p-6">
          <LiveLabel />
          <div className="flex flex-col gap-4">
            <WarningsPanel warnings={result.warnings} />
            <SummaryCards summary={result.summary} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
        <div>
          <StepLabel
            number={1}
            action={
              <button
                onClick={addCategory}
                className="press-scale flex items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
              >
                <Plus size={13} /> Add category
              </button>
            }
          >
            Category Setup
          </StepLabel>
          <BracketBuilder brackets={brackets} setBrackets={setBrackets} matchCountsByBracket={matchCountsByBracket} />
        </div>
        <div>
          <StepLabel number={2}>Set your courts &amp; schedule</StepLabel>
          <GlobalSettingsPanel settings={settings} setSettings={setSettings} />
        </div>
      </div>

      {brackets.length > 0 && <ResultsTabs result={result} />}
    </div>
  );
}
