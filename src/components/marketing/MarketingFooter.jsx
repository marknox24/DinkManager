import { Link, useLocation } from 'react-router-dom';
import Logo from '../ui/Logo';
import Reveal from './Reveal';
import { CollapsibleReleaseNotes } from './ReleaseNotesList';
import { useReleaseNotes } from '../../hooks/useReleaseNotes';
import { RECENT_UPDATES_COUNT } from '../../utils/releaseNotes';

// The newest shipped updates, read from the deploy history (see
// src/utils/releaseNotes.js), so this follows every deploy on its own. Each
// row opens a short breakdown; "View all updates" goes to /updates.
function RecentUpdates() {
  const notes = useReleaseNotes(RECENT_UPDATES_COUNT);
  if (notes.length === 0) return null;
  return (
    <Reveal className="mt-12 border-t border-ink-100 pt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-ink-900">Recent updates</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Shipped continuously
        </span>
      </div>
      <CollapsibleReleaseNotes notes={notes} />
      <div className="mt-3 flex justify-end">
        <Link to="/updates" className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800 hover:underline">
          View all updates →
        </Link>
      </div>
    </Reveal>
  );
}

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#product' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'For Organizers', href: '#organizers' },
      { label: 'For Players', href: '#players' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '#faq' },
      { label: 'Guides', href: '#faq' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
];

// Section anchors (#pricing etc.) only exist on the landing page, where the
// smooth-scroll hook intercepts bare "#…" links — elsewhere (e.g. /privacy)
// they need the "/" prefix to navigate back to the landing page first.
function FooterLink({ href, onLanding, children }) {
  const className = 'text-sm text-ink-600 transition hover:text-ink-900';
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  const resolved = href.startsWith('#') && href.length > 1 && !onLanding ? `/${href}` : href;
  return (
    <a href={resolved} className={className}>
      {children}
    </a>
  );
}

export default function MarketingFooter() {
  const onLanding = useLocation().pathname === '/';
  return (
    <footer className="border-t border-ink-100 bg-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <Logo size={26} />
              <span className="font-display text-[15px] font-bold text-ink-900">DinkManager</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-ink-500">Built for the people who bring sports communities together.</p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">{col.title}</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink href={l.href} onLanding={onLanding}>
                      {l.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <RecentUpdates />

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} DinkManager. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-ink-700">Twitter</a>
            <a href="#" className="hover:text-ink-700">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
