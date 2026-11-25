// CDN-cached "Recent updates" for the landing page footer and /updates,
// built from the latest commits on main (the branch every production deploy
// comes from), so the list follows each deploy with no manual editing. Which
// commits count, and their wording, is decided in src/utils/releaseNotes.js.
//
//   /api/recent-updates            → newest 5
//   /api/recent-updates?limit=40   → up to 40 (the /updates page)
//
// The repo is public, so no token is needed; set GITHUB_TOKEN in Vercel only
// if the unauthenticated rate limit (60/hour per IP) ever becomes a problem.
// With a 10-minute edge cache this calls GitHub a few times an hour at most,
// and a deploy clears the cache, so a new update shows right away.
//
// Any failure is a 502 that isn't cached; the page then keeps the
// build-time copy (see vite.config.js).
import { sendCached, sendError, UPSTREAM_TIMEOUT_MS } from './_cache.js';
import { ALL_UPDATES_COUNT, RECENT_UPDATES_COUNT, releaseNotesFromCommits } from '../src/utils/releaseNotes.js';

const REPO = 'marknox24/DinkManager';

export default async function handler(req, res) {
  const requested = Number.parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(requested) ? Math.min(ALL_UPDATES_COUNT, Math.max(1, requested)) : RECENT_UPDATES_COUNT;
  try {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'recent-updates-endpoint' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const upstream = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=main&per_page=100`, {
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return sendError(res, 502, `GitHub ${upstream.status}`);
    const commits = await upstream.json();
    if (!Array.isArray(commits)) return sendError(res, 502, 'Unexpected GitHub response');
    const notes = releaseNotesFromCommits(
      commits.map((item) => ({
        sha: item.sha,
        message: item.commit?.message,
        date: item.commit?.committer?.date || item.commit?.author?.date,
      })),
      limit
    );
    return sendCached(res, notes, { maxAge: 600, staleWhileRevalidate: 86400 });
  } catch {
    return sendError(res, 502, 'Recent updates unavailable');
  }
}
