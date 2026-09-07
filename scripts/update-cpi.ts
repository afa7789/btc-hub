#!/usr/bin/env npx tsx
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MONTH_COLS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const CSV_COLUMNS = ["Year", ...MONTH_COLS, "HALF1", "HALF2"] as const;
const VALUE_COLS = [...MONTH_COLS, "HALF1", "HALF2"] as const;
type MonthCol = (typeof MONTH_COLS)[number];

const MONTH_NUM_TO_COL: Record<number, MonthCol> = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "May",
  6: "Jun",
  7: "Jul",
  8: "Aug",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dec",
};

interface CpiConfig {
  seriesId: string;
  cpiCsv: string;
}

interface CpiTableRow {
  Year: number;
  Jan: string;
  Feb: string;
  Mar: string;
  Apr: string;
  May: string;
  Jun: string;
  Jul: string;
  Aug: string;
  Sep: string;
  Oct: string;
  Nov: string;
  Dec: string;
  HALF1: string;
  HALF2: string;
}

interface BlsDataItem {
  year: string;
  period: string;
  periodName?: string;
  value: string;
  [key: string]: unknown;
}

interface BlsSeriesResult {
  seriesID: string;
  data: BlsDataItem[];
}

interface BlsApiResponse {
  status: string;
  message?: string[];
  Results?: {
    series: BlsSeriesResult[];
  };
}

interface MonthlyPoint {
  year: number;
  month: number;
  value: string;
}

function regenerateDailyCpi(): void {
  console.log("[cpi] regenerating daily CPI via generate-daily-cpi.ts");
  const script = resolve(__dirname, "generate-daily-cpi.ts");
  execSync(`npx tsx ${JSON.stringify(script)}`, { stdio: "inherit" });
}

function utcYear(): number {
  return new Date().getUTCFullYear();
}

function resolvePath(defaultRelative: string): string {
  if (defaultRelative.startsWith("/")) return defaultRelative;

  const cwd = process.cwd();
  const direct = resolve(cwd, defaultRelative);
  if (existsSync(direct)) return direct;

  try {
    const children = readdirSync(cwd);
    for (const child of children) {
      const childPath = resolve(cwd, child);
      if (statSync(childPath).isDirectory()) {
        const candidate = resolve(childPath, defaultRelative);
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch {
    // ignore
  }

  return direct;
}

function parseCsv(content: string): CpiTableRow[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = parts[i] ?? "";
    });

    const row = { Year: 0 } as CpiTableRow;
    for (const col of CSV_COLUMNS) {
      if (col === "Year") {
        row.Year = Number.parseInt(obj.Year ?? "0", 10);
      } else {
        row[col] = obj[col] ?? "";
      }
    }
    return row;
  });
}

function serializeCsv(rows: CpiTableRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((row) => {
    return CSV_COLUMNS.map((col) => {
      if (col === "Year") return String(row.Year);
      return row[col] ?? "";
    }).join(",");
  });
  return `${[header, ...lines].join("\n")}\n`;
}

function loadCpiTable(csvPath: string): CpiTableRow[] {
  if (!existsSync(csvPath)) {
    throw new Error(`Missing CPI CSV: ${csvPath}`);
  }
  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(content);
  const valid = rows.filter((r) => !Number.isNaN(r.Year) && r.Year > 0);
  valid.sort((a, b) => a.Year - b.Year);
  return valid;
}

function parseNumeric(val: string): number | null {
  const trimmed = val.trim();
  if (trimmed === "") return null;
  const n = Number.parseFloat(trimmed);
  return Number.isNaN(n) ? null : n;
}

function findLastFilledMonth(rows: CpiTableRow[]): {
  year: number;
  month: number;
} {
  const sorted = [...rows].sort((a, b) => b.Year - a.Year);
  for (const row of sorted) {
    for (let m = 12; m >= 1; m--) {
      const col = MONTH_NUM_TO_COL[m];
      const v = parseNumeric(row[col] ?? "");
      if (v !== null) return { year: row.Year, month: m };
    }
  }
  throw new Error("Could not find any numeric CPI values in CPI_U.csv");
}

function yearsWithMissingMonths(rows: CpiTableRow[]): Set<number> {
  const missing = new Set<number>();
  for (const row of rows) {
    for (const col of MONTH_COLS) {
      const v = parseNumeric(row[col] ?? "");
      if (v === null) {
        missing.add(row.Year);
        break;
      }
    }
  }
  return missing;
}

function ensureYearRow(rows: CpiTableRow[], year: number): CpiTableRow[] {
  if (rows.some((r) => r.Year === year)) return rows;
  const newRow = { Year: year } as CpiTableRow;
  for (const col of MONTH_COLS) {
    newRow[col] = "";
  }
  newRow.HALF1 = "";
  newRow.HALF2 = "";
  const updated = [...rows, newRow];
  updated.sort((a, b) => a.Year - b.Year);
  return updated;
}

function recalcHalvesForYear(rows: CpiTableRow[], year: number): void {
  const row = rows.find((r) => r.Year === year);
  if (!row) return;

  const half1Cols: MonthCol[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const half2Cols: MonthCol[] = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const avgIfFull = (cols: MonthCol[]): string => {
    const vals = cols.map((c) => parseNumeric(row[c] ?? ""));
    const nums = vals.filter((v): v is number => v !== null);
    if (nums.length !== vals.length) return "";
    const sum = nums.reduce((a, b) => a + b, 0);
    return (sum / nums.length).toFixed(3);
  };

  row.HALF1 = avgIfFull(half1Cols);
  row.HALF2 = avgIfFull(half2Cols);
}

async function blsFetchSeries(
  seriesId: string,
  startYear: number,
  endYear: number,
  debug: boolean,
): Promise<BlsDataItem[]> {
  const url = "https://api.bls.gov/publicAPI/v1/timeseries/data/";
  const payload = {
    seriesid: [seriesId],
    startyear: String(startYear),
    endyear: String(endYear),
  };

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      const data = (await resp.json()) as BlsApiResponse;

      if (debug) {
        console.log(
          `[debug] bls status=${data.status} message=${JSON.stringify(data.message)}`,
        );
      }

      if (data.status !== "REQUEST_SUCCEEDED") {
        throw new Error(
          `BLS API status=${data.status} message=${JSON.stringify(data.message)}`,
        );
      }

      const series = data.Results?.series?.[0];
      return series?.data ?? [];
    } catch (e) {
      lastErr = e;
      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, 1500 * attempt));
      }
    }
  }

  throw new Error(`Failed to fetch BLS CPI series after retries: ${lastErr}`);
}

async function blsFetchSeriesRange(
  seriesId: string,
  startYear: number,
  endYear: number,
  debug: boolean,
): Promise<BlsDataItem[]> {
  const chunkSize = 20;
  const allRows: BlsDataItem[] = [];
  let y = startYear;
  while (y <= endYear) {
    const y2 = Math.min(endYear, y + chunkSize - 1);
    const rows = await blsFetchSeries(seriesId, y, y2, debug);
    allRows.push(...rows);
    y = y2 + 1;
  }
  return allRows;
}

function extractMonthlyPoints(blsRows: BlsDataItem[]): MonthlyPoint[] {
  const out: MonthlyPoint[] = [];
  for (const item of blsRows) {
    const period = item.period ?? "";
    if (typeof period !== "string" || !period.startsWith("M")) continue;
    if (period === "M13") continue;
    const monthNum = Number.parseInt(period.slice(1), 10);
    if (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12) continue;
    const year = Number.parseInt(item.year, 10);
    const valueStr = String(item.value ?? "").trim();
    if (parseNumeric(valueStr) === null) continue;
    out.push({ year, month: monthNum, value: valueStr });
  }
  return out;
}

async function updateCpi(
  cfg: CpiConfig,
  endYear: number,
  dryRun: boolean,
  debug: boolean,
  lookbackYears: number,
  overwriteExisting: boolean,
): Promise<void> {
  let rows = loadCpiTable(cfg.cpiCsv);

  // Normalize: remove non-numeric placeholders like "-"
  let cleanedAny = false;
  for (const col of VALUE_COLS) {
    for (const row of rows) {
      const v = row[col] ?? "";
      if (v.trim() !== "" && parseNumeric(v) === null) {
        row[col] = "";
        cleanedAny = true;
      }
    }
  }

  const { year: lastYear, month: lastMonth } = findLastFilledMonth(rows);

  const minYear = Math.min(...rows.map((r) => r.Year));
  const maxYear = Math.max(...rows.map((r) => r.Year));
  let windowStart = Math.max(minYear, maxYear - Math.max(0, lookbackYears));

  const missingYears = yearsWithMissingMonths(rows);
  if (missingYears.size > 0) {
    const minMissing = Math.min(...missingYears);
    windowStart = Math.min(windowStart, minMissing);
  }

  const startYear = windowStart;

  if (startYear > endYear) {
    console.log(
      `[cpi] up to date (last=${lastYear}-${String(lastMonth).padStart(2, "0")})`,
    );
    return;
  }

  if (debug) {
    console.log(
      `[debug] cpi_csv=${cfg.cpiCsv} exists=${existsSync(cfg.cpiCsv)}`,
    );
    console.log(
      `[debug] updating series=${cfg.seriesId} from ${startYear} to ${endYear} (lookback_years=${lookbackYears})`,
    );
    console.log(
      `[debug] overwrite_existing=${overwriteExisting} missing_years=${JSON.stringify([...missingYears].sort())}`,
    );
  }

  const blsRows = await blsFetchSeriesRange(
    cfg.seriesId,
    startYear,
    endYear,
    debug,
  );
  const points = extractMonthlyPoints(blsRows);
  const toApply = points.filter(
    (p) => p.year >= startYear && p.year <= endYear,
  );

  if (toApply.length === 0) {
    if (cleanedAny) {
      if (dryRun) {
        console.log(
          "[cpi] dry-run: would normalize non-numeric placeholders in CPI_U.csv",
        );
        return;
      }
      const dir = dirname(cfg.cpiCsv);
      mkdirSync(dir, { recursive: true });
      writeFileSync(cfg.cpiCsv, serializeCsv(rows), "utf-8");
      console.log(`[cpi] wrote ${cfg.cpiCsv} (normalized placeholders)`);
      regenerateDailyCpi();
      return;
    }
    console.log("[cpi] no new monthly points returned (nothing to update)");
    return;
  }

  const touchedYears = new Set<number>();
  let changedCells = 0;

  for (const { year, month, value } of toApply) {
    rows = ensureYearRow(rows, year);
    const col = MONTH_NUM_TO_COL[month];
    const row = rows.find((r) => r.Year === year);
    if (!row) continue;
    const cur = (row[col] ?? "").trim();
    const curNum = parseNumeric(cur);
    const newNum = parseNumeric(value);

    let shouldWrite: boolean;
    if (cur === "" || curNum === null) {
      shouldWrite = true;
    } else if (overwriteExisting) {
      shouldWrite = newNum !== null && curNum !== newNum;
    } else {
      shouldWrite = false;
    }

    if (shouldWrite) {
      row[col] = value;
      touchedYears.add(year);
      changedCells++;
    }
  }

  for (const y of [...touchedYears].sort()) {
    recalcHalvesForYear(rows, y);
  }

  rows.sort((a, b) => a.Year - b.Year);

  if (dryRun) {
    const maxTouched =
      touchedYears.size > 0 ? Math.max(...touchedYears) : lastYear;
    const extra = cleanedAny ? " + normalize placeholders" : "";
    console.log(
      `[cpi] dry-run: would update years=${JSON.stringify([...touchedYears].sort())} ` +
        `(latest touched=${maxTouched}), changed_cells=${changedCells}${extra}`,
    );
    return;
  }

  if (touchedYears.size === 0 && !cleanedAny) {
    console.log("[cpi] nothing changed");
    return;
  }

  const dir = dirname(cfg.cpiCsv);
  mkdirSync(dir, { recursive: true });
  writeFileSync(cfg.cpiCsv, serializeCsv(rows), "utf-8");
  console.log(`[cpi] wrote ${cfg.cpiCsv}`);

  regenerateDailyCpi();
}

interface CliArgs {
  seriesId: string;
  cpiPath: string;
  endYear: number | null;
  lookbackYears: number;
  noOverwrite: boolean;
  dryRun: boolean;
  debug: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    seriesId: "CUUR0000SA0",
    cpiPath: "public/datasets/CPI_U.csv",
    endYear: null,
    lookbackYears: 3,
    noOverwrite: false,
    dryRun: false,
    debug: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--series-id":
        args.seriesId = argv[++i] ?? args.seriesId;
        break;
      case "--cpi-path":
        args.cpiPath = argv[++i] ?? args.cpiPath;
        break;
      case "--end-year":
        args.endYear = Number.parseInt(argv[++i] ?? "", 10);
        break;
      case "--lookback-years":
        args.lookbackYears = Number.parseInt(argv[++i] ?? "3", 10);
        break;
      case "--no-overwrite":
        args.noOverwrite = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--debug":
        args.debug = true;
        break;
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const cfg: CpiConfig = {
    seriesId: args.seriesId,
    cpiCsv: resolvePath(args.cpiPath),
  };

  const endYear = args.endYear ?? utcYear();

  await updateCpi(
    cfg,
    endYear,
    args.dryRun,
    args.debug,
    args.lookbackYears,
    !args.noOverwrite,
  );
}

main().catch((err) => {
  console.error("[cpi] fatal:", err);
  process.exit(1);
});
