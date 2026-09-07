#!/usr/bin/env bash
#
# update.sh — refresh every automatable dataset under public/datasets/.
#
# Usage:
#   bash scripts/update.sh                 # fetch everything, then summarise + gate
#   bash scripts/update.sh --summary-only  # READ-ONLY: no network, just the report
#   bash scripts/update.sh --skip-fetch    # alias of --summary-only
#   bash scripts/update.sh --no-fail-stale # report staleness but always exit 0
#   bash scripts/update.sh --max-age-days N  # override the default 30-day gate
#
# Exit codes: 0 ok · 1 an updater failed · 2 a dataset is stale · 3 both.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATASETS="$REPO_ROOT/public/datasets"

DEFAULT_MAX_AGE_DAYS=30
MAX_AGE_OVERRIDE=""
SUMMARY_ONLY=0
FAIL_STALE=1

while [ $# -gt 0 ]; do
  case "$1" in
    --summary-only|--skip-fetch|--dry-run) SUMMARY_ONLY=1 ;;
    --no-fail-stale)                       FAIL_STALE=0 ;;
    --max-age-days)                        MAX_AGE_OVERRIDE="${2:?--max-age-days needs a value}"; shift ;;
    -h|--help)                             sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 64 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# TypeScript runner. Every updater in scripts/ is TS; bun runs them natively,
# otherwise fall back to tsx. No Docker and no Python are involved any more.
# ---------------------------------------------------------------------------
RUNNER=""
pick_runner() {
  if command -v bun >/dev/null 2>&1; then
    RUNNER="bun run"
  elif command -v tsx >/dev/null 2>&1; then
    RUNNER="tsx"
  elif command -v npx >/dev/null 2>&1; then
    RUNNER="npx --yes tsx"
  else
    echo "ERROR: need bun (preferred) or npx/tsx on PATH to run the updaters." >&2
    return 1
  fi
  echo "Runner: $RUNNER"
}

# ---------------------------------------------------------------------------
# Date helpers. Pure awk (Howard Hinnant's days_from_civil) so the arithmetic
# behaves identically on macOS BSD date and GNU date.
# ---------------------------------------------------------------------------
DAYS_FROM_CIVIL='
function days_from_civil(y, m, d,   era, yoe, doy, doe) {
  if (m <= 2) y = y - 1
  era = int((y >= 0 ? y : y - 399) / 400)
  yoe = y - era * 400
  doy = int((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
  return era * 146097 + doe - 719468
}'

TODAY="$(date -u +%Y-%m-%d)"

# age_days <YYYY-MM-DD> -> whole days between that date and today (UTC).
age_days() {
  awk -v today="$TODAY" -v d="$1" "$DAYS_FROM_CIVIL"'
    BEGIN {
      if (d !~ /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/) { print "NA"; exit }
      split(today, t, "-"); split(d, x, "-")
      print days_from_civil(t[1]+0, t[2]+0, t[3]+0) - days_from_civil(x[1]+0, x[2]+0, x[3]+0)
    }'
}

# max_date_in_column <file> <field-separator> <1-based column>
# Scans every data row and returns the lexicographically greatest ISO date,
# so it works whether the CSV is sorted oldest-first or newest-first.
max_date_in_column() {
  awk -F"$2" -v col="$3" '
    NR > 1 {
      v = $col
      gsub(/^[ \t"]+|[ \t"\r]+$/, "", v)
      if (v ~ /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/ && v > best) best = v
    }
    END { print (best == "" ? "NA" : best) }' "$1" 2>/dev/null
}

# max_date_cpi_matrix <file> — CPI_U.csv is a Year x Month matrix, so the
# newest observation is the last non-empty month cell of the greatest year.
max_date_cpi_matrix() {
  awk -F, '
    NR > 1 && $1 ~ /^[0-9]{4}$/ {
      last = 0
      for (m = 2; m <= 13; m++) {
        v = $m; gsub(/[ \t\r"]/, "", v)
        if (v != "") last = m - 1
      }
      if (last > 0 && ($1 > bestYear || ($1 == bestYear && last > bestMonth))) {
        bestYear = $1; bestMonth = last
      }
    }
    END {
      if (bestYear == "") print "NA"
      else printf "%04d-%02d-01\n", bestYear, bestMonth
    }' "$1" 2>/dev/null
}

# json_date <file> <key> — pulls "key": "YYYY-MM-DD..." without needing jq.
json_date() {
  grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[0-9][0-9-]*" "$1" 2>/dev/null \
    | head -n 1 | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}' | head -n 1
}

# ---------------------------------------------------------------------------
# Dataset registry.
#   path | how to read its date | max age in days | producer
# max-age of "-" means the dataset is exempt from the staleness gate (curated
# by hand, or a static schedule). Cadence-driven overrides are noted inline.
# ---------------------------------------------------------------------------
DATASET_ROWS=(
  "CPI_U.csv|cpi|45|update-cpi.ts"
  "daily_cpi_inflation.csv|csv;1|45|update-cpi.ts (calls generate-daily-cpi.ts)"
  "gold.csv|csv,1|7|update-metals.ts"
  "silver.csv|csv,1|7|update-metals.ts"
  "bitcoin_2010-07-17_2025-07-25.csv|csv,1|5|update-crypto.ts"
  "ethereum_2015-08-07_2025-07-25.csv|csv,1|5|update-crypto.ts"
  "monero_2014-05-21_2025-07-25.csv|csv,1|5|update-crypto.ts"
  "satsukashii/big-mac-source-data-v2.csv|csv,8|400|update-bigmac.ts"
  "satsukashii/prices.json|json:biggest_date|7|compute-satsukashii.ts"
  "M2SL.csv|csv,1|-|MANUAL (FRED download)"
  "all-the-money/data.json|json:lastUpdated|-|MANUAL (scripts/update-all-the-money.mjs)"
  "sem-melhores/blacklist.json|none|-|MANUAL (hand-curated)"
  "halvings.txt|none|-|STATIC (protocol schedule)"
)

dataset_date() {
  local file="$1" spec="$2"
  [ -f "$file" ] || { echo "MISSING"; return; }
  case "$spec" in
    cpi)      max_date_cpi_matrix "$file" ;;
    "csv,"*)  max_date_in_column "$file" "," "${spec#csv,}" ;;
    "csv;"*)  max_date_in_column "$file" ";" "${spec#csv;}" ;;
    "json:"*) local d; d="$(json_date "$file" "${spec#json:}")"; echo "${d:-NA}" ;;
    none)     echo "-" ;;
    *)        echo "NA" ;;
  esac
}

print_summary() {
  local stale=0 row file spec maxage producer d age status

  printf '\n=== Dataset summary (as of %s UTC) ===\n\n' "$TODAY"
  printf '%-44s %-12s %6s  %-8s %s\n' "DATASET" "LAST DATE" "AGE" "STATUS" "PRODUCED BY"
  printf '%-44s %-12s %6s  %-8s %s\n' \
    "--------------------------------------------" "------------" "------" "--------" "-----------"

  for row in "${DATASET_ROWS[@]}"; do
    IFS='|' read -r file spec maxage producer <<<"$row"
    d="$(dataset_date "$DATASETS/$file" "$spec")"

    age="-"
    status="ok"
    if [ "$d" = "MISSING" ]; then
      status="MISSING"
      [ "$maxage" != "-" ] && stale=1
    elif [ "$d" = "NA" ]; then
      status="UNKNOWN"
      [ "$maxage" != "-" ] && stale=1
    elif [ "$d" = "-" ]; then
      status="static"
    else
      age="$(age_days "$d")"
      if [ "$maxage" = "-" ]; then
        status="manual"
      else
        [ -n "$MAX_AGE_OVERRIDE" ] && maxage="$MAX_AGE_OVERRIDE"
        if [ "$age" != "NA" ] && [ "$age" -gt "$maxage" ]; then
          status="STALE"
          stale=1
        fi
      fi
    fi

    printf '%-44s %-12s %6s  %-8s %s\n' \
      "$file" "$d" "$age" "$status" "$producer"
  done

  if [ -n "$MAX_AGE_OVERRIDE" ]; then
    printf '\nGate: every automated dataset must be at most %s days old (--max-age-days).\n' "$MAX_AGE_OVERRIDE"
  else
    printf '\nGate: automated datasets must be at most %s days old, except where the\n' "$DEFAULT_MAX_AGE_DAYS"
    printf 'upstream release cadence forces a wider window (metals/crypto are held to\n'
    printf 'a tighter one; the Big Mac index only publishes twice a year).\n'
  fi
  printf 'manual/static rows are listed for visibility but never fail the gate.\n'

  return $stale
}

# ---------------------------------------------------------------------------
# Fetch phase
# ---------------------------------------------------------------------------
fail=0

run_step() {
  local label="$1"; shift
  echo "--- $label"
  if "$@"; then
    echo "[$label] ok"
  else
    echo "[$label] FAILED" >&2
    fail=1
  fi
}

if [ "$SUMMARY_ONLY" -eq 1 ]; then
  echo "=== --summary-only: reading existing datasets, no fetch, no writes ==="
else
  pick_runner || exit 1
  cd "$REPO_ROOT" || exit 1

  echo "=== Fetching sources in parallel ==="

  # shellcheck disable=SC2086
  $RUNNER scripts/update-cpi.ts >/tmp/upd-cpi.log 2>&1 &
  PID_CPI=$!
  # shellcheck disable=SC2086
  $RUNNER scripts/update-metals.ts >/tmp/upd-metals.log 2>&1 &
  PID_METALS=$!
  # shellcheck disable=SC2086
  $RUNNER scripts/update-crypto.ts \
    --btc-path "$DATASETS/bitcoin_2010-07-17_2025-07-25.csv" \
    --eth-path "$DATASETS/ethereum_2015-08-07_2025-07-25.csv" \
    --xmr-path "$DATASETS/monero_2014-05-21_2025-07-25.csv" \
    >/tmp/upd-crypto.log 2>&1 &
  PID_CRYPTO=$!
  # Big Mac source CSV only; prices.json is recomputed in the serial step below.
  # shellcheck disable=SC2086
  $RUNNER scripts/update-bigmac.ts --no-recompute >/tmp/upd-bigmac.log 2>&1 &
  PID_BIGMAC=$!

  for spec in "CPI:$PID_CPI:/tmp/upd-cpi.log" \
              "METALS:$PID_METALS:/tmp/upd-metals.log" \
              "CRYPTO:$PID_CRYPTO:/tmp/upd-crypto.log" \
              "BIGMAC:$PID_BIGMAC:/tmp/upd-bigmac.log"; do
    IFS=':' read -r name pid log <<<"$spec"
    if wait "$pid"; then
      echo "[$name] ok"
    else
      echo "[$name] FAILED — log follows" >&2
      tail -n 30 "$log" >&2
      fail=1
    fi
  done

  # Serial: satsukashii is derived from the Big Mac CSV *and* the bitcoin CSV,
  # so it can only run once both fetches above have landed.
  echo "=== Recomputing derived datasets ==="
  # shellcheck disable=SC2086
  run_step "SATSUKASHII" $RUNNER scripts/compute-satsukashii.ts
fi

# ---------------------------------------------------------------------------
# Report + staleness gate
# ---------------------------------------------------------------------------
print_summary
stale=$?

status=0
[ "$fail" -ne 0 ] && status=$((status + 1))
if [ "$stale" -ne 0 ] && [ "$FAIL_STALE" -eq 1 ]; then
  echo ""
  echo "ERROR: one or more automated datasets are STALE/MISSING (see table above)." >&2
  status=$((status + 2))
elif [ "$stale" -ne 0 ]; then
  echo ""
  echo "WARNING: stale datasets present, ignored because of --no-fail-stale." >&2
fi

if [ "$status" -eq 0 ]; then
  echo ""
  if [ "$SUMMARY_ONLY" -eq 1 ]; then
    echo "=== Report only, nothing was fetched or written ==="
  else
    echo "=== All updates complete, every automated dataset is fresh ==="
  fi
fi
exit $status
