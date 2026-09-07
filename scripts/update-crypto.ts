import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface Crypto {
  name: string;
  pair: string;
  csvPath: string;
}

interface OhlcRow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
  count: number;
}

interface CsvRow {
  Start: string;
  End: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  "Market Cap": string;
}

interface KrakenResult {
  // OHLC rows are keyed by pair; the "last" key holds a cursor timestamp.
  [key: string]: unknown[][] | number;
}

interface KrakenResponse {
  error: string[];
  result: KrakenResult;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CSV_COLUMNS: (keyof CsvRow)[] = [
  "Start",
  "End",
  "Open",
  "High",
  "Low",
  "Close",
  "Volume",
  "Market Cap",
];

// ---------------------------------------------------------------------------
// Helpers: date
// ---------------------------------------------------------------------------

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateToTimestamp(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Helpers: path resolution
// ---------------------------------------------------------------------------

function resolveDatasetPath(defaultRelative: string): string {
  const cwd = process.cwd();
  const direct = resolve(cwd, defaultRelative);
  if (existsSync(direct)) return direct;

  for (const entry of readdirSync(cwd, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = resolve(cwd, entry.name, defaultRelative);
    if (existsSync(candidate)) return candidate;
  }

  return direct;
}

// ---------------------------------------------------------------------------
// Helpers: CSV
// ---------------------------------------------------------------------------

function parseCsvLine(line: string, headers: string[]): Record<string, string> {
  const values = line.split(",");
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    obj[header] = values[index]?.trim() ?? "";
  });
  return obj;
}

function readLastDate(csvPath: string): string | null {
  if (!existsSync(csvPath) || statSync(csvPath).size === 0) return null;

  const content = readFileSync(csvPath, "utf-8").trim();
  if (!content) return null;

  const lines = content.split("\n");
  if (lines.length < 2) return null;

  const headers = lines[0].split(",").map((h) => h.trim());
  const endIndex = headers.indexOf("End");
  if (endIndex === -1) return null;

  let latest: string | null = null;
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const val = values[endIndex]?.trim();
    if (!val) continue;
    if (!latest || val > latest) latest = val;
  }

  return latest;
}

function rowToCsvLine(row: CsvRow): string {
  return CSV_COLUMNS.map((col) => {
    const val = row[col];
    return val === "" ? "" : String(val);
  }).join(",");
}

function readAllRows(csvPath: string): CsvRow[] {
  if (!existsSync(csvPath) || statSync(csvPath).size === 0) return [];

  const content = readFileSync(csvPath, "utf-8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const v = parseCsvLine(lines[i], headers);
    if (!v.Start) continue;
    rows.push({
      Start: v.Start,
      End: v.End,
      Open: Number.parseFloat(v.Open),
      High: Number.parseFloat(v.High),
      Low: Number.parseFloat(v.Low),
      Close: Number.parseFloat(v.Close),
      Volume: v.Volume ? Number.parseFloat(v.Volume) : 0,
      "Market Cap": v["Market Cap"] ?? "",
    });
  }

  return rows;
}

function writeCsv(csvPath: string, rows: CsvRow[]): void {
  const header = CSV_COLUMNS.join(",");
  const lines = [header, ...rows.map(rowToCsvLine)];
  writeFileSync(csvPath, `${lines.join("\n")}\n`, "utf-8");
}

// ---------------------------------------------------------------------------
// Helpers: Kraken API
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchKrakenOhlc(
  pair: string,
  since: number,
): Promise<OhlcRow[]> {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440&since=${since}`;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = (await res.json()) as KrakenResponse;

      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(", ")}`);
      }

      const result = data.result;
      const resultPair = Object.keys(result).find((k) => k !== "last");
      if (!resultPair)
        throw new Error("No result pair found in Kraken response");

      const ohlcData = result[resultPair];
      if (!Array.isArray(ohlcData))
        throw new Error(
          `Unexpected Kraken OHLC payload for pair "${resultPair}"`,
        );

      return ohlcData.map((row) => ({
        timestamp: Number(row[0]),
        open: Number.parseFloat(String(row[1])),
        high: Number.parseFloat(String(row[2])),
        low: Number.parseFloat(String(row[3])),
        close: Number.parseFloat(String(row[4])),
        vwap: Number.parseFloat(String(row[5])),
        volume: Number.parseFloat(String(row[6])),
        count: Number(row[7]),
      }));
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }

  throw new Error(`Failed to fetch Kraken ${pair} after retries: ${lastErr}`);
}

// ---------------------------------------------------------------------------
// Convert OHLC rows to CSV format
// ---------------------------------------------------------------------------

function convertToCsvFormat(rows: OhlcRow[]): CsvRow[] {
  return rows.map((row) => {
    const startDate = new Date(row.timestamp * 1000).toISOString().slice(0, 10);
    const endDate = addDays(startDate, 1);
    return {
      Start: startDate,
      End: endDate,
      Open: row.open,
      High: row.high,
      Low: row.low,
      Close: row.close,
      Volume: row.volume,
      "Market Cap": "",
    };
  });
}

// ---------------------------------------------------------------------------
// Merge: deduplicate by Start, sort ascending
// ---------------------------------------------------------------------------

function mergeAppend(existingRows: CsvRow[], newRows: CsvRow[]): CsvRow[] {
  const map = new Map<string, CsvRow>();
  for (const row of existingRows) map.set(row.Start, row);
  for (const row of newRows) map.set(row.Start, row);
  const merged = [...map.values()];
  merged.sort((a, b) => (a.Start < b.Start ? -1 : a.Start > b.Start ? 1 : 0));
  return merged;
}

// ---------------------------------------------------------------------------
// Update a single crypto
// ---------------------------------------------------------------------------

async function updateCrypto(
  crypto: Crypto,
  endDate: string,
  dryRun: boolean,
  debug: boolean,
): Promise<void> {
  console.log(`\n[${crypto.name}] Processing ${crypto.csvPath}`);

  const lastDate = readLastDate(crypto.csvPath);
  if (debug)
    console.log(`[${crypto.name}] Last date in CSV: ${lastDate ?? "(none)"}`);

  // Fetch from day after last entry, or from a reasonable default
  const fetchFrom = lastDate ? addDays(lastDate, -1) : "2010-01-01";
  const since = dateToTimestamp(fetchFrom);

  if (debug)
    console.log(`[${crypto.name}] Fetching since ${fetchFrom} (ts=${since})`);

  const ohlcRows = await fetchKrakenOhlc(crypto.pair, since);
  if (debug)
    console.log(`[${crypto.name}] Got ${ohlcRows.length} candles from Kraken`);

  // Filter to only rows where End <= endDate (i.e. Start < endDate)
  const allNew = convertToCsvFormat(ohlcRows);
  const filtered = allNew.filter((r) => r.Start < endDate);

  if (debug)
    console.log(
      `[${crypto.name}] ${filtered.length} rows after filtering to end=${endDate}`,
    );

  if (filtered.length === 0) {
    console.log(`[${crypto.name}] No new rows to append.`);
    return;
  }

  const existing = readAllRows(crypto.csvPath);
  const merged = mergeAppend(existing, filtered);
  const newCount = merged.length - existing.length;

  console.log(
    `[${crypto.name}] +${newCount} new rows (total: ${merged.length})`,
  );

  if (dryRun) {
    console.log(`[${crypto.name}] Dry run — skipping write.`);
    return;
  }

  writeCsv(crypto.csvPath, merged);
  console.log(`[${crypto.name}] Written to ${crypto.csvPath}`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const dryRun = args.includes("--dry-run");
  const debug = args.includes("--debug");

  let endDate = utcToday();
  const endIdx = args.indexOf("--end");
  if (endIdx !== -1 && args[endIdx + 1]) {
    endDate = args[endIdx + 1];
  }

  // Path overrides
  function argPath(flag: string, fallback: string): string {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    return resolveDatasetPath(fallback);
  }

  const datasetBase = "public/datasets";

  const cryptos: Crypto[] = [
    {
      name: "Bitcoin",
      pair: "XBTUSD",
      csvPath: argPath("--btc-path", `${datasetBase}/bitcoin_daily.csv`),
    },
    {
      name: "Ethereum",
      pair: "ETHUSD",
      csvPath: argPath("--eth-path", `${datasetBase}/ethereum_daily.csv`),
    },
    {
      name: "Monero",
      pair: "XMRUSD",
      csvPath: argPath("--xmr-path", `${datasetBase}/monero_daily.csv`),
    },
  ];

  if (debug) {
    console.log("Config:", { dryRun, debug, endDate });
    for (const c of cryptos) console.log(`  ${c.name}: ${c.csvPath}`);
  }

  for (const crypto of cryptos) {
    await updateCrypto(crypto, endDate, dryRun, debug);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
