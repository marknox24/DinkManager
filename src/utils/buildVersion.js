// Whether the build described by version.json (`live`) is a different build
// from the one this tab runs. Compared by exact build time when both carry
// one, since the version string is only minute-precise and two deploys in the
// same minute share it; builds from before build times were stamped fall back
// to the version.
export function isDifferentBuild(live, current) {
  if (!live?.version) return false;
  if (live.builtAt && current.builtAt) return live.builtAt !== current.builtAt;
  return live.version !== current.version;
}
