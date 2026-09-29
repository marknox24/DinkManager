import { supabase } from '../lib/supabaseClient';

export async function listMyRegistrations(playerId) {
  const { data, error } = await supabase
    .from('registrations')
    .select('*, events(name, slug, status, visibility, share_token, start_date, end_date, location_address), categories(name)')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Maps registration_id -> { letter, wins, losses } for this player's own teams.
export async function getMyBracketResults(registrationIds) {
  if (registrationIds.length === 0) return {};
  const { data, error } = await supabase
    .from('teams')
    .select('registration_id, wins, losses, brackets(letter)')
    .in('registration_id', registrationIds);
  if (error) throw error;
  const results = {};
  data.forEach((t) => {
    results[t.registration_id] = { letter: t.brackets?.letter, wins: t.wins, losses: t.losses };
  });
  return results;
}

// No joins — just enough to build an event_id -> registrations[] map for
// "am I registered in this event" badges on card grids, without dragging in
// listMyRegistrations()'s full event/category join.
export async function listMyRegistrationSummaries(playerId) {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, event_id, category_id, status')
    .eq('player_id', playerId);
  if (error) throw error;
  return data;
}

// Scoped to one event — used by PublicEventPage.jsx's category cards.
export async function getMyRegistrationsForEvent(playerId, eventId) {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, category_id, status')
    .eq('player_id', playerId)
    .eq('event_id', eventId);
  if (error) throw error;
  return data;
}

export async function listMyNotifications(playerId, { limit = 20 } = {}) {
  const { data, error } = await supabase
    .from('player_notifications')
    .select(
      'id, event_id, registration_id, kind, message, new_status, read_at, created_at, events(name, slug, share_token, visibility), registrations(categories(name))'
    )
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function markNotificationsRead(ids) {
  if (!ids || ids.length === 0) return;
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids });
  if (error) throw error;
}
