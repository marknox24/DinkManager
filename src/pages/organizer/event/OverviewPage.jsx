import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, CheckCircle2, Gavel, LayoutGrid, Shuffle, Trophy, UserCog, Users } from 'lucide-react';
import { getEventById, listCategories, listRegistrations } from '../../../data/eventsApi';
import { useToast } from '../../../context/ToastContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import StatusBadge from '../../../components/organizer/StatusBadge';

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
        <Icon size={16} strokeWidth={2.3} />
      </span>
      <div>
        <div className="font-display text-lg font-bold leading-none text-ink-900">{value}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      </div>
    </div>
  );
}

function QuickLink({ icon: Icon, title, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon size={16} strokeWidth={2.3} />
      </span>
      <div>
        <div className="text-sm font-bold text-ink-900">{title}</div>
        <div className="mt-0.5 text-xs text-ink-500">{description}</div>
      </div>
    </button>
  );
}

export default function OverviewPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { can } = useEventAccess();
  const canSeeRegistrations = can('registrations');
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);

  useEffect(() => {
    // RLS would silently return 0 rows for a staffer without the
    // Registrations toggle — skip the call entirely rather than rendering
    // that as a misleading "0 players".
    Promise.all([getEventById(eventId), listCategories(eventId), canSeeRegistrations ? listRegistrations(eventId) : Promise.resolve([])])
      .then(([ev, cats, regs]) => {
        setEvent(ev);
        setCategories(cats);
        setRegistrations(regs);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast, canSeeRegistrations]);

  const pendingCount = registrations.filter((r) => r.status === 'pending').length;
  const approvedCount = registrations.filter((r) => r.status === 'approved').length;

  return (
    <EventWorkspaceLayout event={event}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Overview</h1>
          <p className="text-sm text-ink-500">A quick snapshot of {event?.name || 'this event'}</p>
        </div>
        {event && <StatusBadge status={event.status} />}
      </div>

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={LayoutGrid} label="Categories" value={categories.length} accent="bg-brand-50 text-brand-600" />
            <StatTile icon={Users} label="Total registrations" value={canSeeRegistrations ? registrations.length : '—'} accent="bg-sky-50 text-sky-600" />
            <StatTile icon={Activity} label="Pending review" value={canSeeRegistrations ? pendingCount : '—'} accent="bg-amber-50 text-amber-600" />
            <StatTile icon={CheckCircle2} label="Approved" value={canSeeRegistrations ? approvedCount : '—'} accent="bg-violet-50 text-violet-600" />
          </div>

          <div>
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink-500">Quick actions</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <QuickLink
                icon={UserCog}
                title="Review registrations"
                description={pendingCount > 0 ? `${pendingCount} waiting on your decision` : 'Approve, deny or remove players'}
                onClick={() => navigate(`/events/${eventId}/manage`)}
              />
              <QuickLink icon={Shuffle} title="Brackets" description="Draw brackets and record match results" onClick={() => navigate(`/events/${eventId}/brackets`)} />
              <QuickLink icon={Gavel} title="Manage umpires" description="Keep your officiating pool up to date" onClick={() => navigate(`/events/${eventId}/umpires`)} />
              <QuickLink icon={Trophy} title="Event details" description="Name, dates, categories, fees and more" onClick={() => navigate(`/events/${eventId}/edit`)} />
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
                <Shuffle size={16} strokeWidth={2.3} />
              </span>
              <div>
                <div className="text-sm font-bold text-ink-800">Live court tracking</div>
                <div className="text-xs text-ink-500">Coming next — start matches on a court with a live timer, right from the Brackets page.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </EventWorkspaceLayout>
  );
}
