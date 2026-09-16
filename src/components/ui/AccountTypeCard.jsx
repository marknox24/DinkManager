import { ShieldCheck } from 'lucide-react';

const STYLES = {
  admiral: { label: 'ADMIRAL', tone: 'bg-ink-900 text-white' },
  organizer: { label: 'ORGANIZER', tone: 'bg-brand-100 text-brand-700' },
  player: { label: 'PLAYER', tone: 'bg-sky-100 text-sky-700' },
};

// Shown wherever the signed-in user should clearly see their account type —
// pulls from AuthContext's `accountType` (derived from profile.role +
// is_admin), never hard-coded, so it's correct for every account.
export default function AccountTypeCard({ accountType }) {
  const cfg = STYLES[accountType] || STYLES.organizer;
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
        <ShieldCheck size={16} strokeWidth={2.3} />
      </span>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Account Type</div>
        <span className={`inline-block rounded-full px-2 py-0.5 font-display text-xs font-extrabold tracking-wide ${cfg.tone}`}>{cfg.label}</span>
      </div>
    </div>
  );
}
