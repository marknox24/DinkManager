import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// Set right before an OAuth redirect so the one-time role-correction effect
// below knows whether the Organizer or Player tab initiated it.
const OAUTH_ROLE_KEY = 'dm_oauth_role';

// Shared by every service-role-only Edge Function call below (admin
// account management, and the organizer-facing staff invite) — Edge
// Function errors surface here without a parsed body by default, so this
// pulls the real message out of the response instead of a generic
// "non-2xx" string.
async function invokeAdminFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = await error.context?.json?.().then((b) => b?.error).catch(() => null);
    throw new Error(message || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(isSupabaseConfigured);
  const [aal, setAal] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  // Tracks whether the signed-in session still owes a pending 2FA challenge
  // (a TOTP factor is enrolled but hasn't been verified yet this session).
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      setAal(null);
      return;
    }
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (data) setAal(data);
    });
  }, [userId, session]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Wait for the initial session check to resolve before concluding
    // there's no user. Without this, on a fresh page load this effect's
    // first pass sees userId still null (the session promise above hasn't
    // resolved yet) and flips profileLoading to false — a one-tick window
    // where a signed-in user's profile reads as null/not-loading, which is
    // enough for a role or admin gate reading it that same tick to redirect
    // somewhere wrong before the real profile ever arrives.
    if (loading) return;
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data ?? null);
        setProfileLoading(false);
      });
  }, [userId, loading]);

  // One-time correction for OAuth sign-ups: Supabase's OAuth flow can't carry
  // an intended role the way email/password signUp's `options.data` does, so
  // the handle_new_user DB trigger always defaults new OAuth users to
  // 'organizer'. If the Player tab stored an intended role and this profile
  // was only just created, fix it up here — never touches an existing user.
  useEffect(() => {
    if (!isSupabaseConfigured || !profile || profileLoading) return;
    const intendedRole = sessionStorage.getItem(OAUTH_ROLE_KEY);
    if (!intendedRole) return;
    sessionStorage.removeItem(OAUTH_ROLE_KEY);
    const createdRecently = Date.now() - new Date(profile.created_at).getTime() < 2 * 60 * 1000;
    if (createdRecently && profile.role !== intendedRole) {
      supabase
        .from('profiles')
        .update({ role: intendedRole })
        .eq('id', profile.id)
        .select()
        .maybeSingle()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    }
  }, [profile, profileLoading]);

  const needsMfaChallenge = Boolean(aal && aal.currentLevel !== aal.nextLevel);

  // Trial accounts (issued via the admin panel) carry an expiry on their
  // profile row. Once past it, ProtectedRoute hard-locks every route behind
  // it regardless of role — this flag is the single source of truth for that.
  const isExpired = Boolean(profile?.access_expires_at && new Date(profile.access_expires_at) < new Date());
  const isAdmin = Boolean(profile?.is_admin);

  // Single derived source for the user-facing "Account Type" label and any
  // role-hierarchy decisions (ADMIRAL > ORGANIZER > PLAYER). is_admin stays
  // an orthogonal flag on the existing 'organizer'/'player' role column
  // rather than a third role value — that keeps every existing role check
  // (RLS, ProtectedRoute, EventAccessContext) unchanged; this just labels
  // the is_admin case distinctly instead of showing "Organizer" for admins.
  const accountType = isAdmin ? 'admiral' : profile?.role === 'player' ? 'player' : 'organizer';

  // Called right after a successful MFA verification, before navigating away
  // from the login page. The `aal` effect above would also pick this up on
  // its own, but only once the session-change event finishes propagating —
  // awaiting this explicitly guarantees `needsMfaChallenge` is already false
  // by the time ProtectedRoute renders the destination route, so a just-
  // verified user is never bounced back to the login page by a stale value.
  const refreshAal = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data) setAal(data);
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      profile,
      profileLoading,
      role: profile?.role ?? null,
      needsMfaChallenge,
      refreshAal,
      isExpired,
      isAdmin,
      accountType,
      // Admin-only: invites a temporary customer by email (real auth user +
      // profile row with access_expires_at/max_events set). Runs server-side
      // in the create-trial-account Edge Function since only the service
      // role can send invites — the function re-checks is_admin itself, so
      // this call is safe to expose even though the client-side isAdmin
      // flag above is only a UI convenience, not the real access control.
      createTrialAccount: ({ email, days, maxEvents, role: trialRole }) =>
        invokeAdminFunction('create-trial-account', { email, days, maxEvents, role: trialRole, origin: window.location.origin }),
      // Admin-only: edit a customer's trial terms, set a password by hand so
      // it can be handed to them directly, or remove the account outright.
      // All three run server-side in admin-manage-customer for the same
      // reason as createTrialAccount above (service-role only operations).
      updateCustomer: ({ userId, days, maxEvents }) => invokeAdminFunction('admin-manage-customer', { action: 'update', userId, days, maxEvents }),
      setCustomerPassword: ({ userId, password }) => invokeAdminFunction('admin-manage-customer', { action: 'set_password', userId, password }),
      deleteCustomer: (userId) => invokeAdminFunction('admin-manage-customer', { action: 'delete', userId }),
      // Organizer-facing: invites a "table committee" helper onto one event
      // with a per-feature permission set. Runs server-side in
      // invite-event-staff since inviting by email needs the service role;
      // the function re-checks the caller owns the event itself.
      inviteEventStaff: ({ eventId, email, permissions, temporaryAccess }) =>
        invokeAdminFunction('invite-event-staff', { eventId, email, permissions, temporaryAccess, origin: window.location.origin }),
      // Admin-only: approves a manual/QR subscription_requests row — invites
      // the email (or grants directly onto an existing account) and grants
      // +1 event credit. Runs server-side in approve-subscription-request
      // for the same reason as createTrialAccount above (admin.auth.admin
      // calls need the service role).
      approveSubscriptionRequest: (requestId) =>
        invokeAdminFunction('approve-subscription-request', { requestId, origin: window.location.origin }),
      signUp: (email, password, displayName, role = 'organizer') =>
        supabase.auth.signUp({ email, password, options: { data: { display_name: displayName, role } } }),
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      signInWithOAuth: (provider, role = 'organizer') => {
        sessionStorage.setItem(OAUTH_ROLE_KEY, role);
        return supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: `${window.location.origin}${role === 'player' ? '/player/dashboard' : '/dashboard'}` },
        });
      },
      signOut: () => supabase.auth.signOut(),
      resetPasswordForEmail: (email) =>
        supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }),
      updatePassword: (password) => supabase.auth.updateUser({ password }),
      // 2FA (TOTP) — enrollment lives on the Account page, the challenge step
      // lives in the login flow. getAal() is called directly right after a
      // password sign-in so the login page doesn't have to wait on state
      // propagation to know whether to show the code-entry step.
      getAal: () => supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      mfaEnroll: () => supabase.auth.mfa.enroll({ factorType: 'totp' }),
      mfaChallenge: (factorId) => supabase.auth.mfa.challenge({ factorId }),
      mfaVerify: (factorId, challengeId, code) => supabase.auth.mfa.verify({ factorId, challengeId, code }),
      mfaUnenroll: (factorId) => supabase.auth.mfa.unenroll({ factorId }),
      mfaListFactors: () => supabase.auth.mfa.listFactors(),
    }),
    [session, loading, profile, profileLoading, needsMfaChallenge]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
