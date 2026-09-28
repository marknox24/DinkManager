import { supabase } from '../lib/supabaseClient';

// Admin Control Center Phase 1 — the organizer-facing "Request a Change" /
// "Contact Admin" flow and the admin's review queue. See "EVENT CHANGE
// REQUESTS" in supabase/schema.sql: every state transition (submit, reply,
// approve/reject/request-info) goes through a security-definer RPC rather
// than a raw table write, since approving a date change has a real side
// effect (it moves the event's actual dates via admin_override_event_dates).

// event_id may be null for an account-level topic (billing/technical/other)
// that isn't about one specific event.
export async function submitEventChangeRequest(
  eventId,
  { requestType, requestedStartDate, requestedEndDate, reason, additionalInfo }
) {
  const { data, error } = await supabase.rpc('submit_event_change_request', {
    p_event_id: eventId,
    p_request_type: requestType,
    p_requested_start_date: requestedStartDate || null,
    p_requested_end_date: requestedEndDate || null,
    p_reason: reason,
    p_additional_info: additionalInfo || null,
  });
  if (error) throw error;
  return data;
}

// Plain RLS-scoped reads — event_change_requests_select already lets the
// organizer see their own rows (or the admin see everything), no RPC needed.
export async function listMyChangeRequests(eventId) {
  let query = supabase.from('event_change_requests').select('*').order('created_at', { ascending: false });
  if (eventId) query = query.eq('event_id', eventId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getChangeRequest(requestId) {
  const { data, error } = await supabase.from('event_change_requests').select('*').eq('id', requestId).single();
  if (error) throw error;
  return data;
}

export async function listChangeRequestMessages(requestId) {
  const { data, error } = await supabase
    .from('event_change_request_messages')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

// Posts to either side of the conversation — sender_role is derived from
// is_admin_user() server-side, never taken from the client.
export async function addChangeRequestMessage(requestId, message) {
  const { data, error } = await supabase.rpc('add_change_request_message', { p_request_id: requestId, p_message: message });
  if (error) throw error;
  return data;
}

export async function adminMarkRequestUnderReview(requestId) {
  const { error } = await supabase.rpc('admin_mark_request_under_review', { p_request_id: requestId });
  if (error) throw error;
}

// Everything AdminRequestDetailPage.jsx needs in one call — the request
// joined with organizer email/event name, plus the fire-once "opening it
// marks it seen" transition. Returns { request, organizer_email, event_name,
// event_status }.
export async function adminGetChangeRequest(requestId) {
  const { data, error } = await supabase.rpc('admin_get_change_request', { p_request_id: requestId });
  if (error) throw error;
  return data;
}

// action: 'request_info' | 'approve' | 'reject'. note is required for
// request_info/reject, optional for approve.
export async function adminReviewChangeRequest(requestId, action, note) {
  const { data, error } = await supabase.rpc('admin_review_change_request', {
    p_request_id: requestId,
    p_action: action,
    p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function adminListChangeRequests(status) {
  const { data, error } = await supabase.rpc('admin_list_change_requests', { p_status: status || null });
  if (error) throw error;
  return data;
}
