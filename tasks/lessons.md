# Lessons Learned

This file tracks lessons learned during the BTC_Things project.

## Phase 1: Scaffold + Design System

- **2026-04-02**: Project initialized with Astro 5.x, Biome for linting/formatting
- **2026-04-02**: DCA Brutalist design language successfully extracted to global.css
- **2026-04-02**: Theme toggle implemented with localStorage persistence
## Porting D3 tools into Astro

- **2026-08-30**: Astro `<style>` blocks are scoped by a `data-astro-cid-*` attribute
  stamped at build time. Nodes that D3 creates at runtime never get that attribute, so
  every rule targeting them (`svg text`, `.tick line`, `.grid line`, ...) is silently
  dead. This left DEBASE with default black 10px axis text and a white data line on a
  white page. Fix: address runtime nodes with `:global()`, anchored under a markup
  element that does carry the scope (`article :global(svg text)`).
- **2026-08-30**: `chart_draw.js` treats `container.clientHeight > 0` as "the container
  has a height". `clientHeight` includes padding, so adding vertical padding to an empty
  chart container made it report 20px and produced `<rect height="-110">`. Chart
  containers must keep vertical padding at 0.
- **2026-08-30**: The DEBASE charts paint their Y-axis label outside the SVG box
  (`overflow: visible`). The dark ground therefore belongs on the container div, not on
  the `<svg>` — otherwise the white label lands on the page background and disappears.
- **2026-08-30**: `new Date('2010-07-17')` parses as UTC midnight, so
  `toLocaleDateString` in a negative-offset timezone renders the previous day. Parse
  date-only strings as `new Date(s + 'T00:00:00')`.
- **2026-08-30**: Scripts loaded with `<script is:inline src="/scripts/...">` are served
  from `public/`. Keeping a second copy under `src/scripts/` means edits land in a file
  that never ships. Keep one copy only.
- **2026-08-30**: SemMelhores silently degrades. When the CoinGecko call fails
  (the free tier rate-limits, and a 429 arrives without CORS headers, so it looks like
  a network error) and localStorage is empty, it renders `loadExampleData()` — four
  hardcoded coins at stale prices, with the header relabelled "TOP 4 MOEDAS". It looked
  exactly like a real but short top 100. Inherited from the original site. Now: one
  delayed retry before giving up, and a visible `#dataNotice` banner whenever the table
  is not live data.
- **2026-09-06**: A Astro scoped selector beats an unscoped utility class. `th, td` in a
  page's `<style>` compiles to `th[data-astro-cid-…]` — specificity (0,1,1) — which wins
  over a global `.num` at (0,1,0). Adding the class to the markup changed nothing and I
  reported it as done without measuring. Verify a utility class took effect by reading
  the computed style, not by reading the diff.
- **2026-09-06**: D3 writes `font-size` with `.style()`, which is an inline style and
  outranks any stylesheet rule, including a media query. Raising the CSS value from 9px
  to 12px was dead code; with the SVG scaled 0.377× at 390px the label still rendered at
  4.15px. Delete the inline write and let CSS own the size, then measure the rendered
  size, not the declared one.
- **2026-09-06**: `:focus-within` cannot fire on a container with no focusable children.
  The ticker's pause-on-focus rule was decoration — WCAG 2.2.2 needs a real control, and
  `prefers-reduced-motion` only covers users who set the OS flag.
- **2026-09-06**: The fixed dark chart canvas (`--chart-bg`/`--chart-ink`, deliberately
  absent from the light theme) is correct for text drawn *inside* the panel and wrong for
  everything D3 draws outside it. The legend sits ~5px below the panel, so it needs
  `--chart-legend-ink`, which flips with the theme. This is the same hazard the
  2026-08-30 entry above already recorded for the Y-axis label; I reintroduced it.
- **2026-09-06**: `padding` does not shrink on a flex item, so a marquee built on
  `padding-left: 100%` inflates its flex line. But that was not the source of the 6px
  overflow I blamed it for — removing the element from the DOM left `scrollWidth`
  unchanged. Falsify the hypothesis before editing; the real cause was the transactions
  table after the mobile root font went from 12px back to 15px.
- **2026-09-06**: Marking a migration "done" in DESIGN.md after converting only the
  page CSS left six bare CSS colour names live in the chart configs (`blue` 2.30:1,
  `purple` 2.10:1 against the canvas). A status table that overstates progress is how a
  finding survives: nobody re-checks a row marked done.
- **2026-09-07**: Alinhar o gráfico à esquerda foi a correção errada para "está tudo
  torto à esquerda". O container tem 1200px e o elemento mais largo é um gráfico de
  900px, então ancorar tudo na borda esquerda deixava ~280px de vazio só de um lado.
  O problema não era o gráfico estar centrado — era a coluna de conteúdo não estar.
  `.main > article { max-width: 920px; margin-inline: auto }`, texto à esquerda dentro
  dela. Quando algo parece desalinhado, medir as bordas de início de cada elemento
  antes de mover qualquer uma.
- **2026-09-07**: O harness de auditoria carregava uma lista fixa de oito telas,
  anterior a três rotas novas. Um audit assim reporta "limpo" em páginas que nunca
  abriu — pior que não auditar, porque produz confiança falsa. Catálogo de telas é
  parte do código: quem adiciona rota atualiza `capture.mjs`, `audit.mjs`,
  `ui-catalog.yaml` e `SCREEN_INVENTORY.md`.
- **2026-09-07**: `scripts/update.sh` chamava `update_cpi.py`, `update_metals.py` e
  `update_crypto.py` — nenhum jamais existiu no repositório; os updaters sempre foram
  TypeScript. Um script de manutenção que ninguém roda apodrece em silêncio. O script
  agora imprime uma tabela de frescor de todo dataset e sai não-zero quando algo passa
  do prazo, então a próxima falha aparece.
- **2026-09-07**: A entrada de 06/09 sobre o contraste dos títulos de eixo do /debase
  estava errada. Não é flash transitório durante a construção: o axe lê a propriedade
  `color` herdada em vez do `fill` do SVG. Sondado em 1500, 3000 e 6000ms — os dez
  rótulos resolvem para branco sempre. Antes de tratar achado de ferramenta como
  defeito, medir a propriedade que o navegador realmente usa.
- **2026-09-07**: Extrair uma seção para outra página quebra o guard de inicialização
  de quem ficou. O /debase fazia gate de todo o `astro:page-load` em `#halving-chart`,
  elemento que mudou de página — todos os gráficos teriam morrido em silêncio. Guard
  por id precisa apontar para um elemento que a própria página é dona, e mover um
  bloco significa reconferir quem o usava como sentinela.
- **2026-09-07**: Rodar N agentes na mesma árvore de trabalho funciona para arquivos
  disjuntos, mas `dist/` e a porta do servidor são recursos compartilhados: dar
  `--outDir` e porta próprios a cada um resolve. O `bun run build` ainda falha de
  forma transitória quando outro agente está no meio de uma escrita — isso é ruído
  esperado, não bug a corrigir.
- **2026-09-07**: `dagRobin add --deps a,b,c` grava as três como UMA string, então a
  tarefa nunca desbloqueia sozinha. Conferir com `dagRobin get <id>` depois de criar,
  e não confiar que `ready` sabe o que está liberado.
