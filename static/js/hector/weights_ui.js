import { deepClone } from "./util.js";

export const PITCHER_SECTIONS = [
  ["meta", "Meta multipliers", "Scales whole buckets of the pitcher Total. Recommended: leave at 1.0 — Draft applies its own meta separately."],
  ["core_attributes", "Core attributes (current)", "Stuff, Movement, Control — present ability."],
  ["core_potentials", "Core potentials", "Future Stuff / Movement / Control."],
  ["pitch_arsenal", "Pitch arsenal (current)", "Weights for each current pitch grade (FB, SL, …)."],
  ["pitch_arsenal_potential", "Pitch arsenal (potential)", "Weights for each pitch’s potential grade."],
  ["other_attributes", "Other attributes", "Stamina, pitch count, G/F, scout accuracy, etc."],
  ["penalties", "Penalties", "Flat deductions when triggers fire. Current penalties hit Current Score; potential penalties hit Potential Score; both feed Total. Scaled by Meta → Penalties."],
];

export const BATTER_SECTIONS = [
  ["meta", "Meta multipliers", "Scales whole Offense / Potential / Defense / Baserunning buckets in ratings Total."],
  ["overall", "Offense (current)", "Contact, Gap, Power, Eye, K’s — present bat tools."],
  ["potential", "Offense (potential)", "Future Contact / Gap / Power / Eye / K’s."],
  ["defense", "Defense", "Position-gated fielding only (catcher / IF / OF tools for that player’s POS; DH gets 0)."],
  ["baserunning", "Baserunning", "Speed, Stealing, and Running ratings."],
  ["scout_accuracy", "Scout accuracy", "Optional nudge from SctAcc. Default weight is 0."],
];

/**
 * Defense Options layout: group by position (shared IF/OF tools listed once).
 * Paths stay the real weight-tree keys used by scoring / form save.
 */
export const DEFENSE_POSITION_GROUPS = [
  {
    title: "Catcher (C)",
    fields: [
      ["defense.catcher.catcher_ability", "Ability"],
      ["defense.catcher.catcher_arm", "Arm"],
      ["defense.catcher.catcher_framing", "Framing"],
    ],
  },
  {
    title: "1B",
    fields: [
      ["defense.infield.infield_range.1B", "Range"],
      ["defense.infield.infield_arm.1B", "Arm"],
    ],
  },
  {
    title: "2B",
    fields: [
      ["defense.infield.infield_range.2B", "Range"],
      ["defense.infield.infield_arm.2B", "Arm"],
    ],
  },
  {
    title: "3B",
    fields: [
      ["defense.infield.infield_range.3B", "Range"],
      ["defense.infield.infield_arm.3B", "Arm (boosted)"],
    ],
  },
  {
    title: "SS",
    fields: [
      ["defense.infield.infield_range.SS", "Range (boosted)"],
      ["defense.infield.infield_arm.SS", "Arm"],
    ],
  },
  {
    title: "Infield (all IF)",
    fields: [["defense.infield.infield_error", "Error"]],
  },
  {
    title: "LF",
    fields: [["defense.outfield.outfield_range.LF", "Range"]],
  },
  {
    title: "CF",
    fields: [["defense.outfield.outfield_range.CF", "Range (boosted)"]],
  },
  {
    title: "RF",
    fields: [["defense.outfield.outfield_range.RF", "Range"]],
  },
  {
    title: "Outfield (all OF)",
    fields: [
      ["defense.outfield.outfield_error", "Error"],
      ["defense.outfield.outfield_arm", "Arm"],
    ],
  },
];

/** Build ordered defense subgroups for Options display. */
export function defensePositionSubgroups(defenseRows) {
  const byPath = new Map(defenseRows.map((r) => [r.path, r]));
  const used = new Set();
  const subgroups = [];
  for (const g of DEFENSE_POSITION_GROUPS) {
    const rows = [];
    for (const [path, label] of g.fields) {
      const row = byPath.get(path);
      if (!row) continue;
      used.add(path);
      rows.push({ ...row, label });
    }
    if (rows.length) subgroups.push({ title: g.title, rows });
  }
  const leftovers = defenseRows.filter((r) => !used.has(r.path));
  if (leftovers.length) {
    subgroups.push({ title: "Other", rows: leftovers });
  }
  return subgroups;
}

/** Per-field Options tooltips (path → description). Falls back to section tip. */
export const WEIGHT_FIELD_TIPS = {
  "meta.penalties":
    "Scales all pitcher penalty deductions (current and potential). 1.0 = full strength; 0 = ignore penalties.",
  "penalties.penalty_sp_low_pitches":
    "Current (SP only): if # of pitches (PIT) is under 4, this value is added to Current / Total (default negative). Does not apply to RP/CL.",
  "penalties.penalty_sp_low_stamina":
    "Current (SP only): if Stamina (STM) is under 50, this value is added to Current / Total (default negative). Does not apply to RP/CL.",
  "penalties.penalty_sp_low_control":
    "Current (SP only): if Control (CON) is under 50, this value is added to Current / Total (default negative). Does not apply to RP/CL.",
  "penalties.penalty_sp_low_control_potential":
    "Potential (SP only): if Control Potential (CON P) is under 50, this value is added to Potential / Total (default negative). Does not apply to RP/CL.",
  "penalties.no_pitch_50_plus":
    "Current (any pitcher): if no current pitch grade is 50 or higher, this value is added to Current / Total (default negative).",
  "penalties.no_pitch_potential_50_plus":
    "Potential (any pitcher): if no pitch potential grade is 50 or higher, this value is added to Potential / Total (default negative).",

  "meta.overall":
    "Scales Offense (current) in ratings Total. Recommended: leave at 1.0 — Draft applies its own current/potential meta separately.",
  "meta.potential":
    "Scales Offense (potential) in ratings Total. Recommended: leave at 1.0 — Draft applies its own current/potential meta separately.",
  "meta.defense":
    "Scales Defense in ratings Total. Recommended: leave at 1.0.",
  "meta.baserunning":
    "Scales Baserunning in ratings Total. Recommended: leave at 1.0.",

  "overall.contact":
    "Weight for current Contact (CON) in Offense.",
  "overall.gap":
    "Weight for current Gap (GAP) in Offense.",
  "overall.power":
    "Weight for current Power (POW) in Offense.",
  "overall.eye":
    "Weight for current Eye (EYE) in Offense.",
  "overall.strikeouts":
    "Weight for current K’s avoidance in Offense.",
  "potential.contact_potential":
    "Weight for Contact Potential (CON P) in Offense Pot.",
  "potential.gap_potential":
    "Weight for Gap Potential (GAP P) in Offense Pot.",
  "potential.power_potential":
    "Weight for Power Potential (POW P) in Offense Pot.",
  "potential.eye_potential":
    "Weight for Eye Potential (EYE P) in Offense Pot.",
  "potential.strikeouts_potential":
    "Weight for K’s Potential (K P) in Offense Pot.",

  "defense.catcher.catcher_ability":
    "Catchers only: weight for C ABI.",
  "defense.catcher.catcher_arm":
    "Catchers only: weight for C ARM.",
  "defense.catcher.catcher_framing":
    "Catchers only: weight for C FRM.",
  "defense.infield.infield_error":
    "Infielders only: weight for IF ERR (same value for 1B/2B/3B/SS).",
  "defense.infield.infield_range.SS":
    "SS only: IF RNG. Default 0.3 (boosted vs 0.2 at 1B/2B/3B).",
  "defense.infield.infield_range.1B":
    "1B only: IF RNG. Default 0.2.",
  "defense.infield.infield_range.2B":
    "2B only: IF RNG. Default 0.2.",
  "defense.infield.infield_range.3B":
    "3B only: IF RNG. Default 0.2.",
  "defense.infield.infield_arm.1B":
    "1B only: IF ARM. Default 0.2.",
  "defense.infield.infield_arm.2B":
    "2B only: IF ARM. Default 0.2.",
  "defense.infield.infield_arm.3B":
    "3B only: IF ARM. Default 0.3 (boosted vs 0.2 at 1B/2B/SS).",
  "defense.infield.infield_arm.SS":
    "SS only: IF ARM. Default 0.2.",
  "defense.outfield.outfield_error":
    "Outfielders only: weight for OF ERR (same value for LF/CF/RF).",
  "defense.outfield.outfield_arm":
    "Outfielders only: weight for OF ARM (same value for LF/CF/RF).",
  "defense.outfield.outfield_range.LF":
    "LF only: OF RNG. Default 0.2.",
  "defense.outfield.outfield_range.CF":
    "CF only: OF RNG. Default 0.3 (boosted vs 0.2 LF/RF).",
  "defense.outfield.outfield_range.RF":
    "RF only: OF RNG. Default 0.2.",

  "baserunning.speed":
    "Weight for Speed (SPE).",
  "baserunning.stealing":
    "Weight for Stealing (STE).",
  "baserunning.running":
    "Weight for Running (RUN).",

  scout_accuracy:
    "Weight for Scout Acc. (SctAcc). Default 0 — raising it favors well-scouted players and can ding IFAs / lightly scouted talent.",

  "stat_weights.WAR (Pitcher).weight":
    "Pitcher WAR contribution to stats Total. Overlaps with rWAR as a counting value metric — raise this and lower rWAR if you prefer WAR.",
  "stat_weights.rWAR.weight":
    "rWAR contribution to stats Total. Overlaps with WAR — raise this and lower WAR if you prefer rWAR.",
  "stat_weights.ERA+.weight":
    "ERA+ contribution (sample-scaled with IP). Park-adjusted results.",
  "stat_weights.FIP-.weight":
    "FIP- contribution (sample-scaled; lower is better). Isolates pitcher skill from team defense — used on the Pitchers tab for true individual value. Teams tab uses raw FIP (+ SIERA) instead because franchise defense matters there.",
  "stat_weights.HLD.weight":
    "Holds — RP/CL only.",

  "stat_weights.wRC+.weight":
    "wRC+ contribution (sample-scaled with games). Primary offense rate.",
  "stat_weights.WAR (Batter).weight":
    "Batter WAR contribution. Already includes offense, defense, and baserunning.",
  "stat_weights.OPS+.weight":
    "OPS+ contribution (sample-scaled with games). Secondary offense rate.",
  "stat_weights.ZR.weight":
    "Zone Rating. Default 0 — WAR already counts defense. Raise only for an intentional extra glove boost on top of WAR. Column still shows on Batters.",
  "stat_weights.UBR.weight":
    "Ultimate Base Running. Default 0 — WAR already counts baserunning. Raise only for an intentional extra BR boost. Column still shows on Batters.",
  "stat_weights.CERA.weight":
    "Catcher ERA (catchers only; lower better). Default 0 — WAR already counts catcher value. Raise only for an intentional extra boost. Column still shows on Batters.",
};

/** Visible note under a section heading (not a tooltip). */
export const SECTION_BLURBS = {
  meta:
    "Recommended: leave Meta multipliers at 1.0. The Draft tab applies its own current/potential meta (default ×0.9 / ×1.5) via a slider — that does not change these Options values.",
  overall:
    "Adjust these if you prefer certain bat tools more than others — e.g. raise Power if you value thump over Contact/Eye.",
  potential:
    "Same idea as Offense (current): bump future tools you care about more, lower the ones you don’t.",
  defense:
    "Grouped by position. Only tools for the batter’s primary POS count (DH = 0). Defaults already boost premium glove spots: 3B Arm 0.3 (vs 0.2 at other IF), SS Range 0.3 (vs 0.2), and CF Range 0.3 (vs 0.2 LF/RF). IF Error and OF Error/Arm are shared across those positions.",
  baserunning:
    "Usually fine at defaults (low). Raising these rewards speedsters; leave alone unless you intentionally want more of that in Total.",
  scout_accuracy:
    "Default is 0. Not recommended to raise — it boosts well-scouted players and can unfairly lower quality players with thin scouting (e.g. IFAs).",
  core_attributes:
    "Adjust these if you prefer certain tools more than others. Tip: Stuff largely reflects pitch quality in OOTP, and Pitch arsenal (current) is scored separately into Total — so Stuff is often better weighed lower than Movement/Control to avoid double-counting the same signal.",
  core_potentials:
    "Adjust these if you prefer certain future tools more than others. Tip: Stuff Potential overlaps with Pitch arsenal (potential), which is also scored into Total — so Stuff Potential is often better weighed lower than Movement/Control Potential.",
  pitch_arsenal:
    "Adjust these if you prefer certain pitches more than others — raise ones you value, lower ones you don’t.",
  pitch_arsenal_potential:
    "Adjust these if you prefer certain pitches more than others — bump pitches you value, reduce the ones you don’t.",
  other_attributes:
    "Changing these is not recommended — they are meant to stay low. Separate Penalties already cover most of the same ideas (low pitch count, low stamina, weak arsenal, etc.).",

  // Shared by pitcher-stats + batter-stats panels
  normalization:
    "Each raw export value is clamped to min–max, then mapped onto a 0–scale_to range so different units (e.g. WAR vs ERA+/wRC+) can share one Total. Weights apply after that. Leave defaults unless your league’s typical ranges differ a lot.",

  // Panel-specific (looked up as `${prefix}:${key}` first)
  "pitcher-stats:sample_reliability":
    "Rate stats (ERA+, FIP-) are scaled down when IP is below these full-sample targets (SP and RP separately). Contribution × min(1, IP ÷ full-sample IP). WAR, rWAR, and HLD are not sample-scaled. Min IP floors on the Pitchers tab still gate who gets a stats Total at all.",
  "batter-stats:sample_reliability":
    "Rate stats (wRC+, OPS+) are scaled down when games are below this full-sample target. Contribution × min(1, G ÷ full-sample G). WAR is not sample-scaled. Min G on the Batters tab still gates who gets a stats Total at all.",
  "pitcher-stats:stat_weights":
    "WAR and rWAR overlap as counting value metrics — raise one and lower the other depending on which you prefer. FIP- isolates pitcher skill from team defense (Pitchers tab); Teams uses FIP (+ SIERA) because franchise defense is relevant there.",
  "batter-stats:stat_weights":
    "WAR already includes defense, baserunning, and catcher value. ZR, UBR, and CERA default to 0 — raise them only if you want an extra boost on top of WAR. Those columns still show on the Batters tab for visibility.",
};

export const PITCHER_STAT_SECTIONS = [
  ["sample_reliability", "Rate-stat sample reliability", "How quickly ERA+/FIP- reach full weight as IP grows."],
  ["stat_weights", "Stat contribution weights", "Share of stats Total from WAR, ERA+, rWAR, FIP-, HLD, etc."],
  ["normalization", "Normalization ranges", "Clamp each raw stat to min–max, map to 0–scale_to, then apply weights."],
];

export const BATTER_STAT_SECTIONS = [
  ["sample_reliability", "Rate-stat sample reliability", "How quickly wRC+/OPS+ reach full weight as games grow."],
  ["stat_weights", "Stat contribution weights", "Share of stats Total from wRC+, WAR, OPS+ (ZR/UBR/CERA default off)."],
  ["normalization", "Normalization ranges", "Clamp each raw stat to min–max, map to 0–scale_to, then apply weights."],
];

/** Sample floors are edited on Pitchers/Batters tabs, not Options. */
export const OPTIONS_HIDDEN_STAT_SECTIONS = new Set([
  "MIN_INNINGS_PITCHED",
  "MIN_INNINGS_SP",
  "MIN_PLATE_APPEARANCES",
]);

function humanize(key) {
  if (["1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "C"].includes(key) || key === key.toUpperCase()) {
    return key;
  }
  if (key.includes(" ") || (key[0] && key[0] === key[0].toUpperCase())) return key;
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function flattenWeights(weights, prefix = "") {
  const rows = [];
  function walk(node, path) {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      for (const [k, v] of Object.entries(node)) walk(v, path.concat(String(k)));
    } else if (typeof node === "number") {
      rows.push({
        path: path.join("."),
        section: path[0] || "",
        label: path.length > 1 ? path.slice(1).map(humanize).join(" / ") : humanize(path[0] || ""),
        value: Number(node),
      });
    }
  }
  walk(weights, prefix ? [prefix] : []);
  return rows;
}

export function setByPath(tree, path, value) {
  const parts = path.split(".");
  let cur = tree;
  for (const part of parts.slice(0, -1)) {
    if (!(part in cur) || typeof cur[part] !== "object") cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

export function applyFormWeights(base, formData, prefix) {
  const out = deepClone(base);
  const plen = prefix.length + 1;
  for (const [key, raw] of Object.entries(formData)) {
    if (!key.startsWith(prefix + ".")) continue;
    const path = key.slice(plen);
    const val = parseFloat(String(raw).trim());
    if (Number.isNaN(val)) continue;
    setByPath(out, path, val);
  }
  return out;
}

export function groupRows(rows, sectionOrder) {
  const bySec = {};
  for (const row of rows) {
    if (!bySec[row.section]) bySec[row.section] = [];
    bySec[row.section].push(row);
  }
  const groups = [];
  const seen = new Set();
  for (const [key, title, tip] of sectionOrder) {
    if (bySec[key]) {
      groups.push({ key, title, tip: tip || "", rows: bySec[key] });
      seen.add(key);
    }
  }
  for (const [key, list] of Object.entries(bySec)) {
    if (!seen.has(key)) groups.push({ key, title: humanize(key), tip: "", rows: list });
  }
  return groups;
}
