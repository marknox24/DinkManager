// Deployed via the Supabase Dashboard (Edge Functions -> Via Editor), not
// the CLI — paste this file's contents in as-is. Requires no extra secrets:
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically for every Edge Function in this project.
//
// Invites a temporary customer: creates the auth user and emails them a
// Supabase invite link (they set their own password by following it — see
// ResetPasswordPage, which handles any URL-established session, invite or
// recovery, the same way) and stamps their profile row with
// access_expires_at / max_events so the account can create at most one
// event (by default) and loses dashboard access once expired. Only
// callable by an authenticated admin account (profiles.is_admin = true) —
// admin.inviteUserByEmail needs the service-role key, which must never
// reach the browser, so this check has to happen server-side.
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

    // 2. Validate input.
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const days = Number(body.days) > 0 ? Number(body.days) : 7;
    const role = body.role === 'player' ? 'player' : 'organizer';
    const maxEvents = Number(body.maxEvents) > 0 ? Math.floor(Number(body.maxEvents)) : 1;
    // The function runs server-side and has no notion of the app's URL —
    // the client sends its own window.location.origin so the invite email
    // links back to wherever the app is actually running (localhost in
    // dev, the production domain once deployed).
    const origin = String(body.origin || '').trim();

    if (!email || !email.includes('@')) {
      return jsonResponse({ error: 'A valid email is required' }, 400);
    }
    if (!origin || !/^https?:\/\//.test(origin)) {
      return jsonResponse({ error: 'Missing origin' }, 400);
    }

    // 3. Invite the customer by email (creates the auth user right away —
    // handle_new_user's trigger fires immediately — but they're unconfirmed
    // until they follow the link and set a password) and stamp the trial
    // limits onto their profile row.
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data: created, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
      data: { role },
    });
    if (inviteErr) return jsonResponse({ error: inviteErr.message }, 400);

    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(
        { id: created.user.id, email, role, access_expires_at: expiresAt, max_events: maxEvents },
        { onConflict: 'id' }
      );
    if (upsertErr) return jsonResponse({ error: upsertErr.message }, 400);

    return jsonResponse({ email, expiresAt, maxEvents, role });
  } catch (e) {
    return jsonResponse({ error: e?.message || 'Unexpected error' }, 500);
  }
});
