import { useRef, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import Modal from '../ui/Modal';
import Logo from '../ui/Logo';
import { useToast } from '../../context/ToastContext';
import { downloadNodeAsPdf } from '../../utils/pdf';

function formatDateRange(start, end) {
  if (!start && !end) return null;
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// A single "line" row shared by both the earnings and expenses tables — kept
// as one component so every row in the printed report lines up identically.
function LineRow({ label, sublabel, meta, amount, money, bold }) {
  return (
    <tr className={bold ? 'border-t-2 border-ink-800' : 'border-b border-ink-100'}>
      <td className={`py-2.5 pr-3 ${bold ? 'font-bold text-ink-900' : 'text-ink-700'}`}>
        {label}
        {sublabel && <div className="text-xs font-normal text-ink-400">{sublabel}</div>}
      </td>
      <td className="py-2.5 pr-3 text-right text-xs text-ink-400">{meta}</td>
      <td className={`py-2.5 text-right font-mono ${bold ? 'text-base font-extrabold text-ink-900' : 'text-sm font-semibold text-ink-800'}`}>
        {money(amount)}
      </td>
    </tr>
  );
}

export default function AccountingReportModal({
  event,
  expenses,
  earnings,
  registrationEarnings,
  sponsors,
  includeSponsors,
  totals,
  money,
  onClose,
}) {
  const { pushToast } = useToast();
  const paperRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const dateRange = formatDateRange(event?.start_date, event?.end_date);
  const generatedAt = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const registrationRows = registrationEarnings.filter((r) => r.total > 0);
  const expensesByCategory = Object.entries(
    expenses.reduce((map, e) => {
      const key = e.category || 'Other';
      map[key] = (map[key] || 0) + Number(e.amount);
      return map;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const safeName = (event?.name || 'Event').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
      await downloadNodeAsPdf(paperRef.current, `${safeName}_Financial_Report.pdf`);
    } catch (e) {
      pushToast(e.message || 'Could not generate the PDF', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Financial report" icon={FileText} maxWidth="max-w-3xl">
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          <Download size={14} /> {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </button>
      </div>

      {/* This is the exact node rasterized into the PDF — kept as plain,
          high-contrast, print-safe markup (no gradients/blurs) so it reads
          the same on screen and on paper. */}
      <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-ink-100 bg-ink-50/40 p-4">
        <div ref={paperRef} className="mx-auto w-full max-w-2xl bg-white p-8 text-ink-900">
          <div className="flex items-start justify-between border-b-2 border-ink-900 pb-4">
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <div className="font-display text-base font-extrabold">DinkManager</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-400">Financial Report</div>
              <div className="text-xs text-ink-400">Generated {generatedAt}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="font-display text-2xl font-extrabold text-ink-900">{event?.name}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink-500">
              {dateRange && <span>{dateRange}</span>}
              {event?.location_address && <span>{event.location_address}</span>}
              <span>Currency: {event?.currency || 'USD'}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-ink-200 p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Total earnings</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-ink-900">{money(totals.earnings)}</div>
            </div>
            <div className="rounded-xl border border-ink-200 p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Total expenses</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-ink-900">{money(totals.expenses)}</div>
            </div>
            <div className={`rounded-xl border-2 p-3.5 text-center ${totals.net >= 0 ? 'border-emerald-600' : 'border-rose-600'}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Net</div>
              <div className={`mt-1 font-mono text-lg font-extrabold ${totals.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {money(totals.net)}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-900">Earnings</div>
            <table className="w-full text-sm">
              <tbody>
                {registrationRows.length === 0 && (!includeSponsors || sponsors.length === 0) && earnings.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-ink-400">No earnings recorded.</td>
                  </tr>
                ) : (
                  <>
                    {registrationRows.map((r) => (
                      <LineRow
                        key={r.category_id}
                        label={r.category_name}
                        sublabel={`${r.approved_count} paid registration${r.approved_count === 1 ? '' : 's'} × ${money(r.fee_amount)}`}
                        meta="Registrations"
                        amount={r.total}
                        money={money}
                      />
                    ))}
                    {includeSponsors &&
                      sponsors.map((s) => (
                        <LineRow key={s.id} label={s.name} sublabel={s.tier} meta="Sponsorship" amount={s.amount} money={money} />
                      ))}
                    {earnings.map((e) => (
                      <LineRow key={e.id} label={e.name} sublabel={formatDate(e.earning_date)} meta="Manual" amount={e.amount} money={money} />
                    ))}
                    <LineRow label="Total earnings" amount={totals.earnings} money={money} bold />
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-extrabold uppercase tracking-wide text-ink-900">Expenses</div>
              {expensesByCategory.length > 0 && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {expensesByCategory.map(([cat, total]) => (
                    <span key={cat} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                      {cat}: {money(total)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-ink-400">No expenses recorded.</td>
                  </tr>
                ) : (
                  <>
                    {expenses.map((e) => (
                      <LineRow
                        key={e.id}
                        label={e.name}
                        sublabel={formatDate(e.expense_date)}
                        meta={e.category || '—'}
                        amount={e.amount}
                        money={money}
                      />
                    ))}
                    <LineRow label="Total expenses" amount={totals.expenses} money={money} bold />
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div
            className={`mt-8 flex items-center justify-between rounded-xl px-5 py-4 ${
              totals.net >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
            }`}
          >
            <span className="text-sm font-bold uppercase tracking-wide">Net result</span>
            <span className="font-mono text-xl font-extrabold">{money(totals.net)}</span>
          </div>

          <div className="mt-8 border-t border-ink-100 pt-3 text-center text-[11px] text-ink-300">
            Generated by DinkManager on {generatedAt}
          </div>
        </div>
      </div>
    </Modal>
  );
}
