import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, ClipboardList, History, Plus } from 'lucide-react';
import { listCategories, listRegistrations } from '../../../data/eventsApi';
import { listTransfers, setTransferSheetStatus } from '../../../data/transfersApi';
import { useToast } from '../../../context/ToastContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import { useOrganizerLiveSync } from '../../../hooks/useOrganizerLiveSync';
import { useOnlineOnlyGuard } from '../../../hooks/useConnectivity';
import { teamLabel } from '../../../utils/match';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import TransferBadge from '../../../components/organizer/TransferBadge';
import TransferPlayerModal from '../../../components/organizer/TransferPlayerModal';

// Event-day category transfers (sandbagging): who moved where, and the
// matches each transfer added. Score sheets are usually printed before the
// event, so the first section is the to-do list of sheets still to make by
// hand, with a status the whole team can see.
const SHEET_STATUSES = [
  { id: 'pending', short: 'Pending', label: 'Pending score sheet preparation', on: 'bg-amber-500 text-white', text: 'text-amber-700' },
  { id: 'prepared', short: 'Prepared', label: 'Score sheet prepared', on: 'bg-sky-600 text-white', text: 'text-sky-700' },
  { id: 'ready', short: 'Ready', label: 'Ready for tournament', on: 'bg-emerald-600 text-white', text: 'text-emerald-700' },
];

const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function matchState(m) {
  if (m.status === 'in_progress') return { text: 'Live', tone: 'bg-rose-50 text-rose-600' };
  if (m.status === 'completed') return { text: m.score_a != null ? `${m.score_a}–${m.score_b}` : 'Done', tone: 'bg-ink-100 text-ink-600' };
  if (m.status === 'canceled') return { text: 'Canceled', tone: 'bg-ink-100 text-ink-400' };
  return { text: 'Scheduled', tone: 'bg-ink-100 text-ink-500' };
}

function SheetStatusControl({ value, disabled, onChange }) {
  return (
    <div className="flex rounded-full bg-ink-100 p-0.5" role="radiogroup" aria-label="Score sheet status">
      {SHEET_STATUSES.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          title={s.label}
          disabled={disabled}
          onClick={() => value !== s.id && onChange(s.id)}
          className={`flex-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition active:scale-[0.97] disabled:cursor-not-allowed ${
            value === s.id ? s.on : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          {s.short}
        </button>
      ))}
    </div>
  );
}

function SheetCard({ transfer, canEdit, onStatus }) {
  const status = SHEET_STATUSES.find((s) => s.id === transfer.sheet_status) ?? SHEET_STATUSES[0];
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
            {teamLabel({ player1_name: transfer.player_label })}
            <TransferBadge />
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            Now in <strong className="text-ink-700">{transfer.to_category}{transfer.to_bracket ? ` · Bracket ${transfer.to_bracket}` : ''}</strong>
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <SheetStatusControl value={transfer.sheet_status} disabled={!canEdit} onChange={(s) => onStatus(transfer, s)} />
          <p className={`mt-1 text-right text-[11px] font-semibold ${status.text}`}>{status.label}</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
        {transfer.matches.map((m) => {
          const state = matchState(m);
          return (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-10 shrink-0 text-xs font-bold tabular-nums text-ink-700">{m.match_code}</span>
              <span className="min-w-0 flex-1 text-sm text-ink-800">
                {teamLabel(m.team_a)} <span className="text-ink-400">vs</span> {teamLabel(m.team_b)}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${state.tone}`}>{state.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function TransfersPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const { event, isOwner, can } = useEventAccess();
  const blockIfOffline = useOnlineOnlyGuard();
  const [transfers, setTransfers] = useState(null);
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [transferOpen, setTransferOpen] = useState(false);

  const locked = event?.status === 'finished';
  const canTransfer = (isOwner || can('redraw_brackets')) && !locked;
  const canEditSheets = (isOwner || can('brackets') || can('matchlist')) && !locked;

  const reload = useCallback(
    () =>
      listTransfers(eventId)
        .then(setTransfers)
        .catch((e) => {
          setTransfers((prev) => prev ?? []);
          pushToast(e.message, 'error');
        }),
    [eventId, pushToast]
  );

  useEffect(() => {
    reload();
    listCategories(eventId)
      .then(setCategories)
      .catch(() => {});
  }, [eventId, reload]);

  // Match statuses on the sheet cards follow play.
  useOrganizerLiveSync({ categoryIds: categories.map((c) => c.id), paused: false, onChange: reload });

  const openTransfer = async () => {
    if (blockIfOffline()) return;
    try {
      setRegistrations(await listRegistrations(eventId));
      setTransferOpen(true);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const changeStatus = async (transfer, status) => {
    if (blockIfOffline()) return;
    const previous = transfer.sheet_status;
    setTransfers((prev) => prev.map((t) => (t.id === transfer.id ? { ...t, sheet_status: status } : t)));
    try {
      await setTransferSheetStatus(transfer.id, status);
    } catch (e) {
      setTransfers((prev) => prev.map((t) => (t.id === transfer.id ? { ...t, sheet_status: previous } : t)));
      pushToast(e.message, 'error');
    }
  };

  const withSheets = useMemo(() => (transfers ?? []).filter((t) => t.matches.length > 0), [transfers]);
  const notReady = withSheets.filter((t) => t.sheet_status !== 'ready').length;
  const sheetsToMake = withSheets.filter((t) => t.sheet_status === 'pending').reduce((n, t) => n + t.matches.length, 0);

  return (
    <EventWorkspaceLayout event={event}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Transfers</h1>
          <p className="text-sm text-ink-500">Players moved to another category on event day</p>
        </div>
        {canTransfer && (
          <button
            onClick={openTransfer}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97]"
          >
            <Plus size={16} /> Transfer a player
          </button>
        )}
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ClipboardList size={17} strokeWidth={2.3} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-ink-900">Transferred Players – Additional Score Sheets Required</h2>
              <p className="text-xs text-ink-500">
                {transfers === null
                  ? 'Loading…'
                  : withSheets.length === 0
                    ? 'No extra score sheets needed yet.'
                    : notReady === 0
                      ? 'All extra score sheets are ready.'
                      : `${notReady} of ${withSheets.length} not ready${sheetsToMake ? ` · ${sheetsToMake} ${sheetsToMake === 1 ? 'sheet' : 'sheets'} still to prepare` : ''}`}
              </p>
            </div>
          </div>
          {transfers !== null && withSheets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 px-6 py-10 text-center">
              <ArrowLeftRight size={22} className="mx-auto text-ink-300" />
              <p className="mt-2 text-sm font-semibold text-ink-600">No transfers with new matches</p>
              <p className="mt-1 text-xs text-ink-400">
                When a player moves into a bracket that already has a matchlist, their new matches appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {withSheets.map((t) => (
                <SheetCard key={t.id} transfer={t} canEdit={canEditSheets} onStatus={changeStatus} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
              <History size={17} strokeWidth={2.3} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink-900">Transfer log</h2>
              <p className="text-xs text-ink-500">Every transfer, newest first</p>
            </div>
          </div>
          {transfers !== null && transfers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-200 px-6 py-6 text-center text-sm text-ink-500">No transfers yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
              {(transfers ?? []).map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-bold text-ink-900">{teamLabel({ player1_name: t.player_label })}</p>
                    <p className="text-xs text-ink-400">{when(t.created_at)}</p>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
                    <span>
                      {t.from_category}
                      {t.from_bracket ? ` · ${t.from_bracket}` : ''}
                    </span>
                    <ArrowRight size={12} className="shrink-0 text-amber-600" />
                    <span className="font-semibold text-ink-800">
                      {t.to_category}
                      {t.to_bracket ? ` · ${t.to_bracket}` : ' (not drawn yet)'}
                    </span>
                    {t.assignment === 'random' && (
                      <span className="rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-bold uppercase text-violet-700">Random</span>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-400">
                    {t.actor_email ? `By ${t.actor_email}` : 'By an organizer'}
                    {t.walkovers ? ` · ${t.walkovers} ${t.walkovers === 1 ? 'walkover' : 'walkovers'} in the old bracket` : ''}
                    {t.matches.length ? ` · ${t.matches.length} new ${t.matches.length === 1 ? 'match' : 'matches'}` : ''}
                  </p>
                  {t.reason && <p className="mt-1 text-xs italic text-ink-600">“{t.reason}”</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {transferOpen && (
        <TransferPlayerModal
          registrations={registrations}
          categories={categories}
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            reload();
          }}
        />
      )}
    </EventWorkspaceLayout>
  );
}
