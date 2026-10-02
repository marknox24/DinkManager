import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toLocalYmd } from '../../utils/format';

function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShort(ymd) {
  return parseYmd(ymd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function addDays(date, n) {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));

const cellBase =
  'relative flex h-9 items-center justify-center text-sm font-semibold transition-[background-color,color,transform] duration-100 active:scale-[0.94] disabled:pointer-events-none disabled:text-ink-200';

// A "pick a start day, then an end day" calendar popover. Registrations only
// exist in the past, so future days are disabled. `value` is
// { from, to } as local-date strings (or null); a single-day range has
// from === to.
export default function DateRangePicker({ value, onChange, placeholder = 'Registered date' }) {
  const { from, to } = value;
  const [open, setOpen] = useState(false);
  // The first click of a range sets `from` and waits here for the second.
  const [pendingStart, setPendingStart] = useState(null);
  const [hover, setHover] = useState(null);
  // Opens toward whichever side has room — the trigger sits at the far
  // right of the filter row on desktop but wraps to the left on phones.
  const [alignRight, setAlignRight] = useState(false);
  const todayYmd = toLocalYmd(new Date());
  const [viewMonth, setViewMonth] = useState(() => {
    const anchor = from ? parseYmd(from) : new Date();
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  });
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const lead = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => toLocalYmd(new Date(year, month, i + 1)))];
  }, [viewMonth]);

  const apply = (range) => {
    setPendingStart(null);
    setHover(null);
    onChange(range);
  };

  const pickDay = (ymd) => {
    if (!pendingStart) {
      setPendingStart(ymd);
      onChange({ from: ymd, to: ymd });
      return;
    }
    const [a, b] = ymd < pendingStart ? [ymd, pendingStart] : [pendingStart, ymd];
    apply({ from: a, to: b });
  };

  const preset = (daysBack) => {
    const today = new Date();
    apply({ from: toLocalYmd(addDays(today, -daysBack)), to: toLocalYmd(today) });
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // While a range is half-picked, preview it against the hovered day.
  const [rangeA, rangeB] = useMemo(() => {
    if (pendingStart && hover) return hover < pendingStart ? [hover, pendingStart] : [pendingStart, hover];
    return [from, to];
  }, [pendingStart, hover, from, to]);

  const active = Boolean(from);
  const label = !active ? placeholder : from === to ? formatShort(from) : `${formatShort(from)} – ${formatShort(to)}`;
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const atCurrentMonth = viewMonth.getFullYear() === new Date().getFullYear() && viewMonth.getMonth() === new Date().getMonth();

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div
        className={`flex items-center rounded-full text-xs font-bold transition-[background-color,box-shadow] duration-150 ${
          active ? 'bg-brand-600 text-white shadow-sm' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (!open && rootRef.current) setAlignRight(rootRef.current.getBoundingClientRect().left + 304 > window.innerWidth - 16);
            setOpen((o) => !o);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex items-center gap-1.5 py-2.5 pl-3.5 transition-transform duration-100 active:scale-[0.97] ${active ? 'pr-1.5' : 'pr-3.5'}`}
        >
          <CalendarDays size={14} />
          {label}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => apply({ from: null, to: null })}
            aria-label="Clear date filter"
            className="mr-1.5 flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Filter by registration date"
          style={{ transformOrigin: alignRight ? 'top right' : 'top left' }}
          className={`animate-popover-in absolute top-full z-30 ${alignRight ? 'right-0' : 'left-0'} mt-2 w-[19rem] rounded-2xl border border-ink-100 bg-white p-3 shadow-xl`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-[background-color,transform] duration-100 hover:bg-ink-50 active:scale-[0.94]"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-ink-900">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              disabled={atCurrentMonth}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-[background-color,transform] duration-100 hover:bg-ink-50 active:scale-[0.94] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-ink-400">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
            {days.map((ymd, i) => {
              if (!ymd) return <span key={`blank-${i}`} />;
              const inRange = rangeA && rangeB && ymd >= rangeA && ymd <= rangeB;
              const isEdge = ymd === rangeA || ymd === rangeB;
              const isToday = ymd === todayYmd;
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={ymd > todayYmd}
                  onClick={() => pickDay(ymd)}
                  onMouseEnter={() => pendingStart && setHover(ymd)}
                  aria-pressed={isEdge}
                  className={`${cellBase} ${
                    isEdge
                      ? 'rounded-full bg-brand-600 text-white'
                      : inRange
                        ? 'bg-brand-50 text-brand-700'
                        : 'rounded-full text-ink-700 hover:bg-ink-50'
                  } ${isToday && !isEdge ? 'ring-1 ring-inset ring-brand-300' : ''}`}
                >
                  {parseYmd(ymd).getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
            {[
              ['Today', () => preset(0)],
              ['Last 7 days', () => preset(6)],
              ['Last 30 days', () => preset(29)],
            ].map(([text, run]) => (
              <button
                key={text}
                type="button"
                onClick={run}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink-600 ring-1 ring-ink-200 transition-[background-color,transform] duration-100 hover:bg-ink-50 active:scale-[0.95]"
              >
                {text}
              </button>
            ))}
            <button
              type="button"
              onClick={() => apply({ from: null, to: null })}
              disabled={!active}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-400 transition-colors hover:text-ink-700 disabled:opacity-40 disabled:hover:text-ink-400"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
