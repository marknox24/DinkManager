import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useScrolled from '../../hooks/useScrolled';
import Logo from '../ui/Logo';

const LINKS = [
  { label: 'Features', href: '#product' },
  { label: 'For Organizers', href: '#organizers' },
  { label: 'For Players', href: '#players' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', href: '#faq' },
];

export default function MarketingNav() {
  const { user, loading } = useAuth();
  const scrolled = useScrolled(24);
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={`flex w-full max-w-6xl items-center justify-between rounded-full border border-ink-900/5 bg-white/90 backdrop-blur-md transition-[padding,box-shadow] duration-300 ease-out ${
          scrolled ? 'px-4 py-2 shadow-[0_8px_30px_-12px_rgba(17,23,31,0.25)]' : 'px-5 py-3 shadow-[0_4px_16px_-8px_rgba(17,23,31,0.12)]'
        }`}
      >
        <Link to="/" className="flex items-center gap-2">
          <Logo size={26} />
          <span className="font-display text-[15px] font-bold text-ink-900">DinkManager</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/tournaments" className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50">
            View All Events
          </Link>
          {!loading && user ? (
            <Link to="/dashboard" className="press-scale flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700">
              Dashboard <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50">
                Log in
              </Link>
              <Link to="/signup" className="press-scale rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700">
                Create an Event
              </Link>
            </>
          )}
        </div>

        <button onClick={() => setOpen((v) => !v)} className="press-scale rounded-full p-2 text-ink-700 lg:hidden" aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="animate-rise-in absolute left-4 right-4 top-[4.5rem] rounded-3xl border border-ink-100 bg-white p-4 shadow-xl lg:hidden">
          <div className="flex flex-col">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">
                {l.label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-ink-100 pt-3">
            <Link to="/tournaments" onClick={() => setOpen(false)} className="rounded-full border border-ink-200 px-4 py-2.5 text-center text-sm font-semibold text-ink-700">
              View All Events
            </Link>
            {!loading && user ? (
              <Link to="/dashboard" className="rounded-full bg-brand-600 px-4 py-2.5 text-center text-sm font-bold text-white">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-full border border-ink-200 px-4 py-2.5 text-center text-sm font-semibold text-ink-700">
                  Log in
                </Link>
                <Link to="/signup" className="rounded-full bg-brand-600 px-4 py-2.5 text-center text-sm font-bold text-white">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
