/**
 * "O mesmo dinheiro em outro lugar": um valor posto num dia, avaliado no
 * ultimo dia de cada serie. Usado pelo /stake e pelo /how-much-i-fucked-up, no
 * build e no navegador — por isso puro, sem node:fs.
 */
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

/** O primeiro dia da serie em ou depois de `date`. */
export const dayAt = (series: Day[], date: string): Day | undefined =>
  series.find((p) => p.date >= date);

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

/** `usd` posto em `from` num ativo, avaliado no ultimo dia da serie dele. */
export function held(usd: number, from: string, o: Others): Holding {
  const first = o.days[0];
  const start = first && first.date <= from ? dayAt(o.days, from) : undefined;
  const end = o.days[o.days.length - 1];
  return {
    label: o.label,
    note: o.note,
    value: start && end ? usd * (end.price / start.price) : null,
  };
}

/** Do maior para o menor; sem preco na data vai para o fim. */
export const ranked = (rows: Holding[]): Holding[] =>
  [...rows].sort((x, y) => (y.value ?? -1) - (x.value ?? -1));

/** O que a pagina manda para o navegador sobre cada serie. */
export interface Source {
  key: string;
  kind: "crypto" | "metal";
  label: string;
  note: string;
  url: string;
}

export interface Loaded extends Others {
  key: string;
}

/** Busca e le os mesmos CSVs que o build usou. */
export const loadSources = (sources: Source[]): Promise<Loaded[]> =>
  Promise.all(
    sources.map(async (s) => ({
      key: s.key,
      label: s.label,
      note: s.note,
      days: parseDays(await (await fetch(s.url)).text(), s.kind),
    })),
  );

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
