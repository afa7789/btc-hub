# BTC Things

A collection of Bitcoin-related data visualization tools built with Astro.

## Tools

Seven static pages. The shell (nav, layout, copy) is prerendered HTML; all data and
charts are client-side vanilla JS, so every tool needs JavaScript enabled to show
anything beyond its frame.

### `/` — Home

Landing page with the tool grid and a scrolling price ticker (`Ticker.astro`) that
pulls the top 10 coins plus gold (`tether-gold`) from CoinGecko, caches the payload in
`localStorage` for 2 minutes, and serves stale data on a failed fetch.

### `/sem-melhores` — SEM MELHORES

Top 100 cryptocurrency browser, live from the CoinGecko API. The only tool written in
TypeScript (`src/scripts/sem-melhores/script.ts`); the rest are plain JS. Has name
search, a per-coin detail modal, a PT/EN language toggle, and its own theme button
(it hides the global one). Stablecoins and staked derivatives (stETH and friends) are
filtered out via `public/datasets/sem-melhores/blacklist.json` — that filtering is the
point of the name. Fully network-dependent: no CoinGecko, no list.

### `/all-the-money` — ALL THE MONEY IN THE WORLD

Block visualization of global wealth where **one block = $100 billion USD**. Reads the
curated `public/datasets/all-the-money/data.json`, which carries `excludeFromTotal`
rules so aggregates are not double-counted (gold is not summed on top of commodities).
`public/scripts/all-the-money/script.js` renders the blocks and derives each item's
color from the **SHA-256 of its slug** via `crypto.subtle`, with a saturation boost —
deterministic, always vibrant, no hardcoded palette. Supports filtering and a compare
mode. Static data, no API.

### `/dca` — DCA CALCULATOR

Dollar cost averaging simulator. Pick an asset (BTC, ETH, XMR, gold, silver), an
amount per buy, a frequency and a date range; it walks the matching historical CSV in
`/datasets/` and simulates buy by buy. The `ASSETS` map in
`public/scripts/dca/dca.js` knows each CSV's shape (`crypto`:
`Start,End,Open,High,Low,Close` vs `commodity`: `Price,Close,High,Low,Open,Volume`)
and per-asset precision (8 decimals for BTC, 4 for a troy ounce). Outputs total
invested, accumulated quantity, average price, current value, P/L, and the full
transaction table. Runs offline once the CSV is fetched.

### `/debase` — DEBASE

The heaviest page. Compares BTC/ETH/XMR/gold/silver **adjusted for inflation** (CPI-U)
to show real purchasing-power performance rather than nominal dollars. Uses D3 v7 from
the CDN plus three helpers in `public/scripts/debase/`: `dataset_manager.js` (loads the
CSVs and **caches them in IndexedDB** through `idb`, exposing `iterateRange` /
`getDataRange` so the full series never has to sit in memory), `chart_draw.js` for the
brutalist rendering, and the `import_from_*.js` fetchers. Marks the Bitcoin halvings
from `/datasets/halvings.txt` and shows inflation-adjusted ATHs.
`daily_cpi_inflation.csv` is the denominator for everything on the page.

### `/satsukashii` — BIG MAC INDEX

How many satoshis a Big Mac costs over time. Dual-axis D3 chart: the Big Mac price in
USD on the left (linear, drawn with `curveStepAfter` because the price only moves in
discrete steps) and the cost in satoshis on the right (**log scale**, since it has
fallen by orders of magnitude). Source is `/datasets/satsukashii/prices.json`, derived
from The Economist's official Big Mac Index dataset. The standalone Go service in
`../satsukashii/` is what generates that JSON.

### `/how-much-i-fucked-up` — HOW MUCH I FUCKED UP

The regret calculator: "if I had put $X into BTC on date Y, what would I have today?"
Reads the historical Bitcoin CSV for the entry price and hits CoinGecko's
`simple/price` for the current one, caching that response in **IndexedDB** (an
`apiCache` store) to stay under the rate limit. Shows how much BTC the money would have
bought, what it is worth now, and the multiple. The only tool that mixes local history
with a live quote.

## Local Development

Using Bun (recommended):
```bash
bun install
bun run dev
```

Or with npm:
```bash
npm install
npm run dev
```

## Build

```bash
bun run build
bun run preview  # preview production build
```

## Updating Data

Datasets are updated via scripts in `scripts/`:

```bash
# Update all datasets (CPI, metals, crypto prices)
bash scripts/update.sh

# Recompute satsukashii prices
bun run scripts/compute-satsukashii.ts

# Or do both + rebuild
bash update-and-rebuild.sh

# With deploy
bash update-and-rebuild.sh --deploy
```

### Prerequisites for data updates

- Docker (for CPI and metals updaters)
- Python 3.12+
- Bun (recommended) or Node.js 20+

## Deploy to VPS

### First-time setup

1. Copy `nginx.conf.example` to your nginx sites-available
2. Set environment variables:

```bash
export SSH_KEY_PATH=~/.ssh/id_rsa
export VPS_USER=deploy
export VPS_HOST=your-server.com
export VPS_PATH=/var/www/btc-things
```

3. Build and deploy:

```bash
bun run build
bash deploy.sh
```

### Using Docker for builds

With Node:
```bash
docker build -f Dockerfile.build -o type=local,dest=./dist .
```

With Bun:
```bash
docker build -f Dockerfile.bun -o type=local,dest=./dist .
```

### Daily auto-updates via cron

```bash
bash cron.sh install
```

This runs daily at 6 AM UTC: updates datasets, rebuilds site, and deploys.

## Architecture

- **Astro 5** static site generator, `output: "static"` — `bun run build` emits plain
  HTML into `dist/`. There is no server runtime; `dist/` is what nginx serves.
- **No UI framework.** Astro ships zero framework JS; each page carries its own vanilla
  script, either inlined with `is:inline` or served from `public/scripts/`.
- **D3.js v7** (CDN) for the `/debase` and `/satsukashii` charts.
- **IndexedDB** (via `idb`) for CSV and API caching on the heavier pages;
  `localStorage` for the ticker and the theme preference.
- **`public/datasets/`** holds every CSV and JSON the pages read at runtime.
- **Python** (Docker) for the data fetching scripts.
- **Nginx** for serving.

The standalone folders in the parent directory (`all_the_money_in_the_world/`,
`SemMelhores/`, `debase/`, `dca_btc_brutalist/`, `satsukashii/`) are the original
prototypes; this Astro site is their consolidation.
