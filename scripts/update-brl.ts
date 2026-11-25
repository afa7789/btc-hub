/**
 * Baixa do Banco Central (SGS) as duas series diarias que o /dolarizacao usa:
 *   - serie 1:  PTAX venda, R$ por US$
 *   - serie 12: CDI diario, em % ao dia
 * e grava public/datasets/brl.csv como `Date,PTAX,CDI`, data ISO, mais antiga
 * primeiro.
 *
 * Comeca em 1999-01-04, o primeiro dia util do cambio flutuante. Antes disso o
 * real andava em banda cambial, e uma simulacao de "comprar dolar aos poucos"
 * num cambio administrado mede a politica do BC, nao o mercado.
 *
 * A API recusa janelas diarias acima de 10 anos, entao o periodo e pedido em
 * blocos. O arquivo so e sobrescrito depois de validado inteiro: um bloco que
 * voltou vazio ou um valor fora de faixa aborta sem tocar no CSV atual.
 *
 * Uso: bun run scripts/update-brl.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "..", "public", "datasets", "brl.csv");
const FIRST_YEAR = 1999;
const BLOCK_YEARS = 9;
const API = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

interface SgsPoint {
  data: string;
  valor: string;
}

/** dd/mm/aaaa -> aaaa-mm-dd */
const isoDate = (br: string): string => {
  const [d, m, y] = br.split("/");
  return `${y}-${m}-${d}`;
};

async function fetchBlock(
  series: number,
  from: string,
  to: string,
): Promise<SgsPoint[]> {
  const url = `${API}.${series}/dados?formato=json&dataInicial=${from}&dataFinal=${to}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok)
    throw new Error(`SGS ${series} ${from}..${to}: HTTP ${res.status}`);
  const body = (await res.json()) as SgsPoint[];
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error(`SGS ${series} ${from}..${to}: resposta vazia`);
  }
  return body;
}

async function fetchSeries(series: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const lastYear = new Date().getUTCFullYear();
  for (let y = FIRST_YEAR; y <= lastYear; y += BLOCK_YEARS + 1) {
    const end = Math.min(y + BLOCK_YEARS, lastYear);
    const block = await fetchBlock(series, `01/01/${y}`, `31/12/${end}`);
    for (const p of block) out.set(isoDate(p.data), Number(p.valor));
  }
  return out;
}

/** Faixas largas de proposito: pegam lixo (zero, virgula decimal, unidade
 *  trocada), nao movimentos de mercado. */
function assertSane(date: string, ptax: number, cdi: number): void {
  if (!(ptax > 0.5 && ptax < 20))
    throw new Error(`PTAX fora de faixa em ${date}: ${ptax}`);
  if (!(cdi >= 0 && cdi < 0.5))
    throw new Error(`CDI fora de faixa em ${date}: ${cdi}`);
}

async function main(): Promise<void> {
  const [ptax, cdi] = await Promise.all([fetchSeries(1), fetchSeries(12)]);
  const dates = [...ptax.keys()].filter((d) => cdi.has(d)).sort();
  const rows = dates.map((d) => {
    const p = ptax.get(d) as number;
    const c = cdi.get(d) as number;
    assertSane(d, p, c);
    return `${d},${p},${c}`;
  });
  if (rows.length < 6000)
    throw new Error(`so ${rows.length} dias em comum: incompleto`);
  writeFileSync(OUT, `Date,PTAX,CDI\n${rows.join("\n")}\n`, "utf-8");
  console.log(
    `brl.csv: ${rows.length} dias, ${dates[0]} .. ${dates[dates.length - 1]}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
