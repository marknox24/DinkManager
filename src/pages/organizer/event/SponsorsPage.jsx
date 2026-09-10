import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { createSponsor, deleteSponsor, getEventById, getEventMediaUrl, listSponsors, updateSponsor } from '../../../data/eventsApi';
import { SPONSOR_TIERS } from '../../../data/constants';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import SponsorFormModal from '../../../components/organizer/SponsorFormModal';

const TIER_ORDER = ['gold', 'silver', 'bronze', 'regular'];

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

export default function SponsorsPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const confirm = useConfirm();

  const [event, setEvent] = useState(null);
  const [sponsors, setSponsors] = useState(null);
  const [sponsorModal, setSponsorModal] = useState(null); // 'new' | { sponsor } | null

  const money = (n) => formatMoney(n, event?.currency);

  const reload = useCallback(async () => {
    try {
      const [ev, sponsorsData] = await Promise.all([getEventById(eventId), listSponsors(eventId)]);
      setEvent(ev);
      setSponsors(sponsorsData);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveSponsor = async (payload) => {
    if (sponsorModal?.sponsor) {
      const saved = await updateSponsor(sponsorModal.sponsor.id, payload);
      setSponsors((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    } else {
      const created = await createSponsor(eventId, payload, (sponsors || []).length);
      setSponsors((prev) => [...prev, created]);
    }
  };

  const removeSponsor = async (sponsor) => {
    const ok = await confirm({
      title: `Remove "${sponsor.name}"?`,
      message: 'This removes them from the Preview Screen sponsor strip.',
      confirmLabel: 'Remove sponsor',
    });
    if (!ok) return;
    try {
      await deleteSponsor(sponsor.id);
      setSponsors((prev) => prev.filter((s) => s.id !== sponsor.id));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const totalAmount = useMemo(() => (sponsors || []).reduce((sum, s) => sum + Number(s.amount), 0), [sponsors]);

  const tierBreakdown = useMemo(() => {
    return TIER_ORDER.map((tier) => ({
      tier,
      count: (sponsors || []).filter((s) => s.tier === tier).length,
      total: (sponsors || []).filter((s) => s.tier === tier).reduce((sum, s) => sum + Number(s.amount), 0),
    })).filter((t) => t.count > 0);
  }, [sponsors]);

  const sortedSponsors = useMemo(() => {
    return [...(sponsors || [])].sort((a, b) => {
      const tierDiff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
      if (tierDiff !== 0) return tierDiff;
      return Number(b.amount) - Number(a.amount);
    });
  }, [sponsors]);

  const loading = sponsors === null;

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Sponsors</h1>
        <p className="text-sm text-ink-500">Logos auto-loop at the bottom of the Preview Screen for this event.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <div className="flex flex-col gap-4">
          <SummaryCard
            icon={Award}
            label="Total sponsorship"
            value={money(totalAmount)}
            tone={{ iconBg: 'bg-brand-50', iconText: 'text-brand-600', text: 'text-ink-900' }}
          />

          {tierBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tierBreakdown.map(({ tier, count, total }) => (
                <span key={tier} className="flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600">
                  <span className={`h-1.5 w-1.5 rounded-full ${SPONSOR_TIERS[tier].dot}`} />
                  {SPONSOR_TIERS[tier].label} ({count}) · <span className="font-bold text-ink-900">{money(total)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink-800">Sponsors</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500 ring-1 ring-ink-200">
                  {sponsors.length}
                </span>
              </div>
              <button
                onClick={() => setSponsorModal('new')}
                className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
              >
                <Plus size={13} /> Add sponsor
              </button>
            </div>
            {sponsors.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-ink-400">No sponsors yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                      <th className="px-4 py-2.5 text-left">Sponsor</th>
                      <th className="px-4 py-2.5 text-left">Tier</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSponsors.map((s) => (
                      <tr key={s.id} className="border-b border-ink-50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {s.logo_path ? (
                              <img src={getEventMediaUrl(s.logo_path)} alt="" className="h-8 w-8 rounded-lg border border-ink-200 bg-white object-contain p-1" />
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-50 text-ink-300">
                                <Award size={14} />
                              </span>
                            )}
                            <span className="font-semibold text-ink-800">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${SPONSOR_TIERS[s.tier].badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${SPONSOR_TIERS[s.tier].dot}`} />
                            {SPONSOR_TIERS[s.tier].label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink-900">{money(s.amount)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setSponsorModal({ sponsor: s })}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => removeSponsor(s)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-ink-500 hover:bg-ink-200"
                              title="Remove"
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

      {sponsorModal && (
        <SponsorFormModal
          eventId={eventId}
          sponsor={sponsorModal === 'new' ? null : sponsorModal.sponsor}
          onSave={saveSponsor}
          onClose={() => setSponsorModal(null)}
        />
      )}
    </EventWorkspaceLayout>
  );
}
