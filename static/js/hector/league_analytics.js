/**
 * League Analysis — JS port of Portal league_analytics.py.
 * Park/standings/DIV/YoY from Team List; batting/pitching WAR from Player List (majors by ORG).
 */
import { parseNumber, getWar } from "./player_analytics.js";
import { isMajorLeague } from "./league.js";

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Approx 90th percentile (Portal statistics.quantiles n=10 last cut). */
function p90(values) {
  if (values.length < 10) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1);
  return s[Math.max(0, idx)];
}

function pfVal(team, key) {
  const n = team?.pf?.[key];
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function winPct(team) {
  return parseNumber(team.win_pct ?? 0);
}

/**
 * Attach majors roster WAR (batter / pitcher) to each Team List row by Abbr ↔ ORG.
 */
export function enrichTeamsWithRosterWar(teamList, pitchers, batters) {
  const batWar = new Map();
  const pitWar = new Map();

  for (const b of batters || []) {
    if (isMajorLeague(b) === false) continue;
    const org = String(b.ORG || "").trim().toUpperCase();
    if (!org) continue;
    batWar.set(org, (batWar.get(org) || 0) + getWar(b, "batter"));
  }
  for (const p of pitchers || []) {
    if (isMajorLeague(p) === false) continue;
    const org = String(p.ORG || "").trim().toUpperCase();
    if (!org) continue;
    pitWar.set(org, (pitWar.get(org) || 0) + getWar(p, "pitcher"));
  }

  return (teamList || []).map((t) => {
    const key = String(t.abbr || "").trim().toUpperCase();
    const batting_war = Math.round((batWar.get(key) || 0) * 10) / 10;
    const pitching_war = Math.round((pitWar.get(key) || 0) * 10) / 10;
    return {
      ...t,
      batting_war,
      pitching_war,
      total_war: Math.round((batting_war + pitching_war) * 10) / 10,
    };
  });
}

export function calculateLeagueEnvironment(teams) {
  if (!teams?.length) return {};
  const result = {
    total_teams: teams.length,
    park_factors: {},
    batting_war: {},
    pitching_war: {},
  };

  const pfColumns = ["PF", "PF AVG", "PF HR", "PF D", "PF T"];
  const pfData = Object.fromEntries(pfColumns.map((c) => [c, []]));
  for (const team of teams) {
    for (const col of pfColumns) {
      const val = pfVal(team, col);
      if (val != null && val > 0) pfData[col].push(val);
    }
  }
  for (const [col, values] of Object.entries(pfData)) {
    if (!values.length) continue;
    result.park_factors[`${col}_mean`] = Math.round(mean(values) * 1000) / 1000;
    result.park_factors[`${col}_median`] = Math.round(median(values) * 1000) / 1000;
    if (values.length > 1) {
      result.park_factors[`${col}_std`] = Math.round(stdev(values) * 1000) / 1000;
    }
    result.park_factors[`${col}_min`] = Math.round(Math.min(...values) * 1000) / 1000;
    result.park_factors[`${col}_max`] = Math.round(Math.max(...values) * 1000) / 1000;
  }

  const battingWars = teams.map((t) => t.batting_war || 0).filter((w) => w > 0);
  const pitchingWars = teams.map((t) => t.pitching_war || 0).filter((w) => w > 0);
  if (battingWars.length) {
    result.batting_war = {
      mean: Math.round(mean(battingWars) * 10) / 10,
      median: Math.round(median(battingWars) * 10) / 10,
      std: battingWars.length > 1 ? Math.round(stdev(battingWars) * 10) / 10 : 0,
      min: Math.round(Math.min(...battingWars) * 10) / 10,
      max: Math.round(Math.max(...battingWars) * 10) / 10,
    };
  }
  if (pitchingWars.length) {
    result.pitching_war = {
      mean: Math.round(mean(pitchingWars) * 10) / 10,
      median: Math.round(median(pitchingWars) * 10) / 10,
      std: pitchingWars.length > 1 ? Math.round(stdev(pitchingWars) * 10) / 10 : 0,
      min: Math.round(Math.min(...pitchingWars) * 10) / 10,
      max: Math.round(Math.max(...pitchingWars) * 10) / 10,
    };
  }

  const avgPf = result.park_factors.PF_mean ?? 1.0;
  if (avgPf > 1.05) result.environment_type = "hitter_friendly";
  else if (avgPf < 0.95) result.environment_type = "pitcher_friendly";
  else result.environment_type = "neutral";

  return result;
}

export function calculateParityIndex(teams) {
  if (!teams?.length) return {};
  const result = { teams_near_500: {}, division_balance: {} };

  const winPcts = teams.map(winPct).filter((p) => p > 0);
  result.win_pct_std =
    winPcts.length > 1 ? Math.round(stdev(winPcts) * 1000) / 1000 : 0;

  result.teams_near_500 = {
    within_5_games: winPcts.filter((p) => Math.abs(p - 0.5) <= 0.031).length,
    within_10_games: winPcts.filter((p) => Math.abs(p - 0.5) <= 0.062).length,
  };

  const divisions = {};
  for (const team of teams) {
    const div = team.div || "Unknown";
    const pct = winPct(team);
    if (pct > 0) {
      if (!divisions[div]) divisions[div] = [];
      divisions[div].push(pct);
    }
  }

  for (const [divName, divPcts] of Object.entries(divisions)) {
    if (divPcts.length < 2) continue;
    const divStd = stdev(divPcts);
    const divSpread = Math.max(...divPcts) - Math.min(...divPcts);
    let status;
    if (divStd < 0.07) status = "highly_competitive";
    else if (divStd < 0.1) status = "competitive";
    else if (divStd < 0.13) status = "moderate";
    else status = "runaway";

    result.division_balance[divName] = {
      std: Math.round(divStd * 1000) / 1000,
      spread: Math.round(divSpread * 1000) / 1000,
      min_pct: Math.round(Math.min(...divPcts) * 1000) / 1000,
      max_pct: Math.round(Math.max(...divPcts) * 1000) / 1000,
      status,
    };
  }

  if (result.win_pct_std < 0.07) result.overall_parity = "high";
  else if (result.win_pct_std < 0.1) result.overall_parity = "medium";
  else result.overall_parity = "low";

  return result;
}

export function analyzeParkFactors(teams) {
  if (!teams?.length) return {};
  const result = {
    extreme_parks: [],
    park_groups: {
      hr_friendly: [],
      hr_suppressing: [],
      avg_inflating: [],
      avg_suppressing: [],
      neutral: [],
    },
  };

  for (const team of teams) {
    const pfHr = pfVal(team, "PF HR");
    const pfAvg = pfVal(team, "PF AVG");
    const pfOverall = pfVal(team, "PF");
    if (pfHr == null || pfAvg == null) continue;

    const parkInfo = {
      team: team.abbr || "",
      team_name: team.name || "",
      park: team.park || "",
      PF: pfOverall ?? 1.0,
      "PF HR": pfHr,
      "PF AVG": pfAvg,
    };

    if (pfHr > 1.1) {
      result.extreme_parks.push({ ...parkInfo, type: "hr_friendly", severity: "extreme" });
    } else if (pfHr < 0.9) {
      result.extreme_parks.push({ ...parkInfo, type: "hr_suppressing", severity: "extreme" });
    }

    if (pfAvg > 1.1) {
      if (!result.extreme_parks.some((p) => p.team === parkInfo.team && p.type === "hr_friendly")) {
        result.extreme_parks.push({ ...parkInfo, type: "avg_inflating", severity: "extreme" });
      }
    } else if (pfAvg < 0.9) {
      if (
        !result.extreme_parks.some((p) => p.team === parkInfo.team && p.type === "hr_suppressing")
      ) {
        result.extreme_parks.push({ ...parkInfo, type: "avg_suppressing", severity: "extreme" });
      }
    }

    if (pfHr > 1.05) result.park_groups.hr_friendly.push(parkInfo);
    else if (pfHr < 0.95) result.park_groups.hr_suppressing.push(parkInfo);

    if (pfAvg > 1.05) result.park_groups.avg_inflating.push(parkInfo);
    else if (pfAvg < 0.95) result.park_groups.avg_suppressing.push(parkInfo);

    if (pfHr >= 0.95 && pfHr <= 1.05 && pfAvg >= 0.95 && pfAvg <= 1.05) {
      result.park_groups.neutral.push(parkInfo);
    }
  }

  result.extreme_parks.sort(
    (a, b) => Math.abs((b["PF HR"] ?? 1) - 1) - Math.abs((a["PF HR"] ?? 1) - 1),
  );
  return result;
}

export function analyzeTalentDistribution(teams) {
  if (!teams?.length) return {};
  const result = {
    top_teams: [],
    bottom_teams: [],
    division_talent: {},
    super_teams: [],
    all_teams: [],
  };

  const teamTalent = teams.map((team) => ({
    team: team.abbr || "",
    team_name: team.name || "",
    division: team.div || "",
    batting_war: team.batting_war || 0,
    pitching_war: team.pitching_war || 0,
    total_war: team.total_war || 0,
  }));
  teamTalent.sort((a, b) => b.total_war - a.total_war);
  result.all_teams = teamTalent;
  result.top_teams = teamTalent.slice(0, 5);
  result.bottom_teams = teamTalent.slice(-5);

  if (teamTalent.length >= 10) {
    const bat90 = p90(teamTalent.map((t) => t.batting_war));
    const pit90 = p90(teamTalent.map((t) => t.pitching_war));
    for (const team of teamTalent) {
      if (team.batting_war >= bat90 && team.pitching_war >= pit90) {
        result.super_teams.push(team);
      }
    }
  }

  const divisions = {};
  for (const team of teamTalent) {
    const div = team.division || "Unknown";
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(team);
  }
  for (const [divName, divTeams] of Object.entries(divisions)) {
    if (!divTeams.length) continue;
    const sorted = [...divTeams].sort((a, b) => b.total_war - a.total_war);
    const totalWars = sorted.map((t) => t.total_war);
    result.division_talent[divName] = {
      teams: sorted.length,
      avg_war: Math.round(mean(totalWars) * 10) / 10,
      total_war: Math.round(totalWars.reduce((a, b) => a + b, 0) * 10) / 10,
      top_team: sorted[0].team,
      top_team_name: sorted[0].team_name,
      top_team_war: Math.round(sorted[0].total_war * 10) / 10,
    };
  }

  if (teamTalent.length) {
    const wars = teamTalent.map((t) => t.total_war);
    const m = mean(wars);
    if (m > 0) {
      const cv = stdev(wars) / m;
      if (cv > 0.25) result.war_concentration = "high";
      else if (cv > 0.15) result.war_concentration = "medium";
      else result.war_concentration = "low";
    }
  }

  return result;
}

export function analyzeYearOverYearTrends(teams) {
  if (!teams?.length) return {};
  const result = {
    biggest_improvers: [],
    biggest_decliners: [],
    all_changes: [],
    division_power_shifts: {},
  };

  /** Full-season length from last year’s W+L (median across clubs with data). */
  const lyGameTotals = [];
  for (const team of teams) {
    const lyW = parseNumber(team.ly_w ?? 0);
    const lyL = parseNumber(team.ly_l ?? 0);
    if (lyW > 0 || lyL > 0) {
      const g = lyW + lyL;
      if (g > 0) lyGameTotals.push(g);
    }
  }
  const seasonGames =
    lyGameTotals.length > 0 ? Math.round(median(lyGameTotals)) : 0;
  result.season_games = seasonGames || null;

  const teamChanges = [];
  let totalChange = 0;
  let teamsWithLy = 0;

  for (const team of teams) {
    const currPct = winPct(team);
    const lyPct = parseNumber(team.ly_pct ?? 0);
    const currWins = parseNumber(team.w ?? 0);
    const currLosses = parseNumber(team.l ?? 0);
    const lyWins = parseNumber(team.ly_w ?? 0);
    const lyLosses = parseNumber(team.ly_l ?? 0);
    const currGames = currWins + currLosses;
    const teamLyGames = lyWins + lyLosses;
    const fullSeason = seasonGames || teamLyGames;

    if (currPct > 0 && lyPct > 0 && currGames > 0 && fullSeason > 0) {
      const change = currPct - lyPct;
      // Pace current W% over a full season (from last year’s schedule length).
      const projectedWins = currPct * fullSeason;
      const winsChange = Math.round(projectedWins - lyWins);
      teamChanges.push({
        team: team.abbr || "",
        team_name: team.name || "",
        division: team.div || "",
        current_pct: currPct,
        ly_pct: lyPct,
        pct_change: Math.round(change * 1000) / 1000,
        wins_change: winsChange,
        projected_wins: Math.round(projectedWins * 10) / 10,
        games_played: currGames,
        season_games: fullSeason,
      });
      totalChange += change;
      teamsWithLy += 1;
    }
  }

  teamChanges.sort((a, b) => b.pct_change - a.pct_change);
  result.all_changes = teamChanges;
  result.biggest_improvers = teamChanges.slice(0, 5);
  result.biggest_decliners = teamChanges.slice(-5);

  if (teamsWithLy > 0) {
    const avgChange = totalChange / teamsWithLy;
    if (avgChange > 0.01) result.league_trend = "improving";
    else if (avgChange < -0.01) result.league_trend = "declining";
    else result.league_trend = "stable";
    result.avg_win_pct_change = Math.round(avgChange * 1000) / 1000;
  }

  const divisions = {};
  for (const ch of teamChanges) {
    const div = ch.division || "Unknown";
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(ch);
  }
  for (const [divName, divTeams] of Object.entries(divisions)) {
    if (!divTeams.length) continue;
    const improver = divTeams.reduce((a, b) => (b.pct_change > a.pct_change ? b : a));
    const decliner = divTeams.reduce((a, b) => (b.pct_change < a.pct_change ? b : a));
    result.division_power_shifts[divName] = {
      biggest_improver: { team: improver.team, change: improver.pct_change },
      biggest_decliner: { team: decliner.team, change: decliner.pct_change },
    };
  }

  return result;
}

export function generateLeagueReport(enrichedTeams) {
  if (!enrichedTeams?.length) {
    return {
      error: "No team data available",
      summary_insights: [
        "No Team List loaded. Upload Team List.html on the Upload page.",
      ],
    };
  }

  const report = {
    environment: calculateLeagueEnvironment(enrichedTeams),
    parity: calculateParityIndex(enrichedTeams),
    park_factors: analyzeParkFactors(enrichedTeams),
    talent_distribution: analyzeTalentDistribution(enrichedTeams),
    year_over_year: analyzeYearOverYearTrends(enrichedTeams),
    summary_insights: [],
  };

  const insights = [];
  const env = report.environment;
  if (env.environment_type) {
    insights.push(`League environment: ${env.environment_type.replace(/_/g, " ")}`);
  }

  const park = report.park_factors;
  if (park.extreme_parks?.length) {
    const extreme = park.extreme_parks[0];
    insights.push(
      `Most extreme park: ${extreme.park} (${extreme.team}) — PF HR: ${Number(extreme["PF HR"]).toFixed(3)}`,
    );
  }

  const parity = report.parity;
  if (parity.overall_parity) {
    insights.push(`Competitive balance: ${parity.overall_parity} parity`);
  }

  const talent = report.talent_distribution;
  if (talent.top_teams?.length) {
    const top = talent.top_teams[0];
    insights.push(
      `League leader: ${top.team_name || top.team} with ${top.total_war.toFixed(1)} total WAR`,
    );
  }
  if (talent.super_teams?.length) {
    insights.push(
      `${talent.super_teams.length} super team(s) dominating both offense and pitching`,
    );
  }

  const yoy = report.year_over_year;
  if (yoy.biggest_improvers?.length) {
    const improver = yoy.biggest_improvers[0];
    const sign = improver.wins_change >= 0 ? "+" : "";
    insights.push(
      `Biggest improvement: ${improver.team_name || improver.team} (${sign}${improver.wins_change} wins)`,
    );
  }

  report.summary_insights = insights;
  return report;
}
