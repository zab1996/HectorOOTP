/* Hector-style floating tooltips (data-tip / .tip) */
(function () {
  let tipEl = null;
  let active = null;

  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement("div");
    tipEl.className = "hector-tooltip";
    tipEl.setAttribute("role", "tooltip");
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function place(el, event) {
    const tip = ensureTip();
    const pad = 12;
    let x = event.clientX + 16;
    let y = event.clientY + 16;
    tip.style.visibility = "hidden";
    tip.style.display = "block";
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    if (x + tw > window.innerWidth - pad) x = window.innerWidth - tw - pad;
    if (y + th > window.innerHeight - pad) y = event.clientY - th - 12;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
    tip.style.visibility = "visible";
  }

  function show(el, event) {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    active = el;
    const tip = ensureTip();
    tip.textContent = text;
    tip.classList.add("visible");
    place(el, event);
  }

  function hide() {
    active = null;
    if (tipEl) {
      tipEl.classList.remove("visible");
      tipEl.style.display = "none";
    }
  }

  function findTipTarget(node) {
    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute("data-tip")) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  document.addEventListener("mouseover", (e) => {
    const el = findTipTarget(e.target);
    if (el && el !== active) show(el, e);
  });

  document.addEventListener("mousemove", (e) => {
    if (!active) return;
    const el = findTipTarget(e.target);
    if (!el) {
      hide();
      return;
    }
    if (el !== active) show(el, e);
    else place(active, e);
  });

  document.addEventListener("mouseout", (e) => {
    if (!active) return;
    const to = e.relatedTarget;
    if (to && active.contains(to)) return;
    if (findTipTarget(to) === active) return;
    hide();
  });

  window.HectorTooltips = { show, hide, refresh: () => {} };
})();
