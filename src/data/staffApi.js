import { supabase } from '../lib/supabaseClient';
import { PERMISSION_COLUMNS } from './permissions';

export async function listEventStaff(eventId) {
  const { data, error } = await supabase
    .from('event_staff')
    .select('*')
    .eq('event_id', eventId)
    .order('invited_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMyStaffRow(eventId, userId) {
  const { data, error } = await supabase
    .from('event_staff')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Filters the patch down to known permission columns before sending — RLS
// already restricts which rows an organizer can touch, this is just
// defense in depth against an unexpected key slipping into the payload.
export async function updateStaffPermissions(staffId, patch) {
  const safePatch = {};
  for (const key of Object.keys(patch)) {
    if (PERMISSION_COLUMNS.includes(key)) safePatch[key] = patch[key];
  }
  const { data, error } = await supabase.from('event_staff').update(safePatch).eq('id', staffId).select().single();
  if (error) throw error;
  return data;
}

// Removes the (event, person) membership row only — never the underlying
// auth user, who may staff other events and owns their own login.
export async function removeEventStaff(staffId) {
  const { error } = await supabase.from('event_staff').delete().eq('id', staffId);
  if (error) throw error;
}

// Reverts a staffer to permanent (non-expiring) access without re-inviting
// or touching their permissions/password. A direct client call — no edge
// function needed, since the organizer already has UPDATE rights here via
// the event_staff_owner_all RLS policy.
export async function clearStaffExpiry(staffId) {
  const { data, error } = await supabase.from('event_staff').update({ access_expires_at: null }).eq('id', staffId).select().single();
  if (error) throw error;
  return data;
}
