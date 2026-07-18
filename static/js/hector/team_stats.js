/**
 * Teams-tab-only stats formulas.
 * Does NOT change Pitchers/Batters player scoring (stat_weights.js).
 */
import { round2 } from "./util.js";
import {
  parseStatValue,
  hasStatCell,
  batterGamesPlayed,
  batterLooksLikeRealSample,
  batterRateReliability,
  pitcherRateReliability,
  BATTER_SAMPLE_RELIABILITY,
  PITCHER_SAMPLE_RELIABILITY,
  MIN_PLATE_APPEARANCES,
} from "./stat_weights.js";

/** Pitching: WAR, ERA+, rWAR, FIP, SIERA (+ HLD for RP). No IP in Total. */
export const TEAM_PITCHER_STAT_WEIGHTS = {
  "WAR (Pitcher)": { weight: 0.3, higher_is_better: true },
  "ERA+": { weight: 0.3, higher_is_better: true, sample_sensitive: true },
  rWAR: { weight: 0.15, higher_is_better: true },
  FIP: { weight: 0.05, higher_is_better: false, sample_sensitive: true },
  SIERA: { weight: 0.05, higher_is_better: false, sample_sensitive: true },
  HLD: { weight: 0.05, higher_is_better: true, applies_to: ["RP", "CL"] },
};

export const TEAM_PITCHER_STAT_NORMALIZATION = {
  "WAR (Pitcher)": { min: -2.0, max: 8.0, scale_to: 100 },
  "ERA+": { min: 50, max: 200, scale_to: 100 },
  rWAR: { min: -2.0, max: 6.0, scale_to: 50 },
  FIP: { min: 2.0, max: 6.0, scale_to: 100 },
  SIERA: { min: 2.0, max: 6.0, scale_to: 100 },
  HLD: { min: 0, max: 30, scale_to: 20 },
};

/** Offense: wRC+, WAR, OPS+, G, UBR. Defense: ZR, CERA, E. */
export const TEAM_BATTER_STAT_WEIGHTS = {
  "wRC+": { weight: 0.3, higher_is_better: true, sample_sensitive: true, team_bucket: "offense" },
  "WAR (Batter)": { weight: 0.3, higher_is_better: true, team_bucket: "offense" },
  "OPS+": { weight: 0.15, higher_is_better: true, sample_sensitive: true, team_bucket: "offense" },
  G: { weight: 0.05, higher_is_better: true, scale_factor: 0.01, team_bucket: "offense" },
  UBR: { weight: 0.05, higher_is_better: true, team_bucket: "offense" },
  ZR: { weight: 0.1, higher_is_better: true, team_bucket: "defense" },
  CERA: { weight: 0.05, higher_is_better: false, team_bucket: "defense" },
  E: { weight: 0.05, higher_is_better: false, team_bucket: "defense" },
};

export const TEAM_BATTER_STAT_NORMALIZATION = {
  "wRC+": { min: 50, max: 180, scale_to: 100 },
  "WAR (Batter)": { min: -2.0, max: 8.0, scale_to: 100 },
  "OPS+": { min: 50, max: 180, scale_to: 100 },
  G: { min: 0, max: 162, scale_to: 10 },
  UBR: { min: -10, max: 15, scale_to: 30 },
  ZR: { min: -10, max: 15, scale_to: 50 },
  CERA: { min: 2.0, max: 6.0, scale_to: 50 },
  E: { min: 0, max: 30, scale_to: 40 },
};

function normalizeStatValue(rawValue, norm, higherIsBetter = true) {
  const minVal = norm.min ?? 0;
  const maxVal = norm.max ?? 100;
  const scaleTo = norm.scale_to ?? 100;
  const span = maxVal - minVal;
  if (!(span > 0)) return 0;
  const clamped = Math.max(minVal, Math.min(maxVal, rawValue));
  if (higherIsBetter === false) return ((maxVal - clamped) / span) * scaleTo;
  return ((clamped - minVal) / span) * scaleTo;
}

/**
 * Teams pitcher stats Total. Always uses no Min IP floor.
 * @returns {number} 0 if unscorable
 */
export function teamPitcherStatScore(player) {
  const pos = String(player.POS || "").toUpperCase();
  const ipRaw = player.IP;
  const ip =
    ipRaw == null || String(ipRaw).trim() === "" || String(ipRaw).trim() === "-"
      ? 0
      : parseStatValue(ipRaw);

  const primaryKeys = ["WAR (Pitcher)", "ERA+", "rWAR"];
  const hasPrimary = primaryKeys.some((k) => {
    const v = player[k] ?? (k === "WAR (Pitcher)" ? player.WAR : undefined);
    return hasStatCell(v);
  });
  if (!hasPrimary) return 0;

  const rateScale = pitcherRateReliability(ip, pos, PITCHER_SAMPLE_RELIABILITY);
  let score = 0;
  for (const [statName, config] of Object.entries(TEAM_PITCHER_STAT_WEIGHTS)) {
    const weight = config.weight ?? 0;
    if (!weight) continue;
    if (config.applies_to && !config.applies_to.includes(pos)) continue;

    const rawCell =
      player[statName] ??
      (statName === "WAR (Pitcher)"
        ? player.WAR
        : statName === "HLD"
          ? player["HLD (Stat)"]
          : undefined);
    if (config.higher_is_better === false && !hasStatCell(rawCell)) continue;

    let rawValue = parseStatValue(rawCell ?? 0);
    rawValue *= config.scale_factor ?? 1;

    let contrib;
    if (statName in TEAM_PITCHER_STAT_NORMALIZATION) {
      contrib =
        normalizeStatValue(
          rawValue,
          TEAM_PITCHER_STAT_NORMALIZATION[statName],
          config.higher_is_better !== false
        ) * weight;
    } else {
      contrib = rawValue * weight;
    }
    if (config.sample_sensitive) contrib *= rateScale;
    score += contrib;
  }
  return round2(score);
}

/**
 * Teams batter offense/defense split.
 * Uses Min G ≥50 (same default as batters sample floor).
 * @returns {{ offense: number, defense: number, total: number }}
 */
export function teamBatterStatSplit(player) {
  const empty = { offense: 0, defense: 0, total: 0 };
  const primaryKeys = ["wRC+", "WAR (Batter)", "OPS+"];
  const hasPrimary = primaryKeys.some((k) => {
    const v = player[k] ?? (k === "WAR (Batter)" ? player.WAR : undefined);
    return hasStatCell(v);
  });
  if (!hasPrimary) return empty;

  let games = batterGamesPlayed(player);
  if (games == null) {
    if (!batterLooksLikeRealSample(player)) return empty;
    games = BATTER_SAMPLE_RELIABILITY.full_sample_g ?? 120;
  } else if (games < MIN_PLATE_APPEARANCES) {
    return empty;
  }

  const rateScale = batterRateReliability(games, BATTER_SAMPLE_RELIABILITY);
  let offense = 0;
  let defense = 0;

  for (const [statName, config] of Object.entries(TEAM_BATTER_STAT_WEIGHTS)) {
    const weight = config.weight ?? 0;
    if (!weight) continue;

    const rawCell =
      statName === "G"
        ? games
        : player[statName] ?? (statName === "WAR (Batter)" ? player.WAR : undefined);

    // CERA blank (non-catchers) → skip; E blank → treat as 0 errors
    if (config.higher_is_better === false && statName !== "E" && !hasStatCell(rawCell)) {
      continue;
    }

    let rawValue = statName === "G" ? games : parseStatValue(rawCell ?? 0);
    rawValue *= config.scale_factor ?? 1;

    let contrib;
    if (statName in TEAM_BATTER_STAT_NORMALIZATION) {
      contrib =
        normalizeStatValue(
          rawValue,
          TEAM_BATTER_STAT_NORMALIZATION[statName],
          config.higher_is_better !== false
        ) * weight;
    } else {
      contrib = rawValue * weight;
    }
    if (config.sample_sensitive) contrib *= rateScale;

    if (config.team_bucket === "defense") defense += contrib;
    else offense += contrib;
  }

  offense = round2(offense);
  defense = round2(defense);
  return { offense, defense, total: round2(offense + defense) };
}
