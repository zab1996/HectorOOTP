/** Stats-based scoring weights — ported from PortalOOTP batter_stat_weights.py / pitcher_stat_weights.py */

export const MIN_PLATE_APPEARANCES = 50;
/** Relievers / closers — enough for a usable sample */
export const MIN_INNINGS_PITCHED = 20;
/** Starters need more IP so tiny hot streaks don't rank on rate stats alone */
export const MIN_INNINGS_SP = 40;

/** IP at which rate stats (ERA+) get full weight; below this they are scaled down linearly */
export const PITCHER_SAMPLE_RELIABILITY = {
  full_sample_ip_sp: 120,
  full_sample_ip_rp: 50,
};

export const BATTER_SAMPLE_RELIABILITY = {
  full_sample_g: 120,
};

export const BATTER_STAT_WEIGHTS = {
  "wRC+": {
    weight: 0.3,
    description: "Weighted Runs Created Plus - primary offensive value metric",
    baseline: 100,
    higher_is_better: true,
    sample_sensitive: true,
  },
  "WAR (Batter)": {
    weight: 0.3,
    description: "Wins Above Replacement - overall value",
    baseline: 0,
    higher_is_better: true,
  },
  "OPS+": {
    weight: 0.15,
    description: "OPS Plus - park-adjusted OPS",
    baseline: 100,
    higher_is_better: true,
    sample_sensitive: true,
  },
  ZR: {
    weight: 0.0,
    description: "Zone Rating - defensive runs prevented (fielding). Default 0 — WAR already includes defense; raise for an extra glove boost.",
    baseline: 0,
    higher_is_better: true,
  },
  UBR: {
    weight: 0.0,
    description: "Ultimate Base Running - baserunning value. Default 0 — WAR already includes BR; raise for an extra boost.",
    baseline: 0,
    higher_is_better: true,
  },
  CERA: {
    weight: 0.0,
    description: "Catcher ERA - catchers only; lower is better. Default 0 — WAR already includes catcher value; raise for an extra boost.",
    baseline: 4,
    higher_is_better: false,
    applies_to: ["C"],
  },
  age_adjustment: {
    veteran_bonus: 0.0,
    prospect_bonus: 0.0,
    description: "Age adjustments are handled separately in Trade Finder",
  },
};

export const BATTER_STAT_NORMALIZATION = {
  "wRC+": { min: 50, max: 180, scale_to: 100 },
  "WAR (Batter)": { min: -2.0, max: 8.0, scale_to: 100 },
  "OPS+": { min: 50, max: 180, scale_to: 100 },
  ZR: { min: -10, max: 15, scale_to: 50 },
  UBR: { min: -10, max: 15, scale_to: 30 },
  CERA: { min: 2.0, max: 6.0, scale_to: 50 },
};

export const PITCHER_STAT_WEIGHTS = {
  "WAR (Pitcher)": {
    weight: 0.28,
    description: "Wins Above Replacement - overall value",
    baseline: 0,
    higher_is_better: true,
  },
  "ERA+": {
    weight: 0.28,
    description: "ERA Plus - park-adjusted ERA (100 is average, higher is better)",
    baseline: 100,
    higher_is_better: true,
    sample_sensitive: true,
  },
  rWAR: {
    weight: 0.14,
    description: "Replacement-level WAR",
    baseline: 0,
    higher_is_better: true,
  },
  "FIP-": {
    weight: 0.1,
    description: "FIP- - fielding-independent pitching index; lower is better",
    baseline: 100,
    higher_is_better: false,
    sample_sensitive: true,
  },
  HLD: {
    weight: 0.05,
    description: "Holds - reliever value indicator",
    baseline: 0,
    higher_is_better: true,
    applies_to: ["RP", "CL"],
  },
  age_adjustment: {
    veteran_bonus: 0.0,
    prospect_bonus: 0.0,
    description: "Age adjustments are handled separately in Trade Finder",
  },
};

export const PITCHER_STAT_NORMALIZATION = {
  "WAR (Pitcher)": { min: -2.0, max: 8.0, scale_to: 100 },
  "ERA+": { min: 50, max: 200, scale_to: 100 },
  rWAR: { min: -2.0, max: 6.0, scale_to: 50 },
  "FIP-": { min: 50, max: 150, scale_to: 100 },
  HLD: { min: 0, max: 30, scale_to: 20 },
};

export function defaultBatterStatWeights() {
  return {
    MIN_PLATE_APPEARANCES,
    sample_reliability: JSON.parse(JSON.stringify(BATTER_SAMPLE_RELIABILITY)),
    stat_weights: JSON.parse(JSON.stringify(BATTER_STAT_WEIGHTS)),
    normalization: JSON.parse(JSON.stringify(BATTER_STAT_NORMALIZATION)),
  };
}

export function defaultPitcherStatWeights() {
  return {
    MIN_INNINGS_PITCHED,
    MIN_INNINGS_SP,
    sample_reliability: JSON.parse(JSON.stringify(PITCHER_SAMPLE_RELIABILITY)),
    stat_weights: JSON.parse(JSON.stringify(PITCHER_STAT_WEIGHTS)),
    normalization: JSON.parse(JSON.stringify(PITCHER_STAT_NORMALIZATION)),
  };
}

/** Merge saved stat-weight trees with defaults so new knobs appear after updates. */
export function mergePitcherStatWeights(saved) {
  const d = defaultPitcherStatWeights();
  if (!saved || typeof saved !== "object") return d;
  const mergedWeights = { ...d.stat_weights };
  for (const [k, v] of Object.entries(saved.stat_weights || {})) {
    if (!(k in d.stat_weights)) continue; // drop removed keys (e.g. IP)
    mergedWeights[k] =
      v && typeof v === "object" && !Array.isArray(v)
        ? { ...(d.stat_weights[k] || {}), ...v }
        : v;
  }
  const mergedNorm = { ...d.normalization };
  for (const [k, v] of Object.entries(saved.normalization || {})) {
    if (!(k in d.normalization)) continue;
    mergedNorm[k] =
      v && typeof v === "object" && !Array.isArray(v) ? { ...d.normalization[k], ...v } : v;
  }
  return {
    ...d,
    ...saved,
    sample_reliability: { ...d.sample_reliability, ...(saved.sample_reliability || {}) },
    stat_weights: mergedWeights,
    normalization: mergedNorm,
  };
}

/** Migrate prior default ZR/UBR/CERA weights (0.1 / 0.05 / 0.05) → 0 when still on old defaults. */
function migrateBatterComponentWeights(mergedWeights, defaults) {
  const oldDefaults = { ZR: 0.1, UBR: 0.05, CERA: 0.05 };
  for (const [k, oldW] of Object.entries(oldDefaults)) {
    const row = mergedWeights[k];
    if (row && typeof row === "object" && row.weight === oldW) {
      mergedWeights[k] = { ...row, weight: defaults[k]?.weight ?? 0 };
    }
  }
  return mergedWeights;
}

export function mergeBatterStatWeights(saved) {
  const d = defaultBatterStatWeights();
  if (!saved || typeof saved !== "object") return d;
  const mergedWeights = { ...d.stat_weights };
  for (const [k, v] of Object.entries(saved.stat_weights || {})) {
    if (!(k in d.stat_weights)) continue; // drop removed keys (e.g. G)
    mergedWeights[k] =
      v && typeof v === "object" && !Array.isArray(v)
        ? { ...(d.stat_weights[k] || {}), ...v }
        : v;
  }
  migrateBatterComponentWeights(mergedWeights, d.stat_weights);
  const mergedNorm = { ...d.normalization };
  for (const [k, v] of Object.entries(saved.normalization || {})) {
    if (!(k in d.normalization)) continue;
    mergedNorm[k] =
      v && typeof v === "object" && !Array.isArray(v) ? { ...d.normalization[k], ...v } : v;
  }
  return {
    ...d,
    ...saved,
    sample_reliability: { ...d.sample_reliability, ...(saved.sample_reliability || {}) },
    stat_weights: mergedWeights,
    normalization: mergedNorm,
  };
}

export function parseStatValue(val) {
  if (val == null) return 0.0;
  let s = String(val).trim();
  if (s === "-" || s === "" || s === " ") return 0.0;
  s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0.0 : n;
}

/** True when a cell has a real exported value (not blank / dash). */
export function hasStatCell(val) {
  if (val == null) return false;
  const s = String(val).trim();
  return s !== "" && s !== "-" && s !== "—" && s !== "N/A";
}

/**
 * Games for batter sample-size checks.
 * Treats G=0 as missing (some exports leave G at 0 while rate stats are filled).
 * Falls back to PA≈3.7 per game, then null if unknown.
 */
export function batterGamesPlayed(player) {
  const rawG = player?.["G (Batter)"] ?? player?.G;
  if (hasStatCell(rawG)) {
    const g = parseStatValue(rawG);
    if (g > 0) return g;
  }
  if (hasStatCell(player?.PA)) {
    const pa = parseStatValue(player.PA);
    if (pa > 0) return Math.max(1, pa / 3.7);
  }
  return null;
}

/** Season rate stats look like real playing time, not export placeholders (often 100 / 0.0). */
export function batterLooksLikeRealSample(player) {
  const war = parseStatValue(player?.["WAR (Batter)"] ?? player?.WAR);
  const wrc = parseStatValue(player?.["wRC+"]);
  const ops = parseStatValue(player?.["OPS+"]);
  if (Math.abs(war) >= 0.5) return true;
  if (wrc > 0 && Math.abs(wrc - 100) >= 5) return true;
  if (ops > 0 && Math.abs(ops - 100) >= 5) return true;
  return false;
}

export function pitcherRateReliability(ip, pos, sampleReliability = null) {
  const rel = sampleReliability ?? PITCHER_SAMPLE_RELIABILITY;
  const isSp = String(pos || "").toUpperCase() === "SP";
  const full = isSp ? (rel.full_sample_ip_sp ?? 120) : (rel.full_sample_ip_rp ?? 50);
  if (!(full > 0)) return 1;
  return Math.min(1, Math.max(0, ip / full));
}

export function batterRateReliability(games, sampleReliability = null) {
  const rel = sampleReliability ?? BATTER_SAMPLE_RELIABILITY;
  const full = rel.full_sample_g ?? 120;
  if (!(full > 0)) return 1;
  return Math.min(1, Math.max(0, games / full));
}
