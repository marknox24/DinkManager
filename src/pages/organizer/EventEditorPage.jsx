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
  Contact as ContactIcon,
  ListChecks,
  MapPin,
  Plus,
  QrCode,
  Trophy,
} from 'lucide-react';
import {
  createCategory,
  createRegistrationField,
  deleteCategory,
  deleteRegistrationField,
  getEventById,
  listCategories,
  listRegistrationFields,
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

const STATUS_OPTIONS = ['upcoming', 'ongoing', 'finished', 'cancelled', 'rescheduled'];

const STEPS = [
  { id: 'basics', label: 'Basics', icon: MapPin },
  { id: 'contact', label: 'Contact', icon: ContactIcon },
  { id: 'details', label: 'Description', icon: FileText },
  { id: 'categories', label: 'Categories', icon: Trophy },
  { id: 'logistics', label: 'Logistics', icon: QrCode },
  { id: 'registration', label: 'Registration', icon: ListChecks },
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

  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [fields, setFields] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [step, setStep] = useState(0);

  useEffect(() => {
    Promise.all([getEventById(eventId), listCategories(eventId), listRegistrationFields(eventId)])
      .then(([ev, cats, flds]) => {
        setEvent(ev);
        setCategories(cats);
        setFields(flds);
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
    }
    await saveField({ is_published: !event.is_published });
    pushToast(event.is_published ? 'Event unpublished' : 'Event published — the public page is live', 'success');
  };

  const addCategory = async () => {
    try {
      const cat = await createCategory(
        eventId,
        { name: 'New Category', match_type: 'Singles', format: 'Round Robin', fee_amount: 0, fee_currency: 'USD' },
        categories.length
      );
      setCategories((prev) => [...prev, cat]);
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

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { path } = await uploadEventMedia(eventId, file);
      await saveField({ payment_qr_path: path });
    } catch (err) {
      pushToast(err.message, 'error');
    }
  };

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
              {event.is_published && (
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
              onClick={togglePublish}
              className={`rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition ${
                event.is_published ? 'bg-ink-600 hover:bg-ink-700' : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {event.is_published ? 'Unpublish' : 'Publish event'}
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-1 sm:gap-1.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => setStep(i)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold transition sm:px-3 ${
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
                  <select value={event.status} onChange={(e) => saveField({ status: e.target.value })} className={inputClass}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
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
              <StepHeader title="Description & rules" />
              <div className="flex flex-col gap-4">
                <FormField label="Tournament description">
                  <textarea
                    defaultValue={event.description || ''}
                    onBlur={(e) => saveField({ description: e.target.value })}
                    placeholder="Welcome players to a weekend of competitive pickleball! Describe the vibe, skill levels welcome, and what makes this tournament worth signing up for."
                    className={textareaClass}
                  />
                </FormField>
                <FormField label="Rules & regulations">
                  <textarea
                    defaultValue={event.rules || ''}
                    onBlur={(e) => saveField({ rules: e.target.value })}
                    placeholder={'1. Matches are best-of-3 games to 11, win by 2.\n2. Players must check in 15 minutes before their scheduled match.\n3. USAPA/official paddle and ball specs apply.\n4. No-shows after a 10-minute grace period forfeit the match.'}
                    className={textareaClass}
                  />
                </FormField>
                <FormField label="Venue-specific guidelines">
                  <textarea
                    defaultValue={event.venue_guidelines || ''}
                    onBlur={(e) => saveField({ venue_guidelines: e.target.value })}
                    placeholder="Parking is available on-site. Indoor court shoes only (no marking soles). Spectators must stay behind the fence line. Food and drinks allowed in the lobby only."
                    className={textareaClass}
                  />
                </FormField>
                <FormField label="Schedule of play">
                  <textarea
                    defaultValue={event.schedule || ''}
                    onBlur={(e) => saveField({ schedule: e.target.value })}
                    placeholder={'7:00 AM - Check-in opens\n8:00 AM - Opening remarks\n8:30 AM - Pool play begins\n1:00 PM - Lunch break\n2:00 PM - Bracket play\n5:00 PM - Awards ceremony'}
                    className={textareaClass}
                  />
                </FormField>
                <FormField label="FAQ" hint="Optional">
                  <textarea
                    defaultValue={event.faq || ''}
                    onBlur={(e) => saveField({ faq: e.target.value })}
                    placeholder={'Q: Can I register on the day of the event?\nA: Walk-in registrations are subject to availability.\n\nQ: Is there a refund policy?\nA: Full refunds up to 7 days before the event.'}
                    className={textareaClass}
                  />
                </FormField>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepHeader title="Categories, fees & prizes" subtitle="Players choose one of these when they register" />
              <div className="flex flex-col gap-3">
                {categories.map((cat) => (
                  <CategoryEditor key={cat.id} eventId={eventId} category={cat} onSave={saveCategory} onDelete={() => removeCategory(cat)} />
                ))}
                {categories.length === 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
                    <Award size={14} /> Add at least one category before publishing.
                  </div>
                )}
                <button
                  onClick={addCategory}
                  className="flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
                >
                  <Plus size={13} /> Add category
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepHeader title="Logistics & media" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Available courts">
                  <input
                    type="number"
                    min={0}
                    defaultValue={event.num_courts ?? ''}
                    onBlur={(e) => saveField({ num_courts: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Your club name" hint="Used later to keep players from the same club apart when brackets are drawn.">
                  <input defaultValue={event.club_name || ''} onBlur={(e) => saveField({ club_name: e.target.value })} className={inputClass} />
                </FormField>
                <FormField label="Payment QR / instructions image" className="sm:col-span-2">
                  <div className="flex items-center gap-4">
                    {event.payment_qr_path ? (
                      <img src={getEventMediaUrl(event.payment_qr_path)} alt="Payment QR" className="h-20 w-20 rounded-xl border border-ink-200 object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-ink-300 text-ink-300">
                        <QrCode size={22} />
                      </div>
                    )}
                    <label className="cursor-pointer rounded-full border border-ink-200 px-4 py-2 text-xs font-bold text-ink-600 transition hover:bg-ink-100">
                      Upload image
                      <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" />
                    </label>
                  </div>
                </FormField>
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
    </OrganizerLayout>
  );
}
