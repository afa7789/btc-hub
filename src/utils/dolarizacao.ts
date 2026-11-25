/**
 * Calculo do /dolarizacao, num lugar so.
 *
 * O build importa este modulo para prerenderizar o cenario padrao, e o script
 * da pagina importa o MESMO modulo para recalcular quando o formulario muda.
 * /dca e /how-much-i-fucked-up mantem duas copias da conta (prerender.ts e o
 * script de public/) e ja divergiram uma vez; aqui nao ha segunda copia para
 * divergir. Por isso nada de node:fs aqui dentro: quem le arquivo e o chamador.
 *
 * O metodo e o da Planilha de Dolarizacao do Era de Ouro (Gabriel Duarte):
 * meta como % do patrimonio, primeira compra agora, o resto em compras
 * mensais, e o dinheiro que espera rendendo CDI, com os juros do mes somados
 * a compra do mes.
 */

export interface BrlDay {
  /** aaaa-mm-dd */
  date: string;
  /** R$ por US$, PTAX venda (SGS 1) */
  ptax: number;
  /** CDI do dia, em % ao dia (SGS 12) */
  cdi: number;
}

export type Asset = "usd" | "btc";
export type Closes = Map<string, number>;

export function parseBrl(text: string): BrlDay[] {
  const out: BrlDay[] = [];
  for (const line of text.split("\n").slice(1)) {
    const [date, ptax, cdi] = line.split(",");
    if (date) out.push({ date, ptax: Number(ptax), cdi: Number(cdi) });
  }
  return out;
}

/** CSV cripto do site (Start,End,Open,High,Low,Close,...): Start -> Close. */
export function parseCloses(text: string): Closes {
  const out: Closes = new Map();
  for (const line of text.split("\n").slice(1)) {
    const cols = line.split(",");
    const close = Number(cols[5]);
    if (cols[0] && close > 0) out.set(cols[0], close);
  }
  return out;
}

/** CDI diario (% ao dia) para % ao ano, na convencao de 252 dias uteis. */
export const cdiYearPct = (cdiDailyPct: number): number =>
  ((1 + cdiDailyPct / 100) ** 252 - 1) * 100;

// ---------------------------------------------------------------------------
// Planejador: a planilha dele, para frente
// ---------------------------------------------------------------------------

export interface PlanInput {
  wealthBrl: number;
  usdHeld: number;
  /** Cambio de referencia, fixo durante o plano, como na planilha. */
  rate: number;
  targetPct: number;
  months: number;
  firstBrl: number;
  cdiYearPct: number;
  irPct: number;
  /** IOF + spread, em % sobre cada compra. */
  costPct: number;
}

export interface PlanRow {
  n: number;
  plannedBrl: number;
  interestBrl: number;
  totalBrl: number;
  usd: number;
  usdAcc: number;
}

export interface Plan {
  goalBrl: number;
  haveBrl: number;
  missingBrl: number;
  monthlyBrl: number;
  rows: PlanRow[];
  usdEnd: number;
  /** Juros que sobraram depois de a meta ser atingida. */
  leftoverBrl: number;
}

export function plan(i: PlanInput): Plan {
  const goalBrl = (i.wealthBrl + i.usdHeld * i.rate) * (i.targetPct / 100);
  const haveBrl = i.usdHeld * i.rate;
  const missingBrl = Math.max(0, goalBrl - haveBrl);
  const first = Math.min(missingBrl, i.firstBrl);
  const monthlyBrl = i.months > 1 ? (missingBrl - first) / (i.months - 1) : 0;
  const monthlyRate =
    ((1 + i.cdiYearPct / 100) ** (1 / 12) - 1) * (1 - i.irPct / 100);
  const fx = i.rate * (1 + i.costPct / 100);

  // Como na planilha: a soma das compras para na meta, entao os juros
  // antecipam o fim em vez de passar dela. O que sobra fica em reais.
  let reserved = missingBrl - first;
  let bought = first;
  let usdAcc = i.usdHeld + first / fx;
  const rows: PlanRow[] = [
    {
      n: 1,
      plannedBrl: first,
      interestBrl: 0,
      totalBrl: first,
      usd: first / fx,
      usdAcc,
    },
  ];
  for (let n = 2; n <= i.months; n++) {
    const interestBrl = reserved * monthlyRate;
    const totalBrl = Math.min(missingBrl - bought, monthlyBrl + interestBrl);
    reserved += interestBrl - totalBrl;
    bought += totalBrl;
    usdAcc += totalBrl / fx;
    rows.push({
      n,
      plannedBrl: monthlyBrl,
      interestBrl,
      totalBrl,
      usd: totalBrl / fx,
      usdAcc,
    });
  }
  return {
    goalBrl,
    haveBrl,
    missingBrl,
    monthlyBrl,
    rows,
    usdEnd: usdAcc,
    leftoverBrl: Math.max(0, reserved),
  };
}

// ---------------------------------------------------------------------------
// Backtest: o mesmo metodo contra o cambio e o CDI que de fato aconteceram
// ---------------------------------------------------------------------------

export interface BacktestInput {
  capitalBrl: number;
  /** aaaa-mm-dd; a primeira compra e no primeiro dia util a partir dela. */
  start: string;
  months: number;
  asset: Asset;
  costPct: number;
  irPct: number;
  /** Rendimento anual do dolar comprado (T-bill, por exemplo). So vale para usd. */
  usdYieldPct: number;
}

export interface Holding {
  brl: number;
  usd: number;
}

export interface Backtest {
  start: string;
  /** Dia da avaliacao: um mes depois da ultima compra. */
  end: string;
  lump: Holding;
  gradual: Holding;
  cdi: Holding;
}

/**
 * Indices dos dias de compra (o primeiro dia util >= start e o primeiro dia
 * util de cada mes seguinte) mais o dia da avaliacao no fim. null quando a
 * janela passa do fim dos dados.
 */
export function scheduleIdx(
  days: BrlDay[],
  start: string,
  months: number,
): number[] | null {
  const i0 = days.findIndex((d) => d.date >= start);
  if (i0 < 0) return null;
  const idx = [i0];
  let [y, m] = days[i0].date.split("-").map(Number);
  let j = i0;
  for (let k = 1; k <= months; k++) {
    m = (m % 12) + 1;
    if (m === 1) y += 1;
    const key = `${y}-${String(m).padStart(2, "0")}-01`;
    while (j < days.length && days[j].date < key) j++;
    if (j >= days.length) return null;
    idx.push(j);
  }
  return idx;
}

/** Preco de uma unidade do destino em reais naquele dia. */
function unitBrl(day: BrlDay, asset: Asset, btc: Closes | null): number | null {
  if (asset === "usd") return day.ptax;
  const px = btc?.get(day.date);
  return px ? px * day.ptax : null;
}

/**
 * Tres estrategias com o mesmo capital, avaliadas no mesmo dia e na mesma
 * moeda: tudo de uma vez no primeiro dia, aos poucos com o resto no CDI, e
 * nunca converter. O IR do CDI e aplicado dia a dia sobre o rendimento, uma
 * aproximacao do IR cobrado no resgate.
 */
export function backtest(
  days: BrlDay[],
  btc: Closes | null,
  i: BacktestInput,
): Backtest | null {
  const idx = scheduleIdx(days, i.start, i.months);
  if (!idx) return null;
  const endI = idx[idx.length - 1];
  const buyDays = new Set(idx.slice(0, -1));
  const keep = 1 / (1 + i.costPct / 100);
  const grow = i.asset === "usd" ? (1 + i.usdYieldPct / 100) ** (1 / 252) : 1;
  let cash = i.capitalBrl;
  let cdi = i.capitalBrl;
  let lump = 0;
  let gradual = 0;
  let lotsLeft = i.months;
  for (let j = idx[0]; j < endI; j++) {
    const px = unitBrl(days[j], i.asset, btc);
    if (px === null) return null;
    if (j === idx[0]) lump = (i.capitalBrl * keep) / px;
    if (buyDays.has(j)) {
      const lot = cash / lotsLeft;
      gradual += (lot * keep) / px;
      cash -= lot;
      lotsLeft -= 1;
    }
    const r = (days[j].cdi / 100) * (1 - i.irPct / 100);
    cash *= 1 + r;
    cdi *= 1 + r;
    lump *= grow;
    gradual *= grow;
  }
  const endPx = unitBrl(days[endI], i.asset, btc);
  if (endPx === null) return null;
  const ptax = days[endI].ptax;
  const hold = (brl: number): Holding => ({ brl, usd: brl / ptax });
  return {
    start: days[idx[0]].date,
    end: days[endI].date,
    lump: hold(lump * endPx),
    gradual: hold(gradual * endPx + cash),
    cdi: hold(cdi),
  };
}

export interface WindowResult {
  start: string;
  /** aos poucos / tudo de uma vez - 1 */
  edge: number;
  cdiWon: boolean;
}

/** O mesmo backtest comecando no primeiro dia util de cada mes da serie. */
export function allWindows(
  days: BrlDay[],
  btc: Closes | null,
  base: Omit<BacktestInput, "start">,
): WindowResult[] {
  const out: WindowResult[] = [];
  let month = "";
  for (const day of days) {
    if (day.date.slice(0, 7) === month) continue;
    month = day.date.slice(0, 7);
    const bt = backtest(days, btc, { ...base, start: day.date });
    if (!bt) continue;
    out.push({
      start: bt.start,
      edge: bt.gradual.brl / bt.lump.brl - 1,
      cdiWon: bt.cdi.brl > Math.max(bt.lump.brl, bt.gradual.brl),
    });
  }
  return out;
}

export interface Summary {
  windows: number;
  gradualWins: number;
  cdiWins: number;
  median: number;
  worst: WindowResult;
  best: WindowResult;
}

export function summarize(rows: WindowResult[]): Summary | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.edge - b.edge);
  return {
    windows: rows.length,
    gradualWins: rows.filter((r) => r.edge > 0).length,
    cdiWins: rows.filter((r) => r.cdiWon).length,
    median: sorted[Math.floor(sorted.length / 2)].edge,
    worst: sorted[0],
    best: sorted[sorted.length - 1],
  };
}

/**
 * O inicio da janela completa mais recente: o default honesto, sem escolher
 * data a dedo. Parte de `months` meses antes do ultimo dado e recua enquanto a
 * avaliacao cairia depois do fim da serie.
 */
export function lastCompleteStart(days: BrlDay[], months: number): string {
  let [y, m] = days[days.length - 1].date.split("-").map(Number);
  m -= months;
  for (;;) {
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    if (scheduleIdx(days, start, months)) return start;
    m -= 1;
  }
}

// ---------------------------------------------------------------------------
// Formatacao e saida, compartilhadas pelo template e pelo script
// ---------------------------------------------------------------------------

const brlFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const usdFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const pctFmt = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

export const fmt = {
  brl: (n: number) => brlFmt.format(n),
  usd: (n: number) => usdFmt.format(n),
  pct: (n: number) => pctFmt.format(n),
  date: (iso: string) => iso.split("-").reverse().join("/"),
};

export function planCells(p: Plan): string[][] {
  return p.rows.map((r) => [
    String(r.n),
    fmt.brl(r.plannedBrl),
    fmt.brl(r.interestBrl),
    fmt.brl(r.totalBrl),
    fmt.usd(r.usd),
    fmt.usd(r.usdAcc),
  ]);
}

export function resultCells(bt: Backtest): string[][] {
  const vs = (h: Holding) => fmt.pct(h.brl / bt.lump.brl - 1);
  return [
    ["Tudo de uma vez", fmt.brl(bt.lump.brl), fmt.usd(bt.lump.usd), "—"],
    [
      "Aos poucos, resto no CDI",
      fmt.brl(bt.gradual.brl),
      fmt.usd(bt.gradual.usd),
      vs(bt.gradual),
    ],
    ["Ficar no CDI", fmt.brl(bt.cdi.brl), fmt.usd(bt.cdi.usd), vs(bt.cdi)],
  ];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * Linhas de tabela como HTML. O template injeta com set:html e o script com
 * innerHTML, entao as duas saidas sao a mesma marcacao — inclusive sem o
 * atributo de escopo do Astro, e por isso o estilo das celulas e :global().
 */
export function rowsHtml(cells: string[][]): string {
  return cells
    .map(
      (row) =>
        `<tr>${row.map((c, k) => (k === 0 ? `<th scope="row">${esc(c)}</th>` : `<td class="num">${esc(c)}</td>`)).join("")}</tr>`,
    )
    .join("");
}

export function planSummary(p: Plan): [string, string][] {
  return [
    ["Meta em dólar", fmt.brl(p.goalBrl)],
    ["Já está em dólar", fmt.brl(p.haveBrl)],
    ["Falta comprar", fmt.brl(p.missingBrl)],
    ["Compra mensal-base", fmt.brl(p.monthlyBrl)],
    ["Dólares no fim", fmt.usd(p.usdEnd)],
    ["Juros que sobram em reais", fmt.brl(p.leftoverBrl)],
  ];
}

export function dlHtml(pairs: [string, string][]): string {
  return pairs
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("");
}

/** O resumo das janelas em frases, igual no build e no navegador. */
export function windowsText(s: Summary, months: number, asset: Asset): string {
  const dest = asset === "usd" ? "dólar" : "bitcoin";
  const share = (n: number) => fmt.pct(n / s.windows).replace("+", "");
  return [
    `${s.windows} janelas de ${months} meses comprando ${dest}, uma para cada mês de início.`,
    `Aos poucos rendeu mais que tudo de uma vez em ${s.gradualWins} (${share(s.gradualWins)}); a diferença mediana foi ${fmt.pct(s.median)}.`,
    `Melhor caso: ${fmt.pct(s.best.edge)}, começando em ${fmt.date(s.best.start)}. Pior: ${fmt.pct(s.worst.edge)}, começando em ${fmt.date(s.worst.start)}.`,
    `Ficar no CDI rendeu mais que as duas em ${s.cdiWins} (${share(s.cdiWins)}).`,
  ].join(" ");
}

/**
 * Uma barra por janela: acima de zero, aos poucos rendeu mais que tudo de uma
 * vez; abaixo, rendeu menos. String SVG porque o template (set:html) e o
 * script (innerHTML) desenham com a mesma funcao.
 */
export function edgeChartSvg(rows: WindowResult[], label: string): string {
  const W = 720;
  const H = 240;
  const top = 12;
  const bottom = 28;
  const left = 44;
  const plotH = H - top - bottom;
  const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.edge)));
  const y = (v: number) => top + plotH / 2 - (v / max) * (plotH / 2);
  const bw = (W - left) / Math.max(rows.length, 1);
  const bars = rows.map((r, k) => {
    const y0 = Math.min(y(r.edge), y(0));
    const h = Math.max(0.5, Math.abs(y(r.edge) - y(0)));
    const cls = r.edge >= 0 ? "bar-pos" : "bar-neg";
    return `<rect class="${cls}" x="${(left + k * bw).toFixed(2)}" y="${y0.toFixed(2)}" width="${Math.max(bw - 0.4, 0.6).toFixed(2)}" height="${h.toFixed(2)}"/>`;
  });
  const years = rows
    .map((r, k) => ({
      year: r.start.slice(0, 4),
      k,
      jan: r.start.slice(5, 7) === "01",
    }))
    .filter((t) => t.jan && Number(t.year) % 2 === 0)
    .map(
      (t) =>
        `<text class="tick" x="${(left + t.k * bw).toFixed(1)}" y="${H - 8}">${t.year}</text>`,
    );
  const yTicks = [max, 0, -max].map(
    (v) =>
      `<text class="tick" x="${left - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmt.pct(v))}</text>`,
  );
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><line class="zero" x1="${left}" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>${bars.join("")}${years.join("")}${yTicks.join("")}</svg>`;
}

export function chartLabel(s: Summary, months: number, asset: Asset): string {
  const dest = asset === "usd" ? "dólar" : "bitcoin";
  return [
    `Gráfico de barras: ${s.windows} janelas de ${months} meses comprando ${dest}, uma por mês de início.`,
    `Aos poucos rendeu mais que tudo de uma vez em ${s.gradualWins} delas.`,
    `Melhor caso ${fmt.pct(s.best.edge)} começando em ${fmt.date(s.best.start)}; pior ${fmt.pct(s.worst.edge)} começando em ${fmt.date(s.worst.start)}.`,
  ].join(" ");
}
