import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng, toCanvas } from 'html-to-image';
import { ChevronLeft, ChevronRight, Crown, Download, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { downloadPagesAsPdf } from '../../utils/pdf';
import { listBracketsForCategory, listTeamsForCategory } from '../../data/bracketsApi';

function teamName(t) {
  return t.player2_name ? `${t.player1_name} & ${t.player2_name}` : t.player1_name;
}

// One vibrant full-bleed background per download, picked at random from the
// brand palette (src/index.css) each time a category loads. Purple is dark
// enough for white text; the other three are too light — white-on-coral/
// teal/amber measures ~2.2–2.8:1 (fails WCAG's 4.5:1), so those three use
// dark ink text instead, still on their full-strength brand color.
const BG_THEMES = [
  { bg: '#6C5CE7', text: '#ffffff', soft: 'rgba(255,255,255,0.82)', pillText: '#6C5CE7', watermark: '#a6bccc', logoBars: ['#ffffff', 'rgba(255,255,255,0.72)', 'rgba(255,255,255,0.46)'] },
  { bg: '#FF6B6B', text: '#1c2733', soft: 'rgba(28,39,51,0.72)', pillText: '#1c2733', watermark: '#7a1512', logoBars: ['#6C5CE7', '#17C3B2', '#1c2733'] },
  { bg: '#17C3B2', text: '#1c2733', soft: 'rgba(28,39,51,0.72)', pillText: '#1c2733', watermark: '#0a4f48', logoBars: ['#6C5CE7', '#FF6B6B', '#1c2733'] },
  { bg: '#FFC93C', text: '#1c2733', soft: 'rgba(28,39,51,0.72)', pillText: '#1c2733', watermark: '#7a5c00', logoBars: ['#6C5CE7', '#17C3B2', '#FF6B6B'] },
];

// The two accents a page's bracket sections alternate through, inside the
// white card — independent of the page's own background theme above.
const SECTION_ACCENTS = [
  { chipBg: '#E4E0FB', chipText: '#5949C9', pillBg: '#E4E0FB', pillText: '#5949C9' },
  { chipBg: '#FFE0DC', chipText: '#E6483F', pillBg: '#FFE0DC', pillText: '#E6483F' },
];

function randomTheme() {
  return BG_THEMES[Math.floor(Math.random() * BG_THEMES.length)];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

// Post-draw "who's in which bracket" roster, grouped Category → Bracket
// A/B/C — distinct from DownloadRegistrationsModal.jsx, which exports
// pre-draw registrations (this reads teams/brackets, not registrations).
export default function DownloadBracketsListModal({ event, categories, activeCategoryId, onClose }) {
  const { pushToast } = useToast();
  const [selectedCategoryId, setSelectedCategoryId] = useState(activeCategoryId || categories[0]?.id || '');
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [poolBrackets, setPoolBrackets] = useState([]);
  const [teamsByBracket, setTeamsByBracket] = useState({});
  const [theme, setTheme] = useState(randomTheme);
  const [downloading, setDownloading] = useState(null); // 'png' | 'pdf' | null
  const paperRef = useRef(null);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  useEffect(() => {
    if (!selectedCategoryId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageIndex(0);
    setTheme(randomTheme());
    (async () => {
      try {
        const brackets = await listBracketsForCategory(selectedCategoryId);
        const pools = brackets.filter((b) => b.kind === 'pool');
        const teams = await listTeamsForCategory(selectedCategoryId, pools);
        if (cancelled) return;
        const byBracket = {};
        pools.forEach((b) => {
          byBracket[b.id] = teams
            .filter((t) => t.bracket_id === b.id)
            .sort((a, b2) => (a.created_at || '').localeCompare(b2.created_at || '') || a.id.localeCompare(b2.id));
        });
        setPoolBrackets(pools);
        setTeamsByBracket(byBracket);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load brackets for this category.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId]);

  const pages = useMemo(() => chunk(poolBrackets, 2), [poolBrackets]);
  const currentPageBrackets = pages[pageIndex] || [];
  const bracketRangeLabel =
    currentPageBrackets.length <= 1
      ? `Bracket ${currentPageBrackets[0]?.letter ?? ''}`
      : `Brackets ${currentPageBrackets[0].letter}–${currentPageBrackets[currentPageBrackets.length - 1].letter}`;

  const filenameBase = (suffix) => {
    const safeEvent = (event?.name || 'Event').replace(/[^a-z0-9]+/gi, '_').slice(0, 30);
    const safeCat = (selectedCategory?.name || 'Category').replace(/[^a-z0-9]+/gi, '_').slice(0, 30);
    return `${safeEvent}_${safeCat}_${suffix}`;
  };

  const downloadPng = async () => {
    if (!paperRef.current || currentPageBrackets.length === 0) return;
    setDownloading('png');
    try {
      const dataUrl = await toPng(paperRef.current, { pixelRatio: 2, skipFonts: true });
      const link = document.createElement('a');
      link.download = `${filenameBase(`Brackets_Page${pageIndex + 1}`)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      pushToast('Could not generate the image — try again', 'error');
    } finally {
      setDownloading(null);
    }
  };

  const downloadPdf = async () => {
    if (!paperRef.current || pages.length === 0) return;
    setDownloading('pdf');
    const startingPage = pageIndex;
    try {
      const canvases = [];
      for (let i = 0; i < pages.length; i++) {
        setPageIndex(i);
        await waitForPaint();
        canvases.push(await toCanvas(paperRef.current, { pixelRatio: 2, skipFonts: true }));
      }
      await downloadPagesAsPdf(canvases, `${filenameBase('Brackets')}.pdf`);
    } catch (e) {
      pushToast(e.message || 'Could not generate the PDF', 'error');
    } finally {
      setPageIndex(startingPage);
      setDownloading(null);
    }
  };

  return (
    <Modal open onClose={onClose} title="Download brackets list" icon={Download} maxWidth="max-w-4xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Category</span>
          <Select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 focus:border-brand-500 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={downloadPng}
            disabled={!!downloading || currentPageBrackets.length === 0}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading === 'png' ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} PNG
          </button>
          <button
            onClick={downloadPdf}
            disabled={!!downloading || pages.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} PDF
          </button>
        </div>
      </div>

      {pages.length > 1 && (
        <div className="mb-3 flex items-center justify-center gap-3">
          <button
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0 || !!downloading}
            aria-label="Previous page"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-bold text-ink-500">
            Page {pageIndex + 1} of {pages.length}
          </span>
          <button
            onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))}
            disabled={pageIndex === pages.length - 1 || !!downloading}
            aria-label="Next page"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* This is the exact node rasterized for both exports. A random brand
          color per category, a centered logo watermark, and a white roster
          card — see the "Brackets List Export Design" artifact for the
          reference mockup this mirrors. */}
      {/* Fixed pixel width (not responsive) so the exported PNG/PDF has the
          same dimensions and layout no matter how wide the organizer's
          browser window is — horizontal scroll here on a narrow screen,
          never a squeezed/reflowed document. */}
      <div className="max-h-[65vh] overflow-auto rounded-xl border border-ink-100 bg-ink-50/40 p-4">
        <div
          ref={paperRef}
          className="relative mx-auto overflow-hidden"
          style={{ background: theme.bg, width: '800px', padding: '44px', boxSizing: 'border-box' }}
        >
          {/* centered watermark */}
          <svg
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ opacity: 0.1 }}
            width="300"
            height="300"
            viewBox="0 0 40 40"
            aria-hidden="true"
          >
            <rect x="2" y="5" width="26" height="8" rx="4" fill={theme.watermark} />
            <rect x="8" y="16" width="24" height="8" rx="4" fill={theme.watermark} />
            <rect x="14" y="27" width="20" height="8" rx="4" fill={theme.watermark} />
          </svg>

          <div className="relative flex flex-col gap-5" style={{ zIndex: 1 }}>
            {/* eyebrow pill + page indicator */}
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center rounded-full bg-white px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-widest"
                style={{ color: theme.pillText }}
              >
                Brackets List
              </span>
              {pages.length > 1 && (
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.soft }}>
                  Page {pageIndex + 1} of {pages.length}
                </span>
              )}
            </div>

            {/* title block */}
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight" style={{ color: theme.text }}>
                {event?.name}
              </h1>
              <p className="text-base font-medium" style={{ color: theme.soft }}>
                {selectedCategory?.name} &middot; {bracketRangeLabel}
              </p>
            </div>

            {/* white roster card */}
            <div className="flex flex-col gap-6 rounded-3xl bg-white p-7 shadow-lg">
              {loading ? (
                <p className="text-sm text-ink-400">Loading…</p>
              ) : error ? (
                <p className="text-sm text-rose-600">{error}</p>
              ) : poolBrackets.length === 0 ? (
                <p className="text-sm text-ink-400">No brackets drawn yet for this category.</p>
              ) : (
                currentPageBrackets.map((b, sectionIdx) => {
                  const teams = teamsByBracket[b.id] || [];
                  const accent = SECTION_ACCENTS[sectionIdx % SECTION_ACCENTS.length];
                  return (
                    <div key={b.id} className={sectionIdx > 0 ? 'flex flex-col border-t border-ink-100 pt-6' : 'flex flex-col'}>
                      <div className="mb-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                            style={{ background: accent.chipBg, color: accent.chipText }}
                          >
                            <Crown size={15} />
                          </span>
                          <span className="font-display text-lg font-bold tracking-tight text-ink-900">Bracket {b.letter}</span>
                        </div>
                        <span className="rounded-full bg-ink-50 px-3 py-1 text-xs font-bold text-ink-500">
                          {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        {teams.map((t, i) => (
                          <div
                            key={t.id}
                            className={`flex items-center justify-between gap-3 py-3 ${i < teams.length - 1 ? 'border-b border-ink-100' : ''}`}
                          >
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate text-[15px] font-bold text-ink-900">{teamName(t)}</span>
                              <span className={`text-xs ${t.club_name ? 'text-ink-500' : 'text-ink-300'}`}>{t.club_name || 'No club listed'}</span>
                            </div>
                            <span
                              className="shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold"
                              style={{ background: accent.pillBg, color: accent.pillText }}
                            >
                              Seed {i + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg width="24" height="24" viewBox="0 0 40 40" aria-hidden="true">
                  <rect x="2" y="5" width="26" height="8" rx="4" fill={theme.logoBars[0]} />
                  <rect x="8" y="16" width="24" height="8" rx="4" fill={theme.logoBars[1]} />
                  <rect x="14" y="27" width="20" height="8" rx="4" fill={theme.logoBars[2]} />
                </svg>
                <span className="font-display text-[15px] font-extrabold" style={{ color: theme.text }}>
                  DinkManager
                </span>
              </div>
              <span className="text-xs" style={{ color: theme.soft }}>
                dinkmanager.com
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
