/**
 * Parse StatsPlus / OOTP Team List.html exports for standings + park factors.
 * Join key: Abbr ↔ player ORG.
 */
import { parseNumber } from "./player_analytics.js";

const PARK_FACTOR_COLUMNS = [
  "PF",
  "PF AVG",
  "AVG L",
  "AVG R",
  "PF HR",
  "HR L",
  "HR R",
  "PF D",
  "PF T",
];

function cellText(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(row, ...keys) {
  const keyMap = {};
  for (const k of Object.keys(row || {})) {
    keyMap[String(k).trim().toLowerCase()] = k;
  }
  for (const want of keys) {
    const real = keyMap[String(want).trim().toLowerCase()];
    if (real != null && row[real] != null && String(row[real]).trim() !== "") {
      return String(row[real]).trim();
    }
  }
  return "";
}

/**
 * @param {string} html
 * @returns {{ teams: object[], skippedRows: number }}
 */
export function parseTeamListHtml(html) {
  const tableMatch = String(html || "").match(/<table[^>]*class="[^"]*data[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error("No data table found in Team List HTML");
  }
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

  let bodyHtml = tableHtml;
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (tbodyMatch) bodyHtml = tbodyMatch[1];
  else bodyHtml = tableHtml.replace(/<tr[^>]*>[\s\S]*?<\/tr>/i, "");

  const teams = [];
  let skippedRows = 0;
  for (const rowMatch of bodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      cellText(m[1]),
    );
    if (cells.length !== headers.length) {
      skippedRows += 1;
      continue;
    }
    const raw = {};
    for (let i = 0; i < headers.length; i++) raw[headers[i]] = cells[i];

    const abbr = pick(raw, "Abbr", "ORG", "Team", "Tm");
    if (!abbr) {
      skippedRows += 1;
      continue;
    }

    const team = {
      abbr,
      name: pick(raw, "Team Name", "Name", "Team") || abbr,
      park: pick(raw, "Park", "Stadium"),
      div: pick(raw, "DIV", "Division"),
      lg: pick(raw, "LG", "League"),
      w: pick(raw, "W"),
      l: pick(raw, "L"),
      win_pct: pick(raw, "%", "PCT", "Win%"),
      gb: pick(raw, "GB"),
      ly_w: pick(raw, "lyW"),
      ly_l: pick(raw, "lyL"),
      ly_pct: pick(raw, "ly%"),
      pf: {},
    };

    for (const col of PARK_FACTOR_COLUMNS) {
      if (raw[col] != null && String(raw[col]).trim() !== "") {
        team.pf[col] = parseNumber(raw[col]);
      }
    }

    teams.push(team);
  }

  return { teams, skippedRows };
}

/** Map Abbr → team row for joins with player ORG. */
export function teamListByAbbr(teamList) {
  const map = new Map();
  for (const t of teamList || []) {
    if (t?.abbr) map.set(String(t.abbr).toUpperCase(), t);
  }
  return map;
}
