import Switch from '../ui/Switch';
import { EVENT_PERMISSIONS } from '../../data/permissions';

// Maps EVENT_PERMISSIONS to a grid of Switch rows. Controlled { value,
// onChange } so the same component drives both the invite card and
// EditStaffModal. `redraw_brackets` renders indented under Brackets and is
// force-disabled (and forced off) whenever Brackets itself is off.
export default function StaffPermissionToggles({ value, onChange }) {
  const setColumn = (column, checked) => {
    const next = { ...value, [column]: checked };
    if (column === 'can_brackets' && !checked) next.can_redraw_brackets = false;
    onChange(next);
  };

  return (
    <div className="flex flex-col divide-y divide-ink-100 rounded-xl border border-ink-100">
      {EVENT_PERMISSIONS.map((perm) => {
        const isSub = Boolean(perm.sub);
        const disabled = isSub && perm.key === 'redraw_brackets' && !value.can_brackets;
        return (
          <div
            key={perm.key}
            className={`flex items-center justify-between gap-4 px-4 py-3 ${isSub ? 'pl-9 bg-ink-50/40' : ''}`}
          >
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${perm.key === 'redraw_brackets' ? 'text-amber-700' : 'text-ink-800'}`}>
                {perm.label}
              </div>
              <div className="text-xs text-ink-400">{perm.description}</div>
            </div>
            <Switch checked={Boolean(value[perm.column])} onChange={(checked) => setColumn(perm.column, checked)} disabled={disabled} />
          </div>
        );
      })}
    </div>
  );
}
