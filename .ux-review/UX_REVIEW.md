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
