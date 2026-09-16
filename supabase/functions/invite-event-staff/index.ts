// Deployed via the Supabase Dashboard (Edge Functions -> Via Editor), not
// the CLI — paste this file's contents in as-is. Requires no extra secrets:
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically for every Edge Function in this project.
//
// Invites a "table committee" helper onto one event: creates the auth user
// and emails them a Supabase invite link (see create-trial-account for the
// same accept-invite flow) with a per-feature permission row in
// event_staff. Only callable by the event's own organizer — checked
// server-side against events.organizer_id, since admin.inviteUserByEmail
// needs the service-role key and that must never reach the browser.
//
// Also supports an alternate `temporaryAccess: { days, password }` path
// (used by the "Generate temporary login" UI and the per-staffer
// StaffLoginModal) that skips the email entirely and hands the organizer a
// working password directly, with event_staff.access_expires_at set to
// `days` from now — see has_event_permission() in schema.sql for how that
// expiry is actually enforced.
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

// Whitelist of permission columns the client is allowed to set — never
// spread the client's `permissions` object directly into the upsert.
const PERMISSION_COLUMNS = [
  'can_overview',
  'can_registrations',
  'can_checkin',
  'can_brackets',
  'can_redraw_brackets',
  'can_matchlist',
  'can_preview',
  'can_umpires',
  'can_sponsors',
  'can_accounting',
  'can_settings',
  'can_edit_event',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Shared by both the "email already registered" branch below and the
  // temporary-access branch — either way, an existing account is granted
  // access directly rather than double-inviting or erroring.
  async function findExistingProfileByEmail(email) {
    const { data, error } = await admin.from('profiles').select('id, role').eq('email', email).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  try {
    // 1. Identify the caller from their session token.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    // 2. Validate input.
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const eventId = String(body.eventId || '').trim();
    const origin = String(body.origin || '').trim();
    const permissions = body.permissions && typeof body.permissions === 'object' ? body.permissions : {};
    const temp = body.temporaryAccess && typeof body.temporaryAccess === 'object' ? body.temporaryAccess : null;

    if (!email || !email.includes('@')) {
      return jsonResponse({ error: 'A valid email is required' }, 400);
    }
    if (!eventId) {
      return jsonResponse({ error: 'Missing eventId' }, 400);
    }
    // Temporary-access mode never sends an email, so no redirect link is needed.
    if (!temp && (!origin || !/^https?:\/\//.test(origin))) {
      return jsonResponse({ error: 'Missing origin' }, 400);
    }

    let tempDays, tempPassword;
    if (temp) {
      tempDays = Number(temp.days);
      tempPassword = String(temp.password || '');
      if (!Number.isInteger(tempDays) || tempDays < 1) {
        return jsonResponse({ error: 'days must be a positive integer' }, 400);
      }
      if (tempPassword.length < 6) {
        return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
      }
    }

    // 3. The caller must own the event — this is what makes the function
    // organizer-facing rather than admin-facing.
    const { data: event, error: eventErr } = await admin.from('events').select('id, organizer_id, name').eq('id', eventId).maybeSingle();
    if (eventErr) return jsonResponse({ error: eventErr.message }, 400);
    if (!event || event.organizer_id !== userData.user.id) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }
    if (email === String(userData.user.email || '').trim().toLowerCase()) {
      // An owner already has full access — a staff row for their own event
      // would just be a confusing duplicate (e.g. it shows up a second time
      // under "Events you're helping with" on their own dashboard).
      return jsonResponse({ error: "You already own this event — you can't invite yourself as staff on it." }, 400);
    }

    // 4. Filter the requested permissions down to known columns only.
    const permPatch = {};
    for (const col of PERMISSION_COLUMNS) {
      if (typeof permissions[col] === 'boolean') permPatch[col] = permissions[col];
    }

    let userId;
    let existingAccount = false;

    if (temp) {
      // 5a. Temporary-access path: set a password directly, no email sent.
      const existingProfile = await findExistingProfileByEmail(email);
      if (existingProfile) {
        userId = existingProfile.id;
        existingAccount = true;
        // email_confirm: true lets the organizer hand this password to the
        // helper and have it work immediately, no confirmation email step.
        const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: tempPassword, email_confirm: true });
        if (pwErr) return jsonResponse({ error: pwErr.message }, 400);

        // Same role-flip a brand-new-invite's existing-account branch does
        // below — a 'player' account handed staff access needs this too.
        if (existingProfile.role !== 'organizer') {
          const { error: roleErr } = await admin.from('profiles').upsert({ id: userId, role: 'organizer' }, { onConflict: 'id' });
          if (roleErr) return jsonResponse({ error: roleErr.message }, 400);
        }
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { role: 'organizer' },
        });
        if (createErr) return jsonResponse({ error: createErr.message }, 400);
        userId = created.user.id;
        // A brand-new helper account can't spin up its own tournaments.
        const { error: profileErr } = await admin.from('profiles').upsert({ id: userId, email, role: 'organizer', max_events: 0 }, { onConflict: 'id' });
        if (profileErr) return jsonResponse({ error: profileErr.message }, 400);
      }
    } else {
      // 5b. Invite the helper by email (creates the auth user right away, but
      // they're unconfirmed until they follow the link and set a password).
      const { data: created, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/reset-password`,
        data: { role: 'organizer' },
      });

      if (inviteErr) {
        // This email already has an account — Supabase's invite call refuses
        // to run twice for the same email. Grant staff access directly onto
        // that existing account instead of failing outright, and — unlike a
        // brand-new invited account — leave their own event limits untouched.
        const alreadyRegistered = inviteErr.code === 'email_exists' || /already (been )?registered|already exists/i.test(inviteErr.message || '');
        if (!alreadyRegistered) return jsonResponse({ error: inviteErr.message }, 400);

        const existingProfile = await findExistingProfileByEmail(email);
        if (!existingProfile) return jsonResponse({ error: 'This email already has an account, but it could not be found to grant access.' }, 400);

        userId = existingProfile.id;
        existingAccount = true;

        // Staff accounts are role='organizer' (they sign into the organizer
        // app, never a new role) — a 'player' account invited as staff needs
        // this flip too, or ProtectedRoute bounces them to /player/dashboard
        // before EventAccessProvider ever runs and the invite silently never
        // works. Only touches role — max_events/access_expires_at stay as-is.
        if (existingProfile.role !== 'organizer') {
          const { error: roleErr } = await admin.from('profiles').upsert({ id: userId, role: 'organizer' }, { onConflict: 'id' });
          if (roleErr) return jsonResponse({ error: roleErr.message }, 400);
        }
      } else {
        userId = created.user.id;
        // A brand-new helper account can't spin up its own tournaments.
        const { error: profileErr } = await admin.from('profiles').upsert({ id: userId, email, role: 'organizer', max_events: 0 }, { onConflict: 'id' });
        if (profileErr) return jsonResponse({ error: profileErr.message }, 400);
      }
    }

    // 6. Upsert the membership row — re-inviting the same email updates
    // their toggles instead of erroring on the unique constraint.
    // access_expires_at is always set explicitly: the computed expiry when
    // temporaryAccess was used, or null otherwise — so sending a plain email
    // invite is how an organizer converts a temporary helper back to
    // permanent access, with no separate "clear expiry" step required.
    const accessExpiresAt = temp ? new Date(Date.now() + tempDays * 24 * 60 * 60 * 1000).toISOString() : null;
    const { data: staffRow, error: staffErr } = await admin
      .from('event_staff')
      .upsert({ event_id: eventId, user_id: userId, email, access_expires_at: accessExpiresAt, ...permPatch }, { onConflict: 'event_id,user_id' })
      .select()
      .single();
    if (staffErr) return jsonResponse({ error: staffErr.message }, 400);

    return jsonResponse({ email, existingAccount, staff: staffRow, ...(temp ? { password: tempPassword } : {}) });
  } catch (e) {
    return jsonResponse({ error: e?.message || 'Unexpected error' }, 500);
  }
});
