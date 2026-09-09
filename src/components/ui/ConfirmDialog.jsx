import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-modal-in">
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${danger ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600'}`}>
          <AlertTriangle size={20} strokeWidth={2.3} />
        </div>
        <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{message}</p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
