// Minimal window chrome so product mockups read as "a real app", not a
// floating card. Deliberately understated — three dots and a thin bar,
// nothing skeuomorphic.
export default function BrowserFrame({ children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[0_30px_60px_-20px_rgba(17,23,31,0.25)] ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-ink-100 bg-ink-50/80 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
      </div>
      {children}
    </div>
  );
}
