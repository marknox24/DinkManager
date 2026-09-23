import { supabase } from '../lib/supabaseClient';

// Everything the Admiral Dashboard (/admin) shows, in one round trip — see
// admin_dashboard() in supabase/schema.sql. It's security definer and
// checks is_admin_user() itself, since RLS alone wouldn't let the admin read
// other organizers' registrations etc.
export async function getAdminDashboard() {
  const { data, error } = await supabase.rpc('admin_dashboard');
  if (error) throw error;
  return data;
}
