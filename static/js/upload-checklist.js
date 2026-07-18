/**
 * Upload-tab column checklist: compare export headers to expected Hector fields.
 */
import {
  REQUIRED_PITCHER_FIELDS,
  REQUIRED_BATTER_FIELDS,
  normalizeHeaders,
  disambiguateHeaders,
} from "./hector/parse.js";

function decodeEntities(text) {
  return String(text || "")
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
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, ""));
}

/** @typedef {{ id: string, label: string, keys: string[] }} ExpectedField */

/**
 * OOTP customize-view display names (screenshots 12–17), grouped for instructions.
 * Order matches the export checklist; names are what users see in Customize View.
 */
export const PLAYER_LIST_COLUMN_GROUPS = [
  {
    title: "Identity & ratings",
    columns: [
      "ID",
      "Organization (Short)",
      "Position",
      "Team (Short)",
      "Name",
      "League Level",
      "Age",
      "Bats (Short)",
      "Throws (Short)",
      "Overall",
      "Potential",
      "Injury Prone",
      "National Popularity",
      "Local Popularity",
      "Personality",
      "Contact",
      "Gap Power",
      "Power",
      "Eye",
      "Avoid K's",
      "Contact Pot.",
      "Gap Pot.",
      "Power Pot.",
      "Eye Pot.",
      "K's Pot.",
      "Stuff",
      "Movement",
      "Control",
      "Stuff Potential",
      "Movement Potential",
      "Control Potential",
    ],
  },
  {
    title: "Pitch arsenal & traits",
    columns: [
      "Fastball",
      "Fastball Potential",
      "Changeup",
      "Changeup Potential",
      "Curveball",
      "Curveball Potential",
      "Slider",
      "Slider Potential",
      "Sinker",
      "Sinker Potential",
      "Splitter",
      "Splitter Potential",
      "Cutter",
      "Cutter Potential",
      "Forkball",
      "Forkball Potential",
      "Circle Change",
      "Circle Change Potential",
      "Screwball",
      "Screwball Potential",
      "Knuckle Curve",
      "Knuckle Curve Potential",
      "Knuckleball",
      "Knuckleball Potential",
      "Pitches",
      "Velocity",
      "Stamina",
      "Ground/Fly",
      "Hold",
    ],
  },
  {
    title: "Defense & baserunning",
    columns: [
      "Catcher Blocking",
      "Catcher Framing",
      "Catcher Arm",
      "Infield Range",
      "Infield Error",
      "Infield Arm",
      "Turn DP",
      "Outfield Range",
      "Outfield Error",
      "Outfield Arm",
      "Fielding at Primary Pos",
      "Fielding at C",
      "Fielding at 1B",
      "Fielding at 2B",
      "Fielding at 3B",
      "Fielding at SS",
      "Fielding at LF",
      "Fielding at CF",
      "Fielding at RF",
      "Speed",
      "Stealing Ability",
      "Baserunning",
    ],
  },
  {
    title: "Batter stats",
    columns: [
      "G",
      "HR",
      "RBI",
      "BB%",
      "SO%",
      "AVG",
      "OBP",
      "SLG",
      "ISO",
      "wOBA",
      "OPS",
      "OPS+",
      "BABIP",
      "wRC+",
      "WAR",
      "SB",
      "CS",
      "UBR",
    ],
  },
  {
    title: "Pitcher stats",
    columns: [
      "G",
      "W",
      "SV",
      "BS",
      "HLD",
      "IP",
      "HR/9",
      "BB/9",
      "K/9",
      "K%",
      "BB%",
      "pLi",
      "ERA+",
      "FIP",
      "FIP-",
      "WAR",
      "rWAR",
      "SIERA",
    ],
  },
  {
    title: "Fielding stats & contract",
    columns: [
      "E",
      "ZR",
      "CERA",
      "Salary",
      "Years left",
      "Contract Value",
      "Total Years",
      "Extension Value",
      "Extension Years",
      "Scout Acc",
    ],
  },
];

/** Extra stats / contract keys beyond REQUIRED_* that the recommended export includes. */
const EXTRA_PLAYER_FIELDS = [
  { id: "ID", label: "ID", keys: ["ID"] },
  { id: "TM", label: "Team (Short)", keys: ["TM", "Team"] },
  { id: "Lev", label: "League Level", keys: ["Lev", "Level"] },
  { id: "G_B", label: "G (Batter)", keys: ["G (Batter)", "G"] },
  { id: "G_P", label: "G (Pitcher)", keys: ["G (Pitcher)"] },
  { id: "HR", label: "HR", keys: ["HR"] },
  { id: "RBI", label: "RBI", keys: ["RBI"] },
  { id: "BB_B", label: "BB% (Batter)", keys: ["BB% (Batter)", "BB%"] },
  { id: "SO_B", label: "SO% (Batter)", keys: ["SO% (Batter)", "SO%"] },
  { id: "AVG", label: "AVG", keys: ["AVG"] },
  { id: "OBP", label: "OBP", keys: ["OBP"] },
  { id: "SLG", label: "SLG", keys: ["SLG"] },
  { id: "ISO", label: "ISO", keys: ["ISO"] },
  { id: "wOBA", label: "wOBA", keys: ["wOBA"] },
  { id: "OPS", label: "OPS", keys: ["OPS"] },
  { id: "OPS+", label: "OPS+", keys: ["OPS+"] },
  { id: "BABIP", label: "BABIP", keys: ["BABIP"] },
  { id: "wRC+", label: "wRC+", keys: ["wRC+"] },
  { id: "WAR_B", label: "WAR (Batter)", keys: ["WAR (Batter)", "WAR"] },
  { id: "SB", label: "SB", keys: ["SB"] },
  { id: "CS", label: "CS", keys: ["CS"] },
  { id: "UBR", label: "UBR", keys: ["UBR"] },
  { id: "W", label: "W", keys: ["W"] },
  { id: "SV", label: "SV", keys: ["SV"] },
  { id: "BS", label: "BS", keys: ["BS"] },
  { id: "HLD_S", label: "HLD (Stat)", keys: ["HLD (Stat)"] },
  { id: "IP", label: "IP", keys: ["IP"] },
  { id: "HR/9", label: "HR/9", keys: ["HR/9"] },
  { id: "BB/9", label: "BB/9", keys: ["BB/9"] },
  { id: "K/9", label: "K/9", keys: ["K/9"] },
  { id: "K%", label: "K%", keys: ["K%"] },
  { id: "BB_P", label: "BB% (Pitcher)", keys: ["BB% (Pitcher)"] },
  { id: "pLi", label: "pLi", keys: ["pLi"] },
  { id: "ERA+", label: "ERA+", keys: ["ERA+"] },
  { id: "FIP", label: "FIP", keys: ["FIP"] },
  { id: "FIP-", label: "FIP-", keys: ["FIP-"] },
  { id: "WAR_P", label: "WAR (Pitcher)", keys: ["WAR (Pitcher)"] },
  { id: "rWAR", label: "rWAR", keys: ["rWAR"] },
  { id: "SIERA", label: "SIERA", keys: ["SIERA"] },
  { id: "E", label: "E", keys: ["E"] },
  { id: "ZR", label: "ZR", keys: ["ZR"] },
  { id: "CERA", label: "CERA", keys: ["CERA"] },
  { id: "SLR", label: "Salary (SLR)", keys: ["SLR", "Salary"] },
  { id: "Yrs", label: "Years left (YL)", keys: ["YL", "Yrs", "Years left", "Years Left"] },
  { id: "CV", label: "Contract Value (CV)", keys: ["CV", "Contract Value"] },
  { id: "TY", label: "Total Years (TY)", keys: ["TY", "Total Years"] },
  { id: "EV", label: "Extension Value (ECV)", keys: ["ECV", "EV", "Extension Value", "Extension Contract Value"] },
  { id: "EY", label: "Extension Years (ETY)", keys: ["ETY", "EY", "Extension Years", "Extension Total Years"] },
];

const LABEL_OVERRIDES = {
  ORG: "Organization (Short)",
  POS: "Position",
  TM: "Team (Short)",
  Lev: "League Level",
  B: "Bats (Short)",
  T: "Throws (Short)",
  OVR: "Overall",
  POT: "Potential",
  Prone: "Injury Prone",
  SctAcc: "Scout Acc",
  "Nat. Pop.": "National Popularity",
  "Loc. Pop.": "Local Popularity",
  Type: "Personality",
  CON: "Contact / Control",
  GAP: "Gap Power",
  POW: "Power",
  EYE: "Eye",
  "K's": "Avoid K's",
  "CON P": "Contact Pot.",
  "GAP P": "Gap Pot.",
  "POW P": "Power Pot.",
  "EYE P": "Eye Pot.",
  "K P": "K's Pot.",
  STU: "Stuff",
  MOV: "Movement",
  "STU P": "Stuff Potential",
  "MOV P": "Movement Potential",
  "CON P (Pitcher)": "Control Potential",
  PIT: "Pitches",
  VELO: "Velocity",
  STM: "Stamina",
  "G/F": "Ground/Fly",
  HLD: "Hold",
  "C ABI": "Catcher Blocking",
  "C FRM": "Catcher Framing",
  "C ARM": "Catcher Arm",
  "IF RNG": "Infield Range",
  "IF ERR": "Infield Error",
  "IF ARM": "Infield Arm",
  TDP: "Turn DP",
  "OF RNG": "Outfield Range",
  "OF ERR": "Outfield Error",
  "OF ARM": "Outfield Arm",
  SPE: "Speed",
  STE: "Stealing Ability",
  RUN: "Baserunning",
  FB: "Fastball",
  FBP: "Fastball Potential",
  CH: "Changeup",
  CHP: "Changeup Potential",
  CB: "Curveball",
  CBP: "Curveball Potential",
  SL: "Slider",
  SLP: "Slider Potential",
  SI: "Sinker",
  SIP: "Sinker Potential",
  SP: "Splitter",
  SPP: "Splitter Potential",
  CT: "Cutter",
  CTP: "Cutter Potential",
  FO: "Forkball",
  FOP: "Forkball Potential",
  CC: "Circle Change",
  CCP: "Circle Change Potential",
  SC: "Screwball",
  SCP: "Screwball Potential",
  KC: "Knuckle Curve",
  KCP: "Knuckle Curve Potential",
  KN: "Knuckleball",
  KNP: "Knuckleball Potential",
};

/** @type {ExpectedField[]} */
export const EXPECTED_PLAYER_LIST = (() => {
  const byId = new Map();
  function add(id, label, keys) {
    if (byId.has(id)) return;
    byId.set(id, { id, label, keys: [...keys] });
  }
  for (const k of REQUIRED_BATTER_FIELDS) {
    add(k, LABEL_OVERRIDES[k] || k, [k]);
  }
  for (const k of REQUIRED_PITCHER_FIELDS) {
    add(k, LABEL_OVERRIDES[k] || k, [k]);
  }
  for (const f of EXTRA_PLAYER_FIELDS) {
    add(f.id, f.label, f.keys);
  }
  return [...byId.values()];
})();

/** @type {ExpectedField[]} */
export const EXPECTED_TEAM_LIST = [
  { id: "Abbr", label: "Abbr", keys: ["Abbr", "ORG", "Team", "Tm"] },
  { id: "DIV", label: "DIV", keys: ["DIV", "Division"] },
  { id: "W", label: "W", keys: ["W"] },
  { id: "L", label: "L", keys: ["L"] },
  { id: "PCT", label: "%", keys: ["%", "PCT", "Win%"] },
  { id: "Park", label: "Park", keys: ["Park", "Stadium"] },
  { id: "PF", label: "PF", keys: ["PF"] },
  { id: "PF AVG", label: "PF AVG", keys: ["PF AVG"] },
  { id: "AVG L", label: "AVG L", keys: ["AVG L"] },
  { id: "AVG R", label: "AVG R", keys: ["AVG R"] },
  { id: "PF HR", label: "PF HR", keys: ["PF HR"] },
  { id: "HR L", label: "HR L", keys: ["HR L"] },
  { id: "HR R", label: "HR R", keys: ["HR R"] },
  { id: "PF D", label: "PF D", keys: ["PF D"] },
  { id: "PF T", label: "PF T", keys: ["PF T"] },
  { id: "lyW", label: "lyW", keys: ["lyW"] },
  { id: "lyL", label: "lyL", keys: ["lyL"] },
  { id: "ly%", label: "ly%", keys: ["ly%"] },
];

/**
 * Extract disambiguated Player List / Draft Class headers (no row parse).
 * @param {string} html
 * @returns {string[]}
 */
export function parsePlayerListHeaders(html) {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table.data");
    if (!table) throw new Error("No table with class 'data' found in HTML");
    const thead = table.querySelector("thead");
    const headerRow = thead ? thead.querySelector("tr") : table.querySelector("tr");
    if (!headerRow) throw new Error("No header row found in the table");
    const headers = normalizeHeaders(
      [...headerRow.querySelectorAll("th")].map((th) => th.textContent.trim()),
    );
    return disambiguateHeaders(headers);
  }

  const tableMatch = String(html || "").match(
    /<table[^>]*class=["'][^"']*\bdata\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) throw new Error("No table with class 'data' found in HTML");
  const tableHtml = tableMatch[1];
  const theadMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  let headerChunk;
  if (theadMatch) headerChunk = theadMatch[1];
  else {
    const firstTr = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    headerChunk = firstTr ? firstTr[1] : "";
  }
  const headers = normalizeHeaders(
    [...headerChunk.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => cellText(m[1])),
  );
  if (!headers.length) throw new Error("No header row found in the table");
  return disambiguateHeaders(headers);
}

/**
 * @param {string} html
 * @returns {string[]}
 */
export function parseTeamListHeaders(html) {
  const tableMatch = String(html || "").match(
    /<table[^>]*class="[^"]*data[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) throw new Error("No data table found in Team List HTML");
  const tableHtml = tableMatch[1];
  const theadMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  const headerRowHtml = theadMatch
    ? theadMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i)?.[1]
    : tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i)?.[1];
  if (!headerRowHtml) throw new Error("No header row in Team List");
  const headers = [...headerRowHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
    cellText(m[1]),
  );
  if (!headers.length) throw new Error("No Team List columns found");
  return headers;
}

/**
 * @param {string[]} headers
 * @param {ExpectedField[]} expected
 */
function compareHeaders(headers, expected) {
  const set = new Set(headers.map((h) => String(h).trim()));
  const found = [];
  const missing = [];
  for (const field of expected) {
    const ok = field.keys.some((k) => set.has(k));
    if (ok) found.push(field);
    else missing.push(field);
  }
  return {
    headers,
    found,
    missing,
    foundCount: found.length,
    total: expected.length,
    complete: missing.length === 0,
  };
}

/** @param {string} html */
export function checkPlayerListHtml(html) {
  const headers = parsePlayerListHeaders(html);
  return compareHeaders(headers, EXPECTED_PLAYER_LIST);
}

/** @param {string} html */
export function checkTeamListHtml(html) {
  const headers = parseTeamListHeaders(html);
  // Case-insensitive match for team list
  const lowerMap = new Map(headers.map((h) => [h.toLowerCase(), h]));
  const found = [];
  const missing = [];
  for (const field of EXPECTED_TEAM_LIST) {
    const ok = field.keys.some((k) => lowerMap.has(k.toLowerCase()));
    if (ok) found.push(field);
    else missing.push(field);
  }
  return {
    headers,
    found,
    missing,
    foundCount: found.length,
    total: EXPECTED_TEAM_LIST.length,
    complete: missing.length === 0,
  };
}

/**
 * Render status HTML for an upload field-check region.
 * @param {ReturnType<typeof checkPlayerListHtml> | null} result
 * @param {string} [error]
 */
export function fieldCheckHtml(result, error) {
  if (error) {
    return `<p class="upload-field-check upload-field-check-error">Could not read columns: ${escapeHtml(error)}</p>`;
  }
  if (!result) {
    return `<p class="upload-field-check muted">Choose a file to check columns.</p>`;
  }
  const cls = result.complete ? "upload-field-check-ok" : "upload-field-check-warn";
  const summary = `${result.foundCount} / ${result.total} expected fields found`;
  if (result.complete) {
    return `<div class="upload-field-check ${cls}"><strong>${escapeHtml(summary)}</strong> — all set.</div>`;
  }
  const miss = result.missing
    .slice(0, 24)
    .map((f) => `<span class="upload-missing-chip">${escapeHtml(f.label)}</span>`)
    .join("");
  const more =
    result.missing.length > 24
      ? `<span class="muted">+${result.missing.length - 24} more</span>`
      : "";
  return `<div class="upload-field-check ${cls}">
    <strong>${escapeHtml(summary)}</strong>
    <p class="upload-missing-label">Missing:</p>
    <div class="upload-missing-list">${miss}${more}</div>
  </div>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
