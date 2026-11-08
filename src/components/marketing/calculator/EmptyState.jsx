import { Trophy } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-ink-50/40 py-14 text-center">
      <Trophy size={24} className="text-ink-300" />
      <p className="text-sm font-semibold text-ink-600">Add a category to see your estimate</p>
      <p className="max-w-xs text-xs text-ink-400">Match counts, warnings, and a full court-by-court schedule will appear here.</p>
    </div>
  );
}
