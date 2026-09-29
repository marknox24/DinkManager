import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, CircleCheck, XCircle } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { formatRelativeTime } from '../../utils/format';

const KIND_ICONS = {
  status_change: CircleCheck,
  event_updated: CalendarClock,
  event_cancelled: XCircle,
};

// Same private-vs-public link resolution PlayerDashboardPage.jsx already
// uses for a registration's event — kept here too since notifications link
// straight to the event.
function eventLink(events) {
  if (!events) return null;
  if (events.visibility === 'private' && events.share_token) return `/t/${events.share_token}`;
  if (events.slug) return `/e/${events.slug}`;
  return null;
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const unread = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length > 0) markRead(unread);
  }, [open, notifications, markRead]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        className="relative flex items-center justify-center rounded-full border border-ink-200 p-2 text-ink-600 transition hover:bg-ink-100"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-ink-100 bg-white shadow-lg">
          <div className="border-b border-ink-50 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Updates</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <div className="px-4 py-8 text-center text-xs text-ink-400">No updates yet.</div>}
            {notifications.map((n) => {
              const Icon = KIND_ICONS[n.kind] || Bell;
              const link = eventLink(n.events);
              const content = (
                <div className={`flex gap-2.5 px-4 py-3 text-left ${!n.read_at ? 'bg-brand-50/40' : ''}`}>
                  <Icon size={14} className="mt-0.5 shrink-0 text-ink-400" />
                  <div className="min-w-0">
                    <p className="text-xs leading-snug text-ink-700">{n.message}</p>
                    <span className="mt-0.5 block text-[10px] text-ink-400">{formatRelativeTime(n.created_at)}</span>
                  </div>
                </div>
              );
              return link ? (
                <Link key={n.id} to={link} onClick={() => setOpen(false)} className="block border-b border-ink-50 last:border-0 hover:bg-ink-50">
                  {content}
                </Link>
              ) : (
                <div key={n.id} className="border-b border-ink-50 last:border-0">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
