import { ShieldCheck, XCircle } from 'lucide-react';
import { renderRichText } from '../../utils/richText';

// Shared between PublicEventPage.jsx's category detail modal and
// RegisterPage.jsx's category picker — a category's eligibility checklist,
// qualification notes, and disqualification conditions, each optional.
export default function QualificationPanel({ qualification = [], qualificationNotes, disqualificationNotes }) {
  const hasContent = qualification.length > 0 || qualificationNotes || disqualificationNotes;
  if (!hasContent) return null;

  return (
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
      {qualificationNotes && (
        <p className="mb-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{renderRichText(qualificationNotes)}</p>
      )}
      {disqualificationNotes && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-white p-3 text-xs text-rose-700">
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span>{renderRichText(disqualificationNotes)}</span>
        </div>
      )}
    </div>
  );
}
