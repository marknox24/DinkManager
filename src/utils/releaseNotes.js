// Turns the git history into the public "Recent updates" list (landing page
// footer and /updates), so it follows every deploy without anyone editing
// it by hand. Used in three places that must agree: /api/recent-updates
// (live, from the GitHub API), vite.config.js (a build-time copy used until
// that answers, or if it fails), and the components that render them.
//
// Opt-in, because most commits are internal (database scripts, caching,
// review fixes) and commit bodies are written for developers. A commit is
// listed only if its message has a visitor-facing section:
//
//   Changelog: Added a new score sheet template (V2)
//   Changelog-type: Feature            (optional: Feature | Performance | Fix)
//   Changelog-detail: Three tear-off strips per A4 page
//   Changelog-detail: Pick V1 or V2 in the preview      (repeat per bullet)
//
// Updates shipped before this existed are described in HISTORY below.

export const RECENT_UPDATES_COUNT = 5;
export const ALL_UPDATES_COUNT = 40;
export const RELEASE_TYPES = ['Feature', 'Performance', 'Fix'];

// Visitor-facing wording for updates shipped before the Changelog lines
// existed, keyed by short commit SHA. The date still comes from the commit.
const HISTORY = {
  f6925b2: {
    type: 'Feature',
    title: 'Added a new score sheet template (V2) with a V1/V2 picker',
    details: [
      'Score sheet V2 prints three tear-off strips per A4 page, with a 0–15 rally row for each team',
      'Pick V1 or V2 in the Score Sheets and Blank Template previews; the new one is marked New',
      'Print or download either template as a PDF, and your choice is remembered on that device',
      'Blank sheets now leave the category as a line for the umpire to fill in',
    ],
  },
  '0b7ce3f': {
    type: 'Performance',
    title: 'Kept organizer screens fast when many courts and players are busy',
    details: [
      'Match List and Brackets refresh only what another organizer changed, instead of reloading everything',
      'Live court cards load in a single step',
      'Players waiting for their partner at check-in no longer add load for organizers',
      'Public pages answer faster when they need fresh data',
    ],
  },
  '2fbdd87': {
    type: 'Fix',
    title: 'Fixed an error some organizers saw when creating a Free Trial event',
    details: [
      'New events always get their own web address, even when another organizer has a draft with the same name',
      'Renaming and publishing a draft no longer clashes with another event',
    ],
  },
  cdbb348: {
    type: 'Fix',
    title: 'Kept the landing page navigation on one line at every screen width',
    details: ['Menu links no longer wrap onto two lines on laptops', 'On smaller screens the section links move into the menu, and the account buttons stay in the bar'],
  },
  '5426dae': {
    type: 'Fix',
    title: 'Fixed the landing page sometimes not loading right after an update',
    details: ['Returning visitors always get the newest version of the page', 'Anyone stuck on an older version now recovers by itself, without closing every tab'],
  },
  e71c1dd: {
    type: 'Fix',
    title: 'Improved registrations on phones and the semifinal setup',
    details: [
      'Registrations on phones show the Facebook link, ID photos and Approve/Deny without sideways scrolling',
      'The registration form explains that a social profile needs to be public',
      'Semifinal setup waits for a coin toss when teams are tied on points',
      'Bracket lines match a points-seeded semifinal draw',
    ],
  },
  afa15b7: {
    type: 'Feature',
    title: 'Set up semifinals in a popup when generating them',
    details: [
      'Generate Semifinals opens a setup popup, pre-filled with the category’s saved setup',
      'The points system now also works for categories that start at the quarterfinals',
      'The Match List shows the semifinal setup on the Semifinals row',
    ],
  },
  b1ccf7c: {
    type: 'Feature',
    title: 'Added the app version to the sidebar with an Update now button',
    details: ['Organizers can see which version they’re on', 'Update now loads the newest version in one tap'],
  },
  c4b42b5: {
    type: 'Feature',
    title: 'Added a points-system option for semifinal matchups',
    details: [
      'Seed the four semifinalists 1–4 by round-robin point differential instead of the pool crossover',
      'Choose the pairing: 1v4 / 2v3, 1v2 / 3v4 or 1v3 / 2v4',
      'Settle ties with a coin toss before generating',
    ],
  },
  ed0ae5a: {
    type: 'Feature',
    title: 'Let organizers hide the registered players list',
    details: ['New Show registered players switch in event Settings', 'When it’s off, player names stay off the public event page; division slot counts still show'],
  },
  '09c98c7': {
    type: 'Feature',
    title: 'Added Double Round Robin and a playoffs switch to the Tournament Time Calculator',
    details: ['Double Round Robin is now a format option', 'Playoffs are an on/off switch on either round robin format'],
  },
  '8b03f54': {
    type: 'Performance',
    title: 'Hardened the live site for event-day traffic and updates',
    details: [
      'Open tabs recover automatically after an update',
      'Scores entered offline sync in the order they were entered',
      'Check-in and public player lists handle events with more than 1,000 players',
    ],
  },
  '3b892a8': {
    type: 'Feature',
    title: 'Added a free Tournament Time Calculator',
    details: ['Plan brackets and estimate match counts and finish time, no login needed', 'Preview a court-by-court schedule'],
  },
  d75b3b7: {
    type: 'Feature',
    title: 'Registration can ask players for a Facebook or social profile link',
    details: ['Organizers can see each player’s profile link in Registrations'],
  },
  '8544a6f': {
    type: 'Feature',
    title: 'Added umpire rotation and a way to clear a mistaken result',
    details: [
      'See how many games each umpire has called on the Umpires page, Start match and Log score',
      'Start match recommends the next umpire',
      'Edit score can clear a mistaken result back to Scheduled',
    ],
  },
  '4ef0102': {
    type: 'Fix',
    title: 'Fixed overlapping words in downloaded images',
    details: ['Downloaded images use the right fonts, so labels don’t wrap and names aren’t cut off', 'Brackets List rows now read Pair N (Player N for singles)'],
  },
  a892fad: {
    type: 'Feature',
    title: 'Show who’s registered on the event page',
    details: ['A strip at the top of the event page and a Who’s playing section below the divisions'],
  },
  ff96c6b: {
    type: 'Feature',
    title: 'Kept several organizers in sync at one event',
    details: ['Scores and changes made on one organizer’s device show up on the others', 'Two organizers entering the same score no longer create duplicates'],
  },
  b2c7b42: {
    type: 'Feature',
    title: 'Added Round of 16 and Round of 32 playoffs',
    details: ['Playoffs can start at a Round of 16 or 32, depending on the number of teams', 'Public pages stay fast when a crowd arrives at once'],
  },
  fe1a158: {
    type: 'Feature',
    title: 'Rebuilt the playoff bracket layout for phones and big screens',
    details: ['A stage-by-stage list on phones and a full bracket on wider screens', 'No more overlapping boxes or misplaced connector lines'],
  },
  ff5ac0b: {
    type: 'Feature',
    title: 'Added match forfeits, double forfeits and player withdrawals',
    details: [
      'Record a forfeit (W/O) or a double forfeit from the Match List or a live court card',
      'Withdraw a player: unfinished matches become forfeits and played results stay',
      'Reinstate undoes a withdrawal',
    ],
  },
  '9766a96': {
    type: 'Fix',
    title: 'Streamlined the Create Event flow for returning organizers',
    details: ['Returning organizers go through plan selection and approval instead of hitting an error', 'A Waiting for Approval card shows a submitted request on the dashboard'],
  },
  '1c59390': {
    type: 'Performance',
    title: 'Improved platform stability during high-traffic sign-ups',
    details: ['Scoring and registration stay responsive with several events running at once'],
  },
  '70f82c8': {
    type: 'Performance',
    title: 'Hardened sign-in and cut mobile load times with smarter caching',
    details: [
      'Sign-in no longer hangs on a slow connection',
      'The Preview Screen loads from a shared cache for everyone, including signed-in viewers',
      'Phones download less to open the app',
    ],
  },
  c7c9549: {
    type: 'Feature',
    title: 'Added real-time Single Elimination bracket progression with seeded byes',
    details: ['Winners move on to their next match automatically', 'Byes are spread through Round 1 like a standard seeded draw', 'An automatic 3rd-place match'],
  },
  '26b9d38': {
    type: 'Feature',
    title: 'Added a dynamic, auto-updating Match Schedule',
    details: ['Estimated start time, court and status for every match', 'Times shift automatically as matches start, finish or run long'],
  },
};

function guessType(title) {
  if (/^fix/i.test(title)) return 'Fix';
  if (/\b(fast|faster|speed|performance|traffic|load times?|stabilit|crowds?)/i.test(title)) return 'Performance';
  return 'Feature';
}

// Reads the Changelog lines out of a commit message (anywhere in the body).
export function parseChangelog(message) {
  const lines = String(message || '').split('\n');
  const value = (key) =>
    lines
      .map((l) => l.match(new RegExp(`^${key}:[ \\t]*(.+)$`, 'i'))?.[1]?.trim())
      .filter(Boolean);
  const title = value('Changelog')[0];
  if (!title) return null;
  const type = value('Changelog-type')[0];
  return {
    title,
    type: RELEASE_TYPES.find((t) => t.toLowerCase() === type?.toLowerCase()) || guessType(title),
    details: value('Changelog-detail'),
  };
}

// { sha, message, date } → { sha, title, type, details, date }, or null when
// the commit isn't a visitor-facing update.
export function releaseNoteFromCommit({ sha, message, date }) {
  if (!sha || !date) return null;
  const short = sha.slice(0, 7);
  const note = parseChangelog(message) || HISTORY[short];
  if (!note || /^skip$/i.test(note.title)) return null;
  return { sha: short, title: note.title, type: note.type, details: note.details || [], date };
}

// Newest first, as `git log` and the GitHub API both return them.
export function releaseNotesFromCommits(commits, limit = RECENT_UPDATES_COUNT) {
  const notes = [];
  for (const c of commits) {
    const note = releaseNoteFromCommit(c);
    if (note) notes.push(note);
    if (notes.length >= limit) break;
  }
  return notes;
}

// Automatic clean-up for the /updates page: only the last ~2 months, but
// never fewer than the newest `min`, so a quiet stretch doesn't leave the
// page empty. Older updates stay in the git history; nothing is deleted.
export const RETENTION_DAYS = 60;

export function keepRecent(notes, { now = Date.now(), days = RETENTION_DAYS, min = RECENT_UPDATES_COUNT } = {}) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return notes.filter((n, i) => i < min || new Date(n.date).getTime() >= cutoff);
}

export function isReleaseNoteList(value) {
  return (
    Array.isArray(value) &&
    value.every((n) => n && typeof n.title === 'string' && typeof n.type === 'string' && typeof n.date === 'string' && Array.isArray(n.details))
  );
}

// "Nov 24, 2026 · 1:29 PM", in Manila time wherever the visitor is.
export function formatReleaseDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = { timeZone: 'Asia/Manila' };
  const day = new Intl.DateTimeFormat('en-US', { ...tz, month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('en-US', { ...tz, hour: 'numeric', minute: '2-digit' }).format(d);
  return `${day} · ${time}`;
}
