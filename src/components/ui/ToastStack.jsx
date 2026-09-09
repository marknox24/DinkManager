import { CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ToastStack() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[9999] flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/10 animate-toast-in cursor-pointer ${
            t.tone === 'error' ? 'bg-rose-600' : 'bg-ink-900'
          }`}
        >
          {t.tone === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} className="text-brand-400" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
