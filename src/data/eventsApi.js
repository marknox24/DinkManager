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

export async function listMyEvents(organizerId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getEventById(eventId) {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (error) throw error;
  return data;
}

export async function getPublicEventBySlug(slug) {
  const { data, error } = await supabase.from('events').select('*').eq('slug', slug).eq('is_published', true).single();
  if (error) throw error;
  return data;
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
  return data;
}

export async function deleteRegistration(registrationId) {
  const { error } = await supabase.from('registrations').delete().eq('id', registrationId);
  if (error) throw error;
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
