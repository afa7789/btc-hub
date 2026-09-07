/*
 * WCAG 1.4.10 (reflow) e 1.4.4 (resize text).
 *
 * 1.4.10 pede que a pagina caiba em 320 CSS px sem rolagem horizontal do
 * documento. O harness antigo media 390px, entao esta faixa nunca foi testada
 * — e foi onde apareceram os dois unicos defeitos deste tipo.
 *
 * Uso: BASE_URL=http://127.0.0.1:PORTA/btc-hub node .ux-review/harness/reflow-check.mjs
 * O site tem base path: sirva dist/ dentro de um pai como <dir>/btc-hub/.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8176/btc-hub";
const ROUTES = [
  "/", "/debase/", "/halving/", "/rainbow/", "/big-mac/", "/dca/",
  "/how-much-i-fucked-up/", "/all-the-money/", "/sem-melhores/", "/bitcoin-core/",
];
const settle = (r) => (r === "/sem-melhores/" ? 3000 : 800);

/*
 * Um elemento so causa rolagem se NENHUM ancestral o recorta. Sem esta regra o
 * ticker aparece como culpado em toda pagina: a trilha dele mede 534px de
 * proposito e vive dentro de um overflow:hidden. Perseguir isso manda a
 * investigacao para o componente errado.
 */
const NOT_CLIPPED = `(el) => {
  let n = el.parentElement;
  while (n) {
    const o = getComputedStyle(n).overflowX;
    if (o === "hidden" || o === "auto" || o === "scroll") return false;
    n = n.parentElement;
  }
  return true;
}`;

const browser = await chromium.launch();
let bad = 0;

console.log("=== 1.4.10 reflow @ 320px ===");
for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(settle(route));
  const r = await page.evaluate((notClippedSrc) => {
    const notClipped = eval(notClippedSrc);
    const de = document.documentElement;
    const guilty = [...document.querySelectorAll("*")]
      .filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1 && notClipped(e))
      .slice(0, 4)
      .map((e) => `${e.tagName}.${(e.className || "").toString().trim().slice(0, 28)}`);
    return { over: de.scrollWidth - de.clientWidth, guilty };
  }, NOT_CLIPPED);
  const ok = r.over <= 0;
  if (!ok) bad++;
  console.log(`${ok ? "OK   " : "FALHA"} ${route.padEnd(24)} overflow=${r.over}px${r.guilty.length ? " :: " + r.guilty.join(" , ") : ""}`);
  await ctx.close();
}

/*
 * 1.4.4 e medido ESTREITANDO O VIEWPORT, nao com `body { zoom }`.
 *
 * Zoom de navegador reduz a largura em CSS px disponivel: 200% em 1280 e o
 * mesmo que 640. Ja `body.style.zoom` e uma propriedade nao padronizada que
 * escala o conteudo por dentro e desalinha a centralizacao — ele reportava
 * 4px de estouro em /sem-melhores que NAO existe em 640px de verdade.
 * Perseguir aquilo teria virado uma correcao de CSS para um bug do medidor.
 */
for (const width of [640, 512]) {
  console.log(`\n=== 1.4.4 resize text @ ${width}px (equivalente a ${Math.round(1280 / width * 100)}% de zoom em 1280) ===`);
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(settle(route));
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      // .sr-only tem clientWidth 1 por construcao — e assim que se esconde
      // texto de quem enxerga e se mantem para leitor de tela. Nao e corte.
      const clipped = [...document.querySelectorAll("main p, main li, main h1, main h2, main h3, nav a")]
        .filter((e) => !e.classList.contains("sr-only") && e.scrollWidth > e.clientWidth + 1)
        .map((e) => `${e.tagName} "${e.textContent.trim().slice(0, 30)}"`);
      return { over: de.scrollWidth - de.clientWidth, clipped };
    });
    const ok = r.over <= 0 && r.clipped.length === 0;
    if (!ok) bad++;
    console.log(`${ok ? "OK   " : "FALHA"} ${route.padEnd(24)} overflow=${r.over} cortado=${r.clipped.length}${r.clipped.length ? " :: " + r.clipped[0] : ""}`);
    await ctx.close();
  }
}

await browser.close();
console.log(bad === 0 ? "\nREFLOW E RESIZE OK" : `\n${bad} FALHA(S)`);
process.exit(bad === 0 ? 0 : 1);
