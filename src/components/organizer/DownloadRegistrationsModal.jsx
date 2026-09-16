import { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Logo from '../ui/Logo';
import { useToast } from '../../context/ToastContext';
import { downloadNodeAsPdf } from '../../utils/pdf';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-brand-100 text-brand-700',
  denied: 'bg-rose-100 text-rose-600',
  waitlisted: 'bg-violet-100 text-violet-700',
};

function teamName(r) {
  return r.player2_name ? `${r.player_name} & ${r.player2_name}` : r.player_name;
}

export default function DownloadRegistrationsModal({ event, categories, registrations, onClose }) {
  const { pushToast } = useToast();
  const [selectedIds, setSelectedIds] = useState(() => new Set(categories.map((c) => c.id)));
  const [downloading, setDownloading] = useState(null); // 'png' | 'pdf' | null
  const paperRef = useRef(null);

  const allSelected = selectedIds.size === categories.length;

  const toggleCategory = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(categories.map((c) => c.id)));

  const selectedCategories = useMemo(() => categories.filter((c) => selectedIds.has(c.id)), [categories, selectedIds]);
  const generatedAt = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const filename = (ext) => {
    const safeName = (event?.name || 'Event').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    return `${safeName}_Registrations.${ext}`;
  };

  const downloadPng = async () => {
    if (!paperRef.current || selectedCategories.length === 0) return;
    setDownloading('png');
    try {
      // skipFonts avoids html-to-image's CORS SecurityError reading cssRules
      // off the cross-origin Google Fonts stylesheet — same fix used by the
      // Randomizer's and Accounting report's exports.
      const dataUrl = await toPng(paperRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: true });
      const link = document.createElement('a');
      link.download = filename('png');
      link.href = dataUrl;
      link.click();
    } catch {
      pushToast('Could not generate the image — try again', 'error');
    } finally {
      setDownloading(null);
    }
  };

  const downloadPdf = async () => {
    if (!paperRef.current || selectedCategories.length === 0) return;
    setDownloading('pdf');
    try {
      await downloadNodeAsPdf(paperRef.current, filename('pdf'));
    } catch (e) {
      pushToast(e.message || 'Could not generate the PDF', 'error');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Modal open onClose={onClose} title="Download registrations" icon={Download} maxWidth="max-w-3xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-500">Categories to include</span>
            <button onClick={toggleAll} className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700">
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  selectedIds.has(cat.id) ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-ink-200 hover:bg-ink-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={downloadPng}
            disabled={!!downloading || selectedCategories.length === 0}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading === 'png' ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} PNG
          </button>
          <button
            onClick={downloadPdf}
            disabled={!!downloading || selectedCategories.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} PDF
          </button>
        </div>
      </div>

      {/* This is the exact node rasterized for both exports — kept as plain,
          high-contrast, print-safe markup (no gradients/blurs) so it reads
          the same on screen and in the downloaded file. */}
      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-ink-100 bg-ink-50/40 p-4">
        <div ref={paperRef} className="mx-auto w-full max-w-2xl bg-white p-8 text-ink-900">
          <div className="flex items-start justify-between border-b-2 border-ink-900 pb-4">
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <div className="font-display text-base font-extrabold">DinkManager</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-400">Registrations</div>
              <div className="text-xs text-ink-400">Generated {generatedAt}</div>
            </div>
          </div>

          <div className="mt-5 font-display text-xl font-extrabold text-ink-900">{event?.name}</div>

          {selectedCategories.length === 0 ? (
            <p className="mt-4 text-sm text-ink-400">Select at least one category above.</p>
          ) : (
            selectedCategories.map((cat) => {
              const catRegs = registrations.filter((r) => r.category_id === cat.id);
              return (
                <div key={cat.id} className="mt-6">
                  <div className="mb-2 flex items-center justify-between border-b border-ink-200 pb-1.5">
                    <div className="text-sm font-extrabold text-ink-900">{cat.name}</div>
                    <div className="text-xs text-ink-400">
                      {catRegs.length} {catRegs.length === 1 ? 'registration' : 'registrations'}
                    </div>
                  </div>
                  {catRegs.length === 0 ? (
                    <p className="py-2 text-xs text-ink-400">No registrations in this category.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-ink-100 text-left text-[10px] font-bold uppercase tracking-wide text-ink-400">
                          <th className="py-1.5 pr-2">Player</th>
                          <th className="py-1.5 pr-2">Club</th>
                          <th className="py-1.5 pr-2">Contact</th>
                          <th className="py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catRegs.map((r) => (
                          <tr key={r.id} className="border-b border-ink-50">
                            <td className="py-1.5 pr-2 font-semibold text-ink-800">{teamName(r)}</td>
                            <td className="py-1.5 pr-2 text-ink-600">{r.club_name || '—'}</td>
                            <td className="py-1.5 pr-2 text-ink-500">{[r.player_email, r.phone].filter(Boolean).join(' · ') || '—'}</td>
                            <td className="py-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}

          <div className="mt-8 border-t border-ink-100 pt-3 text-center text-[11px] text-ink-300">Generated by DinkManager on {generatedAt}</div>
        </div>
      </div>
    </Modal>
  );
}
