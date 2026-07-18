/** League / level helpers shared by list filters and team aggregates. */

/**
 * @param {{ Lev?: string, lev?: string }} player Raw player or display row
 * @returns {boolean | null} true = majors, false = minors, null = unknown/blank (still shown)
 */
export function isMajorLeague(player) {
  const lev = String(player?.Lev ?? player?.lev ?? "").trim().toLowerCase();
  if (!lev || lev === "-" || lev === "—") return null;
  return (
    lev === "major league" ||
    lev === "majors" ||
    lev === "mlb" ||
    lev === "ml"
  );
}

/** True when majors-only mode should hide this player. */
export function shouldHideNonMajor(player, majorsOnly) {
  if (!majorsOnly) return false;
  return isMajorLeague(player) === false;
}
