# FIX_PLAN — BTC_THINGS

Ordered by (severity, findings-closed / effort). Groups A–D are this pass.
Everything below the line is filed, not attempted.

## A · Global tokens and layout — S, closes ~20 findings

| id | change | file |
|---|---|---|
| A1 | `.container { width: 100% }` — restores the 1200px cap on the main column | `src/styles/global.css` |
| A2 | Delete the 480px root step, soften 768px to 15px, `input,select,textarea { font-size: max(16px, 1em) }` | `src/styles/global.css` |
| A3 | Light `--fg-muted` → `#5f5f5f` (clears AA on all four light surfaces, not just white) | `src/styles/global.css` |
| A4 | Light `--accent-btc` → `#9c5800` (4.47:1 → 4.96:1 on `--bg-surface`) | `src/styles/global.css` |
| A5 | `.tool-card__description`: drop `opacity: .8`, set `--fg-secondary` | `src/pages/index.astro` |
| A6 | Headings `line-height: 1.15` + `text-wrap: balance` | `src/styles/global.css` |
| A7 | `p { max-width: 68ch }` and a paragraph margin | `src/styles/global.css` |
| A8 | `td.num, th.num { text-align: right }` inside the dca scope so `.num` wins | `src/pages/dca.astro` |
| A9 | Skip link (WCAG 2.4.1) | `BaseLayout.astro`, `global.css` |
| A10 | `.btn-secondary` box-model parity with `.btn-primary` | `src/styles/global.css` |

## B · My own regressions — S

| id | change | file |
|---|---|---|
| B1 | `--chart-legend-ink` flipping per theme; target `.legend text` | `global.css`, `debase.astro` |
| B2 | `computeRegret` must key on the CSV `Start` column like the client, not `End` | `src/utils/prerender.ts` |
| B3 | `NoScriptBanner` takes `hasPrerender` so each page states its own truth | `NoScriptBanner.astro`, all pages |
| B4 | A real ticker pause button (2.2.2) — `:focus-within` is dead code | `Ticker.astro` |

## C · Accessibility, low risk — S

C1 ThemeToggle: accessible name contains the visible label, `aria-pressed` carries state ·
C2 Nav: CSS-only checkbox disclosure so mobile nav works without JS, plus `aria-expanded`/`aria-controls` ·
C3 `[CG_API]` badge `role="status"` ·
C4 `/sem-melhores` search label; `#666` → `--fg-muted` ·
C5 `/all-the-money` label for `#searchInput` and `#sortBy` (closes axe `select-name`) ·
C6 `/sem-melhores` change colours → `--status-positive` / `--status-negative` ·
C7 `role="status"` on both calculators' results ·
C8/C9 24px minimum on the 404 route links and the footer links.

## D · Charts — M

D1 `viewBox` on the debase SVGs; delete the `32px !important` mobile bump ·
D2 `/satsukashii`: remove D3's inline `font-size`, let CSS own it ·
D3 `role="img"` + a describing `aria-label` on every chart.

---

## Estado depois do loop multi-agente (2026-09-07)

Fechado nesta rodada, com medição em navegador:

| item | evidência |
|---|---|
| `/all-the-money`: blocos como `<button>`, um tab stop por item | 25.346 botões, 52 focáveis para 52 itens, tooltip no foco |
| `/all-the-money`: `<style is:global>` vazando para a chrome | bundle da página sem regra `button{}` / `h1{}` sem escopo; diff visual 0,042% |
| `/sem-melhores`: semântica de diálogo, trap e restauração de foco | Tab ×8 sem sair, Escape devolve ao elemento que abriu |
| `/debase`: estrutura de cabeçalhos | 10 `h2`, sem pular nível |
| `role="img"` + nome nos gráficos | 10 no `/debase`, 1 em `/halving`, `/big-mac`, `/dca` |
| 8 literais de cor em `chart_draw.js` | migradas; três estavam abaixo de 3:1 contra o canvas |
| 5 `<h1>` dentro de link externo | desembrulhados; link de fonte nomeia o destino |
| 52 links `_blank` sem `rel="noopener"` | 52 → 0 |
| Links de prosa distinguidos só por cor | sublinhados globalmente |
| Ticker fora de landmark | dentro de `<header>` |
| Badges `LIVE` idênticos em todos os cards | viraram procedência, tipada em `routes.ts` |
| `/sem-melhores` sem estado vazio | placeholder no HTML servido |
| Lista de rotas duplicada em três arquivos | fonte única em `src/data/routes.ts` |

Reprovado com prova, não corrigido: o `color-contrast` que o axe reporta nos
títulos de eixo do `/debase`, `/halving` e `/rainbow` no tema claro. Ver
`.claude/FALSE_POSITIVES.md`.

Ainda aberto e conhecido:

- `public/scripts/all-the-money/script.js` dispara 13 requisições cross-origin
  que nunca podem atualizar nada — o loop exige que a resposta traga
  `valueBillions` e `lastUpdated` no topo, e nenhuma daquelas APIs devolve isso.
  Duas funções ainda carregam a string `API_KEY`; não são chamadas.
- `public/scripts/dca/dca.js` procura os rótulos de eixo em `y="60"` e `y="150"`,
  mas o `dca.astro` os renderiza em `y="65"` e `y="155"` — os dois ramos nunca
  disparam e o eixo Y não atualiza no recálculo.
- Os quatro `alert()` do `/dca` continuam sendo o caminho de erro.
- Toda a camada de copy que o revisor de conteúdo escreveu pronta para colar.

## Filed, not attempted this pass

**Needs a product decision:** `/sem-melhores` Portuguese-first default and the flag-as-language-toggle · binding `--text-body` to `body` (changes density everywhere; DESIGN.md §3 has never matched the code) · `/all-the-money`'s SHA-256 colour palette (magenta gold, no L bound, `Math.random()` fallback) · whether `/satsukashii` should own the `/big-mac-index` route · whether the `all-the-money` live-API integration ships or its "Live APIs" tile stops claiming freshness.

**Real but larger:** `/all-the-money` blocks as `<button>` with one tab stop per item, not 25,218 · its 107,382px mobile height · the `/sem-melhores` modal's dialog semantics and focus management · `<h2>` per section on `/debase` · six bare CSS colour names in `debase.astro:755-829` (`blue` = 2.30:1, `purple` = 2.10:1 against the canvas) and eight literals in `chart_draw.js` · the shared route module that would stop Nav/hub/404 drifting · the footer `GITHUB` link pointing at github.com · five `<h1>`s wrapped in external links, three of them same-tab · `is:global` leaks from `all-the-money.astro`.

**Copy:** every string the content reviewer proposed is written to drop in as-is; none applied this pass.
