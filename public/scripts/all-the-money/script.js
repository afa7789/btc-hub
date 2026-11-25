/*
 * Este arquivo vive em public/ — e servido literalmente, sem passar pelo
 * bundler, entao `import.meta.env.BASE_URL` nao existe aqui. O prefixo de
 * deploy vem de window.withBase, publicado pelo BaseLayout no <head> antes
 * deste script carregar.
 *
 * Nada de `const` no topo com nome generico: scripts classicos dividem um
 * escopo global, e com o ClientRouter dois deles convivem na mesma sessao. O
 * `const assetPath` daqui e o do outro script faziam o segundo a carregar
 * morrer com SyntaxError, e a pagina ficava sem desenhar ao chegar pelo nav.
 */

const currentScale = 100; // Fixed scale in billions per block
const updateCount = 0;
const isUpdating = false;
let wealthData = null;
let filteredItems = [];
let comparisonItems = [];

/*
 * Cor com significado, nao por hash. Cada item tirava a cor do SHA-256 do slug,
 * sem controle de luminancia: o Bitcoin saia azul e o ouro magenta, e a pagina
 * virava um arco-iris sem leitura. Agora a cor so aparece onde diz algo, com
 * os tokens que o site inteiro ja usa (DESIGN.md 2.1): bitcoin, ether, ouro,
 * dinheiro fiduciario e divida. O resto do mundo fica no cinza neutro; quem
 * separa um item do vizinho e o tom (createShadePicker), nao a cor.
 */
const ITEM_COLOR = {
  "bitcoin-market-cap": "--series-btc",
  "btc-public-companies": "--series-btc",
  "us-spot-btc-etfs": "--series-btc",
  "ethereum-market-cap": "--series-eth",
  // Stablecoin e dolar on-chain: lado fiduciario, mesma cor do M2.
  "stablecoins-market-cap": "--series-fiat",
  "gold-above-ground": "--series-gold",
};
const CATEGORY_COLOR = {
  "money-supply": "--series-fiat",
  "central-bank-assets": "--series-fiat",
  debt: "--status-negative",
  "bank-failures": "--status-negative",
};

function colorFor(item, styles) {
  const token =
    ITEM_COLOR[item.id] ||
    CATEGORY_COLOR[item.categoryId] ||
    "--series-neutral";
  return styles.getPropertyValue(token).trim();
}

/*
 * Mesma cor, tons diferentes. Itens vizinhos que caem no mesmo token (quase
 * tudo que e cinza) viravam uma massa so, sem dar para ver onde um termina e o
 * outro comeca. O tom vem da posicao do item na ordem desenhada, por token:
 * dois vizinhos da mesma cor nunca repetem o tom, em qualquer ordenacao.
 * So clareia — misturar com branco nao derruba os 3:1 contra --chart-bg.
 */
const SHADE_WHITE_PCT = [0, 30, 60];

function createShadePicker(styles) {
  const seen = {};
  return (item) => {
    const base = colorFor(item, styles);
    const step = seen[base] || 0;
    seen[base] = step + 1;
    const white = SHADE_WHITE_PCT[step % SHADE_WHITE_PCT.length];
    return white ? `color-mix(in srgb, ${base}, white ${white}%)` : base;
  };
}

// Storage helper functions
function saveDataToStorage(data) {
  try {
    const cacheData = {
      data: data,
      timestamp: Date.now(),
      version: data.metadata.dataVersion,
    };
    localStorage.setItem("wealthData-cache", JSON.stringify(cacheData));
    console.log("💾 Data cached to localStorage");
  } catch (error) {
    console.warn("Failed to cache data to localStorage:", error);
  }
}

function loadDataFromStorage() {
  try {
    const cached = localStorage.getItem("wealthData-cache");
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const cacheAge = Date.now() - cacheData.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (cacheAge > maxAge) {
      console.log("📅 Cached data is too old, removing...");
      localStorage.removeItem("wealthData-cache");
      return null;
    }

    console.log(
      `⚡ Loading cached data (version: ${cacheData.version}, age: ${Math.round(cacheAge / 1000 / 60)} minutes)`,
    );
    return cacheData.data;
  } catch (error) {
    console.warn("Failed to load cached data:", error);
    localStorage.removeItem("wealthData-cache");
    return null;
  }
}

// Load data from JSON file with fallback
async function loadData() {
  console.log("🔄 Iniciando carregamento de dados...");
  let success = false;

  // 1. Tentar carregar do cache (localStorage)
  try {
    const cached = localStorage.getItem("wealthData-cache");
    if (cached) {
      const cacheData = JSON.parse(cached);
      wealthData = cacheData.data;
      console.log(
        `✅ Dados carregados do cache (timestamp: ${new Date(cacheData.timestamp).toLocaleString()}).`,
      );
      success = true;
      // Garantir que a visualização é criada imediatamente se houver cache
      createVisualization();
    }
  } catch (e) {
    console.warn("⚠️ Erro ao carregar dados do cache ou cache corrompido:", e);
    localStorage.removeItem("wealthData-cache"); // Limpar cache inválido
  }

  // 2. Carregar do data.json e adicionar/complementar
  //    Isso acontecerá SEMPRE para garantir que temos os dados base ou complementares
  try {
    const jsonResponse = await fetch(
      window.withBase("/datasets/all-the-money/data.json"),
    );
    if (!jsonResponse.ok)
      throw new Error(`HTTP error! status: ${jsonResponse.status}`);
    const jsonData = await jsonResponse.json();

    if (!wealthData) {
      wealthData = jsonData; // Se não há cache, o JSON é a base
      console.log("📦 Dados base carregados de data.json.");
      success = true;
    } else {
      wealthData = mergeDataIntelligently(wealthData, jsonData);
    }

    // Re-ordenar (opcional, mas bom para consistência)
    wealthData.items.sort((a, b) => b.valueBillions - a.valueBillions);

    // Atualizar o cache com os dados do JSON (se for o caso)
    localStorage.setItem(
      "wealthData-cache",
      JSON.stringify({
        timestamp: Date.now(),
        data: wealthData,
      }),
    );
    console.log("💾 Cache atualizado após merge com data.json.");
    createVisualization(); // Recriar visualização com dados atualizados
  } catch (e) {
    console.error("❌ Erro ao carregar ou mesclar dados de data.json:", e);
    if (!wealthData) {
      // Se nem o cache nem o JSON funcionaram
      document.getElementById("visualization").innerHTML =
        "<p>Erro fatal: Não foi possível carregar os dados. Por favor, verifique a conexão e o arquivo data.json.</p>";
      return false;
    }
  }

  /*
   * Aqui existia um loop que percorria os itens com `isLiveUpdatable` e buscava
   * `dataSource.apiEndpoint`. Ele exigia que a resposta trouxesse
   * `valueBillions` e `lastUpdated` no topo — formato que nenhuma das APIs
   * configuradas devolve — entao nunca atualizou um unico valor, e mesmo assim
   * disparava 13 requisicoes cross-origin em toda carga da pagina.
   *
   * O refresh agora e scripts/update-all-the-money.mjs, que aplica achados de
   * busca web e so sobrescreve quando a fonte e mais nova que a armazenada.
   */

  return success;
}

// Background data refresh function
async function fetchFreshDataInBackground() {
  try {
    console.log("🔄 Checking for data updates in background...");
    const response = await fetch(
      window.withBase("/datasets/all-the-money/data.json?t=") + Date.now(),
    ); // Cache bust
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const freshData = await response.json();

    // Check if data has changed
    if (
      freshData.metadata.dataVersion !== wealthData.metadata.dataVersion ||
      freshData.metadata.lastUpdated !== wealthData.metadata.lastUpdated
    ) {
      console.log("🆕 New data version detected, updating...");

      // Generate colors for fresh data

      // Update global data
      wealthData = freshData;

      // Cache the fresh data
      saveDataToStorage(wealthData);

      // Refresh UI
      createVisualization();
      createDataSources();

      // Show update notification
      showUpdateNotification(
        `Data updated to version ${freshData.metadata.dataVersion}`,
      );
    } else {
      console.log("✅ Data is current");
    }
  } catch (error) {
    console.warn("⚠️ Background data refresh failed:", error);
  }
}

// Hardcoded fallback data (minimal version)
async function getHardcodedFallbackData() {
  const fallbackData = {
    metadata: {
      lastUpdated: "2025-07-04T00:00:00Z",
      dataVersion: "1.0-fallback",
      currency: "USD",
      baseUnit: "billions",
      blockRepresentation: 100,
    },
    categories: [
      { id: "individual-wealth", name: "Individual Wealth" },
      { id: "digital-assets", name: "Digital Assets" },
      { id: "national-economy", name: "National Economy" },
      { id: "stock-markets", name: "Stock Markets" },
      { id: "debt", name: "Debt" },
      { id: "real-assets", name: "Real Assets" },
      { id: "private-wealth", name: "Private Wealth" },
      { id: "financial-instruments", name: "Financial Instruments" },
    ],
    items: [
      {
        id: "elon-musk",
        slug: "elon-musk-net-worth",
        name: "Elon Musk",
        categoryId: "individual-wealth",
        valueBillions: 240,
        valueFormatted: "240 billion",
        isLiveUpdatable: false,
      },
      {
        id: "crypto-market-cap",
        slug: "cryptocurrency-total-market-cap",
        name: "Cryptocurrency",
        categoryId: "digital-assets",
        valueBillions: 2400,
        valueFormatted: "2.4 trillion",
        isLiveUpdatable: true,
      },
      {
        id: "us-gdp",
        slug: "united-states-gross-domestic-product",
        name: "U.S. GDP",
        categoryId: "national-economy",
        valueBillions: 27000,
        valueFormatted: "27 trillion",
        isLiveUpdatable: true,
      },
      {
        id: "global-equities",
        slug: "global-equities-total-market-cap",
        name: "Global Equities",
        categoryId: "stock-markets",
        valueBillions: 110000,
        valueFormatted: "110 trillion",
        isLiveUpdatable: false,
      },
      {
        id: "global-debt",
        slug: "global-debt-total",
        name: "Global Debt",
        categoryId: "debt",
        valueBillions: 315000,
        valueFormatted: "315 trillion",
        isLiveUpdatable: false,
      },
      {
        id: "global-real-estate",
        slug: "global-real-estate-total-value",
        name: "Global Real Estate",
        categoryId: "real-assets",
        valueBillions: 380000,
        valueFormatted: "380 trillion",
        isLiveUpdatable: false,
      },
      {
        id: "global-private-wealth",
        slug: "global-private-wealth-total",
        name: "Global Private Wealth",
        categoryId: "private-wealth",
        valueBillions: 550000,
        valueFormatted: "550 trillion",
        isLiveUpdatable: false,
      },
      {
        id: "derivatives-notional-value",
        slug: "derivatives-total-notional-value",
        name: "Derivatives (Notional)",
        categoryId: "financial-instruments",
        valueBillions: 715000,
        valueFormatted: "715 trillion",
        isLiveUpdatable: false,
      },
    ],
  };

  // Generate crazy colors for categories and items using the shared function

  return fallbackData;
}

// Parse value string to number in billions (now works with the new data structure)
function parseValue(item) {
  if (typeof item.valueBillions === "number") {
    return item.valueBillions;
  }

  // Fallback to parsing the formatted string if needed
  const valueStr = item.valueFormatted || item.value || "0";
  const cleanStr = valueStr.toLowerCase().replace(/[^0-9.-]/g, "");
  const num = Number.parseFloat(cleanStr);

  if (valueStr.includes("trillion")) {
    return num * 1000;
  }
  return num;
}

// Apply dynamic colors to CSS custom properties
// Get category by ID
function getCategoryById(categoryId) {
  return wealthData.categories.find((cat) => cat.id === categoryId);
}

// Create visualization blocks
/*
 * Um bloco = um <button>. Antes eram <div> sem foco: clique era a unica forma
 * de abrir o detalhe e o tooltip so existia em :hover (WCAG 2.1.1, 4.1.2,
 * 1.4.13).
 *
 * Um tab stop POR ITEM, nao por bloco: 25 mil paradas de Tab seriam pior que
 * nenhuma. O primeiro bloco de cada item carrega o aria-label com nome, valor e
 * quantidade de blocos; os irmaos repetem a mesma informacao, entao saem da
 * ordem de tabulacao e da arvore de acessibilidade.
 */
function createWealthBlock(
  item,
  index,
  totalBlocks,
  itemColor,
  partialBlockRatio,
) {
  const block = document.createElement("button");
  block.type = "button";
  block.className = "block";

  const isPartialBlock = partialBlockRatio < 1 && index === totalBlocks - 1;
  if (isPartialBlock) {
    block.classList.add("small-block");

    // Scale by square root for area-proportional scaling
    // Since area = width x height, scaling by sqrt(ratio) gives us area = ratio
    const areaScale = Math.sqrt(partialBlockRatio);
    block.style.transform = `scale(${areaScale})`;
    block.style.transformOrigin = "top left";
    block.style.display = "inline-block";
    block.style.verticalAlign = "top";
  }

  block.style.backgroundColor = itemColor;
  block.setAttribute("data-tooltip", `${item.name}: $${item.valueFormatted}`);
  block.setAttribute("data-item-id", item.id);
  block.setAttribute("data-item-slug", item.slug);

  if (index === 0) {
    const blockWord = totalBlocks === 1 ? "block" : "blocks";
    block.setAttribute(
      "aria-label",
      `${item.name}: $${item.valueFormatted}, ${totalBlocks} ${blockWord}. Activate for details.`,
    );
  } else {
    block.setAttribute("aria-hidden", "true");
    block.tabIndex = -1;
  }

  return block;
}

/*
 * "Por categoria" segue a ordem curada de data.json (do individuo ao
 * derivativo, a mesma narrativa de escala do Visual Capitalist), e dentro de
 * cada categoria vai do menor ao maior. "value-desc" mistura tudo, do maior
 * ao menor; "value" faz o inverso.
 */
function sortItems(items, sortBy) {
  const rank = (id) => wealthData.categories.findIndex((c) => c.id === id);
  items.sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "category") {
      const byCategory = rank(a.categoryId) - rank(b.categoryId);
      if (byCategory !== 0) return byCategory;
    }
    const bySize = parseValue(a) - parseValue(b);
    return sortBy === "value-desc" ? -bySize : bySize;
  });
}

function textEl(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/* Cabecalho de grupo: o nome da categoria e a frase de contexto dela. */
function buildCategoryHeader(categoryId) {
  const category = getCategoryById(categoryId);
  const header = document.createElement("header");
  header.className = "category-head";
  header.appendChild(textEl("h2", "", category ? category.name : "Other"));
  if (category?.description) {
    header.appendChild(textEl("p", "category-note", category.description));
  }
  return header;
}

/*
 * Rotulo do item: nome, valor e a nota da fonte. Era uma faixa invertida em
 * caixa alta com tudo numa string so, o elemento mais alto da pagina.
 */
function buildItemLabel(item, showCategory) {
  const label = document.createElement("div");
  label.className = "item-label";
  if (showCategory) {
    const category = getCategoryById(item.categoryId);
    label.appendChild(
      textEl("span", "item-tag", category ? category.name : ""),
    );
  }
  label.appendChild(textEl("span", "item-name", item.name));
  label.appendChild(textEl("span", "item-value", `$${item.valueFormatted}`));
  const note = item.dataSource?.notes;
  if (note) label.appendChild(textEl("span", "item-note", note));
  return label;
}

function createVisualization() {
  if (!wealthData) {
    console.error("No data available for visualization");
    return;
  }

  const container = document.getElementById("blocks-container");
  const visualization = container.parentElement; // Get the .visualization container

  container.innerHTML = "";

  // Remove any existing scale reference from visualization
  const existingRef = visualization.querySelector(".scale-reference");
  if (existingRef) {
    existingRef.remove();
  }

  // Get current sort and filter settings
  const sortBy = document.getElementById("sortBy")?.value || "value";
  const searchQuery =
    document.getElementById("searchInput")?.value.toLowerCase() || "";

  // Filter and sort items
  const items = wealthData.items.filter((item) => {
    if (!searchQuery) return true;

    // Support multiple search terms separated by commas
    const searchTerms = searchQuery
      .split(",")
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length > 0);

    // If no valid search terms, show all items
    if (searchTerms.length === 0) return true;

    // Check if any search term matches the item name, slug, or category
    const category = getCategoryById(item.categoryId);
    const categoryName = category ? category.name.toLowerCase() : "";

    return searchTerms.some(
      (term) =>
        item.name.toLowerCase().includes(term) ||
        item.slug.toLowerCase().includes(term) ||
        categoryName.includes(term),
    );
  });

  sortItems(items, sortBy);

  filteredItems = items;

  // Add scale reference item OUTSIDE blocks-container (in visualization container)
  const scaleReference = document.createElement("div");
  scaleReference.className = "scale-reference";
  scaleReference.innerHTML = `
        <div class="scale-label">SCALE REFERENCE:</div>
        <div class="scale-blocks-demo">
            <div class="block reference-block"></div>
            <span class="scale-text">= $${currentScale}B</span>
        </div>
    `;
  // Insert before the blocks-container
  visualization.insertBefore(scaleReference, container);

  // Check if wrapped mode is active
  // O estado mora em aria-pressed; antes era lido do emoji no rotulo.
  const wrapped =
    document.getElementById("toggleWrapped")?.getAttribute("aria-pressed") ===
    "true";

  // Create wrapper div for all blocks if wrapped mode is active
  let blocksWrapper;
  if (wrapped) {
    blocksWrapper = document.createElement("div");
    blocksWrapper.className = "blocks-wrapper";
    container.appendChild(blocksWrapper);
  }

  let blockIndex = 0;
  const styles = getComputedStyle(document.documentElement);
  const shadeFor = createShadePicker(styles);
  const groupByCategory = wrapped && sortBy === "category";
  let lastCategoryId = null;

  for (const item of items) {
    const itemValue = parseValue(item);
    const itemColor = shadeFor(item);

    // Calculate blocks needed - use exact division, not ceiling
    const exactBlocks = itemValue / currentScale;
    const fullBlocks = Math.floor(exactBlocks);
    const remainder = itemValue % currentScale;
    const hasPartialBlock = remainder > 0;
    const totalBlocks = hasPartialBlock ? fullBlocks + 1 : fullBlocks;

    // Calculate partial block size ratio
    const partialBlockRatio = hasPartialBlock ? remainder / currentScale : 1;

    if (groupByCategory && item.categoryId !== lastCategoryId) {
      blocksWrapper.appendChild(buildCategoryHeader(item.categoryId));
      lastCategoryId = item.categoryId;
    }

    if (wrapped) {
      // Create a wrapper div for this item
      const itemWrapper = document.createElement("div");
      itemWrapper.className = "item-wrapper";
      itemWrapper.setAttribute("data-item-name", item.name);

      itemWrapper.appendChild(buildItemLabel(item, !groupByCategory));

      // Create blocks container
      const blocksContainer = document.createElement("div");
      blocksContainer.className = "blocks-container";

      for (let i = 0; i < totalBlocks; i++) {
        blocksContainer.appendChild(
          createWealthBlock(item, i, totalBlocks, itemColor, partialBlockRatio),
        );
        blockIndex++;
      }

      itemWrapper.appendChild(blocksContainer);
      blocksWrapper.appendChild(itemWrapper);
    } else {
      // Original flat view
      for (let i = 0; i < totalBlocks; i++) {
        container.appendChild(
          createWealthBlock(item, i, totalBlocks, itemColor, partialBlockRatio),
        );
        blockIndex++;
      }
    }
  }

  updateStatistics();
  updatePageTitle();
}

// Update statistics
function updateStatistics() {
  if (!wealthData) return;

  const totalValue = filteredItems.reduce(
    (sum, item) => sum + parseValue(item),
    0,
  );
  const totalItems = filteredItems.length;
  const liveItems = filteredItems.filter((item) => item.isLiveUpdatable).length;
  const totalBlocks = filteredItems.reduce((sum, item) => {
    const itemValue = parseValue(item);
    const fullBlocks = Math.floor(itemValue / currentScale);
    const remainder = itemValue % currentScale;
    const hasPartialBlock = remainder > 0;
    return sum + (hasPartialBlock ? fullBlocks + 1 : fullBlocks);
  }, 0);

  document.getElementById("totalValue").textContent =
    formatLargeNumber(totalValue);
  document.getElementById("totalItems").textContent =
    totalItems.toLocaleString();
  document.getElementById("liveItems").textContent = liveItems.toLocaleString();
  document.getElementById("statsBlocks").textContent =
    totalBlocks.toLocaleString();

  // Update header block count
  const headerTotalBlocks = document.getElementById("totalBlocks");
  if (headerTotalBlocks) {
    headerTotalBlocks.textContent = totalBlocks.toLocaleString();
  }
}

// Format large numbers
function formatLargeNumber(billions) {
  if (billions >= 1000000) {
    return `$${(billions / 1000000).toFixed(1)}Q`; // Quadrillion
  }
  if (billions >= 1000) {
    return `$${(billions / 1000).toFixed(1)}T`; // Trillion
  }
  return `$${billions.toFixed(0)}B`; // Billion
}

// Update page title with current filter info
function updatePageTitle() {
  const totalBlocks = filteredItems.reduce((sum, item) => {
    const itemValue = parseValue(item);
    const fullBlocks = Math.floor(itemValue / currentScale);
    const remainder = itemValue % currentScale;
    const hasPartialBlock = remainder > 0;
    return sum + (hasPartialBlock ? fullBlocks + 1 : fullBlocks);
  }, 0);

  const baseText = `Each block = $${currentScale} billion USD`;
  const filterInfo =
    filteredItems.length < wealthData.items.length
      ? ` • Showing ${filteredItems.length}/${wealthData.items.length} items`
      : "";
  const blockInfo = ` • ${totalBlocks.toLocaleString()} blocks`;

  // So o texto: escrever no <p> inteiro apagava o bloco de amostra ao lado.
  const summary = document.getElementById("atm-summary");
  if (summary) summary.textContent = baseText + filterInfo + blockInfo;
}

/*
 * Detalhes do item num <dialog> da pagina, nao num alert(): o navegador ja
 * prende o foco, fecha com Esc e devolve o foco ao bloco. Mostra tambem a
 * metodologia completa (dataSource.method), que antes nao aparecia em lugar
 * nenhum, e um botao que leva o item para a comparacao.
 */
const DETAILS_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function fact(label, value) {
  const row = document.createElement("div");
  row.appendChild(textEl("dt", "", label));
  row.appendChild(textEl("dd", "", value));
  return row;
}

function blocksText(item) {
  const blocks = parseValue(item) / currentScale;
  if (blocks < 1) return `${blocks.toFixed(2)} of a block`;
  return `${Math.ceil(blocks).toLocaleString()} blocks`;
}

function showItemDetails(item) {
  const dialog = document.getElementById("item-details");
  if (!dialog) return;
  const source = item.dataSource || {};
  const category = getCategoryById(item.categoryId);
  dialog.dataset.itemId = item.id;
  dialog.querySelector(".details-title").textContent = item.name;
  dialog.querySelector(".details-value").textContent =
    `$${item.valueFormatted}`;
  dialog
    .querySelector(".details-facts")
    .replaceChildren(
      fact("Category", category ? category.name : "Other"),
      fact("As of", DETAILS_DATE.format(new Date(item.lastUpdated))),
      fact("Size", blocksText(item)),
    );
  dialog.querySelector(".details-note").textContent = source.notes || "";
  const method = dialog.querySelector(".details-method");
  method.hidden = !source.method;
  method.querySelector("p").textContent = source.method || "";
  const link = dialog.querySelector(".details-source");
  link.hidden = !source.url;
  link.href = source.url || "";
  link.textContent = `Source: ${source.provider || source.url || ""}`;
  dialog.showModal();
}

function bindDetailsDialog() {
  const dialog = document.getElementById("item-details");
  if (!dialog) return;
  dialog.addEventListener("click", (e) => {
    // Clique no fundo (fora da caixa) fecha, como Esc.
    if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
  });
  // Ao fechar, o foco volta ao primeiro bloco do item (o focavel; os outros
  // sao aria-hidden). Buscado pelo id na hora, nao guardado: um re-render no
  // meio troca os nos. Adiado um tique porque, quando "close" dispara, o resto
  // da pagina ainda esta inerte e o focus() seria ignorado.
  dialog.addEventListener("close", () => {
    const id = CSS.escape(dialog.dataset.itemId || "");
    setTimeout(() =>
      document.querySelector(`.block[data-item-id="${id}"]`)?.focus(),
    );
  });
  dialog.querySelector(".details-compare").addEventListener("click", () => {
    const item = wealthData?.items.find(
      (it) => it.id === dialog.dataset.itemId,
    );
    if (item) toggleComparison(item);
    dialog.close();
  });
}

// Create data sources section
function createDataSources() {
  if (!wealthData) return;

  const dataSources = document.getElementById("data-sources");
  dataSources.innerHTML = "";

  // Add metadata info
  const metadataDiv = document.createElement("div");
  metadataDiv.className = "metadata-info";

  // Check if data is from cache
  const cacheStatus = getCacheStatus();

  metadataDiv.innerHTML = `
        <h3>Dataset Information</h3>
        <p><strong>Version:</strong> ${wealthData.metadata.dataVersion}</p>
        <p><strong>Last Updated:</strong> ${new Date(wealthData.metadata.lastUpdated).toLocaleDateString()}</p>
        <p><strong>Currency:</strong> ${wealthData.metadata.currency}</p>
        <p><strong>Each Block Represents:</strong> $${wealthData.metadata.blockRepresentation} billion</p>
        <p><strong>Cache Status:</strong> ${cacheStatus}</p>
    `;
  dataSources.appendChild(metadataDiv);

  // Group by category
  const groupedByCategory = {};
  for (const item of wealthData.items) {
    const category = getCategoryById(item.categoryId);
    const categoryName = category ? category.name : "Unknown";
    if (!groupedByCategory[categoryName]) {
      groupedByCategory[categoryName] = [];
    }
    groupedByCategory[categoryName].push(item);
  }

  for (const [categoryName, items] of Object.entries(groupedByCategory)) {
    const categorySection = document.createElement("div");
    categorySection.className = "category-section";

    const categoryTitle = document.createElement("div");
    categoryTitle.className = "category-title";
    categoryTitle.textContent = categoryName;
    categorySection.appendChild(categoryTitle);

    for (const item of items) {
      const category = getCategoryById(item.categoryId);
      const itemDiv = document.createElement("div");
      itemDiv.className = "item";

      const dataSource = item.dataSource || {};
      const apiStatus = item.isLiveUpdatable ? "🟢 Live" : "🔴 Manual";
      const lastUpdated = new Date(item.lastUpdated).toLocaleDateString();

      itemDiv.innerHTML = `
                <div class="item-name">${item.name} ${apiStatus}</div>
                <div class="item-value">$${item.valueFormatted}</div>
                <div class="item-api">Source: ${dataSource.provider || "Unknown"}</div>
                <div class="item-api">Updated: ${lastUpdated}</div>
                <div class="item-api">Slug: <code>${item.slug}</code></div>
                ${dataSource.url ? `<div class="item-api"><a href="${dataSource.url}" target="_blank" rel="noopener">${dataSource.url}</a></div>` : ""}
            `;

      categorySection.appendChild(itemDiv);
    }

    dataSources.appendChild(categorySection);
  }
}

// Intelligently merge cached data with JSON data
/*
 * O mais novo vence, item a item. Antes, quem ja tinha visitado carregava o
 * cache inteiro (valores, nomes e categorias) e o data.json so acrescentava
 * item que faltava: atualizar o arquivo nunca chegava a essas pessoas, e item
 * removido ficava para sempre. Agora a estrutura vem sempre do JSON, e o valor
 * do cache so fica quando a data dele e mais recente que a do JSON.
 */
function mergeDataIntelligently(cachedData, jsonData) {
  const cachedById = new Map(cachedData.items.map((item) => [item.id, item]));
  const items = jsonData.items.map((jsonItem) => {
    const cached = cachedById.get(jsonItem.id);
    const cacheIsNewer =
      cached &&
      Date.parse(cached.lastUpdated) > Date.parse(jsonItem.lastUpdated);
    if (!cacheIsNewer) return jsonItem;
    return {
      ...jsonItem,
      valueBillions: cached.valueBillions,
      valueFormatted: cached.valueFormatted,
      lastUpdated: cached.lastUpdated,
    };
  });
  return { ...jsonData, items };
}

// Comparison functionality
function toggleComparison(item) {
  const index = comparisonItems.findIndex((i) => i.id === item.id);

  if (index === -1) {
    comparisonItems.push(item);
  } else {
    comparisonItems.splice(index, 1);
  }

  updateComparisonView();
  highlightComparisonBlocks();
}

function updateComparisonView() {
  const comparisonMode = document.getElementById("comparison-mode");
  const comparisonContainer = document.getElementById("comparison-items");

  if (comparisonItems.length === 0) {
    comparisonMode.classList.add("hidden");
    return;
  }

  comparisonMode.classList.remove("hidden");
  comparisonContainer.innerHTML = "";

  // Sort comparison items by value
  const sortedComparison = [...comparisonItems].sort(
    (a, b) => parseValue(b) - parseValue(a),
  );

  for (const item of sortedComparison) {
    const category = getCategoryById(item.categoryId);
    const blocks = Math.ceil(parseValue(item) / currentScale);
    const ratio = parseValue(item) / parseValue(sortedComparison[0]);

    const itemDiv = document.createElement("div");
    itemDiv.className = "comparison-item";
    itemDiv.innerHTML = `
            <h4>${item.name}</h4>
            <div class="comparison-value">$${item.valueFormatted}</div>
            <div class="comparison-category">${category ? category.name : "Unknown"}</div>
            <div class="comparison-blocks">${blocks.toLocaleString()} blocks</div>
            <div class="comparison-ratio">${(ratio * 100).toFixed(1)}% of largest</div>
            <button type="button" class="btn-secondary" onclick="removeFromComparison('${item.id}')">Remove</button>
        `;
    comparisonContainer.appendChild(itemDiv);
  }
}

function removeFromComparison(itemId) {
  comparisonItems = comparisonItems.filter((item) => item.id !== itemId);
  updateComparisonView();
  highlightComparisonBlocks();
}

function clearComparison() {
  comparisonItems = [];
  updateComparisonView();
  highlightComparisonBlocks();
}

function highlightComparisonBlocks() {
  // Remove existing highlights
  for (const block of document.querySelectorAll(".block.highlight")) {
    block.classList.remove("highlight");
  }

  // Add highlights for comparison items
  for (const item of comparisonItems) {
    for (const block of document.querySelectorAll(
      `[data-item-id="${item.id}"]`,
    )) {
      block.classList.add("highlight");
    }
  }
}

// Search and filter functionality
/*
 * Um par de ouvintes no conteiner, nao dois por bloco. Com 25 mil blocos
 * eram 50 mil closures recriadas a cada re-render (busca, ordem, modo
 * agrupado); o bloco ja carrega data-item-id, entao o item sai dali.
 */
function bindBlockEvents(container) {
  const itemFor = (target) => {
    const block = target.closest?.(".block");
    if (!block || !container.contains(block)) return null;
    const id = block.getAttribute("data-item-id");
    return wealthData?.items.find((it) => String(it.id) === id) ?? null;
  };

  container.addEventListener("click", (e) => {
    const item = itemFor(e.target);
    if (!item) return;
    if (e.ctrlKey || e.metaKey) {
      toggleComparison(item);
    } else {
      showItemDetails(item);
    }
  });

  /*
   * O click sintetizado pelo teclado nao carrega o modificador, entao
   * Ctrl/Cmd+Enter precisa de tratamento proprio — sem ele, adicionar a
   * comparacao seria exclusivo do mouse.
   */
  container.addEventListener("keydown", (e) => {
    const modified = e.ctrlKey || e.metaKey;
    if (!modified || (e.key !== "Enter" && e.key !== " ")) return;
    const item = itemFor(e.target);
    if (!item) return;
    e.preventDefault();
    toggleComparison(item);
  });
}

function initializeControls() {
  const blocksContainer = document.getElementById("blocks-container");
  if (blocksContainer) bindBlockEvents(blocksContainer);
  bindDetailsDialog();

  // Add event listeners
  const searchInput = document.getElementById("searchInput");
  const sortBy = document.getElementById("sortBy");
  const toggleWrapped = document.getElementById("toggleWrapped");
  const exportData = document.getElementById("exportData");
  const clearComparisonBtn = document.getElementById("clearComparison");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(createVisualization, 300));
  }

  if (sortBy) {
    sortBy.addEventListener("change", createVisualization);
  }

  if (toggleWrapped) {
    toggleWrapped.addEventListener("click", () => {
      const isWrapped = toggleWrapped.getAttribute("aria-pressed") === "true";
      toggleWrapped.setAttribute("aria-pressed", String(!isWrapped));
      createVisualization();
    });
  }

  if (exportData) {
    exportData.addEventListener("click", exportCurrentData);
  }

  if (clearComparisonBtn) {
    clearComparisonBtn.addEventListener("click", clearComparison);
  }
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export functionality
function exportCurrentData() {
  const exportData = {
    metadata: wealthData.metadata,
    filteredItems: filteredItems.map((item) => ({
      name: item.name,
      slug: item.slug,
      category: getCategoryById(item.categoryId)?.name,
      value: item.valueFormatted,
      valueBillions: parseValue(item),
      lastUpdated: item.lastUpdated,
      isLiveUpdatable: item.isLiveUpdatable,
    })),
    statistics: {
      totalValue: filteredItems.reduce(
        (sum, item) => sum + parseValue(item),
        0,
      ),
      totalItems: filteredItems.length,
      liveItems: filteredItems.filter((item) => item.isLiveUpdatable).length,
      exportDate: new Date().toISOString(),
    },
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wealth-data-export-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Keyboard shortcuts
function initializeKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // O handler vive no document e sobrevive a navegacao no cliente;
    // fora desta pagina os atalhos nao valem.
    if (!document.getElementById("visualization")) return;

    // Ctrl/Cmd + F: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      document.getElementById("searchInput")?.focus();
    }

    // Escape: Clear search and comparison. Nao com um dialogo aberto: ali o
    // Esc so fecha o dialogo, e limpar a busca junto apagaria o filtro de quem
    // so queria fechar o painel de detalhes.
    if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.value = "";
        createVisualization();
      }
      clearComparison();
    }

    // Ctrl/Cmd + E: Export data
    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
      e.preventDefault();
      exportCurrentData();
    }

    // Ctrl/Cmd + Shift + C: Clear cache
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
      e.preventDefault();
      clearDataCache();
    }
  });
}

function getCacheStatus() {
  try {
    const cached = localStorage.getItem("wealthData-cache");
    if (!cached) return "❌ No cache";

    const cacheData = JSON.parse(cached);
    const cacheAge = Date.now() - cacheData.timestamp;
    const ageMinutes = Math.round(cacheAge / 1000 / 60);

    if (ageMinutes < 60) {
      return `✅ Cached (${ageMinutes}m ago)`;
    }
    const ageHours = Math.round(ageMinutes / 60);
    return `✅ Cached (${ageHours}h ago)`;
  } catch (error) {
    return "❌ Cache error";
  }
}

function clearDataCache() {
  try {
    localStorage.removeItem("wealthData-cache");
    showUpdateNotification("🗑️ Cache cleared");
    console.log("🗑️ Data cache cleared");
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
}

async function forceDataRefresh() {
  try {
    showUpdateNotification("🔄 Forcing data refresh...");
    clearDataCache();
    await loadData();
    createVisualization();
    createDataSources();
    showUpdateNotification("✅ Data refreshed");
  } catch (error) {
    showUpdateNotification("❌ Refresh failed");
    console.error("Failed to force refresh:", error);
  }
}

// Enhanced dark mode and theme management
// Simplified - removed theme and scale controls

// Update notification system
function showUpdateNotification(message) {
  // Create notification element if it doesn't exist
  let notification = document.getElementById("updateNotification");
  if (!notification) {
    notification = document.createElement("div");
    notification.id = "updateNotification";
    notification.className = "update-notification";
    document.body.appendChild(notification);
  }

  notification.textContent = message;
  notification.style.opacity = "1";

  setTimeout(() => {
    notification.style.opacity = "0";
  }, 4000);
}

// Enhanced tooltip with credibility indicators
function getCredibilityIndicator(item) {
  if (!item.apiConfig && !item.isLiveUpdatable) {
    return { icon: "⚪", level: "static", text: "Static data" };
  }

  const daysSinceUpdate = item.lastUpdated
    ? Math.floor(
        (Date.now() - new Date(item.lastUpdated).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 999;

  if (item.isLiveUpdatable && daysSinceUpdate <= 1) {
    return { icon: "🟢", level: "high", text: "Live data (updated today)" };
  }
  if (item.isLiveUpdatable && daysSinceUpdate <= 7) {
    return {
      icon: "🟡",
      level: "medium",
      text: `Updated ${daysSinceUpdate} days ago`,
    };
  }
  return { icon: "🔴", level: "low", text: "Data may be outdated" };
}

function createEnhancedTooltip(item) {
  const credibility = getCredibilityIndicator(item);
  const category = wealthData.categories.find((c) => c.id === item.categoryId);
  const blocks = Math.ceil(item.valueBillions / currentScale);

  return `
        <strong>${item.name}</strong><br>
        Value: ${item.valueFormatted}<br>
        Category: ${category?.name || "Unknown"}<br>
        Blocks: ${blocks.toLocaleString()}<br>
        <div class="tooltip-credibility">
            <span class="credibility-indicator credibility-${credibility.level}">${credibility.icon}</span>
            <span>${credibility.text}</span>
        </div>
        <small>Source: ${item.dataSource || "N/A"}</small>
    `;
}

// Toggle data sources visibility
function initializeDataSourcesToggle() {
  const toggleButton = document.getElementById("toggleDataSources");
  const sourcesContent = document.getElementById("data-sources");

  if (toggleButton && sourcesContent) {
    toggleButton.addEventListener("click", () => {
      const isHidden = sourcesContent.classList.contains("hidden");
      if (isHidden) {
        sourcesContent.classList.remove("hidden");
        toggleButton.textContent = "Hide sources";
        toggleButton.setAttribute("aria-expanded", "true");
      } else {
        sourcesContent.classList.add("hidden");
        toggleButton.textContent = "Data sources";
        toggleButton.setAttribute("aria-expanded", "false");
      }
    });
  }
}

/*
 * ClientRouter: o documento nao recarrega e este script so executa uma vez por
 * sessao, entao DOMContentLoaded nao serve. astro:page-load dispara na primeira
 * carga e depois de cada navegacao.
 */
let keyboardShortcutsBound = false;

document.addEventListener("astro:page-load", async () => {
  // Fora desta pagina nao ha nada para montar.
  if (!document.getElementById("visualization")) return;

  // Load data
  const loadSuccess = await loadData();

  if (wealthData) {
    // Initialize all controls and features
    initializeControls();
    // Os atalhos ficam pendurados no document, que sobrevive a troca de
    // pagina — rebindar a cada navegacao empilharia handlers.
    if (!keyboardShortcutsBound) {
      initializeKeyboardShortcuts();
      keyboardShortcutsBound = true;
    }
    initializeDataSourcesToggle();

    // createVisualization() já é chamado dentro de loadData agora,
    // mas chamamos aqui de novo para garantir que tudo está pronto
    // caso loadData() tenha carregado apenas do cache inicialmente.
    createVisualization();
    createDataSources();

    // Removido monitorDataUpdates pois a lógica de API já está em loadData
    // console.log('🔍 Checking APIs for data freshness...');
    // setTimeout(() => monitorDataUpdates(), 3000); // Delay after page load

    if (!loadSuccess) {
      console.warn(
        "Usando dados parcialmente carregados ou fallback - algumas funcionalidades podem ser limitadas",
      );
    }
  } else {
    console.error("Falha ao carregar qualquer dado.");
    document.getElementById("visualization").innerHTML =
      "<p>Falha ao carregar dados. Por favor, recarregue a página.</p>";
  }
});

// Simplified keyboard navigation - Ctrl+R refreshes
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("visualization")) return;
  if (e.key === "r" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    location.reload(); // Simple refresh/reset
  }
});
