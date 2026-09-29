import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/ui/Logo';
import MarketingFooter from '../../components/marketing/MarketingFooter';
import useSeo from '../../hooks/useSeo';

// Shared shell for /privacy and /terms. `sections` is [{ id, title, body }]
// where body is JSX — the table of contents is built from id/title.
export default function LegalLayout({ title, effectiveDate, intro, sections, otherDoc, seo }) {
  useSeo({ title: `${title} | DinkManager`, ...seo });
  // Arriving from a footer link would otherwise keep the previous scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f6f8]">
      <header className="border-b border-ink-100 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-display text-[15px] font-bold text-ink-900">DinkManager</span>
          </Link>
          <Link to={otherDoc.to} className="text-xs font-semibold text-ink-500 hover:text-ink-800">
            {otherDoc.label} →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Legal</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink-900">{title}</h1>
          <p className="mt-2 text-sm text-ink-500">Effective date: {effectiveDate}</p>
          <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-ink-700">{intro}</div>

          <nav aria-label="Contents" className="mt-8 rounded-2xl bg-ink-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Contents</p>
            <ol className="mt-3 grid list-decimal gap-x-8 gap-y-1.5 pl-5 text-sm text-brand-700 sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:underline">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <h2 className="font-display text-lg font-bold text-ink-900">
                  {i + 1}. {s.title}
                </h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-700">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
