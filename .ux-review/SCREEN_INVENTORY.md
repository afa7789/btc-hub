# Screen inventory — BTC_THINGS

Generated 2026-09-06. Source of truth: `src/pages/*.astro` (Astro file-based
routing, `output: "static"`). Every screen below is a real built page in
`dist/`; there are no dynamic segments, no auth roles and no guards.

Coverage: **10 screens, 25 states, 2 unresolved.** See `UNRESOLVED_SCREENS.md`.

Every screen inherits three global states from `BaseLayout.astro`:
`theme=dark` (default), `theme=light`, and `no-js` (the `[JS_DISABLED]` banner
plus whatever the page prerendered).

| id | route | component | confidence | evidence | states |
|---|---|---|---|---|---|
| `home` | `/` | `index.astro` | high | `src/pages/index.astro:1` | default |
| `sem-melhores` | `/sem-melhores` | `sem-melhores.astro` | high | `src/pages/sem-melhores.astro:1` | loading, default, data-notice, modal-open, admin |
| `all-the-money` | `/all-the-money` | `all-the-money.astro` | high | `src/pages/all-the-money.astro:1` | default, loading, comparison-mode, data-sources-open |
| `dca` | `/dca` | `dca.astro` | high | `src/pages/dca.astro:1` | prerendered-default, recalculated |
| `debase` | `/debase` | `debase.astro` | high | `src/pages/debase.astro:1` | loading, default |
| `halving` | `/halving` | `halving.astro` | high | `src/pages/halving.astro:1` | loading, default; the dates and the past-halvings table are prerendered |
| `rainbow` | `/rainbow` | `rainbow.astro` | high | `src/pages/rainbow.astro:1` | default only — the chart is an inline SVG built at build time, so it has no loading state |
| `big-mac` | `/big-mac` | `big-mac.astro` | high | `src/pages/big-mac.astro:1` | loading, default; renamed from `/satsukashii`, which is now a redirect stub |
| `how-much-i-fucked-up` | `/how-much-i-fucked-up` | `how-much-i-fucked-up.astro` | high | `src/pages/how-much-i-fucked-up.astro:1` | prerendered-default, calculating, error, recalculated |
| `not-found` | `/404` | `404.astro` | high | `src/pages/404.astro:1` | default |

## State evidence

| screen | state | evidence |
|---|---|---|
| `sem-melhores` | loading | `script.ts:79` `loading: "Carregando..."` |
| `sem-melhores` | data-notice | `sem-melhores.astro:26` `#dataNotice[hidden]`; `script.ts:241` stale vs example copy |
| `sem-melhores` | modal-open | `sem-melhores.astro:30` `#coinModal` |
| `sem-melhores` | admin | `script.ts:636` `isAdminMode = true`, reached by typing a phrase into the search field |
| `all-the-money` | loading | `all-the-money.astro:542` `#loading.hidden` |
| `all-the-money` | comparison-mode | `all-the-money.astro:564` `#comparison-mode.hidden` |
| `all-the-money` | data-sources-open | `all-the-money.astro:561` `#data-sources.hidden` |
| `dca` | prerendered-default | `dca.astro` frontmatter `computeDca(DEFAULTS)` — results are in the HTML |
| `how-much-i-fucked-up` | calculating | `how-much-i-fucked-up.astro:205` `#loading` |
| `how-much-i-fucked-up` | error | `how-much-i-fucked-up.astro:206` `#error[style="display:none"]` |
| all | no-js | `src/components/NoScriptBanner.astro` |
| all | theme-light | `BaseLayout.astro` head script + `[data-theme="light"]` tokens |

## Notable absences (verified, not omissions)

- **No empty state anywhere.** Every tool ships with data: the CSVs are bundled,
  `/dca` and `/how-much-i-fucked-up` prerender a scenario, `/all-the-money` reads
  a static JSON. `sem-melhores` is the only network-only screen and it has no
  empty branch — see `UNRESOLVED_SCREENS.md`.
- **No auth, no roles, no guards.** `isAdminMode` is a client-side easter egg that
  reveals a blacklist editor; it protects nothing.
