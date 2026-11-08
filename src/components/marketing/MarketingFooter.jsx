import { Link, useLocation } from 'react-router-dom';
import Logo from '../ui/Logo';
import Reveal from './Reveal';

// Real, shipped changes — dated from their actual release, not placeholder
// copy. Kept short and user-facing (no internal implementation details);
// pick the next real entry's date/time from the git log when adding one.
const UPDATES = [
  { date: 'Oct 17, 2026 · 3:13 PM', type: 'Fix', title: 'Streamlined the Create Event flow for returning organizers' },
  { date: 'Oct 12, 2026 · 9:35 AM', type: 'Performance', title: 'Improved platform stability during high-traffic sign-ups' },
  { date: 'Oct 11, 2026 · 12:54 PM', type: 'Performance', title: 'Hardened sign-in and cut mobile load times with smarter caching' },
  { date: 'Oct 7, 2026 · 10:59 PM', type: 'Feature', title: 'Added real-time Single Elimination bracket progression with seeded byes' },
  { date: 'Oct 6, 2026 · 1:07 AM', type: 'Feature', title: 'Added a dynamic, auto-updating Match Schedule' },
];

const TYPE_DOT = {
  Feature: 'bg-brand-500',
  Performance: 'bg-sky-500',
  Fix: 'bg-amber-500',
};

function RecentUpdates() {
  return (
    <div className="mt-12 border-t border-ink-100 pt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-ink-900">Recent updates</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Shipped continuously
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-ink-50/40 px-4 sm:px-5">
        {UPDATES.map((u, i) => (
          <Reveal as="li" key={u.title} delay={i * 50} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-start gap-2.5">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[u.type]}`} />
              <div>
                <p className="text-sm font-semibold text-ink-800">{u.title}</p>
                <p className="text-xs font-medium text-ink-400">{u.type}</p>
              </div>
            </div>
            <p className="shrink-0 pl-4 text-xs font-medium text-ink-400 sm:pl-0 sm:text-right">{u.date}</p>
          </Reveal>
        ))}
      </ul>
    </div>
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
