import { supabase } from '../lib/supabaseClient';

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}

export async function generateUniqueSlug(name) {
  const base = slugify(name) || 'event';
  let candidate = base;
  let attempt = 0;
  // Keep trying until we find a slug that isn't taken.
  while (attempt < 20) {
    const { data, error } = await supabase.from('events').select('id').eq('slug', candidate).maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    attempt += 1;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// EVENTS
// ---------------------------------------------------------------------------
// Every event starts on Free Trial, full stop — never inherited from the
// organizer's account or from any other event they own (one payment = one
// event = one plan entitlement). The database sets that starting plan and
// entitlement snapshot itself (the events_force_free_entitlements trigger in
// schema.sql), so nothing here can choose it. A paid tier only ever arrives
// later, via a specific approved upgrade request for THIS event (see
// submitEventPlanUpgrade below + supabase/functions/approve-subscription-request).
export async function createEvent(organizerId, payload) {
  const slug = await generateUniqueSlug(payload.name || 'event');
  const { data, error } = await supabase
    .from('events')
    .insert({ ...payload, organizer_id: organizerId, slug })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Copies only the descriptive/template fields of a completed (or any other)
// event into a brand-new draft — never its plan, payment, entitlements,
// categories, brackets, teams, registrations, or matches. The duplicate
// starts exactly like any other new event: Free Trial, unpublished, zero
// usage, requiring its own separate plan purchase (see rule "duplicating a
// completed event" — a new event is a new purchase, not a clone of the old
// one's paid status). num_courts is deliberately reset to null rather than
// copied — the source event's court count may have come from a paid tier
// this new (Free Trial) event hasn't purchased yet.
export async function duplicateEvent(eventId) {
  const source = await getEventById(eventId);
  const name = `Copy of ${source.name}`;
  const slug = await generateUniqueSlug(name);
  const { data, error } = await supabase
    .from('events')
    .insert({
      organizer_id: source.organizer_id,
      name,
      slug,
      status: 'upcoming',
      is_published: false,
      visibility: 'public',
      share_token: null,
      location_address: source.location_address,
      description: source.description,
      rules: source.rules,
      venue_guidelines: source.venue_guidelines,
      schedule: source.schedule,
      faq: source.faq,
      court_type: source.court_type,
      contacts: source.contacts,
      currency: source.currency,
      cover_photo_path: source.cover_photo_path,
      organizer_name: source.organizer_name,
      prize_pool: source.prize_pool,
      cancellation_policy: source.cancellation_policy,
      refund_policy: source.refund_policy,
      randomizer_allow_same_club: source.randomizer_allow_same_club,
      match_duration_minutes: source.match_duration_minutes,
      duplicated_from: source.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(eventId, payload) {
  const { data, error } = await supabase
    .from('events')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(eventId) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

// Includes a `player_count` per event (pending + approved registrations —
// same "active" definition as the public_category_counts view) and a
// `pending_plan_request` (the event's own unresolved upgrade request, if
// any) so the dashboard cards can show current registration numbers and
// "Payment Pending" state at a glance. There's no payment_status column on
// events (see schema.sql's "EVENT PLAN ENTITLEMENTS" comment) — a pending
// upgrade is derived purely from whether an unresolved subscription_requests
// row exists for that event, not stored redundantly on the event itself.
export async function listMyEvents(organizerId) {
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (events.length === 0) return events;

  const eventIds = events.map((e) => e.id);
  const [{ data: regs, error: regErr }, { data: pendingRequests, error: pendingErr }] = await Promise.all([
    supabase.from('registrations').select('event_id, status').in('event_id', eventIds),
    supabase.from('subscription_requests').select('id, event_id, plan').eq('status', 'pending').in('event_id', eventIds),
  ]);
  if (regErr) throw regErr;
  if (pendingErr) throw pendingErr;

  const counts = {};
  regs.forEach((r) => {
    if (r.status === 'pending' || r.status === 'approved') {
      counts[r.event_id] = (counts[r.event_id] || 0) + 1;
    }
  });
  const pendingByEvent = {};
  pendingRequests.forEach((r) => {
    pendingByEvent[r.event_id] = { id: r.id, plan: r.plan };
  });
  return events.map((e) => ({ ...e, player_count: counts[e.id] || 0, pending_plan_request: pendingByEvent[e.id] || null }));
}

// Events this user is helping with as staff (not the owner). Deliberately
// doesn't compute player_count the way listMyEvents does — a staffer
// without the Registrations toggle would get 0 rows back from that query,
// which would misleadingly render as "0 players" on the card.
export async function listStaffedEvents(userId) {
  const { data: staffRows, error: staffErr } = await supabase
    .from('event_staff')
    .select('*')
    .eq('user_id', userId)
    .order('invited_at', { ascending: false });
  if (staffErr) throw staffErr;
  if (staffRows.length === 0) return [];

  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .in(
      'id',
      staffRows.map((s) => s.event_id)
    );
  if (error) throw error;

  const eventsById = {};
  events.forEach((e) => {
    eventsById[e.id] = e;
  });
  return staffRows
    .filter((s) => eventsById[s.event_id])
    .map((s) => ({ ...eventsById[s.event_id], staff: s }));
}

export async function getEventById(eventId) {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (error) throw error;
  return data;
}

export async function getPublicEventBySlug(slug) {
  const { data, error } = await supabase.from('events').select('*').eq('slug', slug).eq('is_published', true).eq('visibility', 'public').single();
  if (error) throw error;
  return data;
}

// Resolves a private event via its secret share link instead of its slug —
// visibility is irrelevant here since the token itself is the credential.
export async function getPublicEventByShareToken(token) {
  const { data, error } = await supabase.from('events').select('*').eq('share_token', token).eq('is_published', true).single();
  if (error) throw error;
  return data;
}

// Cross-organizer feed for the public /tournaments browse page. Anyone
// (anonymous) can call this — the same RLS policy that already lets anon
// read a single published event by slug lets this read the full public set.
// Excludes cancelled events (nothing to register for) but keeps finished
// ones visible, de-emphasized via StatusBadge rather than hidden outright.
// Also excludes events organized by a trial account (profiles.access_expires_at
// set) — a player/anonymous caller can't read another account's profile row
// directly, so that filter runs server-side via the public_published_events()
// security-definer function rather than a client-side join.
export async function getPublishedEvents() {
  const { data, error } = await supabase.rpc('public_published_events');
  if (error) throw error;
  return data;
}

// Toggles an event public/private. Switching to private for the first time
// mints a share token (kept stable across later toggles so a link the
// organizer already sent out keeps working).
export async function setEventVisibility(eventId, visibility, existingToken) {
  const patch = { visibility };
  if (visibility === 'private' && !existingToken) {
    patch.share_token = crypto.randomUUID();
  }
  return updateEvent(eventId, patch);
}

// Rotates the share link, invalidating the old one immediately.
export async function regenerateShareToken(eventId) {
  return updateEvent(eventId, { share_token: crypto.randomUUID() });
}

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------
export async function listCategories(eventId) {
  const { data, error } = await supabase.from('categories').select('*').eq('event_id', eventId).order('order_index');
  if (error) throw error;
  return data;
}

export async function createCategory(eventId, payload, orderIndex) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...payload, event_id: eventId, order_index: orderIndex })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(categoryId, payload) {
  const { data, error } = await supabase.from('categories').update(payload).eq('id', categoryId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(categoryId) {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  if (error) throw error;
}

export async function listCategoryCounts(eventId) {
  const { data, error } = await supabase.from('public_category_counts').select('*').eq('event_id', eventId);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// REGISTRATION FIELDS (organizer-defined extra questions)
// ---------------------------------------------------------------------------
export async function listRegistrationFields(eventId) {
  const { data, error } = await supabase
    .from('registration_fields')
    .select('*')
    .eq('event_id', eventId)
    .order('order_index');
  if (error) throw error;
  return data;
}

export async function createRegistrationField(eventId, payload, orderIndex) {
  const { data, error } = await supabase
    .from('registration_fields')
    .insert({ ...payload, event_id: eventId, order_index: orderIndex })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRegistrationField(fieldId, payload) {
  const { data, error } = await supabase.from('registration_fields').update(payload).eq('id', fieldId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRegistrationField(fieldId) {
  const { error } = await supabase.from('registration_fields').delete().eq('id', fieldId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// REGISTRATIONS (players)
// ---------------------------------------------------------------------------
export async function submitRegistration(payload) {
  // No .select() here: a genuinely anonymous submitter (no player_id, no
  // session) has no RLS select policy match on this table, and Postgres
  // requires an INSERT ... RETURNING row to satisfy one — asking for the
  // row back would make anonymous registration fail. The caller doesn't
  // use the inserted row, so we don't request it.
  const { error } = await supabase.from('registrations').insert(payload);
  if (error) throw error;
}

// Organizer-authenticated inserts (manual add + Excel import) — unlike
// submitRegistration, these can request the row back since the organizer
// satisfies the registrations_select_owner RLS policy.
export async function createRegistration(payload) {
  const { data, error } = await supabase
    .from('registrations')
    .insert({ status: 'approved', ...payload })
    .select('*, categories(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function createRegistrationsBulk(payloads) {
  if (payloads.length === 0) return [];
  const { data, error } = await supabase
    .from('registrations')
    .insert(payloads.map((p) => ({ status: 'approved', ...p })))
    .select('*, categories(name)');
  if (error) throw error;
  return data;
}

export async function listRegistrations(eventId) {
  const { data, error } = await supabase
    .from('registrations')
    .select('*, categories(name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateRegistrationStatus(registrationId, status) {
  const { data, error } = await supabase.from('registrations').update({ status }).eq('id', registrationId).select().single();
  if (error) throw error;
  return data;
}

export async function updateRegistration(registrationId, patch) {
  const { data, error } = await supabase.from('registrations').update(patch).eq('id', registrationId).select('*, categories(name)').single();
  if (error) throw error;

  // Once a bracket is drawn, `teams.player1_name`/`player2_name` are their
  // own copy captured at draw time (see generateBrackets in bracketsApi.js)
  // rather than a live reference back to this registration — without this,
  // a post-draw name correction (a typo fix) would silently never reach
  // standings, the match list, live match cards, or printable score sheets.
  // No-ops harmlessly if no team was ever drawn for this registration.
  if ('player_name' in patch || 'player2_name' in patch) {
    const { error: teamErr } = await supabase
      .from('teams')
      .update({ player1_name: data.player_name, player2_name: data.player2_name })
      .eq('registration_id', registrationId);
    if (teamErr) throw teamErr;
  }

  return data;
}

export async function deleteRegistration(registrationId) {
  const { error } = await supabase.from('registrations').delete().eq('id', registrationId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// CHECK-IN  (public, anonymous — QR scan -> pick category -> pick name)
// Reads go through the public_checkin_roster view (PII-free by design); the
// UPDATE below is only ever allowed to touch the two checked_in_at columns —
// see the RLS/column-grant comments in schema.sql. Because anon has no
// SELECT policy on the registrations base table, chaining .select() onto
// the update would come back empty (RETURNING is itself SELECT-gated) —
// re-fetching through the view afterward is what actually works.
// ---------------------------------------------------------------------------
export async function listCheckinRoster(eventId, categoryId) {
  const { data, error } = await supabase
    .from('public_checkin_roster')
    .select('*')
    .eq('event_id', eventId)
    .eq('category_id', categoryId);
  if (error) throw error;
  return data;
}

export async function getCheckinRegistration(registrationId) {
  const { data, error } = await supabase.from('public_checkin_roster').select('*').eq('id', registrationId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function checkInPlayer(registrationId, slot) {
  const patch = slot === 'player2' ? { player2_checked_in_at: new Date().toISOString() } : { player1_checked_in_at: new Date().toISOString() };
  const { error } = await supabase.from('registrations').update(patch).eq('id', registrationId);
  if (error) throw error;
  return getCheckinRegistration(registrationId);
}

// Un-checks a single slot — used when a lone doubles check-in's 5-minute
// partner wait times out, so the held spot is released instead of staying
// checked in with no partner.
export async function expireCheckin(registrationId, slot) {
  const patch = slot === 'player2' ? { player2_checked_in_at: null } : { player1_checked_in_at: null };
  const { error } = await supabase.from('registrations').update(patch).eq('id', registrationId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// SPONSORS
// ---------------------------------------------------------------------------
export async function listSponsors(eventId) {
  const { data, error } = await supabase.from('sponsors').select('*').eq('event_id', eventId).order('order_index');
  if (error) throw error;
  return data;
}

export async function createSponsor(eventId, payload, orderIndex) {
  const { data, error } = await supabase
    .from('sponsors')
    .insert({ ...payload, event_id: eventId, order_index: orderIndex })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSponsor(sponsorId, payload) {
  const { data, error } = await supabase.from('sponsors').update(payload).eq('id', sponsorId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSponsor(sponsorId) {
  const { error } = await supabase.from('sponsors').delete().eq('id', sponsorId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// ACCOUNTING — expenses, manual earnings, and registration-fee earnings
// (the latter computed on the fly, never stored, so it can't drift from the
// registrations it's derived from)
// ---------------------------------------------------------------------------
export async function listExpenses(eventId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('event_id', eventId)
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createExpense(eventId, payload) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...payload, event_id: eventId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateExpense(expenseId, payload) {
  const { data, error } = await supabase.from('expenses').update(payload).eq('id', expenseId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(expenseId) {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

export async function listEarnings(eventId) {
  const { data, error } = await supabase
    .from('earnings')
    .select('*')
    .eq('event_id', eventId)
    .order('earning_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createEarning(eventId, payload) {
  const { data, error } = await supabase
    .from('earnings')
    .insert({ ...payload, event_id: eventId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEarning(earningId, payload) {
  const { data, error } = await supabase.from('earnings').update(payload).eq('id', earningId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEarning(earningId) {
  const { error } = await supabase.from('earnings').delete().eq('id', earningId);
  if (error) throw error;
}

// Registration-fee revenue per category: approved registrations x that
// category's fee_amount. "Approved" (not pending/waitlisted/denied) is the
// conservative read of "earned" — a slot that was never confirmed shouldn't
// count as collected revenue.
export async function getRegistrationEarnings(eventId) {
  const [{ data: cats, error: catErr }, { data: regs, error: regErr }] = await Promise.all([
    supabase.from('categories').select('id, name, fee_amount, fee_currency').eq('event_id', eventId),
    supabase.from('registrations').select('category_id, status').eq('event_id', eventId),
  ]);
  if (catErr) throw catErr;
  if (regErr) throw regErr;

  const approvedCounts = {};
  regs.forEach((r) => {
    if (r.status === 'approved') approvedCounts[r.category_id] = (approvedCounts[r.category_id] || 0) + 1;
  });

  return cats.map((c) => ({
    category_id: c.id,
    category_name: c.name,
    fee_amount: Number(c.fee_amount) || 0,
    fee_currency: c.fee_currency,
    approved_count: approvedCounts[c.id] || 0,
    total: (approvedCounts[c.id] || 0) * (Number(c.fee_amount) || 0),
  }));
}

// ---------------------------------------------------------------------------
// UMPIRES
// ---------------------------------------------------------------------------
export async function listUmpires(eventId) {
  const { data, error } = await supabase.from('umpires').select('*').eq('event_id', eventId).order('created_at');
  if (error) throw error;
  return data;
}

export async function createUmpire(eventId, name) {
  const { data, error } = await supabase.from('umpires').insert({ event_id: eventId, name }).select().single();
  if (error) throw error;
  return data;
}

export async function updateUmpire(umpireId, name) {
  const { data, error } = await supabase.from('umpires').update({ name }).eq('id', umpireId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUmpire(umpireId) {
  const { error } = await supabase.from('umpires').delete().eq('id', umpireId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// ACTIVITY LOG
// ---------------------------------------------------------------------------
export async function listActivity(eventId, limit = 30) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// STORAGE
// ---------------------------------------------------------------------------
export async function uploadEventMedia(eventId, file) {
  const path = `${eventId}/${Date.now()}-${slugify(file.name)}`;
  const { error } = await supabase.storage.from('event-media').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('event-media').getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function uploadRegistrationFile(eventId, file) {
  const path = `${eventId}/${Date.now()}-${slugify(file.name)}`;
  const { error } = await supabase.storage.from('registration-uploads').upload(path, file);
  if (error) throw error;
  return { path };
}

export async function uploadExpenseReceipt(eventId, file) {
  const path = `${eventId}/${Date.now()}-${slugify(file.name)}`;
  const { error } = await supabase.storage.from('event-receipts').upload(path, file);
  if (error) throw error;
  return { path };
}

export async function getExpenseReceiptUrl(path) {
  const { data, error } = await supabase.storage.from('event-receipts').createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function getRegistrationFileUrl(path) {
  const { data, error } = await supabase.storage.from('registration-uploads').createSignedUrl(path, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

export function getEventMediaUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from('event-media').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// SUBSCRIPTION REQUESTS  (manual/QR payment flow — see supabase/schema.sql's
// "SUBSCRIPTION REQUESTS" section and supabase/functions/approve-subscription-request)
// ---------------------------------------------------------------------------
export async function uploadSubscriptionProof(file) {
  const path = `${Date.now()}-${slugify(file.name)}`;
  const { error } = await supabase.storage.from('subscription-proofs').upload(path, file);
  if (error) throw error;
  return { path };
}

export async function getSubscriptionProofUrl(path) {
  const { data, error } = await supabase.storage.from('subscription-proofs').createSignedUrl(path, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

// No .select() here deliberately — an anonymous submitter has no SELECT
// policy on subscription_requests (only subscription_requests_select_admin
// exists), and Postgres rejects the whole INSERT when a RETURNING clause
// can't satisfy that row's SELECT policy, not just the returned data. The
// caller doesn't use the inserted row anyway (see SubscribePage.jsx).
export async function submitSubscriptionRequest({ email, plan, screenshotPath }) {
  const { error } = await supabase.from('subscription_requests').insert({ email, plan, screenshot_path: screenshotPath });
  if (error) throw error;
}

// Event-scoped upgrade request — the organizer is already authenticated and
// owns eventId (enforced by subscription_requests_insert_public's RLS), so
// unlike submitSubscriptionRequest above this never touches account
// creation/invites. Approving this (see approve-subscription-request)
// writes the purchased plan onto THIS event alone, never onto the
// organizer's account or any other event they own. No .select() for the
// same reason as submitSubscriptionRequest — the caller doesn't need the
// inserted row back, and a non-admin has no SELECT policy on this table.
export async function submitEventPlanUpgrade({ eventId, plan, screenshotPath }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('subscription_requests')
    .insert({ email: user?.email ?? '', plan, screenshot_path: screenshotPath, event_id: eventId });
  if (error) throw error;
}

// Single-event counterpart to listMyEvents' bulk pending_plan_request lookup
// — used by SettingsPage.jsx's Event Plan card, which only ever looks at
// one event at a time.
export async function getPendingPlanRequestForEvent(eventId) {
  const { data, error } = await supabase
    .from('subscription_requests')
    .select('id, plan')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSubscriptionRequests() {
  const { data, error } = await supabase
    .from('subscription_requests')
    // FK named explicitly: events.plan_payment_id also links these two
    // tables, and PostgREST refuses an ambiguous embed.
    .select('*, event:events!subscription_requests_event_id_fkey(id, name, organizer_id)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function rejectSubscriptionRequest(requestId, adminNote) {
  const { data, error } = await supabase
    .from('subscription_requests')
    .update({ status: 'rejected', admin_note: adminNote || null, resolved_at: new Date().toISOString() })
    .eq('id', requestId)
    .select('*, event:events!subscription_requests_event_id_fkey(id, name, organizer_id)')
    .single();
  if (error) throw error;
  return data;
}

// Rejected -> pending again (rejected by mistake, or the customer sent a
// corrected screenshot), so it can be approved normally. The admin_note is
// kept as a record of why it was rejected. RLS refuses this on approved rows.
export async function reopenSubscriptionRequest(requestId) {
  const { data, error } = await supabase
    .from('subscription_requests')
    .update({ status: 'pending', resolved_at: null })
    .eq('id', requestId)
    .eq('status', 'rejected')
    .select('*, event:events!subscription_requests_event_id_fkey(id, name, organizer_id)')
    .single();
  if (error) throw error;
  return data;
}

// Pending/rejected only — RLS refuses approved rows, which are the record of
// what was paid. The screenshot is removed after the row, best-effort: a
// leftover file in the private bucket is harmless, a leftover row isn't.
export async function deleteSubscriptionRequest(request) {
  const { data, error } = await supabase.from('subscription_requests').delete().eq('id', request.id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This request could not be deleted — approved requests are kept as a payment record.');
  if (request.screenshot_path) {
    await supabase.storage.from('subscription-proofs').remove([request.screenshot_path]);
  }
}

// ---------------------------------------------------------------------------
// APP SETTINGS  (platform-wide singleton row — currently just the one
// payment QR image shown on /subscribe/:plan)
// ---------------------------------------------------------------------------
export async function getAppSettings() {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', true).single();
  if (error) throw error;
  return data;
}

// Stored in the existing public event-media bucket under a reserved
// 'platform/' path (see the event_media_admin_write storage policy) rather
// than a new bucket, since it needs to be publicly viewable by anonymous
// visitors the same way event cover photos already are.
export async function uploadPaymentQr(file) {
  const path = `platform/${Date.now()}-${slugify(file.name)}`;
  const { error } = await supabase.storage.from('event-media').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data, error: updateErr } = await supabase.from('app_settings').update({ payment_qr_path: path }).eq('id', true).select().single();
  if (updateErr) throw updateErr;
  return data;
}

// ---------------------------------------------------------------------------
// ONBOARDING
// ---------------------------------------------------------------------------
// Derives "getting started" progress from real account data instead of a
// separate tracked flag, so it always reflects what the organizer has
// actually done and needs no manual bookkeeping to stay in sync.
export async function getOnboardingProgress(organizerId) {
  const { data: events, error } = await supabase.from('events').select('id, is_published').eq('organizer_id', organizerId);
  if (error) throw error;

  const hasEvent = events.length > 0;
  const hasPublished = events.some((e) => e.is_published);
  if (!hasEvent) {
    return { hasEvent, hasCategory: false, hasPublished, hasApprovedRegistration: false, hasBracket: false };
  }

  const eventIds = events.map((e) => e.id);
  const [{ data: categories, error: catErr }, { data: approvedRegs, error: regErr }] = await Promise.all([
    supabase.from('categories').select('id').in('event_id', eventIds),
    supabase.from('registrations').select('id').in('event_id', eventIds).eq('status', 'approved').limit(1),
  ]);
  if (catErr) throw catErr;
  if (regErr) throw regErr;

  const hasCategory = categories.length > 0;
  const hasApprovedRegistration = approvedRegs.length > 0;

  let hasBracket = false;
  if (hasCategory) {
    const { data: brackets, error: bracketErr } = await supabase
      .from('brackets')
      .select('id')
      .in('category_id', categories.map((c) => c.id))
      .limit(1);
    if (bracketErr) throw bracketErr;
    hasBracket = brackets.length > 0;
  }

  return { hasEvent, hasCategory, hasPublished, hasApprovedRegistration, hasBracket };
}
