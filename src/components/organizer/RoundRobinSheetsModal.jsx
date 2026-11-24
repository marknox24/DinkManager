import { useRef, useState } from 'react';
import { FileDown, Loader2, Printer } from 'lucide-react';
import Modal from '../ui/Modal';
import RoundRobinScoreSheet from './RoundRobinScoreSheet';
import ScoreSheetV2 from './ScoreSheetV2';
import ScoreSheetTemplatePicker from './ScoreSheetTemplatePicker';
import { useToast } from '../../context/ToastContext';
import { useScoreSheetTemplate } from '../../hooks/useScoreSheetTemplate';
import { downloadGroupedNodesAsPdf } from '../../utils/pdf';
import { matchLevelLabel } from '../../data/playoffApi';

// Preview-before-you-print step for the Round Robin score sheets: shows
// exactly what will print/download, and offers both — printing hands off to
// the separate RoundRobinScoreSheets portal (via onPrint, with the chosen
// template) since that needs its own hidden, real @page-controlled DOM;
// downloading rasterizes THIS visible preview node directly, same as
// DownloadRegistrationsModal.jsx. `matches` spans every pool bracket in the
// category, already in Match List order (round, then bracket, then match
// code) — V1 groups them under "Round N" banners; V2 strips carry the round
// in their Game No. field instead, since they must stay a fixed size to fit
// three per page.
export default function RoundRobinSheetsModal({ eventName, category, matches, onPrint, onClose }) {
  const { pushToast } = useToast();
  const [template, setTemplate] = useScoreSheetTemplate();
  const [downloading, setDownloading] = useState(false);
  const paperRef = useRef(null);
  const sheetRefs = useRef([]);
  sheetRefs.current = [];
  const isV2 = template === 'v2';

  const handleDownload = async () => {
    if (!paperRef.current || sheetRefs.current.length === 0) return;
    setDownloading(true);
    try {
      const safeName = `${category.name}_Score_Sheets${isV2 ? '_V2' : ''}`.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
      await downloadGroupedNodesAsPdf({
        containerNode: paperRef.current,
        itemNodes: sheetRefs.current,
        filename: `${safeName}.pdf`,
        ...(isV2 ? { pageFormat: 'a4', marginMm: 10 } : { pageFormat: 'legal' }),
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
        <div className="min-w-0">
          <ScoreSheetTemplatePicker value={template} onChange={setTemplate} />
          <p className="mt-2 text-xs text-ink-500">
            {matches.length} {matches.length === 1 ? 'sheet' : 'sheets'} ·{' '}
            {isV2 ? 'three tear-off strips per A4 page' : 'grouped by round · sized to fit ~6 per legal-size page'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onPrint(template)}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50 active:scale-[0.97]"
          >
            <Printer size={13} /> Print
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Download PDF
          </button>
        </div>
      </div>

      {/* This is the exact node rasterized for the PDF export — kept as
          plain, high-contrast, print-safe markup (matches the print portal's
          own sheet component) so the preview, the PDF, and the printout all
          show the same thing. V2 keeps a minimum width so its fixed-shape
          strips don't crush on a phone; the box scrolls sideways instead. */}
      <div className="max-h-[65vh] overflow-auto rounded-xl border border-ink-100 bg-ink-50/40 p-4">
        <div ref={paperRef} className={`mx-auto flex w-full max-w-2xl flex-col bg-white p-4 ${isV2 ? 'min-w-[600px]' : ''}`}>
          {matches.map((m, i) => (
            <div key={m.id} ref={(el) => (sheetRefs.current[i] = el)}>
              {isV2 ? (
                <ScoreSheetV2 eventName={eventName} category={category} bracketLetter={m.bracket_letter} match={m} />
              ) : (
                <RoundRobinScoreSheet
                  category={category}
                  bracketLetter={m.bracket_letter}
                  match={m}
                  roundLabel={i === 0 || m.round_number !== matches[i - 1].round_number ? matchLevelLabel(m) : null}
                  className={i > 0 ? 'mt-2 border-t border-dashed border-ink-300 pt-2' : ''}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
