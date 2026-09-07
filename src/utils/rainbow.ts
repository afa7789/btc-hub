/**
 * Bitcoin rainbow chart, fitted and drawn at build time.
 *
 * The well-known implementations hardcode someone else's regression constants.
 * We already ship the full price series, so the fit is done here against our
 * own data — the bands then describe the dataset the site actually plots, and
 * they move when the dataset is refreshed.
 *
 * The model is the usual one: log10(price) = a * ln(days since first close) + b,
 * least squares. Bands are placed at multiples of the residual standard
 * deviation rather than at invented offsets, so their width is a property of
 * how far the price has actually strayed from the fit.
 *
 * Output is an inline SVG, so the chart renders with JavaScript disabled — the
 * only chart on the site that does.
 */
import { loadPrices } from "./prerender";

export interface Band {
  label: string;
  color: string;
  /** Offset from the fitted line, in standard deviations of the residual. */
  sigma: number;
}

/** Bottom to top. */
export const BANDS: Band[] = [
  { label: "Basically a fire sale", color: "#1f4fd8", sigma: -1.5 },
  { label: "Buy", color: "#1f8fd8", sigma: -1.0 },
  { label: "Accumulate", color: "#1fbfae", sigma: -0.5 },
  { label: "Still cheap", color: "#3fbf5f", sigma: 0 },
  { label: "Hold", color: "#a8c72c", sigma: 0.5 },
  { label: "Is this a bubble?", color: "#e0c020", sigma: 1.0 },
  { label: "FOMO intensifies", color: "#e88b1c", sigma: 1.5 },
  { label: "Sell, seriously", color: "#e0501c", sigma: 2.0 },
  { label: "Maximum bubble territory", color: "#c81f1f", sigma: 2.5 },
];

export interface RainbowFit {
  a: number;
  b: number;
  sigma: number;
  /** Coefficient of determination, so the page can be honest about the fit. */
  r2: number;
  firstDate: string;
  lastDate: string;
  points: { day: number; price: number }[];
  /** Where the last close sits, in standard deviations from the fit. */
  todaySigma: number;
  todayBand: Band;
}

const DAY = 86_400_000;

export function fitRainbow(assetKey = "bitcoin"): RainbowFit {
  const prices = loadPrices(assetKey, "start");
  const rows = [...prices.entries()]
    .filter(([, price]) => price > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const origin = new Date(`${rows[0]?.[0]}T00:00:00Z`).getTime();
  const points = rows.map(([date, price]) => ({
    // +1 so the first day is not ln(0).
    day: (new Date(`${date}T00:00:00Z`).getTime() - origin) / DAY + 1,
    price,
  }));

  // Least squares on x = ln(day), y = log10(price).
  const xs = points.map((p) => Math.log(p.day));
  const ys = points.map((p) => Math.log10(p.price));
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += ((xs[i] as number) - meanX) * ((ys[i] as number) - meanY);
    sxx += ((xs[i] as number) - meanX) ** 2;
  }
  const a = sxy / sxx;
  const b = meanY - a * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = a * (xs[i] as number) + b;
    ssRes += ((ys[i] as number) - predicted) ** 2;
    ssTot += ((ys[i] as number) - meanY) ** 2;
  }
  const sigma = Math.sqrt(ssRes / n);
  const r2 = 1 - ssRes / ssTot;

  const last = points[points.length - 1] as { day: number; price: number };
  const todaySigma =
    (Math.log10(last.price) - (a * Math.log(last.day) + b)) / sigma;
  const todayBand =
    [...BANDS].reverse().find((band) => todaySigma >= band.sigma) ??
    (BANDS[0] as Band);

  return {
    a,
    b,
    sigma,
    r2,
    firstDate: rows[0]?.[0] as string,
    lastDate: rows[rows.length - 1]?.[0] as string,
    points,
    todaySigma,
    todayBand,
  };
}

/** Fitted price for a given day offset, shifted by `sigma` standard deviations. */
export function bandPrice(fit: RainbowFit, day: number, sigma: number): number {
  return 10 ** (fit.a * Math.log(day) + fit.b + sigma * fit.sigma);
}
