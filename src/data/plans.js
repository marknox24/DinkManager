// Canonical per-event plan tiers — the single source of truth for the
// numeric caps shown in marketing copy (Pricing.jsx, UpgradeModal.jsx) and
// actually enforced against an event's self-declared `plan` column
// (EventEditorPage.jsx's category count, RegistrationsPage.jsx's approved-
// player count, SettingsPage.jsx's court count). Postgres/edge functions
// can't import this file, so the same numbers are hand-duplicated in the
// `categories_insert_owner` RLS policy in supabase/schema.sql — keep both
// in sync when changing a limit.
export const PLAN_ORDER = ['free', 'starter', 'pro', 'business'];

export const PLAN_LIMITS = {
  free: { label: 'Free Trial', price: 0, categories: 1, playersPerCategory: 10, courts: 1 },
  starter: { label: 'Starter', price: 699, categories: 5, playersPerCategory: 30, courts: 4 },
  pro: { label: 'Pro', price: 899, categories: 10, playersPerCategory: 64, courts: 8 },
  // null = unlimited.
  business: { label: 'Business', price: 1099, categories: null, playersPerCategory: 128, courts: 16 },
};

// The plans a visitor can actually pay for on /subscribe/:plan — Free Trial
// needs no payment, so it isn't offered there.
export const PAID_PLAN_ORDER = PLAN_ORDER.filter((p) => p !== 'free');

export function planLimit(plan, key) {
  return (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free)[key];
}
