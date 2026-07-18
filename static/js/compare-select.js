/**
 * List-tab multi-select (1–3) → Compare via sessionStorage seed.
 * Call afterRender() after the table HTML is rebuilt.
 */
import { goToCompare, MAX_COMPARE_PLAYERS } from "./compare_seed.js";

/**
 * @param {{
 *   filtersEl: HTMLElement,
 *   tableEl: HTMLElement,
 *   getPlayerType: () => "batter"|"pitcher",
 *   getPool?: () => "roster"|"draft"|"ifa",
 * }} opts
 */
export function mountCompareSelect(opts) {
  const {
    filtersEl,
    tableEl,
    getPlayerType,
    getPool = () => "roster",
  } = opts;

  /** @type {Map<string, { id: string, name: string }>} */
  const selected = new Map();

  const wrap = document.createElement("span");
  wrap.className = "compare-select-controls";
  wrap.innerHTML = `
    <button type="button" class="btn tip btn-accent" id="compare-select-go" disabled
      data-tip="Select 1–3 players of the same type, then open Compare. Draft/IFA selections use that pool.">
      Compare (0)
    </button>
    <button type="button" class="btn tip" id="compare-select-clear" hidden
      data-tip="Clear compare selection.">Clear</button>
  `;
  filtersEl.appendChild(wrap);

  const goBtn = wrap.querySelector("#compare-select-go");
  const clearBtn = wrap.querySelector("#compare-select-clear");

  function playerKey(id, name) {
    return String(id || name || "");
  }

  function syncToolbar() {
    const n = selected.size;
    goBtn.textContent = `Compare (${n})`;
    goBtn.disabled = n < 1;
    clearBtn.hidden = n < 1;
  }

  function syncRowChecks() {
    const atMax = selected.size >= MAX_COMPARE_PLAYERS;
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

  tableEl.addEventListener("change", (e) => {
    const cb = e.target.closest(".compare-pick");
    if (!cb) return;
    const tr = cb.closest("tr[data-player-name]");
    if (!tr) return;
    const id = String(tr.dataset.playerId || "");
    const name = String(tr.dataset.playerName || "");
    const key = playerKey(id, name);
    if (cb.checked) {
      if (selected.size >= MAX_COMPARE_PLAYERS) {
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

  clearBtn.addEventListener("click", clear);

  syncToolbar();

  return { afterRender, clear, selected };
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

export function comparePickTh() {
  return `<th class="col-compare tip" data-col="Cmp" data-tip="Select up to 3 players, then Compare.">Cmp</th>`;
}
