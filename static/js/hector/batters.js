import { round2 } from "./util.js";
import {
  parseStatValue,
  BATTER_STAT_WEIGHTS,
  BATTER_STAT_NORMALIZATION,
  MIN_PLATE_APPEARANCES,
  batterRateReliability,
  mergeBatterStatWeights,
  batterGamesPlayed,
  batterLooksLikeRealSample,
  hasStatCell,
} from "./stat_weights.js";

export function calculateBatterStatScore(player, statWeightsModule = null) {
  const cfg = mergeBatterStatWeights(statWeightsModule);
  const statWeights = cfg.stat_weights ?? BATTER_STAT_WEIGHTS;
  const normalization = cfg.normalization ?? BATTER_STAT_NORMALIZATION;
  const minGames = cfg.MIN_PLATE_APPEARANCES ?? MIN_PLATE_APPEARANCES;

  // Need at least one primary production stat present (not blank)
  const primaryKeys = ["wRC+", "WAR (Batter)", "OPS+"];
  const hasPrimary = primaryKeys.some((k) => {
    const v = player[k] ?? (k === "WAR (Batter)" ? player.WAR : undefined);
    return hasStatCell(v);
  });
  if (!hasPrimary) return [null, false];

  // G=0 is treated as missing — some exports zero G while leaving rate stats filled.
  let games = batterGamesPlayed(player);
  if (games == null) {
    if (!batterLooksLikeRealSample(player)) return [null, false];
    games = cfg.sample_reliability?.full_sample_g ?? 120;
  } else if (games < minGames) {
    return [null, false];
  }

  const rateScale = batterRateReliability(games, cfg.sample_reliability);
  const pos = String(player.POS || "").toUpperCase();
  let statScore = 0.0;
  for (const [statName, config] of Object.entries(statWeights)) {
    if (statName === "age_adjustment") continue;
    const weight = config.weight ?? 0;
    if (!weight) continue;

    const appliesTo = config.applies_to;
    if (appliesTo != null && !appliesTo.includes(pos)) continue;

    const rawCell =
      player[statName] ?? (statName === "WAR (Batter)" ? player.WAR : undefined);
    if (config.higher_is_better === false && !hasStatCell(rawCell)) continue;

    let rawValue = parseStatValue(rawCell ?? 0);
    const scaleFactor = config.scale_factor ?? 1.0;
    rawValue *= scaleFactor;

    let contrib;
    if (statName in normalization) {
      const norm = normalization[statName];
      const minVal = norm.min ?? 0;
      const maxVal = norm.max ?? 100;
      const scaleTo = norm.scale_to ?? 100;
      const span = maxVal - minVal;
      if (!(span > 0)) continue;
      const clamped = Math.max(minVal, Math.min(maxVal, rawValue));
      const normalized =
        config.higher_is_better === false
          ? ((maxVal - clamped) / span) * scaleTo
          : ((clamped - minVal) / span) * scaleTo;
      contrib = normalized * weight;
    } else {
      contrib = rawValue * weight;
    }

    if (config.sample_sensitive) contrib *= rateScale;

    statScore += contrib;
  }
  return [round2(statScore), true];
}

export function calculateBatterScore(player, sectionWeights, useStats = false, statWeightsModule = null) {
  const pos = String(player.POS || "").toUpperCase();

  function toNumber(val) {
    val = String(val).replace(" Stars", "").trim();
    if (val === "-" || val === "") return 0.0;
    const n = parseFloat(val);
    return Number.isNaN(n) ? 0.0 : n;
  }

  const batterKeyMap = {
    CON: ["overall", "contact"],
    GAP: ["overall", "gap"],
    POW: ["overall", "power"],
    EYE: ["overall", "eye"],
    "K's": ["overall", "strikeouts"],
    "CON P": ["potential", "contact_potential"],
    "GAP P": ["potential", "gap_potential"],
    "POW P": ["potential", "power_potential"],
    "EYE P": ["potential", "eye_potential"],
    "K P": ["potential", "strikeouts_potential"],
    "C ABI": ["defense", "catcher", "catcher_ability"],
    "C ARM": ["defense", "catcher", "catcher_arm"],
    "C FRM": ["defense", "catcher", "catcher_framing"],
    "IF RNG": ["defense", "infield", "infield_range"],
    "IF ERR": ["defense", "infield", "infield_error"],
    "IF ARM": ["defense", "infield", "infield_arm"],
    "OF RNG": ["defense", "outfield", "outfield_range"],
    "OF ERR": ["defense", "outfield", "outfield_error"],
    "OF ARM": ["defense", "outfield", "outfield_arm"],
    SPE: ["baserunning", "speed"],
    STE: ["baserunning", "stealing"],
    RUN: ["baserunning", "running"],
    SctAcc: ["scout_accuracy"],
  };

  let overallScore = 0.0;
  let potentialScore = 0.0;
  let defenseScore = 0.0;
  let baserunningScore = 0.0;
  let scoutAccuracyScore = 0.0;
  const meta = sectionWeights.meta || {};
  const metaOverall = meta.overall ?? 1.0;
  const metaPotential = meta.potential ?? 1.0;
  const metaDefense = meta.defense ?? 1.0;
  const metaBaserunning = meta.baserunning ?? 1.0;
  const metaScout = 1.0;

  for (const [attr, weightPath] of Object.entries(batterKeyMap)) {
    const val = toNumber(player[attr] ?? "-");
    if (!val) continue;
    if (weightPath[0] === "overall") {
      const weight = sectionWeights.overall?.[weightPath[1]] ?? 0;
      overallScore += val * weight;
    } else if (weightPath[0] === "potential") {
      const weight = sectionWeights.potential?.[weightPath[1]] ?? 0;
      potentialScore += val * weight;
    } else if (weightPath[0] === "defense") {
      if (weightPath.length === 3) {
        const section = weightPath[1];
        const key = weightPath[2];
        if (pos === "C" && section === "catcher") {
          const weight = sectionWeights.defense.catcher?.[key] ?? 0;
          defenseScore += val * weight;
        } else if (["1B", "2B", "3B", "SS"].includes(pos) && section === "infield") {
          let weight;
          if (key === "infield_range" || key === "infield_arm") {
            weight = sectionWeights.defense.infield?.[key]?.[pos] ?? 0;
          } else {
            weight = sectionWeights.defense.infield?.[key] ?? 0;
          }
          defenseScore += val * weight;
        } else if (["LF", "CF", "RF"].includes(pos) && section === "outfield") {
          let weight;
          if (key === "outfield_range") {
            weight = sectionWeights.defense.outfield?.[key]?.[pos] ?? 0;
          } else {
            weight = sectionWeights.defense.outfield?.[key] ?? 0;
          }
          defenseScore += val * weight;
        }
      }
    } else if (weightPath[0] === "baserunning") {
      const weight = sectionWeights.baserunning?.[weightPath[1]] ?? 0;
      baserunningScore += val * weight;
    } else if (weightPath[0] === "scout_accuracy") {
      const weight = sectionWeights.scout_accuracy ?? 0;
      scoutAccuracyScore += val * weight;
    }
  }

  overallScore *= metaOverall;
  potentialScore *= metaPotential;
  defenseScore *= metaDefense;
  baserunningScore *= metaBaserunning;
  scoutAccuracyScore *= metaScout;
  let total =
    overallScore + potentialScore + defenseScore + baserunningScore + scoutAccuracyScore;

  let statScore = null;
  let usedStats = false;
  if (useStats) {
    const [ss, used] = calculateBatterStatScore(player, statWeightsModule);
    statScore = ss;
    usedStats = used;
    // Stats mode: only rank on production. No/low sample must not keep ratings Total
    // (ratings often 150–200 and would dominate the board).
    total = usedStats && statScore != null ? statScore : 0;
  }

  const result = {
    offense: round2(overallScore),
    offense_potential: round2(potentialScore),
    defense: round2(defenseScore),
    baserunning: round2(baserunningScore),
    scout_accuracy: round2(scoutAccuracyScore),
    total: round2(total),
    overall_stars: player.OVR ?? "0 Stars",
    potential_stars: player.POT ?? "0 Stars",
  };
  if (useStats) {
    result.stat_score = statScore;
    result.used_stats = usedStats;
  }
  return result;
}
