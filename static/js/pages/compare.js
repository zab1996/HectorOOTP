import { mountShell, requireData } from "../shell.js?v=44";
import { loadState, setParkNormalizeStats, hasDraftData, hasIfaData, playerUrl } from "../hector/store.js?v=32";
import { getMatchingPlayers, findPlayerByName } from "../hector/trade.js";
import {
  initializePercentiles,
  DRAFT_BATTER_METRICS,
  DRAFT_PITCHER_METRICS,
} from "../hector/percentiles.js?v=2";
import { isMajorLeague } from "../hector/league.js";
import { formatOrdinal } from "../hector/util.js";
import { readAndClearCompareSeed, MAX_COMPARE_PLAYERS } from "../compare_seed.js";
import {
  parkAdjustedDisplay,
  parkAdjustedNumber,
  hasTeamListParks,
} from "../hector/park_normalize.js";
import {
  escapeHtml,
  hasRating,
  pickField,
  gradePair,
  primaryBatterPos,
  batterCompareAxisLabels,
  pitcherCompareAxisLabels,
  gradeForCompareAxis,
  radarSvgCompare,
  pitcherArsenalGrade,
} from "../hector/radar.js";
import { bindPlayerCardRows, playerMetaExtraHtml } from "../player-card.js?v=50";

if (!(await requireData())) throw new Error("redirect");
const state = await mountShell("compare");

const COLORS = ["#2dff9a", "#4dabf7", "#e6b84d"];
const MAX_PLAYERS = MAX_COMPARE_PLAYERS;

/** @type {"batter"|"pitcher"} */
let playerType = "batter";
/** @type {"roster"|"draft"|"ifa"} */
let playerPool = "roster";
/** @type {"cur"|"pot"} */
let radarMode = "cur";
/** @type {{ player: object, id: string }[]} */
let selected = [];

const typeBtns = document.querySelectorAll(".compare-type-btn");
const poolBtns = document.querySelectorAll(".compare-pool-btn");
const radarBtns = document.querySelectorAll(".compare-radar-btn");
const form = document.getElementById("compare-add-form");
const searchInput = document.getElementById("compare-search");
const chipsEl = document.getElementById("compare-chips");
const emptyEl = document.getElementById("compare-empty");
const bodyEl = document.getElementById("compare-body");
const draftPoolBtn = document.getElementById("compare-pool-draft");
const ifaPoolBtn = document.getElementById("compare-pool-ifa");
const statsDraftNote = document.getElementById("compare-stats-draft-note");
const statsTableWrap = document.getElementById("compare-stats-table-wrap");
const parkNormalizeWrap = document.getElementById("park-normalize-wrap");
const radarNoteEl = document.getElementById("compare-radar-note");

function isAmateurPool(p = playerPool) {
  return p === "draft" || p === "ifa";
}

function pool() {
  if (playerPool === "draft") {
    return playerType === "pitcher" ? state.draftPitchers || [] : state.draftBatters || [];
  }
  if (playerPool === "ifa") {
    return playerType === "pitcher" ? state.ifaPitchers || [] : state.ifaBatters || [];
  }
  return playerType === "pitcher" ? state.pitchers : state.batters;
}

function poolPitchers() {
  if (playerPool === "draft") return state.draftPitchers || [];
  if (playerPool === "ifa") return state.ifaPitchers || [];
  return state.pitchers;
}

function poolBatters() {
  if (playerPool === "draft") return state.draftBatters || [];
  if (playerPool === "ifa") return state.ifaBatters || [];
  return state.batters;
}

function playerKey(p) {
  return String(p.ID || p.Name || "");
}

function dash(v) {
  const s = String(v ?? "").trim();
  return !s || s === "-" || s === "—" ? "—" : s;
}

function contractLine(player) {
  const parts = [`SLR ${dash(player.SLR)}`, `YL ${dash(player.YL)}`, `CV ${dash(player.CV)}`];
  if (hasRating(player.TY)) parts.push(`TY ${String(player.TY).trim()}`);
  return parts.join(" · ");
}

function parseStatNum(v) {
  if (!hasRating(v)) return null;
  const n = parseFloat(String(v).trim().replace(/%/g, ""));
  return Number.isFinite(n) ? n : null;
}

function majorLeaguePool(players) {
  return (players || []).filter((p) => isMajorLeague(p) === true);
}

function isCatcher(player) {
  return primaryBatterPos(player) === "C";
}

function batterStatGetters(includeCera) {
  const rows = [
    ["G", (p) => pickField(p, "G (Batter)", "G", "Games", "GP"), false],
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
    ["BB%", (p) => pickField(p, "BB% (Batter)", "BB%", "BB&#37;"), false],
    [
      "SO%",
      (p) => pickField(p, "SO% (Batter)", "SO%", "SO&#37;", "K% (Batter)", "K%", "K&#37;"),
      true,
    ],
    ["OPS+", (p) => p["OPS+"], false],
    ["wRC+", (p) => p["wRC+"], false],
    ["WAR", (p) => pickField(p, "WAR (Batter)", "WAR"), false],
    ["UBR", (p) => p.UBR, false],
    ["ZR", (p) => p.ZR, false],
    ["E", (p) => p.E, true],
  ];
  if (includeCera) rows.push(["CERA", (p) => p.CERA, true]);
  return rows;
}

function pitcherStatGetters() {
  return [
    ["IP", (p) => p.IP, false],
    ["ERA", (p) => p.ERA, true],
    ["ERA+", (p) => p["ERA+"], false],
    ["WAR", (p) => pickField(p, "WAR (Pitcher)", "WAR"), false],
    ["rWAR", (p) => p.rWAR, false],
    ["FIP", (p) => p.FIP, true],
    ["FIP-", (p) => p["FIP-"], true],
    ["SIERA", (p) => p.SIERA, true],
    ["WHIP", (p) => p.WHIP, true],
    ["K/9", (p) => p["K/9"], false],
    ["BB/9", (p) => p["BB/9"], true],
    ["HR/9", (p) => p["HR/9"], true],
    ["K%", (p) => pickField(p, "K% (Pitcher)", "K%"), false],
    ["BB%", (p) => pickField(p, "BB% (Pitcher)"), true],
    ["HLD", (p) => pickField(p, "HLD (Stat)"), false],
    ["SV", (p) => p.SV, false],
    ["BS", (p) => p.BS, true],
  ];
}

function ratingCell(player, label) {
  if (label === "DEF") {
    const v = gradeForCompareAxis(player, "batter", "DEF");
    return v == null ? "—" : String(v);
  }
  if (label === "ARS") {
    const ars = pitcherArsenalGrade(player);
    return ars ? `${ars.cur} / ${ars.pot}` : "—";
  }
  const pairs = {
    CON:
      playerType === "pitcher"
        ? [["CON (Pitcher)", "CON"], ["CON P (Pitcher)", "CON P"]]
        : ["CON", "CON P"],
    GAP: ["GAP", "GAP P"],
    POW: ["POW", "POW P"],
    EYE: ["EYE", "EYE P"],
    AvK: ["K's", "K P"],
    SPE: ["SPE", "SPE"],
    STE: ["STE", "STE"],
    RUN: ["RUN", "RUN"],
    STU: ["STU", "STU P"],
    MOV: ["MOV", "MOV P"],
    STM: ["STM", "STM"],
    HLD: ["HLD", "HLD"],
  };
  const spec = pairs[label];
  if (!spec) return "—";
  const pair = gradePair(player, spec[0], spec[1]);
  if (!pair) return "—";
  return `${pair.cur} / ${pair.pot}`;
}

function ratingNumericForBest(player, label) {
  if (label === "DEF") return gradeForCompareAxis(player, "batter", "DEF");
  if (label === "ARS") return gradeForCompareAxis(player, "pitcher", "ARS");
  if (playerType === "pitcher") {
    return gradeForCompareAxis(player, "pitcher", label);
  }
  const cell = ratingCell(player, label);
  if (cell === "—") return null;
  const cur = parseInt(cell.split("/")[0], 10);
  return Number.isFinite(cur) ? cur : null;
}

function syncRadarToggleUi() {
  radarBtns.forEach((b) => b.classList.toggle("active", b.dataset.radar === radarMode));
  if (radarNoteEl) {
    radarNoteEl.textContent =
      radarMode === "pot"
        ? "20–80 scale · potential grades (current is in the ratings table)"
        : "20–80 scale · current grades (potential is in the ratings table)";
  }
}

function defaultRadarForPool(pool) {
  return isAmateurPool(pool) ? "pot" : "cur";
}

function syncPoolToggleUi() {
  const hasDraft = hasDraftData(state);
  const hasIfa = hasIfaData(state);
  if (draftPoolBtn) {
    draftPoolBtn.disabled = !hasDraft;
    draftPoolBtn.title = hasDraft
      ? ""
      : "Upload a Draft Class HTML on the Upload page first.";
  }
  if (ifaPoolBtn) {
    ifaPoolBtn.disabled = !hasIfa;
    ifaPoolBtn.title = hasIfa
      ? ""
      : "Upload an Int'l amateurs HTML on the Upload page first.";
  }
  if (playerPool === "draft" && !hasDraft) playerPool = "roster";
  if (playerPool === "ifa" && !hasIfa) playerPool = "roster";
  poolBtns.forEach((b) => b.classList.toggle("active", b.dataset.pool === playerPool));
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
      const pitchers = playerType === "pitcher" ? poolPitchers() : [];
      const batters = playerType === "batter" ? poolBatters() : [];
      const items = getMatchingPlayers(q, pitchers, batters, 12);
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

function renderChips() {
  chipsEl.innerHTML = selected
    .map((s, i) => {
      const color = COLORS[i % COLORS.length];
      return `<button type="button" class="compare-chip" data-idx="${i}" style="--chip:${color}">
        ${escapeHtml(s.player.Name || "?")}
        <span class="compare-chip-x" aria-label="Remove">&times;</span>
      </button>`;
    })
    .join("");
}

function addPlayer(name) {
  if (selected.length >= MAX_PLAYERS) return;
  const hit = findPlayerByName(name, poolPitchers(), poolBatters());
  if (!hit || hit.type !== playerType) return;
  const key = playerKey(hit.player);
  if (selected.some((s) => playerKey(s.player) === key)) return;
  selected.push({ player: hit.player, id: key });
  searchInput.value = "";
  render();
}

function removeAt(idx) {
  selected.splice(idx, 1);
  render();
}

function setType(t) {
  if (t === playerType) return;
  playerType = t;
  selected = [];
  typeBtns.forEach((b) => b.classList.toggle("active", b.dataset.type === t));
  render();
}

function setPool(p) {
  const next = p === "draft" ? "draft" : p === "ifa" ? "ifa" : "roster";
  if (next === "draft" && !hasDraftData(state)) return;
  if (next === "ifa" && !hasIfaData(state)) return;
  if (next === playerPool) return;
  playerPool = next;
  selected = [];
  radarMode = defaultRadarForPool(playerPool);
  syncPoolToggleUi();
  syncRadarToggleUi();
  render();
}

function setRadarMode(mode) {
  const next = mode === "pot" ? "pot" : "cur";
  if (next === radarMode) return;
  radarMode = next;
  syncRadarToggleUi();
  if (selected.length >= 2) renderRadar();
}

function poolAttr() {
  return playerPool === "draft" || playerPool === "ifa" ? playerPool : "roster";
}

/** StatsPlus link + data-* for player-card gestures. */
function playerNameCell(player, color) {
  const name = player?.Name || "?";
  const href = player?.ID ? playerUrl(player.ID, state) : "";
  const nameHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`
    : escapeHtml(name);
  const style = color ? ` style="color:${color}"` : "";
  return `<span class="compare-player-name"${style}
    data-player-name="${escapeHtml(name)}"
    data-player-id="${escapeHtml(String(player?.ID || ""))}"
    data-player-type="${playerType}"
    data-player-pool="${poolAttr()}">${nameHtml}</span>`;
}

function tableHead() {
  return `<tr><th></th>${selected
    .map((s, i) => `<th>${playerNameCell(s.player, COLORS[i % COLORS.length])}</th>`)
    .join("")}</tr>`;
}

function bestIdx(nums, lowerIsBetter) {
  let bi = -1;
  let best = null;
  nums.forEach((n, i) => {
    if (n == null || Number.isNaN(n)) return;
    if (best == null || (lowerIsBetter ? n < best : n > best)) {
      best = n;
      bi = i;
    }
  });
  return bi;
}

function renderIdentity() {
  const el = document.getElementById("compare-identity");
  el.innerHTML = selected
    .map((s, i) => {
      const p = s.player;
      const color = COLORS[i % COLORS.length];
      const hand =
        playerType === "batter"
          ? `Bats ${escapeHtml(dash(p.B))}`
          : `Throws ${escapeHtml(dash(p.T))}`;
      const orgBit =
        playerPool === "draft"
          ? "Draft class"
          : playerPool === "ifa"
            ? "IFA"
            : escapeHtml(dash(p.ORG));
      const contract =
        isAmateurPool()
          ? ""
          : `<p class="compare-contract">${escapeHtml(contractLine(p))}</p>`;
      const name = p.Name || "?";
      const href = p.ID ? playerUrl(p.ID, state) : "";
      const nameHtml = href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`
        : escapeHtml(name);
      const extra = playerMetaExtraHtml(p, { includePop: !isAmateurPool() });
      const metaLine = extra.length
        ? `<p class="muted compare-id-meta">${extra.join(" · ")}</p>`
        : "";
      return `<div class="compare-id-card" style="--col:${color}"
        data-player-name="${escapeHtml(name)}"
        data-player-id="${escapeHtml(String(p.ID || ""))}"
        data-player-type="${playerType}"
        data-player-pool="${poolAttr()}">
        <h3>${nameHtml}</h3>
        <p class="muted">${orgBit} · ${escapeHtml(dash(p.POS))} · Age ${escapeHtml(dash(p.Age))} · ${hand}</p>
        ${metaLine}
        ${contract}
        <p><span class="ovr">OVR ${escapeHtml(dash(p.OVR))}</span>
           <span class="pot">POT ${escapeHtml(dash(p.POT))}</span></p>
      </div>`;
    })
    .join("");
}

function renderRadar() {
  const wrap = document.getElementById("compare-radar");
  const labels =
    playerType === "batter"
      ? batterCompareAxisLabels()
      : pitcherCompareAxisLabels();
  const which = radarMode === "pot" ? "pot" : "cur";
  const series = selected.map((s, i) => ({
    name: s.player.Name || `P${i + 1}`,
    color: COLORS[i % COLORS.length],
    values: labels.map((lab) => gradeForCompareAxis(s.player, playerType, lab, which)),
  }));
  const svg = radarSvgCompare(labels, series);
  const legend = selected
    .map(
      (s, i) =>
        `<span class="compare-legend-item"><span class="compare-legend-swatch" style="background:${COLORS[i]}"></span>${playerNameCell(s.player, COLORS[i % COLORS.length])}</span>`,
    )
    .join("");
  wrap.innerHTML = `${svg}<div class="compare-legend">${legend}</div>`;
}

function renderRatingsTable() {
  const head = document.getElementById("compare-ratings-head");
  const body = document.getElementById("compare-ratings-body");
  head.innerHTML = tableHead();

  let labels;
  if (playerType === "batter") {
    labels = ["CON", "GAP", "POW", "EYE", "AvK", "DEF", "SPE", "STE", "RUN"];
  } else {
    labels = ["STU", "MOV", "CON", "STM", "ARS", "HLD"];
  }

  body.innerHTML = labels
    .map((label) => {
      const cells = selected.map((s) => ratingCell(s.player, label));
      const nums = selected.map((s) => ratingNumericForBest(s.player, label));
      const bi = bestIdx(nums, false);
      const tds = cells
        .map((c, i) => `<td class="${i === bi ? "compare-best" : ""}">${escapeHtml(c)}</td>`)
        .join("");
      return `<tr><th>${escapeHtml(label)}</th>${tds}</tr>`;
    })
    .join("");
}

function parkNormalizeEnabled() {
  return hasTeamListParks(state.teamList) && !!loadState().parkNormalizeStats;
}

function syncParkNormalizeToggle() {
  const el = document.getElementById("park-normalize-toggle");
  if (!el) return;
  const hasParks = hasTeamListParks(state.teamList);
  const amateur = isAmateurPool();
  el.disabled = amateur || !hasParks;
  el.checked = !amateur && hasParks && !!loadState().parkNormalizeStats;
  if (parkNormalizeWrap) parkNormalizeWrap.hidden = amateur;
}

function renderStatsTable() {
  const head = document.getElementById("compare-stats-head");
  const body = document.getElementById("compare-stats-body");
  const amateur = isAmateurPool();

  if (statsDraftNote) statsDraftNote.hidden = !amateur;
  if (statsTableWrap) statsTableWrap.hidden = amateur;
  if (amateur) {
    if (head) head.innerHTML = "";
    if (body) body.innerHTML = "";
    return;
  }

  head.innerHTML = tableHead();

  const majors = majorLeaguePool(pool());
  const includeCera =
    playerType === "batter" && selected.some((s) => isCatcher(s.player));
  const getters =
    playerType === "batter" ? batterStatGetters(includeCera) : pitcherStatGetters();
  const parkOn = parkNormalizeEnabled();
  const teamList = state.teamList || [];

  body.innerHTML = getters
    .map(([label, getter, lower]) => {
      const vals = selected.map((s) => {
        const raw = getter(s.player);
        return parkAdjustedDisplay(label, raw, s.player, teamList, parkOn);
      });
      if (vals.every((v) => v === "—")) return "";
      const nums = selected.map((s) =>
        parkAdjustedNumber(label, getter(s.player), s.player, teamList, parkOn),
      );
      const bi = bestIdx(nums, lower);
      const poolValues = [];
      for (const p of majors) {
        const n = parkAdjustedNumber(label, getter(p), p, teamList, parkOn);
        if (n != null) poolValues.push(n);
      }
      const ranks = selected.map((s, i) => {
        const mine = nums[i];
        if (mine == null || !poolValues.length) return null;
        let better = 0;
        for (const v of poolValues) {
          if (lower ? v < mine : v > mine) better += 1;
        }
        return { rank: better + 1, of: poolValues.length };
      });
      const tds = vals
        .map((v, i) => {
          const r = ranks[i];
          const rankHtml = r ? ` <span class="muted">#${r.rank}</span>` : "";
          return `<td class="${i === bi ? "compare-best" : ""}">${escapeHtml(v)}${rankHtml}</td>`;
        })
        .join("");
      return `<tr><th>${escapeHtml(label)}</th>${tds}</tr>`;
    })
    .filter(Boolean)
    .join("");
}

function renderPercentilesTable() {
  const head = document.getElementById("compare-pct-head");
  const body = document.getElementById("compare-pct-body");
  head.innerHTML = tableHead();

  const calc =
    playerPool === "draft"
      ? initializePercentiles(state.draftBatters || [], state.draftPitchers || [], {
          majorsOnly: false,
          batterMetrics: DRAFT_BATTER_METRICS,
          pitcherMetrics: DRAFT_PITCHER_METRICS,
          fresh: true,
        })
      : playerPool === "ifa"
        ? initializePercentiles(state.ifaBatters || [], state.ifaPitchers || [], {
            majorsOnly: false,
            batterMetrics: DRAFT_BATTER_METRICS,
            pitcherMetrics: DRAFT_PITCHER_METRICS,
            fresh: true,
          })
      : initializePercentiles(state.batters, state.pitchers);

  const pctMaps = selected.map((s) =>
    playerType === "batter"
      ? calc.getBatterPercentiles(s.player)
      : calc.getPitcherPercentiles(s.player),
  );

  const keySet = new Map();
  pctMaps.forEach((m) => {
    Object.entries(m).forEach(([k, d]) => {
      if (!keySet.has(k)) keySet.set(k, d.label || k);
    });
  });

  const rows = [...keySet.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  body.innerHTML = rows
    .map(([key, label]) => {
      const pcts = pctMaps.map((m) => m[key]?.percentile ?? null);
      const bi = bestIdx(pcts, false);
      const tds = pctMaps
        .map((m, i) => {
          const d = m[key];
          if (!d) return `<td>—</td>`;
          const raw =
            d.value != null && d.value !== ""
              ? ` <span class="muted">${Number(d.value).toFixed(1)}</span>`
              : "";
          return `<td class="${i === bi ? "compare-best" : ""}">${formatOrdinal(d.percentile)}${raw}</td>`;
        })
        .join("");
      return `<tr><th>${escapeHtml(label)}</th>${tds}</tr>`;
    })
    .join("");
}

function render() {
  syncPoolToggleUi();
  syncRadarToggleUi();
  syncParkNormalizeToggle();
  renderChips();
  if (selected.length < 2) {
    emptyEl.hidden = false;
    bodyEl.hidden = true;
    const hint = emptyEl.querySelector("p");
    if (hint) {
      const poolLabel =
        playerPool === "draft" ? "draft-class" : playerPool === "ifa" ? "IFA" : "roster";
      hint.textContent =
        selected.length === 0
          ? `Add 2–3 ${poolLabel} players of the same type to compare.`
          : `Add at least one more player to compare (up to ${MAX_PLAYERS}).`;
    }
    return;
  }
  emptyEl.hidden = true;
  bodyEl.hidden = false;
  renderIdentity();
  renderRadar();
  renderRatingsTable();
  renderStatsTable();
  renderPercentilesTable();
}

document.getElementById("park-normalize-toggle")?.addEventListener("change", async (e) => {
  const on = !!e.target.checked;
  await setParkNormalizeStats(on);
  if (selected.length >= 2) renderStatsTable();
});

typeBtns.forEach((btn) => {
  btn.addEventListener("click", () => setType(btn.dataset.type));
});

poolBtns.forEach((btn) => {
  btn.addEventListener("click", () => setPool(btn.dataset.pool));
});

radarBtns.forEach((btn) => {
  btn.addEventListener("click", () => setRadarMode(btn.dataset.radar));
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addPlayer(searchInput.value);
});

chipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".compare-chip");
  if (!chip) return;
  removeAt(Number(chip.dataset.idx));
});

wireAutocomplete(searchInput);

/** Prefill from list tabs / player card / contract. */
function resolveSeedPlayer(entry, type, poolList) {
  if (!entry) return null;
  let player = null;
  if (entry.id) {
    player = poolList.find((p) => String(p.ID || "") === String(entry.id)) || null;
  }
  if (!player && entry.name) {
    const hit = findPlayerByName(entry.name, poolPitchers(), poolBatters());
    if (hit && hit.type === type) player = hit.player;
  }
  return player;
}

function consumeCompareSeed() {
  const seed = readAndClearCompareSeed();
  if (!seed) return;

  const type = seed.type === "pitcher" ? "pitcher" : "batter";
  let poolMode = "roster";
  if (seed.pool === "draft" && hasDraftData(state)) poolMode = "draft";
  else if (seed.pool === "ifa" && hasIfaData(state)) poolMode = "ifa";
  playerType = type;
  playerPool = poolMode;
  radarMode = defaultRadarForPool(playerPool);
  typeBtns.forEach((b) => b.classList.toggle("active", b.dataset.type === type));
  syncPoolToggleUi();
  syncRadarToggleUi();
  selected = [];

  const poolList = type === "pitcher" ? poolPitchers() : poolBatters();

  /** @type {{ id?: string, name?: string }[]} */
  let entries = [];
  if (Array.isArray(seed.players) && seed.players.length) {
    entries = seed.players;
  } else if (seed.id || seed.name) {
    entries = [{ id: seed.id, name: seed.name }];
  }

  for (const entry of entries) {
    if (selected.length >= MAX_PLAYERS) break;
    const player = resolveSeedPlayer(entry, type, poolList);
    if (!player) continue;
    const key = playerKey(player);
    if (selected.some((s) => playerKey(s.player) === key)) continue;
    selected.push({ player, id: key });
  }
}

consumeCompareSeed();
render();
bindPlayerCardRows();
