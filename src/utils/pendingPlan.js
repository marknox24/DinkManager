import { PAID_PLAN_ORDER } from '../data/plans';

// The paid plan a visitor picked on the website, remembered until they've
// signed up, confirmed their email and logged in — none of which keeps a
// URL parameter (the confirmation email and Google sign-in both land on a
// fresh URL). The dashboard reads it to open the pricing pop-up with that
// plan pre-selected (see PricingPromptModal). Storage can be unavailable
// (private mode, blocked site data), so every access is best-effort.
const KEY = 'dm_pending_plan';

export function rememberPlan(plan) {
  if (!PAID_PLAN_ORDER.includes(plan)) return;
  try {
    localStorage.setItem(KEY, plan);
  } catch {
    // Not remembered — the pop-up just opens without a pre-selected plan.
  }
}

export function pendingPlan() {
  try {
    const plan = localStorage.getItem(KEY);
    return PAID_PLAN_ORDER.includes(plan) ? plan : null;
  } catch {
    return null;
  }
}

export function clearPendingPlan() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

// Where a website "choose this plan" button goes: sign up first when logged
// out (the plan is remembered), otherwise straight to the dashboard's
// pricing pop-up with the plan pre-selected. Free Trial has no plan to
// carry — just sign-up, or the dashboard.
export function planEntryPath(plan, signedIn) {
  const paid = PAID_PLAN_ORDER.includes(plan);
  if (signedIn) return paid ? `/dashboard?plan=${plan}` : '/dashboard';
  return paid ? `/signup?plan=${plan}` : '/signup';
}
