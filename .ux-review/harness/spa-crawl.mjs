/*
 * Visita cada pagina pelo nav (ClientRouter, sem recarregar), ida e volta,
 * duas voltas, e confere erro e se a pagina desenhou.
 *
 * Existe porque draw-check abre cada rota por URL, numa sessao limpa: um
 * script de public/ que colide com outro no escopo global (scripts classicos
 * dividem um) so quebra quando o outro ja carregou. Foi o `const assetPath`
 * de dca.js e do /all-the-money: vindo do DCA pelo nav, o /all-the-money
 * ficava sem nenhum bloco ate recarregar.
 *
 * Uso: node .ux-review/harness/spa-crawl.mjs http://127.0.0.1:PORTA/btc-hub
 */
import { chromium } from "playwright";
const base = process.argv[2];
const CHECK = {
  "DEBASE": ["svg path", 54], "SRS VS ETH STAKE": ["#stake-rolling rect", 100], "HALVING": ["#halving-chart svg path", 11], "RAINBOW": [".band-label", 9],
  "BIG MAC INDEX": ["svg path", 5], "DCA CALCULATOR": ["svg", 1], "ALL THE MONEY IN THE WORLD": [".block", 25000],
  "DOLARIZAÇÃO": ["#dz-chart rect", 100], "HOW MUCH I FUCKED UP": ["main input", 1], "SEM MELHORES": ["main", 1],
  "BITCOIN CORE": ["main pre", 3], "OFF-RAMP": ["main li", 30],
};
const order = Object.keys(CHECK);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
let errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
await p.goto(base + "/", { waitUntil: "networkidle" });
let bad = 0;
for (const lap of [1, 2]) for (const label of [...order, ...order.slice().reverse()]) {
  errs = [];
  await p.click(`.nav__link:has-text("${label}")`);
  await p.waitForTimeout(2200);
  const [sel, min] = CHECK[label];
  const n = await p.evaluate((s) => document.querySelectorAll(s).length, sel);
  const ok = n >= min && errs.length === 0;
  if (!ok) { bad++; console.log("FALHA", lap, label, `${sel}=${n}/${min}`, errs); }
}
console.log(bad ? `${bad} falhas` : "SPA OK: todas as paginas desenham sem erro, ida e volta, duas voltas");
await b.close();
process.exit(bad ? 1 : 0);
