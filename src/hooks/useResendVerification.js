import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Matches Supabase Auth's own per-email resend rate limit, so the button
// never invites a click the server would reject anyway.
const COOLDOWN_SECONDS = 60;

export default function useResendVerification({ startCoolingDown = false } = {}) {
  const { resendVerificationEmail } = useAuth();
  const { pushToast } = useToast();
  const [cooldown, setCooldown] = useState(startCoolingDown ? COOLDOWN_SECONDS : 0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const resend = async (email) => {
    if (!email || cooldown > 0 || sending) return false;
    setSending(true);
    const { error } = await resendVerificationEmail(email);
    setSending(false);
    if (error) {
      pushToast(error.message, 'error');
      return false;
    }
    setCooldown(COOLDOWN_SECONDS);
    pushToast('Verification email sent — check your inbox.', 'success');
    return true;
  };

  return { resend, cooldown, sending };
}
