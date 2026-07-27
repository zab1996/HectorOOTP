import { deepClone } from "./util.js";
import { calculateScore } from "./pitchers.js";
import { calculateBatterScore } from "./batters.js";
import { defaultPitcherWeights, defaultBatterWeights } from "./weights.js";

export const PITCHER_POSITIONS = new Set(["P", "SP", "RP", "CL"]);
export const BATTER_POSITIONS = new Set(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]);

export const REQUIRED_PITCHER_FIELDS = [
  "Name", "ORG", "POS", "Age", "T", "Prone", "SctAcc", "Nat. Pop.", "Loc. Pop.", "Type",
  "STU", "MOV", "CON", "STU P", "MOV P", "CON P",
  "PIT", "VELO", "STM", "G/F", "OVR", "POT",
  "FB", "CH", "CB", "SL", "SI", "SP", "CT", "FO", "CC", "SC", "KC", "KN",
  "FBP", "CHP", "CBP", "SLP", "SIP", "SPP", "CTP", "FOP", "CCP", "SCP", "KCP", "KNP",
];

export const REQUIRED_BATTER_FIELDS = [
  "Name", "ORG", "POS", "Age", "B", "Prone", "SctAcc", "Nat. Pop.", "Loc. Pop.", "Type", "OVR", "POT",
  "CON", "GAP", "POW", "EYE", "K's", "CON P", "GAP P", "POW P", "EYE P", "K P",
  "C ABI", "C ARM", "C FRM", "IF RNG", "IF ERR", "IF ARM", "TDP",
  "OF RNG", "OF ERR", "OF ARM", "SPE", "STE", "RUN",
  "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF",
];

export function disambiguateHeaders(headers) {
  const processed = [];
  let conSeen = 0;
  let conPSeen = 0;
  let bbPctSeen = 0;
  let soPctSeen = 0;
  let gSeen = 0;
  let hldSeen = 0;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const prev = i > 0 ? headers[i - 1] : "";
    const next = i + 1 < headers.length ? headers[i + 1] : "";
    if (header === "WAR") {
      // Batter WAR sits after wRC+; pitcher WAR after ERA+/FIP/FIP- or before rWAR
      if (prev === "wRC+") processed.push("WAR (Batter)");
      else if (prev === "ERA+" || prev === "FIP" || prev === "FIP-" || next === "rWAR") {
        processed.push("WAR (Pitcher)");
      } else processed.push(header);
    } else if (header === "G") {
      // Combined exports often have batting G (near HR/RBI) and pitching G (near IP/W/SV).
      // Without renaming, the second overwrites the first — batters show 0 except two-way players.
      gSeen += 1;
      const battingCtx =
        ["RUN", "STE", "SPE", "RF", "CF", "LF", "DH"].includes(prev) ||
        ["HR", "RBI", "BB%", "SB", "R", "PA", "AB"].includes(next);
      const pitchingCtx =
        ["W", "L", "SV", "HLD", "BS", "SD", "QS", "HOLD"].includes(prev) ||
        ["GS", "GF", "IP", "ERA", "ERA+", "W", "SV", "HLD"].includes(next);
      if (battingCtx && !pitchingCtx) processed.push("G (Batter)");
      else if (pitchingCtx && !battingCtx) processed.push("G (Pitcher)");
      else if (gSeen >= 2) processed.push("G (Pitcher)");
      else processed.push("G (Batter)");
    } else if (header === "HLD") {
      // Combined exports: Hold Runners rating (near G/F/STM) then Holds counting (near SV/IP).
      // Without renaming, Holds overwrites Hold Runners → everyone shows 0 on Ratings.
      hldSeen += 1;
      const ratingCtx =
        ["G/F", "STM", "VELO", "PIT", "SctAcc"].includes(prev) ||
        ["C ABI", "C FRM", "C ARM", "IF RNG", "DEF", "SPE"].includes(next);
      const statsCtx =
        ["W", "L", "SV", "BS", "SD", "QS", "HOLD"].includes(prev) ||
        ["SD", "IP", "GS", "GF", "ERA", "ERA+", "BS", "HR/9"].includes(next);
      if (ratingCtx && !statsCtx) processed.push("HLD");
      else if (statsCtx && !ratingCtx) processed.push("HLD (Stat)");
      else if (hldSeen >= 2) processed.push("HLD (Stat)");
      else processed.push("HLD");
    } else if (header === "BB%") {
      bbPctSeen += 1;
      // Batter BB% sits with AVG/OBP (OOTP 27: next is often K%, formerly SO%).
      // Pitcher BB% sits after K%/K/9 — do not treat next=K% alone as pitching
      // (that is the batter K% column in combined OOTP 27 lists).
      const battingCtx =
        ["RBI", "HR", "G", "SB", "R"].includes(prev) ||
        ["SO%", "K%", "AVG", "OBP"].includes(next);
      const pitchingCtx =
        ["BB/9", "K/9", "K%", "HR/9", "ERA", "ERA+", "IP", "WHIP", "pLi"].includes(prev) ||
        ["HR/9", "K/9", "WHIP", "ERA+", "FIP", "FIP-", "pLi", "RSG"].includes(next);
      if (battingCtx && !pitchingCtx) processed.push("BB% (Batter)");
      else if (pitchingCtx && !battingCtx) processed.push("BB% (Pitcher)");
      else if (battingCtx && pitchingCtx) {
        processed.push(
          ["SO%", "K%", "AVG", "OBP"].includes(next) ? "BB% (Batter)" : "BB% (Pitcher)",
        );
      } else if (bbPctSeen >= 2) processed.push("BB% (Pitcher)");
      else processed.push("BB% (Batter)");
    } else if (header === "SO%" || header === "K%") {
      // OOTP 27 renamed batter SO% → K%. Map batting-context K% to SO% (Batter)
      // so scoring/UI keep the same internal key; pitcher K% stays K%.
      soPctSeen += 1;
      const battingCtx =
        ["BB%", "BB% (Batter)", "RBI", "HR"].includes(prev) || ["AVG", "OBP"].includes(next);
      const pitchingCtx =
        ["K/9", "BB/9", "HR/9"].includes(prev) ||
        ["BB%", "BB/9", "K/9", "HR/9", "WHIP", "ERA+", "pLi", "BB% (Pitcher)"].includes(next);
      if (battingCtx && !pitchingCtx) {
        processed.push("SO% (Batter)");
      } else if (pitchingCtx && !battingCtx) {
        processed.push(header === "SO%" ? "SO% (Pitcher)" : "K%");
      } else if (battingCtx && pitchingCtx) {
        processed.push(
          ["AVG", "OBP"].includes(next)
            ? "SO% (Batter)"
            : header === "SO%"
              ? "SO% (Pitcher)"
              : "K%",
        );
      } else if (soPctSeen >= 2) {
        processed.push(header === "SO%" ? "SO% (Pitcher)" : "K%");
      } else if (header === "K%") {
        // Ambiguous first K%: prefer pitcher K% only when clearly pitching neighbors;
        // otherwise treat as batter SO% for OOTP 27 combined lists.
        processed.push("SO% (Batter)");
      } else {
        processed.push("SO% (Batter)");
      }
    } else if (header === "CON") {
      if (conSeen === 0) {
        processed.push("CON");
        conSeen += 1;
      } else {
        processed.push("CON (Pitcher)");
        conSeen += 1;
      }
    } else if (header === "CON P") {
      if (conPSeen === 0) {
        processed.push("CON P");
        conPSeen += 1;
      } else {
        processed.push("CON P (Pitcher)");
        conPSeen += 1;
      }
    } else {
      processed.push(header);
    }
  }
  return processed;
}

export function normalizePitcherControlKeys(player) {
  const out = { ...player };
  if ("CON (Pitcher)" in out) {
    out.CON = out["CON (Pitcher)"];
    if ("CON P (Pitcher)" in out) out["CON P"] = out["CON P (Pitcher)"];
  }
  return out;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ""));
}

/** Normalize header labels before disambiguation (HTML entities, aliases). */
export function normalizeHeaders(headers) {
  return headers.map((h) => {
    let s = decodeEntities(String(h ?? ""));
    if (s === "Games" || s === "GP") s = "G";
    return s;
  });
}

/**
 * After parse: alias leftover entity keys and promote plain BB%/SO%/K% to batter keys
 * when batting context is present (combined player lists).
 */
export function normalizePlayerStatKeys(player) {
  const p = { ...player };
  if ("BB&#37;" in p && !("BB%" in p) && !("BB% (Batter)" in p)) p["BB%"] = p["BB&#37;"];
  if ("SO&#37;" in p && !("SO%" in p) && !("SO% (Batter)" in p)) p["SO%"] = p["SO&#37;"];
  if ("K&#37;" in p && !("K%" in p) && !("SO% (Batter)" in p)) p["K%"] = p["K&#37;"];
  if (!("BB% (Batter)" in p) && !("BB% (Pitcher)" in p) && "BB%" in p && ("AVG" in p || "wRC+" in p || "OBP" in p)) {
    p["BB% (Batter)"] = p["BB%"];
  }
  if (!("SO% (Batter)" in p) && !("SO% (Pitcher)" in p) && "SO%" in p && ("AVG" in p || "wRC+" in p || "OBP" in p)) {
    p["SO% (Batter)"] = p["SO%"];
  }
  // OOTP 27 batter K% — only promote when we do not already have pitcher K% + no batter SO%
  if (
    !("SO% (Batter)" in p) &&
    !("SO% (Pitcher)" in p) &&
    "K%" in p &&
    ("AVG" in p || "wRC+" in p || "OBP" in p) &&
    !("BB% (Pitcher)" in p && "K/9" in p && !("RBI" in p))
  ) {
    // Prefer explicit batter context; avoid stealing the only K% when it is clearly pitcher-only
    if ("RBI" in p || "HR" in p || "BB% (Batter)" in p || "BB%" in p) {
      p["SO% (Batter)"] = p["K%"];
    }
  }
  if ((!p.G || String(p.G).trim() === "" || String(p.G).trim() === "-" || Number(p.G) === 0) && p.Games) {
    p.G = p.Games;
  }
  if ((!p.G || String(p.G).trim() === "" || String(p.G).trim() === "-" || Number(p.G) === 0) && p.GP) {
    p.G = p.GP;
  }
  // Keep a plain G alias for batter games when only the disambiguated key exists
  if (!("G" in p) && "G (Batter)" in p) p.G = p["G (Batter)"];
  if (
    "G (Batter)" in p &&
    "G (Pitcher)" in p &&
    (p.G === p["G (Pitcher)"] || Number(p.G) === 0 || p.G == null || String(p.G).trim() === "")
  ) {
    p.G = p["G (Batter)"];
  }
  return p;
}

/** Parse Player List HTML (browser DOMParser or Node regex fallback). */
export function parsePlayersFromHtml(html) {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table.data");
    if (!table) throw new Error("No table with class 'data' found in HTML");
    const thead = table.querySelector("thead");
    const headerRow = thead ? thead.querySelector("tr") : table.querySelector("tr");
    if (!headerRow) throw new Error("No header row found in the table");
    const headers = normalizeHeaders(
      [...headerRow.querySelectorAll("th")].map((th) => th.textContent.trim())
    );
    const processed = disambiguateHeaders(headers);
    const tbody = table.querySelector("tbody");
    const rows = tbody
      ? [...tbody.querySelectorAll("tr")]
      : [...table.querySelectorAll("tr")].slice(1);
    const players = [];
    let skippedRows = 0;
    for (const row of rows) {
      const cells = [...row.querySelectorAll("td")];
      if (cells.length !== processed.length) {
        skippedRows += 1;
        continue;
      }
      const player = {};
      for (let i = 0; i < processed.length; i++) {
        player[processed[i]] = cells[i].textContent.trim();
      }
      players.push(normalizePlayerStatKeys(player));
    }
    return { players, skippedRows };
  }

  // Node / no DOM: regex table parser
  const tableMatch = html.match(/<table[^>]*class=["'][^"']*\bdata\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) throw new Error("No table with class 'data' found in HTML");
  const tableHtml = tableMatch[1];
  const theadMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  let headerChunk;
  if (theadMatch) {
    headerChunk = theadMatch[1];
  } else {
    const firstTr = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    headerChunk = firstTr ? firstTr[1] : "";
  }
  const headers = normalizeHeaders(
    [...headerChunk.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => cellText(m[1]))
  );
  if (!headers.length) throw new Error("No header row found in the table");
  const processed = disambiguateHeaders(headers);

  let bodyHtml = tableHtml;
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (tbodyMatch) bodyHtml = tbodyMatch[1];
  else {
    // skip first tr (header)
    bodyHtml = tableHtml.replace(/<tr[^>]*>[\s\S]*?<\/tr>/i, "");
  }

  const players = [];
  let skippedRows = 0;
  for (const rowMatch of bodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cellText(m[1]));
    if (cells.length !== processed.length) {
      skippedRows += 1;
      continue;
    }
    const player = {};
    for (let i = 0; i < processed.length; i++) player[processed[i]] = cells[i];
    players.push(normalizePlayerStatKeys(player));
  }
  return { players, skippedRows };
}

export function splitPlayersByType(players) {
  const pitchers = [];
  const batters = [];
  for (const player of players) {
    const pos = String(player.POS || "").trim().toUpperCase();
    if (PITCHER_POSITIONS.has(pos)) pitchers.push(normalizePitcherControlKeys(player));
    else if (BATTER_POSITIONS.has(pos)) batters.push(player);
  }
  return { pitchers, batters };
}

export function validateFields(players, requiredFields) {
  const missing = new Set();
  for (const player of players) {
    for (const field of requiredFields) {
      if (!(field in player) || player[field] === null || player[field] === "") {
        missing.add(field);
      }
    }
  }
  return missing;
}

export function detectWrongImport(players, validPositions, wrongPositions) {
  const seen = new Set();
  for (const p of players) {
    const pos = String(p.POS || "").toUpperCase();
    if (pos) seen.add(pos);
  }
  if (!seen.size) return false;
  for (const p of seen) {
    if (!wrongPositions.has(p)) return false;
  }
  for (const p of seen) {
    if (validPositions.has(p)) return false;
  }
  return true;
}

/** Draft-tab default meta (Options meta stay at 1.0). */
export const DRAFT_META_CURRENT = 0.9;
export const DRAFT_META_POTENTIAL = 1.5;

/**
 * Map a bias in [-1, 1] to draft current/potential metas.
 * -1 = current-heavy (swap defaults), 0 = draft default (0.9 / 1.5), +1 = potential-heavy.
 */
export function draftMetaFromBias(bias = 0) {
  const b = Math.max(-1, Math.min(1, Number(bias) || 0));
  const span = DRAFT_META_POTENTIAL - DRAFT_META_CURRENT;
  return {
    current: Math.round((DRAFT_META_CURRENT - b * span) * 100) / 100,
    potential: Math.round((DRAFT_META_POTENTIAL + b * span) * 100) / 100,
  };
}

function resolveDraftMeta(draftMode, draftMeta) {
  if (!draftMode) return null;
  if (draftMeta && Number.isFinite(draftMeta.current) && Number.isFinite(draftMeta.potential)) {
    return { current: draftMeta.current, potential: draftMeta.potential };
  }
  return { current: DRAFT_META_CURRENT, potential: DRAFT_META_POTENTIAL };
}

export function getPitcherWeights(draftMode = false, baseWeights = null, draftMeta = null) {
  const defaults = defaultPitcherWeights();
  const weights = deepClone(baseWeights ?? defaults);
  weights.penalties = { ...defaults.penalties, ...(weights.penalties || {}) };
  const meta = resolveDraftMeta(draftMode, draftMeta);
  if (meta) {
    weights.meta.core_attributes = meta.current;
    weights.meta.core_potentials = meta.potential;
  }
  return weights;
}

export function getBatterWeights(draftMode = false, baseWeights = null, draftMeta = null) {
  const weights = deepClone(baseWeights ?? defaultBatterWeights());
  const meta = resolveDraftMeta(draftMode, draftMeta);
  if (meta) {
    weights.meta.overall = meta.current;
    weights.meta.potential = meta.potential;
  }
  return weights;
}

export function scorePlayers(pitchers, batters, {
  draftMode = false,
  draftMeta = null,
  pitcherWeights = null,
  batterWeights = null,
  useStats = false,
  pitcherStatWeights = null,
  batterStatWeights = null,
} = {}) {
  const pWeights = getPitcherWeights(draftMode, pitcherWeights, draftMeta);
  const bWeights = getBatterWeights(draftMode, batterWeights, draftMeta);
  const scoredP = pitchers.map((p) => {
    const row = { ...p };
    row.Scores = calculateScore(row, pWeights, useStats, pitcherStatWeights);
    return row;
  });
  const scoredB = batters.map((b) => {
    const row = { ...b };
    row.Scores = calculateBatterScore(row, bWeights, useStats, batterStatWeights);
    return row;
  });
  scoredP.sort((a, b) => (b.Scores?.total ?? 0) - (a.Scores?.total ?? 0));
  scoredB.sort((a, b) => (b.Scores?.total ?? 0) - (a.Scores?.total ?? 0));
  return { pitchers: scoredP, batters: scoredB };
}

export function loadAndScoreHtml(html, {
  draftMode = false,
  draftMeta = null,
  pitcherWeights = null,
  batterWeights = null,
  useStats = false,
  pitcherStatWeights = null,
  batterStatWeights = null,
} = {}) {
  const { players: allPlayers, skippedRows } = parsePlayersFromHtml(html);
  if (!allPlayers.length) throw new Error("No player data found in HTML");
  const { pitchers, batters } = splitPlayersByType(allPlayers);
  const droppedOtherPos = allPlayers.length - pitchers.length - batters.length;
  if (!pitchers.length && !batters.length) {
    throw new Error("No pitchers or batters found after position split");
  }
  if (detectWrongImport(pitchers, PITCHER_POSITIONS, BATTER_POSITIONS)) {
    throw new Error("Could not find any pitchers. Is this the batter export?");
  }
  if (detectWrongImport(batters, BATTER_POSITIONS, PITCHER_POSITIONS)) {
    throw new Error("Could not find any batters. Is this the pitcher export?");
  }
  const scored = scorePlayers(pitchers, batters, {
    draftMode,
    draftMeta,
    pitcherWeights,
    batterWeights,
    useStats,
    pitcherStatWeights,
    batterStatWeights,
  });
  const warnings = [];
  const mp = validateFields(scored.pitchers, REQUIRED_PITCHER_FIELDS);
  const mb = validateFields(scored.batters, REQUIRED_BATTER_FIELDS);
  if (mp.size) warnings.push("Pitchers missing: " + [...mp].sort().join(", "));
  if (mb.size) warnings.push("Batters missing: " + [...mb].sort().join(", "));
  return {
    pitchers: scored.pitchers,
    batters: scored.batters,
    importStats: {
      rowsParsed: allPlayers.length,
      rowsSkipped: skippedRows,
      pitchers: scored.pitchers.length,
      batters: scored.batters.length,
      droppedOtherPos,
    },
    warnings,
    draft_mode: draftMode,
  };
}
