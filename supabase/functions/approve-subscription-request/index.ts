// Deployed via the Supabase Dashboard (Edge Functions -> Via Editor), not
// the CLI — paste this file's contents in as-is. Requires no extra secrets:
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically for every Edge Function in this project.
//
// Approves a manual/QR subscription_requests row: invites the email (or
// grants directly onto an existing account, same branch as
// create-trial-account) and grants +1 event credit by INCREMENTING
// profiles.max_events — this is "pay per event," not a time-boxed trial, so
// access_expires_at is deliberately never touched here. Only callable by an
// authenticated admin account (profiles.is_admin = true) — admin.auth.admin
// calls need the service-role key, which must never reach the browser, so
// this check has to happen server-side.
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
    const origin = String(body.origin || '').trim();
    if (!requestId) return jsonResponse({ error: 'Missing requestId' }, 400);
    if (!origin || !/^https?:\/\//.test(origin)) return jsonResponse({ error: 'Missing origin' }, 400);

    const { data: subRequest, error: reqErr } = await admin
      .from('subscription_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (reqErr) return jsonResponse({ error: reqErr.message }, 400);
    if (!subRequest) return jsonResponse({ error: 'Request not found' }, 404);
    // Guards against double-approving from two open admin tabs.
    if (subRequest.status !== 'pending') return jsonResponse({ error: `This request is already ${subRequest.status}` }, 400);

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
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ max_events: maxEvents, role: 'organizer', email })
      .eq('id', userId);
    if (updateErr) return jsonResponse({ error: updateErr.message }, 400);

    // 5. Mark the request resolved.
    const { error: resolveErr } = await admin
      .from('subscription_requests')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', requestId);
    if (resolveErr) return jsonResponse({ error: resolveErr.message }, 400);

    return jsonResponse({ email, plan: subRequest.plan, maxEvents, isNewAccount });
  } catch (e) {
    return jsonResponse({ error: e?.message || 'Unexpected error' }, 500);
  }
});
