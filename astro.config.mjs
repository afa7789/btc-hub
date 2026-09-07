// @ts-check
import { defineConfig } from "astro/config";

/*
 * GitHub Pages de repositorio de projeto: o site vive em
 * https://afa7789.github.io/btc-hub/, entao a base NAO e "/".
 *
 * ESCOLHA: opcao (a) — base path "/btc-hub".
 *
 * Motivo: (b) (dominio proprio ou repo afa7789.github.io) resolveria o
 * problema sem tocar em codigo, mas depende de uma decisao de infraestrutura
 * que nao e desta task — comprar dominio, apontar DNS ou criar outro
 * repositorio. (a) nao depende de ninguem e e verificavel aqui mesmo:
 * copia-se dist/ para dist-pages/btc-hub/ e serve-se dist-pages, o que
 * reproduz o prefixo real e deixa qualquer caminho absoluto esquecido
 * aparecer como 404 no Playwright.
 *
 * Consequencia: todo caminho absoluto passa a ser prefixado.
 *  - Em .astro/.ts (passam pelo bundler): `withBase()` de src/utils/base.ts,
 *    que envolve `import.meta.env.BASE_URL`.
 *  - Em public/scripts/*.js NAO ha bundler — esses arquivos sao servidos
 *    literalmente. Eles leem o prefixo de `window.__BASE__`, publicado pelo
 *    BaseLayout num <script is:inline define:vars> no <head>, antes de
 *    qualquer script de pagina rodar.
 */
export default defineConfig({
  site: "https://afa7789.github.io",
  base: "/btc-hub",
  output: "static",
  build: {
    assets: "_assets",
  },
});
