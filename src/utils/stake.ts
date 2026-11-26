/**
 * SRS (rendimento fixo simulado) contra ETH em stake (rendimento + preco do
 * ETH), calculado a partir do CSV de preco do ether: no build para a pagina,
 * no navegador para o calculador. Sem node:fs aqui, por isso.
 *
 * Saiu do /debase, onde a comparacao era desenhada em runtime e o texto citava
 * numeros digitados de 2025. Aqui todo numero sai da serie: quando o CSV
 * avanca, a pagina acompanha.
 *
 * As duas taxas sao premissas fixas da simulacao, as mesmas do grafico
 * original. Nenhuma das duas e fixa na vida real.
 */
export const SRS_APY = 0.045;
export const ETH_STAKE_APY = 0.027;
/** Inicio do grafico original do /debase. */
export const CHART_START = "2023-07-01";

const DAY_MS = 86_400_000;
const days = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
const grow = (apy: number, d: number): number => (1 + apy) ** (d / 365);

export interface Day {
  date: string;
  price: number;
}

/**
 * Le um CSV de public/datasets. Cripto: Start,End,...,Close (coluna 5), e o
 * fechamento do dia D fica na linha que comeca em D. Metal: data,Close.
 * Puro (sem node:fs) porque o calculador roda no navegador com o mesmo codigo.
 */
export function parseDays(text: string, kind: "crypto" | "metal"): Day[] {
  const out: Day[] = [];
  for (const line of text.split("\n").slice(1)) {
    const cells = line.trim().split(",");
    const date = cells[0];
    const price = Number.parseFloat(cells[kind === "crypto" ? 5 : 1] ?? "");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && price > 0)
      out.push({ date, price });
  }
  return out.sort((x, y) => (x.date < y.date ? -1 : 1));
}

/** Valorizacao anual do ETH que empata as duas pernas so no rendimento. */
export const breakEven = (1 + SRS_APY) / (1 + ETH_STAKE_APY) - 1;

export interface Leg {
  from: string;
  to: string;
  srs: number;
  stake: number;
  /** Variacao do preco do ETH sozinha, sem o rendimento do stake. */
  eth: number;
}

/** Retorno de cada perna entre dois dias da serie, em dolar. */
export function leg(from: Day, to: Day): Leg {
  const d = days(from.date, to.date);
  return {
    from: from.date,
    to: to.date,
    srs: grow(SRS_APY, d) - 1,
    stake: (to.price / from.price) * grow(ETH_STAKE_APY, d) - 1,
    eth: to.price / from.price - 1,
  };
}

/** O primeiro dia da serie em ou depois de `date`. */
export const dayAt = (series: Day[], date: string): Day | undefined =>
  series.find((p) => p.date >= date);

const shiftYears = (iso: string, years: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + Math.round(years * 12));
  return d.toISOString().slice(0, 10);
};

export interface Trailing extends Leg {
  label: string;
}

/** Janelas que terminam no ultimo dia da serie. */
export function trailing(series: Day[]): Trailing[] {
  const last = series[series.length - 1];
  if (!last) return [];
  const spans: [string, string][] = [
    ["3 months", shiftYears(last.date, -0.25)],
    ["1 year", shiftYears(last.date, -1)],
    ["2 years", shiftYears(last.date, -2)],
    [`Since ${CHART_START.slice(0, 7)}`, CHART_START],
  ];
  return spans.flatMap(([label, start]) => {
    const from = dayAt(series, start);
    return from ? [{ label, ...leg(from, last) }] : [];
  });
}

export interface Rolling {
  start: string;
  /** stake - SRS, em pontos de retorno, para quem segurou `years` anos. */
  edge: number;
}

/** A mesma comparacao comecando no primeiro dia de cada mes da serie. */
export function rolling(series: Day[], years: number): Rolling[] {
  const last = series[series.length - 1];
  if (!last) return [];
  const starts = series.filter(
    (p, k) => k === 0 || p.date.slice(0, 7) !== series[k - 1]?.date.slice(0, 7),
  );
  return starts.flatMap((from) => {
    const end = shiftYears(from.date, years);
    const to = end <= last.date ? dayAt(series, end) : undefined;
    if (!to) return [];
    const l = leg(from, to);
    return [{ start: from.date, edge: l.stake - l.srs }];
  });
}

export interface Drawdown {
  peak: Day;
  low: Day;
  depth: number;
}

/** Maior queda do topo ao fundo da perna de stake a partir de `start`. */
export function worstDrawdown(series: Day[], start: string): Drawdown | null {
  const from = dayAt(series, start);
  if (!from) return null;
  let peak = { date: from.date, price: 1 };
  let worst: Drawdown | null = null;
  for (const p of series) {
    if (p.date < from.date) continue;
    const value = 1 + leg(from, p).stake;
    if (value > peak.price) peak = { date: p.date, price: value };
    const depth = value / peak.price - 1;
    if (!worst || depth < worst.depth)
      worst = { peak, low: { date: p.date, price: value }, depth };
  }
  return worst;
}

/**
 * As duas pernas partindo de 1,0 em `start`, como SVG. Eixo Y linear: o
 * grafico existe para mostrar a distancia entre as linhas, e em log a reta do
 * SRS some no chao.
 */
export function growthChartSvg(
  series: Day[],
  start: string,
  label: string,
): string {
  const from = dayAt(series, start);
  const pts = from ? series.filter((p) => p.date >= from.date) : [];
  if (!from || pts.length < 2) return "";
  const W = 720;
  const H = 300;
  const left = 44;
  const top = 12;
  const bottom = 28;
  const legs = pts.map((p) => leg(from, p));
  const max = Math.max(...legs.map((l) => 1 + Math.max(l.stake, l.srs)));
  const yMax = Math.ceil(max * 2) / 2;
  const x = (k: number) => left + (k / (pts.length - 1)) * (W - left - 4);
  const y = (v: number) => top + (1 - v / yMax) * (H - top - bottom);
  const path = (pick: (l: Leg) => number) =>
    legs
      .map(
        (l, k) =>
          `${k ? "L" : "M"}${x(k).toFixed(1)},${y(1 + pick(l)).toFixed(1)}`,
      )
      .join("");
  const yTicks = Array.from({ length: yMax * 2 + 1 }, (_u, k) => k / 2)
    .filter((v) => Number.isInteger(v) || yMax <= 2)
    .map(
      (v) =>
        `<line class="grid" x1="${left}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="tick" x="${left - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}x</text>`,
    );
  const years = pts
    .map((p, k) => ({ p, k }))
    .filter(({ p }) => p.date.slice(5) === "01-01")
    .map(
      ({ p, k }) =>
        `<text class="tick" x="${x(k).toFixed(1)}" y="${H - 8}" text-anchor="middle">${p.date.slice(0, 4)}</text>`,
    );
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${yTicks.join("")}${years.join("")}<path class="line-stake" d="${path((l) => l.stake)}"/><path class="line-srs" d="${path((l) => l.srs)}"/></svg>`;
}

/** Teto do grafico de barras: acima disso a barra e cortada. */
export const EDGE_CAP = 1;

/**
 * Uma barra por mes de inicio: stake - SRS. Cortado em +-EDGE_CAP porque 2016
 * e 2017 passam de +9.000% e achatavam todos os outros anos no zero.
 */
export function edgeBarsSvg(rows: Rolling[], label: string): string {
  const W = 720;
  const H = 240;
  const top = 12;
  const bottom = 28;
  const left = 52;
  const plotH = H - top - bottom;
  const clip = (v: number) => Math.max(-EDGE_CAP, Math.min(EDGE_CAP, v));
  const y = (v: number) => top + plotH / 2 - (v / EDGE_CAP) * (plotH / 2);
  const bw = (W - left) / Math.max(rows.length, 1);
  const bars = rows.map((r, k) => {
    const v = clip(r.edge);
    const y0 = Math.min(y(v), y(0));
    const h = Math.max(0.5, Math.abs(y(v) - y(0)));
    return `<rect class="${v >= 0 ? "bar-pos" : "bar-neg"}" x="${(left + k * bw).toFixed(2)}" y="${y0.toFixed(2)}" width="${Math.max(bw - 0.6, 0.6).toFixed(2)}" height="${h.toFixed(2)}"/>`;
  });
  const years = rows
    .map((r, k) => ({ r, k }))
    .filter(({ r }) => r.start.slice(5, 7) === "01")
    .filter(({ r }) => Number(r.start.slice(0, 4)) % 2 === 0)
    .map(
      ({ r, k }) =>
        `<text class="tick" x="${(left + k * bw).toFixed(1)}" y="${H - 8}">${r.start.slice(0, 4)}</text>`,
    );
  const yTicks = [EDGE_CAP, 0, -EDGE_CAP].map(
    (v) =>
      `<text class="tick" x="${left - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100)}%</text>`,
  );
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><line class="zero" x1="${left}" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>${bars.join("")}${years.join("")}${yTicks.join("")}</svg>`;
}

export interface Holding {
  label: string;
  note: string;
  /** null: o ativo nao tinha preco na data pedida. */
  value: number | null;
}

export interface Others {
  label: string;
  note: string;
  days: Day[];
}

/**
 * O mesmo dinheiro, posto no mesmo dia, em cada destino, avaliado no ultimo
 * dia de cada serie. A data vale a partir do primeiro dia do ETH.
 */
export function compare(
  usd: number,
  from: string,
  eth: Day[],
  others: Others[],
): Holding[] {
  const start = dayAt(eth, from);
  const end = eth[eth.length - 1];
  if (!start || !end || start.date === end.date) return [];
  const l = leg(start, end);
  const held = (o: Others): Holding => {
    const a =
      o.days[0] && o.days[0].date <= start.date
        ? dayAt(o.days, start.date)
        : undefined;
    const z = o.days[o.days.length - 1];
    return {
      label: o.label,
      note: o.note,
      value: a && z ? usd * (z.price / a.price) : null,
    };
  };
  return [
    {
      label: "SRS",
      note: `${(SRS_APY * 100).toFixed(1)}% a year, simulated`,
      value: usd * (1 + l.srs),
    },
    {
      label: "ETH staked",
      note: `ETH price + ${(ETH_STAKE_APY * 100).toFixed(1)}% a year, simulated`,
      value: usd * (1 + l.stake),
    },
    { label: "ETH held", note: "ETH price alone", value: usd * (1 + l.eth) },
    ...others.map(held),
  ].sort((x, y) => (y.value ?? -1) - (x.value ?? -1));
}

const money = (v: number): string =>
  v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: v >= 100 ? 0 : 2,
  });

const signedPct = (v: number): string => {
  const abs = Math.abs(v * 100);
  return `${v < 0 ? "−" : "+"}${abs.toLocaleString("en-US", { maximumFractionDigits: abs >= 100 ? 0 : 1 })}%`;
};

/** Linhas da tabela do calculador; o mesmo HTML no build e no navegador. */
export function holdingsHtml(rows: Holding[], usd: number): string {
  return rows
    .map((r) => {
      const cells =
        r.value === null
          ? `<td class="num">no price yet</td><td class="num">-</td>`
          : `<td class="num">${money(r.value)}</td><td class="num">${signedPct(r.value / usd - 1)}</td>`;
      return `<tr><th scope="row">${r.label}</th><td>${r.note}</td>${cells}</tr>`;
    })
    .join("");
}
