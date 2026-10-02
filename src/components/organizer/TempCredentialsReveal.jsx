import { useState } from 'react';
import { CheckCircle2, Check, Copy } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';

function CopyButton({ copied, onClick, label = 'Copy' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink-600 transition-[background-color,transform] duration-150 hover:bg-ink-50 active:scale-[0.95]"
    >
      {copied ? <Check size={13} className="text-brand-600" /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function CredentialRow({ label, value, copied, onCopy }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white px-3.5 py-2.5">
      <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</span>
      <code className="min-w-0 flex-1 select-all break-all font-mono text-sm text-ink-900">{value}</code>
      <CopyButton copied={copied} onClick={onCopy} />
    </div>
  );
}

// The one-time "here's the login, copy it now" reveal shared by the Team
// page's "Generate temporary login" mode and StaffLoginModal. `onDone` is
// optional — a modal passes it to render a closing button; InviteCard (an
// inline card, not a modal) renders the reveal without one.
export default function TempCredentialsReveal({ email, password, expiresAt, onDone }) {
  const [copiedKey, setCopiedKey] = useState(null);
  const signInUrl = `${window.location.origin}/login`;

  const copy = async (key, text) => {
    if (!(await copyToClipboard(text))) return;
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-bold text-brand-800">Temporary login ready</p>
          <p className="text-xs text-brand-700">
            <strong>The password is shown only once</strong> — copy it now and hand it to your helper.
          </p>
        </div>
      </div>
      <CredentialRow label="Username" value={email} copied={copiedKey === 'username'} onCopy={() => copy('username', email)} />
      <CredentialRow label="Password" value={password} copied={copiedKey === 'password'} onCopy={() => copy('password', password)} />
      <button
        type="button"
        onClick={() => copy('both', `Sign in: ${signInUrl}\nUsername: ${email}\nPassword: ${password}`)}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-[0.98]"
      >
        {copiedKey === 'both' ? <Check size={15} /> : <Copy size={15} />}
        {copiedKey === 'both' ? 'Copied — ready to send' : 'Copy sign-in details to share'}
      </button>
      <p className="text-xs text-brand-600">
        They sign in at <strong>{signInUrl.replace(/^https?:\/\//, '')}</strong>, entering the username in the Email field.
        {expiresAt === null && ' This login does not expire.'}
        {expiresAt && (
          <>
            {' '}Valid until <strong>{new Date(expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
          </>
        )}
      </p>
      {onDone && (
        <button onClick={onDone} className="rounded-xl bg-ink-900 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800 active:scale-[0.98]">
          Done
        </button>
      )}
    </div>
  );
}
