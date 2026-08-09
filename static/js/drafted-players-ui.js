import {
  normalizeDraftedName,
  parseDraftedPlayers,
} from "./drafted-players.js?v=1";
import { setDraftedPlayersText } from "./hector/store.js?v=32";

export function mountDraftedPlayersFilter({
  state,
  button,
  summaryEl,
  onChange,
}) {
  let result = parseDraftedPlayers("", []);

  function draftPool() {
    return [...(state.draftPitchers || []), ...(state.draftBatters || [])];
  }

  function sync(notify = false) {
    const players = draftPool();
    result = parseDraftedPlayers(state.draftedPlayersText, players);
    const matched = result.matchedNames.length;
    const unmatched = result.unmatchedLines.length;
    const hidden = players.filter((player) =>
      result.matchedKeys.has(normalizeDraftedName(player.Name)),
    ).length;

    button.textContent = matched
      ? "Drafted players (" + matched + ")"
      : "Paste drafted players";
    button.classList.toggle("btn-accent", matched > 0);
    summaryEl.textContent = [
      hidden ? hidden + " hidden" : "",
      unmatched ? unmatched + " unmatched" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (notify && onChange) onChange(result);
  }

  function isDrafted(name) {
    return result.matchedKeys.has(normalizeDraftedName(name));
  }

  function open() {
    document.getElementById("drafted-players-modal")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "drafted-players-modal";
    overlay.className = "player-card-overlay";
    overlay.innerHTML = `
      <div class="player-card drafted-players-card" role="dialog" aria-modal="true" aria-labelledby="drafted-players-title">
        <button type="button" class="player-card-close" data-close aria-label="Close">&times;</button>
        <header class="drafted-players-header">
          <h2 id="drafted-players-title">Paste drafted players</h2>
          <p class="muted">Paste the draft log below. Matched players will be hidden from both Draft lists.</p>
        </header>
        <label class="drafted-players-label" for="drafted-players-text">Draft log</label>
        <textarea id="drafted-players-text" class="drafted-players-text" rows="12" placeholder="Paste tab-separated drafted-player rows here…"></textarea>
        <div class="drafted-players-result" aria-live="polite">
          <strong data-match-summary></strong>
          <details data-unmatched-wrap hidden>
            <summary>Show unmatched rows</summary>
            <ul data-unmatched-list></ul>
          </details>
        </div>
        <div class="drafted-players-actions">
          <button type="button" class="btn btn-accent" data-apply>Apply filter</button>
          <button type="button" class="btn" data-clear>Clear</button>
          <button type="button" class="btn" data-close>Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector("#drafted-players-text");
    const matchSummary = overlay.querySelector("[data-match-summary]");
    const unmatchedWrap = overlay.querySelector("[data-unmatched-wrap]");
    const unmatchedList = overlay.querySelector("[data-unmatched-list]");
    const applyButton = overlay.querySelector("[data-apply]");
    const clearButton = overlay.querySelector("[data-clear]");
    textarea.value = state.draftedPlayersText || "";

    function preview() {
      const next = parseDraftedPlayers(textarea.value, draftPool());
      const bits = [
        next.matchedNames.length + " matched",
        next.unmatchedLines.length + " unmatched",
      ];
      if (next.duplicateCount) bits.push(next.duplicateCount + " duplicate");
      matchSummary.textContent = bits.join(" · ");
      unmatchedWrap.hidden = next.unmatchedLines.length === 0;
      unmatchedList.replaceChildren(
        ...next.unmatchedLines.map((line) => {
          const item = document.createElement("li");
          item.textContent = line;
          return item;
        }),
      );
      clearButton.disabled = !textarea.value && !state.draftedPlayersText;
    }

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      button.focus();
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...overlay.querySelectorAll(
          "button:not([disabled]), textarea, summary",
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    async function save(text) {
      applyButton.disabled = true;
      clearButton.disabled = true;
      try {
        const nextState = await setDraftedPlayersText(text);
        state.draftedPlayersText = nextState.draftedPlayersText;
        sync(true);
        close();
      } catch (error) {
        matchSummary.textContent =
          "Could not save: " + String(error?.message || error);
        applyButton.disabled = false;
        clearButton.disabled = false;
      }
    }

    textarea.addEventListener("input", preview);
    overlay.querySelectorAll("[data-close]").forEach((closeButton) => {
      closeButton.addEventListener("click", close);
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    applyButton.addEventListener("click", () => save(textarea.value));
    clearButton.addEventListener("click", () => save(""));
    document.addEventListener("keydown", onKeydown);
    preview();
    textarea.focus();
  }

  button.addEventListener("click", open);
  sync();
  return { isDrafted, sync };
}
