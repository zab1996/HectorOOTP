/** Team Salary grid helpers — relative-year payroll view from YL / SLR / AAV / extensions. */

import { parseYearsLeft, parseSalary, parseNumber, hasExtension, getAge, getWar } from "./player_analytics.js";
import { formatDpw } from "./dollar_war.js";

export const MAX_SALARY_YEARS = 10;

/** Default: single roster table + one team pie. */
export const SALARY_GROUPS_COMBINED = [{ key: "ALL", label: "Roster" }];

/** One Pitchers section + one Batters section. */
export const SALARY_GROUPS_SIMPLE = [
  { key: "P", label: "Pitchers" },
  { key: "B", label: "Batters" },
];

/** Detailed position groups (SP · RP · C · IF · OF · DH). */
export const SALARY_GROUPS_DETAIL = [
  { key: "SP", label: "Starting Pitchers", positions: ["SP"] },
  { key: "RP", label: "Relief Pitchers", positions: ["RP", "CL"] },
  { key: "C", label: "Catchers", positions: ["C"] },
  { key: "IF", label: "Infielders", positions: ["1B", "2B", "3B", "SS"] },
  { key: "OF", label: "Outfielders", positions: ["LF", "CF", "RF"] },
  { key: "DH", label: "Designated Hitters", positions: ["DH"] },
];

/** @deprecated use SALARY_GROUPS_DETAIL */
export const SALARY_GROUPS = SALARY_GROUPS_DETAIL;

export function primaryPos(player) {
  const raw = String(player?.POS || "")
    .toUpperCase()
    .trim();
  if (!raw) return "";
  return raw.split(/[/,\s]+/).filter(Boolean)[0] || "";
}

/** Detail group key (SP/RP/C/IF/OF/DH) or null. */
export function salaryGroupKeyDetail(player) {
  const pos = primaryPos(player);
  if (pos === "SP") return "SP";
  if (pos === "RP" || pos === "CL") return "RP";
  if (pos === "C") return "C";
  if (["1B", "2B", "3B", "SS"].includes(pos)) return "IF";
  if (["LF", "CF", "RF"].includes(pos)) return "OF";
  if (pos === "DH") return "DH";
  return null;
}

/**
 * @param {object} player
 * @param {"combined"|"simple"|"detail"} [layout]
 */
export function salaryGroupKey(player, layout = "combined") {
  const detail = salaryGroupKeyDetail(player);
  if (!detail) return null;
  if (layout === "combined") return "ALL";
  if (layout === "simple") {
    return detail === "SP" || detail === "RP" ? "P" : "B";
  }
  return detail;
}

export function salaryGroupsForLayout(layout = "combined") {
  if (layout === "detail") return SALARY_GROUPS_DETAIL;
  if (layout === "simple") return SALARY_GROUPS_SIMPLE;
  return SALARY_GROUPS_COMBINED;
}

/** Main-term amount in millions: AAV (CV/TY) or SLR. */
export function mainSalaryM(player, valueMode = "slr") {
  const slr = parseSalary(player?.SLR ?? 0);
  if (valueMode === "aav") {
    const cv = parseSalary(player?.CV ?? 0);
    const ty = parseNumber(player?.TY ?? 0);
    if (cv > 0 && ty > 0) return cv / ty;
  }
  return slr;
}

export function extensionAavM(player) {
  const ecv = parseSalary(player?.ECV ?? player?.EV ?? 0);
  const ety = parseNumber(player?.ETY ?? player?.EY ?? 0);
  if (ecv > 0 && ety > 0) return ecv / ety;
  return 0;
}

/**
 * Year slots for one player: main years, optional extension years, then end marker.
 * Signed deals → FA; pre-arb / arb control → EXP (expiring), not FA.
 * @returns {{ kind: "main"|"extension"|"fa"|"exp", amountM: number|null, status?: string }[]}
 */
export function playerControlYears(player, valueMode = "slr") {
  const yl = parseYearsLeft(player?.YL ?? "");
  const years = Math.max(0, Math.min(MAX_SALARY_YEARS, yl.years || 0));
  const mainAmt = mainSalaryM(player, valueMode);
  const slots = [];

  for (let i = 0; i < years; i++) {
    slots.push({
      kind: "main",
      amountM: mainAmt,
      status: yl.status,
    });
  }

  if (hasExtension(player)) {
    const ety = Math.min(
      MAX_SALARY_YEARS - slots.length,
      Math.max(0, Math.floor(parseNumber(player?.ETY ?? player?.EY ?? 0))),
    );
    const extAmt = extensionAavM(player);
    for (let i = 0; i < ety; i++) {
      slots.push({ kind: "extension", amountM: extAmt, status: "extension" });
    }
  }

  if (slots.length < MAX_SALARY_YEARS) {
    const endKind = yl.status === "pre_arb" || yl.status === "arbitration" ? "exp" : "fa";
    slots.push({ kind: endKind, amountM: null, status: endKind });
  }

  return slots;
}

export function yearColumnLabel(index) {
  if (index === 0) return "Now";
  return `+${index}`;
}

/** Current-season $/WAR (SLR ÷ WAR), millions per WAR. Negative when WAR &lt; 0. */
export function playerDollarPerWar(player, playerType = "batter") {
  const war = getWar(player, playerType);
  const slrM = parseSalary(player?.SLR ?? 0);
  if (!(slrM > 0) || !Number.isFinite(war) || war === 0) return null;
  return slrM / war;
}

export { formatDpw };

/** Format millions as $7.9M / $875K / —. */
export function formatMoneyM(amountM) {
  if (amountM == null || Number.isNaN(amountM) || amountM <= 0) return "—";
  if (amountM < 0.05) return "<$50K";
  if (amountM < 1) {
    const k = Math.round(amountM * 1000);
    return `$${k}K`;
  }
  const rounded = amountM >= 10 ? amountM.toFixed(1) : amountM.toFixed(2);
  return `$${rounded.replace(/\.?0+$/, "")}M`;
}

/**
 * @param {object[]} players — already filtered to one ORG
 * @param {{ valueMode?: "slr"|"aav", groupLayout?: "combined"|"simple"|"detail" }} [opts]
 */
export function buildTeamSalaryView(players, opts = {}) {
  const valueMode = opts.valueMode === "slr" ? "slr" : "aav";
  const groupLayout =
    opts.groupLayout === "detail" ? "detail" : opts.groupLayout === "simple" ? "simple" : "combined";
  const rows = (players || []).map((player) => {
    const group = salaryGroupKey(player, groupLayout);
    const detail = salaryGroupKeyDetail(player);
    const type = detail === "SP" || detail === "RP" ? "pitcher" : "batter";
    const slots = playerControlYears(player, valueMode);
    return {
      player,
      type,
      group,
      pos: primaryPos(player),
      age: getAge(player),
      name: String(player.Name || ""),
      slots,
      thisYearM: slots[0]?.kind === "fa" || slots[0]?.kind === "exp" ? 0 : slots[0]?.amountM ?? 0,
      dpw: playerDollarPerWar(player, type),
    };
  }).filter((r) => r.group);

  let maxCols = 1;
  for (const r of rows) {
    maxCols = Math.max(maxCols, r.slots.length);
  }
  maxCols = Math.min(MAX_SALARY_YEARS, Math.max(1, maxCols));

  const teamThisYear = rows.reduce((s, r) => s + (r.thisYearM || 0), 0);

  const yearTotals = Array.from({ length: maxCols }, () => 0);
  for (const r of rows) {
    for (let i = 0; i < maxCols; i++) {
      const slot = r.slots[i];
      if (slot && slot.kind !== "fa" && slot.kind !== "exp" && slot.amountM > 0) {
        yearTotals[i] += slot.amountM;
      }
    }
  }

  const sections = salaryGroupsForLayout(groupLayout).map((g) => {
    const sectionRows = rows
      .filter((r) => r.group === g.key)
      .sort((a, b) => (b.thisYearM || 0) - (a.thisYearM || 0) || a.name.localeCompare(b.name));
    const sum = sectionRows.reduce((s, r) => s + (r.thisYearM || 0), 0);
    return {
      key: g.key,
      label: g.label,
      shortLabel: g.key === "P" ? "Pitchers" : g.key === "B" ? "Batters" : g.key === "ALL" ? "Roster" : g.key,
      rows: sectionRows,
      count: sectionRows.length,
      thisYearSum: sum,
      pctOfTeam: teamThisYear > 0 ? (sum / teamThisYear) * 100 : 0,
    };
  }).filter((s) => s.count > 0);

  return {
    valueMode,
    groupLayout,
    columnCount: maxCols,
    teamThisYear,
    yearTotals,
    sections,
    playerCount: rows.length,
  };
}

/** Unique ORG abbrs from player pools (skip blank / dash). */
export function orgsFromPlayers(pitchers, batters, { majorsOnly = true, shouldHide } = {}) {
  const set = new Set();
  const add = (p) => {
    if (shouldHide && shouldHide(p, majorsOnly)) return;
    const org = String(p?.ORG ?? "").trim();
    if (!org || org === "-" || org === "—") return;
    set.add(org);
  };
  for (const p of pitchers || []) add(p);
  for (const b of batters || []) add(b);
  return [...set].sort((a, b) => a.localeCompare(b));
}
