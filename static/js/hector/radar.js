/** Shared 20–80 radar SVG helpers (player card + Compare page). */

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, "&#10;");
}

export function hasRating(v) {
  const s = String(v ?? "").trim();
  return s !== "" && s !== "-" && s !== "—";
}

export function pickField(player, ...keys) {
  for (const k of keys) {
    if (hasRating(player[k])) return player[k];
  }
  return "";
}

export function parseGrade(v) {
  if (!hasRating(v)) return null;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export function gradePair(player, curKeys, potKeys) {
  const cur = parseGrade(pickField(player, ...(Array.isArray(curKeys) ? curKeys : [curKeys])));
  const pot = parseGrade(pickField(player, ...(Array.isArray(potKeys) ? potKeys : [potKeys])));
  if (cur == null && pot == null) return null;
  return { cur: cur ?? pot, pot: pot ?? cur };
}

export function primaryBatterPos(player) {
  const raw = String(player?.POS || "")
    .toUpperCase()
    .trim();
  if (!raw) return "";
  return raw.split(/[/,\s]+/).filter(Boolean)[0] || "";
}

/** Position-relevant defense grades averaged into one DEF axis. */
export function batterDefenseGrade(player) {
  const pos = primaryBatterPos(player);
  let keys = null;
  if (pos === "C") keys = ["C ABI", "C ARM", "C FRM"];
  else if (["LF", "CF", "RF"].includes(pos)) keys = ["OF RNG", "OF ERR", "OF ARM"];
  else if (["1B", "2B", "3B", "SS"].includes(pos)) keys = ["IF RNG", "IF ERR", "IF ARM"];
  else return null;

  const grades = keys.map((k) => parseGrade(player[k])).filter((n) => n != null);
  if (!grades.length) return null;
  const avg = Math.round(grades.reduce((a, b) => a + b, 0) / grades.length);
  return { label: "DEF", cur: avg, pot: avg };
}

const BATTER_OFFENSE = [
  ["CON", "CON P", "CON"],
  ["GAP", "GAP P", "GAP"],
  ["POW", "POW P", "POW"],
  ["EYE", "EYE P", "EYE"],
  ["K's", "K P", "AvK"],
];

const PITCHER_CORE = [
  ["STU", "STU P", "STU"],
  ["MOV", "MOV P", "MOV"],
  [["CON (Pitcher)", "CON"], ["CON P (Pitcher)", "CON P"], "CON"],
  ["STM", "STM", "STM"],
];

const PITCHER_PITCHES = [
  ["FB", "FBP", "FB"],
  ["SI", "SIP", "SI"],
  ["CT", "CTP", "CT"],
  ["SL", "SLP", "SL"],
  ["CB", "CBP", "CB"],
  ["CH", "CHP", "CH"],
  ["SP", "SPP", "SP"],
  ["FO", "FOP", "FO"],
  ["CC", "CCP", "CC"],
  ["SC", "SCP", "SC"],
  ["KC", "KCP", "KC"],
  ["KN", "KNP", "KN"],
];

/** Hover tips for radar axis abbreviations. */
export const RADAR_LABEL_TIPS = {
  CON: "Contact (batters) / Control (pitchers)",
  GAP: "Gap power",
  POW: "Power (home run power)",
  EYE: "Eye / plate discipline",
  AvK: "Avoid K's (contact vs strikeouts)",
  DEF: "Defense — average of position tools (C: ability/arm/framing; IF: range/error/arm; OF: range/error/arm)",
  STU: "Stuff",
  MOV: "Movement",
  STM: "Stamina",
  ARS: "Arsenal — average of all pitch grades (FB, SL, CH, …)",
  HLD: "Hold runners",
  SPE: "Speed",
  STE: "Stealing ability",
  RUN: "Baserunning",
};

export function radarLabelTip(label) {
  return RADAR_LABEL_TIPS[label] || label;
}

/** Average of all non-blank pitch grades (current & potential). */
export function pitcherArsenalGrade(player) {
  const curs = [];
  const pots = [];
  for (const [c, p] of PITCHER_PITCHES) {
    const pair = gradePair(player, c, p);
    if (!pair) continue;
    curs.push(pair.cur);
    pots.push(pair.pot);
  }
  if (!curs.length) return null;
  return {
    label: "ARS",
    cur: Math.round(curs.reduce((a, b) => a + b, 0) / curs.length),
    pot: Math.round(pots.reduce((a, b) => a + b, 0) / pots.length),
  };
}

export function batterRadarAxes(player) {
  const axes = BATTER_OFFENSE.map(([c, p, label]) => {
    const pair = gradePair(player, c, p);
    return pair ? { label, ...pair } : null;
  }).filter(Boolean);
  const def = batterDefenseGrade(player);
  if (def) axes.push(def);
  return axes;
}

/** Stuff / Movement / Control / Stamina / Arsenal (avg of pitches). */
export function pitcherRadarAxes(player) {
  const core = PITCHER_CORE.map(([c, p, label]) => {
    const pair = gradePair(player, c, p);
    return pair ? { label, ...pair } : null;
  }).filter(Boolean);
  const ars = pitcherArsenalGrade(player);
  if (ars) core.push(ars);
  return core;
}

/** Shared batter axis labels for multi-player compare. */
export function batterCompareAxisLabels() {
  return ["CON", "GAP", "POW", "EYE", "AvK", "DEF"];
}

/** Shared pitcher axis labels for compare. */
export function pitcherCompareAxisLabels() {
  return ["STU", "MOV", "CON", "STM", "ARS"];
}

/** Grade for a compare axis label (`which`: "cur" | "pot"). */
export function gradeForCompareAxis(player, playerType, label, which = "cur") {
  const key = which === "pot" ? "pot" : "cur";
  if (playerType === "batter") {
    if (label === "DEF") {
      const d = batterDefenseGrade(player);
      return d ? d[key] : null;
    }
    const map = {
      CON: ["CON", "CON P"],
      GAP: ["GAP", "GAP P"],
      POW: ["POW", "POW P"],
      EYE: ["EYE", "EYE P"],
      AvK: ["K's", "K P"],
    };
    const keys = map[label];
    if (!keys) return null;
    const pair = gradePair(player, keys[0], keys[1]);
    return pair ? pair[key] : null;
  }
  if (label === "ARS") {
    const ars = pitcherArsenalGrade(player);
    return ars ? ars[key] : null;
  }
  if (label === "CON") {
    const pair = gradePair(player, ["CON (Pitcher)", "CON"], ["CON P (Pitcher)", "CON P"]);
    return pair ? pair[key] : null;
  }
  if (label === "STM") {
    const pair = gradePair(player, "STM", "STM");
    return pair ? pair[key] : null;
  }
  if (label === "STU" || label === "MOV") {
    const pair = gradePair(player, label, `${label} P`);
    return pair ? pair[key] : null;
  }
  return null;
}

/**
 * Single-player radar (current + potential polygons).
 * @param {{ label: string, cur: number, pot: number }[]} axes
 */
export function radarSvg(axes, { size = 220, max = 80, min = 20 } = {}) {
  if (axes.length < 3) return "";
  return radarSvgBase(
    axes.map((a) => a.label),
    [
      { key: "pot", values: axes.map((a) => a.pot), className: "chart-radar-pot" },
      { key: "cur", values: axes.map((a) => a.cur), className: "chart-radar-cur" },
    ],
    { size, max, min, plotRatio: 0.42, labelPad: 12 },
  );
}

/**
 * Multi-player compare radar (current or potential per series values).
 * @param {string[]} labels
 * @param {{ name: string, color: string, values: (number|null)[] }[]} series
 */
export function radarSvgCompare(labels, series, { size = 280, max = 80, min = 20 } = {}) {
  if (labels.length < 3 || !series.length) return "";
  const polys = series.map((s, i) => ({
    key: `s${i}`,
    values: s.values,
    className: "chart-radar-series",
    style: `fill:${hexAlpha(s.color, 0.18)};stroke:${s.color};stroke-width:2`,
  }));
  return radarSvgBase(labels, polys, { size, max, min, plotRatio: 0.42, labelPad: 12 });
}

function hexAlpha(hex, a) {
  const h = String(hex || "#2dff9a").replace("#", "");
  if (h.length !== 6) return `rgba(45,255,154,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function radarSvgBase(labels, series, { size, max, min, plotRatio = 0.42, labelPad = 12 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * plotRatio;
  const n = labels.length;
  const span = max - min || 1;

  function radiusFor(value) {
    if (value == null || Number.isNaN(value)) return 0;
    const t = Math.max(0, Math.min(1, (value - min) / span));
    return r * t;
  }

  function pt(i, value) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const rad = radiusFor(value);
    return [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
  }

  const ringGrades = [20, 40, 60, 80].filter((g) => g >= min && g <= max);
  const rings = ringGrades
    .map((grade) => {
      const rad = radiusFor(grade);
      if (rad <= 0) return "";
      const pts = Array.from({ length: n }, (_, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return `${cx + Math.cos(ang) * rad},${cy + Math.sin(ang) * rad}`;
      }).join(" ");
      return `<polygon class="chart-radar-ring" points="${pts}" />`;
    })
    .join("");

  const scaleLabels = [40, 60, 80]
    .filter((g) => g >= min && g <= max)
    .map((grade) => {
      const rad = radiusFor(grade);
      return `<text class="chart-radar-scale" x="${cx + 4}" y="${cy - rad + 3}">${grade}</text>`;
    })
    .join("");

  const spokes = labels
    .map((_, i) => {
      const [x, y] = pt(i, max);
      return `<line class="chart-radar-spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" />`;
    })
    .join("");

  const axisLabels = labels
    .map((label, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const lx = cx + Math.cos(ang) * (r + labelPad);
      const ly = cy + Math.sin(ang) * (r + labelPad);
      const tip = radarLabelTip(label);
      return `<text class="chart-radar-label tip" x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" data-tip="${escapeAttr(tip)}">${escapeHtml(label)}</text>`;
    })
    .join("");

  const polys = series
    .map((s) => {
      const pts = labels
        .map((_, i) => {
          const v = s.values[i];
          return pt(i, v == null ? min : v).join(",");
        })
        .join(" ");
      const style = s.style ? ` style="${s.style}"` : "";
      return `<polygon class="${s.className || ""}"${style} points="${pts}" />`;
    })
    .join("");

  return `<svg class="chart-radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Ratings radar on 20 to 80 scale">
    ${rings}${spokes}
    ${polys}
    ${axisLabels}
    ${scaleLabels}
  </svg>`;
}

export function profileRadarHtml(player, playerType) {
  const axes =
    playerType === "batter" ? batterRadarAxes(player) : pitcherRadarAxes(player);
  const svg = radarSvg(axes);
  if (!svg) return "";
  return `<div class="player-card-radar tip" data-tip="20–80 scale. Current (green) vs potential (purple). Hover axis labels for definitions. Pitchers: ARS is average of pitch grades.">
    ${svg}
    <span class="chart-legend player-card-radar-legend">
      <span class="chart-legend-cur">Current</span>
      <span class="chart-legend-pot">Potential</span>
    </span>
  </div>`;
}
