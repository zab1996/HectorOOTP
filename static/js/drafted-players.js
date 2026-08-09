const POSITION_PREFIX = /^(?:P|SP|RP|CL|C|1B|2B|3B|SS|LF|CF|RF|DH)\s+(.+)$/i;

/** Normalize pasted and exported names without discarding meaningful accents. */
export function normalizeDraftedName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function playerName(player) {
  return String(player?.Name ?? player?.name ?? "").trim();
}

function matchingKey(cell, nameLookup) {
  const trimmed = String(cell ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return "";

  const variants = [trimmed];
  const prefixed = trimmed.match(POSITION_PREFIX);
  if (prefixed) variants.push(prefixed[1].trim());

  for (const variant of variants) {
    const exact = normalizeDraftedName(variant);
    if (nameLookup.has(exact)) return exact;

    // StatsPlus draft logs can append a standalone "A" marker to the player cell.
    const withoutMarker = normalizeDraftedName(variant.replace(/\s+A$/i, ""));
    if (withoutMarker !== exact && nameLookup.has(withoutMarker))
      return withoutMarker;
  }
  return "";
}

/**
 * Match tab-separated draft-log rows to a loaded draft pool.
 * Column counts are deliberately ignored so partial first/last rows still work.
 */
export function parseDraftedPlayers(text, players = []) {
  const nameLookup = new Map();
  for (const player of players) {
    const name = playerName(player);
    const key = normalizeDraftedName(name);
    if (key && !nameLookup.has(key)) nameLookup.set(key, name);
  }

  const matchedKeys = new Set();
  const matchedNames = [];
  const unmatchedLines = [];
  let duplicateCount = 0;

  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let key = "";
    for (const cell of line.split("\t")) {
      key = matchingKey(cell, nameLookup);
      if (key) break;
    }

    if (!key) {
      unmatchedLines.push(line);
    } else if (matchedKeys.has(key)) {
      duplicateCount += 1;
    } else {
      matchedKeys.add(key);
      matchedNames.push(nameLookup.get(key));
    }
  }

  return { matchedKeys, matchedNames, unmatchedLines, duplicateCount };
}
