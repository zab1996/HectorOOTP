import { mountShell, requireData } from "../shell.js?v=36";
import { loadState, saveState, playerUrl, setParkNormalizeStats } from "../hector/store.js";
import {
  calculateMaxPlayerScores,
  calculateDraftPickValue,
  calculateTeamTotals,
  findPlayerByName,
  getMatchingPlayers,
  compareTrade,
} from "../hector/trade.js";
import {
  buildDollarWarIndex,
  formatDpw,
  formatMillions,
} from "../hector/dollar_war.js";
import { getWar, parseSalary } from "../hector/player_analytics.js";
import { round2 } from "../hector/util.js";
import {
  parkAdjustedDisplay,
  parkAdjustedTradeTotal,
  hasTeamListParks,
} from "../hector/park_normalize.js";

if (!(await requireData())) throw new Error("redirect");
const shellState = await mountShell("trade");

function defaultTrade() {
  return {
    num_teams: 28,
    num_rounds: 20,
    team_a_players: [],
    team_b_players: [],
    team_a_picks: [],
    team_b_picks: [],
  };
}

function getTrade() {
  const s = loadState();
  const t = { ...defaultTrade(), ...(s.trade || {}) };
  if (t.give || t.get) {
    delete t.give;
    delete t.get;
  }
  return t;
}

function persistTrade(trade) {
  const s = loadState();
  s.trade = trade;
  void saveState(s);
}

let trade = getTrade();
const maxes = calculateMaxPlayerScores(shellState.pitchers, shellState.batters);
const dwIndex = buildDollarWarIndex(shellState.pitchers, shellState.batters);
const maxPlayer = Math.max(maxes.max_pitcher_score, maxes.max_batter_score) || 1;

function dash(v) {
  const s = String(v ?? "").trim();
  return !s || s === "-" || s === "—" ? "—" : s;
}

function parkNormalizeEnabled() {
  return hasTeamListParks(shellState.teamList) && !!loadState().parkNormalizeStats;
}

function syncParkNormalizeToggle() {
  const el = document.getElementById("park-normalize-toggle");
  if (!el) return;
  const hasParks = hasTeamListParks(shellState.teamList);
  el.disabled = !hasParks;
  el.checked = hasParks && !!loadState().parkNormalizeStats;
}

function formatSlrShort(slr) {
  const m = parseSalary(slr);
  if (!(m > 0)) return dash(slr);
  return `$${m.toFixed(1)}M`;
}

function playerRow(p, type) {
  const scores = p.Scores || {};
  const pot =
    type === "pitcher"
      ? (scores.core_potential ?? 0) + (scores.pitches_potential ?? 0) + (scores.pot_penalties ?? 0)
      : scores.offense_potential ?? 0;
  const current = type === "pitcher" ? scores.curr_total ?? 0 : scores.offense ?? 0;
  const defense = type === "pitcher" ? 0 : scores.defense ?? 0;
  const pos = String(p.POS || "").toUpperCase();
  const war = getWar(p, type);
  const ctx = dwIndex.context(p, type);
  const parkOn = parkNormalizeEnabled();
  const teamList = shellState.teamList || [];

  const isPitcher = type === "pitcher";
  const avg = isPitcher
    ? "—"
    : parkAdjustedDisplay("AVG", p.AVG, p, teamList, parkOn);
  const hr = isPitcher
    ? "—"
    : parkAdjustedDisplay("HR", p.HR, p, teamList, parkOn);
  const wrc = isPitcher ? "—" : dash(p["wRC+"]);
  const ops = isPitcher ? "—" : dash(p["OPS+"]);
  const cera = !isPitcher && pos === "C" ? dash(p.CERA) : "—";
  const warVal = dash(
    isPitcher ? (p["WAR (Pitcher)"] ?? p.WAR) : (p["WAR (Batter)"] ?? p.WAR),
  );
  const eraRaw = isPitcher
    ? parkAdjustedDisplay("ERA", p.ERA, p, teamList, parkOn)
    : "—";
  const hr9 = isPitcher
    ? parkAdjustedDisplay("HR/9", p["HR/9"], p, teamList, parkOn)
    : "—";
  const era = isPitcher ? dash(p["ERA+"]) : "—";
  const fip = isPitcher ? dash(p["FIP-"]) : "—";

  const org = dash(p.ORG);
  const rawTotal = Number(scores.total ?? 0);
  const tradeTotal = parkAdjustedTradeTotal(rawTotal, p, type, teamList, parkOn);
  return {
    key: `${type}:${p.ID || p.Name}`,
    is_pick: false,
    id: p.ID || "",
    name: p.Name || "",
    org,
    pos: p.POS || "",
    age: p.Age || "",
    type,
    current: Number(current).toFixed(1),
    potential: Number(pot).toFixed(1),
    defense: Number(defense).toFixed(1),
    avg,
    hr,
    wrc,
    ops,
    cera,
    war: warVal,
    era_raw: eraRaw,
    hr9,
    era,
    fip,
    slr: formatSlrShort(p.SLR),
    dpw: formatDpw(ctx.dpw),
    total: tradeTotal.toFixed(1),
    _player: { ...p, _type: type },
    _ctx: ctx,
    _war: war,
  };
}

/** Shallow copies with Scores.total park-scaled for team totals / comparison. */
function playersForTotals(players) {
  const parkOn = parkNormalizeEnabled();
  if (!parkOn) return players.map((p) => ({ ...p, _type: p._type }));
  const teamList = shellState.teamList || [];
  return players.map((p) => {
    const type =
      p._type || (p.POS === "SP" || p.POS === "RP" || p.POS === "CL" ? "pitcher" : "batter");
    const scores = p.Scores || {};
    const adj = parkAdjustedTradeTotal(scores.total ?? 0, p, type, teamList, true);
    return {
      ...p,
      _type: type,
      Scores: { ...scores, total: adj },
    };
  });
}

function pickRow(pick) {
  return {
    key: pick.key || `pick:${pick.round}:${pick.position}`,
    is_pick: true,
    name: pick.display || `Round ${pick.round}`,
    org: "",
    pos: "PICK",
    age: "",
    current: "—",
    potential: "—",
    defense: "—",
    avg: "—",
    hr: "—",
    wrc: "—",
    ops: "—",
    cera: "—",
    war: "—",
    era_raw: "—",
    hr9: "—",
    era: "—",
    fip: "—",
    slr: "—",
    dpw: "—",
    total: Number(pick.value ?? 0).toFixed(1),
  };
}

function sideRows(players, picks) {
  return [
    ...players.map((p) =>
      playerRow(
        p,
        p._type || (p.POS === "SP" || p.POS === "RP" || p.POS === "CL" ? "pitcher" : "batter"),
      ),
    ),
    ...picks.map(pickRow),
  ];
}

function applyContractAdj(totals, players) {
  totals.stats_total = totals.team_total;
  let contractDelta = 0;
  let adjSum = 0;
  let warSum = 0;
  let payrollM = 0;
  for (const p of players) {
    const type = p._type || "batter";
    warSum += getWar(p, type) || 0;
    payrollM += parseSalary(p.SLR ?? 0) || 0;
    const ctx = dwIndex.context(p, type);
    if (ctx.vs_pool != null) contractDelta += ctx.vs_pool;
    if (ctx.vs_pool != null && ctx.median != null && ctx.median > 0) {
      const warEq = Math.max(-2, Math.min(2, ctx.vs_pool / ctx.median));
      adjSum += warEq * (100 / maxPlayer);
    }
  }
  totals.war_sum = round2(warSum);
  totals.payroll_m = round2(payrollM);
  totals.contract_delta = round2(contractDelta);
  totals.team_total = round2(totals.team_total + adjSum);
  return totals;
}

function favorLabel(winner) {
  return winner === "Tie" ? "Tie" : `Favors Team ${winner}`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function playerNameLink(name, id) {
  const href = id ? playerUrl(id, shellState) : "";
  if (!href) return escapeHtml(name);
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`;
}

function renderSide(side) {
  const players = trade[`team_${side}_players`];
  const picks = trade[`team_${side}_picks`];
  const rows = sideRows(players, picks);
  const tbody = document.getElementById(`rows-${side}`);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="20" class="muted">No players or picks</td></tr>`;
  } else {
    tbody.innerHTML = rows
      .map((r) => {
        const nameHtml = r.is_pick
          ? escapeHtml(r.name)
          : playerNameLink(r.name, r.id);
        const orgHtml =
          !r.is_pick && r.org && r.org !== "—"
            ? ` <span class="col-meta">(${escapeHtml(r.org)})</span>`
            : "";
        const rowAttrs = r.is_pick
          ? ` class="pick-row"`
          : ` data-player-id="${escapeHtml(r.id)}" data-player-name="${escapeHtml(r.name)}" data-player-type="${escapeHtml(r.type)}"`;
        return `
      <tr${rowAttrs}>
        <td><button type="button" class="btn-icon" data-remove="${side}" data-key="${escapeHtml(r.key)}" title="Remove">✕</button></td>
        <td class="col-name">${nameHtml}${orgHtml}</td>
        <td>${escapeHtml(r.pos)}</td><td>${escapeHtml(r.age)}</td>
        <td class="col-num">${r.current}</td><td class="col-num">${r.potential}</td><td class="col-num">${r.defense}</td>
        <td class="col-num">${r.avg}</td><td class="col-num">${r.hr}</td>
        <td class="col-num">${r.wrc}</td><td class="col-num">${r.ops}</td><td class="col-num">${r.cera}</td>
        <td class="col-num">${r.war}</td>
        <td class="col-num">${r.era_raw}</td><td class="col-num">${r.hr9}</td>
        <td class="col-num">${r.era}</td><td class="col-num">${r.fip}</td>
        <td class="col-num">${r.slr}</td><td class="col-num">${r.dpw}</td>
        <td class="col-num num-strong">${r.total}</td>
      </tr>`;
      })
      .join("");
  }
  let totals = calculateTeamTotals(
    playersForTotals(players),
    picks,
    maxes.max_pitcher_score,
    maxes.max_batter_score,
  );
  totals = applyContractAdj(totals, players);
  document.getElementById(`totals-${side}`).innerHTML =
    `Curr ${totals.team_current} · Pot ${totals.team_potential} · Stats ${totals.stats_total} · WAR ${totals.war_sum} · Picks ${totals.draft_picks_value} · Contract Δ ${formatMillions(totals.contract_delta)} · <strong>Total ${totals.team_total}</strong>`;
  return totals;
}

function renderCmpSides(totalsA, totalsB) {
  function card(side, label, t) {
    const nPlayers = trade[`team_${side}_players`].length;
    const nPicks = trade[`team_${side}_picks`].length;
    return `<div class="cmp-side">
      <h3>${label}</h3>
      <dl>
        <dt>Players / picks</dt><dd>${nPlayers} / ${nPicks}</dd>
        <dt>Curr (ratings)</dt><dd>${t.team_current}</dd>
        <dt>Pot (ratings)</dt><dd>${t.team_potential}</dd>
        <dt>Stats Total</dt><dd>${t.stats_total}</dd>
        <dt>WAR (sum)</dt><dd>${t.war_sum}</dd>
        <dt>Payroll</dt><dd>${formatMillions(t.payroll_m)}</dd>
        <dt>Picks</dt><dd>${t.draft_picks_value}</dd>
        <dt>Contract Δ</dt><dd>${formatMillions(t.contract_delta)}</dd>
        <dt>Overall</dt><dd><strong>${t.team_total}</strong></dd>
      </dl>
    </div>`;
  }
  document.getElementById("cmp-sides").innerHTML =
    card("a", "Team A", totalsA) + card("b", "Team B", totalsB);
}

function renderAll() {
  syncParkNormalizeToggle();
  document.getElementById("num-teams").value = trade.num_teams;
  document.getElementById("num-rounds").value = trade.num_rounds;
  document.getElementById("pick-base").textContent =
    `R1P1 base ≈ ${maxes.draft_pick_base_value.toFixed(2)} (65% of max player)`;
  document.querySelectorAll("[data-add-pick] input[name=round_num]").forEach((el) => {
    el.max = trade.num_rounds;
  });
  document.querySelectorAll("[data-add-pick] input[name=position]").forEach((el) => {
    el.max = trade.num_teams;
  });
  const totalsA = renderSide("a");
  const totalsB = renderSide("b");
  renderCmpSides(totalsA, totalsB);
  const cmp = compareTrade(totalsA, totalsB);
  document.getElementById("comparison").innerHTML = `
    <div>Current: <span class="winner">${favorLabel(cmp.current_winner)}</span> (Δ ${cmp.current_diff})</div>
    <div>Potential: <span class="winner">${favorLabel(cmp.potential_winner)}</span> (Δ ${cmp.potential_diff})</div>
    <div>Stats: <span class="winner">${favorLabel(cmp.stats_winner)}</span> (Δ ${cmp.stats_diff})</div>
    <div>WAR: <span class="winner">${favorLabel(cmp.war_winner)}</span> (Δ ${cmp.war_diff})</div>
    <div>Picks: <span class="winner">${favorLabel(cmp.picks_winner)}</span> (Δ ${cmp.picks_diff})</div>
    <div>Contract Δ: <span class="winner">${favorLabel(cmp.contract_winner)}</span> (Δ ${formatMillions(cmp.contract_diff)})</div>
    <div class="overall">Overall: <span class="winner">${favorLabel(cmp.overall_winner)}</span> (Δ ${cmp.total_diff})</div>`;
  persistTrade(trade);
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
      const items = getMatchingPlayers(q, shellState.pitchers, shellState.batters, 12);
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

document.querySelectorAll(".ac-input").forEach(wireAutocomplete);

document.getElementById("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  trade.num_teams = Number(document.getElementById("num-teams").value) || 28;
  trade.num_rounds = Number(document.getElementById("num-rounds").value) || 20;
  renderAll();
});

document.querySelectorAll("[data-add-player]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const side = form.dataset.addPlayer;
    const name = form.querySelector(".ac-input").value;
    const hit = findPlayerByName(name, shellState.pitchers, shellState.batters);
    if (!hit) {
      alert("Player not found");
      return;
    }
    const target = trade[`team_${side}_players`];
    const key = `${hit.type}:${hit.player.ID || hit.player.Name}`;
    if (target.some((p) => `${p._type}:${p.ID || p.Name}` === key)) return;
    target.push({ ...hit.player, _type: hit.type });
    form.querySelector(".ac-input").value = "";
    renderAll();
  });
});

document.querySelectorAll("[data-add-pick]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const side = form.dataset.addPick;
    const roundNum = Number(form.round_num.value) || 1;
    const position = Number(form.position.value) || trade.num_teams;
    const pick = calculateDraftPickValue(
      roundNum,
      position,
      trade.num_teams,
      trade.num_rounds,
      maxes.draft_pick_base_value,
    );
    pick.key = `pick:${pick.round}:${pick.pick_number}:${Date.now()}`;
    trade[`team_${side}_picks`].push(pick);
    renderAll();
  });
});

document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  const side = btn.dataset.remove;
  const key = btn.dataset.key;
  trade[`team_${side}_players`] = trade[`team_${side}_players`].filter(
    (p) => `${p._type}:${p.ID || p.Name}` !== key,
  );
  trade[`team_${side}_picks`] = trade[`team_${side}_picks`].filter((p) => p.key !== key);
  renderAll();
});

document.getElementById("park-normalize-toggle")?.addEventListener("change", async (e) => {
  await setParkNormalizeStats(!!e.target.checked);
  renderAll();
});

renderAll();
