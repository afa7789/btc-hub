#!/usr/bin/env node
/**
 * update-all-the-money.mjs
 *
 * Assisted refresh workflow for `public/datasets/all-the-money/data.json`.
 *
 * WHY THIS IS NOT AUTOMATIC
 * -------------------------
 * The figures in that dataset (global wealth, global debt, real estate, gold,
 * money supply, central-bank balance sheets, national GDP...) do not come from
 * a free public API. Most of them are published once a year inside a PDF report
 * (UBS Global Wealth Report, IIF Global Debt Monitor, Savills, World Gold
 * Council, SIPRI, World Bank WDI...). There is no LLM at runtime here, so this
 * script does NOT search the web. It does two things instead:
 *
 *   1. `--dry-run` (default): prints every live-updatable item with its current
 *      value, its `lastUpdated`, and a ready-to-paste web-search query.
 *   2. `--apply <findings.json>`: takes the results of that (manual/assisted)
 *      search back in and writes ONLY the entries that are genuinely newer than
 *      what is already stored.
 *
 * THE PRESERVATION RULE (explicit user requirement)
 * ------------------------------------------------
 * If a finding's `lastUpdated` is NOT strictly newer than the stored
 * `lastUpdated`, the stored value is left byte-for-byte untouched. "No newer
 * source found" is a valid, expected outcome — never a reason to overwrite with
 * a guess. `metadata.lastUpdated` is only bumped when at least one item
 * actually changed.
 *
 * WORKFLOW
 * --------
 *   node scripts/update-all-the-money.mjs --dry-run          # what to search for
 *   node scripts/update-all-the-money.mjs --dry-run --json   # machine-readable
 *   # ... run those queries in a browser / with an LLM that has web search ...
 *   # ... write findings.json: [{ id, valueBillions, lastUpdated, sourceUrl }]
 *   node scripts/update-all-the-money.mjs --apply findings.json --dry-run  # preview
 *   node scripts/update-all-the-money.mjs --apply findings.json            # write
 *
 * MAINTENANCE COMMAND
 * -------------------
 *   node scripts/update-all-the-money.mjs --fix-endpoints
 * See `fixBrokenEndpoints()` below for what it does and why.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_PATH = resolve(
  HERE,
  "../public/datasets/all-the-money/data.json",
);

/**
 * Endpoints that can never succeed from a static page. Two separate reasons:
 *  - a literal `API_KEY` placeholder is sitting in the query string;
 *  - the host requires a secret that a public static site cannot hold anyway.
 * Both classes are matched so `--fix-endpoints` is idempotent.
 */
const KEYED_HOSTS = ["api.stlouisfed.org", "alphavantage.co", "finnhub.io"];
const PLACEHOLDER_RE = /API_KEY|YOUR_KEY|<key>/i;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const isBrokenEndpoint = (url) =>
  typeof url === "string" &&
  (PLACEHOLDER_RE.test(url) || KEYED_HOSTS.some((host) => url.includes(host)));

/** Mirrors the formatting already used throughout data.json. */
function formatValue(billions) {
  if (billions >= 1000) {
    const trillions = Number((billions / 1000).toFixed(2));
    return `${trillions} trillion`;
  }
  return `${Number(billions)} billion`;
}

function parseDate(value, label) {
  const ms = Date.parse(value);
  if (Number.isNaN(ms))
    throw new Error(`${label}: not a parseable date: ${JSON.stringify(value)}`);
  return ms;
}

/** Search query tuned per item so the operator does not have to invent one. */
function buildSearchQuery(item) {
  const year = new Date().getUTCFullYear();
  const provider = item.dataSource?.provider;
  const base = `${item.name} latest value ${year}`;
  return provider && provider !== "Multiple Central Banks"
    ? `${base} site or report by ${provider}`
    : `${base} official statistic in USD`;
}

function readData(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * `JSON.parse` keeps string-key insertion order and `JSON.stringify(_, null, 2)`
 * replays it, so this round-trips the file byte-for-byte when nothing changed.
 * Verified against the committed file.
 */
function writeData(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function loadFindings(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const list = Array.isArray(parsed) ? parsed : parsed.findings;
  if (!Array.isArray(list)) {
    throw new Error(
      `findings file must be an array, or an object with a "findings" array`,
    );
  }
  return list;
}

// ---------------------------------------------------------------------------
// --fix-endpoints
// ---------------------------------------------------------------------------

/**
 * DECISION: null out the endpoint, KEEP `isLiveUpdatable: true`.
 *
 * The spec offered two options — drop the broken `apiEndpoint`, or flip
 * `isLiveUpdatable` to false. Nulling the endpoint is the right one:
 *
 *  - The page's loader (public/scripts/all-the-money/script.js) guards on
 *    `item.isLiveUpdatable && item.dataSource.apiEndpoint`, so a null endpoint
 *    already stops the request. Nothing is fetched, nothing fails, nothing is
 *    logged as a CORS error on every page load.
 *  - `isLiveUpdatable` is the flag THIS script uses to decide what deserves a
 *    web-search refresh. Flipping it to false would make the item invisible to
 *    the refresh workflow, which is the opposite of the truth: US M2 and central
 *    bank balance sheets are exactly the numbers that go stale fastest. The flag
 *    means "worth re-checking", not "the browser fetches it live".
 *  - The human-readable `dataSource.url` is preserved, so the operator still has
 *    the canonical page (e.g. the FRED series) to check by hand.
 *
 * `apiConfig` blocks carrying the `API_KEY` placeholder are deleted outright:
 * they are dead configuration for a credential a static site cannot hold.
 */
function fixBrokenEndpoints(data) {
  const fixed = [];
  for (const item of data.items ?? []) {
    const changes = [];
    if (isBrokenEndpoint(item.dataSource?.apiEndpoint)) {
      changes.push(`apiEndpoint -> null (was ${item.dataSource.apiEndpoint})`);
      item.dataSource.apiEndpoint = null;
    }
    if (item.apiConfig && isBrokenEndpoint(item.apiConfig.endpoint)) {
      changes.push("removed apiConfig (required a secret key)");
      // undefined-valued keys are omitted by JSON.stringify, so this drops the key.
      item.apiConfig = undefined;
    }
    if (changes.length) fixed.push({ id: item.id, changes });
  }
  return fixed;
}

// ---------------------------------------------------------------------------
// --dry-run listing
// ---------------------------------------------------------------------------

function listLiveItems(data, asJson) {
  const live = (data.items ?? []).filter(
    (item) => item.isLiveUpdatable === true,
  );
  const rows = live.map((item) => ({
    id: item.id,
    name: item.name,
    valueBillions: item.valueBillions,
    valueFormatted: item.valueFormatted,
    lastUpdated: item.lastUpdated,
    provider: item.dataSource?.provider ?? null,
    sourceUrl: item.dataSource?.url ?? null,
    searchQuery: buildSearchQuery(item),
  }));

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  }

  console.log(
    `\n${live.length} live-updatable item(s) in ${data.items?.length ?? 0} total:\n`,
  );
  for (const row of rows) {
    console.log(`  ${row.id}`);
    console.log(`    name      : ${row.name}`);
    console.log(
      `    current   : ${row.valueBillions} B  (${row.valueFormatted})`,
    );
    console.log(`    updated   : ${row.lastUpdated}`);
    console.log(
      `    provider  : ${row.provider ?? "-"}  ${row.sourceUrl ?? ""}`,
    );
    console.log(`    SEARCH    : ${row.searchQuery}`);
    console.log("");
  }
  console.log(
    'Write findings as: [{ "id", "valueBillions", "lastUpdated", "sourceUrl" }]',
  );
  console.log(
    "Only entries with a lastUpdated STRICTLY NEWER than the current one are applied.\n",
  );
  return rows;
}

// ---------------------------------------------------------------------------
// --apply
// ---------------------------------------------------------------------------

/** Validate one finding against the dataset. Returns a decision record. */
function evaluateFinding(finding, byId) {
  const { id, valueBillions, lastUpdated, sourceUrl } = finding ?? {};
  if (!id)
    return {
      id: "(missing id)",
      action: "rejected",
      reason: 'finding has no "id"',
    };

  const item = byId.get(id);
  if (!item)
    return {
      id,
      action: "rejected",
      reason: "no item with that id in data.json",
    };
  if (item.isLiveUpdatable !== true) {
    return {
      id,
      action: "rejected",
      reason: "item is not marked isLiveUpdatable",
    };
  }
  if (
    typeof valueBillions !== "number" ||
    !Number.isFinite(valueBillions) ||
    valueBillions <= 0
  ) {
    return {
      id,
      action: "rejected",
      reason: "valueBillions must be a positive number",
    };
  }
  if (!sourceUrl)
    return {
      id,
      action: "rejected",
      reason: "sourceUrl is required for provenance",
    };

  let incoming;
  let current;
  try {
    incoming = parseDate(lastUpdated, "finding.lastUpdated");
    current = parseDate(item.lastUpdated, "item.lastUpdated");
  } catch (error) {
    return { id, action: "rejected", reason: error.message };
  }

  if (incoming <= current) {
    return {
      id,
      item,
      action: "kept",
      reason: `source (${lastUpdated}) is not newer than stored (${item.lastUpdated})`,
    };
  }
  return { id, item, action: "updated", finding };
}

/** Mutates `item` in place with the finding. Returns a human-readable diff line. */
function applyFinding(item, finding) {
  const before = { value: item.valueBillions, date: item.lastUpdated };
  item.valueBillions = finding.valueBillions;
  item.valueFormatted = formatValue(finding.valueBillions);
  item.lastUpdated = finding.lastUpdated;
  item.dataSource = item.dataSource ?? {};
  item.dataSource.url = finding.sourceUrl;
  if (finding.provider) item.dataSource.provider = finding.provider;
  if (finding.notes) item.dataSource.notes = finding.notes;
  return `${before.value} B (${before.date}) -> ${item.valueBillions} B (${item.lastUpdated})`;
}

function applyFindings(data, findings) {
  const byId = new Map((data.items ?? []).map((item) => [item.id, item]));
  const decisions = findings.map((finding) => evaluateFinding(finding, byId));
  for (const decision of decisions) {
    if (decision.action === "updated") {
      decision.diff = applyFinding(decision.item, decision.finding);
    }
  }
  return decisions;
}

function reportDecisions(decisions, live, write) {
  const updated = decisions.filter((d) => d.action === "updated");
  const kept = decisions.filter((d) => d.action === "kept");
  const rejected = decisions.filter((d) => d.action === "rejected");
  const touched = new Set(decisions.map((d) => d.id));

  console.log(`\n=== CHANGED (${updated.length}) ===`);
  for (const d of updated)
    console.log(`  ~ ${d.id}: ${d.diff}\n      source: ${d.finding.sourceUrl}`);
  if (!updated.length) console.log("  (nothing — every stored value survived)");

  console.log(`\n=== KEPT, source not newer (${kept.length}) ===`);
  for (const d of kept) console.log(`  = ${d.id}: ${d.reason}`);

  if (rejected.length) {
    console.log(`\n=== REJECTED (${rejected.length}) ===`);
    for (const d of rejected) console.log(`  ! ${d.id}: ${d.reason}`);
  }

  const untouched = live.filter((row) => !touched.has(row.id));
  console.log(
    `\n=== NOT IN FINDINGS, left untouched (${untouched.length}) ===`,
  );
  for (const row of untouched)
    console.log(`  . ${row.id} (${row.valueBillions} B, ${row.lastUpdated})`);

  const verb =
    updated.length === 0
      ? "NO-OP"
      : write
        ? "WILL WRITE"
        : "DRY RUN — nothing written";
  console.log(`\n${verb}: ${updated.length} item(s) changed.\n`);
  return updated.length;
}

// ---------------------------------------------------------------------------
// cli
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    json: false,
    fixEndpoints: false,
    apply: null,
    data: DEFAULT_DATA_PATH,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run" || arg === "-n") opts.dryRun = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--fix-endpoints") opts.fixEndpoints = true;
    else if (arg === "--apply") opts.apply = argv[++i];
    else if (arg === "--data") opts.data = resolve(argv[++i]);
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (opts.apply === undefined)
    throw new Error("--apply needs a path to a findings JSON file");
  return opts;
}

const USAGE = `
update-all-the-money — assisted refresh of public/datasets/all-the-money/data.json

  --dry-run, -n        list live-updatable items + suggested search queries; never writes
  --json               emit the listing as JSON (implies a listing run)
  --apply <file>       apply a findings file: [{ id, valueBillions, lastUpdated, sourceUrl }]
                       only entries strictly newer than the stored lastUpdated are applied
  --fix-endpoints      null out apiEndpoints that need a secret key (see fixBrokenEndpoints)
  --data <path>        operate on a different data.json (useful for tests)
  --help, -h           this text

Combine --apply with --dry-run to preview without writing.
`;

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(`error: ${error.message}`);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const data = readData(opts.data);
  const live = listLiveItems(data, opts.json);
  let changed = 0;

  if (opts.fixEndpoints) {
    const fixed = fixBrokenEndpoints(data);
    console.log(`\n=== ENDPOINT FIXES (${fixed.length}) ===`);
    for (const entry of fixed)
      console.log(`  ~ ${entry.id}: ${entry.changes.join("; ")}`);
    if (!fixed.length) console.log("  (none — already clean)");
    changed += fixed.length;
  }

  if (opts.apply) {
    const decisions = applyFindings(data, loadFindings(opts.apply));
    changed += reportDecisions(decisions, live, !opts.dryRun);
  }

  if (!changed) return;
  if (opts.dryRun) {
    console.log("DRY RUN — data.json untouched.");
    return;
  }
  data.metadata = data.metadata ?? {};
  data.metadata.lastUpdated = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  writeData(opts.data, data);
  console.log(
    `Wrote ${opts.data} (metadata.lastUpdated = ${data.metadata.lastUpdated}).`,
  );
}

main(process.argv.slice(2));

export {
  formatValue,
  isBrokenEndpoint,
  fixBrokenEndpoints,
  applyFindings,
  buildSearchQuery,
};
