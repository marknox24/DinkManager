// Deployed via the Supabase Dashboard (Edge Functions -> Via Editor), not
// the CLI — paste this file's contents in as-is. Requires no extra secrets:
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically for every Edge Function in this project.
//
// approvePurchase: the ONE approval action for every plan (Starter, Pro,
// Business) — one purchase -> one approval -> one event -> one plan. The
// plan is read from the purchase itself; nothing here is plan-specific.
//   1. Website purchase (subscription_requests.event_id null): invite the
//      email (or link the existing account), then activate_purchase() creates
//      a NEW event already on the purchased plan with its entitlements, and
//      links the purchase to it. The customer is emailed a way in: the
//      invite (new account) or a sign-in link (existing account).
//   2. In-app "Upgrade event" (event_id set): activate_purchase() upgrades
//      that one event. The organizer is already signed in; no email.
// All database work happens in activate_purchase() (supabase/schema.sql),
// in one transaction, reading plan values from plan_catalog. If anything
// fails the request stays pending and approving again is safe: the invite
// step then finds the account it already created.
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

    // 2. Validate input and load the purchase.
    const body = await req.json().catch(() => ({}));
    const requestId = String(body.requestId || '').trim();
    if (!requestId) return jsonResponse({ error: 'Missing requestId' }, 400);

    const { data: purchase, error: reqErr } = await admin
      .from('subscription_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (reqErr) return jsonResponse({ error: reqErr.message }, 400);
    if (!purchase) return jsonResponse({ error: 'Request not found' }, 404);
    // Guards against double-approving from two open admin tabs (and
    // activate_purchase re-checks this under a row lock).
    if (purchase.status !== 'pending') return jsonResponse({ error: `This request is already ${purchase.status}` }, 400);

    const isUpgrade = Boolean(purchase.event_id);
    const email = purchase.email;
    let organizerId = null;
    let isNewAccount = false;
    let origin = '';

    // 3. Website purchase: make sure there's an organizer account to own
    // the new event — invite a new email, or link the existing account.
    if (!isUpgrade) {
      origin = String(body.origin || '').trim();
      if (!origin || !/^https?:\/\//.test(origin)) return jsonResponse({ error: 'Missing origin' }, 400);

      const { data: created, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/reset-password`,
        data: { role: 'organizer' },
      });

      if (inviteErr) {
        const alreadyRegistered = inviteErr.code === 'email_exists' || /already (been )?registered|already exists/i.test(inviteErr.message || '');
        if (!alreadyRegistered) return jsonResponse({ error: inviteErr.message }, 400);

        const { data: existingProfile, error: lookupErr } = await admin
          .from('profiles')
          .select('id, is_admin')
          .eq('email', email)
          .maybeSingle();
        if (lookupErr) return jsonResponse({ error: lookupErr.message }, 400);
        if (!existingProfile) return jsonResponse({ error: 'This email already has an account, but it could not be found to activate the purchase.' }, 400);
        if (existingProfile.is_admin) {
          return jsonResponse({ error: 'This email belongs to an admin account — refusing to activate a purchase on it.' }, 400);
        }
        organizerId = existingProfile.id;
      } else {
        organizerId = created.user.id;
        isNewAccount = true;
      }

      // Buying an event makes the account an organizer (e.g. a player
      // account). max_events is handled inside activate_purchase.
      const { error: profileErr } = await admin.from('profiles').update({ role: 'organizer', email }).eq('id', organizerId);
      if (profileErr) return jsonResponse({ error: profileErr.message }, 400);
    }

    // 4. Activate: create (or upgrade) the event on the purchased plan and
    // mark the purchase approved — one transaction.
    const { data: activation, error: activateErr } = await admin.rpc('activate_purchase', {
      p_request_id: requestId,
      p_organizer_id: organizerId,
    });
    if (activateErr) return jsonResponse({ error: activateErr.message }, 400);

    // 5. Give the customer a way in. A new account already got the invite
    // email in step 3; an existing account gets a one-click sign-in link
    // straight to its new event. Best-effort: the purchase is already
    // active, so a mail failure is reported back, not fatal.
    let notified = isNewAccount ? 'invite' : null;
    if (!isUpgrade && !isNewAccount) {
      const mailer = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const { error: otpErr } = await mailer.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${origin}/events/${activation.event_id}/edit` },
      });
      notified = otpErr ? null : 'sign_in_link';
    }

    return jsonResponse({
      scope: isUpgrade ? 'upgrade' : 'new_event',
      email,
      plan: activation.plan,
      eventId: activation.event_id,
      eventName: activation.event_name,
      eventCreated: activation.created,
      isNewAccount,
      notified,
    });
  } catch (e) {
    return jsonResponse({ error: e?.message || 'Unexpected error' }, 500);
  }
});
