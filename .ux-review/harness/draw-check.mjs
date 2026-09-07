/*
 * Prova de que cada tela ainda DESENHA o que ela existe para desenhar.
 *
 * Existe porque public/scripts/ nao passa pelo bundler: um erro ali mata o
 * grafico e `bun run build` continua saindo 0. Contagem de elemento e a unica
 * verificacao que pega isso — screenshot nao pega, build nao pega, lint nao pega.
 *
 * Uso: BASE_URL=http://127.0.0.1:PORTA/btc-hub node .ux-review/harness/draw-check.mjs
 * O site tem base path: sirva dist/ dentro de um pai como <dir>/btc-hub/.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8162/btc-hub";

// Cada expectativa foi MEDIDA na arvore limpa, nao estimada. Duas telas nao
// tem SVG nenhum por construcao (e hmifu nem usa <form>: sao inputs soltos) — /sem-melhores e uma tabela e
// /how-much-i-fucked-up e texto prerenderizado com formulario. Supor "todo
// grafico e um svg" reprovava as duas em uma arvore perfeitamente sa.
const SCREENS = [
  { path: "/debase/", sel: "svg path", min: 60 },
  { path: "/rainbow/", sel: ".band-label", min: 9 },
  { path: "/big-mac/", sel: "svg path", min: 5 },
  { path: "/halving/", sel: "svg path", min: 11 },
  { path: "/all-the-money/", sel: ".block", min: 25000 },
  { path: "/sem-melhores/", sel: "table tr", min: 5, wait: 3000 },
  { path: "/dca/", sel: "svg", min: 1 },
  { path: "/how-much-i-fucked-up/", sel: "main input, main button", min: 2 },
];

const browser = await chromium.launch();
let bad = 0;

for (const s of SCREENS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));

  const resp = await page.goto(BASE + s.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(s.wait ?? 1200);

  const r = await page.evaluate((sel) => ({
    n: document.querySelectorAll(sel).length,
    mainNodes: document.querySelector("main")?.querySelectorAll("*").length || 0,
    rules: [...document.styleSheets].reduce((a, x) => {
      try { return a + x.cssRules.length; } catch { return a; }
    }, 0),
  }), s.sel);

  // Guarda de render: sem ela, uma pagina servida na raiz (sem o prefixo) vem
  // sem estilo, conta 0 elementos e parece "grafico quebrado" — mandando a
  // investigacao para o lugar errado.
  const rendered = r.mainNodes >= 20 && r.rules >= 50;
  const ok = resp.status() === 200 && rendered && r.n >= s.min && errors.length === 0;
  if (!ok) bad++;

  console.log(
    `${ok ? "OK   " : "FALHA"} ${s.path.padEnd(24)} status=${resp.status()} ` +
      `${s.sel}=${r.n}/${s.min} main=${r.mainNodes} css=${r.rules} err=${errors.length}` +
      (errors.length ? ` :: ${errors[0]}` : ""),
  );
  await ctx.close();
}

await browser.close();
console.log(bad === 0 ? "\nTODAS AS TELAS DESENHAM" : `\n${bad} TELA(S) QUEBRADA(S)`);
process.exit(bad === 0 ? 0 : 1);
