import { useRef, useState } from 'react';
import { FileDown, Loader2, Printer } from 'lucide-react';
import Modal from '../ui/Modal';
import RoundRobinScoreSheet from './RoundRobinScoreSheet';
import { useToast } from '../../context/ToastContext';
import { downloadGroupedNodesAsPdf } from '../../utils/pdf';
import { matchLevelLabel } from '../../data/playoffApi';

// Preview-before-you-print step for the Round Robin score sheets: shows
// exactly what will print/download, and offers both — printing hands off to
// the separate RoundRobinScoreSheets portal (via onPrint) since that needs
// its own hidden, real @page-controlled DOM; downloading rasterizes THIS
// visible preview node directly, same as DownloadRegistrationsModal.jsx.
// `matches` spans every pool bracket in the category, already in Match List
// order (round, then bracket, then match code) — sheets are grouped under
// "Round N" banners to match, not sorted or re-grouped here.
export default function RoundRobinSheetsModal({ category, matches, onPrint, onClose }) {
  const { pushToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const paperRef = useRef(null);
  const sheetRefs = useRef([]);
  sheetRefs.current = [];

  const handleDownload = async () => {
    if (!paperRef.current || sheetRefs.current.length === 0) return;
    setDownloading(true);
    try {
      const safeName = `${category.name}_Score_Sheets`.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
      await downloadGroupedNodesAsPdf({
        containerNode: paperRef.current,
        itemNodes: sheetRefs.current,
        filename: `${safeName}.pdf`,
        pageFormat: 'legal',
      });
    } catch (e) {
      pushToast(e.message || 'Could not generate the PDF', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Score sheets — ${category.name}`} icon={Printer} maxWidth="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          {matches.length} {matches.length === 1 ? 'sheet' : 'sheets'} · grouped by round · sized to fit ~6 per legal-size page
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
          >
            <Printer size={13} /> Print
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Download PDF
          </button>
        </div>
      </div>

      {/* This is the exact node rasterized for the PDF export — kept as
          plain, high-contrast, print-safe markup (matches the print portal's
          own sheet component) so the preview, the PDF, and the printout all
          show the same thing. */}
      <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-ink-100 bg-ink-50/40 p-4">
        <div ref={paperRef} className="mx-auto flex w-full max-w-2xl flex-col bg-white p-4">
          {matches.map((m, i) => (
            <div key={m.id} ref={(el) => (sheetRefs.current[i] = el)}>
              <RoundRobinScoreSheet
                category={category}
                bracketLetter={m.bracket_letter}
                match={m}
                roundLabel={i === 0 || m.round_number !== matches[i - 1].round_number ? matchLevelLabel(m) : null}
                className={i > 0 ? 'mt-2 border-t border-dashed border-ink-300 pt-2' : ''}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
