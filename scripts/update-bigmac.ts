#!/usr/bin/env npx tsx
/**
 * Download the latest Big Mac Index CSV from The Economist's GitHub repo
 * and update the local dataset + recompute satsukashii prices.json.
 *
 * Source: https://github.com/TheEconomist/big-mac-data
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const FULL_INDEX_URL =
  "https://raw.githubusercontent.com/TheEconomist/big-mac-data/master/output-data/big-mac-full-index.csv";

const DEFAULT_OUTPUT = "public/datasets/satsukashii/big-mac-source-data-v2.csv";

// Our local column order
const LOCAL_COLUMNS = [
  "name",
  "iso_a3",
  "currency_code",
  "local_price",
  "dollar_ex",
  "GDP_dollar",
  "GDP_local",
  "date",
] as const;

type LocalColumn = (typeof LOCAL_COLUMNS)[number];

interface LocalRow {
  name: string;
  iso_a3: string;
  currency_code: string;
  local_price: string;
  dollar_ex: string;
  GDP_dollar: string;
  GDP_local: string;
  date: string;
}

interface CliArgs {
  output: string;
  dryRun: boolean;
  recompute: boolean;
}

// ---------------------------------------------------------------------------
// CSV helpers (no external deps)
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function serializeCSV(headers: readonly string[], rows: LocalRow[]): string {
  const lines: string[] = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    const line = headers
      .map((h) => csvEscape(row[h as LocalColumn] ?? ""))
      .join(",");
    lines.push(line);
  }
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Fetch with retry + exponential backoff
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, maxAttempts = 3): Promise<string> {
  console.log(`Downloading Big Mac data from ${url}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (err) {
      if (attempt === maxAttempts) {
        throw new Error(
          `Failed after ${maxAttempts} attempts: ${(err as Error).message}`,
        );
      }
      const delayMs = 1500 * attempt;
      console.log(
        `  Attempt ${attempt} failed (${(err as Error).message}), retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Unreachable but satisfies TypeScript
  throw new Error("Unexpected exit from retry loop");
}

// ---------------------------------------------------------------------------
// Column remapping
// ---------------------------------------------------------------------------

function convertToLocalFormat(csvText: string): LocalRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Downloaded CSV appears empty");
  }

  const headers = parseCSVLine(lines[0]);

  const required: string[] = [
    "date",
    "iso_a3",
    "currency_code",
    "name",
    "local_price",
    "dollar_ex",
  ];
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}. Got: ${headers.join(", ")}`,
    );
  }

  const idx = (col: string): number => headers.indexOf(col);

  const rows: LocalRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    rows.push({
      name: values[idx("name")] ?? "",
      iso_a3: values[idx("iso_a3")] ?? "",
      currency_code: values[idx("currency_code")] ?? "",
      local_price: values[idx("local_price")] ?? "",
      dollar_ex: values[idx("dollar_ex")] ?? "",
      GDP_dollar:
        idx("GDP_dollar") !== -1 ? (values[idx("GDP_dollar")] ?? "") : "",
      GDP_local:
        idx("GDP_local") !== -1 ? (values[idx("GDP_local")] ?? "") : "",
      date: values[idx("date")] ?? "",
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let output = DEFAULT_OUTPUT;
  let dryRun = false;
  let recompute = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-recompute") {
      recompute = false;
    } else if (arg === "--output") {
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("--output requires a value");
      }
      output = next;
      i++;
    } else if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
    }
  }

  return { output, dryRun, recompute };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();

  // import.meta.dirname is the scripts/ dir; project root is one level up
  const scriptDir = import.meta.dirname;
  const root = resolve(scriptDir, "..");

  const outputPath = args.output.startsWith("/")
    ? args.output
    : resolve(root, args.output);

  // Download
  const csvText = await fetchWithRetry(FULL_INDEX_URL);

  // Convert
  const rows = convertToLocalFormat(csvText);
  console.log(`Downloaded ${rows.length} rows`);

  // Compare with existing
  if (existsSync(outputPath)) {
    const existing = readFileSync(outputPath, "utf-8").trim().split("\n");
    const existingRowCount = existing.length - 1; // subtract header
    console.log(`Existing file has ${existingRowCount} rows`);
    const diff = rows.length - existingRowCount;
    if (diff > 0) {
      console.log(`  ~${diff} new rows`);
    } else if (diff === 0) {
      console.log("  No new rows (already up to date)");
    } else {
      console.log(
        `  Downloaded has ${Math.abs(diff)} fewer rows (schema may differ, replacing)`,
      );
    }
  }

  if (args.dryRun) {
    console.log("Dry run — not writing.");
    return;
  }

  // Write
  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const localCsv = serializeCSV(LOCAL_COLUMNS, rows);
  writeFileSync(outputPath, localCsv, "utf-8");
  console.log(`Wrote ${outputPath}`);

  // Recompute
  if (args.recompute) {
    const computeScript = resolve(scriptDir, "compute-satsukashii.ts");
    if (existsSync(computeScript)) {
      console.log("Recomputing satsukashii prices.json...");
      const result = spawnSync("npx", ["tsx", computeScript], {
        cwd: root,
        stdio: "inherit",
      });
      if (result.error) {
        console.warn(
          `WARNING: recompute failed (npx/tsx not found?): ${result.error.message}`,
        );
        console.warn(`  Run manually: npx tsx ${computeScript}`);
      } else if (result.status !== 0) {
        console.warn(`WARNING: recompute exited with status ${result.status}`);
      } else {
        console.log("Done!");
      }
    } else {
      console.warn(`WARNING: ${computeScript} not found, skipping recompute`);
    }
  }
}

main().catch((err) => {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
});
