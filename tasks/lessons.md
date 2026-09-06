# Lessons Learned

This file tracks lessons learned during the BTC_Things project.

## Phase 1: Scaffold + Design System

- **2026-04-02**: Project initialized with Astro 5.x, Biome for linting/formatting
- **2026-04-02**: DCA Brutalist design language successfully extracted to global.css
- **2026-04-02**: Theme toggle implemented with localStorage persistence
## Porting D3 tools into Astro

- **2026-08-30**: Astro `<style>` blocks are scoped by a `data-astro-cid-*` attribute
  stamped at build time. Nodes that D3 creates at runtime never get that attribute, so
  every rule targeting them (`svg text`, `.tick line`, `.grid line`, ...) is silently
  dead. This left DEBASE with default black 10px axis text and a white data line on a
  white page. Fix: address runtime nodes with `:global()`, anchored under a markup
  element that does carry the scope (`article :global(svg text)`).
- **2026-08-30**: `chart_draw.js` treats `container.clientHeight > 0` as "the container
  has a height". `clientHeight` includes padding, so adding vertical padding to an empty
  chart container made it report 20px and produced `<rect height="-110">`. Chart
  containers must keep vertical padding at 0.
- **2026-08-30**: The DEBASE charts paint their Y-axis label outside the SVG box
  (`overflow: visible`). The dark ground therefore belongs on the container div, not on
  the `<svg>` — otherwise the white label lands on the page background and disappears.
- **2026-08-30**: `new Date('2010-07-17')` parses as UTC midnight, so
  `toLocaleDateString` in a negative-offset timezone renders the previous day. Parse
  date-only strings as `new Date(s + 'T00:00:00')`.
- **2026-08-30**: Scripts loaded with `<script is:inline src="/scripts/...">` are served
  from `public/`. Keeping a second copy under `src/scripts/` means edits land in a file
  that never ships. Keep one copy only.
- **2026-08-30**: SemMelhores silently degrades. When the CoinGecko call fails
  (the free tier rate-limits, and a 429 arrives without CORS headers, so it looks like
  a network error) and localStorage is empty, it renders `loadExampleData()` — four
  hardcoded coins at stale prices, with the header relabelled "TOP 4 MOEDAS". It looked
  exactly like a real but short top 100. Inherited from the original site. Now: one
  delayed retry before giving up, and a visible `#dataNotice` banner whenever the table
  is not live data.
- **2026-09-06**: A Astro scoped selector beats an unscoped utility class. `th, td` in a
  page's `<style>` compiles to `th[data-astro-cid-…]` — specificity (0,1,1) — which wins
  over a global `.num` at (0,1,0). Adding the class to the markup changed nothing and I
  reported it as done without measuring. Verify a utility class took effect by reading
  the computed style, not by reading the diff.
- **2026-09-06**: D3 writes `font-size` with `.style()`, which is an inline style and
  outranks any stylesheet rule, including a media query. Raising the CSS value from 9px
  to 12px was dead code; with the SVG scaled 0.377× at 390px the label still rendered at
  4.15px. Delete the inline write and let CSS own the size, then measure the rendered
  size, not the declared one.
- **2026-09-06**: `:focus-within` cannot fire on a container with no focusable children.
  The ticker's pause-on-focus rule was decoration — WCAG 2.2.2 needs a real control, and
  `prefers-reduced-motion` only covers users who set the OS flag.
- **2026-09-06**: The fixed dark chart canvas (`--chart-bg`/`--chart-ink`, deliberately
  absent from the light theme) is correct for text drawn *inside* the panel and wrong for
  everything D3 draws outside it. The legend sits ~5px below the panel, so it needs
  `--chart-legend-ink`, which flips with the theme. This is the same hazard the
  2026-08-30 entry above already recorded for the Y-axis label; I reintroduced it.
- **2026-09-06**: `padding` does not shrink on a flex item, so a marquee built on
  `padding-left: 100%` inflates its flex line. But that was not the source of the 6px
  overflow I blamed it for — removing the element from the DOM left `scrollWidth`
  unchanged. Falsify the hypothesis before editing; the real cause was the transactions
  table after the mobile root font went from 12px back to 15px.
- **2026-09-06**: Marking a migration "done" in DESIGN.md after converting only the
  page CSS left six bare CSS colour names live in the chart configs (`blue` 2.30:1,
  `purple` 2.10:1 against the canvas). A status table that overstates progress is how a
  finding survives: nobody re-checks a row marked done.
