// Deployed via the Supabase Dashboard (Edge Functions -> Via Editor), not
// the CLI — paste this file's contents in as-is. Requires no extra secrets:
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically for every Edge Function in this project.
//
// Admin-only maintenance on customer (trial) accounts issued from the
// Customer logins page — edit their trial terms, set a password by hand
// so the admin can hand out working credentials directly instead of
// relying on the invite email, or remove the account entirely. All three
// need the service-role key, so they have to live server-side, and this
// function re-checks is_admin itself the same way create-trial-account
// does (the client-side isAdmin flag is only a UI convenience).
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

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const userId = String(body.userId || '');
    if (!userId) return jsonResponse({ error: 'Missing userId' }, 400);

    if (action === 'update') {
      const days = Number(body.days) > 0 ? Number(body.days) : null;
      const maxEvents = Number(body.maxEvents) > 0 ? Math.floor(Number(body.maxEvents)) : null;
      // Days is always "extend access to N days from now" — the same
      // meaning as the initial invite — rather than editing a stored date
      // directly, so the admin panel only ever deals in a relative count.
      // access_expires_at is only added to the patch when days is given, so
      // an edit that only changes the event limit never wipes the existing
      // expiry out from under the customer.
      const patch: { max_events: number | null; access_expires_at?: string } = { max_events: maxEvents };
      if (days) patch.access_expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const { data: updated, error: updateErr } = await admin
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select('id, email, role, access_expires_at, max_events, created_at')
        .maybeSingle();
      if (updateErr) return jsonResponse({ error: updateErr.message }, 400);
      return jsonResponse({ customer: updated });
    }

    if (action === 'set_password') {
      const password = String(body.password || '');
      if (password.length < 6) return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);

      // email_confirm: true lets the admin hand this password to the
      // customer and have it work immediately, without also requiring the
      // customer to click a confirmation email first.
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (pwErr) return jsonResponse({ error: pwErr.message }, 400);
      return jsonResponse({ success: true });
    }

    if (action === 'delete') {
      // profiles.id references auth.users(id) on delete cascade, so the
      // profile row is removed automatically along with the auth user.
      const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
      if (deleteErr) return jsonResponse({ error: deleteErr.message }, 400);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return jsonResponse({ error: e?.message || 'Unexpected error' }, 500);
  }
});
