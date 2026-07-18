import { mountShell, requireData } from "../shell.js?v=36";
import {
  findComparablePlayers,
  suggestContract,
  rankComparables,
  getMatchingPlayers,
} from "../hector/index.js";
import { findPlayerByName } from "../hector/trade.js";
import { buildDollarWarIndex, formatDpw } from "../hector/dollar_war.js";
import { playerUrl } from "../hector/store.js";
import { formatOrdinal } from "../hector/util.js";
import { writeCompareSeed } from "../compare_seed.js";

if (!(await requireData())) throw new Error("redirect");
const state = await mountShell("contract");
const dwIndex = buildDollarWarIndex(state.pitchers, state.batters);

const MAX_COMP_PICKS = 2;

/** @type {{ player: object, playerType: "batter"|"pitcher", comps: object[] } | null} */
let lastAnalysis = null;

/** @type {Set<string>} */
let selectedCompKeys = new Set();

function compKey(row) {
  return `${row.id || ""}::${row.name || ""}`;
}

function wireAutocomplete(input) {
  let box = null;
  let timer = null;
  function close() {
    if (box) {
      box.remove();
      box = null;
    }
  }
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 1) {
      close();
      return;
    }
    timer = setTimeout(() => {
      const items = getMatchingPlayers(q, state.pitchers, state.batters, 12);
      close();
      if (!items.length) return;
      box = document.createElement("div");
      box.className = "ac-dropdown";
      items.forEach((item) => {
        const div = document.createElement("div");
        div.textContent = item.display;
        div.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = item.name;
          close();
        });
        box.appendChild(div);
      });
      const parent = input.closest(".autocomplete-form") || input.parentElement;
      parent.style.position = "relative";
      parent.appendChild(box);
    }, 120);
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}

function includePreFaChecked() {
  return document.getElementById("include-prefa").checked;
}

function updateCompareBar() {
  const bar = document.getElementById("contract-compare-bar");
  const btn = document.getElementById("contract-compare-btn");
  if (!lastAnalysis) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const n = selectedCompKeys.size;
  btn.disabled = n < 1 || n > MAX_COMP_PICKS;
  btn.textContent =
    n === 0
      ? "Compare selected"
      : `Compare selected (${n})`;
}

function renderSuggestion(player, playerType, comps, includePreFa) {
  const suggestion = suggestContract(comps, player, playerType, { includePreFa });
  const sugEl = document.getElementById("suggestion");
  const ctx = dwIndex.context(player, playerType);
  const dpwNote =
    ctx.median != null
      ? ` · ${ctx.pool_label} $/WAR median ${formatDpw(ctx.median)}${
          ctx.dpw != null ? ` · player ${formatDpw(ctx.dpw)}` : ""
        }${ctx.percentile != null ? ` · ${formatOrdinal(ctx.percentile)} pct` : ""}`
      : "";
  if (suggestion) {
    const n = suggestion.n_comps ?? 0;
    const methodLabel =
      suggestion.method === "dollar_per_war" ? "$/WAR × WAR" : "median SLR";
    const preFaNote = includePreFa
      ? "including pre-arb/arb"
      : "signed deals only";
    sugEl.innerHTML = `Suggested: <strong>${suggestion.aav_display}</strong> AAV × <strong>${suggestion.years}</strong> yrs = ${suggestion.total_display} <span class="muted">(${methodLabel}, ${n} comps, ${preFaNote}${dpwNote})</span>`;
  } else if (!includePreFa) {
    sugEl.textContent =
      "No contract suggestion — need at least 3 signed comps with salary. Try widening filters or enable “Include pre-arb / arb comps”." +
      (dpwNote ? dpwNote.replace(/^ · /, " ") : "");
  } else {
    sugEl.textContent =
      "No contract suggestion (need comps with salary data)." +
      (dpwNote ? dpwNote.replace(/^ · /, " ") : "");
  }
}

function rowCheckbox(c) {
  const key = compKey(c);
  const checked = selectedCompKeys.has(key) ? "checked" : "";
  const atCap = selectedCompKeys.size >= MAX_COMP_PICKS && !selectedCompKeys.has(key);
  const disabled = atCap ? "disabled" : "";
  return `<td class="contract-comp-pick"><input type="checkbox" class="comp-pick" data-comp-key="${escapeAttr(key)}" data-comp-id="${escapeAttr(c.id || "")}" data-comp-name="${escapeAttr(c.name || "")}" ${checked} ${disabled} aria-label="Select ${escapeAttr(c.name || "comp")} for compare" /></td>`;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function playerNameLink(name, id) {
  const href = id ? playerUrl(id, state) : "";
  if (!href) return escapeHtml(name);
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`;
}

function renderCompsTable(player, playerType, comps, includePreFa) {
  let ranked = rankComparables(comps, player, playerType, 30);
  if (!includePreFa) {
    ranked = ranked.filter((c) => c.status === "signed");
  }

  // Drop selections that are no longer visible.
  const visible = new Set(ranked.map((c) => compKey(c)));
  for (const key of [...selectedCompKeys]) {
    if (!visible.has(key)) selectedCompKeys.delete(key);
  }

  const wrap = document.getElementById("comps-wrap");
  wrap.hidden = false;
  const head = document.getElementById("comps-head");
  const body = document.getElementById("comps-body");
  if (playerType === "batter") {
    head.innerHTML = `<tr><th class="contract-comp-pick"></th><th>Name</th><th>Team</th><th>POS</th><th>Age</th><th>G</th><th>OPS+</th><th>wRC+</th><th>WAR</th><th>SLR</th><th>YL</th><th>Status</th><th>CV</th><th>Sim</th></tr>`;
    body.innerHTML = ranked.length
      ? ranked
          .map(
            (c) => `<tr data-player-id="${escapeAttr(c.id)}" data-player-name="${escapeAttr(c.name)}" data-player-type="${escapeAttr(playerType)}">
        ${rowCheckbox(c)}
        <td>${playerNameLink(c.name, c.id)}</td><td>${escapeHtml(c.team)}</td><td>${escapeHtml(c.pos)}</td><td>${escapeHtml(c.age)}</td>
        <td>${escapeHtml(c.g)}</td><td>${escapeHtml(c.ops)}</td><td>${escapeHtml(c.wrc)}</td><td>${escapeHtml(c.war)}</td>
        <td>${escapeHtml(c.slr)}</td><td>${escapeHtml(c.yl)}</td><td>${escapeHtml(c.status_label)}</td><td>${escapeHtml(c.cv)}</td><td>${escapeHtml(c.similarity)}</td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="14" class="muted">No comparable players found${includePreFa ? "" : " (signed deals only — enable pre-arb/arb to show more)"}</td></tr>`;
  } else {
    head.innerHTML = `<tr><th class="contract-comp-pick"></th><th>Name</th><th>Team</th><th>POS</th><th>Age</th><th>IP</th><th>ERA+</th><th>FIP-</th><th>WAR</th><th>rWAR</th><th>SLR</th><th>YL</th><th>Status</th><th>CV</th><th>Sim</th></tr>`;
    body.innerHTML = ranked.length
      ? ranked
          .map(
            (c) => `<tr data-player-id="${escapeAttr(c.id)}" data-player-name="${escapeAttr(c.name)}" data-player-type="${escapeAttr(playerType)}">
        ${rowCheckbox(c)}
        <td>${playerNameLink(c.name, c.id)}</td><td>${escapeHtml(c.team)}</td><td>${escapeHtml(c.pos)}</td><td>${escapeHtml(c.age)}</td>
        <td>${escapeHtml(c.ip)}</td><td>${escapeHtml(c.era)}</td><td>${escapeHtml(c.fip)}</td><td>${escapeHtml(c.war)}</td><td>${escapeHtml(c.rwar)}</td>
        <td>${escapeHtml(c.slr)}</td><td>${escapeHtml(c.yl)}</td><td>${escapeHtml(c.status_label)}</td><td>${escapeHtml(c.cv)}</td><td>${escapeHtml(c.similarity)}</td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="15" class="muted">No comparable players found${includePreFa ? "" : " (signed deals only — enable pre-arb/arb to show more)"}</td></tr>`;
  }
  updateCompareBar();
}

function renderResults() {
  if (!lastAnalysis) return;
  const includePreFa = includePreFaChecked();
  const { player, playerType, comps } = lastAnalysis;
  renderSuggestion(player, playerType, comps, includePreFa);
  renderCompsTable(player, playerType, comps, includePreFa);
}

function goToCompare() {
  if (!lastAnalysis || selectedCompKeys.size < 1) return;
  const { player, playerType } = lastAnalysis;
  const players = [
    { id: String(player.ID || ""), name: String(player.Name || "") },
  ];
  document.querySelectorAll(".comp-pick:checked").forEach((el) => {
    players.push({
      id: el.dataset.compId || "",
      name: el.dataset.compName || "",
    });
  });
  try {
    writeCompareSeed({ type: playerType, pool: "roster", players });
  } catch (_) {
    /* ignore */
  }
  window.location.href = "compare.html";
}

function readFilters(player) {
  let age;
  try {
    age = parseInt(player.Age ?? 25, 10);
    if (!Number.isFinite(age)) age = 25;
  } catch {
    age = 25;
  }
  const ageRaw = document.getElementById("age-window").value.trim();
  let minAge = 0;
  let maxAge = 99;
  if (ageRaw !== "") {
    const ageWindow = Number(ageRaw);
    if (Number.isFinite(ageWindow) && ageWindow >= 0) {
      minAge = age - ageWindow;
      maxAge = age + ageWindow;
    }
  }
  return {
    posFilter: document.getElementById("pos-filter").value,
    minAge,
    maxAge,
    opsPercent: Number(document.getElementById("ops-percent").value),
    wrcPercent: Number(document.getElementById("wrc-percent").value),
    warBatterRange: Number(document.getElementById("war-batter").value),
    eraPercent: Number(document.getElementById("era-percent").value),
    fipPercent: Number(document.getElementById("fip-percent").value),
    warPitcherRange: Number(document.getElementById("war-pitcher").value),
    rwarRange: Number(document.getElementById("rwar-range").value),
  };
}

function runAnalysis(player, playerType, { resetCompPicks = true } = {}) {
  const pool = playerType === "pitcher" ? state.pitchers : state.batters;
  const comps = findComparablePlayers(player, playerType, pool, readFilters(player));
  lastAnalysis = { player, playerType, comps };
  if (resetCompPicks) selectedCompKeys = new Set();

  const panel = document.getElementById("result-panel");
  panel.hidden = false;
  document.getElementById("selected-title").innerHTML =
    `${playerNameLink(player.Name, player.ID)} (${escapeHtml(player.ORG)}, ${escapeHtml(player.POS)}, Age ${escapeHtml(player.Age)})`;
  if (playerType === "batter") {
    document.getElementById("selected-meta").textContent =
      `OPS+ ${player["OPS+"] ?? "-"} · wRC+ ${player["wRC+"] ?? "-"} · WAR ${player["WAR (Batter)"] ?? player.WAR ?? "-"} · SLR ${player.SLR ?? "-"} · YL ${player.YL ?? "-"}`;
  } else {
    document.getElementById("selected-meta").textContent =
      `ERA+ ${player["ERA+"] ?? "-"} · FIP- ${player["FIP-"] ?? "-"} · WAR ${player["WAR (Pitcher)"] ?? player.WAR ?? "-"} · rWAR ${player.rWAR ?? "-"} · SLR ${player.SLR ?? "-"} · YL ${player.YL ?? "-"}`;
  }

  renderResults();
}

function refreshAnalysisFromFilters() {
  if (!lastAnalysis) return;
  runAnalysis(lastAnalysis.player, lastAnalysis.playerType, { resetCompPicks: true });
}

wireAutocomplete(document.getElementById("player-name"));

document.getElementById("include-prefa").addEventListener("change", () => {
  renderResults();
});

const filterIds = [
  "pos-filter",
  "age-window",
  "ops-percent",
  "wrc-percent",
  "war-batter",
  "era-percent",
  "fip-percent",
  "war-pitcher",
  "rwar-range",
];
for (const id of filterIds) {
  const el = document.getElementById(id);
  if (!el) continue;
  const evt = el.tagName === "SELECT" ? "change" : "input";
  el.addEventListener(evt, refreshAnalysisFromFilters);
}

document.getElementById("comps-body").addEventListener("change", (e) => {
  const input = e.target.closest(".comp-pick");
  if (!input) return;
  const key = input.dataset.compKey;
  if (!key) return;
  if (input.checked) {
    if (selectedCompKeys.size >= MAX_COMP_PICKS) {
      input.checked = false;
      return;
    }
    selectedCompKeys.add(key);
  } else {
    selectedCompKeys.delete(key);
  }
  // Re-render so other checkboxes enable/disable at cap.
  if (lastAnalysis) {
    renderCompsTable(
      lastAnalysis.player,
      lastAnalysis.playerType,
      lastAnalysis.comps,
      includePreFaChecked(),
    );
  } else {
    updateCompareBar();
  }
});

document.getElementById("contract-compare-btn").addEventListener("click", goToCompare);

document.getElementById("contract-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("player-name").value;
  const hit = findPlayerByName(name, state.pitchers, state.batters);
  if (!hit) {
    alert("Player not found");
    return;
  }
  const playerType = hit.type === "pitcher" ? "pitcher" : "batter";
  runAnalysis(hit.player, playerType, { resetCompPicks: true });
});
