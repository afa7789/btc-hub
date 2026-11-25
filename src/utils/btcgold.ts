/**
 * Bitcoin cotado em ouro (oncas por BTC), ciclo a ciclo, calculado no build.
 *
 * O /debase ja desenha a serie (grafico D3 "Crypto Priced in Gold"); isto so
 * acrescenta o que o grafico nao diz em texto: o pico de cada ciclo de halving,
 * o fundo depois dele, e o quanto cada pico superou o anterior. Sai como HTML
 * prerenderizado, entao a tabela existe mesmo sem JavaScript.
 */
import { loadPrices } from "./prerender";

export interface Point {
  date: string;
  oz: number;
}

export function btcInGold(): Point[] {
  // "start": o fechamento do dia D fica na linha que comeca em D, o mesmo dia
  // do fechamento do ouro.
  const btc = loadPrices("bitcoin", "start");
  const gold = loadPrices("gold");
  const out: Point[] = [];
  for (const [date, g] of gold) {
    const b = btc.get(date);
    if (b && g > 0) out.push({ date, oz: b / g });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface Cycle {
  from: string;
  to: string | null;
  peak: Point;
  /** O menor valor depois do pico, dentro do mesmo ciclo. */
  low: Point;
}

const maxBy = (pts: Point[]) => pts.reduce((m, p) => (p.oz > m.oz ? p : m));
const minBy = (pts: Point[]) => pts.reduce((m, p) => (p.oz < m.oz ? p : m));

/** Um ciclo por intervalo entre halvings, mais o trecho anterior ao primeiro. */
export function cycles(points: Point[], halvings: string[]): Cycle[] {
  const edges = [points[0].date, ...halvings];
  return edges.map((from, k) => {
    const to = edges[k + 1] ?? null;
    const seg = points.filter((p) => p.date >= from && (!to || p.date < to));
    const peak = maxBy(seg);
    return {
      from,
      to,
      peak,
      low: minBy(seg.filter((p) => p.date >= peak.date)),
    };
  });
}

/** O menor ponto a partir de uma data. */
export const lowSince = (points: Point[], date: string): Point =>
  minBy(points.filter((p) => p.date >= date));

export const at = (points: Point[], date: string): Point =>
  points.find((p) => p.date >= date) ?? points[points.length - 1];
