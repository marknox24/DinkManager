// Deployed via the Supabase Dashboard (Edge Functions -> Via Editor), not
// the CLI — paste this file's contents in as-is. Requires no extra secrets:
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically for every Edge Function in this project.
//
// Approves a manual/QR subscription_requests row. Two distinct flows share
// this one function, told apart by subRequest.event_id (see schema.sql's
// "SUBSCRIPTION REQUESTS" comment):
//   - event_id set: an already-authenticated organizer upgrading ONE event
//     they own. Writes the purchased plan + entitlement_* snapshot onto
//     THAT event alone — never onto profiles, never onto any other event
//     (one payment = one event = one plan entitlement).
//   - event_id null: the legacy anonymous pre-signup lead flow — invites
//     the email (or grants directly onto an existing account) and grants
//     +1 event credit by INCREMENTING profiles.max_events. This no longer
//     writes profiles.plan at all — every event, including that account's
//     first, still starts on 'free' and needs its own separate event-scoped
//     upgrade request to become a paid tier.
// Only callable by an authenticated admin account (profiles.is_admin =
// true) — admin.auth.admin calls need the service-role key, which must
// never reach the browser, so this check has to happen server-side.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Identify the caller from their session token and require is_admin.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (!callerProfile?.is_admin) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    // 2. Validate input and load the request.
    const body = await req.json().catch(() => ({}));
    const requestId = String(body.requestId || '').trim();
    if (!requestId) return jsonResponse({ error: 'Missing requestId' }, 400);

    const { data: subRequest, error: reqErr } = await admin
      .from('subscription_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (reqErr) return jsonResponse({ error: reqErr.message }, 400);
    if (!subRequest) return jsonResponse({ error: 'Request not found' }, 404);
    // Guards against double-approving from two open admin tabs.
    if (subRequest.status !== 'pending') return jsonResponse({ error: `This request is already ${subRequest.status}` }, 400);

    // 2b. Event-scoped upgrade — the organizer is already authenticated and
    // owns this event (enforced at request-insert time by
    // subscription_requests_insert_public's RLS), so none of the
    // invite/account-lookup logic below applies at all. Numbers mirror
    // src/data/plans.js's PLAN_LIMITS — Deno edge functions can't import a
    // frontend JS module, so keep them hand-synced (see plans.js's header
    // for every place these numbers are duplicated).
    if (subRequest.event_id) {
      const { data: event, error: eventErr } = await admin.from('events').select('id, organizer_id').eq('id', subRequest.event_id).maybeSingle();
      if (eventErr) return jsonResponse({ error: eventErr.message }, 400);
      if (!event) return jsonResponse({ error: 'Event not found — it may have been deleted.' }, 404);

      const ENTITLEMENTS = {
        starter: { categories: 5, playersPerCategory: 30, courts: 4, csvImport: true },
        pro: { categories: 10, playersPerCategory: 64, courts: 8, csvImport: true },
        business: { categories: null, playersPerCategory: 128, courts: 16, csvImport: true },
      };
      const limits = ENTITLEMENTS[subRequest.plan];
      if (!limits) return jsonResponse({ error: `Unknown plan: ${subRequest.plan}` }, 400);

      const { error: eventUpdateErr } = await admin
        .from('events')
        .update({
          plan: subRequest.plan,
          entitlement_categories: limits.categories,
          entitlement_players_per_category: limits.playersPerCategory,
          entitlement_courts: limits.courts,
          entitlement_csv_import: limits.csvImport,
          plan_activated_at: new Date().toISOString(),
          plan_payment_id: requestId,
        })
        .eq('id', event.id);
      if (eventUpdateErr) return jsonResponse({ error: eventUpdateErr.message }, 400);

      const { error: resolveErr } = await admin
        .from('subscription_requests')
        .update({ status: 'approved', resolved_at: new Date().toISOString() })
        .eq('id', requestId);
      if (resolveErr) return jsonResponse({ error: resolveErr.message }, 400);

      return jsonResponse({ email: subRequest.email, plan: subRequest.plan, eventId: event.id, scope: 'event' });
    }

    // 2c. Legacy anonymous pre-signup lead — needs an account, so an origin
    // to redirect the invite email to.
    const origin = String(body.origin || '').trim();
    if (!origin || !/^https?:\/\//.test(origin)) return jsonResponse({ error: 'Missing origin' }, 400);

    const email = subRequest.email;

    // 3. Invite the customer by email (creates the auth user right away —
    // handle_new_user's trigger fires immediately — but they're unconfirmed
    // until they follow the link and set a password), or grant directly onto
    // an existing account. Same invite-or-grant branch as
    // create-trial-account, except a subscription request landing on a real,
    // already-paying organizer's existing account is the *expected* case
    // here, not an edge case to refuse.
    const { data: created, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
      data: { role: 'organizer' },
    });

    let userId;
    let isNewAccount;

    if (inviteErr) {
      const alreadyRegistered = inviteErr.code === 'email_exists' || /already (been )?registered|already exists/i.test(inviteErr.message || '');
      if (!alreadyRegistered) return jsonResponse({ error: inviteErr.message }, 400);

      const { data: existingProfile, error: lookupErr } = await admin
        .from('profiles')
        .select('id, is_admin, max_events')
        .eq('email', email)
        .maybeSingle();
      if (lookupErr) return jsonResponse({ error: lookupErr.message }, 400);
      if (!existingProfile) return jsonResponse({ error: 'This email already has an account, but it could not be found to grant a credit.' }, 400);
      if (existingProfile.is_admin) {
        return jsonResponse({ error: 'This email belongs to an admin account — refusing to grant it an event credit.' }, 400);
      }

      userId = existingProfile.id;
      isNewAccount = false;
    } else {
      userId = created.user.id;
      isNewAccount = true;
    }

    // 4. Grant +1 event credit — an increment, not an absolute-value upsert,
    // and access_expires_at is left completely untouched (null for a brand
    // new account, whatever it already was for a former trial account).
    const { data: currentProfile, error: profileReadErr } = await admin
      .from('profiles')
      .select('max_events')
      .eq('id', userId)
      .maybeSingle();
    if (profileReadErr) return jsonResponse({ error: profileReadErr.message }, 400);

    const maxEvents = (currentProfile?.max_events ?? 0) + 1;
    // profiles.plan is never written here (or anywhere else, per the
    // event-scoped model above) — this only ever grants event-creation
    // room. Every event this account creates still starts on 'free' and
    // needs its own separate event-scoped upgrade request to become paid.
    const { error: updateErr } = await admin.from('profiles').update({ max_events: maxEvents, role: 'organizer', email }).eq('id', userId);
    if (updateErr) return jsonResponse({ error: updateErr.message }, 400);

    // 5. Mark the request resolved.
    const { error: resolveErr } = await admin
      .from('subscription_requests')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', requestId);
    if (resolveErr) return jsonResponse({ error: resolveErr.message }, 400);

    return jsonResponse({ email, plan: subRequest.plan, maxEvents, isNewAccount, scope: 'account' });
  } catch (e) {
    return jsonResponse({ error: e?.message || 'Unexpected error' }, 500);
  }
});
