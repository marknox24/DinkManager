import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, icon: Icon, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${maxWidth} max-h-[85vh] overflow-y-auto rounded-3xl bg-white shadow-2xl animate-modal-in`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-3xl border-b border-ink-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon size={18} strokeWidth={2.3} />
              </span>
            )}
            <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
