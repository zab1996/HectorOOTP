import { round2 } from "./util.js";
import { shouldHideNonMajor } from "./league.js";
import { teamPitcherStatScore, teamBatterStatSplit } from "./team_stats.js";
import { parseSalary, getWar } from "./player_analytics.js";

/** Real franchise abbr only — skip blank / dash ORG (FA, undrafted, missing). */
function orgKey(player) {
  const raw = String(player?.ORG ?? "").trim();
  if (!raw || raw === "-" || raw === "—" || raw === "N/A" || /^unknown$/i.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Aggregate team scores by ORG.
 * @param {object[]} pitchers
 * @param {object[]} batters
 * @param {{ majorsOnly?: boolean, useStats?: boolean }} [opts]
 */
export function aggregateTeams(pitchers, batters, opts = {}) {
  const majorsOnly = opts.majorsOnly !== false;
  const useStats = !!opts.useStats;

  const teamScores = {};
  const teamAges = {};
  const teamPayroll = {}; // { salaryM, war }

  function ensure(team) {
    if (!(team in teamScores)) {
      teamScores[team] = useStats
        ? { SP_stats: 0, RP_stats: 0, Batters_Offense: 0, Batters_Defense: 0 }
        : {
            SP_curr: 0,
            RP_curr: 0,
            SP_pot: 0,
            RP_pot: 0,
            Batters_Offense_Curr: 0,
            Batters_Offense_Pot: 0,
            Team_Defense: 0,
          };
      teamAges[team] = [];
      teamPayroll[team] = { salaryM: 0, war: 0 };
    }
  }

  function pushAge(team, age) {
    if (!age) return;
    const n = parseFloat(age);
    if (!Number.isNaN(n)) teamAges[team].push(n);
  }

  function pushPayroll(team, player, playerType) {
    teamPayroll[team].salaryM += parseSalary(player.SLR ?? 0);
    teamPayroll[team].war += getWar(player, playerType);
  }

  for (const p of pitchers) {
    if (shouldHideNonMajor(p, majorsOnly)) continue;
    const team = orgKey(p);
    if (!team) continue;
    ensure(team);
    pushAge(team, p.Age);
    pushPayroll(team, p, "pitcher");
    const pos = p.POS || "";

    if (useStats) {
      const val = teamPitcherStatScore(p);
      if (pos === "SP") teamScores[team].SP_stats += val;
      else if (pos === "RP" || pos === "CL") teamScores[team].RP_stats += val;
    } else {
      const curr = p.Scores?.curr_total ?? 0;
      const pot = (p.Scores?.core_potential ?? 0) + (p.Scores?.pitches_potential ?? 0) + (p.Scores?.pot_penalties ?? 0);
      if (pos === "SP") {
        teamScores[team].SP_curr += curr;
        teamScores[team].SP_pot += pot;
      } else if (pos === "RP" || pos === "CL") {
        teamScores[team].RP_curr += curr;
        teamScores[team].RP_pot += pot;
      }
    }
  }

  for (const b of batters) {
    if (shouldHideNonMajor(b, majorsOnly)) continue;
    const team = orgKey(b);
    if (!team) continue;
    ensure(team);
    pushAge(team, b.Age);
    pushPayroll(team, b, "batter");

    if (useStats) {
      const split = teamBatterStatSplit(b);
      teamScores[team].Batters_Offense += split.offense;
      teamScores[team].Batters_Defense += split.defense;
    } else {
      teamScores[team].Batters_Offense_Curr += b.Scores?.offense ?? 0;
      teamScores[team].Batters_Offense_Pot += b.Scores?.offense_potential ?? 0;
      teamScores[team].Team_Defense += b.Scores?.defense ?? 0;
    }
  }

  function dollarPerWar(team) {
    const pay = teamPayroll[team] || { salaryM: 0, war: 0 };
    if (!(pay.war > 0)) return null;
    return round2(pay.salaryM / pay.war);
  }

  const rows = [];
  for (const [team, scores] of Object.entries(teamScores)) {
    const ages = teamAges[team] || [];
    const avgAge = ages.length ? round2(ages.reduce((a, b) => a + b, 0) / ages.length) : "N/A";
    const dpw = dollarPerWar(team);
    const pay = teamPayroll[team] || { salaryM: 0, war: 0 };

    if (useStats) {
      const spStats = round2(scores.SP_stats);
      const rpStats = round2(scores.RP_stats);
      const pitching = round2(spStats + rpStats);
      const batOff = round2(scores.Batters_Offense);
      const batDef = round2(scores.Batters_Defense);
      rows.push({
        team,
        avg_age: avgAge,
        dollar_per_war: dpw,
        salary_m: round2(pay.salaryM),
        war: round2(pay.war),
        use_stats: true,
        sp_stats: spStats,
        rp_stats: rpStats,
        pitching_stats: pitching,
        bat_off_stats: batOff,
        bat_def_stats: batDef,
        total: round2(pitching + batOff + batDef),
      });
    } else {
      const spCurr = round2(scores.SP_curr);
      const rpCurr = round2(scores.RP_curr);
      const pitchingCurr = round2(spCurr + rpCurr);
      const spPot = round2(scores.SP_pot);
      const rpPot = round2(scores.RP_pot);
      const pitchingPot = round2(spPot + rpPot);
      const batOff = round2(scores.Batters_Offense_Curr);
      const batPot = round2(scores.Batters_Offense_Pot);
      const teamDef = round2(scores.Team_Defense);
      rows.push({
        team,
        avg_age: avgAge,
        dollar_per_war: dpw,
        salary_m: round2(pay.salaryM),
        war: round2(pay.war),
        use_stats: false,
        sp_curr: spCurr,
        rp_curr: rpCurr,
        pitching_curr: pitchingCurr,
        sp_pot: spPot,
        rp_pot: rpPot,
        pitching_pot: pitchingPot,
        bat_off_curr: batOff,
        bat_off_pot: batPot,
        team_def: teamDef,
        total: round2(pitchingCurr + batOff + teamDef),
      });
    }
  }

  rows.sort((a, b) => {
    const at = typeof a.total === "number" ? a.total : 0;
    const bt = typeof b.total === "number" ? b.total : 0;
    return bt - at;
  });
  return rows;
}
