import { mountShell, requireData } from "../shell.js?v=45";
import { playerUrl } from "../hector/store.js";
import { isMajorLeague } from "../hector/league.js";
import {
  HIDDEN_GEM_CATEGORIES,
  findAllHiddenGems,
  getHiddenGemsSummary,
} from "../hector/hidden_gems.js";

if (!(await requireData())) throw new Error("redirect");
const state = await mountShell("hidden-gems");

/** @type {"all"|"batter"|"pitcher"} */
let playerType = "all";
/** @type {string} "" = all categories */
let selectedCategory = "";
let includeMajors = true;
/** @type {{ label: string, dir: "asc"|"desc" } | null} */
let sortState = { label: "Gem%", dir: "desc" };

const typeBtns = document.querySelectorAll(".compare-type-btn");
const majorsToggle = document.getElementById("include-majors-toggle");
const searchEl = document.getElementById("player-search");
const countEl = document.getElementById("filter-count");
const body = document.getElementById("hidden-gems-body");
const cardsEl = document.getElementById("gems-cards");
const parkHint = document.getElementById("park-list-hint");
const headRow = document.getElementById("table-head-row");

const gemsData = findAllHiddenGems(state.batters, state.pitchers, state.teamList);

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeTip(s) {
  return escapeHtml(s).replace(/\n/g, "&#10;");
}

function nameCell(p, tip) {
  const href = p.ID ? playerUrl(p.ID, state) : "";
  const name = escapeHtml(p.Name || "?");
  const tipClass = tip ? " tip" : "";
  const tipAttr = tip ? ` data-tip="${escapeTip(tip)}"` : "";
  const inner = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${name}</a>`
    : name;
  return `<span class="gems-name${tipClass}"${tipAttr}>${inner}</span>`;
}

function categoryMeta(key) {
  return HIDDEN_GEM_CATEGORIES[key] || { name: key, color: "#888", description: "" };
}

function passesMajorsFilter(row) {
  // AAAA / Toolsy = minors-only; Park Nerfed = majors-only (finders enforce).
  if (row.category === "aaaa" || row.category === "toolsy" || row.category === "park_nerfed") {
    return true;
  }
  if (includeMajors) return true;
  return isMajorLeague(row.player) !== true;
}

function filteredRows() {
  const q = (searchEl?.value || "").trim().toLowerCase();
  let rows = gemsData.all;
  if (selectedCategory) {
    rows = gemsData.byCategory[selectedCategory] || [];
  }
  return rows.filter((r) => {
    if (playerType !== "all" && r.type !== playerType) return false;
    if (!passesMajorsFilter(r)) return false;
    if (!q) return true;
    const hay = `${r.name} ${r.team} ${r.pos} ${r.lev} ${r.keyStat} ${r.whyHidden} ${r.upside}`.toLowerCase();
    return hay.includes(q);
  });
}

function sortRows(rows) {
  if (!sortState) return rows;
  const { label, dir } = sortState;
  const mult = dir === "asc" ? 1 : -1;
  const accessors = {
    Category: (r) => categoryMeta(r.category).name,
    Name: (r) => r.name,
    Team: (r) => r.team,
    POS: (r) => r.pos,
    Age: (r) => r.age,
    Lev: (r) => r.lev,
    "Gem%": (r) => r.gemFit ?? 0,
    Key: (r) => r.keyStat,
  };
  const get = accessors[label] || accessors.Name;
  return [...rows].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    if (typeof av === "number" && typeof bv === "number") {
      const d = (av - bv) * mult;
      return d || a.name.localeCompare(b.name);
    }
    return String(av).localeCompare(String(bv)) * mult || a.name.localeCompare(b.name);
  });
}

function renderCards() {
  const summary = getHiddenGemsSummary(gemsData.byCategory);
  const totalVisible = gemsData.all.filter(passesMajorsFilter).filter((r) => {
    if (playerType === "all") return true;
    return r.type === playerType;
  }).length;

  const allCard = `<button type="button" class="gems-card${selectedCategory === "" ? " is-active" : ""}" data-category="">
    <span class="gems-card-name">All</span>
    <span class="gems-card-count">${totalVisible}</span>
    <span class="gems-card-desc">Every matching gem</span>
  </button>`;

  const catCards = Object.keys(HIDDEN_GEM_CATEGORIES)
    .map((key) => {
      const meta = summary[key];
      const count = (gemsData.byCategory[key] || []).filter((r) => {
        if (!passesMajorsFilter(r)) return false;
        if (playerType !== "all" && r.type !== playerType) return false;
        return true;
      }).length;
      const active = selectedCategory === key ? " is-active" : "";
      return `<button type="button" class="gems-card${active}" data-category="${escapeHtml(key)}" style="--gem-color:${meta.color}">
        <span class="gems-card-name">${escapeHtml(meta.name)}</span>
        <span class="gems-card-count">${count}</span>
        <span class="gems-card-desc">${escapeHtml(meta.description)}</span>
      </button>`;
    })
    .join("");

  cardsEl.innerHTML = allCard + catCards;
}

function render() {
  if (parkHint) parkHint.hidden = gemsData.hasTeamList;

  renderCards();
  const rows = sortRows(filteredRows());
  if (countEl) {
    countEl.textContent = `${rows.length} player${rows.length === 1 ? "" : "s"}`;
  }

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="muted">No hidden gems match these filters.${
      !gemsData.hasTeamList && selectedCategory === "park_nerfed"
        ? " Upload a Team List for Park Nerfed."
        : ""
    }</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((r) => {
      const meta = categoryMeta(r.category);
      const tip = `Why: ${r.whyHidden}\nUpside: ${r.upside}`;
      return `<tr data-player-id="${escapeHtml(r.player.ID || "")}" data-player-name="${escapeHtml(r.name)}" data-player-type="${r.type}" data-player-card-tab="ratings">
        <td><span class="gems-cat-pill" style="--gem-color:${meta.color}">${escapeHtml(meta.name)}</span></td>
        <td>${nameCell(r.player, tip)}</td>
        <td>${escapeHtml(r.team || "—")}</td>
        <td>${escapeHtml(r.pos || "—")}</td>
        <td>${r.age || "—"}</td>
        <td>${escapeHtml(r.lev)}</td>
        <td class="num-strong tip" data-tip="Gem fit for this category only (0–100). Not the Archetypes Fit %.">${r.gemFit ?? "—"}</td>
        <td class="gems-key">${escapeHtml(r.keyStat)}</td>
      </tr>`;
    })
    .join("");
}

cardsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".gems-card");
  if (!btn) return;
  selectedCategory = btn.dataset.category || "";
  render();
});

typeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    playerType = btn.dataset.type === "batter" || btn.dataset.type === "pitcher" ? btn.dataset.type : "all";
    typeBtns.forEach((b) => b.classList.toggle("active", b.dataset.type === playerType));
    render();
  });
});

if (majorsToggle) {
  majorsToggle.checked = true;
  majorsToggle.addEventListener("change", () => {
    includeMajors = majorsToggle.checked;
    render();
  });
}

searchEl?.addEventListener("input", () => render());

headRow?.addEventListener("click", (e) => {
  const th = e.target.closest("th[data-col]");
  if (!th) return;
  const label = th.dataset.col;
  if (!label) return;
  if (sortState?.label === label) {
    sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
  } else {
    sortState = { label, dir: label === "Name" || label === "Team" ? "asc" : "desc" };
  }
  render();
});

render();
