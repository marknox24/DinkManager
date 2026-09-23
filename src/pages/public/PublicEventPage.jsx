import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award,
  CalendarDays,
  CloudSun,
  Coins,
  ExternalLink,
  Globe,
  Home,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Share2,
  Sun,
  Trophy,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import Logo from '../../components/ui/Logo';
import Tabs from '../../components/ui/Tabs';
import Modal from '../../components/ui/Modal';
import FaqAccordion from '../../components/ui/FaqAccordion';
import {
  getEventMediaUrl,
  getPublicEventByShareToken,
  getPublicEventBySlug,
  listCategories,
  listCategoryCounts,
  listSponsors,
} from '../../data/eventsApi';
import { COURT_TYPES } from '../../data/constants';
import { formatDateRange } from '../../utils/format';
import { usableCourts } from '../../utils/courts';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/organizer/StatusBadge';

const CONTACT_ICONS = { Phone, Email: Mail, Website: Globe };
const COURT_TYPE_ICONS = { indoor: Home, outdoor: Sun, mixed: CloudSun };

function FactTile({ icon: Icon, sub, label }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-ink-50 px-3.5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{sub}</div>
        <div className="truncate text-sm font-semibold text-ink-800">{label}</div>
      </div>
    </div>
  );
}

function CategoryCard({ cat, count, onViewDetails }) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = count?.active_count || 0;
  const full = cat.max_slots != null && activeCount >= cat.max_slots;
  const longDescription = (cat.description || '').length > 160;
  const hasQualification = (cat.qualification || []).length > 0 || cat.qualification_notes || cat.disqualification_notes;

  return (
    <div className="hover-lift flex flex-col rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
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
      {cat.description && (
        <div className="mt-2">
          <p className={`whitespace-pre-line text-xs text-ink-600 ${expanded ? '' : 'line-clamp-3'}`}>{cat.description}</p>
          {longDescription && (
            <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-[11px] font-bold text-brand-600 hover:text-brand-700">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}
      {(cat.prize_champion || cat.prize_runner_up) && (
        <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
          <Trophy size={12} /> {cat.prize_champion}
          {cat.prize_runner_up ? ` · ${cat.prize_runner_up}` : ''}
        </div>
      )}
      {hasQualification && (
        <div className="mt-1 flex items-center gap-1 text-xs text-brand-600">
          <ShieldCheck size={12} /> Qualification requirements apply
        </div>
      )}
      <button
        onClick={() => onViewDetails(cat)}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
      >
        <ShieldCheck size={13} /> View qualification &amp; register
      </button>
    </div>
  );
}

function CategoryDetailModal({ cat, count, linkBase, onClose }) {
  const activeCount = count?.active_count || 0;
  const full = cat.max_slots != null && activeCount >= cat.max_slots;
  const qualification = cat.qualification || [];
  const hasQualificationInfo = qualification.length > 0 || cat.qualification_notes || cat.disqualification_notes;

  return (
    <Modal open onClose={onClose} title={cat.name} icon={Trophy} maxWidth="max-w-xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${full ? 'bg-amber-100 text-amber-800' : 'bg-brand-50 text-brand-700'}`}>
            {full ? 'Waiting list' : 'Open'}
          </span>
          <span className="text-xs text-ink-500">
            {cat.match_type} &middot; {cat.format} &middot; {cat.fee_amount > 0 ? `${cat.fee_amount} ${cat.fee_currency}` : 'Free'}
            {cat.max_slots ? ` · ${activeCount}/${cat.max_slots} slots` : ''}
          </span>
        </div>

        {(cat.image_path || cat.description) && (
          <div>
            <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">About this division</h4>
            {cat.image_path && (
              <img
                src={getEventMediaUrl(cat.image_path)}
                alt=""
                className="mb-3 max-h-[70vh] w-full rounded-xl border border-ink-100 object-contain"
              />
            )}
            {cat.description && <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{cat.description}</p>}
          </div>
        )}

        {(cat.prize_champion || cat.prize_runner_up || cat.prize_second_runner_up) && (
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
              <Trophy size={12} /> Prizes
            </h4>
            <ul className="flex flex-col gap-1 text-sm text-ink-700">
              {cat.prize_champion && <li>🏆 {cat.prize_champion}</li>}
              {cat.prize_runner_up && <li>🥈 {cat.prize_runner_up}</li>}
              {cat.prize_second_runner_up && <li>🥉 {cat.prize_second_runner_up}</li>}
            </ul>
          </div>
        )}

        {hasQualificationInfo && (
          <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700">
              <ShieldCheck size={13} /> Qualification &amp; eligibility
            </h4>
            <p className="mb-3 text-xs text-ink-500">Am I eligible to join this division? Check the requirements below before registering.</p>
            {qualification.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {qualification.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-800">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>
                      <span className="font-semibold">{q.label}:</span> {q.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {cat.qualification_notes && <p className="mb-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{cat.qualification_notes}</p>}
            {cat.disqualification_notes && (
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-white p-3 text-xs text-rose-700">
                <XCircle size={14} className="mt-0.5 shrink-0" />
                <span>{cat.disqualification_notes}</span>
              </div>
            )}
          </div>
        )}

        <Link
          to={`${linkBase}/register?category=${cat.id}`}
          className="block rounded-full bg-brand-600 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          {full ? 'Join waiting list' : 'Register for this division'}
        </Link>
      </div>
    </Modal>
  );
}

export default function PublicEventPage() {
  const { slug, token } = useParams();
  const { pushToast } = useToast();
  const [event, setEvent] = useState(undefined);
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const linkBase = token ? `/t/${token}` : `/e/${slug}`;

  useEffect(() => {
    const load = token ? getPublicEventByShareToken(token) : getPublicEventBySlug(slug);
    load
      .then(async (ev) => {
        setEvent(ev);
        const [cats, cnts, sps] = await Promise.all([listCategories(ev.id), listCategoryCounts(ev.id), listSponsors(ev.id)]);
        setCategories(cats);
        setCounts(cnts);
        setSponsors(sps);
      })
      .catch(() => setEvent(null));
  }, [slug, token]);

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

  const handleShare = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => pushToast('Link copied', 'success'))
      .catch(() => pushToast('Could not copy link', 'error'));
  };

  const policyContent = [
    event.cancellation_policy && { label: 'Cancellation / rain policy', text: event.cancellation_policy },
    event.refund_policy && { label: 'Refund policy', text: event.refund_policy },
  ].filter(Boolean);

  const sections = [
    { id: 'overview', label: 'Overview', content: event.description },
    { id: 'rules', label: 'Rules', content: event.rules },
    { id: 'venue', label: 'Venue', content: event.venue_guidelines },
    { id: 'schedule', label: 'Schedule', content: event.schedule },
    { id: 'prizes', label: 'Prizes', content: event.prize_pool },
    { id: 'policies', label: 'Policies', content: policyContent.length > 0 ? policyContent : null },
    { id: 'announcements', label: 'Announcements', content: event.announcements },
    { id: 'faq', label: 'FAQ', content: event.faq },
  ].filter((s) => s.content);

  const matchTypes = [...new Set(categories.map((c) => c.match_type).filter(Boolean))];
  const formats = [...new Set(categories.map((c) => c.format).filter(Boolean))];

  const feeCategories = categories.filter((c) => c.fee_amount != null);
  let feeLabel = null;
  if (feeCategories.length > 0) {
    const currencies = new Set(feeCategories.map((c) => c.fee_currency));
    const amounts = feeCategories.map((c) => c.fee_amount);
    if (amounts.every((a) => a === 0)) {
      feeLabel = 'Free';
    } else if (currencies.size > 1) {
      feeLabel = 'Fees vary by division';
    } else {
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      feeLabel = min === max ? `${min} ${feeCategories[0].fee_currency}` : `${min}–${max} ${feeCategories[0].fee_currency}`;
    }
  }

  const cappedCategories = categories.filter((c) => c.max_slots != null);
  const totalCap = cappedCategories.reduce((sum, c) => sum + c.max_slots, 0);
  const totalFilled = cappedCategories.reduce((sum, c) => sum + (counts.find((x) => x.category_id === c.id)?.active_count || 0), 0);
  const slotsInfo =
    cappedCategories.length > 0
      ? {
          total: totalCap,
          filled: totalFilled,
          pct: totalCap > 0 ? Math.min(100, Math.round((totalFilled / totalCap) * 100)) : 0,
          label: totalFilled >= totalCap ? 'Waitlist only' : `${totalCap - totalFilled} spot${totalCap - totalFilled === 1 ? '' : 's'} left`,
        }
      : null;

  const prizeCount = categories.filter((c) => c.prize_champion).length;

  const facts = [
    { icon: CalendarDays, sub: 'When', label: formatDateRange(event.start_date, event.end_date, 'Dates to be announced') },
    (event.registration_open_date || event.registration_close_date) && {
      icon: CalendarDays,
      sub: 'Registration window',
      label: formatDateRange(event.registration_open_date, event.registration_close_date),
    },
    event.location_address && { icon: MapPin, sub: 'Where', label: event.location_address },
    event.num_courts != null && { icon: LayoutGrid, sub: 'Courts', label: `${usableCourts(event)} court${usableCourts(event) === 1 ? '' : 's'}` },
    event.court_type && { icon: COURT_TYPE_ICONS[event.court_type] || LayoutGrid, sub: 'Court type', label: COURT_TYPES.find((c) => c.value === event.court_type)?.label },
    categories.length > 0 && { icon: Trophy, sub: 'Divisions', label: `${categories.length} division${categories.length === 1 ? '' : 's'}` },
    feeLabel && { icon: Coins, sub: 'Registration fee', label: feeLabel },
    matchTypes.length === 1 && { icon: Users, sub: 'Open to', label: matchTypes[0] },
    matchTypes.length > 1 && { icon: Users, sub: 'Open to', label: 'All levels — see divisions' },
    formats.length === 1 && { icon: Layers, sub: 'Format', label: formats[0] },
  ].filter(Boolean);

  const hasOrganizerInfo = !!(event.organizer_name || (event.contacts || []).length > 0);
  const hasVenueInfo = !!(event.location_address || event.court_type);

  const longDescription = (event.description || '').length > 220;
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="min-h-screen bg-[#f3f6f8] pb-24 lg:pb-0">
      <header className="bg-gradient-to-br from-ink-900 to-ink-800 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                <Logo size={22} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">DinkManager Tournament</span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/tournaments" className="text-xs font-semibold text-ink-300 hover:text-white">
                Browse tournaments
              </Link>
              <Link to="/player/login" className="text-xs font-semibold text-ink-300 hover:text-white">
                Player sign in
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{event.name}</h1>
            <StatusBadge status={event.status} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
          {event.cover_photo_path ? (
            <img src={getEventMediaUrl(event.cover_photo_path)} alt="" className="h-56 w-full object-cover sm:h-72" />
          ) : (
            <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300 sm:h-64">
              <ImageIcon size={32} />
            </div>
          )}
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
              >
                <Share2 size={14} /> Share
              </button>
              <a href="#divisions" className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">
                Register now
              </a>
              {slotsInfo && (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <span className={`text-xs font-bold ${slotsInfo.filled >= slotsInfo.total ? 'text-amber-700' : 'text-brand-700'}`}>
                    {slotsInfo.label}
                  </span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${slotsInfo.pct}%` }} />
                  </div>
                  <span className="text-[11px] text-ink-400">
                    {slotsInfo.filled}/{slotsInfo.total}
                  </span>
                </div>
              )}
            </div>

            {event.description && (
              <div className="mt-4">
                <p className={`whitespace-pre-line text-sm leading-relaxed text-ink-600 ${descExpanded ? '' : 'line-clamp-3'}`}>{event.description}</p>
                {longDescription && (
                  <button onClick={() => setDescExpanded((e) => !e)} className="mt-1 text-xs font-bold text-brand-600 hover:text-brand-700">
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {facts.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {facts.map((f, i) => (
                  <FactTile key={i} icon={f.icon} sub={f.sub} label={f.label} />
                ))}
              </div>
            )}
          </div>
        </div>

        <section id="divisions" className="scroll-mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Trophy size={17} strokeWidth={2.3} />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink-900">Divisions</h2>
                <p className="text-xs text-ink-500">Choose a division to register.</p>
              </div>
            </div>
            {prizeCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <Trophy size={12} /> Prizes for {prizeCount} of {categories.length} division{categories.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {categories.length === 0 && <p className="text-sm text-ink-400">Categories will be posted soon.</p>}
          {categories.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  cat={cat}
                  count={counts.find((c) => c.category_id === cat.id)}
                  onViewDetails={(c) => setSelectedCategoryId(c.id)}
                />
              ))}
            </div>
          )}
        </section>

        {sections.length > 0 && (
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <Tabs
              tabs={sections.map((s) => ({
                ...s,
                content:
                  s.id === 'policies' ? (
                    <div className="flex flex-col gap-4">
                      {s.content.map((p) => (
                        <div key={p.label}>
                          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">{p.label}</h4>
                          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{p.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : s.id === 'faq' ? (
                    <FaqAccordion raw={s.content} />
                  ) : (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{s.content}</p>
                  ),
              }))}
            />
          </div>
        )}

        {(hasOrganizerInfo || hasVenueInfo) && (
          <div className={`grid grid-cols-1 gap-4 ${hasOrganizerInfo && hasVenueInfo ? 'sm:grid-cols-2' : ''}`}>
            {hasOrganizerInfo && (
              <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <User size={17} strokeWidth={2.3} />
                  </span>
                  <h2 className="font-display text-base font-bold text-ink-900">Organized by {event.organizer_name || 'the tournament organizer'}</h2>
                </div>
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

            {hasVenueInfo && (
              <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <MapPin size={17} strokeWidth={2.3} />
                  </span>
                  <h2 className="font-display text-base font-bold text-ink-900">Venue</h2>
                </div>
                {event.location_address && <p className="text-sm font-semibold text-ink-800">{event.location_address}</p>}
                {event.court_type && (
                  <p className="mt-1 text-xs text-ink-500">{COURT_TYPES.find((c) => c.value === event.court_type)?.label} courts</p>
                )}
                {event.location_address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location_address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
                  >
                    <ExternalLink size={13} /> Open in Maps
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {sponsors.length > 0 && (
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Award size={17} strokeWidth={2.3} />
              </span>
              <h2 className="font-display text-base font-bold text-ink-900">Sponsors</h2>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              {sponsors.map((s) =>
                s.logo_path ? (
                  <img
                    key={s.id}
                    src={getEventMediaUrl(s.logo_path)}
                    alt={s.name}
                    title={s.name}
                    className="h-10 max-w-[140px] object-contain grayscale opacity-70 transition hover:grayscale-0 hover:opacity-100"
                  />
                ) : (
                  <span key={s.id} className="rounded-full bg-ink-50 px-3 py-1.5 text-xs font-bold text-ink-600">
                    {s.name}
                  </span>
                )
              )}
            </div>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink-100 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
        <a href="#divisions" className="block rounded-full bg-brand-600 px-5 py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">
          Register now
        </a>
      </div>

      {selectedCategory && (
        <CategoryDetailModal
          cat={selectedCategory}
          count={counts.find((c) => c.category_id === selectedCategory.id)}
          linkBase={linkBase}
          onClose={() => setSelectedCategoryId(null)}
        />
      )}
    </div>
  );
}
