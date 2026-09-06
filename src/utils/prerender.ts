/**
 * Build-time computation of the default scenarios shown by /dca and
 * /how-much-i-fucked-up.
 *
 * These run in Node during `astro build`, so the resulting numbers are baked
 * into the static HTML. The pages therefore show a real, complete result on
 * first paint — and keep showing it when JavaScript is unavailable. The
 * client scripts recompute over the same datasets when the user changes an
 * input, so the two paths must agree; the logic here mirrors
 * `public/scripts/dca/dca.js`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATASETS = join(process.cwd(), "public", "datasets");

export type Frequency = "daily" | "weekly" | "monthly";

export interface AssetSpec {
  file: string;
  /** crypto: Start,End,Open,High,Low,Close — commodity: Price,Close,... */
  format: "crypto" | "commodity";
  symbol: string;
  decimals: number;
}

export const ASSETS: Record<string, AssetSpec> = {
  bitcoin: {
    file: "bitcoin_2010-07-17_2025-07-25.csv",
    format: "crypto",
    symbol: "BTC",
    decimals: 8,
  },
  ethereum: {
    file: "ethereum_2015-08-07_2025-07-25.csv",
    format: "crypto",
    symbol: "ETH",
    decimals: 6,
  },
  monero: {
    file: "monero_2014-05-21_2025-07-25.csv",
    format: "crypto",
    symbol: "XMR",
    decimals: 6,
  },
  gold: { file: "gold.csv", format: "commodity", symbol: "oz", decimals: 4 },
  silver: {
    file: "silver.csv",
    format: "commodity",
    symbol: "oz",
    decimals: 4,
  },
};

export type PriceSeries = Map<string, number>;

/**
 * Which date column keys the series.
 *
 * The crypto CSVs describe a period as `Start`..`End`, so the same close can be
 * reached under two different dates. `dca.js` keys on `End`; the client script
 * in how-much-i-fucked-up.astro keys on `Start`. Both are defensible, but a
 * prerender that disagrees with the script that later overwrites it puts two
 * different prices for one date on the same screen — which is what happened.
 */
export type DateKey = "start" | "end";

const cache = new Map<string, PriceSeries>();

export function loadPrices(
  assetKey: string,
  dateKey: DateKey = "end",
): PriceSeries {
  const cacheId = `${assetKey}:${dateKey}`;
  const cached = cache.get(cacheId);
  if (cached) return cached;

  const asset = ASSETS[assetKey];
  if (!asset) throw new Error(`Unknown asset: ${assetKey}`);

  const prices: PriceSeries = new Map();
  const text = readFileSync(join(DATASETS, asset.file), "utf8");
  const lines = text.split("\n");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const values = line.split(",");

    // Commodity rows carry a single date in the Price column.
    const date =
      asset.format === "crypto"
        ? dateKey === "start"
          ? values[0]
          : values[1]
        : values[0];
    const close = Number.parseFloat(
      (asset.format === "crypto" ? values[5] : values[1]) ?? "",
    );

    if (date && !Number.isNaN(close)) prices.set(date, close);
  }

  cache.set(cacheId, prices);
  return prices;
}

/** Nearest available close to `date`, so weekends and gaps still resolve. */
export function closestPrice(prices: PriceSeries, date: string): number | null {
  const exact = prices.get(date);
  if (exact !== undefined) return exact;

  const target = new Date(date).getTime();
  let best: number | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const [priceDate, close] of prices) {
    const diff = Math.abs(target - new Date(priceDate).getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      best = close;
    }
  }

  return best;
}

function advance(date: Date, frequency: Frequency): void {
  if (frequency === "daily") date.setDate(date.getDate() + 1);
  else if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else date.setMonth(date.getMonth() + 1);
}

const iso = (date: Date): string => date.toISOString().split("T")[0] as string;

export interface Transaction {
  date: string;
  amount: number;
  price: number;
  unitsBought: number;
  totalUnits: number;
  totalInvested: number;
}

export interface DcaScenario {
  asset: string;
  symbol: string;
  decimals: number;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate: string;
  transactions: Transaction[];
  totalInvested: number;
  totalUnits: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
  averagePrice: number;
}

export function computeDca(options: {
  asset: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate: string;
}): DcaScenario {
  const { asset: assetKey, amount, frequency, startDate, endDate } = options;
  const asset = ASSETS[assetKey];
  if (!asset) throw new Error(`Unknown asset: ${assetKey}`);

  const prices = loadPrices(assetKey);
  const end = new Date(endDate);
  const cursor = new Date(startDate);

  const transactions: Transaction[] = [];
  let totalInvested = 0;
  let totalUnits = 0;

  while (cursor <= end) {
    const price = closestPrice(prices, iso(cursor));
    if (price === null) {
      advance(cursor, frequency);
      continue;
    }

    const unitsBought = amount / price;
    totalInvested += amount;
    totalUnits += unitsBought;
    transactions.push({
      date: iso(cursor),
      amount,
      price,
      unitsBought,
      totalUnits,
      totalInvested,
    });

    advance(cursor, frequency);
  }

  if (transactions.length === 0) {
    throw new Error(
      `No price data for ${assetKey} in ${startDate}..${endDate}`,
    );
  }

  const currentPrice = closestPrice(prices, endDate) as number;
  const currentValue = totalUnits * currentPrice;
  const profitLoss = currentValue - totalInvested;

  return {
    asset: assetKey,
    symbol: asset.symbol,
    decimals: asset.decimals,
    amount,
    frequency,
    startDate,
    endDate,
    transactions,
    totalInvested,
    totalUnits,
    currentPrice,
    currentValue,
    profitLoss,
    profitLossPercent: (profitLoss / totalInvested) * 100,
    averagePrice: totalInvested / totalUnits,
  };
}

/** Most recent date present in an asset's series. */
export function lastDate(assetKey: string): string {
  const dates = [...loadPrices(assetKey).keys()].sort();
  return dates[dates.length - 1] as string;
}

/** The client caps the table at 50 evenly spaced rows; match that here. */
export function sampleTransactions(
  transactions: Transaction[],
  max = 50,
): Transaction[] {
  if (transactions.length <= max) return transactions;

  const step = (transactions.length - 1) / (max - 1);
  const sampled: Transaction[] = [];
  for (let i = 0; i < max; i++) {
    sampled.push(transactions[Math.round(i * step)] as Transaction);
  }
  return sampled;
}

export interface RegretScenario {
  date: string;
  usd: number;
  priceThen: number;
  btcAmount: number;
  priceNow: number;
  priceNowDate: string;
  valueToday: number;
  multiple: number;
}

/**
 * "What if I had bought on date X?" — the live page replaces `priceNow` with a
 * CoinGecko quote; at build time the last close in the dataset stands in.
 */
export function computeRegret(options: {
  date: string;
  usd: number;
}): RegretScenario {
  // "start" to match how-much-i-fucked-up.astro, which re-reads the same CSV
  // client-side and would otherwise contradict these numbers on screen.
  const prices = loadPrices("bitcoin", "start");
  const priceThen = closestPrice(prices, options.date);
  if (priceThen === null) throw new Error(`No BTC price near ${options.date}`);

  const dates = [...prices.keys()].sort();
  const priceNowDate = dates[dates.length - 1] as string;
  const priceNow = prices.get(priceNowDate) as number;
  const btcAmount = options.usd / priceThen;

  return {
    date: options.date,
    usd: options.usd,
    priceThen,
    btcAmount,
    priceNow,
    priceNowDate,
    valueToday: btcAmount * priceNow,
    multiple: priceNow / priceThen,
  };
}

export const usd = (value: number, decimals = 2): string =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
