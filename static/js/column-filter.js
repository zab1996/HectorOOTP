/** Generic header ▾ multi-select filters (Durability, Bats, Throws, G/F, Scout Acc., …). */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeFilterVal(val) {
  const s = String(val ?? "").trim();
  if (!s || s === "-" || s === "—") return "";
  return s;
}

/** Canonical durability key — export may use "Iron Man" or "Ironman". */
export function normalizeDuraKey(val) {
  const s = normalizeFilterVal(val);
  if (!s) return "";
  const compact = s.toLowerCase().replace(/[\s_\-]+/g, "");
  if (compact === "ironman") return "ironman";
  if (compact === "durable") return "durable";
  if (compact === "normal") return "normal";
  if (compact === "fragile") return "fragile";
  if (compact === "wrecked") return "wrecked";
  return s.toLowerCase();
}

/**
 * Canonical bats key — exports may use L/R/S or Left/Right/Switch.
 * Returns "l" | "r" | "s" | "" (or lowercased unknown).
 */
export function normalizeBatsKey(val) {
  const s = normalizeFilterVal(val);
  if (!s) return "";
  const compact = s.toLowerCase().replace(/[\s_\-]+/g, "");
  if (compact === "l" || compact === "left" || compact === "lhb" || compact === "lefthanded") {
    return "l";
  }
  if (compact === "r" || compact === "right" || compact === "rhb" || compact === "righthanded") {
    return "r";
  }
  if (
    compact === "s" ||
    compact === "switch" ||
    compact === "b" ||
    compact === "both" ||
    compact === "switchhitter"
  ) {
    return "s";
  }
  return compact;
}

/**
 * Canonical throws key — exports may use L/R or Left/Right.
 * Returns "l" | "r" | "" (or lowercased unknown).
 */
export function normalizeThrowsKey(val) {
  const s = normalizeFilterVal(val);
  if (!s) return "";
  const compact = s.toLowerCase().replace(/[\s_\-]+/g, "");
  if (compact === "l" || compact === "left" || compact === "lhp" || compact === "lefthanded") {
    return "l";
  }
  if (compact === "r" || compact === "right" || compact === "rhp" || compact === "righthanded") {
    return "r";
  }
  return compact;
}

/** Display form for Bats column — L / R / S (accepts Left/Right/Switch). */
export function formatBatsDisplay(val) {
  const k = normalizeBatsKey(val);
  if (k === "l") return "L";
  if (k === "r") return "R";
  if (k === "s") return "S";
  return normalizeFilterVal(val);
}

/** Display form for Throws column — L / R (accepts Left/Right). */
export function formatThrowsDisplay(val) {
  const k = normalizeThrowsKey(val);
  if (k === "l") return "L";
  if (k === "r") return "R";
  return normalizeFilterVal(val);
}

export function duraOptionClass(key) {
  const k = normalizeDuraKey(key);
  if (k === "ironman") return "dura-ironman";
  if (k === "durable") return "dura-durable";
  if (k === "fragile") return "dura-fragile";
  if (k === "wrecked") return "dura-wrecked";
  return "";
}

/** CSS class for a raw Prone / Durability cell value. */
export function duraClass(prone) {
  return duraOptionClass(prone);
}

/** @type {Map<string, ReturnType<typeof createColumnFilter>>} */
const registry = new Map();
let docBound = false;

function closeAllExcept(exceptId) {
  for (const [id, f] of registry) {
    if (id !== exceptId) f.close();
  }
}

function ensureDocBind() {
  if (docBound) return;
  docBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".col-filter-btn");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.filterId;
      const f = registry.get(id);
      if (!f) return;
      closeAllExcept(id);
      f.toggle(btn);
      return;
    }
    if (!e.target.closest(".col-filter-menu")) {
      closeAllExcept(null);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllExcept(null);
  });
}

/**
 * @param {{
 *   id: string,
 *   title: string,
 *   values: Array<string | { value: string, label: string }>,
 *   includeMissing?: boolean,
 *   optionClass?: (key: string) => string,
 *   normalizeKey?: (raw: string) => string,
 *   onChange: () => void,
 *   getExtraValues?: () => string[],
 * }} opts
 */
export function createColumnFilter(opts) {
  const {
    id,
    title,
    values,
    includeMissing = true,
    optionClass,
    onChange,
    getExtraValues,
  } = opts;

  const keyOf =
    typeof opts.normalizeKey === "function"
      ? opts.normalizeKey
      : (raw) => normalizeFilterVal(raw).toLowerCase();

  const canonical = values.map((v) =>
    typeof v === "string" ? { value: v, label: v } : { value: v.value, label: v.label },
  );

  /** @type {Set<string>} filter keys; "" = blank / missing */
  const allowed = new Set(canonical.map((v) => keyOf(v.value)));
  if (includeMissing) allowed.add("");

  let menuEl = null;
  let open = false;

  function isRestricted() {
    if (includeMissing && !allowed.has("")) return true;
    return canonical.some((v) => !allowed.has(keyOf(v.value)));
  }

  function isAllowed(raw) {
    return allowed.has(keyOf(raw));
  }

  function optionList(extraValues) {
    const seen = new Set(canonical.map((v) => keyOf(v.value)));
    const extras = [];
    for (const raw of extraValues || []) {
      const n = normalizeFilterVal(raw);
      if (!n) continue;
      const k = keyOf(n);
      if (seen.has(k)) continue;
      seen.add(k);
      extras.push({ value: n, label: n });
    }
    extras.sort((a, b) => a.label.localeCompare(b.label));
    const list = [...canonical, ...extras];
    if (includeMissing) list.push({ value: "", label: "Missing" });
    return list;
  }

  function syncTriggerButtons() {
    const active = isRestricted();
    document.querySelectorAll(`.col-filter-btn[data-filter-id="${id}"]`).forEach((btn) => {
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.title = active ? `${title} filter active — click to edit` : `Filter by ${title.toLowerCase()}`;
    });
  }

  function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement("div");
    menuEl.className = "col-filter-menu";
    menuEl.hidden = true;
    menuEl.dataset.filterId = id;
    menuEl.setAttribute("role", "dialog");
    menuEl.setAttribute("aria-label", `Filter ${title}`);
    document.body.appendChild(menuEl);
    menuEl.addEventListener("click", (e) => e.stopPropagation());
    menuEl.addEventListener("change", (e) => {
      const input = e.target.closest('input[type="checkbox"][data-col-filter]');
      if (!input) return;
      const key = input.dataset.colFilter;
      if (input.checked) allowed.add(key);
      else allowed.delete(key);
      syncTriggerButtons();
      onChange();
    });
    return menuEl;
  }

  function renderMenu() {
    const extras = getExtraValues?.() || [];
    const menu = ensureMenu();
    const optsList = optionList(extras);
    menu.innerHTML = `
      <div class="col-filter-menu-head">Show ${escapeHtml(title)}</div>
      <div class="col-filter-menu-actions">
        <button type="button" class="btn col-filter-all">All</button>
      </div>
      ${optsList
        .map((o) => {
          const key = keyOf(o.value);
          const checked = allowed.has(key) ? " checked" : "";
          const cls = optionClass?.(key) ? ` ${optionClass(key)}` : "";
          return `<label class="col-filter-opt${cls}"><input type="checkbox" data-col-filter="${escapeHtml(key)}"${checked} /> ${escapeHtml(o.label)}</label>`;
        })
        .join("")}
    `;
    menu.querySelector(".col-filter-all")?.addEventListener("click", () => {
      allowed.clear();
      if (includeMissing) allowed.add("");
      optionList(extras).forEach((o) => {
        if (o.value !== "" || includeMissing) allowed.add(keyOf(o.value));
      });
      renderMenu();
      syncTriggerButtons();
      onChange();
    });
  }

  function placeMenu(btn) {
    const menu = ensureMenu();
    menu.hidden = false;
    const rect = btn.getBoundingClientRect();
    const pad = 8;
    let left = rect.left;
    let top = rect.bottom + 4;
    menu.style.left = "0px";
    menu.style.top = "0px";
    const mw = menu.offsetWidth || 176;
    const mh = menu.offsetHeight || 200;
    if (left + mw > window.innerWidth - pad) left = window.innerWidth - mw - pad;
    if (left < pad) left = pad;
    if (top + mh > window.innerHeight - pad) top = Math.max(pad, rect.top - mh - 4);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function close() {
    open = false;
    if (menuEl) menuEl.hidden = true;
    syncTriggerButtons();
  }

  function openAt(btn) {
    open = true;
    renderMenu();
    placeMenu(btn);
    syncTriggerButtons();
  }

  function toggle(btn) {
    if (open && menuEl && !menuEl.hidden) {
      close();
      return;
    }
    openAt(btn);
  }

  function headerCell(label, tip, sortedAttr = "") {
    const tipClass = tip ? " tip" : "";
    const tipAttr = tip ? ` data-tip="${escapeHtml(tip)}"` : "";
    const active = isRestricted() ? " is-active" : "";
    return `<th class="col-filter-col${tipClass}" data-col="${escapeHtml(label)}"${tipAttr}${sortedAttr}>${escapeHtml(label)}<button type="button" class="col-filter-btn${active}" data-filter-id="${escapeHtml(id)}" aria-label="Filter ${escapeHtml(title)}" aria-expanded="false" title="Filter by ${escapeHtml(title.toLowerCase())}">▾</button></th>`;
  }

  function bind(getExtras) {
    if (getExtras) opts.getExtraValues = getExtras;
    registry.set(id, api);
    ensureDocBind();
  }

  const api = {
    id,
    isAllowed,
    isRestricted,
    headerCell,
    bind,
    syncTriggerButtons,
    close,
    toggle,
  };

  registry.set(id, api);
  ensureDocBind();
  return api;
}

export const DURA_VALUES = ["Ironman", "Durable", "Normal", "Fragile", "Wrecked"];
export const BATS_VALUES = [
  { value: "L", label: "L (Left)" },
  { value: "R", label: "R (Right)" },
  { value: "S", label: "S (Switch)" },
];
export const THROWS_VALUES = [
  { value: "L", label: "L (Left)" },
  { value: "R", label: "R (Right)" },
];
export const SCOUT_ACC_VALUES = ["Very High", "High", "Average", "Low", "Very Low"];
export const GF_VALUES = ["EX GB", "GB", "NEU", "FB", "EX FB"];

export function scoutOptionClass(key) {
  if (key === "very high" || key === "extremely high" || key === "extremely good" || key === "excellent") {
    return "scout-acc-very-high";
  }
  if (key === "high" || key === "good" || key === "very good") return "scout-acc-high";
  if (key === "average" || key === "medium" || key === "normal") return "scout-acc-average";
  if (key === "low" || key === "fair" || key === "poor") return "scout-acc-low";
  if (key === "very low" || key === "awful") return "scout-acc-very-low";
  return "";
}

/** @deprecated use createColumnFilter — kept for older imports */
export function createDuraFilter({ onChange }) {
  return createColumnFilter({
    id: "dura",
    title: "Durability",
    values: DURA_VALUES,
    optionClass: duraOptionClass,
    normalizeKey: normalizeDuraKey,
    onChange,
  });
}

export const normalizeDura = normalizeDuraKey;
export const normalizeBats = normalizeBatsKey;
export const normalizeThrows = normalizeThrowsKey;
