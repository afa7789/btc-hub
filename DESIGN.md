# DESIGN.md — BTC_THINGS Design System & Visual Specification

> Status: especificação. Os tokens da seção 2 e a escala da seção 3 ainda não
> estão implementados em `src/styles/global.css` — ver "Estado atual vs. spec"
> no fim do documento.

## 1. Visão geral e filosofia

BTC_THINGS é um observatório financeiro cypherpunk e brutalista construído em
Astro 5 estático (saída HTML puro, zero framework client-side). A missão é
apresentar a realidade matemática do Bitcoin e a perda secular de poder de
compra do dinheiro fiduciário através de dados brutos, gráficos de precisão e
tipografia de terminal.

**Princípios norteadores**

- **Punk gothic terminal** — brutalismo web e estética de terminal UNIX como
  base funcional, com títulos em blackletter por cima. Sem sombras falsas, sem
  cantos arredondados, sem decoração supérflua: o único ornamento permitido é a
  tipografia dos títulos, e ela é ornamento com trabalho a fazer.
- **High-density information architecture** — tabelas com números alinhados à
  direita, gráficos vetoriais nítidos em SVG/D3, badges de estado do sistema
  `[LIVE]`, `[OFFLINE]`, `[RAW_DATA]`.
- **Deterministic color encoding** — contraste absoluto entre fundo preto,
  acento laranja Bitcoin e estados de ganho/perda em verde e vermelho de
  terminal.
- **Server-first, JS-optional** — toda ferramenta renderiza um cenário padrão
  calculado em build time. JavaScript adiciona interatividade e cotação ao
  vivo; sem ele a página ainda diz algo verdadeiro, com banner `[JS_DISABLED]`.

## 2. Paleta de cores (tokens CSS)

```css
:root {
  /* Bases de fundo */
  --bg-primary: #000000;      /* Preto absoluto de terminal */
  --bg-surface: #0a0a0a;      /* Cards e caixas de ferramentas */
  --bg-elevated: #141414;     /* Headers de tabela e inputs */
  --bg-highlight: #1a1a1a;    /* Hover de linhas e estados ativos */

  /* Linhas e contornos brutalistas */
  --border-subtle: #222222;   /* Divisores secundários de grade */
  --border-strong: #ffffff;   /* Bordas duplas e divisões primárias */
  --border-accent: #ff9900;   /* Contorno Bitcoin e foco */

  /* Tipografia */
  --fg-primary: #ffffff;      /* Textos primários e valores de destaque */
  --fg-secondary: #aaaaaa;    /* Rótulos e metadados secundários */
  --fg-muted: #8c8c8c;        /* Timestamps e notas de rodapé */

  /* Ação e semântica */
  --accent-btc: #ff9900;      /* Laranja Satoshi oficial (primário) */
  --accent-btc-dim: #cc7a00;  /* Hover e acentos secundários */
  --on-accent: #000000;       /* Texto sobre um fundo --accent-btc */
  --status-positive: #00ff66; /* Ganhos, compras lucrativas, OK */
  --status-negative: #ff3333; /* Inflação, perda fiduciária, erro */
  --data-gold: #ffd700;       /* Ouro físico / commodities */
  --data-cyan: #00e5ff;       /* Imóveis / real estate global */
  --status-warning: #ffb300;  /* Avisos, disclaimers, credibilidade média */
}
```

### 2.1 Séries de dados

Cada ativo tem uma cor fixa em todo o site. Reconhecer a série pela cor só
funciona se ela não mudar de página para página.

```css
:root {
  --series-btc: #f7931a;
  --series-eth: #627eea;
  --series-xmr: #ff6600;
  --series-gold: #ffd700;
  --series-silver: #c0c0c0;
  --series-srs: #1a73e8;
  --series-eth-stake: #a35fd1;
  --series-fiat: #22c55e;  /* lado fiduciário — preço em USD */

  /* Eixo de variante (nominal / ajustada), não de ativo */
  --series-real-fixed: #4a9eff;
  --series-real-1971: #22c55e;
}
```

D3 aplica `stroke` como atributo de apresentação, onde `var()` não vale. Leia o
token com `getComputedStyle` no momento do desenho, como fazem `/debase` e
`/satsukashii` — nunca duplique o literal no JS.

### 2.2 Canvas fixo escuro

```css
:root {
  --chart-bg: #0a0a0a;
  --chart-ink: #ffffff;
  --chart-grid: #444444;
}
```

Toda série precisa de 3:1 contra `--chart-bg` (WCAG 1.4.11, contraste de
elemento não textual). Foi por isso que `--series-eth-stake` deixou de ser
`#6f2c91` (2.31:1), e que os nomes CSS crus `blue` (2.30:1) e `purple` (2.10:1)
saíram das 18 configurações de série do `/debase`.

A legenda é a exceção: o D3 a desenha **fora** do painel escuro, sobre o fundo
da página. Ela usa `--chart-legend-ink`, que acompanha o tema — usar
`--chart-ink` deixava texto branco sobre fundo branco no tema claro.

Os gráficos do `/debase` desenham as séries acima sobre fundo preto **em
qualquer tema** — no claro, prata e ouro sumiriam. Esses três tokens são
deliberadamente ausentes do bloco `[data-theme="light"]`.

O `/satsukashii` é o caso oposto: desenha sobre o fundo da página, então segue
o tema e usa `--bg-primary` / `--fg-primary` / `--series-fiat`, que invertem.
Ele redesenha no evento `themechange`.

## 3. Tipografia — terminal com títulos góticos

Duas famílias, com papéis rígidos. A base é monoespaçada, para garantir o
alinhamento colunar exato dos números financeiros. Os títulos de página e o logo
são blackletter — é onde entra o gótico, sem contaminar a leitura de dados.

```css
--font: 'Courier New', 'SF Mono', Monaco, 'Cascadia Code',
        'Roboto Mono', Menlo, Consolas, monospace;

--font-display: 'UnifrakturCook', 'Pirata One', 'Courier New', monospace;
```

### 3.1 Banner ASCII

A home abre com um banner FIGlet gerado em build time (`src/utils/ascii-banner.ts`),
na tradição de MOTD de terminal.

- **Fonte de bloco sólido**, `ANSI Shadow`. Faces delicadas como `fraktur` viram
  mingau abaixo de ~12px por caractere; blocos continuam legíveis como letra.
  `Delta Corps Priest 1` é a alternativa com mais textura de metal, ao custo de
  não desenhar o `_`.
- **Só serve para string curta.** A largura é fixa em colunas de caractere:
  `BTC_THINGS` são 77 colunas, mas `All the Money in the World` seriam 292 — a
  2px por caractere no celular. Título de página fica no `--font-display`.
- **O corpo é derivado do container**, `calc(100cqi / (colunas * 0.62))`, então
  a arte encaixa exatamente na largura disponível.
- **Escondido abaixo de 900px**, onde cairia para ~5px por caractere. Um fallback
  em `--font-display` assume o lugar.
- **`<pre aria-hidden="true">` com um `<h1>` real em `.sr-only`.** Leitor de tela
  ouve "BTC_THINGS", não a sopa de caracteres.

**Regras não negociáveis do `--font-display`:**

- **Nunca em caixa alta.** Blackletter em CAPS é ornamento indecifrável. Quem usa
  `--font-display` não leva `text-transform` nem `letter-spacing`. Os títulos de
  página são escritos em Title Case na fonte (`"Debase"`, não `"DEBASE"`).
- **Só em `h1`, `h2` e no logo.** Rótulos de nav, títulos de card (`h3`), badges,
  cabeçalhos de tabela e botões continuam monoespaçados em caixa alta — é o
  contraste entre os dois registros que produz o efeito, não o gótico sozinho.
- **É a única web font do site.** Carregada com `display=swap` e fallback
  monoespaçado, então o texto nunca fica invisível enquanto ela baixa. Aceita-se
  o FOUT em troca da identidade; nenhuma outra web font entra.

O tema escuro é o padrão da identidade: o claro só aparece por escolha explícita
no toggle, não por `prefers-color-scheme`.

| Nível | Tamanho | Tratamento |
|---|---|---|
| Display / H1 | `--text-display` × 2.3 | `--font-display`, peso 700, sem tracking, Title Case |
| H2 / seção | `--text-section` × 1.9 | `--font-display`, peso 700, sem tracking, Title Case |
| H3 / card header | 14–15px | bold |
| Body | 13px | `line-height: 1.6` |
| Números / tabelas | 13px | `font-variant-numeric: tabular-nums`, alinhado à direita |
| Micro-labels e tags | 10–11px | `letter-spacing: 1px`, entre colchetes `[LIVE]` |

## 4. Componentes globais e padrões de layout

### 4.1 BaseLayout (`src/layouts/BaseLayout.astro`)

- **Ticker bar superior** — barra contínua de 32px com cotações rápidas (BTC,
  SOL, DOGE, XMR, LINK, ADA, LTC) e variação percentual em
  `--status-positive` / `--status-negative`. Hoje existe só na home; deve subir
  para o layout.
- **Header de navegação** — logo `BTC_THINGS` linkando para `/`, seguido de
  `SEM MELHORES | ALL THE MONEY IN THE WORLD | DCA CALCULATOR | DEBASE |
  BIG MAC INDEX | HOW MUCH I FUCKED UP`.
- **Indicador de página ativa** — sublinhado sólido 2px em `--accent-btc` ou
  prefixo de terminal `> PÁGINA <`. Hover com feedback tátil no mesmo idioma.
- **Utility bar à direita** — status da API (`[CG_API: ONLINE]`), moeda base
  (USD / BRL / sats), idioma e tema, num único agrupamento padronizado. Resolve
  a sobreposição atual entre o toggle global e os controles próprios de
  `/sem-melhores`.
- **Banner `[JS_DISABLED]`** — `NoScriptBanner.astro`, no topo do `<body>`,
  visível apenas sem JavaScript.
- **Footer** — `© 2026 BTC_THINGS — All tools are open source and free to use.`
  com links `HOME`, `GITHUB`, `DATASETS`.

### 4.2 Botões e ações

- **Primário** (`Calculate`, `Submit`): fundo `--accent-btc`, texto preto, bold,
  `padding: 12px 24px`, `border-radius: 0`, sem borda. Hover inverte para fundo
  preto, texto laranja, `2px solid var(--accent-btc)`.
- **Secundário / filtro**: fundo `--bg-surface`, `1px solid #444`, texto branco.

### 4.3 Tabelas financeiras

- Cabeçalho com fundo `--bg-elevated`, contorno `--border-strong` ou `#333`.
- Colunas numéricas (preço, market cap, variação) com `text-align: right`.
- Hover de linha em `--bg-highlight`.

### 4.4 Favicon e identidade de aba

SVG 512×512 em bleed total, glifo `₿` ocupando 90% da caixa, `--accent-btc`
sobre preto — nítido em 16px e 32px.

## 5. Backlog de UX por ferramenta

### `/sem-melhores`
- Sparklines de 7 dias em SVG monoespaçado e coluna de dominância em telas largas.
- Filtros rápidos como tags de terminal: `[L1/L2]`, `[DeFi]`, `[Privacy]`, `[AI]`,
  ou por faixa de market cap.
- Estado de falha brutalista: `[ERR: RATE_LIMITED — RETRYING IN 12s]` com
  skeleton monoespaçado. Hoje a página depende 100% da CoinGecko sem fallback.

### `/all-the-money`
- Trocar os blocos de altura variável por treemap proporcional ou grade de
  quadrados empacotados, para tornar a comparação de escala mais direta.
- Régua de magnitude flutuante (`Você está vendo $10T de $120T`) e zoom próprio,
  sem depender do zoom do navegador.

### `/dca` e `/how-much-i-fucked-up`
- Presets históricos ao lado do date picker: `[Halving 2020]`,
  `[Corona Crash — Mar/20]`, `[Topo 2021]`, `[Fundo FTX — Nov/22]`.
- Métricas em KPI cards modulares (ROI %, custo médio, max drawdown) no lugar da
  lista corrida atual.
- Marcar cada compra sobre a curva de patrimônio no gráfico do DCA.
- **Feito:** ambas as páginas já abrem com um cenário calculado em build time
  (`src/utils/prerender.ts`), então mostram números reais mesmo sem JavaScript.

### `/debase` e `/satsukashii`
- Cursor vertical sincronizado mostrando os dois eixos na mesma data
  (USD $X vs Y sats).
- Anotações de eventos: halvings e ciclos de QE como linhas pontilhadas sutis.

## 6. Catálogo de arte (a produzir)

Artes vetoriais brutalistas em `public/assets/art/`. Nenhuma existe ainda além
do favicon.

| Arte | Destino | Conteúdo |
|---|---|---|
| Favicon | `public/favicon.svg` | Glifo `₿` de alto contraste |
| Big Mac Index | `/satsukashii` | Montagem do hambúrguer e decaimento log dos sats |
| Debase | `/debase` | Curva CPI-U vs linhas de halving |
| All The Money | `/all-the-money` | Proporção dos blocos de $100B |
| DCA Calculator | `/dca` | Pipeline de aportes acumulando sats |
| How Much I Fucked Up | `/how-much-i-fucked-up` | Matriz de arrependimento |
| Sem Melhores | `/sem-melhores` | Funil com filtro `blacklist.json` |

## 7. Estado atual vs. spec

| Item | Estado |
|---|---|
| Banner `[JS_DISABLED]` | Implementado (`NoScriptBanner.astro`) |
| Cenário padrão prerenderizado em `/dca` e `/how-much-i-fucked-up` | Implementado (`src/utils/prerender.ts`) |
| Tokens da seção 2 | Implementados em `global.css`, com `--bg`/`--fg`/`--accent`/`--border` mantidos como alias |
| Variante clara dos tokens | Implementada — acentos e status escurecidos para contraste em fundo branco |
| Escala tipográfica da seção 3 | Implementada (`--text-display` … `--text-micro`, aplicada a `h1`–`h6`) |
| Primitivas `.btn-primary` / `.btn-secondary` / `.tag` / `.num` | Implementadas; aplicadas em `/dca` e `/how-much-i-fucked-up` |
| Tabelas com `tabular-nums` e hover de linha | Implementadas globalmente |
| Indicador de página ativa | Implementado — `> PÁGINA <` em `Nav.astro` |
| Ticker no BaseLayout | Implementado — presente nas 7 páginas |
| Utility bar unificada | Implementada (`UtilityBar.astro`) — status `[CG_API: …]`, slot `utility` para controles de página, tema |
| Seletor de moeda base (USD/BRL/sats) | Não — exige conversão em todas as ferramentas |
| Rota 404 | Implementada (`src/pages/404.astro`) + `error_page` no nginx |
| `prefers-reduced-motion` no ticker | Implementado — para de rolar e vira faixa scrollável |
| `color-scheme` por tema | Implementado — date pickers e scrollbars nativos seguem o tema |
| Favicon 512×512 em bleed | Não |
| Tokens de série e canvas (2.1 / 2.2) | Implementados |
| Cores literais migradas | Implementado no CSS de todas as páginas e nas 18 séries de `/debase`. **Falta** `public/scripts/debase/chart_draw.js` (8 literais) e a paleta SHA-256 de `public/scripts/all-the-money/script.js` |
| Backlog da seção 5 | Não, exceto o item de prerender |

### Dívidas conhecidas

- `src/styles/sem-melhores.css` ainda tem seu próprio sistema de cores — é o
  último arquivo fora dos tokens. O
  conflito de toggles já foi resolvido: a página não tem mais botão de tema
  próprio e manda o de idioma para o slot `utility`.
- Os nomes dos datasets são âncoras fixas, não descrições de intervalo. O
  sufixo de data no arquivo (`bitcoin_2010-07-17_2025-07-25.csv`) é intencional
  e não acompanha o conteúdo — assim os updaters acrescentam linhas sem
  renomear arquivo nem mexer nas referências em `dca.js` e `debase.astro`. Para
  saber o alcance real, leia a última linha, não o nome.
- `public/datasets/` é uma cópia de `../debase/datasets/` e precisa ser
  ressincronizada à mão (ou via `scripts/update.sh`) quando aquele repositório
  avança. Última sincronização: cripto e metais até 2026-09-07 / 2026-09-04.
