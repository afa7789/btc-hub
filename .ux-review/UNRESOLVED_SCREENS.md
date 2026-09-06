# Unresolved screens and states

| item | why unresolved | risk |
|---|---|---|
| `sem-melhores` / rate-limited or offline | The page depends entirely on the CoinGecko API and has **no code branch** for a failed fetch beyond `#dataNotice`. There is no empty, error or skeleton state to capture because none is implemented. | The screen renders an empty `#cryptoList` — a shell-only page. Captured as a state to prove it. |
| `sem-melhores` / admin | Reached by typing a secret phrase into the search input (`script.ts:636`), not by a route. Reachable but not addressable, so it cannot be captured deterministically from a URL. | Low. Not a user-facing path. |

## Discovery misses

None. The `pages/` glob matched all 8 routes; the wiring check found no route
referenced from the link graph that the router does not declare.
