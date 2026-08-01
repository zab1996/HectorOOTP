import { hydrateState, hasData, playerUrl, rescore } from "./hector/store.js";
import { buildSummary, formatAppSummaryHtml } from "./hector/display.js";
import { normalizePlayerStatKeys } from "./hector/parse.js";

/** Shown in the topbar brand. Bump on user-facing releases. */
export const APP_VERSION = "3.3.2 Web";

/** Bump when scoring formulas change so cached Totals refresh on next page load. */
export const SCORING_VERSION = 14;

const PAGES = [
  ["index.html", "Upload", "home"],
  ["pitchers.html", "Pitchers", "pitchers"],
  ["batters.html", "Batters", "batters"],
  ["draft.html", "Draft", "draft"],
  ["ifa.html", "IFA", "ifa"],
  ["teams.html", "Teams", "teams"],
  ["compare.html", "Compare", "compare"],
  ["trade.html", "Trade", "trade"],
  ["contract.html", "Contract", "contract"],
  ["options.html", "Options", "options"],
];

const MORE_PAGES = [
  ["archetypes.html", "Archetypes", "archetypes"],
  ["league.html", "League Analysis", "league"],
  ["upcoming-fa.html", "Upcoming FA", "upcoming-fa"],
  ["team-salary.html", "Team Salary", "team-salary"],
  ["hidden-gems.html", "Hidden Gems", "hidden-gems"],
  ["glossary.html", "Glossary", "glossary"],
];

/** Map active page id → glossary hash section. */
export const GLOSSARY_SECTIONS = {
  home: "modes",
  pitchers: "pitchers",
  batters: "batters",
  draft: "modes",
  ifa: "modes",
  teams: "teams",
  compare: "compare",
  trade: "trade",
  contract: "contract",
  archetypes: "archetypes",
  league: "league",
  "upcoming-fa": "upcoming-fa",
  "team-salary": "team-salary",
  "hidden-gems": "hidden-gems",
  options: "pitchers",
  glossary: null,
};

export async function requireData() {
  const state = await hydrateState();
  if (!hasData(state)) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

function navLink(href, label, id, active) {
  return `<a href="${href}" class="${active === id ? "active" : ""}">${label}</a>`;
}

function moreMenuHtml(active) {
  const onMorePage = MORE_PAGES.some(([, , id]) => id === active);
  const items = MORE_PAGES.map(
    ([href, label, id]) =>
      `<a href="${href}" class="nav-more-item ${active === id ? "active" : ""}" role="menuitem">${label}</a>`,
  ).join("");
  return `
    <div class="nav-more" id="nav-more">
      <button type="button" class="nav-more-trigger ${onMorePage ? "active" : ""}" id="nav-more-trigger"
        aria-haspopup="menu" aria-expanded="false">More</button>
      <div class="nav-more-menu" id="nav-more-menu" role="menu" hidden>${items}</div>
    </div>`;
}

function glossaryButtonHtml(active) {
  const section = GLOSSARY_SECTIONS[active];
  if (!section) return "";
  const href = `glossary.html#${section}`;
  return `<a class="btn glossary-jump tip" href="${href}" data-tip="Open the Glossary section for this page.">Glossary</a>`;
}

/** Place the page glossary jump in page content (toolbar or top of main), not the topbar. */
function mountPageGlossary(active) {
  document.querySelectorAll(".glossary-jump, .page-glossary").forEach((el) => el.remove());
  const html = glossaryButtonHtml(active);
  if (!html) return;

  const filters = document.querySelector("main .filters");
  if (filters && !filters.closest("[hidden]")) {
    filters.insertAdjacentHTML("beforeend", html);
    return;
  }

  const main = document.querySelector("main");
  if (main) {
    main.insertAdjacentHTML("afterbegin", `<div class="page-glossary">${html}</div>`);
  }
}

export async function mountShell(active) {
  let state = await hydrateState();
  if (hasData(state) && state.scoringVersion !== SCORING_VERSION) {
    state.batters = (state.batters || []).map((b) => normalizePlayerStatKeys(b));
    state.pitchers = (state.pitchers || []).map((p) => normalizePlayerStatKeys(p));
    state.scoringVersion = SCORING_VERSION;
    state = await rescore(state);
  }
  const data = hasData(state);
  const summary = data ? buildSummary(state.pitchers, state.batters) : null;

  const header = document.getElementById("app-header");
  if (header) {
    header.innerHTML = `
      <div class="brand"><a href="index.html">Hector</a><span class="version">${APP_VERSION}</span></div>
      <nav>
        ${PAGES.map(([href, label, id]) => navLink(href, label, id, active)).join("")}
        ${moreMenuHtml(active)}
      </nav>
    `;

    const more = document.getElementById("nav-more");
    const trigger = document.getElementById("nav-more-trigger");
    const menu = document.getElementById("nav-more-menu");
    if (trigger && menu && more) {
      const setOpen = (open) => {
        menu.hidden = !open;
        more.classList.toggle("is-open", open);
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      };
      // Hover to open (desktop); click toggles for touch / keyboard
      more.addEventListener("mouseenter", () => setOpen(true));
      more.addEventListener("mouseleave", () => setOpen(false));
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(menu.hidden);
      });
      menu.addEventListener("click", (e) => e.stopPropagation());
      document.addEventListener("click", () => setOpen(false));
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") setOpen(false);
      });
    }
  }

  const summaryEl = document.getElementById("app-summary");
  if (summaryEl) {
    if (summary) {
      summaryEl.hidden = false;
      summaryEl.innerHTML = formatAppSummaryHtml(summary);
    } else {
      summaryEl.hidden = true;
    }
  }

  mountPageGlossary(active);

  window.HECTOR_STATE = state;
  window.PLAYER_URL_TEMPLATE = state.urlTemplate;
  window.HECTOR_MY_TEAM = state.myTeam || "";
  window.playerUrl = (id) => playerUrl(id, state);
  return state;
}
