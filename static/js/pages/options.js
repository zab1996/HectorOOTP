import { mountShell } from "../shell.js?v=38";
import {
  loadState,
  setWeights,
  setStatWeights,
  resetWeights,
  hasData,
  setUrlTemplate,
  setMyTeam,
  listOrgAbbrs,
} from "../hector/store.js";
import {
  PITCHER_SECTIONS,
  BATTER_SECTIONS,
  PITCHER_STAT_SECTIONS,
  BATTER_STAT_SECTIONS,
  flattenWeights,
  groupRows,
  applyFormWeights,
  OPTIONS_HIDDEN_STAT_SECTIONS,
  WEIGHT_FIELD_TIPS,
  SECTION_BLURBS,
  defensePositionSubgroups,
} from "../hector/weights_ui.js";
import { defaultPitcherWeights, defaultBatterWeights } from "../hector/weights.js";
import { mergePitcherStatWeights, mergeBatterStatWeights } from "../hector/stat_weights.js";

const DEFAULT_URL_TEMPLATE =
  "https://atl-01.statsplus.net/rfbl/player/{pid}?page=dash";

const TABS = ["pitchers", "batters", "pitcher-stats", "batter-stats"];
const state = await mountShell("options");

function getTabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("tab");
  if (TABS.includes(fromQuery)) return fromQuery;
  const fromHash = window.location.hash.replace(/^#/, "");
  if (TABS.includes(fromHash)) return fromHash;
  return "pitchers";
}

let tab = getTabFromUrl();

function flashBanner(msg) {
  const banner = document.getElementById("save-banner");
  banner.hidden = false;
  banner.textContent = msg;
}

function updateBadge() {
  const badge = document.getElementById("weights-badge");
  if (state.weightsCustomized) {
    badge.textContent = "Custom weights active";
    badge.className = "badge";
  } else {
    badge.textContent = "Defaults";
    badge.className = "badge muted-badge";
  }
}

function renderLinks() {
  const s = loadState();
  document.getElementById("url-template").value = s.urlTemplate || DEFAULT_URL_TEMPLATE;
}

function renderMyTeam() {
  const s = loadState();
  const select = document.getElementById("my-team");
  const hint = document.getElementById("my-team-hint");
  if (!select) return;
  const orgs = listOrgAbbrs(s);
  const current = String(s.myTeam || "").trim();
  const options = ['<option value="">— None —</option>'];
  if (current && !orgs.some((o) => o.toUpperCase() === current.toUpperCase())) {
    options.push(`<option value="${escapeAttr(current)}">${escapeAttr(current)} (saved)</option>`);
  }
  for (const o of orgs) {
    options.push(`<option value="${escapeAttr(o)}">${escapeAttr(o)}</option>`);
  }
  select.innerHTML = options.join("");
  select.value = current;
  if (![...select.options].some((opt) => opt.value === current) && current) {
    // Fall back to matching case-insensitively
    const match = [...select.options].find(
      (opt) => opt.value.toUpperCase() === current.toUpperCase()
    );
    if (match) select.value = match.value;
  }
  if (hint) hint.hidden = orgs.length > 0 || !!current;
}

function fieldTip(row, groupTip) {
  const specific = WEIGHT_FIELD_TIPS[row.path];
  if (specific) return specific;
  if (groupTip) return `${row.label}\n${groupTip}`;
  return row.path;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldInputsHtml(rows, groupTip, prefix) {
  return rows
    .map(
      (row) => `
          <label class="weight-field tip" data-tip="${escapeAttr(fieldTip(row, groupTip))}">
            <span>${escapeHtml(row.label)}</span>
            <input type="number" step="any" name="${prefix}.${row.path}" value="${row.value}" />
          </label>`
    )
    .join("");
}

function renderPanel(el, weights, sections, prefix, saveLabel) {
  const rows = flattenWeights(weights).filter((r) => !OPTIONS_HIDDEN_STAT_SECTIONS.has(r.section));
  const groups = groupRows(rows, sections);
  el.innerHTML =
    groups
      .map((g) => {
        const blurb = SECTION_BLURBS[`${prefix}:${g.key}`] || SECTION_BLURBS[g.key] || "";
        let body;
        if (g.key === "defense") {
          const subgroups = defensePositionSubgroups(g.rows);
          body = subgroups
            .map(
              (sg) => `
      <div class="weight-subgroup">
        <h3>${escapeHtml(sg.title)}</h3>
        <div class="weight-grid">
          ${fieldInputsHtml(sg.rows, g.tip, prefix)}
        </div>
      </div>`
            )
            .join("");
        } else {
          body = `<div class="weight-grid">${fieldInputsHtml(g.rows, g.tip, prefix)}</div>`;
        }
        return `
    <section class="panel weight-group">
      <h2 class="${g.tip ? "tip" : ""}"${g.tip ? ` data-tip="${escapeAttr(g.tip)}"` : ""}>${g.title}</h2>
      ${blurb ? `<p class="muted weight-section-blurb">${escapeHtml(blurb)}</p>` : ""}
      ${body}
    </section>`;
      })
      .join("") +
    `<div class="options-actions">
      <button type="submit" class="btn btn-accent" data-save="${prefix}">Save ${saveLabel}</button>
    </div>`;
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\n/g, "&#10;");
}

function render() {
  tab = getTabFromUrl();
  const s = loadState();
  Object.assign(state, s);
  updateBadge();
  renderLinks();
  renderMyTeam();
  renderPanel(
    document.getElementById("panel-pitchers"),
    {
      ...s.pitcherWeights,
      penalties: {
        ...defaultPitcherWeights().penalties,
        ...(s.pitcherWeights?.penalties || {}),
      },
    },
    PITCHER_SECTIONS,
    "pitcher",
    "Pitcher weights"
  );
  renderPanel(
    document.getElementById("panel-batters"),
    s.batterWeights,
    BATTER_SECTIONS,
    "batter",
    "Batter weights"
  );
  renderPanel(
    document.getElementById("panel-pitcher-stats"),
    mergePitcherStatWeights(s.pitcherStatWeights),
    PITCHER_STAT_SECTIONS,
    "pitcher-stats",
    "Pitcher stats weights"
  );
  renderPanel(
    document.getElementById("panel-batter-stats"),
    mergeBatterStatWeights(s.batterStatWeights),
    BATTER_STAT_SECTIONS,
    "batter-stats",
    "Batter stats weights"
  );
  for (const t of TABS) {
    const panel = document.getElementById(`panel-${t}`);
    if (panel) panel.hidden = tab !== t;
  }
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.toggle("btn-accent", b.dataset.tab === tab)
  );
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = btn.dataset.tab;
    const url = new URL(window.location.href);
    // Prefer clean /options path so ?tab= survives (serve strips query on *.html → clean redirects)
    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.replace(/\.html$/, "");
    }
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
    render();
  });
});

document.getElementById("links-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = document.getElementById("url-template").value;
  if (value && !value.includes("{pid}")) {
    flashBanner('URL template should include "{pid}" where the player ID goes.');
    return;
  }
  await setUrlTemplate(value);
  Object.assign(state, loadState());
  window.PLAYER_URL_TEMPLATE = state.urlTemplate;
  flashBanner("Player profile link template saved.");
  renderLinks();
});

document.getElementById("reset-url-template").addEventListener("click", async () => {
  await setUrlTemplate(DEFAULT_URL_TEMPLATE);
  Object.assign(state, loadState());
  window.PLAYER_URL_TEMPLATE = state.urlTemplate;
  flashBanner("Player profile link template reset to default.");
  renderLinks();
});

document.getElementById("my-team-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = document.getElementById("my-team").value;
  await setMyTeam(value);
  Object.assign(state, loadState());
  window.HECTOR_MY_TEAM = state.myTeam || "";
  flashBanner(
    state.myTeam
      ? `Your team set to ${state.myTeam}. Highlighted on Pitchers, Batters, and Teams.`
      : "Your team cleared."
  );
  renderMyTeam();
});

document.getElementById("clear-my-team").addEventListener("click", async () => {
  await setMyTeam("");
  Object.assign(state, loadState());
  window.HECTOR_MY_TEAM = "";
  flashBanner("Your team cleared.");
  renderMyTeam();
});

document.getElementById("weights-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = e.submitter;
  const which = saveBtn?.dataset?.save || tab;
  const fd = new FormData(e.target);
  const formObj = Object.fromEntries(fd.entries());
  const s = loadState();

  if (which === "pitcher") {
    const next = applyFormWeights(s.pitcherWeights || defaultPitcherWeights(), formObj, "pitcher");
    await setWeights(next, null, true);
  } else if (which === "batter") {
    const next = applyFormWeights(s.batterWeights || defaultBatterWeights(), formObj, "batter");
    await setWeights(null, next, true);
  } else if (which === "pitcher-stats") {
    const next = applyFormWeights(
      mergePitcherStatWeights(s.pitcherStatWeights),
      formObj,
      "pitcher-stats"
    );
    await setStatWeights(next, null, true);
  } else if (which === "batter-stats") {
    const next = applyFormWeights(
      mergeBatterStatWeights(s.batterStatWeights),
      formObj,
      "batter-stats"
    );
    await setStatWeights(null, next, true);
  }

  document.getElementById("save-banner").hidden = !hasData();
  if (!hasData()) {
    document.getElementById("save-banner").hidden = false;
    document.getElementById("save-banner").textContent = "Weights saved.";
  } else {
    document.getElementById("save-banner").textContent = "Weights saved and players rescored.";
  }
  render();
});

document.getElementById("reset-tab").addEventListener("click", async () => {
  await resetWeights(tab);
  document.getElementById("save-banner").hidden = false;
  document.getElementById("save-banner").textContent = "Tab reset to defaults.";
  render();
});

document.getElementById("reset-all").addEventListener("click", async () => {
  await resetWeights("both");
  document.getElementById("save-banner").hidden = false;
  document.getElementById("save-banner").textContent = "All weights reset to defaults.";
  render();
});

render();
