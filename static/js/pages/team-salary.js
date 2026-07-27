import { mountShell, requireData } from "../shell.js?v=44";
import { setMajorsOnly, playerUrl, isMyTeam } from "../hector/store.js";
import { shouldHideNonMajor } from "../hector/league.js";
import {
  buildTeamSalaryView,
  orgsFromPlayers,
  yearColumnLabel,
  formatMoneyM,
  formatDpw,
} from "../hector/team_salary.js";
import { salaryPieSvg, sectionPieSlices } from "../hector/salary_charts.js";

if (!(await requireData())) throw new Error("redirect");
let state = await mountShell("team-salary");
if (state.majorsOnly == null) state.majorsOnly = true;

/** @type {"slr"|"aav"} */
let valueMode = "aav";
/** @type {"combined"|"simple"|"detail"} */
let groupLayout = "combined";
let selectedOrg = "";

/** @type {{ key: string, dir: "asc"|"desc" }} */
let sortState = { key: "year:0", dir: "desc" };

const teamSelect = document.getElementById("team-select");
const minorsToggle = document.getElementById("include-minors-toggle");
const modeBtns = document.querySelectorAll(".salary-mode-btn");
const layoutBtns = document.querySelectorAll(".salary-layout-btn");
const summaryEl = document.getElementById("team-salary-summary");
const emptyEl = document.getElementById("team-salary-empty");
const contentEl = document.getElementById("team-salary-content");

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function poolForOrg(org) {
  const majorsOnly = state.majorsOnly !== false;
  const orgU = String(org || "").toUpperCase();
  const out = [];
  for (const p of state.pitchers || []) {
    if (shouldHideNonMajor(p, majorsOnly)) continue;
    if (String(p.ORG || "").toUpperCase() !== orgU) continue;
    out.push(p);
  }
  for (const b of state.batters || []) {
    if (shouldHideNonMajor(b, majorsOnly)) continue;
    if (String(b.ORG || "").toUpperCase() !== orgU) continue;
    out.push(b);
  }
  return out;
}

function syncTeamSelect() {
  const orgs = orgsFromPlayers(state.pitchers, state.batters, {
    majorsOnly: state.majorsOnly !== false,
    shouldHide: shouldHideNonMajor,
  });
  const mine = String(state.myTeam || "").trim();
  if (!selectedOrg || !orgs.includes(selectedOrg)) {
    if (mine && orgs.some((o) => o.toUpperCase() === mine.toUpperCase())) {
      selectedOrg = orgs.find((o) => o.toUpperCase() === mine.toUpperCase()) || orgs[0] || "";
    } else {
      selectedOrg = orgs[0] || "";
    }
  }
  teamSelect.innerHTML = orgs
    .map((o) => {
      const mineMark = isMyTeam(o, state) ? " ★" : "";
      return `<option value="${escapeHtml(o)}"${o === selectedOrg ? " selected" : ""}>${escapeHtml(o)}${mineMark}</option>`;
    })
    .join("");
  return orgs;
}

function statusChip(status) {
  if (status === "pre_arb") return `<span class="salary-chip salary-chip-prearb">Pre-arb</span>`;
  if (status === "arbitration") return `<span class="salary-chip salary-chip-arb">Arb</span>`;
  if (status === "extension") return `<span class="salary-chip salary-chip-ext">Ext</span>`;
  return "";
}

function yearCell(slot, colIdx) {
  if (!slot) return `<td class="salary-year-cell"></td>`;
  const current = colIdx === 0 ? " is-current-year" : "";
  if (slot.kind === "fa") {
    return `<td class="salary-year-cell${current}"><span class="salary-fa-badge tip" data-tip="Free agent after last committed year.">FA</span></td>`;
  }
  if (slot.kind === "exp") {
    return `<td class="salary-year-cell${current}"><span class="salary-exp-badge tip" data-tip="Pre-arb / arb control year expires — not labeled FA (status may change).">EXP</span></td>`;
  }
  return `<td class="salary-year-cell salary-year-${slot.kind}${current}">
    <span class="salary-amt">${escapeHtml(formatMoneyM(slot.amountM))}</span>
  </td>`;
}

function playerMeta(r) {
  const chip = statusChip(r.slots[0]?.status);
  return `<span class="muted salary-player-meta">${escapeHtml(r.age)} · ${escapeHtml(r.pos)}${chip ? ` ${chip}` : ""}</span>`;
}

function nameCell(player) {
  const href = player.ID ? playerUrl(player.ID, state) : "";
  const name = escapeHtml(player.Name || "?");
  return href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${name}</a>`
    : name;
}

function myTeamHintHtml() {
  const mine = String(state.myTeam || "").trim();
  if (mine) return "";
  return `<p class="muted tip salary-myteam-hint" data-tip="Options → Your team sets the default franchise on this page.">
    No franchise set in <a href="options.html">Options</a> — pick a team above, or set your team to default here.
  </p>`;
}

function sortMarker(key) {
  if (sortState.key !== key) return "";
  return sortState.dir === "asc" ? " ↑" : " ↓";
}

function sortClass(key) {
  if (sortState.key !== key) return "";
  return ` is-sorted is-${sortState.dir}`;
}

/** Reorder a copy of rows; FA/EXP end markers sink to the bottom. */
function sortRows(rows) {
  const { key, dir } = sortState;
  const mult = dir === "asc" ? 1 : -1;
  const isEnd = (slot) => !slot || slot.kind === "fa" || slot.kind === "exp";
  return [...rows].sort((a, b) => {
    if (key === "name") {
      return a.name.localeCompare(b.name) * mult;
    }
    if (key === "dpw") {
      const av = a.dpw == null ? null : a.dpw;
      const bv = b.dpw == null ? null : b.dpw;
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      const d = (av - bv) * mult;
      return d || a.name.localeCompare(b.name);
    }
    if (key.startsWith("year:")) {
      const yi = Number(key.slice(5));
      const sa = a.slots[yi];
      const sb = b.slots[yi];
      const endA = isEnd(sa);
      const endB = isEnd(sb);
      if (endA && endB) return a.name.localeCompare(b.name);
      if (endA) return 1;
      if (endB) return -1;
      const d = ((sa.amountM || 0) - (sb.amountM || 0)) * mult;
      return d || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}

function sectionPieHtml(sec, { teamWide = false } = {}) {
  const slices = sectionPieSlices(sec.rows, sec.thisYearSum);
  const shareOf = teamWide ? "team" : "group";
  const title = teamWide ? "% of team" : "% of group";
  const pieSize = teamWide ? 300 : 220;
  if (!slices.length) {
    return `<aside class="salary-section-pie${teamWide ? " is-team-wide" : ""}">
      <p class="muted salary-pie-empty">No Now ${shareOf === "team" ? "payroll" : "AAV"} to chart</p>
    </aside>`;
  }
  const legend = slices
    .map(
      (s) =>
        `<li title="${escapeHtml(s.label)}: ${escapeHtml(formatMoneyM(s.value))} · ${s.pct.toFixed(1)}% of ${shareOf}">
          <span class="salary-swatch" style="background:${s.color}"></span>
          <span class="salary-legend-name">${escapeHtml(s.label)}</span>
          <span class="salary-legend-amt">${escapeHtml(formatMoneyM(s.value))} <span class="salary-legend-pct">${s.pct.toFixed(1)}%</span></span>
        </li>`,
    )
    .join("");

  return `<aside class="salary-section-pie${teamWide ? " is-team-wide" : ""}">
    <h4>${title}</h4>
    <div class="salary-pie-main">
      ${salaryPieSvg(slices, {
        size: pieSize,
        shareOf,
        ariaLabel: `${sec.label} percent of ${shareOf}`,
      })}
      <ul class="salary-pie-legend">${legend}</ul>
    </div>
  </aside>`;
}

function render() {
  const orgs = syncTeamSelect();
  if (!orgs.length || !selectedOrg) {
    emptyEl.hidden = false;
    contentEl.hidden = true;
    summaryEl.textContent = "";
    emptyEl.innerHTML = `<p class="muted">No teams found on the Player List. Upload a roster with <strong>ORG</strong> and contract columns (<strong>SLR</strong>, <strong>YL</strong>; ideally <strong>CV</strong>/<strong>TY</strong>/<strong>ECV</strong>/<strong>ETY</strong>). Set your franchise in <a href="options.html">Options</a> to default here, or pick a team once data loads.</p>`;
    return;
  }
  emptyEl.hidden = true;
  contentEl.hidden = false;

  const players = poolForOrg(selectedOrg);
  const view = buildTeamSalaryView(players, { valueMode, groupLayout });
  const modeLabel = valueMode === "aav" ? "AAV" : "Salary";
  summaryEl.textContent = `${view.playerCount} players · This year ${modeLabel} ${formatMoneyM(view.teamThisYear)}`;

  const colLabels = Array.from({ length: view.columnCount }, (_, i) => yearColumnLabel(i));

  let html = myTeamHintHtml();
  for (const sec of view.sections) {
    const pct = sec.pctOfTeam.toFixed(1);
    const rows = sortRows(sec.rows);
    html += `<section class="salary-section">
      <header class="salary-section-head">
        <h3>${escapeHtml(String(sec.count))} ${escapeHtml(sec.label)}</h3>
        <span class="salary-section-meta">${escapeHtml(formatMoneyM(sec.thisYearSum))}${
          groupLayout === "combined" ? "" : ` · ${escapeHtml(pct)}% of team`
        }</span>
      </header>
      <div class="salary-section-body">
        <div class="salary-table-scroll">
          <table class="salary-grid">
            <thead>
              <tr>
                <th class="salary-sticky salary-sort${sortClass("name")}" data-sort="name" title="Sort by name">Player${sortMarker("name")}</th>
                <th class="salary-dpw-head salary-sort tip${sortClass("dpw")}" data-sort="dpw" data-tip="Current-season salary ÷ WAR (SLR ÷ WAR). Click to sort.">$/WAR${sortMarker("dpw")}</th>
                ${colLabels
                  .map((lab, i) => {
                    const key = `year:${i}`;
                    const tipAttrs =
                      i === 0
                        ? ` data-tip="This season (relative year 0). Click to sort."`
                        : ` title="Sort by ${escapeHtml(lab)}"`;
                    return `<th class="salary-year-head salary-sort${sortClass(key)}${i === 0 ? " is-current-year tip" : ""}" data-sort="${key}"${tipAttrs}>${escapeHtml(lab)}${sortMarker(key)}</th>`;
                  })
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((r) => {
                  const cells = [];
                  for (let i = 0; i < view.columnCount; i++) {
                    cells.push(yearCell(r.slots[i], i));
                  }
                  return `<tr data-player-id="${escapeHtml(r.player.ID || "")}" data-player-name="${escapeHtml(r.name)}" data-player-type="${r.type}">
                    <td class="salary-sticky">
                      <span class="salary-player-inner">
                        <strong>${nameCell(r.player)}</strong>${playerMeta(r)}
                      </span>
                    </td>
                    <td class="salary-dpw${r.dpw != null && r.dpw < 0 ? " is-neg" : ""}">${escapeHtml(formatDpw(r.dpw))}</td>
                    ${cells.join("")}
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
          ${sectionPieHtml(sec, { teamWide: groupLayout === "combined" })}
        </div>
      </div>
    </section>`;
  }

  if (!view.sections.length) {
    html = `${myTeamHintHtml()}<p class="muted panel">No rostered players for ${escapeHtml(selectedOrg)} with the current filters.</p>`;
  }

  contentEl.innerHTML = html;
}

contentEl.addEventListener("click", (e) => {
  const th = e.target.closest("th[data-sort]");
  if (!th || !contentEl.contains(th)) return;
  const key = th.dataset.sort;
  if (!key) return;
  if (sortState.key === key) {
    sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
  } else {
    sortState.key = key;
    sortState.dir = key === "name" ? "asc" : "desc";
  }
  render();
});

teamSelect.addEventListener("change", () => {
  selectedOrg = teamSelect.value;
  render();
});

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    valueMode = btn.dataset.mode === "slr" ? "slr" : "aav";
    modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === valueMode));
    render();
  });
});

layoutBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const lay = btn.dataset.layout;
    groupLayout = lay === "detail" ? "detail" : lay === "simple" ? "simple" : "combined";
    layoutBtns.forEach((b) => b.classList.toggle("active", b.dataset.layout === groupLayout));
    render();
  });
});

if (minorsToggle) {
  minorsToggle.checked = state.majorsOnly === false;
  minorsToggle.addEventListener("change", async () => {
    state = await setMajorsOnly(!minorsToggle.checked);
    render();
  });
}

render();
