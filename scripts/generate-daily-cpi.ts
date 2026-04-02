#!/usr/bin/env npx tsx
import { readFileSync, writeFileSync } from "node:fs";
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
type MonthCol = (typeof MONTH_COLS)[number];

interface CpiRow {
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

interface MonthlyPoint {
  year: number;
  month: number; // 1-12
  value: number;
}

interface DailyPoint {
  timestamp: string; // YYYY-MM-DD
  cpi: number;
  dailyMultiplicator: number;
}

function parseCsv(content: string): CpiRow[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = parts[i] ?? "";
    });
    return obj as unknown as CpiRow;
  });
}

function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setUTCMonth(result.getUTCMonth() + n);
  return result;
}

function dateToISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function interpolateDaily(
  startValue: number,
  endValue: number,
  startDate: Date,
  endDate: Date,
): { date: Date; value: number }[] {
  const totalDays = daysBetween(startDate, endDate);
  const result: { date: Date; value: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const t = totalDays > 0 ? i / totalDays : 0;
    const value = startValue + t * (endValue - startValue);
    const date = new Date(startDate.getTime() + i * 86400000);
    result.push({ date, value });
  }
  return result;
}

function loadMonthlyPoints(csvPath: string): MonthlyPoint[] {
  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(content);
  const points: MonthlyPoint[] = [];

  for (const row of rows) {
    const year = Number.parseInt(String(row.Year), 10);
    if (Number.isNaN(year)) continue;

    MONTH_COLS.forEach((col, idx) => {
      const raw = (row[col as MonthCol] ?? "").trim();
      const value = Number.parseFloat(raw);
      if (!Number.isNaN(value) && Number.isFinite(value)) {
        points.push({ year, month: idx + 1, value });
      }
    });
  }

  points.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return points;
}

function extrapolateMonths(
  points: MonthlyPoint[],
  countMonths: number,
): MonthlyPoint[] {
  if (points.length < 2) return [];
  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  const delta = last.value - secondLast.value;

  const extra: MonthlyPoint[] = [];
  let { year, month } = last;
  let value = last.value;

  for (let i = 0; i < countMonths; i++) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    value += delta;
    extra.push({ year, month, value });
  }

  return extra;
}

function generateDailyCpi(points: MonthlyPoint[]): DailyPoint[] {
  if (points.length === 0) return [];

  // Extrapolate 3 months beyond the last known point
  const extended = [...points, ...extrapolateMonths(points, 3)];

  const daily: { date: Date; value: number }[] = [];

  for (let i = 0; i < extended.length - 1; i++) {
    const cur = extended[i];
    const next = extended[i + 1];
    const startDate = monthStart(cur.year, cur.month);
    const endDate = monthStart(next.year, next.month);
    const segment = interpolateDaily(cur.value, next.value, startDate, endDate);
    daily.push(...segment);
  }

  // Include the last point date
  const last = extended[extended.length - 1];
  daily.push({ date: monthStart(last.year, last.month), value: last.value });

  const result: DailyPoint[] = daily.map((pt, idx) => {
    let multiplicator: number;
    if (idx === 0) {
      multiplicator = 1.0;
    } else {
      const prev = daily[idx - 1];
      multiplicator = 1 + (pt.value - prev.value) / prev.value;
    }
    // Round to 6 significant decimals like the Python output
    const cpiRounded = Math.round(pt.value * 10000) / 10000;
    const multRounded = Math.round(multiplicator * 1000000) / 1000000;
    return {
      timestamp: dateToISO(pt.date),
      cpi: cpiRounded,
      dailyMultiplicator: multRounded,
    };
  });

  return result;
}

function writeDailyCsv(outputPath: string, rows: DailyPoint[]): void {
  const lines = ["timestamp;CPI;daily_multiplicator"];
  for (const row of rows) {
    lines.push(`${row.timestamp};${row.cpi};${row.dailyMultiplicator}`);
  }
  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf-8");
}

function main(): void {
  const datasetsDir = resolve(__dirname, "../public/datasets");
  const cpiPath = resolve(datasetsDir, "CPI_U.csv");
  const outputPath = resolve(datasetsDir, "daily_cpi_inflation.csv");

  console.log(`[daily-cpi] reading ${cpiPath}`);
  const points = loadMonthlyPoints(cpiPath);
  console.log(`[daily-cpi] loaded ${points.length} monthly points`);

  const daily = generateDailyCpi(points);
  console.log(`[daily-cpi] generated ${daily.length} daily points`);

  writeDailyCsv(outputPath, daily);
  console.log(`[daily-cpi] wrote ${outputPath}`);
}

main();
