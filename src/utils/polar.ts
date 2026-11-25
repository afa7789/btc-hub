/**
 * Bitcoin 4-year polar cycle, computed at build time.
 *
 * After Sebastián Serrano's chart (polar.sserrano.com): the angle is calendar
 * time, one turn per four years, clockwise, with 1 January of every year
 * divisible by four at 3 o'clock. The radius is log10(price). The line colour
 * is how far each day sits between one halving (0%) and the next (100%).
 *
 * Output is plain geometry for an inline SVG, so the chart renders with
 * JavaScript disabled, like the rainbow chart.
 */
import { closestPrice, loadHalvings, loadPrices } from "./prerender";

const DAY_MS = 86_400_000;
/** The first cycle has no halving to start from; the genesis block is its 0%. */
const GENESIS_MS = Date.UTC(2009, 0, 3);
const TURN_DAYS = 1461;

const SIZE = 640;
const CENTRE = SIZE / 2;
/* Margin sized for the mobile year label: "2026" at 30 units is 72 wide. */
const RADIUS = 216;
/** Ring scale: $0.01 at the centre, $1M on the outer ring. */
const LOG_MIN = -2;
const LOG_MAX = 6;
const RING_LABELS = new Map([
  [0, "$1"],
  [3, "$1K"],
  [5, "$100K"],
  [6, "$1M"],
]);

/**
 * Purple -> pink -> Bitcoin orange. Lightness rises with every stop, so the
 * ramp still reads as "later in the cycle" without hue, and the darkest stop
 * sits at 4.18:1 on --chart-bg (#0a0a0a), above the 3:1 floor for a mark.
 */
export const GRADIENT = ["#7d55f0", "#e0509c", "#ff9900"];
const BUCKETS_PER_CYCLE = 40;
/** Thinning: a point is kept once it is this far from the last kept one. */
const MIN_STEP = 2;

type XY = [number, number];

interface Row {
  date: string;
  ms: number;
  price: number;
}

export interface PolarStats {
  lastDate: string;
  price: number;
  athDate: string;
  athPrice: number;
  daysSinceAth: number;
  /** price / ATH - 1, so -0.5 is half off the high. */
  drawdown: number;
  change1m: number;
  multiple1y: number;
  multiple4y: number;
}

export interface PolarChart {
  size: number;
  centre: number;
  radius: number;
  firstDate: string;
  segments: { d: string; color: string }[];
  /** One zero-length subpath per all-time-high close, drawn as dots. */
  athPath: string;
  rings: { r: number; strong: boolean }[];
  ringLabels: { text: string; x: number; y: number }[];
  years: { label: number; x: number; y: number; anchor: string }[];
  halvings: { date: string; price: number; degrees: number; xy: XY }[];
  latest: XY;
  stats: PolarStats;
  /** Each close against the close one turn (four years) earlier. */
  turns: { compared: number; higher: number; worstDate: string; worst: number };
}

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const msOf = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** Clockwise from 3 o'clock, in radians; real year length, so 1 Jan is exact. */
function angleOf(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const fraction = (ms - start) / (Date.UTC(year + 1, 0, 1) - start);
  return ((year % 4) + fraction) * (Math.PI / 2);
}

const radiusOf = (price: number): number =>
  (RADIUS * Math.max(0, Math.log10(price) - LOG_MIN)) / (LOG_MAX - LOG_MIN);

/** SVG's y axis points down, so a growing angle turns clockwise on screen. */
function pointOf(ms: number, price: number): XY {
  const r = radiusOf(price);
  const a = angleOf(ms);
  return [CENTRE + r * Math.cos(a), CENTRE + r * Math.sin(a)];
}

/** Cycle index and progress (0..1) of a day, given the cycle boundaries. */
function cycleOf(ms: number, anchors: number[]): [number, number] {
  let i = anchors.length - 2;
  while (i > 0 && ms < (anchors[i] as number)) i--;
  const from = anchors[i] as number;
  const to = anchors[i + 1] as number;
  return [i, Math.min(1, Math.max(0, (ms - from) / (to - from)))];
}

const hexToRgb = (hex: string): number[] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

/** Linear sRGB blend along GRADIENT, t in 0..1. */
function colorAt(t: number): string {
  const span = t * (GRADIENT.length - 1);
  const i = Math.min(GRADIENT.length - 2, Math.floor(span));
  const from = hexToRgb(GRADIENT[i] as string);
  const to = hexToRgb(GRADIENT[i + 1] as string);
  const mix = from.map((c, k) =>
    Math.round(c + ((to[k] as number) - c) * (span - i)),
  );
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const fmt = ([x, y]: XY): string => `${x.toFixed(1)} ${y.toFixed(1)}`;

/**
 * One path per colour bucket. Each path opens on the previous one's last point,
 * so the line has no gaps where the colour changes. Forced days (ATHs,
 * halvings, the last close) are always kept, so their markers sit on the line.
 */
function buildSegments(
  rows: Row[],
  anchors: number[],
  forced: Set<string>,
): { d: string; color: string }[] {
  const segments: { points: XY[]; color: string }[] = [];
  let key = -1;
  let prev: XY | null = null;
  for (const row of rows) {
    const xy = pointOf(row.ms, row.price);
    const [cycle, progress] = cycleOf(row.ms, anchors);
    const bucket = Math.min(
      BUCKETS_PER_CYCLE - 1,
      Math.floor(progress * BUCKETS_PER_CYCLE),
    );
    const next = cycle * BUCKETS_PER_CYCLE + bucket;
    const opens = next !== key;
    if (opens) {
      segments.push({
        points: prev ? [prev] : [],
        color: colorAt(bucket / (BUCKETS_PER_CYCLE - 1)),
      });
      key = next;
    }
    const far =
      !prev || Math.hypot(xy[0] - prev[0], xy[1] - prev[1]) >= MIN_STEP;
    if (opens || far || forced.has(row.date)) {
      segments[segments.length - 1]?.points.push(xy);
      prev = xy;
    }
  }
  return segments.map((s) => ({
    color: s.color,
    d: `M${s.points.map(fmt).join("L")}`,
  }));
}

/** Every close above all closes before it. */
function athCloses(rows: Row[]): Row[] {
  let high = 0;
  return rows.filter((row) => {
    if (row.price <= high) return false;
    high = row.price;
    return true;
  });
}

function statsOf(rows: Row[], prices: Map<string, number>): PolarStats {
  const last = rows[rows.length - 1] as Row;
  // `>=`: a close that ties the high is the high.
  const ath = rows.reduce((best, row) =>
    row.price >= best.price ? row : best,
  );
  const ago = (days: number) =>
    closestPrice(prices, isoDay(last.ms - days * DAY_MS)) as number;
  return {
    lastDate: last.date,
    price: last.price,
    athDate: ath.date,
    athPrice: ath.price,
    daysSinceAth: Math.round((last.ms - ath.ms) / DAY_MS),
    drawdown: last.price / ath.price - 1,
    change1m: last.price / ago(30) - 1,
    multiple1y: last.price / ago(365),
    multiple4y: last.price / ago(TURN_DAYS),
  };
}

function turnsOf(
  rows: Row[],
  prices: Map<string, number>,
): PolarChart["turns"] {
  const firstMs = (rows[0] as Row).ms;
  const turns = {
    compared: 0,
    higher: 0,
    worstDate: "",
    worst: Number.POSITIVE_INFINITY,
  };
  for (const row of rows) {
    const earlierMs = row.ms - TURN_DAYS * DAY_MS;
    if (earlierMs < firstMs) continue;
    const multiple =
      row.price / (closestPrice(prices, isoDay(earlierMs)) as number);
    turns.compared++;
    if (multiple > 1) turns.higher++;
    if (multiple < turns.worst)
      Object.assign(turns, { worst: multiple, worstDate: row.date });
  }
  return turns;
}

export function buildPolar(options: {
  /** Estimated next halving: the 100% end of the running cycle. */
  nextHalvingMs: number;
}): PolarChart {
  // "start": the close belongs to the day the period opens, as in the D3
  // chart and the rainbow page.
  const prices = loadPrices("bitcoin", "start");
  const rows: Row[] = [...prices.entries()]
    .filter(([, price]) => price > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, price]) => ({
      date,
      ms: msOf(date),
      price,
    }));

  const halvingDates = loadHalvings();
  const anchors = [
    GENESIS_MS,
    ...halvingDates.map(msOf),
    options.nextHalvingMs,
  ];
  const aths = athCloses(rows);
  const halvings = halvingDates.map((date) => {
    const price = closestPrice(prices, date) as number;
    const degrees = ((angleOf(msOf(date)) * 180) / Math.PI) % 360;
    return { date, price, degrees, xy: pointOf(msOf(date), price) };
  });
  const last = rows[rows.length - 1] as Row;
  const forced = new Set([
    ...aths.map((r) => r.date),
    ...halvings.map((h) => h.date),
    last.date,
  ]);

  const lastYear = new Date(last.ms).getUTCFullYear();
  const turnStart = lastYear - (lastYear % 4);
  const out = RADIUS + 14;
  const outY = RADIUS + 26;

  return {
    size: SIZE,
    centre: CENTRE,
    radius: RADIUS,
    firstDate: (rows[0] as Row).date,
    segments: buildSegments(rows, anchors, forced),
    athPath: aths.map((r) => `M${fmt(pointOf(r.ms, r.price))}h0`).join(""),
    // One ring per decade; the centre is $0.01 itself, so it gets none.
    rings: Array.from({ length: LOG_MAX - LOG_MIN }, (_, i) => ({
      r: (RADIUS * (i + 1)) / (LOG_MAX - LOG_MIN),
      strong: (LOG_MIN + i + 1) % 3 === 0,
    })),
    ringLabels: [...RING_LABELS].map(([decade, text]) => {
      const r = radiusOf(10 ** decade);
      // On the axis, $100K and $1M are one ring apart, less than a mobile
      // label is tall; the outer one goes outside its ring at half past one,
      // where no price can be.
      return decade === LOG_MAX
        ? {
            text,
            x: CENTRE + r * Math.SQRT1_2 + 6,
            y: CENTRE - r * Math.SQRT1_2 - 10,
          }
        : { text, x: CENTRE + 8, y: CENTRE - r };
    }),
    years: [
      { label: turnStart, x: CENTRE + out, y: CENTRE, anchor: "start" },
      { label: turnStart + 1, x: CENTRE, y: CENTRE + outY, anchor: "middle" },
      { label: turnStart + 2, x: CENTRE - out, y: CENTRE, anchor: "end" },
      { label: turnStart + 3, x: CENTRE, y: CENTRE - outY, anchor: "middle" },
    ],
    halvings,
    latest: pointOf(last.ms, last.price),
    stats: statsOf(rows, prices),
    turns: turnsOf(rows, prices),
  };
}
