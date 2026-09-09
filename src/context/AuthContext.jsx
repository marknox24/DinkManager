import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// Set right before an OAuth redirect so the one-time role-correction effect
// below knows whether the Organizer or Player tab initiated it.
const OAUTH_ROLE_KEY = 'dm_oauth_role';

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
  }, [userId]);

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
