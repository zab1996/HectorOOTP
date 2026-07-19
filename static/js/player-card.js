/** Player card modal — percentiles / OOTP ratings / stats tabs */

import { loadState } from "./hector/store.js";
import { writeCompareSeed } from "./compare_seed.js";
import {
  initializePercentiles,
  DRAFT_BATTER_METRICS,
  DRAFT_PITCHER_METRICS,
} from "./hector/percentiles.js?v=2";
import { getPlayerArchetypeFits, archetypeTipText } from "./hector/archetypes.js";
import { isMajorLeague } from "./hector/league.js";
import { profileRadarHtml } from "./hector/radar.js";
import { formatOrdinal } from "./hector/util.js";
import { duraClass } from "./column-filter.js";

const BAR_SCALE = 80;

function findPlayer(name, id, playerType, state, pool = "roster") {
  let list;
  if (pool === "draft") {
    list = playerType === "pitcher" ? state.draftPitchers : state.draftBatters;
  } else if (pool === "ifa") {
    list = playerType === "pitcher" ? state.ifaPitchers : state.ifaBatters;
  } else {
    list = playerType === "pitcher" ? state.pitchers : state.batters;
  }
  if (id) {
    const byId = (list || []).find((p) => String(p.ID || "") === String(id));
    if (byId) return byId;
  }
  return (list || []).find((p) => p.Name === name) || null;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, "&#10;");
}

function dash(v) {
  const s = String(v ?? "").trim();
  return !s || s === "-" || s === "—" ? "—" : s;
}

function hasRating(v) {
  const s = String(v ?? "").trim();
  return s !== "" && s !== "-" && s !== "—";
}

function pickField(player, ...keys) {
  for (const k of keys) {
    if (hasRating(player[k])) return player[k];
  }
  return "";
}

function parseGrade(v) {
  if (!hasRating(v)) return null;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** OOTP-like color for a single 20–80 grade (current and potential each use their own). */
function gradeColor(grade) {
  const g = grade ?? 50;
  if (g >= 75) return "#3b82f6";
  if (g >= 70) return "#60a5fa";
  if (g >= 65) return "#0d9488";
  if (g >= 60) return "#14b8a6";
  if (g >= 55) return "#22c55e";
  if (g >= 50) return "#84cc16";
  if (g >= 45) return "#eab308";
  if (g >= 40) return "#facc15";
  if (g >= 30) return "#f97316";
  return "#ea580c";
}

function clampPct(n) {
  return Math.max(0, Math.min(100, (n / BAR_SCALE) * 100));
}

function ootpBarHtml(cur, pot) {
  const curW = clampPct(cur);
  const potW = pot != null && pot > cur ? clampPct(pot - cur) : 0;
  const potSeg =
    potW > 0
      ? `<span class="ootp-bar-pot" style="width:${potW}%;background:${gradeColor(pot)}"></span>`
      : "";
  return `<span class="ootp-bar-track">
    <span class="ootp-bar-cur" style="width:${curW}%;background:${gradeColor(cur)}"></span>
    ${potSeg}
  </span>`;
}

function pairedRatingRow(label, curRaw, potRaw) {
  const cur = parseGrade(curRaw);
  const pot = parseGrade(potRaw);
  if (cur == null && pot == null) return "";
  const c = cur ?? pot;
  const p = pot ?? cur;
  const val =
    c === p
      ? `${c} / ${p}`
      : `${c} / ${p}`;
  return `<div class="ootp-rating-row">
    <span class="ootp-rating-label">${escapeHtml(label)}</span>
    <span class="ootp-rating-val">${escapeHtml(val)}</span>
    ${ootpBarHtml(c, p)}
  </div>`;
}

function singleRatingRow(label, raw) {
  if (!hasRating(raw)) return "";
  const grade = parseGrade(raw);
  if (grade == null) {
    return `<div class="ootp-rating-row ootp-rating-text">
      <span class="ootp-rating-label">${escapeHtml(label)}</span>
      <span class="ootp-rating-val">${escapeHtml(String(raw).trim())}</span>
    </div>`;
  }
  return `<div class="ootp-rating-row">
    <span class="ootp-rating-label">${escapeHtml(label)}</span>
    <span class="ootp-rating-val">${grade}</span>
    ${ootpBarHtml(grade, grade)}
  </div>`;
}

function ratingGroup(title, html, { showCurPot = false } = {}) {
  if (!html) return "";
  const head = showCurPot
    ? `<div class="ootp-group-head"><h4>${escapeHtml(title)}</h4><span class="ootp-cur-pot-label">Current / Potential</span></div>`
    : `<h4>${escapeHtml(title)}</h4>`;
  return `<div class="rating-group">
    ${head}
    <div class="ootp-rating-rows">${html}</div>
  </div>`;
}

function pairedRows(player, pairs) {
  return pairs
    .map(([curKeys, potKeys, label]) => {
      const cur = pickField(player, ...(Array.isArray(curKeys) ? curKeys : [curKeys]));
      const pot = pickField(player, ...(Array.isArray(potKeys) ? potKeys : [potKeys]));
      if (!hasRating(cur) && !hasRating(pot)) return "";
      return pairedRatingRow(label, cur || pot, pot || cur);
    })
    .filter(Boolean)
    .join("");
}

function singleRows(player, fields) {
  return fields
    .map(([key, label]) => {
      const keys = Array.isArray(key) ? key : [key];
      const val = pickField(player, ...keys);
      return singleRatingRow(label, val);
    })
    .filter(Boolean)
    .join("");
}

function batterRatingsHtml(player) {
  const basic = pairedRows(player, [
    ["CON", "CON P", "Contact"],
    ["GAP", "GAP P", "Gap Power"],
    ["POW", "POW P", "Power"],
    ["EYE", "EYE P", "Eye"],
    ["K's", "K P", "Avoid K's"],
  ]);
  const defense = singleRows(player, [
    ["C ABI", "C Ability"],
    ["C ARM", "C Arm"],
    ["C FRM", "C Framing"],
    ["IF RNG", "IF Range"],
    ["IF ERR", "IF Error"],
    ["IF ARM", "IF Arm"],
    ["TDP", "Turn DP"],
    ["OF RNG", "OF Range"],
    ["OF ERR", "OF Error"],
    ["OF ARM", "OF Arm"],
  ]);
  const baserunning = singleRows(player, [
    ["SPE", "Speed"],
    ["STE", "Stealing"],
    ["RUN", "Baserunning"],
  ]);
  const positions = singleRows(player, [
    ["C", "C"],
    ["1B", "1B"],
    ["2B", "2B"],
    ["3B", "3B"],
    ["SS", "SS"],
    ["LF", "LF"],
    ["CF", "CF"],
    ["RF", "RF"],
  ]);
  return (
    ratingGroup("Basic batting", basic, { showCurPot: true }) +
    ratingGroup("Defense", defense) +
    ratingGroup("Baserunning", baserunning) +
    ratingGroup("Position ratings", positions)
  );
}

function pitcherRatingsHtml(player) {
  const core = pairedRows(player, [
    ["STU", "STU P", "Stuff"],
    ["MOV", "MOV P", "Movement"],
    [["CON (Pitcher)", "CON"], ["CON P (Pitcher)", "CON P"], "Control"],
  ]);
  const arsenal = pairedRows(player, [
    ["FB", "FBP", "Fastball"],
    ["CH", "CHP", "Changeup"],
    ["CB", "CBP", "Curveball"],
    ["SL", "SLP", "Slider"],
    ["SI", "SIP", "Sinker"],
    ["SP", "SPP", "Splitter"],
    ["CT", "CTP", "Cutter"],
    ["FO", "FOP", "Forkball"],
    ["CC", "CCP", "Circle Change"],
    ["SC", "SCP", "Screwball"],
    ["KC", "KCP", "Knuckle Curve"],
    ["KN", "KNP", "Knuckleball"],
  ]);
  const other = singleRows(player, [
    ["PIT", "# Pitches"],
    ["VELO", "Velocity"],
    ["STM", "Stamina"],
    ["G/F", "G/F"],
    ["HLD", "Hold Runners"],
  ]);
  return (
    ratingGroup("Core pitching", core, { showCurPot: true }) +
    ratingGroup("Arsenal", arsenal, { showCurPot: true }) +
    ratingGroup("Other", other)
  );
}

function pickStat(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || s === "-" || s === "—") continue;
    return s;
  }
  return "";
}

function parseStatNum(v) {
  if (!hasRating(v)) return null;
  const n = parseFloat(String(v).trim().replace(/%/g, ""));
  return Number.isFinite(n) ? n : null;
}

function majorLeaguePool(players) {
  return (players || []).filter((p) => isMajorLeague(p) === true);
}

/** Rank among MLB pool (1 = best). Ties share the better slot (competition rank). */
function mlbStatRank(playerVal, poolValues, lowerIsBetter) {
  const mine = parseStatNum(playerVal);
  if (mine == null || !poolValues.length) return null;
  let better = 0;
  for (const v of poolValues) {
    if (lowerIsBetter ? v < mine : v > mine) better += 1;
  }
  return { rank: better + 1, of: poolValues.length };
}

function collectPoolValues(pool, getter) {
  const out = [];
  for (const p of pool) {
    const n = parseStatNum(getter(p));
    if (n != null) out.push(n);
  }
  return out;
}

function isCatcher(player) {
  const parts = String(player?.POS || "")
    .toUpperCase()
    .split(/[/,\s]+/)
    .filter(Boolean);
  return parts.includes("C");
}

/** Primary position token (e.g. SS from "SS/2B"). */
function primaryPos(player) {
  const raw = String(player?.POS || "")
    .toUpperCase()
    .trim();
  if (!raw) return "";
  return raw.split(/[/,\s]+/).filter(Boolean)[0] || "";
}

function statsRows(fields, rankTip) {
  const tip = rankTip || "Majors rank among players with this stat (1 = best).";
  return fields
    .map(([label, val, rank]) => {
      if (!hasRating(val)) return "";
      const rankHtml = rank
        ? `<span class="stat-rank tip" data-tip="${escapeAttr(tip)}">#${rank.rank}<span class="muted">/${rank.of}</span></span>`
        : `<span class="stat-rank muted">—</span>`;
      return `<div class="rating-row rating-row-rank">
        <span class="rating-label">${escapeHtml(label)}</span>
        <span class="rating-val">${escapeHtml(String(val).trim())}</span>
        ${rankHtml}
      </div>`;
    })
    .filter(Boolean)
    .join("");
}

function batterStatGetters(player) {
  const rows = [
    ["G", (p) => pickStat(p["G (Batter)"], p.G, p.Games, p.GP), false],
    ["PA", (p) => p.PA, false],
    ["AVG", (p) => p.AVG, false],
    ["OBP", (p) => p.OBP, false],
    ["SLG", (p) => p.SLG, false],
    ["OPS", (p) => p.OPS, false],
    ["ISO", (p) => p.ISO, false],
    ["wOBA", (p) => p.wOBA, false],
    ["HR", (p) => p.HR, false],
    ["SB", (p) => p.SB, false],
    ["CS", (p) => p.CS, true],
    [
      "BB%",
      (p) => pickStat(p["BB% (Batter)"], p["BB%"], p["BB&#37;"]),
      false,
    ],
    [
      "SO%",
      (p) => pickStat(p["SO% (Batter)"], p["SO%"], p["SO&#37;"]),
      true,
    ],
    ["OPS+", (p) => p["OPS+"], false],
    ["wRC+", (p) => p["wRC+"], false],
    ["WAR", (p) => pickStat(p["WAR (Batter)"], p.WAR), false],
    ["UBR", (p) => p.UBR, false],
    ["ZR", (p) => p.ZR, false],
    ["E", (p) => p.E, true],
  ];
  if (isCatcher(player)) {
    rows.push(["CERA", (p) => p.CERA, true]);
  }
  return rows;
}

function pitcherStatGetters() {
  return [
    ["IP", (p) => p.IP, false],
    ["ERA+", (p) => p["ERA+"], false],
    ["WAR", (p) => pickStat(p["WAR (Pitcher)"], p.WAR), false],
    ["rWAR", (p) => p.rWAR, false],
    ["FIP", (p) => p.FIP, true],
    ["FIP-", (p) => p["FIP-"], true],
    ["SIERA", (p) => p.SIERA, true],
    ["WHIP", (p) => p.WHIP, true],
    ["K/9", (p) => p["K/9"], false],
    ["BB/9", (p) => p["BB/9"], true],
    ["HR/9", (p) => p["HR/9"], true],
    ["K%", (p) => pickStat(p["K% (Pitcher)"], p["K%"]), false],
    ["BB%", (p) => pickStat(p["BB% (Pitcher)"]), true],
    ["HLD", (p) => pickStat(p["HLD (Stat)"]), false],
    ["SV", (p) => p.SV, false],
    ["BS", (p) => p.BS, true],
  ];
}

function batterStatsHtml(player, majors, byPosition = false) {
  const pos = primaryPos(player);
  const pool =
    byPosition && pos
      ? majors.filter((p) => primaryPos(p) === pos)
      : majors;
  const rankTip =
    byPosition && pos
      ? `Majors rank among ${pos} with this stat (1 = best). Pool size ${pool.length}.`
      : "Majors rank among players with this stat (1 = best).";
  const fields = batterStatGetters(player).map(([label, getter, lower]) => {
    const val = getter(player);
    const poolVals = collectPoolValues(pool, getter);
    const rank = mlbStatRank(val, poolVals, lower);
    return [label, val, rank];
  });
  const html = statsRows(fields, rankTip);
  return html
    ? `<div class="stats-list"><div class="rating-rows rating-rows-rank">${html}</div></div>`
    : "";
}

function pitcherStatsHtml(player, majors, byPosition = false) {
  const pos = primaryPos(player);
  const pool =
    byPosition && pos
      ? majors.filter((p) => primaryPos(p) === pos)
      : majors;
  const rankTip =
    byPosition && pos
      ? `Majors rank among ${pos} with this stat (1 = best). Pool size ${pool.length}.`
      : "Majors rank among players with this stat (1 = best).";
  const fields = pitcherStatGetters().map(([label, getter, lower]) => {
    const val = getter(player);
    const poolVals = collectPoolValues(pool, getter);
    const rank = mlbStatRank(val, poolVals, lower);
    return [label, val, rank];
  });
  const html = statsRows(fields, rankTip);
  return html
    ? `<div class="stats-list"><div class="rating-rows rating-rows-rank">${html}</div></div>`
    : "";
}

function seasonStatsBodyHtml(player, playerType, majors, byPosition) {
  const html =
    playerType === "batter"
      ? batterStatsHtml(player, majors, byPosition)
      : pitcherStatsHtml(player, majors, byPosition);
  return html || '<p class="muted">No season stats on this player</p>';
}

function contractLine(player) {
  const parts = [
    `SLR ${escapeHtml(dash(player.SLR))}`,
    `YL ${escapeHtml(dash(player.YL))}`,
    `CV ${escapeHtml(dash(player.CV))}`,
  ];
  if (hasRating(player.TY)) parts.push(`TY ${escapeHtml(String(player.TY).trim())}`);
  return parts.join(" · ");
}

export function showPlayerCard(player, playerType = "batter", options = {}) {
  const existing = document.getElementById("player-card-modal");
  if (existing) existing.remove();

  const draftMode = options.mode === "draft" || options.mode === "ifa";
  const poolLabel = options.mode === "ifa" ? "IFA" : "Draft class";
  const state = loadState();
  const calc = draftMode
    ? initializePercentiles(
        options.mode === "ifa" ? state.ifaBatters || [] : state.draftBatters || [],
        options.mode === "ifa" ? state.ifaPitchers || [] : state.draftPitchers || [],
        {
          majorsOnly: false,
          batterMetrics: DRAFT_BATTER_METRICS,
          pitcherMetrics: DRAFT_PITCHER_METRICS,
          fresh: true,
        },
      )
    : initializePercentiles(state.batters, state.pitchers, { majorsOnly: true });
  const percentiles =
    playerType === "batter"
      ? calc.getBatterPercentiles(player)
      : calc.getPitcherPercentiles(player);
  const summary = calc.getPlayerSummary(player, playerType);
  const fits = getPlayerArchetypeFits(player, playerType);
  const fitList = Object.entries(fits)
    .filter(([, v]) => (v.score ?? 0) >= 40)
    .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0));

  const sortedPct = Object.entries(percentiles).sort(
    (a, b) => b[1].percentile - a[1].percentile,
  );

  const pctHtml = sortedPct
    .map(([, d]) => {
      const tier = d.tier || {};
      return `<div class="pct-row">
        <span class="pct-label">${escapeHtml(d.label)}</span>
        <span class="pct-val">${d.value ? Number(d.value).toFixed(1) : "—"}</span>
        <span class="pct-pct">${formatOrdinal(d.percentile)}</span>
        <span class="pct-bar" style="--pct:${d.percentile}; --tier:${tier.color || "#888"}"></span>
        <span class="pct-tier" style="color:${tier.color || "#888"}">${escapeHtml(tier.label || "")}</span>
      </div>`;
    })
    .join("");

  const ratingsHtml =
    playerType === "batter" ? batterRatingsHtml(player) : pitcherRatingsHtml(player);
  const radarHtml = profileRadarHtml(player, playerType);

  const identityBits = [];
  if (draftMode) identityBits.push(poolLabel);
  else if (player.ORG) identityBits.push(escapeHtml(player.ORG));
  identityBits.push(escapeHtml(player.POS || ""));
  identityBits.push(`Age ${escapeHtml(player.Age || "")}`);
  identityBits.push(
    playerType === "batter"
      ? `Bats ${escapeHtml(player.B || "")}`
      : `Throws ${escapeHtml(player.T || "")}`,
  );
  const duraRaw = String(player.Prone || "").trim();
  if (duraRaw) {
    const duraCls = duraClass(duraRaw);
    identityBits.push(
      duraCls
        ? `<span class="${duraCls}">Durability ${escapeHtml(duraRaw)}</span>`
        : `Durability ${escapeHtml(duraRaw)}`,
    );
  }
  const scoutAcc = String(player.SctAcc || "").trim();
  const scoutKey = scoutAcc.toLowerCase().replace(/\s+/g, " ");
  let scoutCls = "";
  if (
    scoutKey === "very high" ||
    scoutKey === "extremely high" ||
    scoutKey === "extremely good" ||
    scoutKey === "excellent"
  ) {
    scoutCls = "scout-acc-very-high";
  } else if (scoutKey === "high" || scoutKey === "good" || scoutKey === "very good") {
    scoutCls = "scout-acc-high";
  } else if (scoutKey === "average" || scoutKey === "medium" || scoutKey === "normal") {
    scoutCls = "scout-acc-average";
  } else if (scoutKey === "low" || scoutKey === "fair" || scoutKey === "poor") {
    scoutCls = "scout-acc-low";
  } else if (scoutKey === "very low" || scoutKey === "awful") {
    scoutCls = "scout-acc-very-low";
  }
  const scoutText = escapeHtml(scoutAcc || "—");
  identityBits.push(
    scoutCls
      ? `<span class="${scoutCls}">Scout Acc. ${scoutText}</span>`
      : `Scout Acc. ${scoutText}`,
  );

  const personality = String(player.Type || "").trim();
  if (!draftMode) {
    const natPop = String(player["Nat. Pop."] || "").trim();
    const locPop = String(player["Loc. Pop."] || "").trim();
    if (natPop) identityBits.push(`Nat. Pop. ${escapeHtml(natPop)}`);
    if (locPop) identityBits.push(`Loc. Pop. ${escapeHtml(locPop)}`);
  }
  if (personality) identityBits.push(`Type ${escapeHtml(personality)}`);

  const defaultTab =
    options.defaultTab === "ratings" ||
    options.defaultTab === "percentiles" ||
    options.defaultTab === "stats"
      ? options.defaultTab
      : draftMode
        ? "ratings"
        : "percentiles";

  let statsPanelHtml = "";
  let majorsPool = [];
  if (!draftMode) {
    majorsPool =
      playerType === "batter"
        ? majorLeaguePool(state.batters)
        : majorLeaguePool(state.pitchers);
    const pos = primaryPos(player);
    const posLabel = pos || "POS";
    statsPanelHtml = `
          <div class="player-card-panel" data-panel="stats" hidden>
            <div class="player-card-stats-head">
              <h3>Season stats</h3>
              <label class="chk tip" data-tip="When on, # ranks are among majors at this player's primary position (${escapeAttr(posLabel)}) only. When off, ranks are among all majors with that stat.">
                <input type="checkbox" id="player-card-pos-rank" /> Position ranks (${escapeHtml(posLabel)})
              </label>
            </div>
            <p class="muted tip-note tip" data-tip="Season stats from export. Rank among majors (1 = best); toggle Position ranks to narrow by POS.">Season stats · Majors rank</p>
            <div id="player-card-stats-body">${seasonStatsBodyHtml(player, playerType, majorsPool, false)}</div>
          </div>`;
  }

  const overlay = document.createElement("div");
  overlay.id = "player-card-modal";
  overlay.className = "player-card-overlay";
  overlay.innerHTML = `
    <div class="player-card" role="dialog" aria-modal="true">
      <button type="button" class="player-card-close" aria-label="Close">&times;</button>
      <header class="player-card-header">
        <div class="player-card-header-main">
          <h2>${escapeHtml(player.Name || "Unknown")}</h2>
          <p class="muted">${identityBits.join(" · ")}</p>
          ${
            draftMode
              ? ""
              : `<p class="player-card-contract tip" data-tip="Contract from export (SLR / years left / contract value). Not part of Hector Total.">${contractLine(player)}</p>`
          }
          <p><span class="ovr">OVR ${escapeHtml(player.OVR || "-")}</span>
             <span class="pot">POT ${escapeHtml(player.POT || "-")}</span>
             ${!draftMode && player.Scores?.used_stats ? '<span class="stat-badge">Stats score</span>' : ""}</p>
          ${
            `<p class="player-card-actions">
            <button type="button" class="btn btn-accent player-card-compare-btn" data-compare>Compare</button>
          </p>`
          }
        </div>
        ${radarHtml}
      </header>
      <div class="player-card-tabs" role="tablist">
        <button type="button" class="player-card-tab${defaultTab === "ratings" ? " active" : ""}" role="tab" aria-selected="${defaultTab === "ratings"}" data-tab="ratings">Ratings</button>
        <button type="button" class="player-card-tab${defaultTab === "percentiles" ? " active" : ""}" role="tab" aria-selected="${defaultTab === "percentiles"}" data-tab="percentiles">Percentiles</button>
        ${
          draftMode
            ? ""
            : `<button type="button" class="player-card-tab" role="tab" aria-selected="false" data-tab="stats">Stats</button>`
        }
      </div>
      <div class="player-card-cols${defaultTab !== "percentiles" ? " solo" : ""}">
        <section class="player-card-main">
          <div class="player-card-panel${defaultTab === "ratings" ? " active" : ""}" data-panel="ratings"${defaultTab === "ratings" ? "" : " hidden"}>
            <h3>Scouting ratings</h3>
            <div class="ratings-list">${ratingsHtml || '<p class="muted">No rating fields on this player</p>'}</div>
          </div>
          <div class="player-card-panel${defaultTab === "percentiles" ? " active" : ""}" data-panel="percentiles"${defaultTab === "percentiles" ? "" : " hidden"}>
            <h3>${draftMode ? `${poolLabel} percentiles` : "Percentile rankings"}</h3>
            ${
              draftMode
                ? `<p class="muted tip-note">Ratings ranked vs other players on the ${poolLabel} tab (not majors).</p>`
                : ""
            }
            <div class="pct-list">${pctHtml || '<p class="muted">No percentile data</p>'}</div>
          </div>
          ${statsPanelHtml}
        </section>
        <aside class="player-card-aside">
          <h3>Best</h3>
          <ul>${summary.best.map((b) => `<li>${escapeHtml(b.label)} · ${formatOrdinal(b.percentile)}</li>`).join("") || "<li class='muted'>—</li>"}</ul>
          <h3>Worst</h3>
          <ul>${summary.worst.map((b) => `<li>${escapeHtml(b.label)} · ${formatOrdinal(b.percentile)}</li>`).join("") || "<li class='muted'>—</li>"}</ul>
          <h3>Archetype fits</h3>
          <ul class="arch-fits">
            ${fitList
              .slice(0, 8)
              .map(([, v]) => {
                const color = v.label?.color || "inherit";
                const tip = archetypeTipText(v);
                const tipAttr = tip
                  ? ` class="tip" data-tip="${escapeAttr(tip)}"`
                  : "";
                return `<li${tipAttr}><strong>${escapeHtml(v.archetype_name || "")}</strong>
                   <span class="num-strong" style="color:${color}">${v.score}%</span></li>`;
              })
              .join("") || "<li class='muted'>No strong fits</li>"}
          </ul>
          <p class="muted tip-note">Right-click any player row for this card.</p>
        </aside>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const cols = overlay.querySelector(".player-card-cols");
  const tabs = overlay.querySelectorAll(".player-card-tab");
  const panels = overlay.querySelectorAll(".player-card-panel");

  function activateTab(id) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === id;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((p) => {
      const on = p.dataset.panel === id;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
    cols.classList.toggle("solo", id !== "percentiles");
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  const posRankToggle = overlay.querySelector("#player-card-pos-rank");
  const statsBody = overlay.querySelector("#player-card-stats-body");
  if (posRankToggle && statsBody && !draftMode) {
    posRankToggle.addEventListener("change", () => {
      statsBody.innerHTML = seasonStatsBodyHtml(
        player,
        playerType,
        majorsPool,
        !!posRankToggle.checked,
      );
    });
  }

  const compareBtn = overlay.querySelector("[data-compare]");
  if (compareBtn) {
    compareBtn.addEventListener("click", () => {
      writeCompareSeed({
        type: playerType,
        pool: options.mode === "ifa" ? "ifa" : draftMode ? "draft" : "roster",
        id: String(player.ID || ""),
        name: String(player.Name || ""),
      });
      window.location.href = "compare.html";
    });
  }

  const close = () => overlay.remove();
  overlay.querySelector(".player-card-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener(
    "keydown",
    function onKey(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    },
  );
}

export function bindPlayerCardRows(root = document) {
  root.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".team-cell, [data-team-abbr]")) return;
    const tr = e.target.closest("tr[data-player-name]");
    if (!tr) return;
    e.preventDefault();
    openFromRow(tr);
  });
  root.addEventListener("click", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.target.closest(".team-cell, [data-team-abbr]")) return;
    const tr = e.target.closest("tr[data-player-name]");
    if (!tr) return;
    e.preventDefault();
    openFromRow(tr);
  });
}

function openFromRow(tr) {
  const state = loadState();
  const name = tr.dataset.playerName;
  const id = tr.dataset.playerId;
  const playerType = tr.dataset.playerType || "batter";
  const rawPool = tr.dataset.playerPool;
  const pool = rawPool === "draft" || rawPool === "ifa" ? rawPool : "roster";
  const tab = tr.dataset.playerCardTab;
  const player = findPlayer(name, id, playerType, state, pool);
  if (!player) return;
  const opts = pool === "draft" || pool === "ifa" ? { mode: pool } : {};
  if (tab === "ratings" || tab === "percentiles" || tab === "stats") {
    opts.defaultTab = tab;
  }
  showPlayerCard(player, playerType, opts);
}
