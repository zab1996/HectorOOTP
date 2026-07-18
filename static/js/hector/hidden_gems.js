/** Hidden Gems finders — 20–80 current ratings only (no OVR/POT / star-scale in calcs). */

import { getAge, parseNumber } from "./player_analytics.js";
import { isMajorLeague } from "./league.js";
import { teamListByAbbr } from "./team_list.js";
import { primaryPos, salaryGroupKeyDetail } from "./team_salary.js";

export const PITCH_KEYS = ["FB", "CH", "CB", "SL", "SI", "SP", "CT", "FO", "CC", "SC", "KC", "KN"];

/** Position groups used for AAAA peer matching (SP↔SP, RP↔RP, IF↔IF, OF↔OF, …). */
export const AAAA_POS_GROUPS = ["SP", "RP", "C", "IF", "OF", "DH"];

export const HIDDEN_GEM_CATEGORIES = {
  aaaa: {
    key: "aaaa",
    name: "AAAA Players",
    description: "Minors whose tools match productive majors at the same position group",
    color: "#4dabf7",
  },
  miscast: {
    key: "miscast",
    name: "Miscast Players",
    description: "Good bat, poor defense at premium position (C, SS, CF)",
    color: "#ff922b",
  },
  toolsy: {
    key: "toolsy",
    name: "Toolsy Gambles",
    description: "1–2 elite tools (65+), other ratings mediocre, age ≤27 — minors only",
    color: "#ff6b6b",
  },
  sp_convert: {
    key: "sp_convert",
    name: "Starter Converts",
    description: "SP with low stamina, good stuff/movement, and 3 pitches ≥45 — better as RP",
    color: "#ffd43b",
  },
  rp_convert: {
    key: "rp_convert",
    name: "Reliever Converts",
    description: "RP/CL with starter stamina and 3 pitches ≥45 — candidate to stretch out",
    color: "#e0a060",
  },
  park_nerfed: {
    key: "park_nerfed",
    name: "Park Nerfed",
    description: "MLB players with strong tools suppressed by extreme home park (needs Team List)",
    color: "#69db7c",
  },
};

/**
 * Parse a 20–80-style rating. Star-scale / missing → null (never used in gem calcs).
 * @returns {number | null}
 */
export function gemRating(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "-" || s === "—") return null;
  if (/stars/i.test(s)) return null;
  const n = parseFloat(s.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  // Star scale is typically 1–5; 20–80 tools are almost never below 10
  if (n < 10) return null;
  return n;
}

function meanRatings(values) {
  const ok = values.filter((v) => v != null && Number.isFinite(v));
  if (!ok.length) return null;
  return ok.reduce((a, b) => a + b, 0) / ok.length;
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

function levLabel(player) {
  const lev = String(player?.Lev ?? player?.lev ?? "").trim();
  return !lev || lev === "-" || lev === "—" ? "—" : lev;
}

function baseRow(player, type, category, keyStat, whyHidden, upside, gemFit = 50) {
  return {
    player,
    type,
    category,
    name: String(player.Name || ""),
    team: String(player.ORG || ""),
    pos: String(player.POS || ""),
    primaryPos: primaryPos(player),
    age: getAge(player),
    lev: levLabel(player),
    keyStat,
    whyHidden,
    upside,
    /** 0–100 gem strength for this category only (not archetype Fit %). */
    gemFit: clampFit(gemFit),
  };
}

function clampFit(n) {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** How centered a value sits in [lo, hi] → 55–100 (edge vs mid). */
function bandCenterFit(value, lo, hi) {
  const mid = (lo + hi) / 2;
  const half = Math.max(0.5, (hi - lo) / 2);
  const centered = 1 - Math.min(1, Math.abs(value - mid) / half);
  return 55 + centered * 45;
}

function batterBatTools(player) {
  const con = gemRating(player.CON);
  const pow = gemRating(player.POW);
  const eye = gemRating(player.EYE);
  if (con == null || pow == null || eye == null) return null;
  return { con, pow, eye, avg: (con + pow + eye) / 3 };
}

function pitcherCoreTools(player) {
  const stu = gemRating(player.STU);
  const mov = gemRating(player.MOV);
  const con = gemRating(player["CON (Pitcher)"] ?? player.CON);
  if (stu == null || mov == null || con == null) return null;
  return { stu, mov, con, avg: (stu + mov + con) / 3 };
}

function gamesPlayed(player) {
  return parseNumber(player["G (Batter)"] ?? player.G ?? 0);
}

function inningsPitched(player) {
  return parseNumber(player.IP ?? 0);
}

/** Qualifying pitches: current arsenal grades ≥ min. */
export function pitchesAtLeast(player, min = 45) {
  const hits = [];
  for (const key of PITCH_KEYS) {
    const r = gemRating(player[key]);
    if (r != null && r >= min) hits.push({ key, value: r });
  }
  return hits;
}

function buildAaaaBand(values) {
  const sorted = [...values].filter((v) => v != null).sort((a, b) => a - b);
  if (sorted.length < 3) return null;
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);
  const p90 = percentile(sorted, 90);
  if (p25 == null || p75 == null || p90 == null) return null;
  return { p25, p75, p90, n: sorted.length };
}

/**
 * AAAA: minors matched to productive majors in the same position group
 * (SP, RP, C, IF, OF, DH).
 */
export function findAaaaPlayers(batters, pitchers) {
  /** @type {Record<string, number[]>} */
  const cohortByGroup = Object.fromEntries(AAAA_POS_GROUPS.map((g) => [g, []]));

  for (const b of batters || []) {
    if (isMajorLeague(b) !== true) continue;
    if (parseNumber(b["wRC+"] ?? 0) < 100 || gamesPlayed(b) < 40) continue;
    const group = salaryGroupKeyDetail(b);
    if (!group || !cohortByGroup[group]) continue;
    const tools = batterBatTools(b);
    if (tools) cohortByGroup[group].push(tools.avg);
  }
  for (const p of pitchers || []) {
    if (isMajorLeague(p) !== true) continue;
    if (parseNumber(p["ERA+"] ?? 0) < 100 || inningsPitched(p) < 30) continue;
    const group = salaryGroupKeyDetail(p);
    if (!group || !cohortByGroup[group]) continue;
    const tools = pitcherCoreTools(p);
    if (tools) cohortByGroup[group].push(tools.avg);
  }

  /** @type {Record<string, ReturnType<typeof buildAaaaBand>>} */
  const bands = {};
  for (const g of AAAA_POS_GROUPS) {
    bands[g] = buildAaaaBand(cohortByGroup[g]);
  }

  const results = [];

  function tryMatch(player, type, tools) {
    if (isMajorLeague(player) !== false) return;
    if (!tools) return;
    const group = salaryGroupKeyDetail(player);
    if (!group) return;
    const band = bands[group];
    if (!band) return;
    if (tools.avg < band.p25 || tools.avg > band.p75) return;
    if (tools.avg >= band.p90) return;
    const gemFit = bandCenterFit(tools.avg, band.p25, band.p75);
    results.push(
      baseRow(
        player,
        type,
        "aaaa",
        `Tools ${tools.avg.toFixed(0)} · ${group} ML p25–p75 ${band.p25.toFixed(0)}–${band.p75.toFixed(0)}`,
        `Minors ${group} tools match productive ML ${group} (n=${band.n})`,
        "Could contribute if given a chance",
        gemFit,
      ),
    );
  }

  for (const b of batters || []) tryMatch(b, "batter", batterBatTools(b));
  for (const p of pitchers || []) tryMatch(p, "pitcher", pitcherCoreTools(p));

  return results;
}

function miscastDefTools(player, pos) {
  if (pos === "C") {
    return {
      labels: ["ABI", "ARM", "FRM"],
      values: [gemRating(player["C ABI"]), gemRating(player["C ARM"]), gemRating(player["C FRM"])],
    };
  }
  if (pos === "SS") {
    return {
      labels: ["RNG", "ARM", "ERR"],
      values: [gemRating(player["IF RNG"]), gemRating(player["IF ARM"]), gemRating(player["IF ERR"])],
    };
  }
  if (pos === "CF") {
    return {
      labels: ["RNG", "ARM", "ERR"],
      values: [gemRating(player["OF RNG"]), gemRating(player["OF ARM"]), gemRating(player["OF ERR"])],
    };
  }
  return null;
}

export function findMiscastPlayers(batters) {
  const results = [];
  for (const batter of batters || []) {
    const pos = primaryPos(batter);
    if (pos !== "C" && pos !== "SS" && pos !== "CF") continue;

    const bat = batterBatTools(batter);
    if (!bat || bat.avg < 50) continue;

    const def = miscastDefTools(batter, pos);
    if (!def) continue;
    if (def.values.some((v) => v == null)) continue;
    const defAvg = meanRatings(def.values);
    if (defAvg == null || defAvg >= 40) continue;

    const defSplit = def.labels.map((lab, i) => `${lab} ${def.values[i].toFixed(0)}`).join(" · ");
    const batFit = Math.min(50, ((bat.avg - 50) / 20) * 50);
    const defFit = Math.min(50, ((40 - defAvg) / 20) * 50);
    const gemFit = 40 + batFit + defFit;
    results.push(
      baseRow(
        batter,
        "batter",
        "miscast",
        `Bat ${bat.avg.toFixed(0)} (CON ${bat.con.toFixed(0)} · POW ${bat.pow.toFixed(0)} · EYE ${bat.eye.toFixed(0)}); Def ${defAvg.toFixed(0)} (${defSplit})`,
        `Bat ${bat.avg.toFixed(0)} vs ${pos} def ${defAvg.toFixed(0)}`,
        "Would thrive at DH / corner",
        gemFit,
      ),
    );
  }
  return results;
}

/** Toolsy gambles — confirmed minors only (age ≤27). */
export function findToolsyGambles(batters, pitchers) {
  const results = [];

  function check(player, type, tools, labels) {
    if (isMajorLeague(player) !== false) return;
    const age = getAge(player);
    if (age <= 0 || age > 27) return;
    if (tools.some((t) => t == null)) return;
    const elite = tools.filter((t) => t >= 65);
    const mediocre = tools.filter((t) => t >= 40 && t <= 50);
    if (elite.length < 1 || elite.length > 2) return;
    if (mediocre.length < 1) return;

    const parts = labels.map((lab, i) => `${lab} ${tools[i].toFixed(0)}`);
    const eliteAvg = elite.reduce((a, b) => a + b, 0) / elite.length;
    const gemFit =
      45 +
      (elite.length === 2 ? 20 : 8) +
      Math.min(20, ((eliteAvg - 65) / 15) * 20) +
      Math.min(7, mediocre.length * 3);
    results.push(
      baseRow(
        player,
        type,
        "toolsy",
        parts.join(" · "),
        `${elite.length} elite tool${elite.length > 1 ? "s" : ""}, uneven profile`,
        "Boom-or-bust development bet",
        gemFit,
      ),
    );
  }

  for (const b of batters || []) {
    const con = gemRating(b.CON);
    const pow = gemRating(b.POW);
    const eye = gemRating(b.EYE);
    const spe = gemRating(b.SPE);
    check(b, "batter", [con, pow, eye, spe], ["CON", "POW", "EYE", "SPE"]);
  }
  for (const p of pitchers || []) {
    const stu = gemRating(p.STU);
    const mov = gemRating(p.MOV);
    const con = gemRating(p["CON (Pitcher)"] ?? p.CON);
    check(p, "pitcher", [stu, mov, con], ["STU", "MOV", "CON"]);
  }
  return results;
}

/** SP → RP: low stamina starters with RP stuff and a usable arsenal. */
export function findStarterConverts(pitchers) {
  const results = [];
  for (const pitcher of pitchers || []) {
    if (primaryPos(pitcher) !== "SP") continue;

    const stm = gemRating(pitcher.STM);
    if (stm == null || stm >= 45) continue;

    const stu = gemRating(pitcher.STU);
    const mov = gemRating(pitcher.MOV);
    if ((stu == null || stu < 55) && (mov == null || mov < 55)) continue;

    const goodPitches = pitchesAtLeast(pitcher, 45);
    if (goodPitches.length < 3) continue;

    const bestPitch = (stu ?? 0) >= (mov ?? 0) ? "STU" : "MOV";
    const bestVal = Math.max(stu ?? 0, mov ?? 0);
    const pitchNames = goodPitches
      .slice(0, 5)
      .map((p) => p.key)
      .join("/");
    const stmFit = Math.min(35, ((45 - stm) / 25) * 35);
    const stuffFit = Math.min(35, ((bestVal - 55) / 25) * 35);
    const pitchFit = Math.min(20, (goodPitches.length - 3) * 5 + 10);
    const gemFit = 40 + stmFit + stuffFit + pitchFit;

    results.push(
      baseRow(
        pitcher,
        "pitcher",
        "sp_convert",
        `STM ${stm.toFixed(0)} · ${bestPitch} ${bestVal.toFixed(0)} · ${goodPitches.length} pitches ≥45 (${pitchNames})`,
        "Listed as SP, low stamina",
        "High-leverage reliever potential",
        gemFit,
      ),
    );
  }
  return results;
}

/** RP/CL → SP: relievers with starter stamina and enough pitches to stretch out. */
export function findRelieverConverts(pitchers) {
  const results = [];
  for (const pitcher of pitchers || []) {
    const pos = primaryPos(pitcher);
    if (pos !== "RP" && pos !== "CL") continue;

    const stm = gemRating(pitcher.STM);
    if (stm == null || stm < 50) continue;

    const stu = gemRating(pitcher.STU);
    const mov = gemRating(pitcher.MOV);
    if ((stu == null || stu < 55) && (mov == null || mov < 55)) continue;

    const goodPitches = pitchesAtLeast(pitcher, 45);
    if (goodPitches.length < 3) continue;

    const bestPitch = (stu ?? 0) >= (mov ?? 0) ? "STU" : "MOV";
    const bestVal = Math.max(stu ?? 0, mov ?? 0);
    const pitchNames = goodPitches
      .slice(0, 5)
      .map((p) => p.key)
      .join("/");
    const stmFit = Math.min(35, ((stm - 50) / 30) * 35);
    const stuffFit = Math.min(35, ((bestVal - 55) / 25) * 35);
    const pitchFit = Math.min(20, (goodPitches.length - 3) * 5 + 10);
    const gemFit = 40 + stmFit + stuffFit + pitchFit;

    results.push(
      baseRow(
        pitcher,
        "pitcher",
        "rp_convert",
        `STM ${stm.toFixed(0)} · ${bestPitch} ${bestVal.toFixed(0)} · ${goodPitches.length} pitches ≥45 (${pitchNames})`,
        `Listed as ${pos}, starter-level stamina`,
        "Candidate to stretch out as SP",
        gemFit,
      ),
    );
  }
  return results;
}

/** @deprecated use findStarterConverts */
export const findSpToRpConverts = findStarterConverts;

function parkForOrg(byAbbr, org) {
  if (!byAbbr || !org) return null;
  return byAbbr.get(String(org).trim().toUpperCase()) || null;
}

export function findParkNerfed(batters, pitchers, teamList) {
  const byAbbr = teamListByAbbr(teamList);
  if (!byAbbr.size) return [];
  const results = [];

  for (const b of batters || []) {
    if (isMajorLeague(b) !== true) continue;
    const team = parkForOrg(byAbbr, b.ORG);
    if (!team?.pf) continue;
    const pf = Number(team.pf.PF);
    const pfHr = Number(team.pf["PF HR"]);
    const extreme = (Number.isFinite(pf) && pf < 0.95) || (Number.isFinite(pfHr) && pfHr < 0.9);
    if (!extreme) continue;

    const pow = gemRating(b.POW);
    const con = gemRating(b.CON);
    if ((pow == null || pow < 50) && (con == null || con < 55)) continue;

    const pfNote = [
      Number.isFinite(pf) ? `PF ${pf.toFixed(2)}` : null,
      Number.isFinite(pfHr) ? `PF HR ${pfHr.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const parkExtreme = Math.max(
      Number.isFinite(pf) ? Math.max(0, 0.95 - pf) / 0.15 : 0,
      Number.isFinite(pfHr) ? Math.max(0, 0.9 - pfHr) / 0.2 : 0,
    );
    const toolBest = Math.max(pow ?? 0, con ?? 0);
    const gemFit = 45 + Math.min(30, parkExtreme * 30) + Math.min(25, ((toolBest - 50) / 30) * 25);

    results.push(
      baseRow(
        b,
        "batter",
        "park_nerfed",
        `${pfNote}; POW ${pow != null ? pow.toFixed(0) : "—"} · CON ${con != null ? con.toFixed(0) : "—"}`,
        "Extreme pitcher park suppressing offense",
        "Stats may look better in a neutral/hitter park",
        gemFit,
      ),
    );
  }

  for (const p of pitchers || []) {
    if (isMajorLeague(p) !== true) continue;
    const team = parkForOrg(byAbbr, p.ORG);
    if (!team?.pf) continue;
    const pf = Number(team.pf.PF);
    const pfHr = Number(team.pf["PF HR"]);
    const extreme = (Number.isFinite(pf) && pf > 1.05) || (Number.isFinite(pfHr) && pfHr > 1.1);
    if (!extreme) continue;

    const stu = gemRating(p.STU);
    const mov = gemRating(p.MOV);
    if ((stu == null || stu < 50) && (mov == null || mov < 55)) continue;

    const pfNote = [
      Number.isFinite(pf) ? `PF ${pf.toFixed(2)}` : null,
      Number.isFinite(pfHr) ? `PF HR ${pfHr.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const parkExtreme = Math.max(
      Number.isFinite(pf) ? Math.max(0, pf - 1.05) / 0.2 : 0,
      Number.isFinite(pfHr) ? Math.max(0, pfHr - 1.1) / 0.25 : 0,
    );
    const toolBest = Math.max(stu ?? 0, mov ?? 0);
    const gemFit = 45 + Math.min(30, parkExtreme * 30) + Math.min(25, ((toolBest - 50) / 30) * 25);

    results.push(
      baseRow(
        p,
        "pitcher",
        "park_nerfed",
        `${pfNote}; STU ${stu != null ? stu.toFixed(0) : "—"} · MOV ${mov != null ? mov.toFixed(0) : "—"}`,
        "Extreme hitter park inflating damage",
        "ERA may look better in a pitcher park",
        gemFit,
      ),
    );
  }

  return results;
}

/**
 * @returns {{ byCategory: Record<string, object[]>, all: object[], hasTeamList: boolean }}
 */
export function findAllHiddenGems(batters, pitchers, teamList) {
  const hasTeamList = Array.isArray(teamList) && teamList.length > 0;
  const byCategory = {
    aaaa: findAaaaPlayers(batters, pitchers),
    miscast: findMiscastPlayers(batters),
    toolsy: findToolsyGambles(batters, pitchers),
    sp_convert: findStarterConverts(pitchers),
    rp_convert: findRelieverConverts(pitchers),
    park_nerfed: hasTeamList ? findParkNerfed(batters, pitchers, teamList) : [],
  };
  const all = Object.values(byCategory).flat();
  return { byCategory, all, hasTeamList };
}

export function getHiddenGemsSummary(byCategory) {
  const out = {};
  for (const [key, meta] of Object.entries(HIDDEN_GEM_CATEGORIES)) {
    out[key] = { ...meta, count: (byCategory[key] || []).length };
  }
  return out;
}
