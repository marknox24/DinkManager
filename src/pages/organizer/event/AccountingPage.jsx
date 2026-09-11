import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, Download, FileText, Pencil, Plus, Sparkles, TrendingDown, TrendingUp, Trash2, Wallet } from 'lucide-react';
import {
  createEarning,
  createExpense,
  deleteEarning,
  deleteExpense,
  getEventById,
  getRegistrationEarnings,
  listEarnings,
  listExpenses,
  listSponsors,
  updateEarning,
  updateEvent,
  updateExpense,
} from '../../../data/eventsApi';
import { exportAccountingToExcel } from '../../../utils/excel';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import ExpenseFormModal from '../../../components/organizer/ExpenseFormModal';
import EarningFormModal from '../../../components/organizer/EarningFormModal';
import ReceiptThumbnail from '../../../components/organizer/ReceiptThumbnail';
import AccountingReportModal from '../../../components/organizer/AccountingReportModal';
import Switch from '../../../components/ui/Switch';

// Intl handles the symbol/placement for whatever ISO code the event's
// currency setting holds (₱, €, ¥, etc.) — falls back to a plain $-prefixed
// number if the stored code is ever invalid.
function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount) || 0);
  } catch {
    return `$${(Number(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.iconBg} ${tone.iconText}`}>
        <Icon size={18} strokeWidth={2.3} />
      </span>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</div>
        <div className={`font-display text-xl font-bold ${tone.text}`}>{value}</div>
      </div>
    </div>
  );
}

export default function AccountingPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const confirm = useConfirm();

  const [event, setEvent] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [registrationEarnings, setRegistrationEarnings] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [tab, setTab] = useState('expenses');
  const [expenseModal, setExpenseModal] = useState(null); // { expense } | 'new' | null
  const [earningModal, setEarningModal] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const money = (n) => formatMoney(n, event?.currency);

  const reload = useCallback(async () => {
    try {
      const [ev, exp, earn, regEarn, sponsorsData] = await Promise.all([
        getEventById(eventId),
        listExpenses(eventId),
        listEarnings(eventId),
        getRegistrationEarnings(eventId),
        listSponsors(eventId),
      ]);
      setEvent(ev);
      setExpenses(exp);
      setEarnings(earn);
      setRegistrationEarnings(regEarn);
      setSponsors(sponsorsData);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const includeSponsors = Boolean(event?.include_sponsors_in_earnings);

  const toggleIncludeSponsors = async () => {
    const next = !includeSponsors;
    setEvent((prev) => ({ ...prev, include_sponsors_in_earnings: next })); // optimistic
    try {
      await updateEvent(eventId, { include_sponsors_in_earnings: next });
    } catch (e) {
      setEvent((prev) => ({ ...prev, include_sponsors_in_earnings: !next })); // revert on failure
      pushToast(e.message, 'error');
    }
  };

  const totalExpenses = useMemo(() => (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0), [expenses]);
  const totalRegistrationEarnings = useMemo(() => registrationEarnings.reduce((sum, r) => sum + r.total, 0), [registrationEarnings]);
  const totalManualEarnings = useMemo(() => (earnings || []).reduce((sum, e) => sum + Number(e.amount), 0), [earnings]);
  const totalSponsorship = useMemo(() => sponsors.reduce((sum, s) => sum + Number(s.amount), 0), [sponsors]);
  const totalEarnings = totalRegistrationEarnings + totalManualEarnings + (includeSponsors ? totalSponsorship : 0);
  const net = totalEarnings - totalExpenses;

  const expensesByCategory = useMemo(() => {
    const map = {};
    (expenses || []).forEach((e) => {
      const key = e.category || 'Other';
      map[key] = (map[key] || 0) + Number(e.amount);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const saveExpense = async (payload) => {
    if (expenseModal?.expense) {
      const saved = await updateExpense(expenseModal.expense.id, payload);
      setExpenses((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
    } else {
      const created = await createExpense(eventId, payload);
      setExpenses((prev) => [created, ...prev]);
    }
  };

  const removeExpense = async (expense) => {
    const ok = await confirm({ title: `Delete "${expense.name}"?`, message: 'This expense will be removed permanently.', confirmLabel: 'Delete expense' });
    if (!ok) return;
    try {
      await deleteExpense(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const saveEarning = async (payload) => {
    if (earningModal?.earning) {
      const saved = await updateEarning(earningModal.earning.id, payload);
      setEarnings((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
    } else {
      const created = await createEarning(eventId, payload);
      setEarnings((prev) => [created, ...prev]);
    }
  };

  const removeEarning = async (earning) => {
    const ok = await confirm({ title: `Delete "${earning.name}"?`, message: 'This earning will be removed permanently.', confirmLabel: 'Delete earning' });
    if (!ok) return;
    try {
      await deleteEarning(earning.id);
      setEarnings((prev) => prev.filter((e) => e.id !== earning.id));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleDownload = () => {
    exportAccountingToExcel({
      eventName: event?.name,
      expenses: expenses || [],
      manualEarnings: earnings || [],
      registrationEarnings,
      sponsorEarnings: includeSponsors ? sponsors : [],
      totals: { earnings: totalEarnings, expenses: totalExpenses, net },
    });
  };

  const loading = expenses === null || earnings === null;

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Accounting</h1>
          <p className="text-sm text-ink-500">Track expenses and earnings, and export a report for this event.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReportOpen(true)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            <FileText size={14} /> Financial report (PDF)
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-bold text-ink-600 shadow-sm transition hover:bg-ink-100 disabled:opacity-50"
          >
            <Download size={14} /> Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={TrendingUp}
              label="Total earnings"
              value={money(totalEarnings)}
              tone={{ iconBg: 'bg-brand-50', iconText: 'text-brand-600', text: 'text-ink-900' }}
            />
            <SummaryCard
              icon={TrendingDown}
              label="Total expenses"
              value={money(totalExpenses)}
              tone={{ iconBg: 'bg-rose-50', iconText: 'text-rose-500', text: 'text-ink-900' }}
            />
            <SummaryCard
              icon={Wallet}
              label="Net"
              value={money(net)}
              tone={{
                iconBg: net >= 0 ? 'bg-emerald-50' : 'bg-rose-50',
                iconText: net >= 0 ? 'text-emerald-600' : 'text-rose-500',
                text: net >= 0 ? 'text-emerald-700' : 'text-rose-600',
              }}
            />
          </div>

          <div className="mb-5 inline-flex rounded-full border border-ink-200 bg-white p-1 shadow-sm">
            {[
              { id: 'expenses', label: 'Expenses' },
              { id: 'earnings', label: 'Earnings' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                  tab === t.id ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'expenses' && (
            <div className="flex flex-col gap-4">
              {expensesByCategory.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {expensesByCategory.map(([cat, total]) => (
                    <span key={cat} className="rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600">
                      {cat} · <span className="font-bold text-ink-900">{money(total)}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink-800">Expenses</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500 ring-1 ring-ink-200">
                      {expenses.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpenseModal('new')}
                    className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
                  >
                    <Plus size={13} /> Add expense
                  </button>
                </div>
                {expenses.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-ink-400">No expenses recorded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                          <th className="px-4 py-2.5 text-left">Name</th>
                          <th className="px-4 py-2.5 text-left">Category</th>
                          <th className="px-4 py-2.5 text-left">Date</th>
                          <th className="px-4 py-2.5 text-right">Amount</th>
                          <th className="px-4 py-2.5 text-center">Receipt</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((e) => (
                          <tr key={e.id} className="border-b border-ink-50">
                            <td className="px-4 py-2.5 font-semibold text-ink-800">{e.name}</td>
                            <td className="px-4 py-2.5 text-ink-500">{e.category || '—'}</td>
                            <td className="px-4 py-2.5 text-ink-500">{formatDate(e.expense_date)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink-900">{money(e.amount)}</td>
                            <td className="px-4 py-2.5 text-center">
                              <ReceiptThumbnail path={e.receipt_path} />
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setExpenseModal({ expense: e })}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100"
                                  title="Edit"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => removeExpense(e)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-ink-500 hover:bg-ink-200"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'earnings' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Award size={17} strokeWidth={2.3} />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-ink-800">Include sponsors in earnings</div>
                    <div className="text-xs text-ink-500">Adds sponsorship amounts from the Sponsors page into Total earnings above.</div>
                  </div>
                </div>
                <Switch checked={includeSponsors} onChange={toggleIncludeSponsors} />
              </div>

              {includeSponsors && (
                <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Award size={14} className="text-brand-500" />
                      <span className="text-sm font-bold text-ink-800">From sponsors</span>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">AUTO</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-ink-900">{money(totalSponsorship)}</span>
                  </div>
                  {sponsors.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-ink-400">No sponsors added yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[400px] text-sm">
                        <thead>
                          <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                            <th className="px-4 py-2.5 text-left">Sponsor</th>
                            <th className="px-4 py-2.5 text-left">Tier</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sponsors.map((s) => (
                            <tr key={s.id} className="border-b border-ink-50">
                              <td className="px-4 py-2.5 font-semibold text-ink-800">{s.name}</td>
                              <td className="px-4 py-2.5 text-ink-500 capitalize">{s.tier}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink-900">{money(s.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-brand-500" />
                    <span className="text-sm font-bold text-ink-800">From registrations</span>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">AUTO</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-ink-900">{money(totalRegistrationEarnings)}</span>
                </div>
                {registrationEarnings.every((r) => r.total === 0) ? (
                  <div className="px-5 py-8 text-center text-sm text-ink-400">No paid registrations yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                          <th className="px-4 py-2.5 text-left">Category</th>
                          <th className="px-4 py-2.5 text-center">Paid registrations</th>
                          <th className="px-4 py-2.5 text-right">Fee</th>
                          <th className="px-4 py-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrationEarnings
                          .filter((r) => r.total > 0)
                          .map((r) => (
                            <tr key={r.category_id} className="border-b border-ink-50">
                              <td className="px-4 py-2.5 font-semibold text-ink-800">{r.category_name}</td>
                              <td className="px-4 py-2.5 text-center text-ink-500">{r.approved_count}</td>
                              <td className="px-4 py-2.5 text-right text-ink-500">{money(r.fee_amount)}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink-900">{money(r.total)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink-800">Manual earnings</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500 ring-1 ring-ink-200">
                      {earnings.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setEarningModal('new')}
                    className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
                  >
                    <Plus size={13} /> Add earning
                  </button>
                </div>
                {earnings.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-ink-400">No manual earnings recorded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                          <th className="px-4 py-2.5 text-left">Description</th>
                          <th className="px-4 py-2.5 text-left">Date</th>
                          <th className="px-4 py-2.5 text-right">Amount</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earnings.map((e) => (
                          <tr key={e.id} className="border-b border-ink-50">
                            <td className="px-4 py-2.5 font-semibold text-ink-800">{e.name}</td>
                            <td className="px-4 py-2.5 text-ink-500">{formatDate(e.earning_date)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink-900">{money(e.amount)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setEarningModal({ earning: e })}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100"
                                  title="Edit"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => removeEarning(e)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-ink-500 hover:bg-ink-200"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {expenseModal && (
        <ExpenseFormModal
          eventId={eventId}
          expense={expenseModal === 'new' ? null : expenseModal.expense}
          onSave={saveExpense}
          onClose={() => setExpenseModal(null)}
        />
      )}
      {earningModal && (
        <EarningFormModal earning={earningModal === 'new' ? null : earningModal.earning} onSave={saveEarning} onClose={() => setEarningModal(null)} />
      )}
      {reportOpen && (
        <AccountingReportModal
          event={event}
          expenses={expenses || []}
          earnings={earnings || []}
          registrationEarnings={registrationEarnings}
          sponsors={sponsors}
          includeSponsors={includeSponsors}
          totals={{ earnings: totalEarnings, expenses: totalExpenses, net }}
          money={money}
          onClose={() => setReportOpen(false)}
        />
      )}
    </EventWorkspaceLayout>
  );
}
