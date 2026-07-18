import {
  loadAndScoreHtml,
  scorePlayers,
  draftMetaFromBias,
  defaultPitcherWeights,
  defaultBatterWeights,
  defaultPitcherStatWeights,
  defaultBatterStatWeights,
  deepClone,
} from "./index.js";
import { mergePitcherStatWeights, mergeBatterStatWeights } from "./stat_weights.js";
import { idbGet, idbSet } from "./idb.js";

const KEY = "hector_v1";
const IDB_PITCHERS = "pitchers";
const IDB_BATTERS = "batters";
const IDB_DRAFT_PITCHERS = "draft_pitchers";
const IDB_DRAFT_BATTERS = "draft_batters";
const IDB_TEAMS = "team_list";
/** Keep in sync with shell.js SCORING_VERSION */
const SCORING_VERSION = 14;

/** In-memory cache so sync loadState() works after hydrateState(). */
let memoryCache = null;

const defaults = () => ({
  pitchers: [],
  batters: [],
  draftPitchers: [],
  draftBatters: [],
  teamList: [],
  filename: null,
  draftFilename: null,
  teamListFilename: null,
  draftMode: false,
  /**
   * Draft tab only: bias between current and potential meta.
   * -1 = current-heavy, 0 = default (curr ×0.9 / pot ×1.5), +1 = potential-heavy.
   * Does not change Options Meta multipliers.
   */
  draftMetaBias: 0,
  useStatsScoring: true,
  /** When true, hide players whose Lev is not Major League / MLB (blank Lev still shown). */
  majorsOnly: true,
  /** Teams tab only — stats columns; does not rescore Pitchers/Batters. */
  teamsUseStats: true,
  /** Neutral-park display for counting/raw rates on Compare/Trade/Contract (needs Team List). */
  parkNormalizeStats: false,
  pitcherWeights: defaultPitcherWeights(),
  batterWeights: defaultBatterWeights(),
  pitcherStatWeights: defaultPitcherStatWeights(),
  batterStatWeights: defaultBatterStatWeights(),
  weightsCustomized: false,
  scoringVersion: 0,
  warnings: [],
  importStats: null,
  /** Players live in IndexedDB when true (localStorage only holds settings). */
  playersInIdb: false,
  /** StatsPlus (or similar) profile URL; `{pid}` is replaced with player ID. */
  urlTemplate: "https://atl-01.statsplus.net/rfbl/player/{pid}?page=dash",
  /** Your franchise ORG abbr — highlights players on Pitchers/Batters and the row on Teams. */
  myTeam: "",
  trade: {
    num_teams: 28,
    num_rounds: 20,
    team_a_players: [],
    team_b_players: [],
    team_a_picks: [],
    team_b_picks: [],
  },
});

function emptyTrade() {
  return {
    num_teams: 28,
    num_rounds: 20,
    team_a_players: [],
    team_b_players: [],
    team_a_picks: [],
    team_b_picks: [],
  };
}

function clampDraftMetaBias(bias) {
  const n = Number(bias);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

function draftMetaForState(state) {
  return draftMetaFromBias(state?.draftMetaBias ?? 0);
}

function scoreDraftPools(state) {
  const rawDp = (state.draftPitchers || []).map(({ Scores, ...rest }) => rest);
  const rawDb = (state.draftBatters || []).map(({ Scores, ...rest }) => rest);
  if (!rawDp.length && !rawDb.length) return;
  const draftScored = scorePlayers(rawDp, rawDb, {
    draftMode: true,
    draftMeta: draftMetaForState(state),
    pitcherWeights: state.pitcherWeights,
    batterWeights: state.batterWeights,
    useStats: false,
    pitcherStatWeights: state.pitcherStatWeights,
    batterStatWeights: state.batterStatWeights,
  });
  state.draftPitchers = draftScored.pitchers;
  state.draftBatters = draftScored.batters;
}

function readMetaFromLocalStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw);
    const state = { ...defaults(), ...data };
    state.pitcherStatWeights = mergePitcherStatWeights(data.pitcherStatWeights);
    state.batterStatWeights = mergeBatterStatWeights(data.batterStatWeights);
    if (!Array.isArray(state.pitchers)) state.pitchers = [];
    if (!Array.isArray(state.batters)) state.batters = [];
    if (!Array.isArray(state.draftPitchers)) state.draftPitchers = [];
    if (!Array.isArray(state.draftBatters)) state.draftBatters = [];
    if (!Array.isArray(state.teamList)) state.teamList = [];
    state.draftMetaBias = clampDraftMetaBias(state.draftMetaBias);
    return state;
  } catch {
    return defaults();
  }
}

function metaOnly(state) {
  const {
    pitchers: _p,
    batters: _b,
    draftPitchers: _dp,
    draftBatters: _db,
    teamList: _t,
    ...rest
  } = state;
  return {
    ...rest,
    playersInIdb: true,
    pitchers: [],
    batters: [],
    draftPitchers: [],
    draftBatters: [],
    teamList: [],
  };
}

function quotaMessage(err) {
  const name = err?.name || "";
  const msg = String(err?.message || err || "");
  if (name === "QuotaExceededError" || /quota/i.test(msg)) {
    return (
      "Browser storage is full. Hector now uses IndexedDB for large lists — " +
      "hard-refresh and try uploading again. If it still fails, free space or use a smaller export."
    );
  }
  return msg;
}

/**
 * Sync read. Prefer hydrateState() on page load so IndexedDB players are available.
 * After hydrate, this returns the in-memory cache.
 */
export function loadState() {
  if (memoryCache) return memoryCache;
  memoryCache = readMetaFromLocalStorage();
  return memoryCache;
}

/** Load players from IndexedDB (or migrate legacy localStorage payloads). */
export async function hydrateState() {
  const state = readMetaFromLocalStorage();
  const legacyPlayers =
    (state.pitchers && state.pitchers.length) || (state.batters && state.batters.length);

  if (legacyPlayers && !state.playersInIdb) {
    try {
      await idbSet(IDB_PITCHERS, state.pitchers);
      await idbSet(IDB_BATTERS, state.batters);
      state.playersInIdb = true;
      localStorage.setItem(KEY, JSON.stringify(metaOnly(state)));
    } catch (err) {
      console.warn("Hector: could not migrate players to IndexedDB", err);
    }
    memoryCache = state;
    return state;
  }

  if (state.playersInIdb || !legacyPlayers) {
    try {
      const [pitchers, batters, draftPitchers, draftBatters, teamList] = await Promise.all([
        idbGet(IDB_PITCHERS),
        idbGet(IDB_BATTERS),
        idbGet(IDB_DRAFT_PITCHERS),
        idbGet(IDB_DRAFT_BATTERS),
        idbGet(IDB_TEAMS),
      ]);
      if (Array.isArray(pitchers)) state.pitchers = pitchers;
      if (Array.isArray(batters)) state.batters = batters;
      if (Array.isArray(draftPitchers)) state.draftPitchers = draftPitchers;
      if (Array.isArray(draftBatters)) state.draftBatters = draftBatters;
      if (Array.isArray(teamList)) state.teamList = teamList;
      state.playersInIdb = true;
    } catch (err) {
      console.warn("Hector: IndexedDB read failed", err);
    }
  }

  memoryCache = state;
  return state;
}

export async function saveState(state) {
  memoryCache = state;
  try {
    await Promise.all([
      idbSet(IDB_PITCHERS, state.pitchers || []),
      idbSet(IDB_BATTERS, state.batters || []),
      idbSet(IDB_DRAFT_PITCHERS, state.draftPitchers || []),
      idbSet(IDB_DRAFT_BATTERS, state.draftBatters || []),
      idbSet(IDB_TEAMS, state.teamList || []),
    ]);
    state.playersInIdb = true;
    localStorage.setItem(KEY, JSON.stringify(metaOnly(state)));
  } catch (err) {
    const wrapped = new Error(quotaMessage(err));
    wrapped.cause = err;
    throw wrapped;
  }
  return state;
}

export function hasData(state = loadState()) {
  return (state.pitchers && state.pitchers.length) || (state.batters && state.batters.length);
}

export function hasDraftData(state = loadState()) {
  return (
    (state.draftPitchers && state.draftPitchers.length) ||
    (state.draftBatters && state.draftBatters.length)
  );
}

export function playerUrl(pid, state = loadState()) {
  const t = state.urlTemplate || "";
  try {
    return t.replace("{pid}", String(pid));
  } catch {
    return t;
  }
}

export async function setUrlTemplate(template) {
  const state = await hydrateState();
  const next = String(template ?? "").trim();
  state.urlTemplate =
    next || "https://atl-01.statsplus.net/rfbl/player/{pid}?page=dash";
  await saveState(state);
  return state;
}

/** Unique ORG abbrs from loaded players (and Team List if present), sorted. */
export function listOrgAbbrs(state = loadState()) {
  const set = new Set();
  for (const p of state.pitchers || []) {
    const o = String(p.ORG ?? "").trim();
    if (o) set.add(o);
  }
  for (const b of state.batters || []) {
    const o = String(b.ORG ?? "").trim();
    if (o) set.add(o);
  }
  for (const t of state.teamList || []) {
    const o = String(t.abbr ?? "").trim();
    if (o) set.add(o);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export async function setMyTeam(org) {
  const state = await hydrateState();
  state.myTeam = String(org ?? "").trim();
  await saveState(state);
  return state;
}

export function isMyTeam(org, state = loadState()) {
  const mine = String(state.myTeam ?? "").trim();
  if (!mine) return false;
  return String(org ?? "").trim().toUpperCase() === mine.toUpperCase();
}

export async function ingestHtml(html, filename) {
  const state = await hydrateState();
  const data = loadAndScoreHtml(html, {
    draftMode: false,
    pitcherWeights: state.pitcherWeights,
    batterWeights: state.batterWeights,
    useStats: state.useStatsScoring,
    pitcherStatWeights: state.pitcherStatWeights,
    batterStatWeights: state.batterStatWeights,
  });
  state.pitchers = data.pitchers;
  state.batters = data.batters;
  state.warnings = data.warnings;
  state.importStats = data.importStats || null;
  state.filename = filename || "Player List.html";
  state.draftMode = false;
  state.trade = emptyTrade();
  state.scoringVersion = SCORING_VERSION;
  await saveState(state);
  return state;
}

/** Score and store a draft-class export (draft meta; Options meta left alone). */
export async function ingestDraftClassHtml(html, filename) {
  const state = await hydrateState();
  const data = loadAndScoreHtml(html, {
    draftMode: true,
    draftMeta: draftMetaForState(state),
    pitcherWeights: state.pitcherWeights,
    batterWeights: state.batterWeights,
    useStats: false,
    pitcherStatWeights: state.pitcherStatWeights,
    batterStatWeights: state.batterStatWeights,
  });
  state.draftPitchers = data.pitchers;
  state.draftBatters = data.batters;
  state.draftFilename = filename || "Draft Class.html";
  await saveState(state);
  return state;
}

export async function ingestTeamList(teams, filename) {
  const state = await hydrateState();
  state.teamList = Array.isArray(teams) ? teams : [];
  state.teamListFilename = filename || "Team List.html";
  await saveState(state);
  return state;
}

export async function rescore(state) {
  const s = state || (await hydrateState());
  const rawP = s.pitchers.map(({ Scores, ...rest }) => rest);
  const rawB = s.batters.map(({ Scores, ...rest }) => rest);
  const scored = scorePlayers(rawP, rawB, {
    draftMode: false,
    pitcherWeights: s.pitcherWeights,
    batterWeights: s.batterWeights,
    useStats: s.useStatsScoring,
    pitcherStatWeights: s.pitcherStatWeights,
    batterStatWeights: s.batterStatWeights,
  });
  s.pitchers = scored.pitchers;
  s.batters = scored.batters;
  s.draftMode = false;

  if ((s.draftPitchers && s.draftPitchers.length) || (s.draftBatters && s.draftBatters.length)) {
    scoreDraftPools(s);
  }

  await saveState(s);
  return s;
}

/** Draft tab: bias current vs potential meta without editing Options multipliers. */
export async function setDraftMetaBias(bias) {
  const state = await hydrateState();
  state.draftMetaBias = clampDraftMetaBias(bias);
  if ((state.draftPitchers && state.draftPitchers.length) || (state.draftBatters && state.draftBatters.length)) {
    scoreDraftPools(state);
  }
  await saveState(state);
  return state;
}

export async function setUseStatsScoring(enabled) {
  const state = await hydrateState();
  state.useStatsScoring = !!enabled;
  return rescore(state);
}

export async function setMajorsOnly(enabled) {
  const state = await hydrateState();
  state.majorsOnly = !!enabled;
  await saveState(state);
  return state;
}

/** Toggle park-normalized counting/raw rate display (no rescore). */
export async function setParkNormalizeStats(enabled) {
  const state = await hydrateState();
  state.parkNormalizeStats = !!enabled;
  await saveState(state);
  return state;
}

/** Update pitcher IP sample floors (SP / RP) and rescore. */
export async function setPitcherSampleMinimums(minIpSp, minIpRp) {
  const state = await hydrateState();
  const weights = mergePitcherStatWeights(state.pitcherStatWeights);
  if (Number.isFinite(minIpSp) && minIpSp >= 0) weights.MIN_INNINGS_SP = minIpSp;
  if (Number.isFinite(minIpRp) && minIpRp >= 0) weights.MIN_INNINGS_PITCHED = minIpRp;
  state.pitcherStatWeights = weights;
  state.weightsCustomized = true;
  return rescore(state);
}

/** Update batter games sample floor and rescore. */
export async function setBatterSampleMinimum(minGames) {
  const state = await hydrateState();
  const weights = mergeBatterStatWeights(state.batterStatWeights);
  if (Number.isFinite(minGames) && minGames >= 0) weights.MIN_PLATE_APPEARANCES = minGames;
  state.batterStatWeights = weights;
  state.weightsCustomized = true;
  return rescore(state);
}

export async function setWeights(pitcherWeights, batterWeights, customized = true) {
  const state = await hydrateState();
  if (pitcherWeights) state.pitcherWeights = deepClone(pitcherWeights);
  if (batterWeights) state.batterWeights = deepClone(batterWeights);
  state.weightsCustomized = customized;
  return rescore(state);
}

export async function setStatWeights(pitcherStatWeights, batterStatWeights, customized = true) {
  const state = await hydrateState();
  if (pitcherStatWeights) state.pitcherStatWeights = deepClone(pitcherStatWeights);
  if (batterStatWeights) state.batterStatWeights = deepClone(batterStatWeights);
  state.weightsCustomized = customized;
  return rescore(state);
}

export async function resetWeights(which = "both") {
  const state = await hydrateState();
  if (which === "pitchers" || which === "both") state.pitcherWeights = defaultPitcherWeights();
  if (which === "batters" || which === "both") state.batterWeights = defaultBatterWeights();
  if (which === "pitcher-stats" || which === "both") {
    state.pitcherStatWeights = defaultPitcherStatWeights();
  }
  if (which === "batter-stats" || which === "both") {
    state.batterStatWeights = defaultBatterStatWeights();
  }
  state.weightsCustomized = which !== "both";
  return rescore(state);
}

export async function updateTrade(tradePatch) {
  const state = await hydrateState();
  state.trade = { ...state.trade, ...tradePatch };
  await saveState(state);
  return state;
}
