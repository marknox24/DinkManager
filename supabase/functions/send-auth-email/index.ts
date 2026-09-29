// Deployed via the Supabase Dashboard (Edge Functions -> Via Editor), not
// the CLI — paste this file's contents in as-is, with "Verify JWT" turned
// OFF for this function (Supabase Auth calls it with a webhook signature,
// not a user JWT).
//
// Supabase Auth "Send Email" hook: replaces Supabase's built-in mailer for
// EVERY auth email in the project — signup confirmation, password recovery,
// invites (create-trial-account, invite-event-staff,
// approve-subscription-request), magic links, email change and
// reauthentication — rendering them with one shared DinkManager design and
// sending through Resend. Enabling the hook is all-or-nothing, so after
// turning it on, re-test password reset and an invite, not just signup.
// Rollback: disable the hook (Authentication -> Hooks) and Supabase's own
// mailer takes over again immediately.
//
// Required secrets (Edge Functions -> Secrets), beyond the auto-injected
// SUPABASE_URL:
//   RESEND_API_KEY          — from resend.com (sending domain verified there)
//   SEND_EMAIL_HOOK_SECRET  — generated when enabling the hook, "v1,whsec_…"
//
// Never logs tokens or verification URLs — only the action type and status.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const APP_ORIGIN = 'https://dinkmanager.com';
const FROM_ADDRESS = 'DinkManager <no-reply@dinkmanager.com>';
const SUPPORT_EMAIL = 'support@dinkmanager.com';
// Keep in sync with Authentication -> Settings -> "Mailer OTP Expiration".
const LINK_EXPIRY = '24 hours';

// Brand palette — hex copies of src/index.css's @theme tokens. Email clients
// strip CSS variables unreliably, so nothing here may use var(...).
const C = {
  brand: '#6c5ce7',
  brandDark: '#5949c9',
  brand50: '#f2f0fd',
  brand100: '#e4e0fb',
  teal: '#17c3b2',
  coral: '#ff6b6b',
  ink900: '#1c2733',
  ink700: '#395064',
  ink600: '#45627a',
  ink500: '#587a93',
  ink400: '#7997ae',
  ink100: '#e6ecf1',
  ink50: '#f4f7fa',
  page: '#f3f6f8',
  white: '#ffffff',
};
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const DISPLAY_FONT = "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// ---------------------------------------------------------------------------
// Design system — building blocks every DinkManager email is assembled from.
// A future email (plan approval, support request update, admin alert) is
// just a new body function composed from these, wrapped in emailShell().
// ---------------------------------------------------------------------------
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function heading(text) {
  return `<h1 style="margin:0 0 16px;font-family:${DISPLAY_FONT};font-size:24px;line-height:32px;font-weight:700;color:${C.ink900};">${text}</h1>`;
}

function paragraph(html, { muted = false, small = false } = {}) {
  const size = small ? '13px' : '15px';
  const lh = small ? '20px' : '24px';
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${size};line-height:${lh};color:${muted ? C.ink500 : C.ink700};">${html}</p>`;
}

// Table-based "bulletproof" button: renders as a real clickable block in
// Outlook (bgcolor on the cell), rounded everywhere else, full-width on
// mobile via the .btn-wrap media query in emailShell.
function primaryButton(label, url) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-wrap" style="margin:8px 0 24px;">
  <tr>
    <td align="center" bgcolor="${C.brand}" style="border-radius:12px;background-color:${C.brand};">
      <a href="${esc(url)}" target="_blank" class="btn" style="display:inline-block;padding:15px 36px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${C.white};text-decoration:none;border-radius:12px;background-color:${C.brand};">${esc(label)}</a>
    </td>
  </tr>
</table>`;
}

function secondaryButton(label, url) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;">
  <tr>
    <td align="center" style="border-radius:10px;border:1px solid ${C.ink100};background-color:${C.white};">
      <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:10px 20px;font-family:${FONT};font-size:14px;line-height:18px;font-weight:600;color:${C.ink700};text-decoration:none;border-radius:10px;">${esc(label)}</a>
    </td>
  </tr>
</table>`;
}

function fallbackLink(url) {
  return `
<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:20px;font-weight:600;color:${C.ink700};">Having trouble with the button?</p>
<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.ink500};">Copy and paste this link into your browser:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td style="padding:12px 14px;border-radius:10px;background-color:${C.ink50};border:1px solid ${C.ink100};font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:12px;line-height:18px;color:${C.brandDark};word-break:break-all;">
      <a href="${esc(url)}" target="_blank" style="color:${C.brandDark};text-decoration:none;word-break:break-all;">${esc(url)}</a>
    </td>
  </tr>
</table>`;
}

function codeBlock(code) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td align="center" style="padding:18px;border-radius:12px;background-color:${C.brand50};font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:30px;line-height:36px;font-weight:700;letter-spacing:8px;color:${C.ink900};">${esc(code)}</td>
  </tr>
</table>`;
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 0 24px;"><div style="height:1px;line-height:1px;font-size:1px;background-color:${C.ink100};">&nbsp;</div></td></tr></table>`;
}

function notice(title, html) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
  <tr>
    <td style="padding:14px 16px;border-radius:12px;background-color:${C.ink50};">
      <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.ink500};">🔒 ${esc(title)}</p>
      <p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.ink500};">${html}</p>
    </td>
  </tr>
</table>`;
}

function signOff() {
  return paragraph(`— The DinkManager Team`, { muted: false });
}

function emailShell({ previewText, bodyHtml }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>DinkManager</title>
<style>
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; }
  a.btn:hover { background-color:${C.brandDark} !important; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .card-pad { padding:28px 22px !important; }
    .btn-wrap { width:100% !important; }
    .btn-wrap a { display:block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.page};mso-hide:all;">${esc(previewText)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <!-- Brand header -->
        <tr>
          <td align="center" style="padding:0 0 24px;">
            <a href="${APP_ORIGIN}" target="_blank" style="text-decoration:none;">
              <img src="${APP_ORIGIN}/icons/icon-192.png" width="48" height="48" alt="DinkManager" style="display:block;width:48px;height:48px;border-radius:12px;margin:0 auto;font-family:${FONT};font-size:14px;font-weight:700;color:${C.ink900};">
            </a>
            <p style="margin:12px 0 0;font-family:${DISPLAY_FONT};font-size:20px;line-height:26px;font-weight:700;color:${C.ink900};">DinkManager</p>
            <p style="margin:4px 0 0;font-family:${FONT};font-size:13px;line-height:18px;color:${C.ink500};">Tournament Management, Made Simple.</p>
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background-color:${C.white};border-radius:20px;border:1px solid ${C.ink100};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="height:5px;line-height:5px;font-size:5px;border-radius:20px 20px 0 0;background-color:${C.brand};">&nbsp;</td></tr>
              <tr>
                <td class="card-pad" style="padding:40px 44px 36px;">
                  ${bodyHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Help -->
        <tr>
          <td align="center" style="padding:28px 24px 0;">
            <p style="margin:0 0 4px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:700;color:${C.ink700};">Need help?</p>
            <p style="margin:0 0 12px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.ink500};">If you're having trouble, our support team is happy to help.</p>
            ${secondaryButton('Contact Support', `mailto:${SUPPORT_EMAIL}`)}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td align="center" style="padding:28px 24px 8px;">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.ink400};">&copy; ${year} DinkManager &middot; Tournament Management Platform</p>
            <p style="margin:6px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.ink400};"><a href="${APP_ORIGIN}/privacy" target="_blank" style="color:${C.ink500};text-decoration:underline;">Privacy Policy</a> &nbsp;|&nbsp; <a href="${APP_ORIGIN}/terms" target="_blank" style="color:${C.ink500};text-decoration:underline;">Terms of Service</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// Plain-text alternative — sent alongside the HTML; improves deliverability
// and is what text-only clients show.
function plainText(lines) {
  const year = new Date().getFullYear();
  return [
    ...lines,
    '',
    'Need help? Contact us at ' + SUPPORT_EMAIL,
    '',
    `© ${year} DinkManager — Tournament Management Platform`,
    `Privacy Policy: ${APP_ORIGIN}/privacy · Terms of Service: ${APP_ORIGIN}/terms`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Email bodies — one per Supabase Auth action type.
// ---------------------------------------------------------------------------
const SECURITY_NOTE = 'DinkManager will never ask you to provide your password by email.';

function verificationEmail({ firstName, url }) {
  const bodyHtml = [
    paragraph(`Hi ${esc(firstName)},`),
    heading('Welcome to DinkManager! 🎉'),
    paragraph("Thanks for creating your account. You're just one step away from getting started."),
    paragraph('Please verify your email address to activate your DinkManager account and access your tournament management tools.'),
    primaryButton('Verify My Email', url),
    paragraph(`This verification link will expire in <strong style="color:${C.ink900};">${LINK_EXPIRY}</strong>.`, { small: true, muted: true }),
    divider(),
    fallbackLink(url),
    paragraph("If you didn't create a DinkManager account, you can safely ignore this email.", { small: true, muted: true }),
    paragraph("We're happy to have you with us."),
    signOff(),
    notice('Security note', `${SECURITY_NOTE} If you did not create this account, no action is required.`),
  ].join('');
  return {
    subject: 'Verify your DinkManager account',
    previewText: "One quick step and you're ready to start managing your tournaments.",
    html: emailShell({ previewText: "One quick step and you're ready to start managing your tournaments.", bodyHtml }),
    text: plainText([
      `Hi ${firstName},`,
      '',
      'Welcome to DinkManager!',
      '',
      "Thanks for creating your account. You're just one step away from getting started.",
      'Please verify your email address to activate your DinkManager account:',
      '',
      url,
      '',
      `This verification link will expire in ${LINK_EXPIRY}.`,
      "If you didn't create a DinkManager account, you can safely ignore this email.",
      '',
      '— The DinkManager Team',
      '',
      `Security note: ${SECURITY_NOTE}`,
    ]),
  };
}

function passwordResetEmail({ firstName, url }) {
  const previewText = 'Use this link to choose a new password for your DinkManager account.';
  const bodyHtml = [
    paragraph(`Hi ${esc(firstName)},`),
    heading('Reset your password'),
    paragraph('We received a request to reset the password for your DinkManager account. Click the button below to choose a new one.'),
    primaryButton('Reset My Password', url),
    paragraph(`This link will expire in <strong style="color:${C.ink900};">${LINK_EXPIRY}</strong> and can only be used once.`, { small: true, muted: true }),
    divider(),
    fallbackLink(url),
    paragraph("If you didn't request a password reset, you can safely ignore this email — your password won't change.", { small: true, muted: true }),
    signOff(),
    notice('Security note', SECURITY_NOTE),
  ].join('');
  return {
    subject: 'Reset your DinkManager password',
    previewText,
    html: emailShell({ previewText, bodyHtml }),
    text: plainText([
      `Hi ${firstName},`,
      '',
      'We received a request to reset the password for your DinkManager account. Choose a new one here:',
      '',
      url,
      '',
      `This link will expire in ${LINK_EXPIRY} and can only be used once.`,
      "If you didn't request a password reset, you can safely ignore this email.",
      '',
      '— The DinkManager Team',
    ]),
  };
}

function inviteEmail({ firstName, url }) {
  const previewText = 'Your DinkManager account is ready — set your password to get started.';
  const bodyHtml = [
    paragraph(`Hi ${esc(firstName)},`),
    heading("You're invited to DinkManager 🎉"),
    paragraph('A DinkManager account has been created for you. Set your password to get started with your tournament tools.'),
    primaryButton('Set Up My Account', url),
    paragraph(`This invitation link will expire in <strong style="color:${C.ink900};">${LINK_EXPIRY}</strong>.`, { small: true, muted: true }),
    divider(),
    fallbackLink(url),
    paragraph("If you weren't expecting this invitation, you can safely ignore this email.", { small: true, muted: true }),
    signOff(),
    notice('Security note', SECURITY_NOTE),
  ].join('');
  return {
    subject: "You're invited to DinkManager",
    previewText,
    html: emailShell({ previewText, bodyHtml }),
    text: plainText([
      `Hi ${firstName},`,
      '',
      'A DinkManager account has been created for you. Set your password to get started:',
      '',
      url,
      '',
      `This invitation link will expire in ${LINK_EXPIRY}.`,
      "If you weren't expecting this invitation, you can safely ignore this email.",
      '',
      '— The DinkManager Team',
    ]),
  };
}

function magicLinkEmail({ firstName, url }) {
  const previewText = 'Your one-click sign-in link for DinkManager.';
  const bodyHtml = [
    paragraph(`Hi ${esc(firstName)},`),
    heading('Your sign-in link'),
    paragraph('Click the button below to sign in to DinkManager — no password needed.'),
    primaryButton('Sign In to DinkManager', url),
    paragraph(`This link will expire in <strong style="color:${C.ink900};">${LINK_EXPIRY}</strong> and can only be used once.`, { small: true, muted: true }),
    divider(),
    fallbackLink(url),
    paragraph("If you didn't request this link, you can safely ignore this email.", { small: true, muted: true }),
    signOff(),
    notice('Security note', SECURITY_NOTE),
  ].join('');
  return {
    subject: 'Your DinkManager sign-in link',
    previewText,
    html: emailShell({ previewText, bodyHtml }),
    text: plainText([
      `Hi ${firstName},`,
      '',
      'Sign in to DinkManager — no password needed:',
      '',
      url,
      '',
      `This link will expire in ${LINK_EXPIRY} and can only be used once.`,
      "If you didn't request this link, you can safely ignore this email.",
      '',
      '— The DinkManager Team',
    ]),
  };
}

function emailChangeEmail({ firstName, url }) {
  const previewText = 'Confirm the new email address for your DinkManager account.';
  const bodyHtml = [
    paragraph(`Hi ${esc(firstName)},`),
    heading('Confirm your new email'),
    paragraph('Please confirm this email address to finish updating your DinkManager account.'),
    primaryButton('Confirm New Email', url),
    divider(),
    fallbackLink(url),
    paragraph("If you didn't request this change, please contact support right away.", { small: true, muted: true }),
    signOff(),
    notice('Security note', SECURITY_NOTE),
  ].join('');
  return {
    subject: 'Confirm your new DinkManager email',
    previewText,
    html: emailShell({ previewText, bodyHtml }),
    text: plainText([`Hi ${firstName},`, '', 'Confirm your new email address for DinkManager:', '', url, '', '— The DinkManager Team']),
  };
}

function reauthenticationEmail({ firstName, code }) {
  const previewText = 'Your DinkManager verification code.';
  const bodyHtml = [
    paragraph(`Hi ${esc(firstName)},`),
    heading('Your verification code'),
    paragraph('Enter this code in DinkManager to confirm it’s you:'),
    codeBlock(code),
    paragraph("If you didn't request this code, you can safely ignore this email.", { small: true, muted: true }),
    signOff(),
    notice('Security note', `${SECURITY_NOTE} Never share this code with anyone.`),
  ].join('');
  return {
    subject: 'Your DinkManager verification code',
    previewText,
    html: emailShell({ previewText, bodyHtml }),
    text: plainText([`Hi ${firstName},`, '', `Your DinkManager verification code is: ${code}`, '', '— The DinkManager Team']),
  };
}

// ---------------------------------------------------------------------------
// Hook handler
// ---------------------------------------------------------------------------
function hookResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function hookError(httpCode, message) {
  return hookResponse({ error: { http_code: httpCode, message } }, httpCode);
}

function firstNameOf(user) {
  const name = String(user?.user_metadata?.display_name || '').trim();
  return name ? name.split(/\s+/)[0] : 'there';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return hookError(405, 'Method not allowed');

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '').replace('v1,whsec_', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!resendKey || !hookSecret || !supabaseUrl) return hookError(500, 'Email hook is not configured');

  // The raw body string, verified before it's ever parsed — Standard
  // Webhooks signs the exact bytes, so it must not be re-serialized first.
  const payload = await req.text();
  let data;
  try {
    data = new Webhook(hookSecret).verify(payload, Object.fromEntries(req.headers));
  } catch {
    return hookError(401, 'Invalid webhook signature');
  }

  const { user, email_data: emailData } = data || {};
  const type = emailData?.email_action_type;
  if (!user?.email || !type) return hookError(400, 'Malformed hook payload');

  const firstName = firstNameOf(user);
  // Supabase's own verify endpoint (the project's API host — NOT
  // email_data.site_url, which is the app's domain). It checks the token
  // server-side, then redirects to redirect_to (e.g. /verify-email).
  const verifyUrl = (tokenHash) =>
    `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(
      emailData.redirect_to || emailData.site_url || APP_ORIGIN
    )}`;

  let to = user.email;
  let email;
  switch (type) {
    case 'signup':
      email = verificationEmail({ firstName, url: verifyUrl(emailData.token_hash) });
      break;
    case 'recovery':
      email = passwordResetEmail({ firstName, url: verifyUrl(emailData.token_hash) });
      break;
    case 'invite':
      email = inviteEmail({ firstName, url: verifyUrl(emailData.token_hash) });
      break;
    case 'magiclink':
      email = magicLinkEmail({ firstName, url: verifyUrl(emailData.token_hash) });
      break;
    case 'email_change':
      // Not exposed anywhere in the app today. If email change is ever added
      // with "Secure email change" on, Supabase sends two tokens (current +
      // new address) — check its docs for which hash goes to which address.
      to = user.new_email || user.email;
      email = emailChangeEmail({ firstName, url: verifyUrl(emailData.token_hash) });
      break;
    case 'reauthentication':
      email = reauthenticationEmail({ firstName, code: emailData.token });
      break;
    default:
      return hookError(400, `Unsupported email action type: ${type}`);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject: email.subject, html: email.html, text: email.text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`send-auth-email: Resend rejected ${type} email (status ${res.status})`);
    return hookError(502, `Could not send email: ${detail.slice(0, 200) || res.status}`);
  }

  return hookResponse({});
});
