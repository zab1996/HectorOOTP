import { round2 } from "./util.js";

export function calculateMaxPlayerScores(pitchers, batters) {
  let maxPitcher = 0.0;
  let maxBatter = 0.0;
  for (const pitcher of pitchers) {
    const total = pitcher.Scores?.total ?? 0;
    if (total > maxPitcher) maxPitcher = total;
  }
  for (const batter of batters) {
    const total = batter.Scores?.total ?? 0;
    if (total > maxBatter) maxBatter = total;
  }
  const maxPlayer = Math.max(maxPitcher, maxBatter);
  const base = maxPlayer > 0 ? maxPlayer * 0.65 : 25.0;
  return {
    max_pitcher_score: maxPitcher,
    max_batter_score: maxBatter,
    draft_pick_base_value: base,
  };
}

export function getPickExponentialMultiplier(pickNumber, numTeams) {
  if (pickNumber === 1 || numTeams === 1) return 1.0;
  const targetFinal = 0.03;
  const decayRate = -Math.log(targetFinal) / (numTeams - 1);
  return Math.exp(-decayRate * (pickNumber - 1));
}

export function getRoundGroupMultiplier(roundNum, numRounds) {
  if (roundNum < 1 || roundNum > numRounds) return 0.0001;
  if (roundNum === 1) return 1.0;
  if (roundNum === 2) return 0.12;
  if (roundNum <= 5) {
    const prev = roundNum === 3 ? 0.12 : getRoundGroupMultiplier(roundNum - 1, numRounds);
    return prev * 0.5;
  }
  if (roundNum <= 10) return getRoundGroupMultiplier(roundNum - 1, numRounds) * 0.7;
  return getRoundGroupMultiplier(roundNum - 1, numRounds) * 0.8;
}

export function getPositionImportanceFactor(roundNum, numRounds) {
  if (roundNum <= 5) return 1.0;
  if (roundNum <= 10) return 1.0 - (roundNum - 5) * 0.1;
  const roundsAfter10 = Math.min(roundNum - 10, numRounds - 10);
  const totalLate = Math.max(1, numRounds - 10);
  return Math.max(0.1, 0.3 - roundsAfter10 * (0.2 / totalLate));
}

export function calculateDraftPickValue(
  roundNum,
  positionInStandings,
  numTeams,
  numRounds,
  draftPickBaseValue,
) {
  if (roundNum < 1 || roundNum > numRounds) {
    return {
      round: roundNum,
      pick_number: 0,
      position_in_standings: positionInStandings,
      value: 0.0,
      display: `Invalid round ${roundNum}`,
    };
  }
  if (positionInStandings < 1 || positionInStandings > numTeams) {
    return {
      round: roundNum,
      pick_number: 0,
      position_in_standings: positionInStandings,
      value: 0.0,
      display: `Invalid position ${positionInStandings}`,
    };
  }
  const pickNumber = numTeams + 1 - positionInStandings;
  const pickMultiplier = getPickExponentialMultiplier(pickNumber, numTeams);
  const roundMultiplier = getRoundGroupMultiplier(roundNum, numRounds);
  const positionImportance = getPositionImportanceFactor(roundNum, numRounds);
  let adjusted;
  if (roundNum > 5) {
    const mid1 = Math.floor(numTeams / 2);
    const mid2 = Math.floor(numTeams / 2) + 1;
    const avgPick =
      (getPickExponentialMultiplier(mid1, numTeams) +
        getPickExponentialMultiplier(mid2, numTeams)) /
      2;
    adjusted = pickMultiplier * positionImportance + avgPick * (1 - positionImportance);
  } else {
    adjusted = pickMultiplier;
  }
  let pickValue = draftPickBaseValue * adjusted * roundMultiplier;
  const baseMin = draftPickBaseValue * 0.001;
  const roundMinFactor = Math.max(0.4, 1.0 - (roundNum - 1) * 0.02);
  pickValue = Math.max(pickValue, baseMin * roundMinFactor);
  return {
    round: roundNum,
    pick_number: pickNumber,
    position_in_standings: positionInStandings,
    value: round2(pickValue),
    display: `Round ${roundNum}, Pick #${pickNumber}`,
  };
}

export function calculateTeamTotals(players, picks, maxPitcherScore, maxBatterScore) {
  const pitcherNorm = maxPitcherScore > 0 ? 100.0 / maxPitcherScore : 1.0;
  const batterNorm = maxBatterScore > 0 ? 100.0 / maxBatterScore : 1.0;
  let pitchersCurrent = 0;
  let pitchersPotential = 0;
  let pitchersTotal = 0;
  let battersCurrent = 0;
  let battersPotential = 0;
  let battersDefense = 0;
  let battersTotal = 0;
  let draftPicksValue = 0;

  for (const player of players) {
    const scores = player.Scores || {};
    if (player._type === "pitcher") {
      pitchersCurrent += (scores.curr_total ?? 0) * pitcherNorm;
      const pot = (scores.core_potential ?? 0) + (scores.pitches_potential ?? 0) + (scores.pot_penalties ?? 0);
      pitchersPotential += pot * pitcherNorm;
      pitchersTotal += (scores.total ?? 0) * pitcherNorm;
    } else {
      battersCurrent += (scores.offense ?? 0) * batterNorm;
      battersPotential += (scores.offense_potential ?? 0) * batterNorm;
      battersDefense += (scores.defense ?? 0) * batterNorm;
      battersTotal += (scores.total ?? 0) * batterNorm;
    }
  }
  if (picks) {
    for (const pick of picks) draftPicksValue += pick.value ?? 0;
  }
  return {
    pitchers_current: round2(pitchersCurrent),
    pitchers_potential: round2(pitchersPotential),
    pitchers_total: round2(pitchersTotal),
    batters_current: round2(battersCurrent),
    batters_potential: round2(battersPotential),
    batters_defense: round2(battersDefense),
    batters_total: round2(battersTotal),
    draft_picks_value: round2(draftPicksValue),
    team_current: round2(pitchersCurrent + battersCurrent),
    team_potential: round2(pitchersPotential + battersPotential),
    team_total: round2(pitchersTotal + battersTotal + draftPicksValue),
  };
}

export function findPlayerByName(name, pitchers, batters) {
  const nameLower = name.trim().toLowerCase();
  if (!nameLower) return null;
  for (const p of pitchers) {
    if (String(p.Name || "").toLowerCase().includes(nameLower)) return { type: "pitcher", player: p };
  }
  for (const b of batters) {
    if (String(b.Name || "").toLowerCase().includes(nameLower)) return { type: "batter", player: b };
  }
  return null;
}

export function getMatchingPlayers(prefix, pitchers, batters, limit = 10) {
  const prefixLower = prefix.trim().toLowerCase();
  if (!prefixLower) return [];
  const matches = [];
  for (const p of pitchers) {
    const name = p.Name || "";
    if (name.toLowerCase().includes(prefixLower)) {
      matches.push({
        type: "pitcher",
        id: p.ID || "",
        name,
        display: `${name} (${p.ORG || ""}, ${p.POS || ""})`,
      });
    }
  }
  for (const b of batters) {
    const name = b.Name || "";
    if (name.toLowerCase().includes(prefixLower)) {
      matches.push({
        type: "batter",
        id: b.ID || "",
        name,
        display: `${name} (${b.ORG || ""}, ${b.POS || ""})`,
      });
    }
  }
  matches.sort((a, b) => a.display.toLowerCase().localeCompare(b.display.toLowerCase()));
  return matches.slice(0, limit);
}

export function compareTrade(totalsA, totalsB) {
  function winner(a, b) {
    if (a > b) return "A";
    if (b > a) return "B";
    return "Tie";
  }
  const statsA = totalsA.stats_total ?? totalsA.team_total;
  const statsB = totalsB.stats_total ?? totalsB.team_total;
  return {
    current_diff: round2(totalsA.team_current - totalsB.team_current),
    potential_diff: round2(totalsA.team_potential - totalsB.team_potential),
    picks_diff: round2(totalsA.draft_picks_value - totalsB.draft_picks_value),
    stats_diff: round2(statsA - statsB),
    war_diff: round2((totalsA.war_sum ?? 0) - (totalsB.war_sum ?? 0)),
    contract_diff: round2((totalsA.contract_delta ?? 0) - (totalsB.contract_delta ?? 0)),
    total_diff: round2(totalsA.team_total - totalsB.team_total),
    current_winner: winner(totalsA.team_current, totalsB.team_current),
    potential_winner: winner(totalsA.team_potential, totalsB.team_potential),
    picks_winner: winner(totalsA.draft_picks_value, totalsB.draft_picks_value),
    stats_winner: winner(statsA, statsB),
    war_winner: winner(totalsA.war_sum ?? 0, totalsB.war_sum ?? 0),
    contract_winner: winner(totalsA.contract_delta ?? 0, totalsB.contract_delta ?? 0),
    overall_winner: winner(totalsA.team_total, totalsB.team_total),
  };
}
