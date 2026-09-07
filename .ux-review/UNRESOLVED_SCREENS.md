# Unresolved screens and states

| item | why unresolved | risk |
|---|---|---|
| `sem-melhores` / admin | Reached by typing a secret phrase into the search input (`script.ts`), not by a route. Reachable but not addressable, so it cannot be captured deterministically from a URL. | Low. Not a user-facing path, and it edits a blacklist rather than anything destructive. |
| `all-the-money` / comparison mode and data-sources panel | Both are toggled by a button and have no URL. Capturable only by scripting the click, which the harness does not currently do. | Low for the sources panel. Higher for comparison mode: it is the page's main analytical feature and no capture has ever looked at it. |
| `/dca` and `/how-much-i-fucked-up` / error paths | The four `alert()` calls on `/dca` and the error element on `/how-much-i-fucked-up` only fire on invalid input. No capture drives them. | Medium. `/dca` still uses native `alert()`, which the audit flagged and nothing has fixed. |
| Any page at 200% text or 320px width | Never exercised. The harness captures 390px and 1440px only. | Medium. WCAG 1.4.10 reflow and 1.4.4 resize are unverified across the whole site. |
| Every hover, focus, active and open-menu state | Never captured. Findings about them in `UX_REVIEW.md` are source-verified only. | Medium. Focus styling in particular is asserted from CSS, not from a rendered focus ring. |

## Resolved since the first pass

- `sem-melhores` / rate-limited or offline no longer renders a bare shell. The
  served HTML carries a placeholder, and on failure the page falls back to a
  fixed sample with `#dataNotice` explaining that these are not real prices.
  Measured with the CoinGecko request aborted.

## Discovery misses

None. The `pages/` glob matches all 11 route files (10 real screens plus the
`/satsukashii` redirect stub), and the wiring check reports no route referenced
from the link graph that the router does not declare.

## Not verified by any pass

No screen reader has ever been used against this site. Every accessibility claim
in `UX_REVIEW.md` rests on axe-core, on Chromium's accessibility tree, or on
scripted keyboard traces — none of which is the same as a person using VoiceOver
or NVDA.
