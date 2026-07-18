import { mountShell, requireData } from "../shell.js?v=40";
import { isMyTeam } from "../hector/store.js";
import {
  enrichTeamsWithRosterWar,
  generateLeagueReport,
} from "../hector/league_analytics.js";

if (!(await requireData())) throw new Error("redirect");
const state = await mountShell("league");

const emptyEl = document.getElementById("league-empty");
const contentEl = document.getElementById("league-content");

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function fmtNum(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number(n).toFixed(digits);
}

function labelStatus(s) {
  return String(s || "").replace(/_/g, " ");
}

function rowClass(abbr) {
  return isMyTeam(abbr, state) ? ' class="hl-my-team tip" data-tip="Your team (set in Options)."' : "";
}

function typeLabel(t) {
  const map = {
    hr_friendly: "HR Friendly",
    hr_suppressing: "HR Suppressing",
    avg_inflating: "AVG Inflating",
    avg_suppressing: "AVG Suppressing",
  };
  return map[t] || labelStatus(t);
}

function renderInsights(insights) {
  if (!insights?.length) return "<p class='muted'>No insights yet.</p>";
  return `<ul class="league-insights">${insights.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

function renderSeasonSummary(env, parity, warConcentration) {
  const pf = env.park_factors || {};
  return `
    <div class="league-summary-grid">
      <div><span class="muted">Environment</span><strong>${escapeHtml(labelStatus(env.environment_type))}</strong></div>
      <div><span class="muted">Total teams</span><strong>${escapeHtml(env.total_teams ?? "—")}</strong></div>
      <div><span class="muted">Overall parity</span><strong>${escapeHtml(labelStatus(parity.overall_parity))}</strong></div>
      <div><span class="muted">Win % std dev</span><strong>${escapeHtml(fmtPct(parity.win_pct_std))}</strong></div>
      <div><span class="muted">Avg park factor</span><strong>${escapeHtml(fmtNum(pf.PF_mean, 3))}</strong></div>
      <div><span class="muted">Avg batting WAR</span><strong>${escapeHtml(fmtNum(env.batting_war?.mean))}</strong></div>
      <div><span class="muted">Avg pitching WAR</span><strong>${escapeHtml(fmtNum(env.pitching_war?.mean))}</strong></div>
      <div><span class="muted">WAR concentration</span><strong>${escapeHtml(labelStatus(warConcentration) || "—")}</strong></div>
    </div>`;
}

function hasDivisionData(teams) {
  return (teams || []).some((t) => String(t.div || "").trim() !== "");
}

function renderParity(parity, warConcentration, teamsHaveDiv) {
  const near = parity.teams_near_500 || {};
  const entries = Object.entries(parity.division_balance || {}).filter(
    ([name]) => name && name !== "Unknown",
  );
  let divBlock;
  if (!teamsHaveDiv) {
    divBlock = `<p class="muted">Division names missing on stored Team List. Re-upload <strong>Team List.html</strong> (with a <strong>DIV</strong> column) on Upload to refresh.</p>`;
  } else if (!entries.length) {
    divBlock = `<p class="muted">No division balance yet (need at least two teams with win % per division).</p>`;
  } else {
    divBlock = `<div class="league-div-list">${entries
      .map(
        ([name, d]) => `
      <div class="league-div-block">
        <strong>${escapeHtml(name)}</strong>
        <span class="muted">${escapeHtml(labelStatus(d.status))}</span>
        <span>W% ${escapeHtml(fmtPct(d.min_pct))} – ${escapeHtml(fmtPct(d.max_pct))}</span>
        <span>Spread ${escapeHtml(fmtPct(d.spread))}</span>
      </div>`,
      )
      .join("")}</div>`;
  }
  return `
    <p>Teams near .500 — within 5 games: <strong>${near.within_5_games ?? 0}</strong>;
       within 10 games: <strong>${near.within_10_games ?? 0}</strong>.
       WAR concentration: <strong>${escapeHtml(labelStatus(warConcentration) || "—")}</strong>.</p>
    ${divBlock}`;
}

function renderParks(park) {
  const rows = (park.extreme_parks || [])
    .map(
      (p) => `<tr${rowClass(p.team)}>
        <td>${escapeHtml(p.team)}</td>
        <td>${escapeHtml(p.park)}</td>
        <td>${escapeHtml(fmtNum(p.PF, 3))}</td>
        <td>${escapeHtml(fmtNum(p["PF HR"], 3))}</td>
        <td>${escapeHtml(fmtNum(p["PF AVG"], 3))}</td>
        <td>${escapeHtml(typeLabel(p.type))}</td>
      </tr>`,
    )
    .join("");
  return `
    <div class="table-wrap compact">
      <table class="data-table sortable league-table-parks">
        <thead><tr>
          <th>Team</th><th>Park</th><th>PF</th><th>PF HR</th><th>PF AVG</th><th>Type</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="muted">No extreme parks (need PF HR / PF AVG on Team List).</td></tr>'}</tbody>
      </table>
    </div>`;
}

function renderTalent(talent) {
  const list = talent.all_teams?.length ? talent.all_teams : talent.top_teams || [];
  const superSet = new Set((talent.super_teams || []).map((t) => t.team));
  const rows = list
    .map((t, i) => {
      const mine = isMyTeam(t.team, state);
      const isSuper = superSet.has(t.team);
      const classes = ["tip"];
      if (isSuper) classes.push("hl-super-team");
      if (mine) classes.push("hl-my-team");
      const tip = isSuper
        ? "Super team: top tier batting and pitching WAR."
        : mine
          ? "Your team (set in Options)."
          : "";
      const tipAttr = tip ? ` data-tip="${escapeHtml(tip)}"` : "";
      return `<tr class="${classes.join(" ")}"${tipAttr}>
        <td>${i + 1}</td>
        <td>${escapeHtml(t.team_name || t.team)}</td>
        <td>${escapeHtml(fmtNum(t.batting_war))}</td>
        <td>${escapeHtml(fmtNum(t.pitching_war))}</td>
        <td class="num-strong">${escapeHtml(fmtNum(t.total_war))}</td>
      </tr>`;
    })
    .join("");
  return `
    <div class="table-wrap compact">
      <table class="data-table sortable">
        <thead><tr>
          <th>Rank</th><th>Team</th><th>Batting WAR</th><th>Pitching WAR</th><th>Total WAR</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">No WAR data.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function renderDivisions(talent, teamsHaveDiv) {
  if (!teamsHaveDiv) {
    return `<p class="muted">Division names missing on stored Team List. Re-upload <strong>Team List.html</strong> (include <strong>DIV</strong>) on the Upload page — older uploads were saved before DIV was stored.</p>`;
  }
  const entries = Object.entries(talent.division_talent || {}).filter(
    ([n]) => n && n !== "Unknown",
  );
  if (!entries.length) {
    return '<p class="muted">No division talent data yet.</p>';
  }

  return entries
    .map(
      ([name, d]) => `
      <div class="league-div-block">
        <strong>${escapeHtml(name)}</strong>
        <span>${d.teams} teams</span>
        <span>Avg WAR ${escapeHtml(fmtNum(d.avg_war))}</span>
        <span>Total WAR ${escapeHtml(fmtNum(d.total_war))}</span>
        <span>Leader: ${escapeHtml(d.top_team_name || d.top_team)} (${escapeHtml(fmtNum(d.top_team_war))} WAR)</span>
      </div>`,
    )
    .join("");
}

function renderYoy(yoy) {
  const list = yoy.all_changes || [];
  const rows = list
    .map((t) => {
      const up = t.pct_change >= 0;
      const cls = up ? "yoy-up" : "yoy-down";
      const mine = isMyTeam(t.team, state) ? " hl-my-team" : "";
      const sign = t.pct_change >= 0 ? "+" : "";
      const wSign = t.wins_change >= 0 ? "+" : "";
      return `<tr class="tip ${cls}${mine}"${mine ? ' data-tip="Your team (set in Options)."' : ""}>
        <td>${escapeHtml(t.team_name || t.team)}</td>
        <td>${escapeHtml(fmtPct(t.current_pct))}</td>
        <td>${escapeHtml(fmtPct(t.ly_pct))}</td>
        <td>${sign}${escapeHtml(fmtPct(t.pct_change))}</td>
        <td>${wSign}${escapeHtml(String(t.wins_change))}</td>
      </tr>`;
    })
    .join("");
  const trend = yoy.league_trend
    ? `<p class="muted">League trend: <strong>${escapeHtml(labelStatus(yoy.league_trend))}</strong>${
        yoy.avg_win_pct_change != null
          ? ` (avg W% Δ ${yoy.avg_win_pct_change >= 0 ? "+" : ""}${fmtPct(yoy.avg_win_pct_change)})`
          : ""
      }${
        yoy.season_games
          ? ` · Wins +/- paces current W% over a <strong>${escapeHtml(String(yoy.season_games))}</strong>-game season (from last year’s W+L).`
          : ""
      }</p>`
    : '<p class="muted">Need ly% / lyW / lyL on Team List for year-over-year trends.</p>';
  return `
    ${trend}
    <div class="table-wrap compact">
      <table class="data-table sortable">
        <thead><tr>
          <th>Team</th><th>Current W%</th><th>Last Year W%</th><th>Change</th>
          <th class="tip" data-tip="Projected full-season wins at current W% minus last year’s wins. Season length = median of last year’s W+L.">Wins +/- (pace)</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">No YoY data.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function render(report, teamsHaveDiv) {
  const talent = report.talent_distribution || {};
  contentEl.innerHTML = `
    <section class="panel league-section league-section-insights">
      <h2>Key Insights</h2>
      ${renderInsights(report.summary_insights)}
    </section>
    <section class="panel league-section league-section-summary">
      <h2>Season Summary</h2>
      ${renderSeasonSummary(report.environment || {}, report.parity || {}, talent.war_concentration)}
    </section>
    <section class="panel league-section league-section-parity">
      <h2>Competitive Balance</h2>
      ${renderParity(report.parity || {}, talent.war_concentration, teamsHaveDiv)}
    </section>
    <section class="panel league-section league-section-parks">
      <h2>Park Factors</h2>
      <p class="muted">Extreme parks (PF HR or PF AVG outside 0.90–1.10).</p>
      ${renderParks(report.park_factors || {})}
    </section>
    <section class="panel league-section league-section-talent">
      <h2>Talent Distribution</h2>
      <p class="muted">Majors WAR from Player List by ORG. Super teams: top-decile batting and pitching WAR (≥10 clubs).</p>
      ${renderTalent(talent)}
    </section>
    <section class="panel league-section league-section-divs">
      <h2>Division Breakdown</h2>
      ${renderDivisions(talent, teamsHaveDiv)}
    </section>
    <section class="panel league-section league-section-yoy">
      <h2>Year-over-Year Trends</h2>
      ${renderYoy(report.year_over_year || {})}
    </section>
  `;
}

const teamList = state.teamList || [];
if (!teamList.length) {
  emptyEl.hidden = false;
  contentEl.hidden = true;
} else {
  emptyEl.hidden = true;
  contentEl.hidden = false;
  const enriched = enrichTeamsWithRosterWar(teamList, state.pitchers, state.batters);
  const teamsHaveDiv = hasDivisionData(enriched);
  render(generateLeagueReport(enriched), teamsHaveDiv);
}
