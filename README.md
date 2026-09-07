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

### `/big-mac` — BIG MAC INDEX

How many satoshis a Big Mac costs over time. Dual-axis D3 chart: the Big Mac price in
USD on the left (linear, drawn with `curveStepAfter` because the price only moves in
discrete steps) and the cost in satoshis on the right (**log scale**, since it has
fallen by orders of magnitude). Source is `/datasets/satsukashii/prices.json`, derived
from The Economist's official Big Mac Index dataset by `scripts/compute-satsukashii.ts`,
which pairs each Big Mac USD price with that day's bitcoin close.

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

`bash scripts/update.sh` is the single entry point. It refreshes every dataset that
*can* be refreshed automatically, then prints a summary table and fails loudly if
anything came back stale.

```bash
bash scripts/update.sh                 # fetch everything, summarise, enforce freshness
bash scripts/update.sh --summary-only  # read-only: print the table, touch nothing
bash scripts/update.sh --no-fail-stale # report staleness without a non-zero exit
bash scripts/update.sh --max-age-days 7  # tighten the gate for every dataset

bash update-and-rebuild.sh             # update + rebuild the site
bash update-and-rebuild.sh --deploy    # update + rebuild + deploy
```

Exit codes: `0` clean, `1` an updater failed, `2` a dataset is stale or missing,
`3` both.

### What updates what

Every updater is TypeScript and runs under Bun (or `npx tsx` as a fallback). There is
no Python and no Docker in the update path any more.

| Dataset | Updated by | Used by |
| --- | --- | --- |
| `CPI_U.csv` | `update-cpi.ts` (BLS API) | `/debase` |
| `daily_cpi_inflation.csv` | `update-cpi.ts`, which calls `generate-daily-cpi.ts` to interpolate the monthly CPI into a daily series | `/debase` |
| `gold.csv`, `silver.csv` | `update-metals.ts` (Yahoo Finance) | `/debase`, `/dca` |
| `bitcoin_*.csv`, `ethereum_*.csv`, `monero_*.csv` | `update-crypto.ts` (Kraken OHLC) | `/debase`, `/dca`, `/rainbow`, `/how-much-i-fucked-up` |
| `satsukashii/big-mac-source-data-v2.csv` | `update-bigmac.ts` (The Economist's published Big Mac Index) | source for the next row |
| `satsukashii/prices.json` | `compute-satsukashii.ts`, derived from the Big Mac CSV plus the bitcoin CSV | `/satsukashii` |

`update.sh` runs the four fetchers in parallel and then runs `compute-satsukashii.ts`
serially, because the derived JSON needs both of its inputs to have landed first.

### What is NOT automated

#### Refreshing `all-the-money/data.json`

Those figures come from annual reports, not APIs, so the refresh is a web search
with a script guarding the write:

```bash
node scripts/update-all-the-money.mjs --dry-run              # lists every live figure + a search query
node scripts/update-all-the-money.mjs --apply f.json --dry-run   # preview what would change
node scripts/update-all-the-money.mjs --apply f.json          # write
node scripts/update-all-the-money.mjs --fix-endpoints         # null out broken API endpoints
```

`--apply` takes `[{id, valueBillions, lastUpdated, sourceUrl}]` and writes an item
**only** when `lastUpdated` is strictly newer than what is stored. When no newer
source exists the old value is kept untouched — that is the rule, not a fallback.


These are never touched by `scripts/update.sh`. The summary table still lists them, so
they stay visible, but they are exempt from the freshness gate.

| Dataset | Why | How to refresh |
| --- | --- | --- |
| `sem-melhores/blacklist.json` | Hand-curated judgement call — which coins count as stablecoins or staked derivatives. No upstream feed to pull. | Edit the JSON by hand. |
| `all-the-money/data.json` | Curated aggregate of global wealth figures with hand-written `excludeFromTotal` rules; sources are reports, not APIs. | `bun run scripts/update-all-the-money.mjs`, then review the diff by hand. |
| `M2SL.csv` | One-off FRED export; nothing in the repo fetches it. | Re-download the M2SL series from FRED. |
| `halvings.txt` | Static — the halving schedule is fixed by the protocol. | Never. |

### The freshness gate

After the fetch, `update.sh` reads the newest date out of each dataset (the max date
column for the CSVs, `biggest_date` / `metadata.lastUpdated` for the JSONs) and fails
if an automated dataset is older than its allowed window. The default is 30 days;
per-dataset windows account for the upstream release cadence — crypto and metals are
held to a few days, monthly CPI to 45, and the Big Mac index publishes only twice a
year. This exists because a silently failing updater used to look exactly like a
successful run.

### Prerequisites for data updates

- Bun (recommended) or Node.js 20+ with `npx tsx`
- Network access (BLS, Yahoo Finance, Kraken, The Economist's GitHub)

## Deploy to GitHub Pages

Live URL: **https://afa7789.github.io/btc-hub/**

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds with bun and
publishes `dist/` through `actions/deploy-pages`. Nothing is committed to a
`gh-pages` branch.

### The base path — read this before changing any URL

The site is a *project* Pages site, so it is served from `/btc-hub/`, not from
the root of the domain. `astro.config.mjs` therefore sets `base: "/btc-hub"`,
and **every absolute path in the codebase has to be prefixed with it**. A single
missed path is a 404 in production and a chart that never draws.

The prefix comes from two places, depending on whether the file passes through
the bundler:

| Where the code lives | How to build a URL |
| --- | --- |
| `.astro`, `.ts` (bundled) | `withBase("/datasets/gold.csv")` from `src/utils/base.ts` |
| `public/scripts/*.js` (served literally) | `window.__BASE__` / `window.withBase(...)`, published by `BaseLayout.astro` in `<head>` |

`public/` files never see `import.meta.env.BASE_URL` — they are copied byte for
byte into `dist/`. That is why `BaseLayout.astro` writes the prefix onto
`window` before any page script runs.

`src/components/Nav.astro` runs the same idea backwards: `stripBase()` removes
the prefix from `Astro.url.pathname` before comparing it with the hrefs in
`src/data/routes.ts`, otherwise the active nav item goes dead in production and
only in production.

### Verifying the base path locally

`bun run preview` already serves under `/btc-hub/`, but the closest reproduction
of the real deploy is to stage the build under the prefix by hand:

```bash
bun run build
rm -rf dist-pages && mkdir -p dist-pages && cp -R dist dist-pages/btc-hub
python3 -m http.server 8110 --directory dist-pages
# then open http://127.0.0.1:8110/btc-hub/
```

Walk every route with the devtools network tab open. **Zero 404 responses** is
the acceptance criterion — that is the number that catches a forgotten dataset
path.

### `.nojekyll`

`public/.nojekyll` is copied to `dist/.nojekyll` on every build. Without it,
GitHub Pages runs the artifact through Jekyll, which silently drops directories
whose name starts with an underscore — and `build.assets` is `_assets/`, so the
whole site would load without CSS or JS.

### What the repository owner still has to do by hand

The workflow cannot turn Pages on for the repository; that is a settings change
only the owner can make. Once, before the first deploy:

1. Push this branch to `main` on `github.com/afa7789/btc-hub`.
2. Open **https://github.com/afa7789/btc-hub/settings/pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**
   (not "Deploy from a branch"). Nothing to save — it applies immediately.
4. If the repository is private, Pages needs GitHub Pro or the repository has to
   be public; otherwise the deploy job fails with a permissions error.
5. Go to the **Actions** tab and confirm the `Deploy to GitHub Pages` run is
   green. The deploy job prints the final URL.

Nothing else is required — no DNS, no `CNAME` file, no personal access token.
Later pushes to `main` deploy on their own.

## Deploy to VPS

> **The base path applies here too.** `astro.config.mjs` sets `base: "/btc-hub"`
> for GitHub Pages, so the built site expects to live under `/btc-hub/` on any
> host. To serve it from the root of a domain instead, either set `base: "/"`
> before building, or have nginx serve `dist/` at the `/btc-hub/` location. The
> nav's active state and every dataset fetch follow the configured base, so the
> two cannot disagree.

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
- **D3.js v7** (CDN) for the `/debase`, `/halving` and `/big-mac` charts.
- **IndexedDB** (via `idb`) for CSV and API caching on the heavier pages;
  `localStorage` for the ticker and the theme preference.
- **`public/datasets/`** holds every CSV and JSON the pages read at runtime.
- **TypeScript scripts** in `scripts/`, run with Bun, for all data fetching.
- **Nginx** for serving.

The standalone folders in the parent directory (`all_the_money_in_the_world/`,
`SemMelhores/`, `debase/`, `dca_btc_brutalist/`, `satsukashii/`) are the original
prototypes; this Astro site is their consolidation.
