/** Inline SVG donut charts for Team Salary sections. */

export const PIE_COLORS = [
  "#5b8def",
  "#2dff9a",
  "#e0c080",
  "#b8a4e0",
  "#e07070",
  "#7ec8e3",
  "#f0a070",
  "#9ad0b0",
  "#d4a5a5",
  "#8fd3e8",
  "#c5e17a",
  "#f7c59f",
  "#a0a0ff",
  "#ffb3c6",
  "#b5ead7",
];

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * @param {{ label: string, value: number, color?: string }[]} slices
 * @param {{ size?: number, hole?: number, ariaLabel?: string, shareOf?: string }} [opts]
 */
export function salaryPieSvg(slices, opts = {}) {
  const size = opts.size || 140;
  const hole = opts.hole ?? 0.52;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;
  const total = slices.reduce((s, x) => s + Math.max(0, x.value || 0), 0);
  const aria = escapeAttr(opts.ariaLabel || "Payroll share");

  if (!(total > 0)) {
    return `<svg class="salary-pie" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.06)" />
    </svg>`;
  }

  let angle = 0;
  const paths = [];
  slices.forEach((slice, i) => {
    const val = Math.max(0, slice.value || 0);
    if (val <= 0) return;
    const sweep = (val / total) * 360;
    const color = slice.color || PIE_COLORS[i % PIE_COLORS.length];
    const shareOf = opts.shareOf || "group";
    const tip = escapeAttr(
      `${slice.label}: ${slice.value >= 1 ? `$${slice.value.toFixed(2).replace(/\.?0+$/, "")}M` : `$${(slice.value * 1000).toFixed(0)}K`} · ${(slice.pct != null ? slice.pct : (val / total) * 100).toFixed(1)}% of ${shareOf}`,
    );
    if (sweep >= 359.9) {
      paths.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"><title>${tip}</title></circle>`);
      return;
    }
    const start = polar(cx, cy, r, angle);
    const end = polar(cx, cy, r, angle + sweep);
    const large = sweep > 180 ? 1 : 0;
    paths.push(
      `<path d="M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z" fill="${color}"><title>${tip}</title></path>`,
    );
    angle += sweep;
  });

  return `<svg class="salary-pie" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${aria}">
    ${paths.join("\n    ")}
    <circle cx="${cx}" cy="${cy}" r="${r * hole}" fill="#0d1016" />
  </svg>`;
}

/**
 * Build Now-AAV slices for one section (share of that section's Now total).
 * @param {{ name: string, thisYearM: number }[]} rows
 * @param {number} [sectionTotalM]
 */
export function sectionPieSlices(rows, sectionTotalM) {
  const total =
    sectionTotalM > 0
      ? sectionTotalM
      : (rows || []).reduce((s, r) => s + Math.max(0, r.thisYearM || 0), 0);
  return [...(rows || [])]
    .filter((r) => (r.thisYearM || 0) > 0)
    .sort((a, b) => (b.thisYearM || 0) - (a.thisYearM || 0))
    .map((r, i) => {
      const value = r.thisYearM || 0;
      return {
        label: r.name || "?",
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
        color: PIE_COLORS[i % PIE_COLORS.length],
      };
    });
}
