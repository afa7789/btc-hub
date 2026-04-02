import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface BigMacRow {
  name: string;
  iso_a3: string;
  currency_code: string;
  local_price: number;
  dollar_ex: number;
  GDP_dollar?: number;
  GDP_local?: number;
  date: string;
}

interface BitcoinRow {
  Start: string;
  End: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume?: number;
  "Market Cap"?: number;
}

interface PricePoint {
  date: string; // ISO date string
  bigmac_usd: number;
  bigmac_satoshi: number;
}

interface SatsukashiiData {
  prices: PricePoint[];
  max_price: number;
  max_price_satoshi: number;
  smallest_date: string;
  biggest_date: string;
}

// Parse CSV line into object
function parseCSVLine(line: string, headers: string[]): Record<string, string> {
  const values = line.split(",");
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    obj[header] = values[index]?.trim() || "";
  });
  return obj;
}

// Parse BigMac CSV
function parseBigMacCSV(csvPath: string): Map<string, Map<string, number>> {
  const content = readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");

  const data = new Map<string, Map<string, number>>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], headers);
    const currencyCode = values.currency_code;
    const date = values.date;
    const localPrice = Number.parseFloat(values.local_price);

    if (!currencyCode || !date || Number.isNaN(localPrice)) continue;

    if (!data.has(currencyCode)) {
      data.set(currencyCode, new Map());
    }
    data.get(currencyCode)?.set(date, localPrice);
  }

  return data;
}

// Get BigMac price in USD for a given date (using closest date before or equal)
function getBigMacUSDPrice(
  bigmacData: Map<string, Map<string, number>>,
  targetDate: string,
): number | null {
  const usdData = bigmacData.get("USD");
  if (!usdData) return null;

  const targetDateObj = new Date(targetDate);
  let closestDate: string | null = null;
  let closestPrice: number | null = null;

  for (const [dateStr, price] of usdData.entries()) {
    const date = new Date(dateStr);
    if (date <= targetDateObj) {
      if (!closestDate || date > new Date(closestDate)) {
        closestDate = dateStr;
        closestPrice = price;
      }
    }
  }

  return closestPrice;
}

// Parse Bitcoin CSV
function parseBitcoinCSV(csvPath: string): BitcoinRow[] {
  const content = readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");

  const rows: BitcoinRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], headers);
    rows.push({
      Start: values.Start,
      End: values.End,
      Open: Number.parseFloat(values.Open),
      High: Number.parseFloat(values.High),
      Low: Number.parseFloat(values.Low),
      Close: Number.parseFloat(values.Close),
      Volume: values.Volume ? Number.parseFloat(values.Volume) : undefined,
      "Market Cap": values["Market Cap"]
        ? Number.parseFloat(values["Market Cap"])
        : undefined,
    });
  }

  // Sort by date ascending
  rows.sort(
    (a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime(),
  );

  return rows;
}

// Main function
function computeSatsukashii() {
  const baseDir = resolve(import.meta.dirname, "..");
  const bigmacPath = resolve(
    baseDir,
    "public/datasets/satsukashii/big-mac-source-data-v2.csv",
  );
  const bitcoinPath = resolve(
    baseDir,
    "public/datasets/bitcoin_2010-07-17_2025-07-25.csv",
  );
  const outputPath = resolve(
    baseDir,
    "public/datasets/satsukashii/prices.json",
  );

  console.log("Parsing BigMac CSV...");
  const bigmacData = parseBigMacCSV(bigmacPath);

  console.log("Parsing Bitcoin CSV...");
  const bitcoinRows = parseBitcoinCSV(bitcoinPath);

  const prices: PricePoint[] = [];
  let maxPrice = 0;
  let maxPriceSatoshi = 0;

  console.log("Computing prices...");
  for (const row of bitcoinRows) {
    const btcPrice = row.Close;
    const bigmacUSD = getBigMacUSDPrice(bigmacData, row.Start);

    if (bigmacUSD !== null && btcPrice > 0) {
      const bitcoinAmount = bigmacUSD / btcPrice;
      const satoshis = bitcoinAmount * 100_000_000;

      if (bigmacUSD > maxPrice) maxPrice = bigmacUSD;
      if (satoshis > maxPriceSatoshi) maxPriceSatoshi = satoshis;

      prices.push({
        date: row.Start,
        bigmac_usd: bigmacUSD,
        bigmac_satoshi: satoshis,
      });
    }
  }

  const result: SatsukashiiData = {
    prices,
    max_price: maxPrice,
    max_price_satoshi: maxPriceSatoshi,
    smallest_date: prices[0]?.date || "",
    biggest_date: prices[prices.length - 1]?.date || "",
  };

  console.log(`Writing ${prices.length} price points to ${outputPath}`);
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log("Done!");
}

computeSatsukashii();
