// Shared by every "issue a temporary login" flow in the app (admin-issued
// trial organizer accounts, and organizer-issued event-staff logins) — was
// duplicated only in AdminCustomersPage.jsx until the staff version needed
// the exact same two helpers.

export function daysLeftLabel(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: 'Expired', tone: 'text-rose-600 bg-rose-50' };
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return { text: `${days} day${days === 1 ? '' : 's'} left`, tone: 'text-brand-700 bg-brand-50' };
}

// Not security-sensitive on its own — this is handed to the recipient as a
// starting password, same as any temporary/trial credential.
export function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// A generated login identifier for a brand-new temporary helper account —
// used instead of asking the organizer for a real email address, since a
// temporary account never needs to receive mail (email_confirm skips
// confirmation, and nothing is ever emailed to a temp login). Supabase Auth
// here is strictly email+password, so this still has to be shaped like an
// email to satisfy that — the "@..." part is never actually contacted, it's
// just a unique, syntactically-valid login handle. Shown to the organizer
// simply as "Username"; it's what the helper types into the Email field on
// the sign-in page.
const TEMP_LOGIN_DOMAIN = 'helpers.dinkmanager.app';
export function generateUsername() {
  return `helper${Math.random().toString(36).slice(2, 10)}@${TEMP_LOGIN_DOMAIN}`;
}
