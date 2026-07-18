import { round4 } from "./util.js";
import { parseYearsLeft } from "./player_analytics.js";

export const POSITION_GROUPS = {
  OF: ["LF", "CF", "RF"],
  IF: ["1B", "2B", "3B", "SS"],
  C: ["C"],
  SP: ["SP"],
  RP: ["RP", "CL"],
};

const BATTER_G_FLOOR = 40;
const PITCHER_IP_FLOOR = 30;
const SIM_CUTOFF = 0.2;
const SIM_TOP_CAP = 12;
const SIM_FALLBACK_MIN = 5;
const SIM_FALLBACK_N = 8;
const PRICING_TOP_CAP = 12;
const MIN_ELIGIBLE_SALARY = 3;
const MIN_DOLLAR_WAR_RATES = 4;
const MIN_WAR_FOR_RATE = 0.5;

const POSITION_PREMIUMS = {
  C: 1.12,
  SS: 1.12,
  CF: 1.1,
};

export function parseCurrency(value) {
  if (!value || value === "-" || value === "") return 0.0;
  try {
    const cleaned = String(value).replace(/\$/g, "").replace(/,/g, "").trim();
    // Match Python float(): reject if leftover non-numeric junk after number
    if (!/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleaned)) return 0.0;
    return parseFloat(cleaned);
  } catch {
    return 0.0;
  }
}

export function parseNumber(value) {
  if (!value || value === "-" || value === "") return 0.0;
  try {
    const cleaned = String(value).replace(/,/g, "").trim();
    // Python float("1 (auto.)") raises — treat as 0
    if (!/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleaned)) return 0.0;
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? 0.0 : n;
  } catch {
    return 0.0;
  }
}

function parseAge(value, fallback = 0) {
  try {
    const n = parseInt(value ?? fallback, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function getPositionGroup(pos) {
  pos = pos.toUpperCase();
  for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
    if (positions.includes(pos)) return { group, positions };
  }
  return { group: null, positions: [] };
}

/** @returns {"pre_arb"|"arbitration"|"signed"|"unknown"} */
export function contractStatus(player) {
  return parseYearsLeft(player?.YL ?? "").status;
}

export function isSignedMarketDeal(player) {
  return contractStatus(player) === "signed";
}

export function contractStatusLabel(status) {
  if (status === "pre_arb") return "Pre-arb";
  if (status === "arbitration") return "Arb";
  if (status === "signed") return "Signed";
  return "—";
}

/** Scarcity pool key for $/WAR (SP, RP, C, SS, CF, IF, OF, DH). */
export function scarcityGroup(pos) {
  const p = String(pos || "").toUpperCase();
  if (p === "SP") return "SP";
  if (p === "RP" || p === "CL") return "RP";
  if (p === "C") return "C";
  if (p === "SS") return "SS";
  if (p === "CF") return "CF";
  if (p === "1B" || p === "2B" || p === "3B") return "IF";
  if (p === "LF" || p === "RF") return "OF";
  if (p === "DH") return "DH";
  return p || "OTHER";
}

export function positionPremium(pos) {
  const p = String(pos || "").toUpperCase();
  return POSITION_PREMIUMS[p] ?? 1.0;
}

function playerWar(player, playerType) {
  if (playerType === "batter") {
    return parseNumber(player["WAR (Batter)"] ?? player.WAR ?? 0);
  }
  return parseNumber(player["WAR (Pitcher)"] ?? player.WAR ?? 0);
}

function percentileSorted(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function medianOf(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function filterSalaryOutliers(salaries) {
  if (salaries.length < 4) return salaries.filter((s) => s > 0);
  const sorted = [...salaries].filter((s) => s > 0).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const q1 = percentileSorted(sorted, 0.25);
  const q3 = percentileSorted(sorted, 0.75);
  const lo = q1 * 0.5;
  const hi = q3 * 2;
  const filtered = sorted.filter((s) => s >= lo && s <= hi);
  return filtered.length ? filtered : sorted;
}

export function findComparablePlayers(playerDict, playerType, pool, filters = {}) {
  const {
    posFilter = "Auto (same group)",
    minAge = 18,
    maxAge = 45,
    opsPercent = 10.0,
    wrcPercent = 10.0,
    warBatterRange = 1.0,
    eraPercent = 10.0,
    warPitcherRange = 1.0,
    rwarRange = 1.0,
    fipPercent = 10.0,
  } = filters;

  const pos = String(playerDict.POS || "").toUpperCase();
  let allowed;
  if (posFilter === "Auto (same group)") {
    const { group, positions } = getPositionGroup(pos);
    allowed = group ? new Set(positions) : new Set([pos]);
  } else if (posFilter === "Auto (same position)") {
    allowed = new Set([pos]);
  } else if (posFilter === "All Batters") {
    allowed = new Set(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]);
  } else if (posFilter.startsWith("All ")) {
    const group = posFilter.slice(4);
    allowed = new Set(POSITION_GROUPS[group] || [pos]);
  } else {
    allowed = new Set([posFilter]);
  }

  let selectedOps; let selectedWrc; let selectedWar;
  let opsMin; let opsMax; let wrcMin; let wrcMax; let warMin; let warMax;
  let selectedEra; let selectedRwar; let selectedFip;
  let eraMin; let eraMax; let rwarMin; let rwarMax; let fipMin; let fipMax;
  let minG = BATTER_G_FLOOR;
  let minIp = PITCHER_IP_FLOOR;

  if (playerType === "batter") {
    selectedOps = parseNumber(playerDict["OPS+"] ?? 0);
    selectedWrc = parseNumber(playerDict["wRC+"] ?? 0);
    selectedWar = parseNumber(playerDict["WAR (Batter)"] ?? playerDict.WAR ?? 0);
    opsMin = selectedOps > 0 ? selectedOps * (1 - opsPercent / 100) : 0;
    opsMax = selectedOps > 0 ? selectedOps * (1 + opsPercent / 100) : Infinity;
    wrcMin = selectedWrc > 0 ? selectedWrc * (1 - wrcPercent / 100) : 0;
    wrcMax = selectedWrc > 0 ? selectedWrc * (1 + wrcPercent / 100) : Infinity;
    warMin = selectedWar - warBatterRange;
    warMax = selectedWar + warBatterRange;
    const selectedG = parseNumber(playerDict.G ?? 0);
    if (selectedG > 0) minG = Math.min(BATTER_G_FLOOR, selectedG);
  } else {
    selectedEra = parseNumber(playerDict["ERA+"] ?? 0);
    selectedWar = parseNumber(playerDict["WAR (Pitcher)"] ?? playerDict.WAR ?? 0);
    selectedRwar = parseNumber(playerDict.rWAR ?? 0);
    selectedFip = parseNumber(playerDict["FIP-"] ?? 0);
    eraMin = selectedEra > 0 ? selectedEra * (1 - eraPercent / 100) : 0;
    eraMax = selectedEra > 0 ? selectedEra * (1 + eraPercent / 100) : Infinity;
    // FIP- is lower-is-better; ±% still selects similar values around the target.
    fipMin = selectedFip > 0 ? selectedFip * (1 - fipPercent / 100) : 0;
    fipMax = selectedFip > 0 ? selectedFip * (1 + fipPercent / 100) : Infinity;
    warMin = selectedWar - warPitcherRange;
    warMax = selectedWar + warPitcherRange;
    rwarMin = selectedRwar - rwarRange;
    rwarMax = selectedRwar + rwarRange;
    const selectedIp = parseNumber(playerDict.IP ?? 0);
    if (selectedIp > 0) minIp = Math.min(PITCHER_IP_FLOOR, selectedIp);
  }

  const comparables = [];
  for (const p of pool) {
    const pPos = String(p.POS || "").toUpperCase();
    if (!allowed.has(pPos)) continue;
    let pAge;
    try {
      pAge = parseInt(p.Age ?? 0, 10);
      if (!(minAge <= pAge && pAge <= maxAge)) continue;
    } catch {
      continue;
    }
    if (p.Name === playerDict.Name) continue;

    if (playerType === "batter") {
      const pG = parseNumber(p.G ?? 0);
      if (pG < minG) continue;
      const pOps = parseNumber(p["OPS+"] ?? 0);
      const pWrc = parseNumber(p["wRC+"] ?? 0);
      const pWar = parseNumber(p["WAR (Batter)"] ?? p.WAR ?? 0);
      if (selectedOps > 0 && (pOps <= 0 || !(opsMin <= pOps && pOps <= opsMax))) continue;
      if (selectedWrc > 0 && (pWrc <= 0 || !(wrcMin <= pWrc && pWrc <= wrcMax))) continue;
      if (selectedWar !== 0 && !(warMin <= pWar && pWar <= warMax)) continue;
    } else {
      const pIp = parseNumber(p.IP ?? 0);
      if (pIp < minIp) continue;
      const pEra = parseNumber(p["ERA+"] ?? 0);
      const pFip = parseNumber(p["FIP-"] ?? 0);
      const pWar = parseNumber(p["WAR (Pitcher)"] ?? p.WAR ?? 0);
      const pRwar = parseNumber(p.rWAR ?? 0);
      if (selectedEra > 0 && (pEra <= 0 || !(eraMin <= pEra && pEra <= eraMax))) continue;
      if (selectedFip > 0 && (pFip <= 0 || !(fipMin <= pFip && pFip <= fipMax))) continue;
      if (selectedWar !== 0 && !(warMin <= pWar && pWar <= warMax)) continue;
      if (selectedRwar !== 0 && !(rwarMin <= pRwar && pRwar <= rwarMax)) continue;
    }
    comparables.push(p);
  }
  return comparables;
}

export function calculateSimilarityScore(player, selectedPlayerDict, playerType) {
  let score = 0.0;
  const selectedAge = parseAge(selectedPlayerDict.Age, 25);
  const playerAge = parseAge(player.Age, selectedAge);
  const ageTerm = Math.min(1, Math.abs(selectedAge - playerAge) / 10) * 0.15;

  if (playerType === "batter") {
    const selectedOps = parseNumber(selectedPlayerDict["OPS+"] ?? 0);
    const selectedWrc = parseNumber(selectedPlayerDict["wRC+"] ?? 0);
    const selectedWar = parseNumber(selectedPlayerDict["WAR (Batter)"] ?? selectedPlayerDict.WAR ?? 0);
    const playerOps = parseNumber(player["OPS+"] ?? 0);
    const playerWrc = parseNumber(player["wRC+"] ?? 0);
    const playerWar = parseNumber(player["WAR (Batter)"] ?? player.WAR ?? 0);
    if (selectedOps > 1 && playerOps > 1) {
      score += (Math.abs(selectedOps - playerOps) / selectedOps) * 0.35;
    }
    if (selectedWrc > 1 && playerWrc > 1) {
      score += (Math.abs(selectedWrc - playerWrc) / selectedWrc) * 0.35;
    }
    if (selectedWar !== 0 && playerWar !== 0) {
      score += (Math.abs(selectedWar - playerWar) / Math.max(Math.abs(selectedWar), 1)) * 0.15;
    }
  } else {
    const selectedEra = parseNumber(selectedPlayerDict["ERA+"] ?? 0);
    const selectedFip = parseNumber(selectedPlayerDict["FIP-"] ?? 0);
    const selectedWar = parseNumber(selectedPlayerDict["WAR (Pitcher)"] ?? selectedPlayerDict.WAR ?? 0);
    const selectedRwar = parseNumber(selectedPlayerDict.rWAR ?? 0);
    const playerEra = parseNumber(player["ERA+"] ?? 0);
    const playerFip = parseNumber(player["FIP-"] ?? 0);
    const playerWar = parseNumber(player["WAR (Pitcher)"] ?? player.WAR ?? 0);
    const playerRwar = parseNumber(player.rWAR ?? 0);
    // Relative gaps — same for higher-is-better (ERA+) and lower-is-better (FIP-).
    if (selectedEra > 1 && playerEra > 1) {
      score += (Math.abs(selectedEra - playerEra) / selectedEra) * 0.25;
    }
    if (selectedFip > 1 && playerFip > 1) {
      score += (Math.abs(selectedFip - playerFip) / selectedFip) * 0.2;
    }
    if (selectedWar !== 0 && playerWar !== 0) {
      score += (Math.abs(selectedWar - playerWar) / Math.max(Math.abs(selectedWar), 1)) * 0.2;
    }
    if (selectedRwar !== 0 && playerRwar !== 0) {
      score += (Math.abs(selectedRwar - playerRwar) / Math.max(Math.abs(selectedRwar), 1)) * 0.2;
    }
  }
  score += ageTerm;
  return score;
}

function pickSuggestionComps(scored) {
  const close = scored.filter(([sim]) => sim <= SIM_CUTOFF).slice(0, SIM_TOP_CAP);
  if (close.length >= SIM_FALLBACK_MIN) return close;
  return scored.slice(0, SIM_FALLBACK_N);
}

function isPricingEligible(player, includePreFa) {
  if (includePreFa) return true;
  return isSignedMarketDeal(player);
}

function pickPricingComps(scored, includePreFa) {
  const out = [];
  for (const [, c] of scored) {
    if (!isPricingEligible(c, includePreFa)) continue;
    out.push(c);
    if (out.length >= PRICING_TOP_CAP) break;
  }
  return out;
}

function dollarWarRates(comps, playerType, targetGroup) {
  const rates = [];
  for (const c of comps) {
    if (scarcityGroup(c.POS) !== targetGroup) continue;
    const war = playerWar(c, playerType);
    const slr = parseCurrency(c.SLR ?? 0);
    if (war > MIN_WAR_FOR_RATE && slr > 0) rates.push(slr / war);
  }
  return rates;
}

/**
 * @param {object[]} comparables
 * @param {object} playerDict
 * @param {"batter"|"pitcher"} playerType
 * @param {{ includePreFa?: boolean }} [options]
 */
export function suggestContract(comparables, playerDict, playerType, options = {}) {
  const includePreFa = Boolean(options.includePreFa);
  const scored = comparables.map((c) => [calculateSimilarityScore(c, playerDict, playerType), c]);
  scored.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return String(a[1].Name || "").localeCompare(String(b[1].Name || ""));
  });

  // Seed ranking with close comps first, then rest of pool (already sorted).
  const pickedClose = pickSuggestionComps(scored);
  const closeSet = new Set(pickedClose.map(([, c]) => c));
  const rankedForPricing = [
    ...pickedClose,
    ...scored.filter(([, c]) => !closeSet.has(c)),
  ];

  const top = pickPricingComps(rankedForPricing, includePreFa);
  const nSigned = scored.filter(([, c]) => isSignedMarketDeal(c)).length;

  const rawSalaries = top.map((c) => parseCurrency(c.SLR ?? 0)).filter((s) => s > 0);
  if (rawSalaries.length < MIN_ELIGIBLE_SALARY) return null;

  const salaries = filterSalaryOutliers(rawSalaries);
  if (!salaries.length) return null;

  const targetGroup = scarcityGroup(playerDict.POS);
  let rates = dollarWarRates(top, playerType, targetGroup);
  if (rates.length < MIN_DOLLAR_WAR_RATES) {
    rates = [];
    for (const c of top) {
      const war = playerWar(c, playerType);
      const slr = parseCurrency(c.SLR ?? 0);
      if (war > MIN_WAR_FOR_RATE && slr > 0) rates.push(slr / war);
    }
  }

  let aav;
  let method;
  const premium = positionPremium(playerDict.POS);
  const selectedWar = Math.max(0, playerWar(playerDict, playerType));
  if (rates.length >= MIN_DOLLAR_WAR_RATES) {
    const medRate = medianOf(rates);
    aav = medRate * selectedWar * premium;
    method = "dollar_per_war";
  } else {
    aav = medianOf(salaries);
    method = "slr_median";
  }
  if (aav == null || !(aav > 0)) return null;
  aav = Math.round(aav);

  const age = parseAge(playerDict.Age, 25);
  const yearsList = top
    .map((c) => parseYearsLeft(c.YL ?? "").years)
    .filter((y) => y > 0);
  let baseYears = yearsList.length ? medianOf(yearsList) : 3;
  let years;
  if (age >= 32) years = Math.max(1, Math.trunc(baseYears * 0.7));
  else if (age <= 25) years = Math.min(8, Math.trunc(baseYears * 1.2));
  else years = Math.trunc(baseYears);

  return {
    aav,
    years,
    total: aav * years,
    aav_display: `$${aav.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    total_display: `$${(aav * years).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    n_comps: top.length,
    n_signed: nSigned,
    n_with_salary: rawSalaries.length,
    include_pre_fa: includePreFa,
    method,
  };
}

export function rankComparables(comparables, playerDict, playerType, limit = 30) {
  const scored = comparables.map((c) => [calculateSimilarityScore(c, playerDict, playerType), c]);
  scored.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return String(a[1].Name || "").localeCompare(String(b[1].Name || ""));
  });
  const rows = [];
  for (const [sim, c] of scored.slice(0, limit)) {
    const status = contractStatus(c);
    const row = {
      id: String(c.ID || ""),
      name: c.Name || "",
      team: c.ORG || "",
      pos: c.POS || "",
      age: c.Age || "",
      slr: c.SLR || "",
      yl: c.YL || "",
      cv: c.CV || "",
      status,
      status_label: contractStatusLabel(status),
      similarity: round4(sim),
    };
    if (playerType === "batter") {
      Object.assign(row, {
        g: c.G || "",
        ops: c["OPS+"] || "",
        wrc: c["wRC+"] || "",
        war: c["WAR (Batter)"] ?? c.WAR ?? "",
      });
    } else {
      Object.assign(row, {
        ip: c.IP || "",
        era: c["ERA+"] || "",
        fip: c["FIP-"] || "",
        war: c["WAR (Pitcher)"] ?? c.WAR ?? "",
        rwar: c.rWAR || "",
      });
    }
    rows.push(row);
  }
  return rows;
}
