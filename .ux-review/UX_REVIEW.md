# UX_REVIEW — BTC_THINGS

Mode `fix` · standard `custom:DESIGN.md` · visitor mode `Operate` · refinement.
8 screens, 21 states, 50 captures, 7 independent reviewers, 2 machine passes.

## Verdict: **Block** — 5 P0 findings verified in-browser.

## Coverage and gaps

| | |
|---|---|
| Captured | 8 screens × {default, light, no-js} × {390×844, 1440×1000}, plus `api-down` for sem-melhores = 50 shots |
| Determinism | clock frozen `2026-09-06T12:00:00Z`, CoinGecko stubbed with fixed payloads, `Math.random` pinned, storage cleared, animations killed, UTC/en-US |
| Machine | `check-wiring` 0 findings · `detect-ui` 0 errors 0 warnings 28 advisories · axe-core wcag2a/aa/21/22 over 32 screen×theme×viewport |
| **Gap 1** | The panel was dispatched before `audits/a11y.json` finished writing. The **accessibility** and **layout** reviewers could not read it and derived their own measurements instead. Their findings stand; the machine cross-check they were meant to build on did not happen. My error. |
| **Gap 2** | Two reviewers reported the `skill` tool was unavailable in their environment and applied their domain principles by name rather than loading the skill file. |
| **Gap 3** | No viewport between 390px and 1440px was captured. Source shows Nav collapses at 768px while four tool pages hold their desktop form until 600px — the 600–768px band is unverified. |
| **Gap 4** | Hover, focus, active, modal-open and admin states were never captured. Findings about them are source-verified only. |
| **Gap 5** | 200% text and 320px reflow were not exercised. |

## Capture artifact — not a defect

The ticker strip renders empty in all 50 shots. The harness disables animation for determinism and `.ticker__track` carries `padding-left: 100%`, so its content sits outside the viewport. Every reviewer was told to ignore it.

## Machine finding overturned

axe reported `/debase` axis titles at `#000000` on `#0a0a0a` = **1.06:1** in light — 9+ nodes, which reads as P0. Re-probing at 1500ms returns `rgb(255,255,255)` for all 11 rotated titles. The titles are black only while the charts are being built. Filed P3, evidence in `audits/debase-contrast-investigation.md`. The raw axe output would have shipped a false P0.

## P0 — verified in-browser

| # | Finding | Evidence | Corroboration |
|---|---|---|---|
| 1 | `/debase` chart legends are **white text on white** in the light theme. `--chart-ink` never flips by design, but D3 draws the legend at y=1479 while the dark panel ends at 1474 — outside the canvas. The only colour→asset mapping across 11 charts disappears. | probe: `fill=rgb(255,255,255)` both themes; `legendaDentroDoPainel=false` | colors |
| 2 | `/satsukashii` axis labels render at **4.15px**. D3 writes `font-size` as an inline style that outranks the media query, and the SVG scales 0.377× at 390px. | probe: declared 11px × 0.377 = 4.15px | typography |
| 3 | `/sem-melhores` table and subtitle render at **7.8px** on mobile: `0.65rem` against a root stepped down to 12px. | probe: `root=12px`, `.subtitle=7.8px` | typography, layout |
| 4 | The ticker has **no pause mechanism** (WCAG 2.2.2 A). `:focus-within` can never fire — 0 focusable elements inside the ticker. `prefers-reduced-motion` only covers users who set the OS flag. | probe: `focaveisDentroDoTicker=0` | accessibility |
| 5 | **No skip link** (WCAG 2.4.1 A). First tab stop is THEME, then the logo, then 6 nav links — 10 controls before content, on every page. | probe: `temSkipLink=false` | accessibility |

## P0 — source-verified, not exercised in a browser

`/all-the-money` blocks are non-focusable `<div>`s with hover-only tooltips (2.1.1, 1.4.13) · its `<select id="sortBy">` has no accessible name (axe `select-name`, critical, 4 entries) · `/sem-melhores` modal has no dialog role, focus move, trap or restore (2.1.1, 4.1.2) · `/sem-melhores` search has no label and its placeholder is `#666` = 3.66:1 (3.3.2, 1.4.3) · `/debase` has one heading for ~18,000px (1.3.1 F2) · no chart carries `role="img"` or a name (1.1.1) · the `[CG_API]` badge and both calculators' results update with no live region (4.1.3) · the `[JS_DISABLED]` banner promises "prerendered data" on four pages that prerender nothing · `/all-the-money` asserts `0 BLOCKS` and four `-` tiles with JS off.

## Highest-leverage single fixes

| Fix | Closes | Effort |
|---|---|---|
| `.container { width: 100% }` | Two different leading edges on all 8 screens; home recovers a grid column (2×323 → 3×357) | S |
| Delete the 480px root-font step, soften 768px to 15px, `input { font-size: max(16px, 1em) }` | `/sem-melhores` 7.8px text, iOS focus-zoom on 3 pages, `--text-micro` at 8.25px, several sub-24px targets | S |
| `--chart-legend-ink` that flips per theme | P0 #1 across 11 charts | S |
| `viewBox` on the debase SVGs + delete the `32px !important` mobile bump | P0 mobile clipping/overlap on 8 charts | M |
| Route `sem-melhores` change colours through `--status-*` | 4.0:1 red in light + gold meaning "gain" | S |

## Conflicts resolved

- **Typography wants a `viewBox` on `/debase`; UI notes it changes desktop stroke weights.** Accessibility wins: the charts are unreadable at 390px today. Flagged for a visual check after.
- **UI proposes replacing emoji controls with bracketed terminal labels; accessibility only asks for `aria-hidden` on the emoji.** Took the narrower a11y fix now — the emoji swap is a brand decision, filed P2.
- **Typography proposes binding `--text-body` to `body`.** Deferred: it changes density on every page and DESIGN.md's own §3 has never matched the code. Needs a product call.

## Dropped

11 findings were dropped for failing the contract: 4 with no reproducible evidence, 3 restating a machine result without adding a location, 2 that named the confirmed brutalist identity (zero radius, hard borders) as a defect, and 2 speculating about behaviour no capture could show. The last two were re-filed as QUESTIONS.

## What must not break

Global `:focus-visible` (2px accent, 2px offset) · `aria-current="page"` with trailing-slash normalisation · the token layer's measured-ratio comments · prerendered defaults on `/dca` and `/how-much-i-fucked-up` · the 404 · `tabular-nums` and the right-aligned `/sem-melhores` columns · no web fonts · `color-scheme` per theme · viewport meta without `maximum-scale` · text selectable everywhere.

---

# Results — after the fix pass

Groups A–D of `FIX_PLAN.md` applied. Build passes, `biome` clean, `check-wiring` 0,
`detect-ui` 0 errors.

## Machine deltas

| | before | after |
|---|---|---|
| axe `color-contrast` | 12 entries, all light theme | **1** (the transient `/debase` axis title, filed P3) |
| axe `select-name` | 4 entries, critical | **0** |
| axe `label` | — | **0** (16 introduced by my own nav fix, then closed) |
| axe `scrollable-region-focusable` | — | **0** (2 introduced by my own table wrapper, then closed) |
| horizontal overflow | 0 | **0** |
| interactive targets < 24px | 23 unique | **4** (inline prose links) |
| `detect-ui` warnings | 14 | **0** |

## Measured, per finding

| finding | before | after | status |
|---|---|---|---|
| `.container` two leading edges | 1200 / 742px | 1200 / 1200px | fixed |
| home grid columns | 2 × 323px | 3 × 357px | fixed |
| `/debase` legend, light theme | `#ffffff` on white | `#000000` on white | fixed |
| `/satsukashii` axis labels | 4.15px | 10.38px | fixed |
| `/sem-melhores` subtitle, mobile | 7.8px | 12.75px | fixed |
| `/sem-melhores` input, mobile | 14px (iOS zoom) | 16px | fixed |
| `/dca` numeric columns | `text-align: left` | `right` | fixed |
| `/debase` text outside viewport, mobile | 75 elements | 3 | partially fixed |
| mobile nav without JS | 0 reachable links | 6 | fixed |
| skip link | absent | present | fixed |
| ticker pause | `:focus-within` on 0 focusable elements | real button, `aria-pressed` | fixed |
| `/hmifu` two prices for one date | $7,202.62 vs $7,213.92 | both $7,213.92 | fixed |
| `[JS_DISABLED]` banner | claimed prerendered data on 4 pages that have none | per-page copy | fixed |
| tool-card description, light | 3.41:1 | `--fg-secondary`, 9.74:1 | fixed |
| `.ticker__loading`, light | 4.16:1 | `--fg-muted` #5f5f5f | fixed |
| `/hmifu` result values, light | 4.47:1 | `--accent-btc` #9c5800 | fixed |
| `/sem-melhores` change colours | `--accent-gold` / `#ff0000` (4.0:1) | `--status-positive` / `--status-negative` | fixed |
| footer `GITHUB` | `https://github.com` | the project repository | fixed |

## Regressions I introduced and closed in the same pass

1. **`label` × 16.** The CSS-only nav disclosure replaced a `<button>` with a
   `<label>`; a label is not focusable, so the real keyboard control became the
   hidden checkbox — which had no accessible name. `role="button"` and
   `aria-expanded` on the label were theatre. Moved to the checkbox.
2. **6px horizontal overflow on `/dca` mobile.** Caused by fix A2 (root font
   12px → 15px), which pushed the 5-column table past 390px. I blamed the ticker
   and restructured it twice before testing the hypothesis; removing the ticker
   from the DOM left `scrollWidth` unchanged and settled it in one command.
   Fixed with a scroll context on the table.
3. **`scrollable-region-focusable` × 2.** That scroll wrapper was not reachable
   by keyboard. Added `tabindex="0"`, `role="region"` and a label.

## Page heights grew

39 of 50 captures got taller, mobile most of all — `/debase` mobile +2325px,
`/dca` mobile +1626px. That is the intended cost of fix A2: the root font no
longer shrinks to 12px, so everything renders at a legible size instead of
fitting by scaling the page down. `/debase` desktop also grew +1165px from the
`viewBox` change, which is worth a visual check.

## Still open

Every P0 verified in a browser is fixed. These remain, filed with locations and
fixes in `FIX_PLAN.md`:

- `/all-the-money`: 25,218 non-focusable `<div>` blocks with hover-only tooltips;
  107,382px mobile height; `is:global` leaks; the SHA-256 colour palette.
- `/sem-melhores`: the modal has no dialog role, focus trap or restore.
- `/debase`: one heading for ~18,000px; six bare CSS colour names in the chart
  configs (`blue` 2.30:1, `purple` 2.10:1 against the canvas).
- No chart carries `role="img"` or a name.
- Five `<h1>`s wrapped in external links, three of them same-tab.
- The entire copy layer the content reviewer wrote — none applied.

## Not verified

Hover, focus, active, modal-open and admin states were never captured. 200% text
and 320px reflow were not exercised. No viewport between 390px and 1440px was
tested. Screen-reader announcement behaviour was not confirmed with a real AT.


---

# Second pass — after the SPA and identity work

Re-ran the full pipeline on the current build: 50 deterministic captures,
axe over 32 screen x theme x viewport combinations, wiring and source detectors.

| | first pass (before) | after fixes | this pass |
|---|---|---|---|
| axe `color-contrast` | 12 | 1 | **1** |
| axe `select-name` | 4 | 0 | **0** |
| horizontal overflow | 0 | 0 | **0** |
| targets < 24px | 23 | 4 | **4** |
| `detect-ui` warnings | 14 | 0 | **0** |
| wiring errors | 1 | 0 | **0** |

The single remaining axe entry is the `/debase` axis title measured mid-render,
investigated and filed as P3 in `audits/debase-contrast-investigation.md`. The
four small targets are inline prose links ("Learn more" x2, the Visual Capitalist
credit, and the `/sem-melhores` heading link) — all filed, none introduced here.

## Fixed in this pass

- `/satsukashii` chart labels rendered at 11px on desktop and 10.4px on mobile.
  The declared value was 11px/28px but the SVG scales by its viewBox, so the
  declared number is not the rendered one. Now 13px/33px, measured at 13px and
  12.2px. This was my own regression from the previous pass, where I set the
  declared value without measuring the result.
- `[CG_API: ONLINE]` renamed to `[PRICES: LIVE | STORED | UNAVAILABLE]`. The old
  label named the API and its state, which is implementation detail; a visitor
  needs to know whether the prices on screen are live.

## Client-side routing, verified independently

`<ClientRouter />` with the ticker under `transition:persist`. Measured on a
five-navigation tour, not taken on report:

| assertion | measured |
|---|---|
| document loads across 5 navigations | **1** |
| `window` marker survives navigation | yes |
| ticker is the same DOM node | yes |
| ticker animation `currentTime` | 683ms -> 7783ms, advancing |
| CoinGecko requests from the ticker | 2, on first load only |
| `/debase` `svg path` after navigation | 77 |
| console errors | 0 |

Two claims in the subagent's report were checked and hold: the third CoinGecko
request in my own tour is `/sem-melhores` fetching its own coin list, not a
ticker refetch, and the console errors I first counted were the pre-existing
`stlouisfed` CORS noise.

## Known risk carried, not hidden

The ticker's CSS animation genuinely restarts when the router swaps `<body>`;
what exists is a `currentTime` restore on `astro:after-swap`. It measures as
continuous and reads as continuous, but it is a workaround, and a future change
that gives the track more than one animation would break the
`getAnimations()[0]` assumption. Module-level state now lives for the whole
session, so a stale-state bug that a full reload used to hide would now persist.

---

# Third pass — final audit, under the real base path

Re-ran the whole pipeline against a build served the way GitHub Pages serves it:
`astro.config.mjs` now sets `base: "/btc-hub"`, so `dist/` was copied to
`/tmp/audit-serve/btc-hub/` and served from `/tmp/audit-serve`. Unknown paths
fall back to `btc-hub/404.html` with a real 404, which is what Pages does.

**The harness was broken by the base path and had to be fixed first.** Both
`capture.mjs` and `audit.mjs` built their targets with `new URL(route, BASE)`.
`new URL("/dca/", "http://host/btc-hub")` resolves to `http://host/dca/` — the
prefix is discarded, because an absolute path replaces it. Every request would
have 404'd or, worse, hit the unprefixed root and been measured as a real page.
Both files now concatenate instead, and default `BASE_URL` to
`http://127.0.0.1:8140/btc-hub`.

Verified the fix before trusting a 62-shot run: `/` renders 1240 chars and 76
nodes, `/debase/` 8899 chars and 1221 nodes, `/all-the-money/` 3275 chars and
26062 nodes, all with 2–3 stylesheets and 118–159 live CSS rules and a painted
`rgb(0,0,0)` body. That is a styled page, not an unstyled shell.

## Coverage

10 screens × {default, light, no-js} × {390×844, 1440×1000}, plus `api-down` for
`sem-melhores` = **62 captures** (was 50 — `/halving`, `/rainbow` and `/big-mac`
are now in the catalogue, and `/satsukashii` is a redirect stub). axe ran over
10 screens × 2 themes × 2 viewports = **40 combinations** (was 32).

## Machine deltas

Counts are axe *entries* — one per screen×theme×viewport that reports the rule —
on the same basis as the earlier passes.

| metric | pass 1 before | pass 1 after | pass 2 | **pass 3 (this)** |
|---|---|---|---|---|
| axe `color-contrast` | 12 | 1 | 1 | **4** |
| axe `scrollable-region-focusable` | 0 | 2 → 0 | 0 | **2** |
| axe `select-name` | 4 | 0 | 0 | **0** |
| axe `label` | 0 | 16 → 0 | 0 | **0** |
| any other axe rule | — | 0 | 0 | **0** |
| horizontal overflow (px, any screen×theme×viewport) | 0 | 0 | 0 | **0** |
| unique interactive targets < 24px | 23 | 4 | 4 | **28** |
| `detect-ui` errors | 0 | 0 | 0 | **0** |
| `detect-ui` warnings | 14 | 0 | 0 | **2** |
| `detect-ui` advisories | 28 | 28 | 28 | **31** |
| `check-wiring` errors (source) | 1 | 0 | 0 | **0** |
| screens audited | 8 | 8 | 8 | **10** |

The three counts that moved up are all on `/halving`, `/rainbow` and
`/big-mac` — screens no previous pass ever measured. **This is not a
like-for-like comparison**, and the growth is not a regression on the eight
screens that were already covered: on those eight, every number is unchanged.

### Acceptance against the spec

- horizontal overflow 0 on all 40 combinations — **pass**
- wiring 0 errors — **pass** (see the scanner note below)
- detector 0 errors — **pass**
- axe "no new violations" — **fail**. Two new real violations on `/rainbow`,
  both filed below with a named breaking state.

## Wiring: 0 real errors, 119 reported

`check-wiring.mjs --json .` reports 119 `broken-link` P0 errors. **All 119 are
in `dist-halvingbs/`**, a gitignored build directory left behind by a parallel
worker (`.gitignore` has `dist-*/`). The scanner's skip list matches the exact
name `dist`, so `dist-halvingbs` and `dist-charts` are walked as if they were
source. It then reads built HTML like `href="/btc-hub/halving"` and, knowing
nothing about the base path, decides `/btc-hub/halving` is an undeclared route.

`dist-halvingbs/halving/index.html`, `.../rainbow/index.html` and
`.../big-mac/index.html` all exist on disk. Scoped to real source,
`check-wiring.mjs --json src public` returns `{"total": 0, "errors": 0,
"warnings": 0, "advisories": 0}`. Advisory, not a defect: either delete the
stale `dist-*` directories or teach the scanner the base path.

## New findings — each with the state that breaks it

### R1 · `/rainbow` verdict colour is unreadable in the light theme · P0 · WCAG 1.4.3

`rainbow.astro:160` renders the verdict as
`<span style={"color: " + fit.todayBand.color}>`, taking the colour straight from
the band palette in `src/utils/rainbow.ts:27`. Those nine colours were chosen to
sit on the chart's fixed dark canvas (`#0a0a0a`). Here they are used as prose on
the page background, which in the light theme is `#ffffff`.

Measured in-browser, light theme, both viewports: `color: rgb(63,191,95)` on
`rgb(255,255,255)` = **2.38:1**. Dark theme is fine at 8.83:1.

The breaking input is *which band today's price falls in* — axe caught one
because only one band is live at a time:

| band | hex | on `#fff` (light) | on `#000` (dark) |
|---|---|---|---|
| Basically a fire sale | `#1f4fd8` | 6.63:1 | **3.17:1** |
| Buy | `#1f8fd8` | **3.51:1** | 5.98:1 |
| Accumulate | `#1fbfae` | **2.30:1** | 9.12:1 |
| Still cheap *(live now)* | `#3fbf5f` | **2.38:1** | 8.83:1 |
| Hold | `#a8c72c` | **1.93:1** | 10.87:1 |
| Is this a bubble? | `#e0c020` | **1.79:1** | 11.73:1 |
| FOMO intensifies | `#e88b1c` | **2.58:1** | 8.14:1 |
| Sell, seriously | `#e0501c` | **3.94:1** | 5.33:1 |
| Maximum bubble territory | `#c81f1f` | 5.72:1 | **3.67:1** |

**7 of 9 bands fail 4.5:1 in light; 2 of 9 fail in dark.** A price move is enough
to trigger it. Fix: route the verdict word through a theme-aware token pair
rather than reusing the on-canvas chart palette, or carry the band colour as a
swatch next to text that keeps a token colour.

### R2 · `/rainbow` band labels all render white, destroying the colour legend · P0 · WCAG 1.4.1

`rainbow.astro:194` sets `fill={band.color}` on each `<text class="band-label">`,
but `rainbow.astro:129` declares `.rainbow text { fill: var(--chart-ink) }`. A
CSS declaration outranks an SVG presentation attribute, so the CSS wins. Measured
on all nine labels:

```
Basically a fire sale     attr #1f4fd8 -> computed rgb(255,255,255)
Buy                       attr #1f8fd8 -> computed rgb(255,255,255)
Accumulate                attr #1fbfae -> computed rgb(255,255,255)
Still cheap               attr #3fbf5f -> computed rgb(255,255,255)
Hold                      attr #a8c72c -> computed rgb(255,255,255)
Is this a bubble?         attr #e0c020 -> computed rgb(255,255,255)
FOMO intensifies          attr #e88b1c -> computed rgb(255,255,255)
Sell, seriously           attr #e0501c -> computed rgb(255,255,255)
Maximum bubble territory  attr #c81f1f -> computed rgb(255,255,255)
```

Nine bands, nine identical white labels. The only mapping from a coloured band to
its meaning is gone, in both themes, at every viewport — the same failure as
pass 1's P0 #1 on the `/debase` legend, recurring on a page that had never been
audited. Fix: `.rainbow text:not(.band-label)` on the `--chart-ink` rule, or move
the band colour to a CSS custom property the label rule consumes.

### R3 · `/rainbow` chart is a keyboard-inaccessible scroll region on mobile · Serious · WCAG 2.1.1

axe `scrollable-region-focusable`, `.rainbow`, mobile, **both themes**. Measured
at 390px: `scrollWidth 640`, `clientWidth 356`, `overflow-x: auto`, `tabIndex -1`,
no `role`, no `aria-label`, **0 focusable descendants**. The container scrolls
284px of chart that a keyboard user cannot reach. At 1440px `scrollWidth ===
clientWidth`, so it does not fire — the breaking state is any viewport narrower
than the `min-width: 640px` on `.rainbow svg` (`rainbow.astro:125`).

This is the identical defect pass 1 introduced on the `/dca` table wrapper and
closed with `tabindex="0"` + `role="region"` + a label. The same three attributes
fix it here.

### R4 · `/rainbow` chart text renders at 7.33px on mobile · P1 · WCAG 1.4.4 (quality floor)

`detect-ui` flags `font-size: 11px` at `rainbow.astro:131` and `:135` as below the
12px floor. The rendered size is worse than the declared one, because the SVG is
scaled by its `viewBox`:

| viewport | svg width | viewBox width | scale | declared | **rendered** |
|---|---|---|---|---|---|
| 390px | 640 | 960 | 0.667 | 11px | **7.33px** |
| 1440px | 920 | 960 | 0.958 | 11px | **10.54px** |

Both the 15 axis ticks and the 9 band labels are affected. This is exactly the
`/satsukashii` trap from pass 2 — the declared number is not the rendered number
whenever a `viewBox` scales the SVG — recurring on `/rainbow`. Any fix must be
measured after the change, not read off the stylesheet.

### R5 · The `source-link` paragraphs are sub-24px targets, and the 2.5.8 exception does not cover them · P2 · WCAG 2.5.8

Five links, one per tool page, measured 15–18px tall:

| screen | text | desktop | mobile |
|---|---|---|---|
| `debase` | View the DEBASE source on GitHub | 307×18 | 288×17 |
| `sem-melhores` | View the Sem Melhores source on GitHub | 365×18 | 342×17 |
| `big-mac` | View the satsukashii source on GitHub | 355×18 | 333×17 |
| `how-much-i-fucked-up` | View the BTC_THINGS source on GitHub | 346×18 | 324×17 |
| `all-the-money` | View the All The Money In The World source… | 499×18 | — |
| `all-the-money` | See also: Visual Capitalist – All the Money… | 733×15 | — |

Earlier passes logged these as "inline prose links" and left them, on the
strength of WCAG 2.5.8's inline exception. That was wrong. The markup is
`<p class="source-link"><a …>…</a></p>` (`debase.astro:156` and the equivalent
line on each page) — the link is the *entire* content of its paragraph, not a
target inside a sentence, so the exception does not apply. Correcting the record:
these are 2.5.8 AA failures, not advisories. Fix is a padding bump on
`.source-link a` to reach 24px.

## Not a defect — re-confirmed, not re-filed

`.claude/FALSE_POSITIVES.md` rules that axe's `color-contrast` on the rotated
SVG axis titles is the tool reading the inherited CSS `color` instead of the
effective `fill`. I re-probed it independently rather than taking it on report,
at 1500 / 3000 / 6000 ms, light theme, 1440px:

```
/debase/   n=10  color rgb(0,0,0)  fill rgb(255,255,255)  behind rgb(10,10,10)
/halving/  n=1   color rgb(0,0,0)  fill rgb(247,147,26)   behind rgb(10,10,10)
```

Stable at all three probe times. `#ffffff` on `#0a0a0a` = 19.80:1;
`#f7931a` on `#0a0a0a` = 7.80:1. Both pass. The mechanism is exactly as the
file describes — `color` is black, `fill` is not, axe reads `color`.

One correction to that file, which does not change its conclusion: it states all
the flagged titles resolve to white. `/halving`'s single title resolves to
Bitcoin orange `#f7931a`, not white. It still passes comfortably.

So of the 4 `color-contrast` entries: **2 are this known false positive**
(`debase/light/desktop`, `halving/light/desktop`) and **2 are R1**, which is real.

## Capture failures — 10, all pre-existing console noise

The run reports 10 failures, every one of them the console-error assertion, none
a render failure. All 62 shots passed the "did it actually render" check.

- 4 × `all-the-money` `ERR_NAME_NOT_RESOLVED` — the 13 dead cross-origin calls in
  `public/scripts/all-the-money/script.js` already recorded in `FIX_PLAN.md`.
  (Under the old harness these surfaced as CORS errors; sandboxed DNS turns the
  same requests into name-resolution failures. Same requests, different message.)
- 4 × `not-found` — the page 404s, which is the point of the test.
- 2 × `sem-melhores__api-down` — the deliberately aborted CoinGecko request.

## What I did NOT verify

Stated plainly, because a green pipeline is not the same as an accessible site.

**Never exercised by any pass, this one included:**

- **No screen reader has ever been used against this site.** Every accessibility
  claim in this document rests on axe-core, on Chromium's accessibility tree, or
  on scripted keyboard traces. None of those is a person using VoiceOver, NVDA or
  JAWS. The `role="img"` names added to the charts are unheard.
- **200% text zoom (WCAG 1.4.4) and 320px reflow (1.4.10).** The harness captures
  390px and 1440px only. Given R4 — where a `viewBox` made 11px render as 7.33px —
  the zoom behaviour of every SVG on this site is genuinely unknown.
- **Hover, focus, active and open-menu states.** Never captured. The global
  `:focus-visible` ring is asserted from CSS, never photographed. R3 was found by
  axe, not by watching a focus ring move.
- **`/all-the-money` comparison mode and the data-sources panel.** Button-toggled,
  no URL, so no capture has ever seen the page's main analytical feature.
- **`/sem-melhores` admin mode.** Reached by typing a secret phrase into the
  search field; reachable but not addressable.
- **The `/dca` and `/how-much-i-fucked-up` error paths.** The four native
  `alert()` calls on `/dca` still fire only on invalid input and no capture drives
  them. `alert()` remains the error channel.
- **Any viewport between 390px and 1440px.** Nav collapses at 768px while four
  tool pages hold their desktop form until 600px; the 600–768px band is unmeasured.
- **`prefers-reduced-motion`, forced-colors and high-contrast modes.** The harness
  pins `reducedMotion: "no-preference"` and kills animation for determinism, which
  is the opposite of testing the motion preference.
- **The ticker.** It renders empty in all 62 shots — animation is disabled and
  `.ticker__track` carries `padding-left: 100%`, so its content sits outside the
  viewport. That is a harness artifact, and it means the ticker's rendered
  appearance is unverified in every capture ever taken here. Its 568px/1631px
  `overWideElements` entries are the same artifact, not overflow: document
  `scrollWidth - clientWidth` is 0 on all 40 combinations.
- **Cognitive load, reading level and copy.** The entire copy layer the content
  reviewer wrote is still unapplied, and no pass has assessed plain language or
  error recovery.

**Verified only as source, not in a browser, this pass:** the `/dca` axis-label
`y="60"`/`y="150"` mismatch and the dead `API_KEY` functions in
`all-the-money/script.js`, both carried forward from `FIX_PLAN.md`.

## Documents updated

- `.ux-review/harness/capture.mjs`, `.ux-review/harness/audit.mjs` — base-path-safe
  URL joining, `BASE_URL` defaulting to the prefixed origin.
- `.ux-review/ui-catalog.yaml` — added the `light` state that every screen has and
  the catalogue never listed, the `/satsukashii` redirect stub as an uncaptured
  screen, and the `base: /btc-hub` prefix.
- `.ux-review/SCREEN_INVENTORY.md` — already current at 10 screens; no change needed.
- `.ux-review/UNRESOLVED_SCREENS.md` — every gap it records is still open and is
  restated above.
