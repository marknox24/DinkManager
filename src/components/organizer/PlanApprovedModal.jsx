import { PartyPopper } from 'lucide-react';

// Same hand-rolled overlay pattern as WelcomeOnboardingModal.jsx (not the
// generic Modal.jsx) — visual sibling to that pop-up and PricingPromptModal
// on this same page, so all three feel like one family.
export default function PlanApprovedModal({ event, onClose, onUpdateEvent }) {
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="animate-modal-in relative w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <PartyPopper size={26} strokeWidth={2.3} />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-ink-900">Event approved!</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Your event <span className="font-semibold text-ink-700">&ldquo;{event.name}&rdquo;</span> was successfully approved — you're all set to run it.
        </p>

        <button
          onClick={onUpdateEvent}
          className="press-scale mt-6 flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          Update your event
        </button>
        <button onClick={onClose} className="mt-3 w-full text-center text-xs font-semibold text-ink-400 hover:text-ink-600">
          Maybe later
        </button>
      </div>
    </div>
  );
}
