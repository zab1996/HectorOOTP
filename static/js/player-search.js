/**
 * Shared Pitchers/Batters/Draft/IFA search box matching.
 * Text tokens match name (and optionally team) + POS; bare numbers with </>/= are age filters.
 *
 * @param {{ name?: string, team?: string, pos?: string, age?: string|number }} player
 * @param {string} search
 * @param {{ includeTeam?: boolean }} [opts] — false for Draft/IFA (no ORG)
 */
export function matchesPlayerSearch(player, search, opts = {}) {
  const includeTeam = opts.includeTeam !== false;
  const raw = (search || "").trim();
  if (!raw) return true;
  const terms = raw.split(/\s+/);
  const textTerms = [];
  const ageFilters = [];
  const compRe = /^([<>]=?|=)?(\d+)$/;
  for (const term of terms) {
    const m = term.match(compRe);
    if (m) ageFilters.push([m[1] || "=", parseInt(m[2], 10)]);
    else textTerms.push(term.toLowerCase());
  }
  const pos = player.pos === "CL" ? "RP" : player.pos;
  const fields = includeTeam
    ? `${player.name || ""} ${player.team || ""} ${pos || ""}`.toLowerCase()
    : `${player.name || ""} ${pos || ""}`.toLowerCase();
  if (!textTerms.every((t) => fields.includes(t))) return false;
  if (!ageFilters.length) return true;
  const age = /^\d+$/.test(String(player.age)) ? parseInt(player.age, 10) : null;
  if (age == null) return false;
  for (const [op, num] of ageFilters) {
    if (op === ">" && !(age > num)) return false;
    if (op === "<" && !(age < num)) return false;
    if (op === ">=" && !(age >= num)) return false;
    if (op === "<=" && !(age <= num)) return false;
    if (op === "=" && !(age === num)) return false;
  }
  return true;
}
