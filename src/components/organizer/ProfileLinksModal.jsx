import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { copyToClipboard } from '../../utils/clipboard';
import { profilePlatform, registrationProfiles, safeProfileHref } from '../../utils/socialProfile';

// The Facebook "f", for the table button when a link is a Facebook profile
// (lucide has no brand icons). currentColor, so it takes the button's colour.
export function FacebookGlyph({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z" />
    </svg>
  );
}

function ProfileRow({ label, name, url }) {
  const { pushToast } = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const href = safeProfileHref(url);

  const copy = async () => {
    const ok = await copyToClipboard(url);
    if (!ok) {
      pushToast('Could not copy the link', 'error');
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-xl border border-ink-100 p-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
        {label}
        {url ? ` · ${profilePlatform(url)}` : ''}
      </div>
      <div className="break-words text-sm font-bold text-ink-900">{name}</div>
      {url ? (
        <div className="mt-2 flex items-center gap-2">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/i, '')}</span>
              <ExternalLink size={12} className="shrink-0" />
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-ink-500">{url}</span>
          )}
          <button
            onClick={copy}
            aria-label={`Copy ${label} profile link`}
            className="press-scale flex shrink-0 items-center gap-1 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100"
          >
            {copied ? <Check size={12} className="text-brand-600" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-400">No link given.</p>
      )}
    </div>
  );
}

export default function ProfileLinksModal({ registration, onClose }) {
  return (
    <Modal open onClose={onClose} title="Profile links" icon={Link2} maxWidth="max-w-md">
      <div className="flex flex-col gap-2.5">
        {registrationProfiles(registration).map((p) => (
          <ProfileRow key={p.label} {...p} />
        ))}
        <p className="text-[11px] text-ink-400">Players were asked to keep these profiles public. A private profile may only show a name and photo.</p>
      </div>
    </Modal>
  );
}
