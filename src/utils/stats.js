export function getRankedTeams(teams) {
  const enriched = teams.map((t) => ({ ...t, diff: t.pointsFor - t.pointsAgainst }));
  enriched.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.diff !== b.diff) return b.diff - a.diff;
    return b.pointsFor - a.pointsFor;
  });
  return enriched.map((team, idx) => ({ ...team, rank: idx + 1 }));
}

export function getRecentScores(teamId, history, limit = 3) {
  const matches = history.filter((m) => m.teamAId === teamId || m.teamBId === teamId).slice(0, limit);
  if (matches.length === 0) return [];
  return matches.map((m) => {
    const isTeamA = m.teamAId === teamId;
    const myScore = isTeamA ? m.scoreA : m.scoreB;
    const oppScore = isTeamA ? m.scoreB : m.scoreA;
    return { win: myScore > oppScore, myScore, oppScore };
  });
}

export function hasMatchBetween(history, id1, id2) {
  return history.some(
    (m) => (m.teamAId === id1 && m.teamBId === id2) || (m.teamAId === id2 && m.teamBId === id1)
  );
}

export function getBracketStats(bracket, liveMatches, catIdx, bracketLocalIdx) {
  const n = bracket.teams.length;
  const total = (n * (n - 1)) / 2;
  const played = bracket.matchHistory.length;
  const inProgress = liveMatches.filter((m) => m.catIdx === catIdx && m.bracketIdx === bracketLocalIdx).length;
  const remaining = Math.max(0, total - played - inProgress);
  return { total, played, inProgress, remaining };
}

export function getCategoryStats(category, liveMatches, catIdx, settings) {
  let total = 0;
  let played = 0;
  category.brackets.forEach((b) => {
    const n = b.teams.length;
    total += (n * (n - 1)) / 2;
    played += b.matchHistory.length;
  });
  const inProgress = liveMatches.filter((m) => m.catIdx === catIdx).length;
  const notStarted = Math.max(0, total - played - inProgress);
  const courts = Math.max(1, settings.numCourts);
  const estMinutes = Math.ceil(notStarted / courts) * settings.matchDurationMinutes;
  return { total, played, inProgress, notStarted, estMinutes };
}

export function getTournamentStats(categories, liveMatches) {
  let totalTeams = 0;
  let totalMatches = 0;
  let playedMatches = 0;
  categories.forEach((cat) => {
    cat.brackets.forEach((b) => {
      totalTeams += b.teams.length;
      totalMatches += (b.teams.length * (b.teams.length - 1)) / 2;
      playedMatches += b.matchHistory.length;
    });
  });
  return {
    categories: categories.length,
    totalTeams,
    totalMatches,
    playedMatches,
    liveMatches: liveMatches.length,
  };
}

export function getOccupiedCourtNumbers(liveMatches) {
  return new Set(liveMatches.map((m) => m.court));
}

export function getAvailableCourtNumbers(liveMatches, numCourts) {
  const occupied = getOccupiedCourtNumbers(liveMatches);
  const list = [];
  for (let i = 1; i <= numCourts; i++) {
    if (!occupied.has(i)) list.push(i);
  }
  return list;
}

export function getLiveTeamIds(liveMatches, catIdx, bracketIdx) {
  const set = new Set();
  liveMatches.forEach((m) => {
    if (m.catIdx === catIdx && m.bracketIdx === bracketIdx) {
      set.add(m.teamAIdx);
      set.add(m.teamBIdx);
    }
  });
  return set;
}

export function isTeamPlayingLive(liveMatches, catIdx, bracketIdx, teamIdx) {
  return liveMatches.some(
    (m) => m.catIdx === catIdx && m.bracketIdx === bracketIdx && (m.teamAIdx === teamIdx || m.teamBIdx === teamIdx)
  );
}

export function isUmpireBusy(liveMatches, umpireId) {
  return liveMatches.some((m) => m.umpireId === umpireId);
}

export function getAvailableUmpires(umpires, liveMatches) {
  return umpires.filter((u) => !isUmpireBusy(liveMatches, u.id));
}

export function recalcStatsFromHistory(teams, history) {
  teams.forEach((t) => {
    t.wins = 0;
    t.losses = 0;
    t.pointsFor = 0;
    t.pointsAgainst = 0;
  });
  history.forEach((m) => {
    const teamA = teams.find((t) => t.id === m.teamAId);
    const teamB = teams.find((t) => t.id === m.teamBId);
    if (!teamA || !teamB) return;
    teamA.pointsFor += m.scoreA;
    teamA.pointsAgainst += m.scoreB;
    teamB.pointsFor += m.scoreB;
    teamB.pointsAgainst += m.scoreA;
    if (m.scoreA > m.scoreB) {
      teamA.wins++;
      teamB.losses++;
    } else if (m.scoreB > m.scoreA) {
      teamB.wins++;
      teamA.losses++;
    }
  });
}
