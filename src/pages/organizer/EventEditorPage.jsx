import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudUpload,
  Copy,
  ExternalLink,
  FileText,
  Gavel,
  ImagePlus,
  Contact as ContactIcon,
  ListChecks,
  MapPin,
  Plus,
  QrCode,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import HintsTour from '../../components/ui/HintsTour';
import {
  createCategory,
  createRegistrationField,
  createUmpire,
  deleteCategory,
  deleteRegistrationField,
  deleteUmpire,
  getEventById,
  listCategories,
  listRegistrationFields,
  listUmpires,
  updateCategory,
  updateEvent,
  updateRegistrationField,
  uploadEventMedia,
  getEventMediaUrl,
} from '../../data/eventsApi';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import CategoryEditor from '../../components/organizer/CategoryEditor';
import RegistrationFieldEditor from '../../components/organizer/RegistrationFieldEditor';
import ContactsEditor from '../../components/organizer/ContactsEditor';
import FormField, { inputClass, textareaClass } from '../../components/ui/FormField';
import Select from '../../components/ui/Select';
import ImageDropzone from '../../components/ui/ImageDropzone';
import AccordionItem from '../../components/ui/Accordion';
import FaqEditor from '../../components/organizer/FaqEditor';
import { parseFaqItems, serializeFaqItems } from '../../utils/faq';
import { COURT_TYPES } from '../../data/constants';
import { PLAN_LIMITS, planLimit } from '../../data/plans';

const STATUS_OPTIONS = ['upcoming', 'ongoing', 'finished', 'cancelled', 'rescheduled'];

const STEPS = [
  { id: 'basics', label: 'Basics', icon: MapPin },
  { id: 'contact', label: 'Contact', icon: ContactIcon },
  { id: 'details', label: 'Description', icon: FileText },
  { id: 'categories', label: 'Categories', icon: Trophy },
  { id: 'logistics', label: 'Logistics', icon: QrCode },
  { id: 'registration', label: 'Registration', icon: ListChecks },
];

// Steps that must be filled in before the event can be published — drives
// the amber dot on the step tab so it's visible at a glance from anywhere
// in the wizard, not just when togglePublish blocks you.
const STEP_REQUIREMENTS = {
  categories: (categories) => categories.length === 0,
  logistics: (_categories, umpires) => umpires.length === 0,
};

const TOUR_STEPS = [
  { target: 'steps-nav', title: 'Set up in a few steps', body: 'Move through Basics, Contact, Description, Categories, Logistics and Registration to fully set up your event.' },
  { target: 'step-categories', title: 'Add categories', body: 'Add at least one category — players pick one when they register. Required before you can publish.' },
  { target: 'step-logistics', title: 'Add your umpires', body: "Under Logistics, add the officials running matches. Also required before you can publish." },
  { target: 'publish-button', title: 'Publish when ready', body: 'Once categories and umpires are set up, publish to make your event live for players to find and register.' },
];

function StepHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-lg font-bold text-ink-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
    </div>
  );
}

export default function EventEditorPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  // Only the category just added via "Add category" opens expanded by
  // default — every other category card starts collapsed, since with many
  // categories a fully-expanded list turns into a long, hard-to-scan scroll.
  const [newCategoryId, setNewCategoryId] = useState(null);
  const [fields, setFields] = useState([]);
  const [umpires, setUmpires] = useState([]);
  const [umpireName, setUmpireName] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [step, setStep] = useState(0);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  useEffect(() => {
    Promise.all([getEventById(eventId), listCategories(eventId), listRegistrationFields(eventId), listUmpires(eventId)])
      .then(([ev, cats, flds, umps]) => {
        setEvent(ev);
        setCategories(cats);
        setFields(flds);
        setUmpires(umps);
      })
      .catch((e) => {
        pushToast(e.message, 'error');
        navigate('/dashboard');
      });
  }, [eventId, navigate, pushToast]);

  const saveField = async (patch) => {
    setEvent((prev) => ({ ...prev, ...patch }));
    setSaveStatus('saving');
    try {
      await updateEvent(eventId, patch);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      pushToast(e.message, 'error');
    }
  };

  const togglePublish = async () => {
    if (!event.is_published) {
      if (categories.length === 0) {
        pushToast('Add at least one category before publishing', 'error');
        setStep(3);
        return;
      }
      if (umpires.length === 0) {
        pushToast('Add at least one umpire before publishing', 'error');
        setStep(4);
        return;
      }
    }
    await saveField({ is_published: !event.is_published });
    pushToast(event.is_published ? 'Event unpublished' : 'Event published — the public page is live', 'success');
  };

  const addCategory = async () => {
    const limit = planLimit(event.plan, 'categories');
    if (limit != null && categories.length >= limit) {
      pushToast(
        `Your ${PLAN_LIMITS[event.plan].label} plan allows up to ${limit} categor${limit === 1 ? 'y' : 'ies'} per event — raise this event's plan to add more.`,
        'error'
      );
      return;
    }
    try {
      const cat = await createCategory(
        eventId,
        { name: 'New Category', match_type: 'Singles', format: 'Round Robin', fee_amount: 0, fee_currency: 'USD' },
        categories.length
      );
      setCategories((prev) => [...prev, cat]);
      setNewCategoryId(cat.id);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const saveCategory = async (cat) => {
    try {
      await updateCategory(cat.id, {
        name: cat.name,
        match_type: cat.match_type,
        format: cat.format,
        fee_amount: cat.fee_amount,
        fee_currency: cat.fee_currency,
        max_slots: cat.max_slots,
        prize_champion: cat.prize_champion,
        prize_runner_up: cat.prize_runner_up,
        prize_second_runner_up: cat.prize_second_runner_up,
        description: cat.description,
        image_path: cat.image_path,
        estimated_match_minutes: cat.estimated_match_minutes,
        playoff_enabled: cat.playoff_enabled,
        playoff_pool_count: cat.playoff_pool_count,
        playoff_advance_per_pool: cat.playoff_advance_per_pool,
        playoff_pool_pairs: cat.playoff_pool_pairs,
        playoff_third_place: cat.playoff_third_place,
      });
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const removeCategory = async (cat) => {
    const ok = await confirm({ title: `Delete "${cat.name}"?`, message: 'This also removes any registrations already made for this category.', confirmLabel: 'Delete category' });
    if (!ok) return;
    try {
      await deleteCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const addField = async () => {
    try {
      const field = await createRegistrationField(eventId, { label: 'New question', field_type: 'text', required: false }, fields.length);
      setFields((prev) => [...prev, field]);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const saveRegField = async (field) => {
    try {
      await updateRegistrationField(field.id, { label: field.label, field_type: field.field_type, required: field.required });
      setFields((prev) => prev.map((f) => (f.id === field.id ? field : f)));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const removeField = async (field) => {
    const ok = await confirm({ title: `Remove "${field.label}"?`, confirmLabel: 'Remove', danger: true, message: 'Players will no longer be asked this question.' });
    if (!ok) return;
    try {
      await deleteRegistrationField(field.id);
      setFields((prev) => prev.filter((f) => f.id !== field.id));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const addUmpire = async () => {
    const trimmed = umpireName.trim();
    if (!trimmed) return;
    if (umpires.some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) {
      pushToast('That umpire is already on the list', 'error');
      return;
    }
    try {
      const u = await createUmpire(eventId, trimmed);
      setUmpires((prev) => [...prev, u]);
      setUmpireName('');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const removeUmpire = async (u) => {
    const ok = await confirm({ title: `Remove ${u.name}?`, confirmLabel: 'Remove', message: 'They will no longer appear as an available umpire for this event.' });
    if (!ok) return;
    try {
      await deleteUmpire(u.id);
      setUmpires((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleCoverUpload = async (file) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const { path } = await uploadEventMedia(eventId, file);
      await saveField({ cover_photo_path: path });
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleQrUpload = async (file) => {
    if (!file) return;
    setUploadingQr(true);
    try {
      const { path } = await uploadEventMedia(eventId, file);
      await saveField({ payment_qr_path: path });
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setUploadingQr(false);
    }
  };

  const removeQr = () => saveField({ payment_qr_path: null });

  const copyPublicLink = () => {
    const url = `${window.location.origin}/e/${event.slug}`;
    navigator.clipboard.writeText(url);
    pushToast('Public link copied', 'success');
  };

  if (!event) {
    return (
      <OrganizerLayout backTo="/dashboard" backLabel="Dashboard">
        <div className="py-16 text-center text-sm text-ink-400">Loading event…</div>
      </OrganizerLayout>
    );
  }

  return (
    <OrganizerLayout backTo="/dashboard" backLabel="Dashboard">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900">{event.name || 'Untitled Tournament'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span className={`flex items-center gap-1 ${saveStatus === 'error' ? 'text-rose-600' : 'text-ink-400'}`}>
                {saveStatus === 'saving' ? <CloudUpload size={12} className="animate-pulse-soft" /> : <Cloud size={12} />}
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}
              </span>
              {event.is_published && event.visibility !== 'private' && (
                <>
                  <span>&middot;</span>
                  <button onClick={copyPublicLink} className="flex items-center gap-1 font-semibold text-brand-600">
                    <Copy size={11} /> Copy public link
                  </button>
                  <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-brand-600">
                    <ExternalLink size={11} /> View
                  </a>
                </>
              )}
              {event.is_published && event.visibility === 'private' && (
                <>
                  <span>&middot;</span>
                  <span className="flex items-center gap-1 font-semibold text-ink-400">Private — manage the share link in Settings</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/events/${eventId}/manage`)}
              className="rounded-full border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 transition hover:bg-ink-100"
            >
              Manage players
            </button>
            <button
              data-tour="publish-button"
              onClick={togglePublish}
              className={`rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition ${
                event.is_published ? 'bg-ink-600 hover:bg-ink-700' : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {event.is_published ? 'Unpublish' : 'Publish event'}
            </button>
          </div>
        </div>

        <div data-tour="steps-nav" className="mb-6 flex items-center gap-1 overflow-x-auto pb-1 sm:gap-1.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            const missingRequired = STEP_REQUIREMENTS[s.id]?.(categories, umpires);
            return (
              <div key={s.id} className="flex items-center">
                <button
                  data-tour={s.id === 'categories' ? 'step-categories' : s.id === 'logistics' ? 'step-logistics' : undefined}
                  onClick={() => setStep(i)}
                  className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold transition sm:px-3 ${
                    active ? 'bg-ink-900 text-white shadow-sm' : done ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'text-ink-400 hover:bg-ink-100'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                      active ? 'bg-white/20' : done ? 'bg-brand-600 text-white' : 'bg-ink-200 text-ink-500'
                    }`}
                  >
                    {done ? <Check size={11} /> : i + 1}
                  </span>
                  <Icon size={13} className="hidden sm:block" />
                  <span className="hidden md:inline">{s.label}</span>
                  {missingRequired && (
                    <span title="Required before publishing" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                  )}
                </button>
                {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-3 shrink-0 bg-ink-200 sm:w-5" />}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6">
          {step === 0 && (
            <>
              <StepHeader title="Event basics" subtitle="Name, dates, status and location" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Tournament name" className="sm:col-span-2">
                  <input defaultValue={event.name} onBlur={(e) => saveField({ name: e.target.value })} className={inputClass} />
                </FormField>
                <FormField label="Status">
                  <Select value={event.status} onChange={(e) => saveField({ status: e.target.value })} className={inputClass}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Plan" hint="Set by your subscription — approve a new plan from the pricing page to raise these caps.">
                  <div className={`${inputClass} cursor-not-allowed bg-ink-50 text-ink-600`} aria-readonly="true">
                    {(PLAN_LIMITS[event.plan] ?? PLAN_LIMITS.free).label} — up to {(PLAN_LIMITS[event.plan] ?? PLAN_LIMITS.free).categories ?? 'unlimited'}{' '}
                    categories, {(PLAN_LIMITS[event.plan] ?? PLAN_LIMITS.free).playersPerCategory} players/cat,{' '}
                    {(PLAN_LIMITS[event.plan] ?? PLAN_LIMITS.free).courts} courts
                  </div>
                </FormField>
                <FormField label="Location / address">
                  <input
                    defaultValue={event.location_address || ''}
                    onBlur={(e) => saveField({ location_address: e.target.value })}
                    placeholder="Court name, street, city"
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Start date">
                  <input type="date" value={event.start_date || ''} onChange={(e) => saveField({ start_date: e.target.value })} className={inputClass} />
                </FormField>
                <FormField label="End date">
                  <input type="date" value={event.end_date || ''} onChange={(e) => saveField({ end_date: e.target.value })} className={inputClass} />
                </FormField>
                <FormField label="Registration opens" hint="Optional — shown to players on the public page.">
                  <input
                    type="date"
                    value={event.registration_open_date || ''}
                    onChange={(e) => saveField({ registration_open_date: e.target.value || null })}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Registration closes" hint="Optional — shown to players on the public page.">
                  <input
                    type="date"
                    value={event.registration_close_date || ''}
                    onChange={(e) => saveField({ registration_close_date: e.target.value || null })}
                    className={inputClass}
                  />
                </FormField>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <StepHeader title="Organizer contact" subtitle="Shown to players on the public event page" />
              <div className="flex flex-col gap-4">
                <FormField label="Organizer / club name">
                  <input defaultValue={event.organizer_name || ''} onBlur={(e) => saveField({ organizer_name: e.target.value })} className={inputClass} />
                </FormField>
                <FormField label="Contact details" hint="Up to 3 — phone, email, or website.">
                  <ContactsEditor contacts={event.contacts || []} onChange={(contacts) => saveField({ contacts })} />
                </FormField>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepHeader title="Description, rules & policies" subtitle="General tournament information shown to every player" />
              <div className="flex flex-col gap-4">
                <FormField label="Cover photo" hint="Shown at the top of your public page and as a preview on your dashboard.">
                  <ImageDropzone
                    imagePath={event.cover_photo_path}
                    getUrl={getEventMediaUrl}
                    onUpload={handleCoverUpload}
                    uploading={uploadingCover}
                    className="h-32 w-full sm:w-56"
                    emptyIcon={ImagePlus}
                    emptyLabel="Upload photo"
                  />
                </FormField>
                <div className="flex flex-col gap-2.5">
                  <AccordionItem
                    title="Tournament description"
                    subtitle="Overview, purpose, divisions, dates, and the player experience."
                    defaultOpen
                    filled={!!event.description}
                  >
                    <textarea
                      defaultValue={event.description || ''}
                      onBlur={(e) => saveField({ description: e.target.value })}
                      placeholder="Welcome players to a weekend of competitive pickleball! Describe the vibe, skill levels welcome, and what makes this tournament worth signing up for."
                      className={textareaClass}
                    />
                  </AccordionItem>
                  <AccordionItem
                    title="Rules & regulations"
                    subtitle="How matches are scored, formats, conduct, and forfeits."
                    filled={!!event.rules}
                  >
                    <textarea
                      defaultValue={event.rules || ''}
                      onBlur={(e) => saveField({ rules: e.target.value })}
                      placeholder={'1. Matches are best-of-3 games to 11, win by 2.\n2. Players must check in 15 minutes before their scheduled match.\n3. USAPA/official paddle and ball specs apply.\n4. No-shows after a 10-minute grace period forfeit the match.'}
                      className={textareaClass}
                    />
                  </AccordionItem>
                  <AccordionItem
                    title="Venue-specific guidelines"
                    subtitle="Parking, court assignments, spectator areas, and facility policies."
                    filled={!!event.venue_guidelines}
                  >
                    <textarea
                      defaultValue={event.venue_guidelines || ''}
                      onBlur={(e) => saveField({ venue_guidelines: e.target.value })}
                      placeholder="Parking is available on-site. Indoor court shoes only (no marking soles). Spectators must stay behind the fence line. Food and drinks allowed in the lobby only."
                      className={textareaClass}
                    />
                  </AccordionItem>
                  <AccordionItem
                    title="Schedule of play"
                    subtitle="Check-in, opening remarks, start times, breaks, and awards."
                    filled={!!event.schedule}
                  >
                    <textarea
                      defaultValue={event.schedule || ''}
                      onBlur={(e) => saveField({ schedule: e.target.value })}
                      placeholder={'7:00 AM - Check-in opens\n8:00 AM - Opening remarks\n8:30 AM - Pool play begins\n1:00 PM - Lunch break\n2:00 PM - Bracket play\n5:00 PM - Awards ceremony'}
                      className={textareaClass}
                    />
                  </AccordionItem>
                  <AccordionItem
                    title="FAQ"
                    subtitle="Answers to common questions, shown to players as an expandable list."
                    optional
                    filled={!!event.faq}
                  >
                    <FaqEditor items={parseFaqItems(event.faq)} onChange={(items) => saveField({ faq: serializeFaqItems(items) })} />
                  </AccordionItem>
                  <AccordionItem
                    title="Prize pool"
                    subtitle="Overall prizes across the tournament — per-division prizes are set on each category in the next step."
                    filled={!!event.prize_pool}
                  >
                    <textarea
                      defaultValue={event.prize_pool || ''}
                      onBlur={(e) => saveField({ prize_pool: e.target.value })}
                      placeholder={'Total cash prize pool: $2,000 across all divisions.\nChampion and runner-up medals for every division.\nSpecial award for Most Improved Player.'}
                      className={textareaClass}
                    />
                  </AccordionItem>
                  <AccordionItem
                    title="Cancellation / rain policy"
                    subtitle="What happens if the event is delayed, paused, or cancelled."
                    filled={!!event.cancellation_policy}
                  >
                    <textarea
                      defaultValue={event.cancellation_policy || ''}
                      onBlur={(e) => saveField({ cancellation_policy: e.target.value })}
                      placeholder={'In case of rain or unsafe court conditions, matches may be paused, rescheduled, or moved indoors at the organizer’s discretion. If the event is fully cancelled, players will be notified by email at least 2 hours before the scheduled start.'}
                      className={textareaClass}
                    />
                  </AccordionItem>
                  <AccordionItem
                    title="Refund policy"
                    subtitle="Refund tiers based on how close to the event a player cancels."
                    filled={!!event.refund_policy}
                  >
                    <textarea
                      defaultValue={event.refund_policy || ''}
                      onBlur={(e) => saveField({ refund_policy: e.target.value })}
                      placeholder={'Full refund up to 7 days before the event.\n50% refund within 3-6 days before the event.\nNo refund within 48 hours of the event, except for a full tournament cancellation.'}
                      className={textareaClass}
                    />
                  </AccordionItem>
                  <AccordionItem
                    title="Announcements"
                    subtitle="Anything else players should know before they register."
                    optional
                    filled={!!event.announcements}
                  >
                    <textarea
                      defaultValue={event.announcements || ''}
                      onBlur={(e) => saveField({ announcements: e.target.value })}
                      placeholder="Bring your own paddle and a spare ball. Free water stations available courtside. Livestream link will be posted here closer to the event."
                      className={textareaClass}
                    />
                  </AccordionItem>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepHeader title="Categories, fees & prizes" subtitle="Players choose one of these when they register" />
              <div className="flex flex-col gap-3">
                {categories.map((cat) => (
                  <CategoryEditor
                    key={cat.id}
                    eventId={eventId}
                    category={cat}
                    onSave={saveCategory}
                    onDelete={() => removeCategory(cat)}
                    defaultOpen={cat.id === newCategoryId}
                  />
                ))}
                {categories.length === 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
                    <Award size={14} /> Add at least one category before publishing.
                  </div>
                )}
                {(() => {
                  const limit = planLimit(event.plan, 'categories');
                  const atLimit = limit != null && categories.length >= limit;
                  return (
                    <>
                      <button
                        onClick={addCategory}
                        disabled={atLimit}
                        className="flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus size={13} /> Add category
                      </button>
                      {atLimit && (
                        <p className="text-xs text-ink-400">
                          {PLAN_LIMITS[event.plan].label} plan limit of {limit} categor{limit === 1 ? 'y' : 'ies'} reached — raise this event's plan on the Basics step to add more.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepHeader title="Logistics & media" subtitle="Courts, officiating and payment info" />
              <div className="flex flex-col gap-6">
                <div>
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                    <MapPin size={12} /> Venue & courts
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Available courts" hint={`Your ${PLAN_LIMITS[event.plan]?.label ?? 'Free Trial'} plan allows up to ${planLimit(event.plan, 'courts')}.`}>
                      <input
                        type="number"
                        min={0}
                        max={planLimit(event.plan, 'courts') ?? undefined}
                        defaultValue={event.num_courts ?? ''}
                        onBlur={(e) => {
                          const n = e.target.value === '' ? null : parseInt(e.target.value, 10);
                          const limit = planLimit(event.plan, 'courts');
                          if (n != null && limit != null && n > limit) {
                            pushToast(`Your ${PLAN_LIMITS[event.plan].label} plan allows up to ${limit} courts — raise this event's plan to add more.`, 'error');
                            e.target.value = event.num_courts ?? '';
                            return;
                          }
                          saveField({ num_courts: n });
                        }}
                        className={inputClass}
                      />
                    </FormField>
                    <FormField label="Your club name" hint="Used later to keep players from the same club apart when brackets are drawn.">
                      <input defaultValue={event.club_name || ''} onBlur={(e) => saveField({ club_name: e.target.value })} className={inputClass} />
                    </FormField>
                    <FormField label="Court type" hint="Shown to players on the tournament page.">
                      <Select value={event.court_type || ''} onChange={(e) => saveField({ court_type: e.target.value || null })} className={inputClass}>
                        <option value="">Not specified</option>
                        {COURT_TYPES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>
                </div>

                <div className="border-t border-ink-100 pt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                      <Gavel size={12} /> Officiating
                    </div>
                    {umpires.length === 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Required to publish</span>}
                  </div>
                  <FormField hint="Officials available to run matches — you can rename or remove them later from the Umpires tab.">
                    <div className="mb-3 flex gap-2">
                      <input
                        value={umpireName}
                        onChange={(e) => setUmpireName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUmpire())}
                        placeholder="Umpire name"
                        className={inputClass}
                      />
                      <button
                        onClick={addUmpire}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                    {umpires.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {umpires.map((u) => (
                          <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-violet-50 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-violet-700">
                            <Gavel size={11} /> {u.name}
                            <button onClick={() => removeUmpire(u)} title="Remove" className="flex h-4 w-4 items-center justify-center rounded-full text-violet-400 hover:bg-violet-100 hover:text-violet-700">
                              <Trash2 size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
                        <Gavel size={14} /> Add at least one umpire before publishing.
                      </div>
                    )}
                  </FormField>
                </div>

                <div className="border-t border-ink-100 pt-6">
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                    <QrCode size={12} /> Payment
                  </div>
                  <FormField label="Payment QR / instructions image" hint="Shown to players during registration so they know how to pay.">
                    <ImageDropzone
                      imagePath={event.payment_qr_path}
                      getUrl={getEventMediaUrl}
                      onUpload={handleQrUpload}
                      uploading={uploadingQr}
                      onRemove={removeQr}
                      className="h-32 w-32"
                      emptyIcon={QrCode}
                      emptyLabel="No image yet"
                    />
                  </FormField>
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <StepHeader title="Player registration questions" subtitle="Extra info players fill in after picking a category" />
              <div className="flex flex-col gap-2">
                {fields.map((f) => (
                  <RegistrationFieldEditor key={f.id} field={f} onSave={saveRegField} onDelete={() => removeField(f)} />
                ))}
                <button
                  onClick={addField}
                  className="flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
                >
                  <Plus size={13} /> Add question
                </button>
              </div>
            </>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-ink-100 pt-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold text-ink-500 transition hover:bg-ink-100 disabled:opacity-0"
            >
              <ChevronLeft size={14} /> Back
            </button>
            <span className="text-[11px] font-semibold text-ink-400">
              Step {step + 1} of {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="flex items-center gap-1 rounded-full bg-ink-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-ink-800"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={togglePublish}
                className="flex items-center gap-1 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
              >
                {event.is_published ? 'Unpublish' : 'Publish event'}
              </button>
            )}
          </div>
        </div>
      </div>

      {user && <HintsTour steps={TOUR_STEPS} storageKey={`dm_event_editor_tour_seen_${user.id}`} />}
    </OrganizerLayout>
  );
}
