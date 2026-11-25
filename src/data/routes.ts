/**
 * The one place the tool list is declared.
 *
 * It used to live hardcoded in three files — the nav, the hub grid and the 404
 * recovery list. Adding a route meant editing all three, and missing one gives
 * you a tool that is in the nav but not the hub (invisible to anyone entering
 * at `/`), or in the hub but not the nav (unreachable from inside any tool).
 * The casing had already drifted before this module existed.
 */
export type ToolGroup = "chart" | "tool" | "guide";

export interface Tool {
  href: string;
  /**
   * Which nav row the item belongs to. "tool" renders on the first row, next
   * to the sibling sites; "chart" and "guide" share the second. The split is
   * content, not layout, so it lives here and not in Nav.astro.
   */
  group: ToolGroup;
  /** Used verbatim in the nav, the hub card, the 404 list and the page title. */
  label: string;
  description: string;
  /**
   * Where the numbers come from. Every card used to read "LIVE", which carries
   * no information when it never varies — and reads as a lie on the pages that
   * only ever plot a bundled dataset. "GUIDE" is the pages that plot nothing:
   * prose and commands, no series behind them.
   */
  status: "LIVE PRICES" | "DATASET" | "DATASET + LIVE" | "GUIDE";
}

/**
 * Sites irmaos: outro build, outro repositorio. Ficam FORA de `tools` de
 * proposito — o grid da home promete "clique e abre uma pagina deste site" e o
 * 404 lista so rotas deste build. O nav mostra no fim da linha de cima, com ↗.
 */
export interface Sibling {
  href: string;
  label: string;
}

export const siblings: Sibling[] = [
  { href: "https://afa7789.github.io/wallet-gen/", label: "WALLET-GEN" },
];

export const tools: Tool[] = [
  {
    href: "/sem-melhores",
    group: "tool",
    label: "SEM MELHORES",
    description: "Top 100 cryptocurrency browser powered by CoinGecko API",
    status: "LIVE PRICES",
  },
  {
    href: "/all-the-money",
    group: "tool",
    label: "ALL THE MONEY IN THE WORLD",
    description:
      "Global wealth block visualization - see all the money in the world",
    status: "DATASET",
  },
  {
    href: "/dca",
    group: "tool",
    label: "DCA CALCULATOR",
    description:
      "Dollar Cost Averaging calculator with Bitcoin historical data",
    status: "DATASET",
  },
  {
    href: "/dolarizacao",
    group: "tool",
    label: "DOLARIZAÇÃO",
    description:
      "Plan and backtest moving savings out of the Brazilian real in stages, on Central Bank FX and CDI data (in Portuguese)",
    status: "DATASET",
  },
  {
    href: "/debase",
    group: "chart",
    label: "DEBASE",
    description: "Inflation-adjusted asset charts with D3.js visualizations",
    status: "DATASET",
  },
  {
    href: "/halving",
    group: "chart",
    label: "HALVING",
    description:
      "Bitcoin halvings against the price, with the 500-day window around each one",
    status: "DATASET",
  },
  {
    href: "/rainbow",
    group: "chart",
    label: "RAINBOW",
    description:
      "Bitcoin against blockchaincenter.net's rainbow: nine bands on a power law through the cycle lows, projected to 2032",
    status: "DATASET",
  },
  {
    href: "/big-mac",
    group: "chart",
    label: "BIG MAC INDEX",
    description: "Big Mac Index vs Bitcoin price history comparison",
    status: "DATASET",
  },
  {
    href: "/how-much-i-fucked-up",
    group: "tool",
    label: "HOW MUCH I FUCKED UP",
    description:
      '"What if I invested X on date Y?" calculator with historical data',
    status: "DATASET + LIVE",
  },
  {
    href: "/bitcoin-core",
    group: "guide",
    label: "BITCOIN CORE",
    description:
      "Build Bitcoin Core from source and run a pruned node, with both wallet formats",
    status: "GUIDE",
  },
  {
    href: "/off-ramp",
    group: "guide",
    label: "OFF-RAMP",
    description:
      "Eric on off-ramping crypto without an exchange sale, plus where to spend, get paid and trade P2P",
    status: "GUIDE",
  },
];
