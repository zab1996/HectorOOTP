/** Shared Compare seed (list tabs, player card, contract). */

export const COMPARE_SEED_KEY = "hector_compare_seed";
export const MAX_COMPARE_PLAYERS = 3;

/**
 * @param {{ type: "batter"|"pitcher", pool?: "roster"|"draft"|"ifa", players?: {id?:string,name?:string}[], id?: string, name?: string }} seed
 */
export function writeCompareSeed(seed) {
  const type = seed.type === "pitcher" ? "pitcher" : "batter";
  const pool =
    seed.pool === "draft" ? "draft" : seed.pool === "ifa" ? "ifa" : "roster";
  let players = [];
  if (Array.isArray(seed.players) && seed.players.length) {
    players = seed.players.slice(0, MAX_COMPARE_PLAYERS).map((p) => ({
      id: String(p.id || ""),
      name: String(p.name || ""),
    }));
  } else if (seed.id || seed.name) {
    players = [{ id: String(seed.id || ""), name: String(seed.name || "") }];
  }
  try {
    sessionStorage.setItem(
      COMPARE_SEED_KEY,
      JSON.stringify({ type, pool, players }),
    );
  } catch (_) {
    /* ignore quota */
  }
}

export function goToCompare(seed) {
  writeCompareSeed(seed);
  window.location.href = "compare.html";
}

export function readAndClearCompareSeed() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(COMPARE_SEED_KEY);
    if (raw) sessionStorage.removeItem(COMPARE_SEED_KEY);
  } catch (_) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}
