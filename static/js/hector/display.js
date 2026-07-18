import { round2 } from "./util.js";

export function getBatterHighlightTags(b) {
  const tags = [];
  if (b.POS === "1B") {
    const range_ = /^\d+$/.test(String(b["IF RNG"] ?? "0")) ? parseInt(b["IF RNG"], 10) : 0;
    const arm = /^\d+$/.test(String(b["IF ARM"] ?? "0")) ? parseInt(b["IF ARM"], 10) : 0;
    const error = /^\d+$/.test(String(b["IF ERR"] ?? "0")) ? parseInt(b["IF ERR"], 10) : 0;
    if (range_ >= 50 && arm >= 55 && error >= 45) tags.push("hl-1b-to-3b");
  }
  if (b.POS === "2B") {
    const range_ = /^\d+$/.test(String(b["IF RNG"] ?? "0")) ? parseInt(b["IF RNG"], 10) : 0;
    const arm = /^\d+$/.test(String(b["IF ARM"] ?? "0")) ? parseInt(b["IF ARM"], 10) : 0;
    const error = /^\d+$/.test(String(b["IF ERR"] ?? "0")) ? parseInt(b["IF ERR"], 10) : 0;
    const dp = /^\d+$/.test(String(b.TDP ?? "0")) ? parseInt(b.TDP, 10) : 0;
    if (range_ >= 65 && arm >= 50 && error >= 50 && dp >= 50) tags.push("hl-2b-to-ss");
  }
  return tags;
}

export function getPitcherHighlightTags(p) {
  const tags = [];
  const pos = p.POS === "CL" ? "RP" : p.POS;
  const numPitches = /^\d+$/.test(String(p.PIT ?? "0")) ? parseInt(p.PIT, 10) : 0;
  const stamina = /^\d+$/.test(String(p.STM ?? "0")) ? parseInt(p.STM, 10) : 0;
  if (pos === "RP" && numPitches >= 3 && stamina >= 50) tags.push("hl-rp-sp-potential");
  return tags;
}

export function buildSummary(pitchers, batters) {
  function avgTotal(players) {
    const scores = players.filter((p) => p.Scores).map((p) => p.Scores.total ?? 0);
    return scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }
  const sp = pitchers.filter((p) => p.POS === "SP");
  const rp = pitchers.filter((p) => p.POS === "RP" || p.POS === "CL");
  const posAvg = {};
  for (const b of batters) {
    const pos = b.POS || "Unknown";
    if (!posAvg[pos]) posAvg[pos] = [];
    posAvg[pos].push(b);
  }
  const pos_avg = {};
  for (const [pos, list] of Object.entries(posAvg)) pos_avg[pos] = avgTotal(list);
  return {
    num_pitchers: pitchers.length,
    num_batters: batters.length,
    num_sp: sp.length,
    num_rp: rp.length,
    num_total: pitchers.length + batters.length,
    avg_sp: avgTotal(sp),
    avg_rp: avgTotal(rp),
    avg_batters: avgTotal(batters),
    pos_avg,
  };
}

/** Compact top-bar counts for the app summary strip. */
export function formatAppSummaryHtml(summary) {
  const total = summary.num_total ?? (summary.num_pitchers + summary.num_batters);
  return `<div>Pitchers: ${summary.num_pitchers} (SP ${summary.num_sp}, RP ${summary.num_rp})
        · Batters: ${summary.num_batters}
        · Total: ${total}</div>`;
}

export function pitcherDisplayRow(p, rank = null) {
  const scores = p.Scores || {};
  const pot = (scores.core_potential ?? 0) + (scores.pitches_potential ?? 0) + (scores.pot_penalties ?? 0);
  const pos = p.POS === "CL" ? "RP" : p.POS || "";
  const row = {
    id: p.ID || "",
    name: p.Name || "",
    team: p.ORG || "",
    age: p.Age || "",
    pos,
    prone: p.Prone || "",
    scout: p.SctAcc || "",
    throws: p.T || "",
    velo: p.VELO || "",
    pitches: p.PIT || "",
    gf: p["G/F"] || "",
    pitch_score: scores.pitches ?? 0,
    pitch_pot: scores.pitches_potential ?? 0,
    potential: round2(pot),
    current: scores.curr_total ?? 0,
    total: scores.total ?? 0,
    tags: getPitcherHighlightTags(p),
    lev: p.Lev ?? "",
    // raw stats for stats-mode columns
    ip: p.IP ?? "",
    era_plus: p["ERA+"] ?? "",
    war: p["WAR (Pitcher)"] ?? p.WAR ?? "",
    rwar: p.rWAR ?? "",
    fip: p.FIP ?? "",
    fip_minus: p["FIP-"] ?? "",
    k9: p["K/9"] ?? "",
    bb9: p["BB/9"] ?? "",
    hr9: p["HR/9"] ?? "",
    // Pitcher walk % only — never fall back to batter BB% (often 0.0 for pitchers)
    bb_pct: p["BB% (Pitcher)"] ?? "",
    hld: p["HLD (Stat)"] ?? "",
    sv: p.SV ?? "",
    bs: p.BS ?? "",
  };
  if (rank != null) row.rank = rank;
  row.used_stats = !!scores.used_stats;
  return row;
}

function pickStat(...vals) {
  const found = [];
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || s === "-" || s === "—") continue;
    found.push(s);
  }
  const nonZero = found.find((s) => {
    const n = parseFloat(s);
    return !Number.isNaN(n) && n !== 0;
  });
  return nonZero ?? found[0] ?? "";
}

export function batterDisplayRow(b, rank = null) {
  const scores = b.Scores || {};
  const row = {
    id: b.ID || "",
    name: b.Name || "",
    team: b.ORG || "",
    age: b.Age || "",
    pos: b.POS || "",
    bats: b.B || "",
    prone: b.Prone || "",
    scout: b.SctAcc || "",
    ovr: b.OVR || "0 Stars",
    pot_stars: b.POT || "0 Stars",
    contact: b.CON ?? "",
    power: b.POW ?? "",
    eye: b.EYE ?? "",
    offense: scores.offense ?? 0,
    offense_pot: scores.offense_potential ?? 0,
    defense: scores.defense ?? 0,
    total: scores.total ?? 0,
    tags: getBatterHighlightTags(b),
    used_stats: !!scores.used_stats,
    lev: b.Lev ?? "",
    pos_ratings: Object.fromEntries(
      ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"].map((p) => [p, b[p] ?? "-"]),
    ),
    // Prefer batting games — combined exports also have pitching G which used to overwrite
    g: [b["G (Batter)"], b.G, b.Games, b.GP].find(
      (v) => v != null && String(v).trim() !== "" && String(v).trim() !== "-"
    ) ?? "",
    pa: b.PA ?? "",
    wrc_plus: b["wRC+"] ?? "",
    war: b["WAR (Batter)"] ?? b.WAR ?? "",
    ops_plus: b["OPS+"] ?? "",
    avg: b.AVG ?? "",
    obp: b.OBP ?? "",
    slg: b.SLG ?? "",
    iso: b.ISO ?? "",
    // BB%/SO% — prefer disambiguated keys; also accept HTML-entity headers (BB&#37;)
    bb_pct: pickStat(b["BB% (Batter)"], b["BB%"], b["BB&#37;"]),
    so_pct: pickStat(b["SO% (Batter)"], b["SO%"], b["SO&#37;"]),
    hr: b.HR ?? "",
    // background for future use + ZR for stats mode
    cs: b.CS ?? "",
    e: b.E ?? "",
    zr: b.ZR ?? "",
    cera: b.CERA ?? "",
  };
  if (rank != null) row.rank = rank;
  return row;
}
