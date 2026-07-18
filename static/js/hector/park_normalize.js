/**
 * Neutral-park estimates for park-sensitive counting / raw rate stats.
 * Uses Team List home PF (ORG ↔ Abbr). Does not touch OPS+/wRC+/ERA+/FIP-/WAR.
 */
import { teamListByAbbr } from "./team_list.js";

/** Stat labels that may be divided by a park factor when the toggle is on. */
export const PARK_ADJUSTABLE_STATS = new Set([
  "AVG",
  "OBP",
  "SLG",
  "OPS",
  "ISO",
  "wOBA",
  "HR",
  "ERA",
  "WHIP",
  "FIP",
  "HR/9",
]);

/**
 * @param {string} label
 * @returns {"hr"|"avg"|"overall"|null}
 */
export function pfKeyForStat(label) {
  if (label === "HR" || label === "HR/9") return "hr";
  if (["AVG", "OBP", "SLG", "OPS", "ISO", "wOBA"].includes(label)) return "avg";
  if (["ERA", "WHIP", "FIP"].includes(label)) return "overall";
  return null;
}

export function isParkAdjustableStat(label) {
  return PARK_ADJUSTABLE_STATS.has(label);
}

function validPf(n) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? x : null;
}

/**
 * @returns {{ pf: number, pfHr: number, pfAvg: number, hasTeam: boolean }}
 */
export function parkFactorsForPlayer(player, teamList) {
  const map = teamListByAbbr(teamList);
  const org = String(player?.ORG || player?.team || "").toUpperCase();
  const team = org ? map.get(org) : null;
  const pf = validPf(team?.pf?.["PF"]) ?? 1;
  const pfHr = validPf(team?.pf?.["PF HR"]) ?? pf;
  const pfAvg = validPf(team?.pf?.["PF AVG"]) ?? pf;
  return { pf, pfHr, pfAvg, hasTeam: !!team };
}

/**
 * Neutral-park estimate: raw / pf (hitter-friendly parks dial counting/rates down).
 * @param {string} label
 * @param {number} rawNumber
 * @param {{ pf: number, pfHr: number, pfAvg: number }} factors
 */
export function adjustStatValue(label, rawNumber, factors) {
  const key = pfKeyForStat(label);
  if (!key || !Number.isFinite(rawNumber)) return rawNumber;
  let pf = 1;
  if (key === "hr") pf = factors.pfHr;
  else if (key === "avg") pf = factors.pfAvg;
  else pf = factors.pf;
  if (!(pf > 0)) return rawNumber;
  return rawNumber / pf;
}

function parseStatNumber(rawDisplay) {
  if (rawDisplay == null) return null;
  const s = String(rawDisplay).trim();
  if (!s || s === "-" || s === "—") return null;
  const n = parseFloat(s.replace(/%/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Format an adjusted number to resemble the raw cell style.
 * @param {string} label
 * @param {number} adjustedNumber
 * @param {string|number|null|undefined} rawDisplay
 */
export function formatAdjustedStat(label, adjustedNumber, rawDisplay) {
  if (!Number.isFinite(adjustedNumber)) {
    const s = String(rawDisplay ?? "").trim();
    return s || "—";
  }
  if (label === "HR") return String(Math.round(adjustedNumber));
  if (["AVG", "OBP", "SLG", "OPS", "ISO", "wOBA"].includes(label)) {
    const fixed = adjustedNumber.toFixed(3);
    const raw = String(rawDisplay ?? "").trim();
    if (raw.startsWith(".")) return fixed.replace(/^0/, "");
    return fixed;
  }
  return adjustedNumber.toFixed(2);
}

/**
 * @returns {string} Display string (raw or park-adjusted).
 */
export function parkAdjustedDisplay(label, rawDisplay, player, teamList, enabled) {
  const raw = rawDisplay == null ? "" : String(rawDisplay).trim();
  if (!raw || raw === "-" || raw === "—") return "—";
  if (!enabled || !isParkAdjustableStat(label)) return raw;
  const n = parseStatNumber(raw);
  if (n == null) return raw;
  const factors = parkFactorsForPlayer(player, teamList);
  const adj = adjustStatValue(label, n, factors);
  return formatAdjustedStat(label, adj, raw);
}

/**
 * Numeric value for ranking / best highlighting (raw or park-adjusted).
 * @returns {number|null}
 */
export function parkAdjustedNumber(label, rawDisplay, player, teamList, enabled) {
  const n = parseStatNumber(rawDisplay);
  if (n == null) return null;
  if (!enabled || !isParkAdjustableStat(label)) return n;
  return adjustStatValue(label, n, parkFactorsForPlayer(player, teamList));
}

/** True when Team List has at least one row (toggle can be enabled). */
export function hasTeamListParks(teamList) {
  return Array.isArray(teamList) && teamList.length > 0;
}

/** Soft clamp so extreme parks don't dominate trade value. */
const TRADE_MULT_MIN = 0.8;
const TRADE_MULT_MAX = 1.25;

/**
 * Multiplier for Trade Total when Neutral park is on.
 * Batters: 1 / √(PF_AVG × PF_HR) — hitter parks dial value down.
 * Pitchers: overall PF — hitter parks dial value up (tougher environment).
 * @param {object} player
 * @param {"batter"|"pitcher"} playerType
 * @param {object[]} teamList
 */
export function parkTradeTotalMultiplier(player, playerType, teamList) {
  const f = parkFactorsForPlayer(player, teamList);
  let mult = 1;
  if (playerType === "pitcher") {
    mult = f.pf > 0 ? f.pf : 1;
  } else {
    const blend = Math.sqrt(Math.max(f.pfAvg, 1e-6) * Math.max(f.pfHr, 1e-6));
    mult = blend > 0 ? 1 / blend : 1;
  }
  return Math.min(TRADE_MULT_MAX, Math.max(TRADE_MULT_MIN, mult));
}

/**
 * Trade-facing Total (Scores.total × park multiplier when enabled).
 * @param {number} rawTotal
 * @param {object} player
 * @param {"batter"|"pitcher"} playerType
 * @param {object[]} teamList
 * @param {boolean} enabled
 */
export function parkAdjustedTradeTotal(rawTotal, player, playerType, teamList, enabled) {
  const n = Number(rawTotal);
  const base = Number.isFinite(n) ? n : 0;
  if (!enabled) return base;
  return base * parkTradeTotalMultiplier(player, playerType, teamList);
}
