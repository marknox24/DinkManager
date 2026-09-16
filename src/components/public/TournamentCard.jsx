import { Link } from 'react-router-dom';
import { CalendarDays, Image as ImageIcon, MapPin } from 'lucide-react';
import StatusBadge from '../organizer/StatusBadge';
import { getEventMediaUrl } from '../../data/eventsApi';
import { formatDateRange } from '../../utils/format';

// A published-tournament summary card — shared by DiscoverTournamentsPage.jsx
// (public "browse all tournaments" page) and the player dashboard's
// "Available Tournaments" preview, so both always show the same fields
// (name, dates, location, status) instead of drifting into two versions.
export default function TournamentCard({ event }) {
  return (
    <Link
      to={`/e/${event.slug}`}
      className="hover-lift flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white text-left shadow-sm"
    >
      {event.cover_photo_path ? (
        <img src={getEventMediaUrl(event.cover_photo_path)} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300">
          <ImageIcon size={26} />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="font-display text-base font-bold leading-snug text-ink-900">{event.name}</h2>
          <StatusBadge status={event.status} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-500">
          <CalendarDays size={13} /> {formatDateRange(event.start_date, event.end_date)}
        </div>
        {event.location_address && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
            <MapPin size={13} /> <span className="truncate">{event.location_address}</span>
          </div>
        )}
        <span className="mt-3 text-[11px] font-bold text-brand-600">View tournament →</span>
      </div>
    </Link>
  );
}
