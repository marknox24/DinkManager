import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Globe, Mail, MapPin, Phone, Trophy } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import { getEventMediaUrl, getPublicEventBySlug, listCategories, listCategoryCounts } from '../../data/eventsApi';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/organizer/StatusBadge';

const CONTACT_ICONS = { Phone, Email: Mail, Website: Globe };

function formatDateRange(start, end) {
  if (!start && !end) return 'Dates to be announced';
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end);
}

function TextSection({ title, content }) {
  if (!content) return null;
  return (
    <div>
      <h2 className="mb-2 font-display text-base font-bold text-ink-900">{title}</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{content}</p>
    </div>
  );
}

export default function PublicEventPage() {
  const { slug } = useParams();
  const { pushToast } = useToast();
  const [event, setEvent] = useState(undefined);
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState([]);

  useEffect(() => {
    getPublicEventBySlug(slug)
      .then(async (ev) => {
        setEvent(ev);
        const [cats, cnts] = await Promise.all([listCategories(ev.id), listCategoryCounts(ev.id)]);
        setCategories(cats);
        setCounts(cnts);
      })
      .catch(() => setEvent(null));
  }, [slug]);

  if (event === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] text-sm text-ink-400">Loading…</div>;
  }

  if (event === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[#f3f6f8] px-4 text-center">
        <h1 className="font-display text-xl font-bold text-ink-900">Event not found</h1>
        <p className="text-sm text-ink-500">This tournament may not be published yet, or the link is incorrect.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6f8]">
      <header className="bg-gradient-to-br from-ink-900 to-ink-800 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                <Logo size={22} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">DinkManager Tournament</span>
            </div>
            <Link to="/player/login" className="text-xs font-semibold text-ink-300 hover:text-white">
              Player sign in
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{event.name}</h1>
            <StatusBadge status={event.status} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-200">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} /> {formatDateRange(event.start_date, event.end_date)}
            </span>
            {event.location_address && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} /> {event.location_address}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          {(event.organizer_name || (event.contacts || []).length > 0) && (
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-display text-base font-bold text-ink-900">Organized by {event.organizer_name || 'the tournament organizer'}</h2>
              <div className="flex flex-wrap gap-4">
                {(event.contacts || []).map((c, i) => {
                  const Icon = CONTACT_ICONS[c.type] || Globe;
                  return (
                    <span key={i} className="flex items-center gap-1.5 text-sm text-ink-600">
                      <Icon size={14} className="text-ink-400" /> {c.value}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {(event.description || event.rules || event.venue_guidelines || event.schedule || event.faq) && (
            <div className="flex flex-col gap-5 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <TextSection title="About this tournament" content={event.description} />
              <TextSection title="Rules & regulations" content={event.rules} />
              <TextSection title="Venue guidelines" content={event.venue_guidelines} />
              <TextSection title="Schedule of play" content={event.schedule} />
              <TextSection title="FAQ" content={event.faq} />
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2 lg:sticky lg:top-6">
          <div className="max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-display text-base font-bold text-ink-900">Categories</h2>
            <div className="flex flex-col gap-3">
              {categories.length === 0 && <p className="text-sm text-ink-400">Categories will be posted soon.</p>}
              {categories.map((cat) => {
                const count = counts.find((c) => c.category_id === cat.id);
                const activeCount = count?.active_count || 0;
                const full = cat.max_slots != null && activeCount >= cat.max_slots;
                return (
                  <div key={cat.id} className="rounded-2xl border border-ink-100 p-4">
                    {cat.image_path && (
                      <img src={getEventMediaUrl(cat.image_path)} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-900">{cat.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${full ? 'bg-amber-100 text-amber-800' : 'bg-brand-50 text-brand-700'}`}>
                        {full ? 'Waiting list' : 'Open'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-500">
                      {cat.match_type} &middot; {cat.format} &middot; {cat.fee_amount > 0 ? `${cat.fee_amount} ${cat.fee_currency}` : 'Free'}
                      {cat.max_slots ? ` · ${activeCount}/${cat.max_slots} slots` : ''}
                    </div>
                    {cat.description && <p className="mt-2 whitespace-pre-line text-xs text-ink-600">{cat.description}</p>}
                    {(cat.prize_champion || cat.prize_runner_up) && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                        <Trophy size={12} /> {cat.prize_champion}
                        {cat.prize_runner_up ? ` · ${cat.prize_runner_up}` : ''}
                      </div>
                    )}
                    <Link
                      to={`/e/${slug}/register?category=${cat.id}`}
                      className="mt-3 block rounded-full bg-brand-600 px-4 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
                    >
                      {full ? 'Join waiting list' : 'Register'}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
