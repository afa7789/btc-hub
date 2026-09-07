/**
 * The one place the tool list is declared.
 *
 * It used to live hardcoded in three files — the nav, the hub grid and the 404
 * recovery list. Adding a route meant editing all three, and missing one gives
 * you a tool that is in the nav but not the hub (invisible to anyone entering
 * at `/`), or in the hub but not the nav (unreachable from inside any tool).
 * The casing had already drifted before this module existed.
 */
export type ToolGroup = "chart" | "tool";

export interface Tool {
  href: string;
  /**
   * Which nav row the item belongs to. "chart" renders on the second row, the
   * rest on the first — the split is content, not layout, so it lives here and
   * not in Nav.astro.
   */
  group: ToolGroup;
  /** Used verbatim in the nav, the hub card, the 404 list and the page title. */
  label: string;
  description: string;
  status: string;
}

export const tools: Tool[] = [
  {
    href: "/sem-melhores",
    group: "tool",
    label: "SEM MELHORES",
    description: "Top 100 cryptocurrency browser powered by CoinGecko API",
    status: "LIVE",
  },
  {
    href: "/all-the-money",
    group: "tool",
    label: "ALL THE MONEY IN THE WORLD",
    description:
      "Global wealth block visualization - see all the money in the world",
    status: "LIVE",
  },
  {
    href: "/dca",
    group: "tool",
    label: "DCA CALCULATOR",
    description:
      "Dollar Cost Averaging calculator with Bitcoin historical data",
    status: "LIVE",
  },
  {
    href: "/debase",
    group: "chart",
    label: "DEBASE",
    description: "Inflation-adjusted asset charts with D3.js visualizations",
    status: "LIVE",
  },
  {
    href: "/halving",
    group: "chart",
    label: "HALVING",
    description:
      "Bitcoin halvings against the price, with the 500-day window around each one",
    status: "LIVE",
  },
  {
    href: "/rainbow",
    group: "chart",
    label: "RAINBOW",
    description:
      "Bitcoin against a log regression fitted to our own data, with bands at multiples of the residual",
    status: "LIVE",
  },
  {
    href: "/big-mac",
    group: "chart",
    label: "BIG MAC INDEX",
    description: "Big Mac Index vs Bitcoin price history comparison",
    status: "LIVE",
  },
  {
    href: "/how-much-i-fucked-up",
    group: "tool",
    label: "HOW MUCH I FUCKED UP",
    description:
      '"What if I invested X on date Y?" calculator with historical data',
    status: "LIVE",
  },
];
