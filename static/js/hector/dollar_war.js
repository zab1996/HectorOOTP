/**
 * Role-pooled league $/WAR (SP / RP / batters).
 * Dollars are in millions (same as parseSalary).
 */
import { isMajorLeague } from "./league.js";
import { parseSalary, parseYearsLeft, getWar } from "./player_analytics.js";

const MIN_WAR = 0.5;
const MIN_SIGNED_FOR_POOL = 8;

/**
 * @param {object} player
 * @param {"batter"|"pitcher"} [playerType]
 * @returns {"SP"|"RP"|"batter"|null}
 */
export function dollarWarPool(player, playerType) {
  const pos = String(player?.POS || "").toUpperCase();
  if (playerType === "pitcher" || pos === "SP" || pos === "RP" || pos === "CL") {
    if (pos === "SP") return "SP";
    if (pos === "RP" || pos === "CL") return "RP";
    return null;
  }
  if (playerType === "batter" || (pos && pos !== "SP" && pos !== "RP" && pos !== "CL")) {
    return "batter";
  }
  return null;
}

export function poolLabel(pool) {
  if (pool === "SP") return "SP";
  if (pool === "RP") return "RP";
  if (pool === "batter") return "Batter";
  return "—";
}

function medianOf(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function playerTypeHint(player) {
  const pos = String(player?.POS || "").toUpperCase();
  if (pos === "SP" || pos === "RP" || pos === "CL") return "pitcher";
  return "batter";
}

/**
 * @param {object[]} pitchers
 * @param {object[]} batters
 */
export function buildDollarWarIndex(pitchers, batters) {
  /** @type {Record<string, { rates: number[], signedRates: number[] }>} */
  const buckets = {
    SP: { rates: [], signedRates: [] },
    RP: { rates: [], signedRates: [] },
    batter: { rates: [], signedRates: [] },
  };

  function consider(player, type) {
    if (isMajorLeague(player) === false) return;
    const pool = dollarWarPool(player, type);
    if (!pool || !buckets[pool]) return;
    const war = getWar(player, type);
    const slrM = parseSalary(player.SLR ?? 0);
    if (!(war > MIN_WAR) || !(slrM > 0)) return;
    const dpw = slrM / war;
    buckets[pool].rates.push(dpw);
    if (parseYearsLeft(player.YL ?? "").status === "signed") {
      buckets[pool].signedRates.push(dpw);
    }
  }

  for (const p of pitchers || []) consider(p, "pitcher");
  for (const b of batters || []) consider(b, "batter");

  /** @type {Record<string, { median: number|null, rates: number[] }>} */
  const pools = {};
  for (const [key, b] of Object.entries(buckets)) {
    const useSigned = b.signedRates.length >= MIN_SIGNED_FOR_POOL;
    const rates = useSigned ? b.signedRates : b.rates;
    const sorted = [...rates].sort((a, b) => a - b);
    pools[key] = {
      median: medianOf(sorted),
      rates: sorted,
      used_signed: useSigned,
    };
  }

  return {
    pools,
    /**
     * @param {object} player
     * @param {"batter"|"pitcher"} [playerType]
     */
    context(player, playerType) {
      const type = playerType || playerTypeHint(player);
      const pool = dollarWarPool(player, type);
      if (!pool) {
        return {
          pool: null,
          pool_label: "—",
          dpw: null,
          median: null,
          percentile: null,
          vs_pool: null,
        };
      }
      const info = pools[pool] || { median: null, rates: [] };
      const war = getWar(player, type);
      const slrM = parseSalary(player.SLR ?? 0);
      let dpw = null;
      if (war > MIN_WAR && slrM > 0) dpw = slrM / war;

      let percentile = null;
      if (dpw != null && info.rates.length) {
        // Lower $/WAR = better value → higher percentile
        let worseOrEqual = 0; // how many have higher (worse) or equal dpw
        for (const r of info.rates) {
          if (r >= dpw) worseOrEqual += 1;
        }
        percentile = Math.round((worseOrEqual / info.rates.length) * 100);
      }

      let vsPool = null;
      if (info.median != null && war > MIN_WAR && slrM > 0) {
        vsPool = war * info.median - slrM;
      }

      return {
        pool,
        pool_label: poolLabel(pool),
        dpw,
        median: info.median,
        percentile,
        vs_pool: vsPool,
      };
    },
  };
}

/** Format millions as $X.XXm */
export function formatMillions(m) {
  if (m == null || !Number.isFinite(m)) return "—";
  const sign = m < 0 ? "-" : "";
  return `${sign}$${Math.abs(m).toFixed(2)}M`;
}

export function formatDpw(dpw) {
  if (dpw == null || !Number.isFinite(dpw)) return "—";
  const sign = dpw < 0 ? "-" : "";
  return `${sign}$${Math.abs(dpw).toFixed(2)}M`;
}
