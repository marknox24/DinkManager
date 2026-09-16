import { useRef, useState } from 'react';
import { FileDown, Loader2, Minus, Plus, Printer } from 'lucide-react';
import Modal from '../ui/Modal';
import RoundRobinScoreSheet from './RoundRobinScoreSheet';
import { useToast } from '../../context/ToastContext';
import { downloadGroupedNodesAsPdf } from '../../utils/pdf';

// Preview-before-you-print step for the BLANK playoff score sheet template —
// same structure as RoundRobinSheetsModal.jsx, minus the match/round data
// this one doesn't have: just a count of identical blank sheets, adjustable
// here since the organizer (not the app) knows how many Quarterfinal/
// Semifinal/Final matchups they'll actually need on the day.
export default function BlankScoreSheetsModal({ category, onPrint, onClose }) {
  const { pushToast } = useToast();
  const [count, setCount] = useState(8);
  const [downloading, setDownloading] = useState(false);
  const paperRef = useRef(null);
  const sheetRefs = useRef([]);
  sheetRefs.current = [];

  const adjustCount = (delta) => setCount((c) => Math.min(24, Math.max(1, c + delta)));

  const handleDownload = async () => {
    if (!paperRef.current || sheetRefs.current.length === 0) return;
    setDownloading(true);
    try {
      const safeName = `${category.name}_Blank_Score_Sheets`.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
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
    <Modal open onClose={onClose} title={`Blank score sheet template — ${category.name}`} icon={Printer} maxWidth="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-500">For Quarterfinals, Semifinals, and Finals — fill in both names and the stage by hand.</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Sheets</span>
            <div className="flex items-center gap-1 rounded-full border border-ink-200 bg-white px-1 py-1">
              <button
                onClick={() => adjustCount(-1)}
                disabled={count <= 1}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 disabled:opacity-30"
              >
                <Minus size={12} />
              </button>
              <span className="w-6 text-center text-sm font-bold text-ink-900">{count}</span>
              <button
                onClick={() => adjustCount(1)}
                disabled={count >= 24}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 disabled:opacity-30"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onPrint(count)}
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

      <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-ink-100 bg-ink-50/40 p-4">
        <div ref={paperRef} className="mx-auto flex w-full max-w-2xl flex-col bg-white p-4">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} ref={(el) => (sheetRefs.current[i] = el)}>
              <RoundRobinScoreSheet category={category} blank className={i > 0 ? 'mt-2 border-t border-dashed border-ink-300 pt-2' : ''} />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
