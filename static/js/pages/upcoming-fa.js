import { mountShell, requireData } from "../shell.js?v=45";
import { setMajorsOnly, setUseStatsScoring, playerUrl, isMyTeam } from "../hector/store.js";
import { isUpcomingFA, getWar, parseYearsLeft } from "../hector/player_analytics.js";
import { shouldHideNonMajor } from "../hector/league.js";
import { duraClass } from "../column-filter.js";

if (!(await requireData())) throw new Error("redirect");
let state = await mountShell("upcoming-fa");
if (state.majorsOnly == null) state.majorsOnly = true;

/** @type {"all"|"batter"|"pitcher"} */
let playerType = "all";
/** @type {{ label: string, dir: "asc"|"desc" } | null} */
let sortState = { label: "WAR", dir: "desc" };

const typeBtns = document.querySelectorAll(".compare-type-btn");
const minorsToggle = document.getElementById("include-minors-toggle");
const statsToggle = document.getElementById("stats-scoring-toggle");
const searchEl = document.getElementById("player-search");
const countEl = document.getElementById("filter-count");
const body = document.getElementById("upcoming-fa-body");
const headRow = document.getElementById("table-head-row");
const totalTipEl = document.getElementById("total-col-tip");

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

function duraTd(prone) {
  const text = String(prone ?? "").trim() || "—";
  const cls = text === "—" ? "" : duraClass(prone);
  return cls
    ? `<td class="${cls}">${escapeHtml(text)}</td>`
    : `<td>${escapeHtml(text)}</td>`;
}

function nameCell(p) {
  const href = p.ID ? playerUrl(p.ID, state) : "";
  const name = escapeHtml(p.Name || "?");
  return href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${name}</a>`
    : name;
}

function handFor(p, type) {
  return type === "pitcher" ? dash(p.T) : dash(p.B);
}

function syncTotalTip() {
  if (!totalTipEl) return;
  totalTipEl.dataset.tip = state.useStatsScoring
    ? "Hector stats Total (same global mode as Pitchers/Batters). Toggle Use Ratings-Based Scoring for ratings Total."
    : "Hector ratings Total (same global mode as Pitchers/Batters). Uncheck Use Ratings-Based Scoring for stats Total.";
}

function buildRows() {
  const majorsOnly = state.majorsOnly !== false;
  const out = [];

  function push(player, type) {
    if (shouldHideNonMajor(player, majorsOnly)) return;
    if (!isUpcomingFA(player)) return;
    const war = getWar(player, type);
    const total = Number(player.Scores?.total ?? 0);
    out.push({
      player,
      type,
      war,
      total,
      age: Number(player.Age) || 0,
      name: String(player.Name || ""),
      team: String(player.ORG || ""),
      pos: String(player.POS || ""),
      yl: parseYearsLeft(player.YL).years,
    });
  }

  if (playerType === "all" || playerType === "batter") {
    for (const b of state.batters || []) push(b, "batter");
  }
  if (playerType === "all" || playerType === "pitcher") {
    for (const p of state.pitchers || []) push(p, "pitcher");
  }
  return out;
}

function parseCell(text) {
  text = (text || "").trim();
  if (text === "" || text === "-" || text === "—" || text === "N/A") return { n: null, s: text };
  const cleaned = text.replace(/,/g, "").replace(/\$/g, "").replace(/ Stars/gi, "");
  const num = parseFloat(cleaned);
  if (!Number.isNaN(num) && /^-?\d/.test(cleaned)) return { n: num, s: text };
  return { n: null, s: text.toLowerCase() };
}

function sortRows(rows) {
  const label = sortState?.label || "WAR";
  const asc = sortState?.dir === "asc";
  const keyFn = {
    Name: (r) => r.name.toLowerCase(),
    Team: (r) => r.team.toLowerCase(),
    Age: (r) => r.age,
    POS: (r) => r.pos.toLowerCase(),
    Hand: (r) => handFor(r.player, r.type).toLowerCase(),
    OVR: (r) => parseCell(String(r.player.OVR || "")).n ?? -1,
    POT: (r) => parseCell(String(r.player.POT || "")).n ?? -1,
    YL: (r) => r.yl,
    SLR: (r) => parseCell(String(r.player.SLR || "")).n ?? -1,
    CV: (r) => parseCell(String(r.player.CV || "")).n ?? -1,
    WAR: (r) => r.war,
    Total: (r) => r.total,
    Dura: (r) => String(r.player.Prone || "").toLowerCase(),
  }[label] || ((r) => r.war);

  rows.sort((a, b) => {
    const av = keyFn(a);
    const bv = keyFn(b);
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    if (cmp !== 0) return asc ? cmp : -cmp;
    if (b.war !== a.war) return b.war - a.war;
    return b.total - a.total;
  });
  return rows;
}

function syncSortHeaders() {
  headRow.querySelectorAll("th").forEach((th) => {
    const lab = th.dataset.col;
    if (sortState && lab === sortState.label) {
      th.dataset.sort = sortState.dir;
      th.setAttribute("aria-sort", sortState.dir === "asc" ? "ascending" : "descending");
    } else {
      delete th.dataset.sort;
      th.removeAttribute("aria-sort");
    }
  });
}

function render() {
  syncTotalTip();
  syncSortHeaders();
  let rows = buildRows();
  const q = (searchEl.value || "").trim().toLowerCase();
  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    rows = rows.filter((r) => {
      const hay = `${r.name} ${r.team} ${r.pos}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }
  sortRows(rows);

  countEl.textContent = `${rows.length} player${rows.length === 1 ? "" : "s"}`;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="13" class="muted">No upcoming free agents match. Need signed YL = 1 with no extension (ECV/ETY). Check MISC columns on Upload, or clear filters.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((r) => {
      const p = r.player;
      const mine = isMyTeam(p.ORG, state);
      const tipAttr = mine ? ` class="tip hl-my-team" data-tip="Your team (set in Options)."` : "";
      return `<tr${tipAttr} data-player-id="${escapeHtml(p.ID || "")}" data-player-name="${escapeHtml(p.Name || "")}" data-player-type="${r.type}">
        <td>${nameCell(p)}</td>
        <td>${escapeHtml(dash(p.ORG))}</td>
        <td>${escapeHtml(dash(p.Age))}</td>
        <td>${escapeHtml(dash(p.POS))}</td>
        <td>${escapeHtml(handFor(p, r.type))}</td>
        <td>${escapeHtml(dash(p.OVR))}</td>
        <td>${escapeHtml(dash(p.POT))}</td>
        <td>${escapeHtml(dash(p.YL))}</td>
        <td>${escapeHtml(dash(p.SLR))}</td>
        <td>${escapeHtml(dash(p.CV))}</td>
        <td>${escapeHtml(String(r.war || 0))}</td>
        <td class="num-strong">${escapeHtml(String(r.total ?? 0))}</td>
        ${duraTd(p.Prone)}
      </tr>`;
    })
    .join("");
}

typeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    playerType = btn.dataset.type === "batter" || btn.dataset.type === "pitcher" ? btn.dataset.type : "all";
    typeBtns.forEach((b) => b.classList.toggle("active", b.dataset.type === playerType));
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

if (statsToggle) {
  // Checked = ratings mode (same as Pitchers/Batters); default unchecked = stats
  statsToggle.checked = !state.useStatsScoring;
  statsToggle.addEventListener("change", async () => {
    const useStats = !statsToggle.checked;
    state = await setUseStatsScoring(useStats);
    render();
  });
}

searchEl.addEventListener("input", () => render());

headRow.addEventListener("click", (e) => {
  const th = e.target.closest("th[data-col]");
  if (!th) return;
  const label = th.dataset.col;
  if (!label) return;
  const dir =
    sortState && sortState.label === label && sortState.dir === "desc" ? "asc" : "desc";
  sortState = { label, dir };
  render();
});

render();
