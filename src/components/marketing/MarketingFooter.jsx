import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';

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
      { label: 'Terms', href: '#' },
      { label: 'Privacy', href: '#' },
    ],
  },
];

export default function MarketingFooter() {
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
                    <a href={l.href} className="text-sm text-ink-600 transition hover:text-ink-900">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:justify-between">
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
