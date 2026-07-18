/** League-wide percentile rankings — ported from Portal percentiles.py */

import { parseStarRating } from "./player_analytics.js";
import { isMajorLeague } from "./league.js";
import { batterDefenseGrade } from "./radar.js";

export const PERCENTILE_TIERS = {
  elite: { min: 90, max: 100, icon: "💎", label: "Elite", color: "#3b82f6" },
  above_average: { min: 70, max: 89, icon: "⭐", label: "Above Avg", color: "#2dd4bf" },
  average: { min: 40, max: 69, icon: "✅", label: "Average", color: "#84cc16" },
  below_average: { min: 20, max: 39, icon: "📉", label: "Below Avg", color: "#f59e0b" },
  poor: { min: 0, max: 19, icon: "❌", label: "Poor", color: "#ef4444" },
};

/**
 * Match player-card ratings bar palette (blue → teal/green → yellow → red),
 * mapped onto 0–100 percentiles.
 */
export function percentileBarColor(percentile) {
  const p = Number(percentile) || 0;
  if (p >= 90) return "#3b82f6";
  if (p >= 80) return "#60a5fa";
  if (p >= 70) return "#2dd4bf";
  if (p >= 60) return "#14b8a6";
  if (p >= 55) return "#4ade80";
  if (p >= 50) return "#84cc16";
  if (p >= 40) return "#eab308";
  if (p >= 30) return "#f59e0b";
  if (p >= 20) return "#f97316";
  return "#ef4444";
}

export const BATTER_METRICS = {
  "wRC+": { key: "wRC+", label: "wRC+", inverse: false },
  WAR: { key: "WAR (Batter)", fallback: "WAR", label: "WAR", inverse: false },
  "OPS+": { key: "OPS+", label: "OPS+", inverse: false },
  OPS: { key: "OPS", label: "OPS", inverse: false },
  wOBA: { key: "wOBA", label: "wOBA", inverse: false },
  AVG: { key: "AVG", label: "AVG", inverse: false },
  OBP: { key: "OBP", label: "OBP", inverse: false },
  SLG: { key: "SLG", label: "SLG", inverse: false },
  ISO: { key: "ISO", label: "ISO", inverse: false },
  "BB%": { key: "BB% (Batter)", fallback: "BB%", label: "BB%", inverse: false },
  "SO%": { key: "SO% (Batter)", fallback: "SO%", label: "SO%", inverse: true },
  ZR: { key: "ZR", label: "ZR", inverse: false },
  CON: { key: "CON", label: "Contact", inverse: false },
  POW: { key: "POW", label: "Power", inverse: false },
  EYE: { key: "EYE", label: "Eye", inverse: false },
  SPE: { key: "SPE", label: "Speed", inverse: false },
  DEF: {
    key: "DEF",
    label: "Defense",
    inverse: false,
    /** Position tools average (same as radar DEF); DH / no tools → skipped. */
    compute: (p) => {
      const g = batterDefenseGrade(p);
      return g?.cur ?? 0;
    },
  },
};

export const PITCHER_METRICS = {
  WAR: { key: "WAR (Pitcher)", fallback: "WAR", label: "WAR", inverse: false },
  "ERA+": { key: "ERA+", label: "ERA+", inverse: false },
  FIP: { key: "FIP", label: "FIP", inverse: true },
  "FIP-": { key: "FIP-", label: "FIP-", inverse: true },
  SIERA: { key: "SIERA", label: "SIERA", inverse: true },
  "K/9": { key: "K/9", label: "K/9", inverse: false },
  "BB/9": { key: "BB/9", label: "BB/9", inverse: true },
  "HR/9": { key: "HR/9", label: "HR/9", inverse: true },
  STU: { key: "STU", label: "Stuff", inverse: false },
  MOV: { key: "MOV", label: "Movement", inverse: false },
  CON: { key: "CON", label: "Control", inverse: false },
};

/** Ratings-focused metrics for draft-class percentile cards (no production stats). */
export const DRAFT_BATTER_METRICS = {
  CON: { key: "CON", label: "Contact", inverse: false },
  "CON P": { key: "CON P", label: "Contact Pot.", inverse: false },
  GAP: { key: "GAP", label: "Gap", inverse: false },
  "GAP P": { key: "GAP P", label: "Gap Pot.", inverse: false },
  POW: { key: "POW", label: "Power", inverse: false },
  "POW P": { key: "POW P", label: "Power Pot.", inverse: false },
  EYE: { key: "EYE", label: "Eye", inverse: false },
  "EYE P": { key: "EYE P", label: "Eye Pot.", inverse: false },
  "K's": { key: "K's", label: "Avoid K's", inverse: false },
  "K P": { key: "K P", label: "Avoid K's Pot.", inverse: false },
  SPE: { key: "SPE", label: "Speed", inverse: false },
  STE: { key: "STE", label: "Stealing", inverse: false },
};

export const DRAFT_PITCHER_METRICS = {
  STU: { key: "STU", label: "Stuff", inverse: false },
  "STU P": { key: "STU P", label: "Stuff Pot.", inverse: false },
  MOV: { key: "MOV", label: "Movement", inverse: false },
  "MOV P": { key: "MOV P", label: "Movement Pot.", inverse: false },
  CON: { key: "CON", fallback: "CON (Pitcher)", label: "Control", inverse: false },
  "CON P": { key: "CON P", fallback: "CON P (Pitcher)", label: "Control Pot.", inverse: false },
  FB: { key: "FB", label: "Fastball", inverse: false },
  "FB P": { key: "FB P", label: "Fastball Pot.", inverse: false },
  SL: { key: "SL", label: "Slider", inverse: false },
  "SL P": { key: "SL P", label: "Slider Pot.", inverse: false },
  CB: { key: "CB", label: "Curveball", inverse: false },
  "CB P": { key: "CB P", label: "Curve Pot.", inverse: false },
  CH: { key: "CH", label: "Changeup", inverse: false },
  "CH P": { key: "CH P", label: "Change Pot.", inverse: false },
};

/** Explicit majors only (blank Lev excluded — same as MLB rank pools). */
export function majorLeaguePlayers(players) {
  return (players || []).filter((p) => isMajorLeague(p) === true);
}

export function getMetricValue(player, metricConfig) {
  if (typeof metricConfig?.compute === "function") {
    const n = metricConfig.compute(player);
    return Number.isFinite(n) ? n : 0;
  }
  const key = metricConfig.key || "";
  const fallback = metricConfig.fallback || "";
  let val = player[key] ?? "";
  if ((!val || val === "-") && fallback) val = player[fallback] ?? "";
  return parseStarRating(val);
}

export function calculatePercentile(value, allValues, inverse = false) {
  if (!allValues || !allValues.length) return 50;
  const filtered = allValues.filter((v) => v !== 0);
  if (!filtered.length) return 50;

  let countWorse;
  let countEqual;
  if (inverse) {
    countWorse = filtered.filter((v) => v > value).length;
    countEqual = filtered.filter((v) => v === value).length;
  } else {
    countWorse = filtered.filter((v) => v < value).length;
    countEqual = filtered.filter((v) => v === value).length;
  }
  const percentile = ((countWorse + 0.5 * countEqual) / filtered.length) * 100;
  return Math.max(0, Math.min(100, Math.round(percentile)));
}

export function getPercentileTier(percentile) {
  for (const [tierKey, tierInfo] of Object.entries(PERCENTILE_TIERS)) {
    if (tierInfo.min <= percentile && percentile <= tierInfo.max) {
      return {
        key: tierKey,
        icon: tierInfo.icon,
        label: tierInfo.label,
        color: percentileBarColor(percentile),
      };
    }
  }
  return {
    key: "average",
    icon: "✅",
    label: "Average",
    color: percentileBarColor(percentile),
  };
}

export function generatePercentileBar(percentile, width = 20) {
  const filled = Math.trunc((percentile / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export class PercentileCalculator {
  constructor() {
    this.batterDistributions = {};
    this.pitcherDistributions = {};
    this._batterMetrics = BATTER_METRICS;
    this._pitcherMetrics = PITCHER_METRICS;
    this._cacheValid = false;
  }

  /**
   * @param {object[]} batters
   * @param {object[]} pitchers
   * @param {{ majorsOnly?: boolean, batterMetrics?: object, pitcherMetrics?: object }} [opts]
   */
  buildDistributions(batters, pitchers, opts = {}) {
    const majorsOnly = opts.majorsOnly !== false;
    const batterMetrics = opts.batterMetrics || BATTER_METRICS;
    const pitcherMetrics = opts.pitcherMetrics || PITCHER_METRICS;
    this._batterMetrics = batterMetrics;
    this._pitcherMetrics = pitcherMetrics;

    const poolBatters = majorsOnly ? majorLeaguePlayers(batters) : batters || [];
    const poolPitchers = majorsOnly ? majorLeaguePlayers(pitchers) : pitchers || [];

    this.batterDistributions = {};
    for (const [metricName, config] of Object.entries(batterMetrics)) {
      const values = [];
      for (const batter of poolBatters) {
        const val = getMetricValue(batter, config);
        if (val !== 0) values.push(val);
      }
      this.batterDistributions[metricName] = values.slice().sort((a, b) => a - b);
    }
    this.pitcherDistributions = {};
    for (const [metricName, config] of Object.entries(pitcherMetrics)) {
      const values = [];
      for (const pitcher of poolPitchers) {
        const val = getMetricValue(pitcher, config);
        if (val !== 0) values.push(val);
      }
      this.pitcherDistributions[metricName] = values.slice().sort((a, b) => a - b);
    }
    this._cacheValid = true;
  }

  getBatterPercentiles(batter) {
    if (!this._cacheValid) return {};
    const results = {};
    for (const [metricName, config] of Object.entries(this._batterMetrics)) {
      const value = getMetricValue(batter, config);
      const distribution = this.batterDistributions[metricName] || [];
      if (!distribution.length || value === 0) continue;
      const inverse = config.inverse || false;
      const percentile = calculatePercentile(value, distribution, inverse);
      const tier = getPercentileTier(percentile);
      const bar = generatePercentileBar(percentile);
      results[metricName] = {
        label: config.label,
        value,
        percentile,
        tier,
        bar,
        inverse,
      };
    }
    return results;
  }

  getPitcherPercentiles(pitcher) {
    if (!this._cacheValid) return {};
    const results = {};
    for (const [metricName, config] of Object.entries(this._pitcherMetrics)) {
      const value = getMetricValue(pitcher, config);
      const distribution = this.pitcherDistributions[metricName] || [];
      if (!distribution.length || value === 0) continue;
      const inverse = config.inverse || false;
      const percentile = calculatePercentile(value, distribution, inverse);
      const tier = getPercentileTier(percentile);
      const bar = generatePercentileBar(percentile);
      results[metricName] = {
        label: config.label,
        value,
        percentile,
        tier,
        bar,
        inverse,
      };
    }
    return results;
  }

  getPlayerSummary(player, playerType = "batter") {
    const percentiles =
      playerType === "batter"
        ? this.getBatterPercentiles(player)
        : this.getPitcherPercentiles(player);
    if (!Object.keys(percentiles).length) return { best: [], worst: [] };

    const sorted = Object.entries(percentiles).sort(
      (a, b) => b[1].percentile - a[1].percentile,
    );
    const best = [];
    const worst = [];
    for (const [metricName, data] of sorted.slice(0, 3)) {
      if (data.percentile >= 50) {
        best.push({
          name: metricName,
          label: data.label,
          percentile: data.percentile,
          tier: data.tier,
        });
      }
    }
    for (const [metricName, data] of sorted.slice(-3)) {
      if (data.percentile < 50) {
        worst.push({
          name: metricName,
          label: data.label,
          percentile: data.percentile,
          tier: data.tier,
        });
      }
    }
    return { best, worst };
  }
}

let _percentileCalculator = null;

export function getPercentileCalculator() {
  if (!_percentileCalculator) _percentileCalculator = new PercentileCalculator();
  return _percentileCalculator;
}

/**
 * @param {object[]} batters
 * @param {object[]} pitchers
 * @param {{ majorsOnly?: boolean, batterMetrics?: object, pitcherMetrics?: object, fresh?: boolean }} [opts]
 */
export function initializePercentiles(batters, pitchers, opts = {}) {
  const calc = opts.fresh ? new PercentileCalculator() : getPercentileCalculator();
  calc.buildDistributions(batters, pitchers, opts);
  return calc;
}
