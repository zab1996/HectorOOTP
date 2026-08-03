/**
 * List-tab multi-select → Compare via sessionStorage seed (and optional ID export).
 * Call afterRender() after the table HTML is rebuilt.
 * Selection Map keeps insertion order (export / Compare first-N follow checkbox order).
 */
import { goToCompare, MAX_COMPARE_PLAYERS } from "./compare_seed.js";

const DEFAULT_CMP_TIP = "Select up to 3 players, then Compare.";
const DEFAULT_COMPARE_TIP =
  "Select 1–3 players of the same type, then open Compare. Draft/IFA selections use that pool.";

/**
 * @param {{
 *   filtersEl: HTMLElement,
 *   tableEl: HTMLElement,
 *   getPlayerType: () => "batter"|"pitcher",
 *   getPool?: () => "roster"|"draft"|"ifa",
 *   maxSelect?: number,
 *   showExportIds?: boolean,
 *   cmpTip?: string,
 * }} opts
 */
export function mountCompareSelect(opts) {
  const {
    filtersEl,
    tableEl,
    getPlayerType,
    getPool = () => "roster",
    maxSelect = MAX_COMPARE_PLAYERS,
    showExportIds = false,
    cmpTip = DEFAULT_CMP_TIP,
  } = opts;

  const selectCap = Number.isFinite(maxSelect) && maxSelect > 0 ? maxSelect : MAX_COMPARE_PLAYERS;

  /** @type {Map<string, { id: string, name: string }>} insertion order = selection order */
  const selected = new Map();

  const compareTip = showExportIds
    ? "Opens Compare with the first 3 players you selected (same type). Select more anytime and use Export to text for all IDs in order."
    : DEFAULT_COMPARE_TIP;

  const wrap = document.createElement("span");
  wrap.className = "compare-select-controls";
  wrap.innerHTML = `
    <button type="button" class="btn tip btn-accent" id="compare-select-go" disabled
      data-tip="${escapeAttr(compareTip)}">
      Compare (0)
    </button>
    ${
      showExportIds
        ? `<button type="button" class="btn tip" id="compare-select-export" disabled
      data-tip="Download selected player IDs as a text file (one per line, in the order you checked them). Select as many as you want.">
      Export to text
    </button>`
        : ""
    }
    <button type="button" class="btn tip" id="compare-select-clear" hidden
      data-tip="Clear compare selection.">Clear</button>
  `;
  filtersEl.appendChild(wrap);

  const goBtn = wrap.querySelector("#compare-select-go");
  const exportBtn = wrap.querySelector("#compare-select-export");
  const clearBtn = wrap.querySelector("#compare-select-clear");

  // Expose tip for pages that rebuild the Cmp header
  wrap.dataset.cmpTip = cmpTip;

  function playerKey(id, name) {
    return String(id || name || "");
  }

  function syncToolbar() {
    const n = selected.size;
    goBtn.textContent = `Compare (${n})`;
    goBtn.disabled = n < 1;
    if (exportBtn) exportBtn.disabled = n < 1;
    clearBtn.hidden = n < 1;
  }

  function syncRowChecks() {
    const atMax = selected.size >= selectCap;
    tableEl.querySelectorAll("tr[data-player-name]").forEach((tr) => {
      const cb = tr.querySelector(".compare-pick");
      if (!cb) return;
      const key = playerKey(tr.dataset.playerId, tr.dataset.playerName);
      const on = selected.has(key);
      cb.checked = on;
      cb.disabled = !on && atMax;
    });
  }

  function afterRender() {
    syncRowChecks();
    syncToolbar();
  }

  function clear() {
    selected.clear();
    afterRender();
  }

  function downloadSelectedIds() {
    const ids = [...selected.values()]
      .map((p) => String(p.id || "").trim())
      .filter(Boolean);
    if (!ids.length) return;
    const blob = new Blob([ids.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hector-draft-ids.txt";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  tableEl.addEventListener("change", (e) => {
    const cb = e.target.closest(".compare-pick");
    if (!cb) return;
    const tr = cb.closest("tr[data-player-name]");
    if (!tr) return;
    const id = String(tr.dataset.playerId || "");
    const name = String(tr.dataset.playerName || "");
    const key = playerKey(id, name);
    if (cb.checked) {
      if (selected.size >= selectCap) {
        cb.checked = false;
        return;
      }
      selected.set(key, { id, name });
    } else {
      selected.delete(key);
    }
    afterRender();
  });

  // Don't open player card / follow name link when toggling compare
  tableEl.addEventListener(
    "click",
    (e) => {
      if (e.target.closest(".compare-pick, .col-compare")) {
        e.stopPropagation();
      }
    },
    true,
  );

  goBtn.addEventListener("click", () => {
    if (selected.size < 1) return;
    goToCompare({
      type: getPlayerType(),
      pool: getPool(),
      players: [...selected.values()],
    });
  });

  exportBtn?.addEventListener("click", downloadSelectedIds);
  clearBtn.addEventListener("click", clear);

  syncToolbar();

  return { afterRender, clear, selected, cmpTip };
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** First-column checkbox cell for list rows. */
export function comparePickTd(id, name) {
  return `<td class="col-compare"><input type="checkbox" class="compare-pick" aria-label="Select for compare" data-player-id="${escapeAttr(id)}" data-player-name="${escapeAttr(name)}" /></td>`;
}

/** @param {string} [tip] */
export function comparePickTh(tip = DEFAULT_CMP_TIP) {
  return `<th class="col-compare tip" data-col="Cmp" data-tip="${escapeAttr(tip)}">Cmp</th>`;
}
