// A player's Facebook or other social media profile link, which organizers
// use to look into a player's history. Players type all sorts of things
// ("facebook.com/ana", "www.fb.com/ana", a full https link), so links are
// tidied before saving and checked only for being a plausible web address.

// Matches registrations_social_url_length in schema.sql.
export const PROFILE_URL_MAX = 500;

// The link as it should be saved, or null when the field is empty. Adds
// https:// when the player left it off, so the organizer's link opens.
export function normalizeProfileUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// True for something that will open as a web page: http(s), no spaces, and a
// host with a dot in it. Empty counts as valid; whether it's required is the
// form's call.
export function isValidProfileUrl(value) {
  const url = normalizeProfileUrl(value);
  if (!url) return true;
  if (url.length > PROFILE_URL_MAX || /\s/.test(url)) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === 'https:' || protocol === 'http:') && /\.[a-z]{2,}$/i.test(hostname);
  } catch {
    return false;
  }
}

// The link to put in an href, or null. Only http(s): a link saved some other
// way could be javascript:, which would run when the organizer clicks it.
export function safeProfileHref(value) {
  const url = (value || '').trim();
  return /^https?:\/\//i.test(url) && isValidProfileUrl(url) ? url : null;
}

const PLATFORMS = [
  { name: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me', 'messenger.com'] },
  { name: 'Instagram', hosts: ['instagram.com'] },
  { name: 'TikTok', hosts: ['tiktok.com'] },
  { name: 'X', hosts: ['x.com', 'twitter.com'] },
  { name: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { name: 'LinkedIn', hosts: ['linkedin.com'] },
];

// "Facebook", "Instagram"… for the link's site, or its host for anything else.
export function profilePlatform(value) {
  try {
    const host = new URL(normalizeProfileUrl(value)).hostname.toLowerCase().replace(/^(www|m|web|mobile)\./, '');
    return PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.name ?? host;
  } catch {
    return 'Profile';
  }
}

// The links on a registration, one per player, in the order they appear.
export function registrationProfiles(r) {
  const doubles = Boolean(r.player2_name);
  return [
    { label: doubles ? 'Player 1' : 'Player', name: r.player_name, url: r.player_social_url },
    ...(doubles ? [{ label: 'Player 2', name: r.player2_name, url: r.player2_social_url }] : []),
  ];
}
