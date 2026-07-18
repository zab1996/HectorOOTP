/** Shared analytics helpers — ported from Portal player_utils.py + trade_value parsers */

export const RATING_SCALE_THRESHOLD = 10;
export const STAR_TO_RATING_SCALE = 16;

export function parseNumber(value) {
  if (!value || value === "-" || value === "") return 0.0;
  try {
    let val = String(value).replace(/,/g, "").trim();
    if (val.includes("Stars")) return parseFloat(val.split(/\s+/)[0]);
    const n = parseFloat(val);
    return Number.isNaN(n) ? 0.0 : n;
  } catch {
    return 0.0;
  }
}

export function parseSalary(value) {
  if (!value || value === "-" || value === "") return 0.0;
  try {
    let val = String(value).trim().replace(/\$/g, "").replace(/,/g, "");
    return parseFloat(val) / 1_000_000;
  } catch {
    return 0.0;
  }
}

export function parseYearsLeft(value) {
  if (!value || value === "-" || value === "") {
    return { years: 0, status: "unknown" };
  }
  const val = String(value).trim();
  if (val.includes("(auto.)")) {
    const m = val.match(/(\d+)/);
    return { years: m ? parseInt(m[1], 10) : 1, status: "pre_arb" };
  }
  if (val.includes("(arbitr.)")) {
    const m = val.match(/(\d+)/);
    return { years: m ? parseInt(m[1], 10) : 1, status: "arbitration" };
  }
  try {
    const years = parseInt(val, 10);
    if (Number.isNaN(years)) return { years: 0, status: "unknown" };
    return { years, status: "signed" };
  } catch {
    return { years: 0, status: "unknown" };
  }
}

export function parseStarRating(val) {
  if (!val) return 0.0;
  let s = String(val).trim();
  if (s.includes("Stars")) {
    try {
      return parseFloat(s.split(/\s+/)[0]);
    } catch {
      return 0.0;
    }
  }
  if (s.includes("%")) {
    try {
      return parseFloat(s.replace("%", ""));
    } catch {
      return 0.0;
    }
  }
  try {
    const n = parseFloat(s);
    return Number.isNaN(n) ? 0.0 : n;
  } catch {
    return 0.0;
  }
}

export function getAge(player) {
  try {
    return parseInt(player.Age ?? 0, 10) || 0;
  } catch {
    return 0;
  }
}

export function getWar(player, playerType = "batter") {
  if (playerType === "pitcher") {
    return parseNumber(player["WAR (Pitcher)"] ?? player.WAR ?? 0);
  }
  return parseNumber(player["WAR (Batter)"] ?? player.WAR ?? 0);
}

/** True when export has both extension value and years (ECV / ETY). */
export function hasExtension(player) {
  const ecv = parseSalary(player?.ECV ?? player?.EV ?? 0);
  const ety = parseNumber(player?.ETY ?? player?.EY ?? 0);
  return ecv > 0 && ety > 0;
}

/**
 * Signed final-year player with no extension — Portal "FA Soon".
 * Excludes pre-arb / arbitration even when years === 1.
 */
export function isUpcomingFA(player) {
  const yl = parseYearsLeft(player?.YL ?? "");
  return yl.status === "signed" && yl.years === 1 && !hasExtension(player);
}

export function isStarScale(val) {
  return val <= RATING_SCALE_THRESHOLD;
}

export function normalizeRating(ovr) {
  if (isStarScale(ovr)) return ovr * STAR_TO_RATING_SCALE;
  return ovr;
}
