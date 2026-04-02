interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  market_cap: number;
  market_cap_rank?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
}

interface LanguageTexts {
  searchPlaceholder: string;
  subtitle: string;
  adminHeader: string;
  createBlacklist: string;
  position: string;
  select: string;
  coin: string;
  price: string;
  marketCap: string;
  topCoins: string;
  coins: string;
  noCoinsSelected: string;
  flag: string;
  loading: string;
  errorLoading: string;
  rank: string;
  priceLabel: string;
  marketCapLabel: string;
  volume24h: string;
  change24h: string;
  circulatingSupply: string;
  totalSupply: string;
  viewOnCoingecko: string;
}

// === CONFIG ===
const ENABLE_MODAL = true;

// === STATE ===
const cryptoData = new Map<string, CoinData>();
let blacklistSet = new Set<string>();
const checkedItems = new Set<string>();

// === ADMIN MODE ===
let isAdminMode = false;
let enterPressCount = 0;
let lastEnterTime = 0;

// === LANGUAGE ===
let currentLanguage: "pt" | "en" = "pt";

// === THEME ===
// Managed by global ThemeToggle, but we can listen to changes if needed.
// Or we can just rely on global CSS variables.

// === TEXTS ===
const texts: Record<"pt" | "en", LanguageTexts> = {
  pt: {
    searchPlaceholder: "Pesquisar criptomoedas...",
    subtitle:
      "~as 100 melhores~ criptomoedas, desconsiderando stablecoins e staked ativos",
    adminHeader:
      "MODO ADMIN ATIVO - Mostrando TODAS as moedas (incluindo blacklisted)",
    createBlacklist: "Criar Blacklist",
    position: "#",
    select: "Selecionar",
    coin: "Moeda",
    price: "Preço",
    marketCap: "Market Cap",
    topCoins: "Top",
    coins: "moedas",
    noCoinsSelected: "Nenhuma moeda selecionada!",
    flag: "🇺🇸",
    loading: "Carregando...",
    errorLoading: "Erro ao carregar dados da moeda.",
    rank: "Rank:",
    priceLabel: "Preço:",
    marketCapLabel: "Market Cap:",
    volume24h: "Volume 24h:",
    change24h: "Variação 24h:",
    circulatingSupply: "Supply Circulante:",
    totalSupply: "Supply Total:",
    viewOnCoingecko: "Ver no CoinGecko",
  },
  en: {
    searchPlaceholder: "Search cryptocurrencies...",
    subtitle:
      "~top 100 best~ cryptocurrencies, excluding stablecoins and staked assets",
    adminHeader:
      "ADMIN MODE ACTIVE - Showing ALL coins (including blacklisted)",
    createBlacklist: "Create Blacklist",
    position: "#",
    select: "Select",
    coin: "Coin",
    price: "Price",
    marketCap: "Market Cap",
    topCoins: "Top",
    coins: "coins",
    noCoinsSelected: "No coins selected!",
    flag: "🇧🇷",
    loading: "Loading...",
    errorLoading: "Error loading coin data.",
    rank: "Rank:",
    priceLabel: "Price:",
    marketCapLabel: "Market Cap:",
    volume24h: "Volume 24h:",
    change24h: "24h Change:",
    circulatingSupply: "Circulating Supply:",
    totalSupply: "Total Supply:",
    viewOnCoingecko: "View on CoinGecko",
  },
};

// === CACHE ===
let cachedData: CoinData[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30s
const STORAGE_KEY = "crypto_market_data";
const STORAGE_TIME_KEY = "crypto_market_data_time";

// === INTERVAL ===
let updateInterval: ReturnType<typeof setInterval>;

// === INIT ===
document.addEventListener("DOMContentLoaded", async () => {
  await loadBlacklist();
  loadFromLocalStorage();
  await fetchCryptoData();
  startPeriodicUpdate();
  setupEventListeners();
  setupModalEvents();
  updateLanguage();

  // Sync theme toggle button with global theme
  updateThemeButton();
});

// === DATA LOADING ===

async function loadBlacklist() {
  try {
    const response = await fetch("/datasets/sem-melhores/blacklist.json");
    if (response.ok) {
      const blacklistArray: string[] = await response.json();
      blacklistSet = new Set(blacklistArray.map((item) => item.toLowerCase()));
    }
  } catch (error) {
    console.log("Blacklist not found, using empty list");
    blacklistSet = new Set();
  }
}

async function fetchCryptoData() {
  if (isValidCache()) {
    console.log("Using in-memory cache");
    loadDataFromCache();
    return;
  }

  try {
    console.log("Fetching new data from API...");
    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1",
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: CoinData[] = await response.json();
    cacheData(data);
    saveToLocalStorage(data);
    loadDataFromCache();
  } catch (error) {
    console.error("Error fetching API data:", error);

    if (cachedData) {
      console.log("Using in-memory cache due to error");
      loadDataFromCache();
    } else {
      const localData = loadFromLocalStorage();
      if (localData) {
        console.log("Using localStorage as fallback");
        cacheData(localData);
        loadDataFromCache();
      } else {
        console.log("No data available, loading example data");
        loadExampleData();
      }
    }
  }
}

function isValidCache() {
  return cachedData && Date.now() - lastFetchTime < CACHE_DURATION;
}

function cacheData(data: CoinData[]) {
  cachedData = data;
  lastFetchTime = Date.now();
}

function loadDataFromCache() {
  if (!cachedData) return;
  cryptoData.clear();
  cachedData.forEach((coin) => {
    cryptoData.set(coin.symbol.toLowerCase(), coin);
  });
  renderCryptoList();
}

// === LOCALSTORAGE ===

function loadFromLocalStorage(): CoinData[] | null {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    const storedTime = localStorage.getItem(STORAGE_TIME_KEY);

    if (storedData && storedTime) {
      const data: CoinData[] = JSON.parse(storedData);
      const time = Number.parseInt(storedTime);

      const isRecent = Date.now() - time < 60000; // 1 min

      if (isRecent) {
        console.log("Loading recent data from localStorage");
        cacheData(data);
        loadDataFromCache();
        return data;
      }
      console.log("localStorage data is old, will be updated");
      return data;
    }
  } catch (error) {
    console.error("Error loading from localStorage:", error);
  }

  return null;
}

function saveToLocalStorage(data: CoinData[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
    console.log("Data saved to localStorage");
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

function loadExampleData() {
  const exampleData: CoinData[] = [
    {
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      current_price: 109913,
      market_cap: 2185947661260,
      market_cap_rank: 1,
    },
    {
      id: "ethereum",
      symbol: "eth",
      name: "Ethereum",
      current_price: 2594.34,
      market_cap: 313212362848,
      market_cap_rank: 2,
    },
    {
      id: "tether",
      symbol: "usdt",
      name: "Tether",
      current_price: 1.0,
      market_cap: 158317941626,
      market_cap_rank: 3,
    },
    {
      id: "ripple",
      symbol: "xrp",
      name: "XRP",
      current_price: 2.28,
      market_cap: 134529297963,
      market_cap_rank: 4,
    },
    {
      id: "binancecoin",
      symbol: "bnb",
      name: "BNB",
      current_price: 662.42,
      market_cap: 96640936664,
      market_cap_rank: 5,
    },
  ];

  console.log("Loading example data...");
  exampleData.forEach((coin) => {
    cryptoData.set(coin.symbol.toLowerCase(), coin);
  });
  renderCryptoList();
}

// === RENDERING ===

function renderCryptoList(filterText = "") {
  const container = document.getElementById("cryptoList");
  if (!container) return;
  container.innerHTML = "";

  if (isAdminMode) {
    const adminHeader = document.createElement("div");
    adminHeader.className = "admin-header";
    adminHeader.textContent = texts[currentLanguage].adminHeader;
    container.appendChild(adminHeader);

    const button = document.createElement("button");
    button.textContent = texts[currentLanguage].createBlacklist;
    button.onclick = createBlacklist;
    container.appendChild(button);
  }

  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const coins = getFilteredCoins(filterText);
  const totalCount = isAdminMode
    ? `${coins.length} ${texts[currentLanguage].coins}`
    : `${texts[currentLanguage].topCoins} ${coins.length} ${texts[currentLanguage].coins}`;

  thead.innerHTML = `
    <tr>
      <th class="text-center">${texts[currentLanguage].position}</th>
      ${isAdminMode ? `<th class="text-center">${texts[currentLanguage].select}</th>` : ""}
      <th class="text-left">${texts[currentLanguage].coin} (${totalCount})</th>
      <th class="text-right">${texts[currentLanguage].price}</th>
      <th class="text-right column-marketcap">${texts[currentLanguage].marketCap}</th>
      <th class="text-right column-volume">${texts[currentLanguage].volume24h}</th>
      <th class="text-right column-change">${texts[currentLanguage].change24h}</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  coins.forEach((coin, index) => {
    const row = createCoinRow(coin, index + 1);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  if (isAdminMode && checkedItems.size > 0) {
    console.log(
      `Checked items: ${Array.from(checkedItems).join(", ").toUpperCase()}`,
    );
  }
}

function createCoinRow(coin: CoinData, position: number): HTMLTableRowElement {
  const row = document.createElement("tr");
  const isBlacklisted = blacklistSet.has(coin.symbol.toLowerCase());

  if (isAdminMode && isBlacklisted) {
    row.className = "blacklisted-row";
  }

  const positionCell = document.createElement("td");
  positionCell.className = "text-center";
  positionCell.textContent = `#${position}`;

  const coinCell = document.createElement("td");
  coinCell.className = "text-left";

  const coinContainer = document.createElement("div");
  coinContainer.className = "coin-container";

  if (coin.image) {
    const img = document.createElement("img");
    img.src = coin.image;
    img.alt = coin.name;
    img.className = "coin-image";
    coinContainer.appendChild(img);
  }

  const link = document.createElement("a");

  if (ENABLE_MODAL) {
    link.href = "#";
    link.onclick = (e) => {
      e.preventDefault();
      showCoinModal(coin.id);
    };
  } else {
    link.href = `https://www.coingecko.com/en/coins/${coin.id}`;
    link.target = "_blank";
  }

  let nameContent = `${coin.symbol.toUpperCase()} ${coin.name}`;
  if (isAdminMode && isBlacklisted) {
    nameContent = `${nameContent} (BLACKLISTED)`;
  }

  link.textContent = nameContent;
  coinContainer.appendChild(link);
  coinCell.appendChild(coinContainer);

  const priceCell = document.createElement("td");
  priceCell.className = "text-right";
  priceCell.textContent = formatPrice(coin.current_price);

  const marketCapCell = document.createElement("td");
  marketCapCell.className = "text-right column-marketcap";
  marketCapCell.textContent = formatMarketCap(coin.market_cap);

  const volumeCell = document.createElement("td");
  volumeCell.className = "text-right column-volume";
  volumeCell.textContent = formatMarketCap(coin.total_volume || 0);

  const changeCell = document.createElement("td");
  changeCell.className = "text-right column-change";
  const change24h = coin.price_change_percentage_24h || 0;
  const changeColor = change24h >= 0 ? "var(--accent-gold)" : "#ff0000";
  changeCell.style.color = changeColor;
  changeCell.textContent = `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`;

  let checkboxCell: HTMLTableCellElement | null = null;
  if (isAdminMode) {
    checkboxCell = document.createElement("td");
    checkboxCell.className = "text-center";
    const checkbox = createCheckbox(coin.symbol.toLowerCase(), isBlacklisted);
    checkboxCell.appendChild(checkbox);
  }

  row.appendChild(positionCell);
  if (isAdminMode && checkboxCell) {
    row.appendChild(checkboxCell);
  }
  row.appendChild(coinCell);
  row.appendChild(priceCell);
  row.appendChild(marketCapCell);
  row.appendChild(volumeCell);
  row.appendChild(changeCell);

  return row;
}

function getFilteredCoins(filterText: string): CoinData[] {
  let filteredCoins = Array.from(cryptoData.values());

  if (isAdminMode) {
    if (filterText) {
      const term = filterText.toLowerCase();
      filteredCoins = filteredCoins.filter(
        (coin) =>
          coin.symbol.toLowerCase().includes(term) ||
          coin.name.toLowerCase().includes(term),
      );
    }
  } else {
    filteredCoins = filteredCoins
      .filter((coin) => {
        if (blacklistSet.has(coin.symbol.toLowerCase())) {
          return false;
        }

        if (filterText) {
          const term = filterText.toLowerCase();
          return (
            coin.symbol.toLowerCase().includes(term) ||
            coin.name.toLowerCase().includes(term)
          );
        }

        return true;
      })
      .slice(0, 100);
  }

  return filteredCoins.sort((a, b) => b.market_cap - a.market_cap);
}

function createCheckbox(
  symbol: string,
  isBlacklisted = false,
): HTMLInputElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.dataset.symbol = symbol;

  if (isBlacklisted) {
    checkbox.checked = true;
    checkedItems.add(symbol);
  } else {
    checkbox.checked = checkedItems.has(symbol);
  }

  checkbox.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (target.checked) {
      checkedItems.add(symbol);
      console.log(
        `Checked: ${symbol.toUpperCase()} (Total: ${checkedItems.size})`,
      );
    } else {
      checkedItems.delete(symbol);
      console.log(
        `Unchecked: ${symbol.toUpperCase()} (Total: ${checkedItems.size})`,
      );
    }
  });

  return checkbox;
}

// === UTILS ===

function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
  if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
  if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
  if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(2)}K`;
  return `$${marketCap.toFixed(2)}`;
}

function formatPrice(price: number): string {
  if (typeof price !== "number" || Number.isNaN(price)) return "N/A";

  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  const formatted = Number.parseFloat(price.toPrecision(2));
  return `$${formatted}`;
}

// === EVENT LISTENERS ===

function setupEventListeners() {
  const searchInput = document.getElementById(
    "searchInput",
  ) as HTMLInputElement | null;
  const languageToggle = document.getElementById(
    "languageToggle",
  ) as HTMLButtonElement | null;

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      renderCryptoList(target.value);
    });

    searchInput.addEventListener("keypress", handleAdminMode);
  }

  if (languageToggle) {
    languageToggle.addEventListener("click", toggleLanguage);
  }

  // Listen for global theme changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "data-theme") {
        updateThemeButton();
      }
    });
  });

  observer.observe(document.documentElement, { attributes: true });

  // Add click handler for the local theme toggle button
  const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement | null;
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      if (isLight) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
      }
      updateThemeButton();
    });
  }
}

function handleAdminMode(e: KeyboardEvent) {
  if (e.key !== "Enter") return;

  const currentTime = Date.now();
  const input = (e.target as HTMLInputElement).value.toLowerCase();

  if (input === "admin") {
    if (currentTime - lastEnterTime < 1000) {
      enterPressCount++;
      if (enterPressCount >= 2) {
        activateAdminMode();
        enterPressCount = 0;
      }
    } else {
      enterPressCount = 1;
    }
    lastEnterTime = currentTime;
  } else {
    enterPressCount = 0;
  }
}

// === ADMIN MODE ===

function activateAdminMode() {
  isAdminMode = true;

  checkedItems.clear();
  blacklistSet.forEach((symbol) => {
    checkedItems.add(symbol);
  });

  const searchInput = document.getElementById(
    "searchInput",
  ) as HTMLInputElement | null;
  if (searchInput) searchInput.value = "";

  renderCryptoList();
  console.log("Admin mode activated - blacklist loaded into checkboxes");
}

function createBlacklist() {
  const selectedSymbols = Array.from(checkedItems);

  if (selectedSymbols.length === 0) {
    alert(texts[currentLanguage].noCoinsSelected);
    return;
  }

  const json = JSON.stringify(selectedSymbols, null, 2);
  downloadFile(json, "blacklist.json");

  blacklistSet = new Set(selectedSymbols);
  checkedItems.clear();
  renderCryptoList();

  console.log("Blacklist created:", selectedSymbols);
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// === AUTO UPDATE ===

function startPeriodicUpdate() {
  updateInterval = setInterval(fetchCryptoData, 60000);
}

// === LANGUAGE ===

function toggleLanguage() {
  currentLanguage = currentLanguage === "pt" ? "en" : "pt";
  updateLanguage();
  renderCryptoList();
}

function updateLanguage() {
  const searchInput = document.getElementById(
    "searchInput",
  ) as HTMLInputElement | null;
  if (searchInput) {
    searchInput.placeholder = texts[currentLanguage].searchPlaceholder;
  }

  const subtitle = document.querySelector(".subtitle");
  if (subtitle) {
    subtitle.textContent = texts[currentLanguage].subtitle;
  }

  const languageToggle = document.getElementById(
    "languageToggle",
  ) as HTMLButtonElement | null;
  if (languageToggle) {
    languageToggle.textContent = texts[currentLanguage].flag;
  }

  document.documentElement.lang = currentLanguage === "pt" ? "pt-BR" : "en";
}

// === THEME ===

function updateThemeButton() {
  const themeToggle = document.getElementById(
    "themeToggle",
  ) as HTMLButtonElement | null;
  if (!themeToggle) return;

  const isLight =
    document.documentElement.getAttribute("data-theme") === "light";
  themeToggle.textContent = isLight ? "🌙" : "☀️";
}

// Cleanup
window.addEventListener("beforeunload", () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

// === MODAL ===

async function showCoinModal(coinId: string) {
  const modal = document.getElementById("coinModal");
  const modalBody = document.getElementById("modalBody");

  if (!modal || !modalBody) return;

  modal.style.display = "block";
  modalBody.innerHTML = `<p>${texts[currentLanguage].loading}</p>`;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    displayCoinData(data);
  } catch (error) {
    console.error("Error fetching coin data:", error);
    modalBody.innerHTML = `<p>${texts[currentLanguage].errorLoading}</p>`;
  }
}

function displayCoinData(coin: any) {
  const modalBody = document.getElementById("modalBody");
  if (!modalBody) return;

  const currentPrice = coin.market_data?.current_price?.usd || "N/A";
  const marketCap = coin.market_data?.market_cap?.usd || "N/A";
  const marketCapRank = coin.market_cap_rank || "N/A";
  const priceChange24h = coin.market_data?.price_change_percentage_24h || "N/A";
  const volume24h = coin.market_data?.total_volume?.usd || "N/A";
  const circulatingSupply = coin.market_data?.circulating_supply || "N/A";
  const totalSupply = coin.market_data?.total_supply || "N/A";

  modalBody.innerHTML = `
    <div class="coin-detail-header">
      <img src="${coin.image?.large || ""}" alt="${coin.name}" class="coin-detail-image" />
      <div class="coin-detail-name">${coin.symbol?.toUpperCase()} ${coin.name}</div>
    </div>
    
    <div class="coin-detail-data">
      <p><strong>${texts[currentLanguage].rank}</strong> #${marketCapRank}</p>
      <p><strong>${texts[currentLanguage].priceLabel}</strong> ${typeof currentPrice === "number" ? formatPrice(currentPrice) : currentPrice}</p>
      <p><strong>${texts[currentLanguage].marketCapLabel}</strong> ${typeof marketCap === "number" ? formatMarketCap(marketCap) : marketCap}</p>
      <p><strong>${texts[currentLanguage].volume24h}</strong> ${typeof volume24h === "number" ? formatMarketCap(volume24h) : volume24h}</p>
      <p><strong>${texts[currentLanguage].change24h}</strong> ${typeof priceChange24h === "number" ? `${priceChange24h.toFixed(2)}%` : priceChange24h}</p>
      <p><strong>${texts[currentLanguage].circulatingSupply}</strong> ${typeof circulatingSupply === "number" ? circulatingSupply.toLocaleString() : circulatingSupply}</p>
      <p><strong>${texts[currentLanguage].totalSupply}</strong> ${typeof totalSupply === "number" ? totalSupply.toLocaleString() : totalSupply}</p>
    </div>
    
    <a href="https://www.coingecko.com/en/coins/${coin.id}" target="_blank" class="coingecko-link">
      ${texts[currentLanguage].viewOnCoingecko}
    </a>
  `;
}

function setupModalEvents() {
  const modal = document.getElementById("coinModal");
  const closeBtn = document.querySelector(".close");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.style.display === "block") {
      modal.style.display = "none";
    }
  });
}
