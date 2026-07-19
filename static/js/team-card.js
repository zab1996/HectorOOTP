/** Team card modal — standings, YoY, roster value, top WAR */

import { loadState, isMyTeam } from "./hector/store.js";
import { teamListByAbbr } from "./hector/team_list.js";
import {
  enrichTeamsWithRosterWar,
  analyzeYearOverYearTrends,
} from "./hector/league_analytics.js";
import { aggregateTeams } from "./hector/teams.js";
import { getWar } from "./hector/player_analytics.js";
import { playerDollarPerWar, formatMoneyM, formatDpw } from "./hector/team_salary.js";
import { isMajorLeague } from "./hector/league.js";
import { showPlayerCard } from "./player-card.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dash(v) {
  const s = String(v ?? "").trim();
  return !s || s === "-" || s === "—" ? "—" : s;
}

/** @returns {string|null} */
export function normalizeTeamAbbr(raw) {
  const a = String(raw ?? "").trim().toUpperCase();
  if (!a || a === "-" || a === "—") return null;
  return a;
}

function pfVal(teamRow, key) {
  if (!teamRow?.pf) return null;
  const n = Number(teamRow.pf[key]);
  return Number.isFinite(n) ? n : null;
}

function formatPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toFixed(3).replace(/^0/, "");
}

function orgMajors(list, abbr) {
  return (list || []).filter((p) => {
    if (isMajorLeague(p) === false) return false;
    return String(p.ORG || "").trim().toUpperCase() === abbr;
  });
}

function topWarList(players, playerType, abbr, n = 3) {
  return orgMajors(players, abbr)
    .map((p) => ({ player: p, war: getWar(p, playerType), type: playerType }))
    .sort((a, b) => b.war - a.war)
    .slice(0, n);
}

function bestDollarWar(batters, pitchers, abbr, n = 3) {
  const rows = [];
  for (const p of orgMajors(batters, abbr)) {
    const dpw = playerDollarPerWar(p, "batter");
    if (dpw == null || !Number.isFinite(dpw) || getWar(p, "batter") <= 0) continue;
    rows.push({ player: p, dpw, type: "batter", war: getWar(p, "batter") });
  }
  for (const p of orgMajors(pitchers, abbr)) {
    const dpw = playerDollarPerWar(p, "pitcher");
    if (dpw == null || !Number.isFinite(dpw) || getWar(p, "pitcher") <= 0) continue;
    rows.push({ player: p, dpw, type: "pitcher", war: getWar(p, "pitcher") });
  }
  rows.sort((a, b) => a.dpw - b.dpw);
  return rows.slice(0, n);
}

function playerLinkBtn(p, type) {
  const name = escapeHtml(p.Name || p.name || "—");
  const id = escapeHtml(String(p.ID || ""));
  return `<button type="button" class="team-card-player-btn" data-player-name="${escapeHtml(p.Name || "")}" data-player-id="${id}" data-player-type="${type}">${name}</button>`;
}

function section(title, bodyHtml) {
  return `<section class="team-card-section">
    <h3>${escapeHtml(title)}</h3>
    ${bodyHtml}
  </section>`;
}

/**
 * @param {string} abbrRaw
 * @param {object} [state]
 */
export function showTeamCard(abbrRaw, state = loadState()) {
  const abbr = normalizeTeamAbbr(abbrRaw);
  if (!abbr) return;

  document.querySelector(".player-card-overlay")?.remove();

  const teamMap = teamListByAbbr(state.teamList || []);
  const teamRow = teamMap.get(abbr) || null;
  const teamName = teamRow?.name ? String(teamRow.name) : "";
  const mine = isMyTeam(abbr, state);

  const useStats = state.teamsUseStats !== false;
  const majorsOnly = state.majorsOnly !== false;
  const agg = aggregateTeams(state.pitchers, state.batters, { majorsOnly, useStats });
  const roster = agg.find((r) => String(r.team || "").toUpperCase() === abbr) || null;

  let yoy = null;
  if (teamRow && (teamRow.ly_w != null || teamRow.ly_l != null || teamRow.ly_pct)) {
    const hasLy =
      Number(teamRow.ly_w) > 0 ||
      Number(teamRow.ly_l) > 0 ||
      Number(teamRow.ly_pct) > 0;
    if (hasLy) {
      const enriched = enrichTeamsWithRosterWar(state.teamList || [], state.pitchers, state.batters);
      const trends = analyzeYearOverYearTrends(enriched);
      yoy = (trends.all_changes || []).find((c) => String(c.team || "").toUpperCase() === abbr) || null;
      if (!yoy) {
        const currPct = Number(teamRow.win_pct) || 0;
        const lyPct = Number(teamRow.ly_pct) || 0;
        if (currPct > 0 && lyPct > 0) {
          yoy = {
            current_pct: currPct,
            ly_pct: lyPct,
            pct_change: Math.round((currPct - lyPct) * 1000) / 1000,
            wins_change: null,
          };
        }
      }
    }
  }

  const topBat = topWarList(state.batters, "batter", abbr, 3);
  const topPit = topWarList(state.pitchers, "pitcher", abbr, 3);
  const bestDpw = bestDollarWar(state.batters, state.pitchers, abbr, 3);

  let recordHtml;
  if (!teamRow) {
    recordHtml = `<p class="muted team-card-empty">Upload Team List for standings &amp; parks.</p>`;
  } else {
    const w = dash(teamRow.w);
    const l = dash(teamRow.l);
    const pct = dash(teamRow.win_pct);
    const park = dash(teamRow.park);
    const pfAvg = pfVal(teamRow, "PF AVG");
    const pfHr = pfVal(teamRow, "PF HR");
    const pfOverall = pfVal(teamRow, "PF");
    recordHtml = `<dl class="team-card-dl">
      <div><dt>Record</dt><dd>${escapeHtml(w)}-${escapeHtml(l)}</dd></div>
      <div><dt>Win %</dt><dd>${escapeHtml(pct)}</dd></div>
      <div><dt>Park</dt><dd>${escapeHtml(park)}</dd></div>
      <div><dt>PF</dt><dd>${pfOverall != null ? pfOverall.toFixed(2) : "—"}</dd></div>
      ${pfAvg != null ? `<div><dt>PF AVG</dt><dd>${pfAvg.toFixed(2)}</dd></div>` : ""}
      ${pfHr != null ? `<div><dt>PF HR</dt><dd>${pfHr.toFixed(2)}</dd></div>` : ""}
    </dl>`;
  }

  let yoyHtml = "";
  if (yoy) {
    const deltaPct =
      yoy.pct_change != null && Number.isFinite(yoy.pct_change)
        ? (yoy.pct_change >= 0 ? "+" : "") + yoy.pct_change.toFixed(3)
        : "—";
    const deltaW =
      yoy.wins_change != null && Number.isFinite(yoy.wins_change)
        ? (yoy.wins_change >= 0 ? "+" : "") + yoy.wins_change
        : "—";
    yoyHtml = section(
      "Year over year",
      `<dl class="team-card-dl">
        <div><dt>This year %</dt><dd>${formatPct(yoy.current_pct)}</dd></div>
        <div><dt>Last year %</dt><dd>${formatPct(yoy.ly_pct)}</dd></div>
        <div><dt>Δ wins</dt><dd>${escapeHtml(String(deltaW))}</dd></div>
        <div><dt>Δ pct</dt><dd>${escapeHtml(deltaPct)}</dd></div>
      </dl>`,
    );
  }

  let rosterHtml;
  if (!roster) {
    rosterHtml = `<p class="muted">No roster players for ${escapeHtml(abbr)}.</p>`;
  } else {
    rosterHtml = `<dl class="team-card-dl">
      <div><dt>Total</dt><dd class="num-strong">${escapeHtml(String(roster.total))}</dd></div>
      <div><dt>Salary</dt><dd>${escapeHtml(formatMoneyM(roster.salary_m))}</dd></div>
      <div><dt>WAR</dt><dd>${escapeHtml(String(roster.war))}</dd></div>
      <div><dt>Avg $/WAR</dt><dd>${escapeHtml(formatDpw(roster.dollar_per_war))}</dd></div>
    </dl>`;
  }

  function warListHtml(rows) {
    if (!rows.length) return `<p class="muted">—</p>`;
    return `<ul class="team-card-list">${rows
      .map(
        (r) =>
          `<li>${playerLinkBtn(r.player, r.type)} <span class="muted">${Number(r.war).toFixed(1)} WAR</span></li>`,
      )
      .join("")}</ul>`;
  }

  function dpwListHtml(rows) {
    if (!rows.length) return `<p class="muted">—</p>`;
    return `<ul class="team-card-list">${rows
      .map(
        (r) =>
          `<li>${playerLinkBtn(r.player, r.type)} <span class="muted">${escapeHtml(formatDpw(r.dpw))}</span></li>`,
      )
      .join("")}</ul>`;
  }

  const title = teamName ? `${abbr} — ${teamName}` : abbr;
  const tip = mine
    ? `<p class="team-card-yours tip" data-tip="Your team (set in Options).">Your team</p>`
    : "";

  const overlay = document.createElement("div");
  overlay.className = "player-card-overlay";
  overlay.id = "team-card-modal";
  overlay.innerHTML = `
    <div class="player-card team-card" role="dialog" aria-labelledby="team-card-title">
      <button type="button" class="player-card-close" aria-label="Close">&times;</button>
      <header class="player-card-header team-card-header">
        <div class="player-card-header-main">
          <h2 id="team-card-title">${escapeHtml(title)}</h2>
          ${tip}
        </div>
      </header>
      ${section("Record", recordHtml)}
      ${yoyHtml}
      ${section("Roster value", rosterHtml)}
      ${section("Top batters (WAR)", warListHtml(topBat))}
      ${section("Top pitchers (WAR)", warListHtml(topPit))}
      ${section("Best $/WAR", dpwListHtml(bestDpw))}
    </div>`;

  document.body.appendChild(overlay);

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

  overlay.querySelectorAll(".team-card-player-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.playerName;
      const id = btn.dataset.playerId;
      const playerType = btn.dataset.playerType || "batter";
      const list = playerType === "pitcher" ? state.pitchers : state.batters;
      let player = null;
      if (id) player = (list || []).find((p) => String(p.ID || "") === String(id));
      if (!player) player = (list || []).find((p) => p.Name === name);
      if (!player) return;
      close();
      showPlayerCard(player, playerType);
    });
  });
}

function openFromTarget(el) {
  const cell = el.closest("[data-team-abbr]");
  if (!cell) return;
  const abbr = normalizeTeamAbbr(cell.dataset.teamAbbr);
  if (!abbr) return;
  showTeamCard(abbr);
}

let teamCardBound = false;

/** Context-menu + Ctrl/Cmd-click on [data-team-abbr] cells. */
export function bindTeamCardTargets(root = document) {
  if (root === document) {
    if (teamCardBound) return;
    teamCardBound = true;
  } else if (root.dataset?.teamCardBound === "1") {
    return;
  } else if (root.dataset) {
    root.dataset.teamCardBound = "1";
  }

  root.addEventListener("contextmenu", (e) => {
    const cell = e.target.closest("[data-team-abbr]");
    if (!cell) return;
    if (!normalizeTeamAbbr(cell.dataset.teamAbbr)) return;
    e.preventDefault();
    e.stopPropagation();
    openFromTarget(e.target);
  });

  root.addEventListener("click", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const cell = e.target.closest("[data-team-abbr]");
    if (!cell) return;
    if (!normalizeTeamAbbr(cell.dataset.teamAbbr)) return;
    e.preventDefault();
    e.stopPropagation();
    openFromTarget(e.target);
  });
}
