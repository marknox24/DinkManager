import { supabase } from '../lib/supabaseClient';

export async function listMyRegistrations(playerId) {
  const { data, error } = await supabase
    .from('registrations')
    .select('*, events(name, slug, status), categories(name)')
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
