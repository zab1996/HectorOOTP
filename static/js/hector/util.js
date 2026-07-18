/**
 * Python 3 round(x, ndigits) — round-half-to-even (banker's rounding).
 */
export function pyRound(x, ndigits = 2) {
  if (!Number.isFinite(x)) return 0;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const factor = 10 ** ndigits;
  const n = ax * factor;
  const floor = Math.floor(n + 1e-12);
  const frac = n - floor;
  let r;
  if (Math.abs(frac - 0.5) < 1e-9) {
    // exactly halfway: toward even
    r = floor % 2 === 0 ? floor : floor + 1;
  } else {
    r = Math.round(n);
  }
  return (sign * r) / factor;
}

export function round2(x) {
  return pyRound(x, 2);
}

export function round4(x) {
  return pyRound(x, 4);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Ordinal suffix for n (1 → st, 2 → nd, 3 → rd, 11–13 → th, …). */
export function ordinalSuffix(n) {
  const v = Math.abs(Math.trunc(Number(n) || 0));
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (v % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** e.g. 81 → "81st", 22 → "22nd". */
export function formatOrdinal(n) {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v)) return String(n ?? "");
  return `${v}${ordinalSuffix(v)}`;
}
