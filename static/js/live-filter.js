/* Live filter + table render for Pitchers / Batters */
import { isMajorLeague } from "./hector/league.js";
import {
  createColumnFilter,
  normalizeFilterVal,
  normalizeDuraKey,
  normalizeBatsKey,
  normalizeThrowsKey,
  DURA_VALUES,
  BATS_VALUES,
  THROWS_VALUES,
  SCOUT_ACC_VALUES,
  GF_VALUES,
  duraOptionClass,
  duraClass,
  scoutOptionClass,
} from "./column-filter.js";
import { mountCompareSelect, comparePickTd, comparePickTh } from "./compare-select.js";

(function () {
  let players = window.HECTOR_PLAYERS || [];
  let kind = window.HECTOR_KIND || "pitchers";
  let view = window.HECTOR_VIEW || "all";
  let urlTemplate = window.PLAYER_URL_TEMPLATE || "";
  let useStats = !!window.HECTOR_USE_STATS;
  let majorsOnly = window.HECTOR_MAJORS_ONLY !== false;

  const searchEl = document.getElementById("player-search");
  const tbody = document.getElementById("players-tbody");
  const headRow = document.getElementById("table-head-row");
  const countEl = document.getElementById("filter-count");
  const secondaryEl = document.getElementById("secondary-pos");
  const secondaryWrap = document.getElementById("secondary-wrap");
  const tableEl = document.getElementById("players-table");
  const filtersEl = document.getElementById("live-filters");
  if (!tbody || !headRow) return;

  const compareSelect =
    filtersEl && tableEl
      ? mountCompareSelect({
          filtersEl,
          tableEl,
          getPlayerType: () => (kind === "pitchers" ? "pitcher" : "batter"),
          getPool: () => "roster",
        })
      : null;

  /** @type {{ label: string, dir: "asc" | "desc" } | null} */
  let sortState = null;

  const onFilterChange = () => scheduleRender();
  const duraFilter = createColumnFilter({
    id: "dura",
    title: "Durability",
    values: DURA_VALUES,
    optionClass: duraOptionClass,
    normalizeKey: normalizeDuraKey,
    onChange: onFilterChange,
  });
  const batsFilter = createColumnFilter({
    id: "bats",
    title: "Bats",
    values: BATS_VALUES,
    normalizeKey: normalizeBatsKey,
    onChange: onFilterChange,
  });
  const throwsFilter = createColumnFilter({
    id: "throws",
    title: "Throws",
    values: THROWS_VALUES,
    normalizeKey: normalizeThrowsKey,
    onChange: onFilterChange,
  });
  const scoutFilter = createColumnFilter({
    id: "scout",
    title: "Scout Acc.",
    values: SCOUT_ACC_VALUES,
    optionClass: scoutOptionClass,
    onChange: onFilterChange,
  });
  const gfFilter = createColumnFilter({
    id: "gf",
    title: "G/F",
    values: GF_VALUES,
    onChange: onFilterChange,
  });
  const allColFilters = [duraFilter, batsFilter, throwsFilter, scoutFilter, gfFilter];

  const PITCHER_TIPS = {
    Pitch:
      "Pitch Score:\nWeighted sum of this player's pitch arsenal grades only—\n(current Fastball, Slider, Curveball, etc.)\nUses weights set in pitcher_weights.py.\nDoes NOT include Stuff, Movement, or Control.",
    "Pitch Pot.":
      "Pitch Pot. Score:\nWeighted sum of EACH pitch type's potential (future) grade only—\n(potential Fastball, Slider, Curveball, ...)\nAll weighted as in pitcher_weights.py.\nDoes NOT include Stuff Pot., Movement Pot., or Control Pot.",
    Potential:
      "Potential Total Score:\nSum of ALL potential-based core skills (Stuff Pot., Movement Pot., Control Pot.)\n+ all pitch potential grades, with weights from pitcher_weights.py.\nShows a pitcher's overall future ceiling.",
    Current:
      "Current Total Score:\nCombines ONLY the CURRENT (not potential/future) core pitching attributes (Stuff, Movement, Control)\n+ all current pitch grades\n+ all current non-potential weighted factors (stamina, #pitches, etc).\nRepresents true present skill.",
    Total:
      "Total Score:\nFULL combined value for a pitcher:\n- All current skills (Stuff, Movement, Control)\n- All current arsenal grades\n- All potentials\n- Stamina, ground/fly ratio, #pitches, scout accuracy, etc.\nSee pitcher_weights.py for full formula.",
  };

  const BATTER_TIPS = {
    Offense:
      "Offense:\nWeighted sum of current main batting skills:\nContact, Gap, Power, Eye, K's\nWeights from 'overall' in batter_weights.py.",
    "Off. Pot.":
      "Offense Pot.:\nSame formula as Offense,\nbut uses potential/future ratings only\n(e.g., Contact Pot., Gap Pot., ...)\nWeights from 'potential' in batter_weights.py.",
    Defense:
      "Defense:\nWeighted sum of all relevant fielding skills, including\n- Range, Error, Arm\n- Catcher skills if C, OF skills if OF, IF skills if IF\nFormula adapts to position per batter_weights.py.",
    Total:
      "Total Score:\nSum of offense, offense potential, defense, baserunning,\ninjury risk, and scouting accuracy, all with weights from batter_weights.py.\nRepresents full combined value.",
  };

  const STAT_PITCHER_TIPS = {
    Dura: "Durability / injury proneness from the export’s Prone column (e.g. Durable, Normal, Fragile).",
    "Scout Acc.": "Scout accuracy from the export (SctAcc).",
    Velo: "Velocity from the export.",
    "G/F": "Ground ball / fly ball tendency from the export.",
    Total:
      "Stats Total:\nNormalized production score from WAR, ERA+, rWAR, FIP-, and HLD (relievers).\nUses Min SP/RP IP from this tab. Below the floor, Total is 0.",
    "BB%":
      "Pitcher walk rate (walks per batter faced).\nSeparate from batter BB% in combined exports.",
    HLD: "Holds — shown when filtering RP only.",
    SV: "Saves — shown when filtering RP only.",
    BS: "Blown Saves — shown when filtering RP only.",
  };

  const STAT_BATTER_TIPS = {
    Dura: "Durability / injury proneness from the export’s Prone column (e.g. Durable, Normal, Fragile).",
    "Scout Acc.": "Scout accuracy from the export (SctAcc).",
    Total:
      "Stats Total:\nNormalized production score from wRC+, WAR, and OPS+ (ZR/UBR/CERA default off — raise in Options for an extra boost).\nUses Min G from this tab. Below the floor, Total is 0.",
    ZR: "Zone Rating — defensive runs prevented (fielding). Shown for reference; default weight 0 in Stats Total (WAR already includes defense).",
  };

  const HIGHLIGHT_TIPS = {
    "hl-my-team": "Your team (set in Options).",
    "hl-rp-sp-potential":
      "This RP has 3 or more pitches and stamina ≥ 50.\nCandidate for training as a starting pitcher (SP).",
    "hl-1b-to-3b":
      "1B meets all minimums for 3B (Range ≥ 50, Arm ≥ 55, Error ≥ 45):\nCandidate for training as a third base.",
    "hl-2b-to-ss":
      "2B meets all minimums for SS (Range ≥ 65, Arm ≥ 50, Error ≥ 50, DP ≥ 50):\nCandidate for training as a shortstop.",
  };

  function myTeamAbbr() {
    return String(window.HECTOR_MY_TEAM || "").trim();
  }

  function isMyTeamPlayer(p) {
    const mine = myTeamAbbr();
    if (!mine) return false;
    return String(p.team || "").trim().toUpperCase() === mine.toUpperCase();
  }

  function rowTags(p) {
    const tags = [...(p.tags || [])];
    if (isMyTeamPlayer(p) && !tags.includes("hl-my-team")) tags.unshift("hl-my-team");
    return tags;
  }

  function playerUrl(id) {
    if (!id || !urlTemplate) return "";
    try {
      return urlTemplate.replace("{pid}", String(id));
    } catch (_) {
      return "";
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dash(v) {
    const s = String(v ?? "").trim();
    return s === "" ? "—" : s;
  }

  function duraTd(prone) {
    const text = dash(prone);
    const cls = duraClass(prone);
    return cls
      ? `<td class="${cls}">${escapeHtml(text)}</td>`
      : `<td>${escapeHtml(text)}</td>`;
  }

  function getAllowedPositions() {
    const boxes = document.querySelectorAll('#live-filters input[name="pos"]:checked');
    return new Set(Array.from(boxes).map((b) => b.value));
  }

  /** True when RP is checked and SP is not — show bullpen-only columns (HLD/SV/BS). */
  function isRpOnlyFilter() {
    if (kind !== "pitchers") return false;
    const allowed = getAllowedPositions();
    return allowed.has("RP") && !allowed.has("SP");
  }

  function matchesSearch(player, search) {
    const raw = (search || "").trim();
    if (!raw) return true;
    const terms = raw.split(/\s+/);
    const textTerms = [];
    const ageFilters = [];
    const compRe = /^([<>]=?|=)?(\d+)$/;
    for (const term of terms) {
      const m = term.match(compRe);
      if (m) ageFilters.push([m[1] || "=", parseInt(m[2], 10)]);
      else textTerms.push(term.toLowerCase());
    }
    const pos = player.pos === "CL" ? "RP" : player.pos;
    const fields = `${player.name || ""} ${player.team || ""} ${pos}`.toLowerCase();
    if (!textTerms.every((t) => fields.includes(t))) return false;
    if (!ageFilters.length) return true;
    const age = /^\d+$/.test(String(player.age)) ? parseInt(player.age, 10) : null;
    if (age == null) return false;
    for (const [op, num] of ageFilters) {
      if (op === ">" && !(age > num)) return false;
      if (op === "<" && !(age < num)) return false;
      if (op === ">=" && !(age >= num)) return false;
      if (op === "<=" && !(age <= num)) return false;
      if (op === "=" && !(age === num)) return false;
    }
    return true;
  }

  function parseSampleNum(v) {
    const s = String(v ?? "").trim().replace(/,/g, "");
    if (!s || s === "-" || s === "—") return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  function filterPlayers(list) {
    const allowed = getAllowedPositions();
    const search = searchEl ? searchEl.value : "";
    const minSp = Number(window.HECTOR_MIN_IP_SP);
    const minRp = Number(window.HECTOR_MIN_IP_RP);
    return list.filter((p) => {
      const pos = p.pos === "CL" ? "RP" : p.pos;
      if (!allowed.has(pos)) return false;
      if (!duraFilter.isAllowed(p.prone)) return false;
      if (!scoutFilter.isAllowed(p.scout)) return false;
      if (kind === "pitchers") {
        if (!throwsFilter.isAllowed(p.throws)) return false;
        if (!gfFilter.isAllowed(p.gf)) return false;
      } else {
        if (!batsFilter.isAllowed(p.bats)) return false;
      }
      if (majorsOnly) {
        const maj = isMajorLeague(p);
        if (maj === false) return false;
      }
      // Stats mode: hide pitchers under the live Min SP/RP IP floors (0 = show everyone)
      if (useStats && kind === "pitchers") {
        const ip = parseSampleNum(p.ip) ?? 0;
        const min = pos === "SP"
          ? (Number.isFinite(minSp) ? minSp : 40)
          : (Number.isFinite(minRp) ? minRp : 20);
        if (ip < min) return false;
      }
      return matchesSearch(p, search);
    });
  }

  function ratingNum(val) {
    const s = String(val ?? "").replace(/ Stars/gi, "").trim();
    if (!s || s === "-") return 0;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function topByPosition(list, positions, n, secondary) {
    const sections = [];
    for (const pos of positions) {
      const group = [];
      const seen = new Set();
      for (const p of list) {
        const primary = p.pos === "CL" ? "RP" : p.pos;
        let include = primary === pos;
        if (!include && secondary && primary !== pos) {
          include = ratingNum(p.pos_ratings && p.pos_ratings[pos]) >= 50;
        }
        if (!include) continue;
        const key = p.id || p.name;
        if (seen.has(key)) continue;
        seen.add(key);
        group.push(p);
      }
      group.sort((a, b) => (b.total || 0) - (a.total || 0));
      sections.push({ pos, players: group.slice(0, n) });
    }
    return sections;
  }

  function th(label, tip) {
    const sorted =
      sortState && sortState.label === label
        ? ` data-sort="${sortState.dir}" aria-sort="${sortState.dir === "asc" ? "ascending" : "descending"}"`
        : "";
    if (label === "Dura") return duraFilter.headerCell(label, tip, sorted);
    if (label === "Bats") return batsFilter.headerCell(label, tip, sorted);
    if (label === "Throws") return throwsFilter.headerCell(label, tip, sorted);
    if (label === "Scout Acc." || label === "Scout") {
      return scoutFilter.headerCell("Scout Acc.", tip, sorted);
    }
    if (label === "G/F") return gfFilter.headerCell(label, tip, sorted);
    if (tip) {
      return `<th class="tip" data-tip="${escapeHtml(tip)}" data-col="${escapeHtml(label)}"${sorted}>${escapeHtml(label)}</th>`;
    }
    return `<th data-col="${escapeHtml(label)}"${sorted}>${escapeHtml(label)}</th>`;
  }

  function parseCell(text) {
    text = (text || "").trim();
    if (text === "" || text === "-" || text === "—" || text === "N/A") return { n: null, s: text };
    const cleaned = text.replace(/,/g, "").replace(/\$/g, "").replace(/ Stars/gi, "");
    const range = cleaned.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (range) return { n: (parseFloat(range[1]) + parseFloat(range[2])) / 2, s: text };
    const num = parseFloat(cleaned);
    if (!isNaN(num) && /^-?\d/.test(cleaned)) return { n: num, s: text };
    return { n: null, s: text.toLowerCase() };
  }

  function compareRows(a, b, colIdx, asc) {
    const av = parseCell(a.children[colIdx]?.textContent);
    const bv = parseCell(b.children[colIdx]?.textContent);
    if (av.n != null && bv.n != null) return asc ? av.n - bv.n : bv.n - av.n;
    if (av.n != null) return asc ? -1 : 1;
    if (bv.n != null) return asc ? 1 : -1;
    return asc ? av.s.localeCompare(bv.s) : bv.s.localeCompare(av.s);
  }

  /** Split tbody into position sections (sep + optional col-echo + player rows). */
  function sectionBlocks() {
    const blocks = [];
    let current = { prefix: [], rows: [] };
    for (const tr of Array.from(tbody.children)) {
      if (tr.classList.contains("sep")) {
        if (current.prefix.length || current.rows.length) blocks.push(current);
        current = { prefix: [tr], rows: [] };
      } else if (tr.classList.contains("col-echo")) {
        current.prefix.push(tr);
      } else {
        current.rows.push(tr);
      }
    }
    if (current.prefix.length || current.rows.length) blocks.push(current);
    return blocks;
  }

  function renumberSectionRanks(rows, rankIdx) {
    if (rankIdx < 0) return;
    rows.forEach((r, i) => {
      const cell = r.children[rankIdx];
      if (cell) cell.textContent = String(i + 1);
    });
  }

  function applySortToRows() {
    if (!sortState) return;
    if (sortState.label === "Rank") return;
    const ths = Array.from(headRow.querySelectorAll("th"));
    const colIdx = ths.findIndex((h) => h.dataset.col === sortState.label);
    if (colIdx < 0) return;
    const asc = sortState.dir === "asc";
    const topMode = view === "top20" || view === "top10";
    const rankIdx = ths.findIndex((h) => h.dataset.col === "Rank");

    if (!topMode) {
      const rows = Array.from(tbody.querySelectorAll("tr")).filter(
        (r) => !r.classList.contains("sep") && !r.classList.contains("col-echo"),
      );
      rows.sort((a, b) => compareRows(a, b, colIdx, asc));
      rows.forEach((r) => tbody.appendChild(r));
      return;
    }

    const blocks = sectionBlocks();
    blocks.forEach((block) => {
      block.rows.sort((a, b) => compareRows(a, b, colIdx, asc));
      renumberSectionRanks(block.rows, rankIdx);
      block.prefix.forEach((r) => tbody.appendChild(r));
      block.rows.forEach((r) => tbody.appendChild(r));
    });
  }

  function renderHead(topMode) {
    let html = comparePickTh();
    if (topMode) html += th("Rank");
    html += th("Name") + th("Team") + th("Age") + th("POS");
    if (kind === "pitchers") {
      if (useStats) {
        const tips = STAT_PITCHER_TIPS;
        const rpOnly = isRpOnlyFilter();
        html +=
          th("Throws") +
          th("Dura", tips.Dura) +
          th("Scout Acc.", tips["Scout Acc."]) +
          th("Velo", tips.Velo) +
          th("G/F", tips["G/F"]) +
          th("IP") +
          th("ERA+") +
          th("FIP") +
          th("K/9") +
          th("BB/9") +
          th("BB%", tips["BB%"]) +
          th("HR/9");
        if (rpOnly) {
          html += th("HLD", tips.HLD) + th("SV", tips.SV) + th("BS", tips.BS);
        }
        html += th("WAR") + th("rWAR") + th("Total", tips.Total);
      } else {
        const tips = PITCHER_TIPS;
        html +=
          th("Dura") +
          th("Scout Acc.") +
          th("Throws") +
          th("Velo") +
          th("#P") +
          th("G/F") +
          th("Pitch", tips.Pitch) +
          th("Pitch Pot.", tips["Pitch Pot."]) +
          th("Potential", tips.Potential) +
          th("Current", tips.Current) +
          th("Total", tips.Total);
      }
    } else if (useStats) {
      const tips = STAT_BATTER_TIPS;
      html +=
        th("Bats") +
        th("Dura", tips.Dura) +
        th("Scout Acc.", tips["Scout Acc."]) +
        th("G") +
        th("wRC+") +
        th("WAR") +
        th("OPS+") +
        th("AVG") +
        th("OBP") +
        th("SLG") +
        th("ISO") +
        th("ZR", tips.ZR) +
        th("BB%") +
        th("SO%") +
        th("Total", tips.Total);
    } else {
      const tips = BATTER_TIPS;
      html += th("Bats") + th("Dura") + th("Scout Acc.");
      if (!topMode) html += th("OVR") + th("POT");
      html +=
        th("Offense", tips.Offense) +
        th("Off. Pot.", tips["Off. Pot."]) +
        th("Defense", tips.Defense) +
        th("Total", tips.Total);
    }
    headRow.innerHTML = html;
    if (tableEl) tableEl.classList.remove("sort-disabled");
  }

  function columnCount() {
    const n = headRow.querySelectorAll("th").length;
    return n > 0 ? n : 16;
  }

  /** Non-sortable column label row for Top by POS sections after the first. */
  function sectionColEchoRow() {
    const labels = Array.from(headRow.querySelectorAll("th")).map((th) =>
      (th.dataset.col || th.textContent || "").replace(/\s*[↑↓▾]\s*$/, "").trim(),
    );
    if (!labels.length) return "";
    return `<tr class="col-echo">${labels
      .map((lab) => `<td>${escapeHtml(lab)}</td>`)
      .join("")}</tr>`;
  }

  function rowHighlightTip(tags) {
    const reasons = (tags || [])
      .map((t) => HIGHLIGHT_TIPS[t])
      .filter(Boolean);
    return reasons.length ? reasons.join("\n") : "";
  }

  function renderPitcherRow(p, rank) {
    const tags = rowTags(p);
    const tip = rowHighlightTip(tags);
    const cls = tags.join(" ");
    const tipAttr = tip ? ` class="tip ${cls}" data-tip="${escapeHtml(tip)}"` : ` class="${cls}"`;
    const href = playerUrl(p.id);
    const nameCell = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a>`
      : escapeHtml(p.name);
    const top = view === "top20";
    let cells = comparePickTd(p.id, p.name);
    if (top) cells += `<td>${rank}</td>`;
    cells += `<td>${nameCell}</td><td>${escapeHtml(p.team)}</td><td>${escapeHtml(p.age)}</td><td>${escapeHtml(p.pos)}</td>`;
    if (useStats) {
      const rpOnly = isRpOnlyFilter();
      cells += `<td>${escapeHtml(dash(p.throws))}</td>`;
      cells += duraTd(p.prone);
      cells += `<td>${escapeHtml(dash(p.scout))}</td>`;
      cells += `<td>${escapeHtml(dash(p.velo))}</td><td>${escapeHtml(dash(p.gf))}</td>`;
      cells += `<td>${escapeHtml(dash(p.ip))}</td><td>${escapeHtml(dash(p.era_plus))}</td>`;
      cells += `<td>${escapeHtml(dash(p.fip))}</td>`;
      cells += `<td>${escapeHtml(dash(p.k9))}</td><td>${escapeHtml(dash(p.bb9))}</td>`;
      cells += `<td>${escapeHtml(dash(p.bb_pct))}</td><td>${escapeHtml(dash(p.hr9))}</td>`;
      if (rpOnly) {
        cells += `<td>${escapeHtml(dash(p.hld))}</td><td>${escapeHtml(dash(p.sv))}</td><td>${escapeHtml(dash(p.bs))}</td>`;
      }
      cells += `<td>${escapeHtml(dash(p.war))}</td><td>${escapeHtml(dash(p.rwar))}</td>`;
      cells += `<td class="num-strong">${escapeHtml(p.total)}</td>`;
    } else {
      cells += duraTd(p.prone);
      cells += `<td>${escapeHtml(p.scout)}</td>`;
      cells += `<td>${escapeHtml(p.throws)}</td><td>${escapeHtml(p.velo)}</td><td>${escapeHtml(p.pitches)}</td><td>${escapeHtml(p.gf)}</td>`;
      cells += `<td>${escapeHtml(p.pitch_score)}</td><td>${escapeHtml(p.pitch_pot)}</td><td>${escapeHtml(p.potential)}</td><td>${escapeHtml(p.current)}</td><td class="num-strong">${escapeHtml(p.total)}</td>`;
    }
    return `<tr${tipAttr} data-player-id="${escapeHtml(p.id)}" data-player-name="${escapeHtml(p.name)}" data-player-type="pitcher">${cells}</tr>`;
  }

  function renderBatterRow(p, rank) {
    const tags = rowTags(p);
    const tip = rowHighlightTip(tags);
    const cls = tags.join(" ");
    const tipAttr = tip ? ` class="tip ${cls}" data-tip="${escapeHtml(tip)}"` : ` class="${cls}"`;
    const href = playerUrl(p.id);
    const nameCell = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a>`
      : escapeHtml(p.name);
    const top = view === "top10";
    let cells = comparePickTd(p.id, p.name);
    if (top) cells += `<td>${rank}</td>`;
    cells += `<td>${nameCell}</td><td>${escapeHtml(p.team)}</td><td>${escapeHtml(p.age)}</td><td>${escapeHtml(p.pos)}</td>`;
    if (useStats) {
      cells += `<td>${escapeHtml(dash(p.bats))}</td>`;
      cells += duraTd(p.prone);
      cells += `<td>${escapeHtml(dash(p.scout))}</td>`;
      cells += `<td>${escapeHtml(dash(p.g))}</td><td>${escapeHtml(dash(p.wrc_plus))}</td><td>${escapeHtml(dash(p.war))}</td><td>${escapeHtml(dash(p.ops_plus))}</td>`;
      cells += `<td>${escapeHtml(dash(p.avg))}</td><td>${escapeHtml(dash(p.obp))}</td><td>${escapeHtml(dash(p.slg))}</td><td>${escapeHtml(dash(p.iso))}</td>`;
      cells += `<td>${escapeHtml(dash(p.zr))}</td>`;
      cells += `<td>${escapeHtml(dash(p.bb_pct))}</td><td>${escapeHtml(dash(p.so_pct))}</td>`;
      cells += `<td class="num-strong">${escapeHtml(p.total)}</td>`;
    } else {
      cells += `<td>${escapeHtml(p.bats)}</td>` + duraTd(p.prone) + `<td>${escapeHtml(p.scout)}</td>`;
      if (!top) cells += `<td>${escapeHtml(p.ovr)}</td><td>${escapeHtml(p.pot_stars)}</td>`;
      cells += `<td>${escapeHtml(p.offense)}</td><td>${escapeHtml(p.offense_pot)}</td><td>${escapeHtml(p.defense)}</td><td class="num-strong">${escapeHtml(p.total)}</td>`;
    }
    return `<tr${tipAttr} data-player-id="${escapeHtml(p.id)}" data-player-name="${escapeHtml(p.name)}" data-player-type="batter">${cells}</tr>`;
  }

  function render() {
    const filtered = filterPlayers(players);
    const topMode = kind === "pitchers" ? view === "top20" : view === "top10";
    renderHead(topMode);

    let html = "";
    let shown = 0;
    const colSpan = columnCount();

    if (kind === "pitchers" && view === "top20") {
      const sections = topByPosition(filtered, ["SP", "RP"], 20, false);
      sections.forEach((sec, idx) => {
        html += `<tr class="sep"><td colspan="${colSpan}">— Top 20 ${escapeHtml(sec.pos)} —</td></tr>`;
        if (idx > 0) html += sectionColEchoRow();
        sec.players.forEach((p, i) => {
          html += renderPitcherRow(p, i + 1);
          shown++;
        });
      });
    } else if (kind === "batters" && view === "top10") {
      const order = ["C", "1B", "2B", "3B", "SS", "DH", "LF", "CF", "RF"];
      const secondary = !!(secondaryEl && secondaryEl.checked);
      const sections = topByPosition(filtered, order, 10, secondary);
      sections.forEach((sec, idx) => {
        html += `<tr class="sep"><td colspan="${colSpan}">— Top 10 ${escapeHtml(sec.pos)} —</td></tr>`;
        if (idx > 0) html += sectionColEchoRow();
        sec.players.forEach((p, i) => {
          html += renderBatterRow(p, i + 1);
          shown++;
        });
      });
    } else if (kind === "pitchers") {
      filtered.forEach((p) => {
        html += renderPitcherRow(p);
        shown++;
      });
    } else {
      filtered.forEach((p) => {
        html += renderBatterRow(p);
        shown++;
      });
    }

    tbody.innerHTML = html || `<tr><td colspan="${colSpan}" class="muted">No players match filters</td></tr>`;
    if (countEl) countEl.textContent = `${shown} shown`;
    if (secondaryWrap) {
      secondaryWrap.style.display = view === "top10" ? "" : "none";
    }
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("btn-accent", btn.dataset.view === view);
    });
    applySortToRows();
    allColFilters.forEach((f) => f.syncTriggerButtons());
    compareSelect?.afterRender();
  }

  let timer = null;
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  }

  duraFilter.bind(() => players.map((p) => normalizeFilterVal(p.prone)).filter(Boolean));
  batsFilter.bind(() => players.map((p) => normalizeFilterVal(p.bats)).filter(Boolean));
  throwsFilter.bind(() => players.map((p) => normalizeFilterVal(p.throws)).filter(Boolean));
  scoutFilter.bind(() => players.map((p) => normalizeFilterVal(p.scout)).filter(Boolean));
  gfFilter.bind(() => players.map((p) => normalizeFilterVal(p.gf)).filter(Boolean));

  const POS_GROUPS = {
    IF: ["C", "1B", "2B", "3B", "SS"],
    OF: ["LF", "CF", "RF"],
  };

  function posBoxes(values) {
    return Array.from(document.querySelectorAll('#live-filters input[name="pos"]')).filter((el) =>
      values.includes(el.value)
    );
  }

  function syncPosGroupButtons() {
    document.querySelectorAll(".pos-group-btn").forEach((btn) => {
      const vals = POS_GROUPS[btn.dataset.posGroup] || [];
      const boxes = posBoxes(vals);
      const allOn = boxes.length > 0 && boxes.every((b) => b.checked);
      btn.classList.toggle("btn-accent", allOn);
    });
  }

  document.querySelectorAll(".pos-group-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const vals = POS_GROUPS[btn.dataset.posGroup] || [];
      const boxes = posBoxes(vals);
      const allOn = boxes.length > 0 && boxes.every((b) => b.checked);
      boxes.forEach((b) => {
        b.checked = !allOn;
      });
      syncPosGroupButtons();
      scheduleRender();
    });
  });

  if (searchEl) searchEl.addEventListener("input", scheduleRender);
  document.querySelectorAll('#live-filters input[name="pos"]').forEach((el) => {
    el.addEventListener("change", () => {
      syncPosGroupButtons();
      scheduleRender();
    });
  });
  if (secondaryEl) secondaryEl.addEventListener("change", scheduleRender);
  syncPosGroupButtons();

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      view = btn.dataset.view;
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      window.history.replaceState({}, "", url);
      render();
    });
  });

  headRow.addEventListener("click", (e) => {
    if (e.target.closest(".col-filter-btn") || e.target.closest(".dura-filter-btn")) return;
    const thEl = e.target.closest("th");
    if (!thEl) return;
    const label = thEl.dataset.col || thEl.textContent.trim();
    if (!label || label === "Rank" || label === "Cmp") return;
    // First click → desc (high→low); same column toggles asc/desc
    const dir =
      sortState && sortState.label === label && sortState.dir === "desc" ? "asc" : "desc";
    sortState = { label, dir };

    const ths = Array.from(headRow.querySelectorAll("th"));
    ths.forEach((h) => {
      delete h.dataset.sort;
      h.removeAttribute("aria-sort");
    });
    thEl.dataset.sort = dir;
    thEl.setAttribute("aria-sort", dir === "asc" ? "ascending" : "descending");
    applySortToRows();
  });

  window.addEventListener("hector:players", () => {
    players = window.HECTOR_PLAYERS || [];
    kind = window.HECTOR_KIND || kind;
    view = window.HECTOR_VIEW || view;
    urlTemplate = window.PLAYER_URL_TEMPLATE || urlTemplate;
    useStats = !!window.HECTOR_USE_STATS;
    majorsOnly = window.HECTOR_MAJORS_ONLY !== false;
    render();
  });

  // Initial paint — may be empty if the page module hasn't hydrated yet;
  // hector:players will re-render once data is ready.
  render();
})();
