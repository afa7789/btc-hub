#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";

// --- Interfaces ---

interface Metal {
  name: string;
  ticker: string;
  csvPath: string;
}

interface OhlcvRow {
  date: string; // YYYY-MM-DD
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
}

interface YahooChartMeta {
  symbol: string;
}

interface YahooChartIndicatorsQuote {
  close: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  open: (number | null)[];
  volume: (number | null)[];
}

interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp: number[];
  indicators: {
    quote: YahooChartIndicatorsQuote[];
  };
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code: string; description: string } | null;
  };
}

// --- Constants ---

const CSV_HEADER = "Price,Close,High,Low,Open,Volume";

// --- Helpers ---

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateToUnix(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function resolveDatasetPath(relativePath: string, scriptDir: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  const direct = path.resolve(scriptDir, "..", relativePath);
  if (fs.existsSync(direct)) {
    return direct;
  }
  // Search one level of subdirs from parent
  const parent = path.resolve(scriptDir, "..");
  if (fs.existsSync(parent)) {
    for (const entry of fs.readdirSync(parent)) {
      const child = path.join(parent, entry);
      if (fs.statSync(child).isDirectory()) {
        const candidate = path.join(child, relativePath);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }
  return direct;
}

function readLastDate(csvPath: string): string | null {
  if (!fs.existsSync(csvPath)) return null;
  const content = fs.readFileSync(csvPath, "utf-8").trim();
  if (!content) return null;

  const lines = content.split("\n");
  // skip header
  let lastDate: string | null = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const col = line.split(",")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(col)) {
      if (lastDate === null || col > lastDate) {
        lastDate = col;
      }
    }
  }
  return lastDate;
}

function parseCsv(csvPath: string): OhlcvRow[] {
  if (!fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, "utf-8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  const rows: OhlcvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 6) continue;
    const [dateStr, close, high, low, open, volume] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    rows.push({
      date: dateStr,
      close: Number(close),
      high: Number(high),
      low: Number(low),
      open: Number(open),
      volume: Number(volume),
    });
  }
  return rows;
}

function rowsToCsv(rows: OhlcvRow[]): string {
  const lines = [CSV_HEADER];
  for (const row of rows) {
    lines.push(
      `${row.date},${row.close},${row.high},${row.low},${row.open},${row.volume}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

// --- Yahoo Finance fetch ---

async function downloadYahooDaily(
  ticker: string,
  startInclusive: string,
  endInclusive: string,
  debug: boolean,
): Promise<OhlcvRow[]> {
  const period1 = dateToUnix(startInclusive);
  // Add one day to end to make it inclusive
  const period2 = dateToUnix(addDays(endInclusive, 1));
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;

  if (debug) {
    console.log(`[debug] GET ${url}`);
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as YahooChartResponse;

  if (data.chart.error) {
    throw new Error(
      `Yahoo Finance error: ${data.chart.error.code} - ${data.chart.error.description}`,
    );
  }

  const result = data.chart.result;
  if (!result || result.length === 0) {
    return [];
  }

  const chart = result[0];
  const timestamps = chart.timestamp ?? [];
  const quote = chart.indicators.quote[0];

  if (!quote) return [];

  const rows: OhlcvRow[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = quote.close[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const open = quote.open[i];
    const volume = quote.volume[i];

    if (
      close === null ||
      high === null ||
      low === null ||
      open === null ||
      volume === null
    ) {
      continue;
    }

    const dateStr = new Date(ts * 1000).toISOString().slice(0, 10);
    rows.push({
      date: dateStr,
      close,
      high,
      low,
      open,
      volume,
    });
  }

  if (debug) {
    console.log(`[debug] Fetched ${rows.length} rows for ${ticker}`);
  }

  return rows;
}

// --- Merge ---

function mergeAppend(existing: OhlcvRow[], newRows: OhlcvRow[]): OhlcvRow[] {
  const byDate = new Map<string, OhlcvRow>();
  for (const row of existing) {
    byDate.set(row.date, row);
  }
  for (const row of newRows) {
    byDate.set(row.date, row);
  }
  const merged = Array.from(byDate.values());
  merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return merged;
}

// --- Core update ---

async function updateMetal(
  metal: Metal,
  end: string,
  dryRun: boolean,
  debug: boolean,
): Promise<void> {
  const lastDate = readLastDate(metal.csvPath);

  let startDate: string;
  if (lastDate === null) {
    // No existing data — fetch from a reasonable default
    startDate = "2001-01-01";
    console.log(`[${metal.name}] No existing data. Fetching from ${startDate}`);
  } else if (lastDate >= end) {
    console.log(`[${metal.name}] Already up to date (last: ${lastDate})`);
    return;
  } else {
    startDate = addDays(lastDate, 1);
    console.log(
      `[${metal.name}] Last date: ${lastDate}. Fetching from ${startDate} to ${end}`,
    );
  }

  const newRows = await downloadYahooDaily(metal.ticker, startDate, end, debug);

  if (newRows.length === 0) {
    console.log(`[${metal.name}] No new rows returned from Yahoo Finance.`);
    return;
  }

  const existing = parseCsv(metal.csvPath);
  const merged = mergeAppend(existing, newRows);

  if (dryRun) {
    console.log(
      `[${metal.name}] Dry run — would write ${merged.length} rows to ${metal.csvPath}`,
    );
    console.log(`[${metal.name}] New rows sample:`);
    for (const row of newRows.slice(0, 3)) {
      console.log(
        `  ${row.date},${row.close},${row.high},${row.low},${row.open},${row.volume}`,
      );
    }
    return;
  }

  // Ensure directory exists
  const dir = path.dirname(metal.csvPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(metal.csvPath, rowsToCsv(merged), "utf-8");
  console.log(
    `[${metal.name}] Written ${merged.length} rows (added ${newRows.length} new) to ${metal.csvPath}`,
  );
}

// --- CLI ---

function parseArgs(): {
  goldPath: string;
  silverPath: string;
  end: string;
  dryRun: boolean;
  debug: boolean;
} {
  const args = process.argv.slice(2);
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);

  let goldPath = resolveDatasetPath("public/datasets/gold.csv", scriptDir);
  let silverPath = resolveDatasetPath("public/datasets/silver.csv", scriptDir);
  let end = utcToday();
  let dryRun = false;
  let debug = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--gold-path" && args[i + 1]) {
      goldPath = args[++i];
    } else if (arg === "--silver-path" && args[i + 1]) {
      silverPath = args[++i];
    } else if (arg === "--end" && args[i + 1]) {
      end = args[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--debug") {
      debug = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: update-metals.ts [options]

Options:
  --gold-path <path>    Path to gold.csv (default: public/datasets/gold.csv)
  --silver-path <path>  Path to silver.csv (default: public/datasets/silver.csv)
  --end <YYYY-MM-DD>    End date (default: today UTC)
  --dry-run             Print what would be written without writing
  --debug               Print debug info including API URLs
  --help                Show this help
`);
      process.exit(0);
    }
  }

  return { goldPath, silverPath, end, dryRun, debug };
}

async function main(): Promise<number> {
  const { goldPath, silverPath, end, dryRun, debug } = parseArgs();

  const metals: Metal[] = [
    { name: "Gold", ticker: "GC=F", csvPath: goldPath },
    { name: "Silver", ticker: "SI=F", csvPath: silverPath },
  ];

  if (debug) {
    console.log("[debug] Gold path:", goldPath);
    console.log("[debug] Silver path:", silverPath);
    console.log("[debug] End date:", end);
    console.log("[debug] Dry run:", dryRun);
  }

  let exitCode = 0;
  for (const metal of metals) {
    try {
      await updateMetal(metal, end, dryRun, debug);
    } catch (err) {
      console.error(
        `[${metal.name}] Error:`,
        err instanceof Error ? err.message : err,
      );
      exitCode = 1;
    }
  }

  return exitCode;
}

main().then((code) => process.exit(code));
