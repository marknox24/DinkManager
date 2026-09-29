import { PartyPopper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationsContext';

// Same private-vs-public link resolution NotificationBell.jsx already
// uses — duplicated here (4 lines) rather than shared, since extracting a
// util for one tiny helper used in two places isn't worth the extra file.
function eventLink(events) {
  if (!events) return null;
  if (events.visibility === 'private' && events.share_token) return `/t/${events.share_token}`;
  if (events.slug) return `/e/${events.slug}`;
  return null;
}

// Rendered inside PlayerLayout's NotificationsProvider (not called directly
// from a page component, which would sit above the provider in the tree —
// see the same note on NotificationBell/RecentUpdatesPanel). Pops up once
// for the most recent unread "approved" status change, then marks it read
// via the same RPC the bell already uses, so it never reappears.
export default function RegistrationApprovedModal() {
  const { notifications, markRead } = useNotifications();
  const notification = notifications.find((n) => !n.read_at && n.kind === 'status_change' && n.new_status === 'approved');

  if (!notification) return null;

  const link = eventLink(notification.events);
  const categoryName = notification.registrations?.categories?.name;
  const eventName = notification.events?.name;

  const dismiss = () => markRead([notification.id]);

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={dismiss} />
      <div className="animate-modal-in relative w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <PartyPopper size={26} strokeWidth={2.3} />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-ink-900">You're in! 🎉</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          You're successfully registered {categoryName ? <>for <span className="font-semibold text-ink-700">{categoryName}</span></> : null}{' '}
          {eventName ? (
            <>
              in <span className="font-semibold text-ink-700">&ldquo;{eventName}&rdquo;</span>
            </>
          ) : (
            'for this tournament'
          )}
          .
        </p>

        {link && (
          <Link
            to={link}
            onClick={dismiss}
            className="press-scale mt-6 flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            View event
          </Link>
        )}
        <button onClick={dismiss} className="mt-3 w-full text-center text-xs font-semibold text-ink-400 hover:text-ink-600">
          Got it
        </button>
      </div>
    </div>
  );
}
