import {
  parseNumber, parseSalary, parseYearsLeft, parseStarRating,
  getAge, getWar, isStarScale, normalizeRating,
} from "./player_analytics.js";

export const ARCHETYPES = {"speed_defense":{"icon":"🏃","name":"Speed & Defense","description":"High speed, elite defense, contact-oriented","color":"#4dabf7","player_types":["batter"]},"mashers":{"icon":"💪","name":"Mashers","description":"High power, high ISO, accept higher K%","color":"#ff6b6b","player_types":["batter"]},"moneyball":{"icon":"👁️","name":"Moneyball (OBP Focus)","description":"High eye, high BB%, value OBP over AVG","color":"#51cf66","player_types":["batter"]},"youth_movement":{"icon":"🌱","name":"Youth Movement","description":"Age ≤25, high potential, cheap contracts","color":"#9775fa","player_types":["batter","pitcher"]},"win_now":{"icon":"🏆","name":"Win Now","description":"High OVR, proven production, prime years","color":"#ffd43b","player_types":["batter","pitcher"]},"budget_build":{"icon":"💰","name":"Budget Build","description":"High WAR/$, cheap contracts, good value","color":"#ff922b","player_types":["batter","pitcher"]},"balanced":{"icon":"⚖️","name":"Balanced","description":"No glaring weaknesses, all ratings ≥45","color":"#ced4da","player_types":["batter","pitcher"]},"chaos_ball":{"icon":"🎲","name":"Chaos Ball","description":"High variance boom-or-bust, high K% + high ISO","color":"#e64980","player_types":["batter"]},"small_ball":{"icon":"⚾","name":"Small Ball","description":"Contact, bunting, manufacturing runs","color":"#74c0fc","player_types":["batter"]},"ace_hunter":{"icon":"🎯","name":"Ace Hunter","description":"Build around elite SP (OVR 70+), budget elsewhere","color":"#da77f2","player_types":["pitcher"]},"bullpen_first":{"icon":"🔥","name":"Bullpen-First","description":"Elite relievers over rotation","color":"#ffa94d","player_types":["pitcher"]},"platoon_army":{"icon":"🔄","name":"Platoon Army","description":"Maximize L/R platoon advantages","color":"#63e6be","player_types":["batter"]},"launch_angle":{"icon":"🚀","name":"Launch Angle Era","description":"Three true outcomes - HR, BB, K","color":"#f06595","player_types":["batter"]},"defense_wins":{"icon":"🛡️","name":"Defense Wins","description":"Elite defense priority, accept weaker bats","color":"#748ffc","player_types":["batter"]},"prospect_pipeline":{"icon":"🌾","name":"Prospect Pipeline","description":"Perpetual rebuild, age ≤24, high potential","color":"#8ce99a","player_types":["batter","pitcher"]},"veteran_presence":{"icon":"👨‍🦳","name":"Veteran Presence","description":"Age 30+, proven track record, high OVR","color":"#ffe066","player_types":["batter","pitcher"]},"innings_eaters":{"icon":"🍽️","name":"Innings Eaters","description":"High stamina, durable pitchers","color":"#a9e34b","player_types":["pitcher"]}};

export const FIT_THRESHOLDS = {
  perfect: { min: 80, max: 100, label: "Perfect Fit", color: "#51cf66" },
  good: { min: 60, max: 79, label: "Good Fit", color: "#4dabf7" },
  partial: { min: 40, max: 59, label: "Partial Fit", color: "#ffd43b" },
  poor: { min: 0, max: 39, label: "Not a Fit", color: "#ff6b6b" },
};

export function getFitLabel(score) {
  for (const [key, threshold] of Object.entries(FIT_THRESHOLDS)) {
    if (threshold.min <= score && score <= threshold.max) {
      return { key, label: threshold.label, color: threshold.color };
    }
  }
  return { key: "poor", label: "Not a Fit", color: "#ff6b6b" };
}

/**
 * Linear interpolate score across knots [[x, y], ...] (x ascending).
 * Below first knot: soft ramp from 0; above last: clamp to last y.
 */
export function smoothScore(value, knots) {
  const v = Number(value);
  if (!Number.isFinite(v) || !knots?.length) return 0;
  const [x0, y0] = knots[0];
  if (v <= x0) {
    const span = knots.length > 1 ? Math.max(Math.abs(knots[1][0] - x0) * 0.5, 1e-9) : 1;
    const xZ = x0 - span;
    if (v <= xZ) return 0;
    return y0 * ((v - xZ) / (x0 - xZ));
  }
  for (let i = 1; i < knots.length; i++) {
    const [xa, ya] = knots[i - 1];
    const [xb, yb] = knots[i];
    if (v <= xb) {
      if (xb === xa) return yb;
      return ya + ((v - xa) / (xb - xa)) * (yb - ya);
    }
  }
  return knots[knots.length - 1][1];
}

function fitTotal(score, max = 100) {
  return Math.min(max, Math.round(score));
}

function hasPos(pos, list) {
  return list.includes(pos);
}

export function calculateSpeedDefenseFit(player) {
  let score = 0;
  const pos = player.POS ?? "";
  score += smoothScore(parseNumber(player.SPE ?? 0), [[50, 10], [60, 20], [70, 25]]);
  score += smoothScore(parseNumber(player.STE ?? 0), [[50, 6], [60, 12], [70, 15]]);

  let defAvg;
  if (pos === "C") {
    defAvg = (parseNumber(player["C ABI"] ?? 0) + parseNumber(player["C ARM"] ?? 0)) / 2;
  } else if (hasPos(pos, ["2B", "SS", "3B", "1B"])) {
    defAvg =
      (parseNumber(player["IF RNG"] ?? 0) +
        parseNumber(player["IF ARM"] ?? 0) +
        parseNumber(player["IF ERR"] ?? 0)) /
      3;
  } else {
    defAvg =
      (parseNumber(player["OF RNG"] ?? 0) +
        parseNumber(player["OF ARM"] ?? 0) +
        parseNumber(player["OF ERR"] ?? 0)) /
      3;
  }
  score += smoothScore(defAvg, [[45, 12], [55, 22], [65, 30]]);

  const con = parseNumber(player.CON ?? 0);
  const pow = parseNumber(player.POW ?? 0);
  if (con > pow) score += smoothScore(con, [[50, 10], [55, 15]]);
  else score += smoothScore(con, [[50, 10]]);

  if (hasPos(pos, ["C", "2B", "SS", "CF"])) score += 15;
  else if (hasPos(pos, ["3B", "LF", "RF"])) score += 5;
  return fitTotal(score);
}

export function calculateMashersFit(player) {
  let score = 0;
  const pos = player.POS ?? "";
  score += smoothScore(parseNumber(player.POW ?? 0), [[50, 15], [60, 28], [70, 35]]);
  score += smoothScore(parseNumber(player.ISO ?? 0), [[0.15, 6], [0.18, 12], [0.2, 16], [0.25, 20]]);
  score += smoothScore(parseNumber(player.SLG ?? 0), [[0.45, 8], [0.5, 12], [0.55, 15]]);
  if (hasPos(pos, ["1B", "3B", "LF", "RF", "DH"])) score += 15;
  else if (hasPos(pos, ["C", "2B"])) score += 8;
  score += smoothScore(parseNumber(player.GAP ?? 0), [[50, 10], [60, 15]]);
  return fitTotal(score);
}

export function calculateMoneyballFit(player) {
  let score = 0;
  score += smoothScore(parseNumber(player.EYE ?? 0), [[50, 8], [55, 15], [60, 20], [70, 25]]);
  score += smoothScore(parseNumber(player["BB% (Batter)"] ?? player["BB%"] ?? 0), [[8, 8], [10, 15], [12, 20], [15, 25]]);
  score += smoothScore(parseNumber(player.OBP ?? 0), [[0.33, 10], [0.35, 15], [0.37, 20], [0.4, 25]]);
  score += smoothScore(parseNumber(player.wOBA ?? 0), [[0.32, 10], [0.34, 15], [0.37, 20], [0.4, 25]]);
  return fitTotal(score);
}

export function calculateYouthMovementFit(player, playerType = "batter") {
  const age = getAge(player);
  if (age > 27) return 0;
  let score = 0;
  score += smoothScore(age, [[20, 30], [22, 30], [24, 25], [25, 20], [26, 10], [27.5, 0]]);

  const pot = parseStarRating(player.POT ?? "0");
  const ovr = parseStarRating(player.OVR ?? "0");
  if (isStarScale(pot)) {
    score += smoothScore(pot, [[3.0, 10], [3.5, 18], [4.0, 24], [4.5, 30]]);
    score += smoothScore(pot - ovr, [[0.5, 12], [1.0, 20], [1.5, 25]]);
  } else {
    score += smoothScore(pot, [[50, 10], [55, 18], [60, 24], [70, 30]]);
    score += smoothScore(pot - ovr, [[5, 12], [10, 20], [15, 25]]);
  }

  const yl = parseYearsLeft(player.YL ?? "");
  const status = yl.status ?? "unknown";
  if (status === "pre_arb") score += 15;
  else if (status === "arbitration") score += 12;
  else if (parseSalary(player.SLR ?? 0) < 3) score += 8;
  return fitTotal(score);
}

export function calculateWinNowFit(player, playerType = "batter") {
  let score = 0;
  const age = getAge(player);
  const primeDist = age < 28 ? 28 - age : age - 28;
  score += smoothScore(primeDist, [[0, 20], [2, 15], [5, 10], [7, 5], [10, 0]]);

  const ovr = parseStarRating(player.OVR ?? "0");
  if (isStarScale(ovr)) {
    score += smoothScore(ovr, [[3.0, 15], [3.5, 25], [4.0, 30], [4.5, 35]]);
  } else {
    score += smoothScore(ovr, [[60, 15], [65, 25], [70, 30], [75, 35]]);
  }

  if (playerType === "batter") {
    score += smoothScore(parseNumber(player["wRC+"] ?? 0), [[100, 6], [110, 12], [120, 20], [140, 25]]);
    score += smoothScore(parseNumber(player["WAR (Batter)"] ?? player.WAR ?? 0), [[2, 6], [3, 12], [4, 16], [5, 20]]);
  } else {
    score += smoothScore(parseNumber(player["ERA+"] ?? 0), [[100, 6], [110, 12], [120, 20], [140, 25]]);
    score += smoothScore(parseNumber(player["WAR (Pitcher)"] ?? player.WAR ?? 0), [[1, 6], [2, 12], [3, 16], [4, 20]]);
  }
  return fitTotal(score);
}

export function calculateBudgetBuildFit(player, playerType = "batter") {
  let score = 0;
  const war = getWar(player, playerType);
  const salary = parseSalary(player.SLR ?? 0);
  if (salary > 0) {
    score += smoothScore(war / salary, [[0.5, 12], [1.0, 24], [1.5, 32], [2.0, 40]]);
  } else if (war >= 1.0) {
    score += 40;
  }

  const yl = parseYearsLeft(player.YL ?? "");
  const status = yl.status ?? "unknown";
  if (status === "pre_arb") score += 25;
  else if (status === "arbitration") score += 20;
  else score += smoothScore(yl.years ?? 99, [[1, 15], [2, 10], [3, 0]]);

  score += smoothScore(salary, [[0, 20], [1, 20], [3, 16], [5, 12], [8, 6], [12, 0]]);
  score += smoothScore(war, [[1.0, 5], [1.5, 9], [2, 12], [3, 15]]);
  return fitTotal(score);
}

export function calculateBalancedFit(player, playerType = "batter") {
  let score = 0;
  const ratings =
    playerType === "batter"
      ? {
          CON: parseNumber(player.CON ?? 0),
          GAP: parseNumber(player.GAP ?? 0),
          POW: parseNumber(player.POW ?? 0),
          EYE: parseNumber(player.EYE ?? 0),
          SPE: parseNumber(player.SPE ?? 0),
        }
      : {
          STU: parseNumber(player.STU ?? 0),
          MOV: parseNumber(player.MOV ?? 0),
          CON: parseNumber(player.CON ?? 0),
        };
  const vals = Object.values(ratings);
  const minR = Math.min(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const above50 = vals.filter((v) => v >= 50).length;
  const above55 = vals.filter((v) => v >= 55).length;

  if (playerType === "batter") {
    score += smoothScore(minR, [[40, 15], [45, 30], [50, 40]]);
    score += smoothScore(above55, [[2, 12], [3, 20], [4, 40]]);
    if (above55 < 4) score += smoothScore(above50, [[3, 20], [4, 32]]) * (above55 < 3 ? 1 : 0.25);
    score += smoothScore(avg, [[45, 10], [50, 15], [55, 20]]);
  } else {
    score += smoothScore(minR, [[40, 20], [45, 35], [50, 45]]);
    score += smoothScore(above55, [[2, 20], [3, 40]]);
    if (above55 < 3) score += smoothScore(above50, [[2, 20], [3, 32]]);
    score += smoothScore(avg, [[45, 5], [50, 10], [55, 15]]);
  }
  return fitTotal(score);
}

export function calculateChaosBallFit(player) {
  let score = 0;
  score += smoothScore(parseNumber(player.POW ?? 0), [[50, 15], [60, 25], [70, 30]]);
  score += smoothScore(parseNumber(player.ISO ?? 0), [[0.15, 8], [0.18, 15], [0.2, 20], [0.25, 25]]);
  score += smoothScore(parseNumber(player["K%"] ?? 0), [[20, 10], [25, 15], [30, 20]]);
  score += smoothScore(parseNumber(player.CON ?? 0), [[30, 15], [40, 15], [50, 10], [55, 5], [60, 0]]);
  score += smoothScore(parseNumber(player.HR ?? 0), [[15, 3], [25, 7], [35, 10]]);
  return fitTotal(score);
}

export function calculateSmallBallFit(player) {
  let score = 0;
  score += smoothScore(parseNumber(player.CON ?? 0), [[50, 10], [55, 18], [60, 25], [70, 30]]);
  score += smoothScore(parseNumber(player.SPE ?? 0), [[45, 8], [55, 15], [65, 20]]);
  score += smoothScore(parseNumber(player.STE ?? 0), [[45, 8], [55, 15], [65, 20]]);
  score += smoothScore(parseNumber(player["K%"] ?? 0), [[10, 15], [15, 12], [20, 8], [25, 4], [30, 0]]);
  const bun = parseNumber(player.BUN ?? 0);
  if (bun > 0) score += smoothScore(bun, [[40, 8], [50, 12], [60, 15]]);
  else if (parseNumber(player.CON ?? 0) >= 55 && parseNumber(player.SPE ?? 0) >= 50) score += 6;
  return fitTotal(score);
}

export function calculateAceHunterFit(player, playerType = "pitcher") {
  if (playerType !== "pitcher") return 0;
  if ((player.POS ?? "") !== "SP") return 0;
  let score = 0;
  const ovr = parseStarRating(player.OVR ?? "0");
  if (isStarScale(ovr)) {
    if (ovr < 3.3) return 0;
    score += smoothScore(ovr, [[3.5, 25], [4.0, 40], [4.5, 50]]);
  } else {
    if (ovr < 63) return 0;
    score += smoothScore(ovr, [[65, 25], [70, 40], [75, 50]]);
  }
  score += smoothScore(parseNumber(player.STU ?? 0), [[60, 15], [65, 20], [70, 25]]);
  score += smoothScore(parseNumber(player.MOV ?? 0), [[55, 8], [60, 12], [65, 15]]);
  score += smoothScore(parseNumber(player.CON ?? 0), [[55, 5], [60, 8], [65, 10]]);
  return fitTotal(score);
}

export function calculateBullpenFirstFit(player, playerType = "pitcher") {
  if (playerType !== "pitcher") return 0;
  const pos = player.POS ?? "";
  if (!hasPos(pos, ["RP", "CL"])) return 0;
  let score = 0;
  const ovr = parseStarRating(player.OVR ?? "0");
  if (isStarScale(ovr)) {
    score += smoothScore(ovr, [[2.5, 12], [3.0, 20], [3.5, 28], [4.0, 35]]);
  } else {
    score += smoothScore(ovr, [[55, 12], [60, 20], [65, 28], [70, 35]]);
  }
  score += smoothScore(parseNumber(player.STU ?? 0), [[55, 10], [60, 18], [65, 25], [70, 30]]);
  score += smoothScore(parseNumber(player.MOV ?? 0), [[55, 10], [60, 16], [65, 20]]);
  score += pos === "CL" ? 15 : 5;
  return fitTotal(score);
}

export function calculatePlatoonArmyFit(player) {
  const bats = String(player.B ?? "").toUpperCase();
  if (bats === "S") return 0;
  let score = 0;
  const ovr = parseStarRating(player.OVR ?? "0");
  if (isStarScale(ovr)) {
    score += smoothScore(Math.abs(ovr - 3.0), [[0, 25], [0.5, 25], [1.0, 15], [1.5, 5], [2.5, 0]]);
  } else {
    score += smoothScore(Math.abs(ovr - 52.5), [[0, 25], [7.5, 25], [12.5, 15], [20, 5], [30, 0]]);
  }
  const best = Math.max(
    parseNumber(player.CON ?? 0),
    parseNumber(player.POW ?? 0),
    parseNumber(player.EYE ?? 0),
  );
  score += smoothScore(best, [[50, 12], [55, 20], [60, 25]]);
  const vL = parseNumber(player.vL ?? 0);
  const vR = parseNumber(player.vR ?? 0);
  if (vL > 0 && vR > 0) score += smoothScore(Math.abs(vL - vR), [[5, 12], [10, 22], [15, 30]]);
  else if (bats === "L") score += 15;
  else score += 10;
  score += smoothScore(parseSalary(player.SLR ?? 0), [[0, 20], [2, 20], [5, 15], [10, 8], [15, 0]]);
  return fitTotal(score);
}

export function calculateLaunchAngleFit(player) {
  let score = 0;
  score += smoothScore(parseNumber(player.POW ?? 0), [[50, 10], [55, 18], [60, 28], [70, 35]]);
  score += smoothScore(parseNumber(player.EYE ?? 0), [[45, 8], [50, 16], [55, 24], [65, 30]]);
  score += smoothScore(parseNumber(player.HR ?? 0), [[15, 5], [20, 10], [30, 16], [40, 20]]);
  score += smoothScore(parseNumber(player["BB% (Batter)"] ?? player["BB%"] ?? 0), [[8, 4], [10, 8], [12, 12], [15, 15]]);
  return fitTotal(score);
}

export function calculateDefenseWinsFit(player) {
  let score = 0;
  const pos = player.POS ?? "";
  let defAvg;
  if (pos === "C") {
    const abi = parseNumber(player["C ABI"] ?? 0);
    const arm = parseNumber(player["C ARM"] ?? 0);
    const frm = parseNumber(player["C FRM"] ?? 0);
    defAvg = frm > 0 ? (abi + arm + frm) / 3 : (abi + arm) / 2;
  } else if (hasPos(pos, ["2B", "SS", "3B", "1B"])) {
    defAvg =
      (parseNumber(player["IF RNG"] ?? 0) +
        parseNumber(player["IF ARM"] ?? 0) +
        parseNumber(player["IF ERR"] ?? 0)) /
      3;
  } else {
    defAvg =
      (parseNumber(player["OF RNG"] ?? 0) +
        parseNumber(player["OF ARM"] ?? 0) +
        parseNumber(player["OF ERR"] ?? 0)) /
      3;
  }
  score += smoothScore(defAvg, [[50, 12], [55, 22], [60, 32], [65, 42], [70, 50]]);
  if (hasPos(pos, ["C", "2B", "SS", "CF"])) score += 25;
  else if (hasPos(pos, ["3B", "LF", "RF"])) score += 10;
  score += smoothScore(parseNumber(player.SPE ?? 0), [[40, 5], [50, 10], [60, 15]]);
  const avgBat = (parseNumber(player.CON ?? 0) + parseNumber(player.POW ?? 0)) / 2;
  const salary = parseSalary(player.SLR ?? 0);
  if (avgBat < 45 && defAvg >= 60) {
    score += smoothScore(salary, [[0, 10], [3, 10], [5, 6], [8, 0]]);
  }
  return fitTotal(score);
}

export function calculateProspectPipelineFit(player, playerType = "batter") {
  const age = getAge(player);
  if (age > 26) return 0;
  let score = 0;
  score += smoothScore(age, [[19, 35], [21, 35], [22, 30], [23, 24], [24, 18], [25, 8], [26.5, 0]]);

  const pot = parseStarRating(player.POT ?? "0");
  const ovr = parseStarRating(player.OVR ?? "0");
  if (isStarScale(pot)) {
    score += smoothScore(pot, [[3.0, 12], [3.5, 20], [4.0, 28], [4.5, 35]]);
    score += smoothScore(pot - ovr, [[0.5, 5], [1.0, 10], [1.5, 16], [2.0, 20]]);
  } else {
    score += smoothScore(pot, [[55, 12], [60, 20], [65, 28], [70, 35]]);
    score += smoothScore(pot - ovr, [[5, 5], [10, 10], [15, 16], [20, 20]]);
  }

  const yl = parseYearsLeft(player.YL ?? "");
  const status = yl.status ?? "unknown";
  if (status === "pre_arb") score += 10;
  else if (status === "arbitration") score += 6;
  else if (parseSalary(player.SLR ?? 0) < 2) score += 4;
  return fitTotal(score);
}

export function calculateVeteranPresenceFit(player, playerType = "batter") {
  const age = getAge(player);
  if (age < 27) return 0;
  let score = 0;
  score += smoothScore(age, [[28, 10], [30, 18], [32, 22], [34, 25]]);

  const ovr = parseStarRating(player.OVR ?? "0");
  if (isStarScale(ovr)) {
    score += smoothScore(ovr, [[2.5, 12], [3.0, 22], [3.5, 32], [4.0, 40]]);
  } else {
    score += smoothScore(ovr, [[55, 12], [60, 22], [65, 32], [70, 40]]);
  }

  if (playerType === "batter") {
    score += smoothScore(parseNumber(player["WAR (Batter)"] ?? player.WAR ?? 0), [[1, 5], [2, 10], [3, 15]]);
    score += smoothScore(parseNumber(player["wRC+"] ?? 0), [[100, 6], [120, 10]]);
  } else {
    score += smoothScore(parseNumber(player["WAR (Pitcher)"] ?? player.WAR ?? 0), [[1, 5], [2, 10], [3, 15]]);
    score += smoothScore(parseNumber(player["ERA+"] ?? 0), [[100, 6], [120, 10]]);
  }
  score += smoothScore(age, [[30, 4], [32, 7], [35, 10]]);
  return fitTotal(score);
}

export function calculateInningsEatersFit(player, playerType = "pitcher") {
  if (playerType !== "pitcher") return 0;
  if ((player.POS ?? "") !== "SP") return 0;
  let score = 0;
  score += smoothScore(parseNumber(player.STM ?? 0), [[50, 10], [55, 18], [60, 28], [65, 35], [70, 40]]);

  const prone = player.Prone ?? "";
  if (prone === "Durable" || prone === "") score += 25;
  else if (prone === "Normal") score += 18;
  else if (prone === "Fragile") score += 5;
  else if (prone === "Wrecked") score += 0;
  else score += 15;

  score += smoothScore(parseNumber(player.IP ?? 0), [[100, 4], [140, 8], [160, 12], [180, 16], [200, 20]]);

  const ovr = parseStarRating(player.OVR ?? "0");
  if (isStarScale(ovr)) {
    score += smoothScore(ovr, [[2.0, 5], [2.5, 10], [3.0, 15]]);
  } else {
    score += smoothScore(ovr, [[45, 5], [50, 10], [55, 15]]);
  }
  return fitTotal(score);
}

export function calculateArchetypeFit(player, archetype, playerType = "batter") {
  const archetypeFuncs = {
    speed_defense: (p) => (playerType === "batter" ? calculateSpeedDefenseFit(p) : 0),
    mashers: (p) => (playerType === "batter" ? calculateMashersFit(p) : 0),
    moneyball: (p) => (playerType === "batter" ? calculateMoneyballFit(p) : 0),
    youth_movement: (p) => calculateYouthMovementFit(p, playerType),
    win_now: (p) => calculateWinNowFit(p, playerType),
    budget_build: (p) => calculateBudgetBuildFit(p, playerType),
    balanced: (p) => calculateBalancedFit(p, playerType),
    chaos_ball: (p) => (playerType === "batter" ? calculateChaosBallFit(p) : 0),
    small_ball: (p) => (playerType === "batter" ? calculateSmallBallFit(p) : 0),
    ace_hunter: (p) => calculateAceHunterFit(p, playerType),
    bullpen_first: (p) => calculateBullpenFirstFit(p, playerType),
    platoon_army: (p) => (playerType === "batter" ? calculatePlatoonArmyFit(p) : 0),
    launch_angle: (p) => (playerType === "batter" ? calculateLaunchAngleFit(p) : 0),
    defense_wins: (p) => (playerType === "batter" ? calculateDefenseWinsFit(p) : 0),
    prospect_pipeline: (p) => calculateProspectPipelineFit(p, playerType),
    veteran_presence: (p) => calculateVeteranPresenceFit(p, playerType),
    innings_eaters: (p) => calculateInningsEatersFit(p, playerType),
  };
  const func = archetypeFuncs[archetype];
  return func ? func(player) : 0;
}

export function findPlayersByArchetype(players, archetype, playerType = "batter", minFit = 40) {
  const results = [];
  const archetypeInfo = ARCHETYPES[archetype] ?? {};
  const supportedTypes = archetypeInfo.player_types ?? [];
  if (!supportedTypes.includes(playerType)) return results;

  for (const player of players) {
    const fitScore = calculateArchetypeFit(player, archetype, playerType);
    if (fitScore >= minFit) {
      results.push({
        player,
        fit_score: fitScore,
        fit_label: getFitLabel(fitScore),
        name: player.Name ?? "",
        team: player.ORG ?? "",
        pos: player.POS ?? "",
        age: getAge(player),
        ovr: parseStarRating(player.OVR ?? "0"),
        pot: parseStarRating(player.POT ?? "0"),
      });
    }
  }
  results.sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
  return results;
}

export function getPlayerArchetypeFits(player, playerType = "batter") {
  const results = {};
  for (const [archetype, info] of Object.entries(ARCHETYPES)) {
    if ((info.player_types ?? []).includes(playerType)) {
      const fitScore = calculateArchetypeFit(player, archetype, playerType);
      results[archetype] = {
        score: fitScore,
        label: getFitLabel(fitScore),
        archetype_name: info.name,
        archetype_icon: info.icon,
        description: info.description ?? "",
        player_types: info.player_types ?? [],
      };
    }
  }
  return results;
}

/** Hover tip text matching the Archetypes page select. */
export function archetypeTipText(info) {
  if (!info) return "";
  const types = (info.player_types || [])
    .map((t) => (t === "batter" ? "batters" : "pitchers"))
    .join(" & ");
  const desc = info.description || "";
  return types ? `${desc}\nApplies to: ${types}` : desc;
}

export function getBestArchetype(player, playerType = "batter") {
  const fits = getPlayerArchetypeFits(player, playerType);
  const entries = Object.entries(fits);
  if (!entries.length) return null;
  entries.sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0));
  const [archetype, best] = entries[0];
  return {
    archetype,
    score: best.score,
    name: best.archetype_name,
    icon: best.archetype_icon,
    label: best.label,
  };
}
