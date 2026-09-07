/**
 * Prefixo de deploy.
 *
 * O site e publicado em GitHub Pages de repositorio de projeto, entao ele nao
 * vive na raiz do dominio: `import.meta.env.BASE_URL` vale "/btc-hub/" no
 * build e "/" em qualquer deploy de raiz. Todo caminho absoluto do site
 * (datasets, scripts de public/, links internos, favicon) tem que passar por
 * aqui — um esquecido vira 404 no deploy e o grafico da pagina nao desenha.
 */
const BASE = import.meta.env.BASE_URL;

/** "/btc-hub" (sem barra final) ou "" quando a base e a raiz. */
export const BASE_PREFIX = BASE.replace(/\/+$/, "");

/**
 * `withBase("/datasets/gold.csv")` -> "/btc-hub/datasets/gold.csv".
 * Caminhos que nao comecam com "/" (URLs absolutas, ancoras) voltam intactos.
 */
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PREFIX}${path}`;
}

/**
 * O inverso, para comparar `Astro.url.pathname` com os hrefs de routes.ts:
 * remove o prefixo e a barra final, entao "/btc-hub/dca/" vira "/dca".
 */
export function stripBase(pathname: string): string {
  const withoutBase =
    BASE_PREFIX && pathname.startsWith(BASE_PREFIX)
      ? pathname.slice(BASE_PREFIX.length)
      : pathname;
  return withoutBase.replace(/\/+$/, "") || "/";
}
