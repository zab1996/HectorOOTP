/* Client-side table sort for .sortable tables (works with dynamic headers) */
(function () {
  function parseCell(text) {
    text = (text || "").trim();
    if (text === "" || text === "-" || text === "N/A" || text === "—") return { n: null, s: text };
    const cleaned = text.replace(/,/g, "").replace(/\$/g, "").replace(/ Stars/gi, "");
    const range = cleaned.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (range) return { n: (parseFloat(range[1]) + parseFloat(range[2])) / 2, s: text };
    const num = parseFloat(cleaned);
    // Allow leading + / - so YoY "+18" sorts numerically, not as text.
    if (!isNaN(num) && /^[+-]?\d/.test(cleaned)) return { n: num, s: text };
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

  function sectionBlocks(tbody) {
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

  function renumberRanks(rows, rankIdx) {
    if (rankIdx < 0) return;
    rows.forEach((r, i) => {
      const cell = r.children[rankIdx];
      if (cell) cell.textContent = String(i + 1);
    });
  }

  // Event delegation so tables rendered after load (e.g. League Analysis) still sort.
  document.addEventListener("click", (e) => {
    if (e.target.closest(".col-filter-btn") || e.target.closest(".col-filter-menu") || e.target.closest(".dura-filter-btn") || e.target.closest(".dura-filter-menu")) return;
    const th = e.target.closest("th");
    if (!th) return;
    const table = th.closest("table.sortable");
    if (!table || table.classList.contains("sort-disabled")) return;
    const thead = table.tHead;
    if (!thead || !thead.contains(th)) return;

    const ths = Array.from(thead.querySelectorAll("th"));
    const colIdx = ths.indexOf(th);
    if (colIdx < 0) return;

    const label = (th.dataset.col || th.textContent || "").replace(/\s*[↑↓▾]\s*$/, "").trim();
    if (label === "Rank") return;

    const tbody = table.tBodies[0];
    if (!tbody) return;

    const asc = th.dataset.sort !== "asc";
    ths.forEach((h) => {
      delete h.dataset.sort;
      h.removeAttribute("aria-sort");
    });
    th.dataset.sort = asc ? "asc" : "desc";
    th.setAttribute("aria-sort", asc ? "ascending" : "descending");

    const rankIdx = ths.findIndex(
      (h) => ((h.dataset.col || h.textContent || "").replace(/\s*[↑↓]\s*$/, "").trim() === "Rank"),
    );
    const hasSections = !!tbody.querySelector("tr.sep");

    if (!hasSections) {
      const rows = Array.from(tbody.querySelectorAll("tr")).filter(
        (r) => !r.classList.contains("sep") && !r.classList.contains("col-echo"),
      );
      rows.sort((a, b) => compareRows(a, b, colIdx, asc));
      rows.forEach((r) => tbody.appendChild(r));
      return;
    }

    // Top-by-POS (and similar): sort within each section, keep section headers fixed.
    sectionBlocks(tbody).forEach((block) => {
      block.rows.sort((a, b) => compareRows(a, b, colIdx, asc));
      renumberRanks(block.rows, rankIdx);
      block.prefix.forEach((r) => tbody.appendChild(r));
      block.rows.forEach((r) => tbody.appendChild(r));
    });
  });
})();
