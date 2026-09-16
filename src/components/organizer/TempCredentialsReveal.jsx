import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// The one-time "here's the login, copy it now" reveal shared by the Team
// page's "Generate temporary login" mode and StaffLoginModal. `onDone` is
// optional — a modal passes it to render a closing button; InviteCard (an
// inline card, not a modal) renders the reveal without one.
export default function TempCredentialsReveal({ email, password, expiresAt, onDone }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
      <p className="text-sm text-brand-700">
        Temporary login generated. <strong>The password is shown only once</strong> — copy both values now and hand them to your helper.
      </p>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3.5 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Username</span>
        <code className="select-all font-mono text-sm text-ink-900">{email}</code>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5">
        <code className="flex-1 select-all font-mono text-sm text-ink-900">{password}</code>
        <button onClick={handleCopy} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-ink-600 hover:bg-ink-50">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {expiresAt && (
        <p className="text-xs text-brand-600">
          Valid until <strong>{new Date(expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
        </p>
      )}
      {onDone && (
        <button onClick={onDone} className="rounded-xl bg-ink-900 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">
          Done
        </button>
      )}
    </div>
  );
}
