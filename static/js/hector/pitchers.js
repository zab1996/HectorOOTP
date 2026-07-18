import { round2 } from "./util.js";
import { DEFAULT_PITCHER_WEIGHTS } from "./weights.js";
import {
  parseStatValue,
  PITCHER_STAT_WEIGHTS,
  PITCHER_STAT_NORMALIZATION,
  MIN_INNINGS_PITCHED,
  MIN_INNINGS_SP,
  pitcherRateReliability,
  mergePitcherStatWeights,
  hasStatCell,
} from "./stat_weights.js";

export function calculatePitcherStatScore(player, statWeightsModule = null) {
  const cfg = mergePitcherStatWeights(statWeightsModule);
  const statWeights = cfg.stat_weights ?? PITCHER_STAT_WEIGHTS;
  const normalization = cfg.normalization ?? PITCHER_STAT_NORMALIZATION;
  const pos = String(player.POS || "").toUpperCase();
  const minIp =
    pos === "SP"
      ? (cfg.MIN_INNINGS_SP ?? MIN_INNINGS_SP)
      : (cfg.MIN_INNINGS_PITCHED ?? MIN_INNINGS_PITCHED);

  const ipRaw = player.IP;
  // Blank IP counts as 0 so Min IP = 0 can include no-work pitchers
  const ip =
    ipRaw == null || String(ipRaw).trim() === "" || String(ipRaw).trim() === "-"
      ? 0
      : parseStatValue(ipRaw);
  if (ip < minIp) return [null, false];

  const primaryKeys = ["WAR (Pitcher)", "ERA+", "rWAR"];
  const hasPrimary = primaryKeys.some((k) => {
    const v = player[k] ?? (k === "WAR (Pitcher)" ? player.WAR : undefined);
    return v != null && String(v).trim() !== "" && String(v).trim() !== "-";
  });
  if (!hasPrimary) return [null, false];

  const rateScale = pitcherRateReliability(ip, pos, cfg.sample_reliability);
  let statScore = 0.0;

  for (const [statName, config] of Object.entries(statWeights)) {
    if (statName === "age_adjustment") continue;
    const weight = config.weight ?? 0;
    if (!weight) continue;

    const appliesTo = config.applies_to;
    if (appliesTo != null && !appliesTo.includes(pos)) continue;

    const rawCell =
      player[statName] ??
      (statName === "WAR (Pitcher)"
        ? player.WAR
        : statName === "HLD"
          ? player["HLD (Stat)"]
          : undefined);
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

    // Rate stats scale with IP so short hot streaks don't dominate
    if (config.sample_sensitive) contrib *= rateScale;

    statScore += contrib;
  }
  return [round2(statScore), true];
}

export function calculateScore(player, sectionWeights, useStats = false, statWeightsModule = null) {
  let totalCore = 0;
  let totalCorePotential = 0;
  let totalPitchArsenal = 0;
  let totalPitchPotential = 0;
  let totalOther = 0;
  let currentPenalties = 0;
  let potentialPenalties = 0;

  const pitchKeyMapActual = {
    FB: "Fastball", CH: "Changeup", CB: "Curveball", SL: "Slider", SI: "Sinker",
    SP: "Splitter", CT: "Cutter", FO: "Forkball", CC: "Circle Change",
    SC: "Screwball", KC: "Knuckle Curve", KN: "Knuckleball",
  };
  const pitchKeyMapPotential = {
    FBP: "Fastball Potential", CHP: "Changeup Potential", CBP: "Curveball Potential",
    SLP: "Slider Potential", SIP: "Sinker Potential", SPP: "Splitter Potential",
    CTP: "Cutter Potential", FOP: "Forkball Potential", CCP: "Circle Change Potential",
    SCP: "Screwball Potential", KCP: "Knuckle Curve Potential", KNP: "Knuckleball Potential",
  };

  function parseValue(rawValue) {
    rawValue = String(rawValue).trim();
    if (rawValue.includes("Stars")) {
      try {
        return parseFloat(rawValue.split(/\s+/)[0]);
      } catch {
        return 0;
      }
    }
    if (rawValue.includes("-") && rawValue !== "-" && !rawValue.startsWith("-")) {
      const parts = rawValue.replace("mph", "").split("-").map((p) => p.trim());
      const nums = [];
      for (const p of parts) {
        const n = parseFloat(p);
        if (!Number.isNaN(n)) nums.push(n);
      }
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    }
    if (rawValue === "-" || rawValue === "") return 0;
    const match = rawValue.match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
  }

  const meta = sectionWeights.meta || {};
  const metaCore = meta.core_attributes ?? 1.0;
  const metaCorePotential = meta.core_potentials ?? 1.0;
  const metaPitch = meta.pitch_arsenal ?? 1.0;
  const metaPitchPotential = meta.pitch_arsenal_potential ?? 1.0;
  const metaOther = meta.other_attributes ?? 1.0;
  const metaPenalties = meta.penalties ?? 1.0;
  const pen = { ...(DEFAULT_PITCHER_WEIGHTS.penalties || {}), ...(sectionWeights.penalties || {}) };

  const pitchValues = [];
  const pitchPotentialValues = [];
  let pos = "";
  for (const [header, value] of Object.entries(player)) {
    const val = parseValue(value);
    if (header in pitchKeyMapActual) {
      const key = pitchKeyMapActual[header];
      const weight = sectionWeights.pitch_arsenal?.[key] ?? 0;
      totalPitchArsenal += val * weight * metaPitch;
      if (val > 0) pitchValues.push(val);
    } else if (header in pitchKeyMapPotential) {
      const key = pitchKeyMapPotential[header];
      const weightKey = key.toLowerCase().replace(/ /g, "_");
      const weight = sectionWeights.pitch_arsenal_potential?.[weightKey] ?? 0;
      totalPitchPotential += val * weight * metaPitchPotential;
      if (val > 0) pitchPotentialValues.push(val);
    } else {
      const headerToWeight = {
        STU: "stuff", MOV: "movement", CON: "control",
        "STU P": "stuff_potential", "MOV P": "movement_potential", "CON P": "control_potential",
        PIT: "number_of_pitches", VELO: "velocity", STM: "stamina",
        "G/F": "ground_fly_ratio", HLD: "holds", SctAcc: "scout_accuracy",
      };
      const weightKey = headerToWeight[header];
      if (weightKey) {
        if (["stuff", "movement", "control", "overall_rating"].includes(weightKey)) {
          const weight = sectionWeights.core_attributes?.[weightKey] ?? 0;
          totalCore += val * weight * metaCore;
        } else if (
          ["stuff_potential", "movement_potential", "control_potential", "potential_rating"].includes(weightKey)
        ) {
          const weightKeyNorm = weightKey.toLowerCase().replace(/ /g, "_");
          const weight = sectionWeights.core_potentials?.[weightKeyNorm] ?? 0;
          totalCorePotential += val * weight * metaCorePotential;
        } else {
          const weight = sectionWeights.other_attributes?.[weightKey] ?? 0;
          totalOther += val * weight * metaOther;
        }
      }
    }
    pos = String(player.POS || "").toUpperCase();
  }

  try {
    if (pos === "SP") {
      if (parseInt(player.PIT ?? 0, 10) < 4) {
        currentPenalties += pen.penalty_sp_low_pitches ?? 0;
      }
      if (parseInt(player.STM ?? 0, 10) < 50) {
        currentPenalties += pen.penalty_sp_low_stamina ?? 0;
      }
      if (parseValue(player.CON ?? 0) < 50) {
        currentPenalties += pen.penalty_sp_low_control ?? 0;
      }
      if (parseValue(player["CON P"] ?? 0) < 50) {
        potentialPenalties += pen.penalty_sp_low_control_potential ?? 0;
      }
    }
  } catch {
    /* swallow like Python */
  }

  if (pitchValues.length && Math.max(...pitchValues) < 50) {
    currentPenalties += pen.no_pitch_50_plus ?? 0;
  }
  if (pitchPotentialValues.length && Math.max(...pitchPotentialValues) < 50) {
    potentialPenalties += pen.no_pitch_potential_50_plus ?? 0;
  }

  const currPenScaled = currentPenalties * metaPenalties;
  const potPenScaled = potentialPenalties * metaPenalties;
  totalOther += currPenScaled;
  const totalPotential = totalPitchPotential + totalCorePotential + potPenScaled;
  let totalScore = totalCore + totalPotential + totalPitchArsenal + totalOther;

  let statScore = null;
  let usedStats = false;
  if (useStats) {
    const [ss, used] = calculatePitcherStatScore(player, statWeightsModule);
    statScore = ss;
    usedStats = used;
    // Stats mode: no/low IP must not keep ratings Total on the leaderboard
    totalScore = usedStats && statScore != null ? statScore : 0;
  }

  const result = {
    total: round2(totalScore),
    pitches: round2(totalPitchArsenal),
    pitches_potential: round2(totalPitchPotential),
    core_potential: round2(totalCorePotential),
    pot_penalties: round2(potPenScaled),
    curr_total: round2(totalCore + totalPitchArsenal + totalOther),
  };
  if (useStats) {
    result.stat_score = statScore;
    result.used_stats = usedStats;
  }
  return result;
}
