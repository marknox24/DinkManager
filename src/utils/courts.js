// Courts an event can actually run matches on: the organizer's configured
// count, but never more than the event's plan allows. An unset count falls
// back to 4 (the app's long-standing default) — which is exactly how a Free
// Trial event (1 court) used to get 4 courts' worth of live matches, so the
// plan cap applies to the fallback too. The database enforces the same cap
// on num_courts and on each match's court (see schema.sql).
export function usableCourts(event) {
  const configured = event?.num_courts ?? 4;
  const cap = event?.entitlement_courts;
  return cap == null ? configured : Math.min(configured, cap);
}
