export default function FormField({ label, children, hint, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</label>}
      {children}
      {hint && <p className="text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white';
export const textareaClass = `${inputClass} min-h-[100px] resize-y`;
