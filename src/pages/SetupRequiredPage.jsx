import { DatabaseZap } from 'lucide-react';

export default function SetupRequiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4">
      <div className="w-full max-w-lg rounded-3xl border border-ink-100 bg-white p-8 shadow-sm">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <DatabaseZap size={20} strokeWidth={2.3} />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-ink-900">Connect Supabase to continue</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          DinkManager needs a Supabase project for organizer accounts, events, and player registrations. To finish setup:
        </p>
        <ol className="mt-4 flex flex-col gap-2.5 text-sm text-ink-700">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">1</span>
            Create a free project at{' '}
            <a href="https://supabase.com" target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">
              supabase.com
            </a>
            .
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">2</span>
            Open the SQL editor and run <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">supabase/schema.sql</code> from this project.
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">3</span>
            Copy <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">.env.local.example</code> to{' '}
            <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">.env.local</code> and fill in your Project URL and anon key
            (Project Settings → API).
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">4</span>
            Restart the dev server.
          </li>
        </ol>
      </div>
    </div>
  );
}
