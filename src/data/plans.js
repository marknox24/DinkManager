// The product catalog — what each plan tier includes. This is NOT what gets
// enforced against a given event: an event's own limits are the snapshot
// stored on its row (events.entitlement_*), copied from here at the moment
// that plan was activated for that event, so a later edit to these numbers
// never retroactively changes an event that already purchased a tier.
// Postgres can't import this file, so the database keeps its own copy in
// the plan_catalog table (supabase/schema.sql) — that copy is what actually
// gets snapshotted onto events (Free Trial on creation, a paid plan by
// activate_purchase() on approval) and recorded as the amount paid. Keep
// the two in sync when changing a tier or a price.
export const PLAN_ORDER = ['free', 'starter', 'pro', 'business'];

export const PLAN_LIMITS = {
  free: { label: 'Free Trial', price: 0, categories: 1, playersPerCategory: 10, courts: 1, csvImport: false },
  starter: { label: 'Starter', price: 699, categories: 5, playersPerCategory: 30, courts: 4, csvImport: true },
  pro: { label: 'Pro', price: 899, categories: 10, playersPerCategory: 64, courts: 8, csvImport: true },
  // null = unlimited.
  business: { label: 'Business', price: 1099, categories: null, playersPerCategory: 128, courts: 16, csvImport: true },
};

// The plans a visitor can actually pay for on /subscribe/:plan — Free Trial
// needs no payment, so it isn't offered there.
export const PAID_PLAN_ORDER = PLAN_ORDER.filter((p) => p !== 'free');
