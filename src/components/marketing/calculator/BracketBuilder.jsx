import BracketCard from './BracketCard';
import { validateBracket } from '../../../utils/calculator/index.js';

// "Add category" lives one level up (CalculatorPanel), aligned into the
// Step 1 header row — this component only owns the list itself, so Step 1
// and Step 2 start from the same baseline height.
export default function BracketBuilder({ brackets, setBrackets, matchCountsByBracket }) {
  const update = (idx, next) => setBrackets(brackets.map((b, i) => (i === idx ? next : b)));
  const remove = (idx) => setBrackets(brackets.filter((_, i) => i !== idx));

  if (brackets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/40 py-10 text-center text-sm text-ink-400">
        Add at least one category to see match counts and a projected schedule.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {brackets.map((bracket, i) => (
        <BracketCard
          key={bracket.id}
          bracket={bracket}
          errors={validateBracket(bracket).errors}
          totalMatches={matchCountsByBracket?.[bracket.id]}
          onChange={(next) => update(i, next)}
          onRemove={() => remove(i)}
        />
      ))}
    </div>
  );
}
