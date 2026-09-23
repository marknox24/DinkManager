import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass } from '../ui/FormField';
import Select from '../ui/Select';
import { downloadPlayersTemplate, parsePlayersWorkbook } from '../../utils/excel';
import { useToast } from '../../context/ToastContext';

export default function ImportPlayersModal({ categories, defaultCategoryId, onImport, onClose }) {
  const { pushToast } = useToast();
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categories[0]?.id || '');
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parsePlayersWorkbook(buf);
      setRows(parsed);
    } catch (e) {
      pushToast(e.message, 'error');
      setRows([]);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0 || !categoryId) return;
    setImporting(true);
    try {
      await onImport(categoryId, rows);
      onClose();
    } catch {
      // The parent already surfaced why (toast or upgrade prompt); stay open
      // so the organizer can pick a different category or file.
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Import players from Excel" icon={FileSpreadsheet} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <button
          onClick={downloadPlayersTemplate}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 px-4 py-2.5 text-xs font-bold text-ink-600 transition hover:border-brand-400"
        >
          <Download size={14} /> Download template (.xlsx)
        </button>

        <FormField label="Import into category">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.match_type})
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Filled template" hint="Player 1 Name is required; Player 2, Club, Email and Phone are optional">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-3.5 py-3 text-xs font-semibold text-ink-500 transition hover:border-brand-400">
            {fileName || 'Choose .xlsx file'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
        </FormField>

        {fileName && (
          <p className={`text-xs font-semibold ${rows.length > 0 ? 'text-brand-600' : 'text-rose-600'}`}>
            {rows.length > 0
              ? `Found ${rows.length} player${rows.length > 1 ? 's' : ''} — approved automatically on import.`
              : 'No valid rows found — make sure "Player 1 Name" is filled in.'}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={rows.length === 0 || importing}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {importing ? 'Importing…' : `Import ${rows.length || ''} player${rows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
