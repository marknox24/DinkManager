import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Copy,
  CreditCard,
  LifeBuoy,
  RefreshCw,
  Receipt,
  Ticket,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import AccountTypeCard from '../../components/ui/AccountTypeCard';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAdminDashboard } from '../../data/adminApi';
import { PLAN_LIMITS } from '../../data/plans';

const REQUESTS_LINK = '/admin/customers#subscription-requests';

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

// start_date is a plain 'YYYY-MM-DD' date — parsed as local so it never
// shifts a day the way new Date('2026-09-28') (UTC midnight) can.
function formatDay(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const PURCHASE_STATUS = {
  approved: { label: 'Paid', className: 'bg-brand-100 text-brand-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-600' },
};

function eventStatus(event) {
  if (!event.is_published) return { label: 'Draft', className: 'bg-ink-100 text-ink-600' };
  if (event.status === 'ongoing') return { label: 'Live', className: 'bg-rose-100 text-rose-600' };
  if (event.status === 'rescheduled') return { label: 'Rescheduled', className: 'bg-amber-100 text-amber-800' };
  return { label: 'Active', className: 'bg-brand-100 text-brand-700' };
}

const ACTIVITY_ICONS = {
  payment_received: { icon: Receipt, className: 'bg-amber-50 text-amber-600' },
  plan_upgraded: { icon: TrendingUp, className: 'bg-brand-50 text-brand-600' },
  credit_granted: { icon: Ticket, className: 'bg-brand-50 text-brand-600' },
  event_duplicated: { icon: Copy, className: 'bg-ink-100 text-ink-600' },
  player_added: { icon: UserPlus, className: 'bg-sky-50 text-sky-600' },
  event_completed: { icon: Trophy, className: 'bg-emerald-50 text-emerald-600' },
};

// admin_dashboard() folds a bulk import's run of player_added rows into one
// item with a count; a single row keeps its own message.
function activityMessage(a) {
  return a.count > 1 ? `${a.count} players ${a.verb} "${a.event_name ?? 'an event'}"` : a.message;
}

function Card({ icon: Icon, title, subtitle, action, children, id }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon size={17} strokeWidth={2.3} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">{title}</h2>
            {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>
          <Icon size={14} strokeWidth={2.4} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold tabular-nums text-ink-900 sm:text-3xl">{value}</div>
    </div>
  );
}

function AttentionTile({ count, label, to, href, hint }) {
  const muted = !count;
  const body = (
    <>
      <span
        className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 font-display text-base font-bold tabular-nums ${
          muted ? 'bg-ink-100 text-ink-400' : 'bg-amber-100 text-amber-800'
        }`}
      >
        {count ?? '—'}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-bold ${muted ? 'text-ink-500' : 'text-ink-900'}`}>{label}</span>
        {hint && <span className="block text-[11px] text-ink-400">{hint}</span>}
      </span>
    </>
  );
  const className =
    'flex items-center gap-3 rounded-xl border border-ink-100 bg-white px-3.5 py-3 text-left transition active:scale-[0.98]';
  if (to) return <Link to={to} className={`${className} hover:border-ink-200 hover:bg-ink-50`}>{body}</Link>;
  if (href) return <a href={href} className={`${className} hover:border-ink-200 hover:bg-ink-50`}>{body}</a>;
  return <div className={className}>{body}</div>;
}

function RevenueChart({ trend }) {
  const max = Math.max(1, ...trend.map((t) => Number(t.total)));
  const allZero = trend.every((t) => !Number(t.total));
  const W = 600;
  const H = 180;
  const top = 22;
  const bottom = 26;
  const slot = W / trend.length;
  const barW = Math.min(56, slot * 0.55);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue per month, last 6 months">
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} className="stroke-ink-100" strokeWidth="1" />
        {trend.map((t, i) => {
          const value = Number(t.total);
          const h = value ? Math.max(4, ((H - top - bottom) * value) / max) : 0;
          const x = i * slot + (slot - barW) / 2;
          const y = H - bottom - h;
          const [yy, mm] = t.month.split('-').map(Number);
          const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString('en-US', { month: 'short' });
          const isCurrent = i === trend.length - 1;
          return (
            <g key={t.month}>
              <title>{`${monthLabel} ${yy}: ${peso(value)}`}</title>
              {h > 0 && <rect x={x} y={y} width={barW} height={h} rx="6" className={isCurrent ? 'fill-brand-600' : 'fill-brand-300'} />}
              {value > 0 && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-ink-600 text-[11px] font-semibold">
                  {peso(value)}
                </text>
              )}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className={`text-[11px] ${isCurrent ? 'fill-ink-900 font-bold' : 'fill-ink-400'}`}>
                {monthLabel}
              </text>
            </g>
          );
        })}
      </svg>
      {allZero && <p className="mt-1 text-center text-xs text-ink-400">No approved payments in the last 6 months yet.</p>}
    </div>
  );
}

function EmptyRow({ children }) {
  return <p className="py-6 text-center text-sm text-ink-400">{children}</p>;
}

export default function AdminDashboardPage() {
  const { accountType } = useAuth();
  const { pushToast } = useToast();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(true);

  const fetchDashboard = useCallback(
    () =>
      getAdminDashboard()
        .then(setData)
        .catch((e) => pushToast(e.message, 'error'))
        .finally(() => setRefreshing(false)),
    [pushToast]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const load = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  return (
    <OrganizerLayout>
      <div className="mb-4">
        <AccountTypeCard accountType={accountType} />
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Admiral Dashboard</h1>
          <p className="text-sm text-ink-500">Revenue, event purchases and everything that needs you, across every organizer.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={refreshing}
            title="Refresh"
            className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-600 transition hover:bg-ink-50 active:scale-[0.97] disabled:opacity-60"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <Link
            to="/admin/customers"
            className="flex items-center gap-1.5 rounded-full bg-ink-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-ink-800 active:scale-[0.97]"
          >
            <Users size={13} /> Customers & payments
          </Link>
        </div>
      </div>

      {!data && <p className="text-sm text-ink-400">{refreshing ? 'Loading…' : 'Could not load the dashboard.'}</p>}

      {data && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={Wallet} label="Revenue today" value={peso(data.revenue_today)} accent="bg-brand-50 text-brand-600" />
            <KpiCard icon={TrendingUp} label="Revenue MTD" value={peso(data.revenue_mtd)} accent="bg-brand-50 text-brand-600" />
            <KpiCard icon={BadgeCheck} label="Paid events" value={data.paid_events} accent="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={Activity} label="Active events" value={data.active_events} accent="bg-sky-50 text-sky-600" />
          </div>

          <Card icon={AlertTriangle} title="Needs your attention">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <AttentionTile count={data.attention.payment_approvals} label="Payment approvals" hint="New paid events" to={REQUESTS_LINK} />
              <AttentionTile count={data.attention.upgrade_requests} label="Upgrade requests" hint="Paid events moving up a tier" to={REQUESTS_LINK} />
              <AttentionTile count={data.attention.upcoming_events} label="Upcoming events" hint="Starting in the next 7 days" href="#upcoming-events" />
              <AttentionTile count={null} label="Account issues" hint="Support tickets coming soon" />
            </div>
          </Card>

          <Card
            icon={CreditCard}
            title="Recent event purchases"
            action={
              <Link to={REQUESTS_LINK} className="shrink-0 text-xs font-bold text-brand-600 hover:text-brand-700">
                View all →
              </Link>
            }
          >
            {data.recent_purchases.length === 0 ? (
              <EmptyRow>No purchases yet.</EmptyRow>
            ) : (
              <div className="flex flex-col divide-y divide-ink-100">
                <div className="hidden grid-cols-[1.6fr_1.2fr_0.8fr_0.8fr_0.7fr] gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400 sm:grid">
                  <span>Event</span>
                  <span>Organizer</span>
                  <span>Plan</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Status</span>
                </div>
                {data.recent_purchases.map((p) => {
                  const status = PURCHASE_STATUS[p.status] ?? PURCHASE_STATUS.pending;
                  return (
                    <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-2.5 sm:grid-cols-[1.6fr_1.2fr_0.8fr_0.8fr_0.7fr]">
                      <span className="truncate text-sm font-semibold text-ink-900">{p.event_name ?? <span className="text-ink-400">Account credit</span>}</span>
                      <span className="order-last col-span-2 truncate text-xs text-ink-500 sm:order-none sm:col-span-1 sm:text-sm sm:text-ink-600">
                        {p.organizer}
                        <span className="sm:hidden"> · {PLAN_LIMITS[p.plan]?.label ?? p.plan}</span>
                      </span>
                      <span className="hidden text-sm text-ink-600 sm:block">{PLAN_LIMITS[p.plan]?.label ?? p.plan}</span>
                      <span className="hidden text-right text-sm font-semibold tabular-nums text-ink-900 sm:block">
                        {peso(p.amount ?? PLAN_LIMITS[p.plan]?.price)}
                      </span>
                      <span className="flex items-center justify-end gap-2">
                        <span className="text-sm font-semibold tabular-nums text-ink-900 sm:hidden">{peso(p.amount ?? PLAN_LIMITS[p.plan]?.price)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <Card icon={CalendarDays} title="Upcoming events" id="upcoming-events">
              {data.upcoming_events.length === 0 ? (
                <EmptyRow>No upcoming events with a start date.</EmptyRow>
              ) : (
                <div className="flex flex-col divide-y divide-ink-100">
                  {data.upcoming_events.map((e) => {
                    const status = eventStatus(e);
                    return (
                      <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          {e.is_published ? (
                            <Link to={`/e/${e.slug}`} className="block truncate text-sm font-semibold text-ink-900 hover:text-brand-600">
                              {e.name}
                            </Link>
                          ) : (
                            <span className="block truncate text-sm font-semibold text-ink-900">{e.name}</span>
                          )}
                          <span className="block truncate text-xs text-ink-500">
                            {e.organizer ?? '—'} · {PLAN_LIMITS[e.plan]?.label ?? e.plan}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs font-semibold tabular-nums text-ink-600">{formatDay(e.start_date)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card
              icon={LifeBuoy}
              title="Account issues"
              action={
                <button
                  disabled
                  title="Coming soon"
                  className="shrink-0 cursor-not-allowed rounded-full border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-400"
                >
                  View Support Center
                </button>
              }
            >
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center">
                <LifeBuoy size={22} className="text-ink-300" />
                <p className="text-sm font-semibold text-ink-600">Support tickets are coming soon</p>
                <p className="max-w-xs text-xs text-ink-400">Organizer-reported payment, access and login issues will show up here.</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card icon={TrendingUp} title="Revenue trend" subtitle="Approved payments per month">
              <RevenueChart trend={data.revenue_trend} />
            </Card>

            <Card icon={Activity} title="Recent activity">
              {data.recent_activity.length === 0 ? (
                <EmptyRow>Nothing yet.</EmptyRow>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.recent_activity.map((a) => {
                    const { icon: Icon, className } = ACTIVITY_ICONS[a.kind] ?? ACTIVITY_ICONS.payment_received;
                    return (
                      <li key={a.id} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${className}`}>
                          <Icon size={13} strokeWidth={2.4} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm leading-snug text-ink-800">{activityMessage(a)}</p>
                          <p className="text-[11px] text-ink-400">{timeAgo(a.created_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </OrganizerLayout>
  );
}
