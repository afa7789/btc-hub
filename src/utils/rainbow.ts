/**
 * Bitcoin rainbow chart, after blockchaincenter.net's Dynamic Rainbow Chart,
 * recomputed at build time on our own price series.
 *
 * The method and every constant below are read from their chart code
 * (https://www.blockchaincenter.net/bitcoin-rainbow-chart/, Next.js chunk
 * 738e1e02aa29a3eb.js, November 2026), not from their prose:
 *
 * - A cycle low is a close with no lower close within 180 rows either side.
 * - Only cycle lows dated 2012-01-01 to 2032-12-31 are fitted:
 *   log10(price) = slope * log10(days since the genesis block) + intercept.
 * - That fitted line is the TOP of the lowest band. Each band above is 1.3x
 *   the one below; nine bands, from line/1.3 up to line*1.3^8.
 * - The chart runs from 2012-01-01 and projects the bands to 2032-12-31.
 *
 * The slope and intercept are not copied: they come out of the fit, so they
 * move when the dataset is refreshed, as the reference's do.
 *
 * Output is an inline SVG, so the chart renders with JavaScript disabled.
 */
import { loadPrices } from "./prerender";

export const SOURCE_URL =
  "https://www.blockchaincenter.net/bitcoin-rainbow-chart/";

/** Day zero of the regression: the genesis block. */
export const GENESIS = "2009-01-03";
export const CHART_START = "2012-01-01";
export const CHART_END = "2032-12-31";
/** Rows either side a close must undercut to count as a cycle low. */
export const LOW_WINDOW = 180;
/** Each band's edges are this many times the band below's. */
export const BAND_RATIO = 1.3;

export interface Band {
  label: string;
  color: string;
}

/**
 * Bottom to top. Band i spans line * BAND_RATIO^(i - 1) .. line * BAND_RATIO^i,
 * so band 0 ends at the fitted line itself. Names and colours are the
 * reference's.
 */
export const BANDS: Band[] = [
  { label: "Basically a Fire Sale", color: "#4472c4" },
  { label: "BUY!", color: "#54989f" },
  { label: "Accumulate", color: "#63be7b" },
  { label: "Still cheap", color: "#b1d580" },
  { label: "HODL!", color: "#ffeb84" },
  { label: "Is this a bubble?", color: "#f6b45a" },
  { label: "FOMO intensifies", color: "#ed7d31" },
  { label: "Sell. Seriously, SELL!", color: "#d64018" },
  { label: "Maximum Bubble Territory", color: "#c00000" },
];

/** The middle of "HODL!" — what the reference calls the model centre. */
export const CENTRE_EDGE = 4.5;

export interface Close {
  date: string;
  /** Days since GENESIS. */
  day: number;
  price: number;
}

/** The fitted line, in log10 terms. */
export interface Line {
  slope: number;
  intercept: number;
}

export interface RainbowFit extends Line {
  /** Over the cycle lows only, not over every close. */
  r2: number;
  /** The cycle lows the line was fitted through. */
  lows: Close[];
  /** True while the newest low is under LOW_WINDOW rows old and can still be undercut. */
  newestLowProvisional: boolean;
  /** Every close from CHART_START on. */
  closes: Close[];
  last: Close;
  todayBand: number;
}

const DAY = 86_400_000;

export function daysSinceGenesis(date: string): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${GENESIS}T00:00:00Z`)) /
      DAY,
  );
}

/** Fitted price on a day: the top edge of the lowest band. */
export function fittedPrice(line: Line, day: number): number {
  return 10 ** (line.slope * Math.log10(day) + line.intercept);
}

/**
 * Band edge k on a day, k = 0..BANDS.length. Band i lies between edge i and
 * edge i + 1; fractional k lands inside a band (CENTRE_EDGE).
 */
export function bandEdge(line: Line, day: number, k: number): number {
  return fittedPrice(line, day) * BAND_RATIO ** (k - 1);
}

/**
 * Same rule as the reference: the highest band whose lower edge the price is
 * strictly above. Below the lowest edge is still band 0, above the top edge
 * still the top band — the rainbow has no floor and no ceiling.
 */
export function bandAt(line: Line, day: number, price: number): number {
  let band = 0;
  for (let i = 1; i < BANDS.length; i++) {
    if (price > bandEdge(line, day, i)) band = i;
  }
  return band;
}

/** Indexes of closes that no close within LOW_WINDOW rows either side undercuts. */
function cycleLowIndexes(closes: Close[]): number[] {
  return closes.flatMap((close, i) => {
    const window = closes.slice(
      Math.max(0, i - LOW_WINDOW),
      i + LOW_WINDOW + 1,
    );
    return window.some((other) => other.price < close.price) ? [] : [i];
  });
}

/** Ordinary least squares of y on x, with R². */
function leastSquares(xs: number[], ys: number[]) {
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += ((xs[i] as number) - meanX) * ((ys[i] as number) - meanY);
    sxx += ((xs[i] as number) - meanX) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += ((ys[i] as number) - (slope * (xs[i] as number) + intercept)) ** 2;
    ssTot += ((ys[i] as number) - meanY) ** 2;
  }
  return { slope, intercept, r2: 1 - ssRes / ssTot };
}

const inChart = (c: Close) => c.date >= CHART_START && c.date <= CHART_END;

export function fitRainbow(assetKey = "bitcoin"): RainbowFit {
  // Lows are searched over the whole series, then trimmed to the chart window,
  // as the reference does: a 2012 low still has to beat late-2011 closes.
  const all: Close[] = [...loadPrices(assetKey, "start").entries()]
    .filter(([, price]) => price > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, price]) => ({ date, day: daysSinceGenesis(date), price }));

  const lowIndexes = cycleLowIndexes(all).filter((i) =>
    inChart(all[i] as Close),
  );
  const lows = lowIndexes.map((i) => all[i] as Close);
  const { slope, intercept, r2 } = leastSquares(
    lows.map((c) => Math.log10(c.day)),
    lows.map((c) => Math.log10(c.price)),
  );

  const closes = all.filter(inChart);
  const last = closes[closes.length - 1] as Close;
  const newestLow = lowIndexes[lowIndexes.length - 1] ?? 0;
  return {
    slope,
    intercept,
    r2,
    lows,
    newestLowProvisional: all.length - 1 - newestLow < LOW_WINDOW,
    closes,
    last,
    todayBand: bandAt({ slope, intercept }, last.day, last.price),
  };
}
