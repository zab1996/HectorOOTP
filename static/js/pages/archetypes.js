import { mountShell, requireData } from "../shell.js?v=45";
import { ARCHETYPES, findPlayersByArchetype, archetypeTipText } from "../hector/archetypes.js";

if (!(await requireData())) throw new Error("redirect");
const state = await mountShell("archetypes");

const select = document.getElementById("archetype-select");
const trigger = document.getElementById("archetype-trigger");
const menu = document.getElementById("archetype-menu");
const wrap = document.getElementById("archetype-select-wrap");
const typeEl = document.getElementById("player-type");
const minEl = document.getElementById("min-fit");
const desc = document.getElementById("arch-desc");
const body = document.getElementById("arch-body");

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tipText(info) {
  return archetypeTipText(info);
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, "&#10;");
}

function setArchetype(key, { close = true } = {}) {
  const info = ARCHETYPES[key];
  if (!info) return;
  select.value = key;
  trigger.textContent = info.name;
  trigger.setAttribute("data-tip", tipText(info));
  trigger.classList.add("tip");
  menu.querySelectorAll("[role='option']").forEach((li) => {
    const on = li.dataset.value === key;
    li.setAttribute("aria-selected", on ? "true" : "false");
    li.classList.toggle("is-selected", on);
  });
  if (close) closeMenu();
  syncTypeOptions();
}

function openMenu() {
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  wrap.classList.add("is-open");
}

function closeMenu() {
  menu.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  wrap.classList.remove("is-open");
}

function toggleMenu() {
  if (menu.hidden) openMenu();
  else closeMenu();
}

menu.innerHTML = Object.entries(ARCHETYPES)
  .map(
    ([key, info]) => `
    <li role="option" tabindex="-1" data-value="${escapeHtml(key)}"
        class="tip arch-select-option" data-tip="${escapeAttr(tipText(info))}"
        aria-selected="false">${escapeHtml(info.name)}</li>`
  )
  .join("");

const firstKey = Object.keys(ARCHETYPES)[0];
setArchetype(firstKey, { close: true });

trigger.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleMenu();
});

menu.addEventListener("click", (e) => {
  const opt = e.target.closest("[data-value]");
  if (!opt) return;
  setArchetype(opt.dataset.value);
  run();
});

document.addEventListener("click", (e) => {
  if (!wrap.contains(e.target)) closeMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

function syncTypeOptions() {
  const key = select.value;
  const info = ARCHETYPES[key];
  desc.textContent = info ? info.description : "";
  const types = info?.player_types || [];
  [...typeEl.options].forEach((opt) => {
    opt.disabled = types.length > 0 && !types.includes(opt.value);
  });
  if (typeEl.selectedOptions[0]?.disabled) {
    typeEl.value = types[0] || "batter";
  }
}

function run() {
  const key = select.value;
  const playerType = typeEl.value;
  const minFit = Number(minEl.value) || 40;
  const pool = playerType === "pitcher" ? state.pitchers : state.batters;
  const rows = findPlayersByArchetype(pool, key, playerType, minFit);
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7" class="muted">No players with fit ≥ ${minFit}</td></tr>`;
    return;
  }
  body.innerHTML = rows
    .map((r) => {
      const p = r.player;
      const pct = r.fit_score ?? 0;
      const color = r.fit_label?.color || "inherit";
      return `<tr data-player-id="${p.ID || ""}" data-player-name="${p.Name || ""}" data-player-type="${playerType}">
        <td>${p.Name || ""}</td>
        <td>${p.ORG || ""}</td>
        <td>${p.POS || ""}</td>
        <td>${r.age ?? p.Age ?? ""}</td>
        <td>${p.OVR || ""}</td>
        <td>${p.POT || ""}</td>
        <td class="num-strong tip" style="color:${color}" data-tip="Fit % from smoothed archetype checklist (0–100).">${pct}%</td>
      </tr>`;
    })
    .join("");
}

document.getElementById("run-arch").addEventListener("click", run);
syncTypeOptions();
run();
