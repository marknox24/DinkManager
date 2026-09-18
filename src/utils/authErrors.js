// Same detection the server-side edge functions already use for this exact
// condition (create-trial-account, approve-subscription-request,
// invite-event-staff) — Supabase doesn't return a single stable error code
// for it across every auth flow, so matching on both `code` and message text
// is the reliable check.
export function isDuplicateEmailError(error) {
  if (!error) return false;
  return error.code === 'email_exists' || /already (been )?registered|already exists/i.test(error.message || '');
}

// Client-side supabase.auth.signUp() for an email that already has an
// account does NOT return an error — Supabase deliberately returns HTTP 200
// with a real-looking user object to prevent attackers from using signup to
// probe which emails are registered (email enumeration). The only signal is
// `identities: []` (a genuinely new signup always has one identity). This is
// distinct from isDuplicateEmailError, which covers the *admin-side*
// inviteUserByEmail calls in the edge functions, where a real error/code is
// returned since that's a privileged operation, not subject to the same
// enumeration protection.
export function isDuplicateSignupResponse(data) {
  return Array.isArray(data?.user?.identities) && data.user.identities.length === 0;
}
