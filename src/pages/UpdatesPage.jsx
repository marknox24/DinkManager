import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import MarketingFooter from '../components/marketing/MarketingFooter';
import { FullReleaseNotes } from '../components/marketing/ReleaseNotesList';
import { useReleaseNotes } from '../hooks/useReleaseNotes';
import useSeo from '../hooks/useSeo';
import { ALL_UPDATES_COUNT, keepRecent } from '../utils/releaseNotes';

// Public changelog: every visitor-facing update from about the last two
// months, each with its breakdown. Older entries drop off by themselves
// (keepRecent), so this never needs cleaning up by hand.
export default function UpdatesPage() {
  useSeo({ title: 'Updates | DinkManager', description: 'What’s new in DinkManager: the latest features, speed improvements and fixes.' });
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const notes = keepRecent(useReleaseNotes(ALL_UPDATES_COUNT));

  return (
    <div className="min-h-screen bg-[#f3f6f8]">
      <header className="border-b border-ink-100 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-display text-[15px] font-bold text-ink-900">DinkManager</span>
          </Link>
          <Link to="/" className="text-xs font-semibold text-ink-500 hover:text-ink-800">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">What’s new</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink-900">Updates</h1>
          <p className="mt-2 text-sm text-ink-500">New features, speed improvements and fixes from the last two months, newest first.</p>
          <div className="mt-8">
            {notes.length > 0 ? <FullReleaseNotes notes={notes} /> : <p className="text-sm text-ink-500">Loading updates…</p>}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
