// Asset configuration
const ASSETS = {
  bitcoin: {
    file: "/datasets/bitcoin_2010-07-17_2025-07-25.csv",
    format: "crypto", // Start,End,Open,High,Low,Close
    symbol: "BTC",
    decimals: 8,
  },
  ethereum: {
    file: "/datasets/ethereum_2015-08-07_2025-07-25.csv",
    format: "crypto",
    symbol: "ETH",
    decimals: 6,
  },
  monero: {
    file: "/datasets/monero_2014-05-21_2025-07-25.csv",
    format: "crypto",
    symbol: "XMR",
    decimals: 6,
  },
  gold: {
    file: "/datasets/gold.csv",
    format: "commodity", // Price,Close,High,Low,Open,Volume
    symbol: "oz",
    decimals: 4,
  },
  silver: {
    file: "/datasets/silver.csv",
    format: "commodity",
    symbol: "oz",
    decimals: 4,
  },
};

// Loaded price data per asset
const priceData = {};

async function loadAssetData(assetKey) {
  if (priceData[assetKey]) return priceData[assetKey];

  const asset = ASSETS[assetKey];
  const prices = {};

  try {
    const response = await fetch(asset.file);
    const text = await response.text();
    const lines = text.split("\n");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(",");

      let date, close;
      if (asset.format === "crypto") {
        date = values[1]; // End column
        close = Number.parseFloat(values[5]); // Close column
      } else {
        date = values[0]; // Price (date) column
        close = Number.parseFloat(values[1]); // Close column
      }

      if (!Number.isNaN(close) && date) {
        prices[date] = close;
      }
    }

    console.log(
      `${assetKey} prices loaded: ${Object.keys(prices).length} records`,
    );
  } catch (error) {
    console.error(`Error loading ${assetKey} data:`, error);
  }

  priceData[assetKey] = prices;
  return prices;
}

function getClosestPrice(prices, date) {
  if (prices[date]) return prices[date];

  const targetDate = new Date(date);
  let closestDate = null;
  let closestDiff = Number.POSITIVE_INFINITY;

  for (const priceDate in prices) {
    const diff = Math.abs(targetDate - new Date(priceDate));
    if (diff < closestDiff) {
      closestDiff = diff;
      closestDate = priceDate;
    }
  }

  return closestDate ? prices[closestDate] : null;
}

async function calculateDCA() {
  const assetKey = document.getElementById("asset").value;
  const asset = ASSETS[assetKey];
  const amount = Number.parseFloat(document.getElementById("amount").value);
  const frequency = document.getElementById("frequency").value;
  const startDate = new Date(document.getElementById("start-date").value);
  const endDate = new Date(document.getElementById("end-date").value);

  if (!amount || amount <= 0) {
    alert("Please enter a valid amount to invest.");
    return;
  }

  if (startDate >= endDate) {
    alert("Start date must be before end date.");
    return;
  }

  const prices = await loadAssetData(assetKey);
  if (!prices || Object.keys(prices).length === 0) {
    alert("Failed to load price data for this asset.");
    return;
  }

  const transactions = [];
  let totalInvested = 0;
  let totalUnits = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const price = getClosestPrice(prices, dateStr);
    if (price === null) {
      // Skip dates before asset existed
      advanceDate(currentDate, frequency);
      continue;
    }

    const unitsBought = amount / price;
    totalInvested += amount;
    totalUnits += unitsBought;

    transactions.push({
      date: dateStr,
      amount: amount,
      price: price,
      btcBought: unitsBought,
      totalBtc: totalUnits,
      totalInvested: totalInvested,
    });

    advanceDate(currentDate, frequency);
  }

  if (transactions.length === 0) {
    alert("No valid price data found for the selected date range.");
    return;
  }

  const currentPrice = getClosestPrice(
    prices,
    endDate.toISOString().split("T")[0],
  );
  const currentValue = totalUnits * currentPrice;
  const profitLoss = currentValue - totalInvested;
  const profitLossPercentage =
    ((currentValue - totalInvested) / totalInvested) * 100;
  const averagePrice = totalInvested / totalUnits;

  // Display results
  document.getElementById("total-invested").textContent =
    `$${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("bitcoin-acquired").textContent =
    `${totalUnits.toFixed(asset.decimals)} ${asset.symbol}`;
  document.getElementById("current-value").textContent =
    `$${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const profitLossElement = document.getElementById("profit-loss");
  const profitLossText = `$${profitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${profitLoss >= 0 ? "+" : ""}${profitLossPercentage.toFixed(1)}%)`;
  profitLossElement.textContent = profitLossText;
  profitLossElement.className =
    profitLoss >= 0 ? "profit-positive" : "profit-negative";

  document.getElementById("average-price").textContent =
    `$${averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("purchase-count").textContent =
    transactions.length.toLocaleString();

  document.getElementById("results").style.display = "block";

  drawChart(transactions);

  // Display transactions table
  const tbody = document.getElementById("transactions-tbody");
  tbody.innerHTML = "";

  let transactionsToShow = transactions;
  if (transactions.length > 50) {
    transactionsToShow = [];
    const step = (transactions.length - 1) / 49;
    for (let i = 0; i < 50; i++) {
      transactionsToShow.push(transactions[Math.round(i * step)]);
    }
  }

  transactionsToShow.forEach((tx) => {
    const row = tbody.insertRow();
    row.insertCell(0).textContent = tx.date;
    row.insertCell(1).textContent = `$${tx.amount.toFixed(2)}`;
    row.insertCell(2).textContent =
      `$${tx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    row.insertCell(3).textContent = tx.btcBought.toFixed(asset.decimals);
    row.insertCell(4).textContent = tx.totalBtc.toFixed(asset.decimals);
  });

  if (transactions.length > 50) {
    const noteRow = tbody.insertRow(0);
    const noteCell = noteRow.insertCell(0);
    noteCell.colSpan = 5;
    noteCell.style.textAlign = "center";
    noteCell.style.fontStyle = "italic";
    noteCell.textContent = `Showing 50 evenly spaced transactions from ${transactions.length} total`;
  }

  document.getElementById("transactions").style.display = "block";

  // Save to localStorage
  const inputData = {
    asset: assetKey,
    amount: amount,
    frequency: frequency,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };

  const results = {
    totalInvested: document.getElementById("total-invested").textContent,
    bitcoinAcquired: document.getElementById("bitcoin-acquired").textContent,
    currentValue: document.getElementById("current-value").textContent,
    profitLoss: profitLossText,
    profitLossClass: profitLoss >= 0 ? "profit-positive" : "profit-negative",
    averagePrice: document.getElementById("average-price").textContent,
    purchaseCount: transactions.length.toLocaleString(),
    transactionsTableHTML: tbody.innerHTML,
  };

  saveCalculation(inputData, results, transactions);
}

function advanceDate(date, frequency) {
  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
  }
}

function saveCalculation(inputData, results, transactions) {
  try {
    localStorage.setItem(
      "lastDCACalculation",
      JSON.stringify({
        timestamp: new Date().toISOString(),
        inputs: inputData,
        results: results,
        transactions: transactions,
      }),
    );
  } catch (error) {
    console.error("Error saving calculation:", error);
  }
}

function loadLastCalculation() {
  try {
    const savedData = localStorage.getItem("lastDCACalculation");
    if (!savedData) return;

    const calculationData = JSON.parse(savedData);

    // Restore input values
    if (calculationData.inputs.asset) {
      document.getElementById("asset").value = calculationData.inputs.asset;
    }
    document.getElementById("amount").value = calculationData.inputs.amount;
    document.getElementById("frequency").value =
      calculationData.inputs.frequency;
    document.getElementById("start-date").value =
      calculationData.inputs.startDate;
    document.getElementById("end-date").value = calculationData.inputs.endDate;

    // Restore results
    document.getElementById("total-invested").textContent =
      calculationData.results.totalInvested;
    document.getElementById("bitcoin-acquired").textContent =
      calculationData.results.bitcoinAcquired;
    document.getElementById("current-value").textContent =
      calculationData.results.currentValue;

    const profitLossElement = document.getElementById("profit-loss");
    profitLossElement.textContent = calculationData.results.profitLoss;
    profitLossElement.className = calculationData.results.profitLossClass;

    document.getElementById("average-price").textContent =
      calculationData.results.averagePrice;
    document.getElementById("purchase-count").textContent =
      calculationData.results.purchaseCount;

    document.getElementById("results").style.display = "block";

    const tbody = document.getElementById("transactions-tbody");
    tbody.innerHTML = calculationData.results.transactionsTableHTML;
    document.getElementById("transactions").style.display = "block";

    drawChart(calculationData.transactions);
  } catch (error) {
    console.error("Error loading last calculation:", error);
    localStorage.removeItem("lastDCACalculation");
  }
}

function drawChart(transactions) {
  const svg = document.getElementById("dca-chart");
  const existingPaths = svg.querySelectorAll(
    ".chart-line, .chart-dot, .chart-label",
  );
  existingPaths.forEach((el) => el.remove());

  if (transactions.length === 0) return;

  const isLightTheme =
    document.documentElement.getAttribute("data-theme") === "light";
  const textColor = isLightTheme ? "black" : "white";
  const lineColor = isLightTheme ? "black" : "white";

  const frequency = document.getElementById("frequency").value;
  const sampledTransactions = sampleTransactionsByFrequency(
    transactions,
    frequency,
  );

  const investedData = [];
  const valueData = [];

  sampledTransactions.forEach((tx, index) => {
    investedData.push({ x: index, y: tx.totalInvested });
    valueData.push({ x: index, y: tx.totalBtc * tx.price });
  });

  const maxInvested = Math.max(...investedData.map((d) => d.y));
  const maxValue = Math.max(...valueData.map((d) => d.y));
  const maxY = Math.max(maxInvested, maxValue);

  const chartWidth = 700;
  const chartHeight = 200;
  const chartX = 50;
  const chartY = 50;

  const scaleX = (index) =>
    chartX + (index / Math.max(sampledTransactions.length - 1, 1)) * chartWidth;
  const scaleY = (value) => chartY + chartHeight - (value / maxY) * chartHeight;

  let investedPoints = "";
  investedData.forEach((point, index) => {
    if (index > 0) investedPoints += " ";
    investedPoints += `${scaleX(point.x)},${scaleY(point.y)}`;
  });

  let valuePoints = "";
  valueData.forEach((point, index) => {
    if (index > 0) valuePoints += " ";
    valuePoints += `${scaleX(point.x)},${scaleY(point.y)}`;
  });

  const investedLine = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  investedLine.setAttribute("points", investedPoints);
  investedLine.setAttribute("stroke", lineColor);
  investedLine.setAttribute("stroke-width", "2");
  investedLine.setAttribute("stroke-dasharray", "5,5");
  investedLine.setAttribute("fill", "none");
  investedLine.setAttribute("class", "chart-line");
  svg.appendChild(investedLine);

  const valueLine = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  valueLine.setAttribute("points", valuePoints);
  valueLine.setAttribute("stroke", lineColor);
  valueLine.setAttribute("stroke-width", "3");
  valueLine.setAttribute("fill", "none");
  valueLine.setAttribute("class", "chart-line");
  svg.appendChild(valueLine);

  const formatVal = (v) =>
    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`;

  const legendInvested = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text",
  );
  legendInvested.setAttribute("x", "280");
  legendInvested.setAttribute("y", "30");
  legendInvested.setAttribute("font-family", "monospace");
  legendInvested.setAttribute("font-size", "12");
  legendInvested.setAttribute("fill", textColor);
  legendInvested.setAttribute("class", "chart-label");
  legendInvested.textContent = `--- Total Invested (${formatVal(maxInvested)})`;
  svg.appendChild(legendInvested);

  const legendValue = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text",
  );
  legendValue.setAttribute("x", "280");
  legendValue.setAttribute("y", "50");
  legendValue.setAttribute("font-family", "monospace");
  legendValue.setAttribute("font-size", "12");
  legendValue.setAttribute("fill", textColor);
  legendValue.setAttribute("class", "chart-label");
  legendValue.textContent = `— Portfolio Value (${formatVal(maxValue)})`;
  svg.appendChild(legendValue);

  const topLabel = svg.querySelector('text[x="10"][y="60"]');
  if (topLabel) {
    topLabel.textContent = formatVal(maxY);
    topLabel.setAttribute("fill", textColor);
  }

  const midLabel = svg.querySelector('text[x="10"][y="150"]');
  if (midLabel) {
    midLabel.textContent = formatVal(maxY / 2);
    midLabel.setAttribute("fill", textColor);
  }

  // O nome acessivel tem de acompanhar o recalculo: se ficasse com o texto
  // prerenderizado em dca.astro, o leitor de tela leria numeros de outro
  // cenario. Mesma frase, valores do calculo atual.
  svg.setAttribute(
    "aria-label",
    `DCA progress: line chart from ${transactions[0].date} to ${transactions[transactions.length - 1].date}. ` +
      `The dashed line is the total invested, reaching ${formatVal(maxInvested)}; ` +
      `the solid line is the portfolio value, peaking at ${formatVal(maxValue)}. ` +
      "The same data is listed row by row in the transactions table below.",
  );

  const chartElements = svg.querySelectorAll("text, line");
  chartElements.forEach((element) => {
    if (
      element.tagName === "text" &&
      !element.classList.contains("chart-label")
    ) {
      element.setAttribute("fill", textColor);
    } else if (element.tagName === "line") {
      element.setAttribute("stroke", lineColor);
    }
  });

  svg.style.display = "block";
}

function sampleTransactionsByFrequency(transactions, frequency) {
  const totalTransactions = transactions.length;
  const startDate = new Date(transactions[0].date);
  const endDate = new Date(transactions[transactions.length - 1].date);
  const yearsDiff = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);

  const expectedPointsPerYear = { daily: 365, weekly: 52, monthly: 12 };
  const expectedTotalPoints = Math.round(
    yearsDiff * expectedPointsPerYear[frequency],
  );

  if (totalTransactions <= expectedTotalPoints * 1.2) return transactions;

  const samplingRatio = totalTransactions / expectedTotalPoints;
  const sampled = [transactions[0]];

  for (let i = 1; i < totalTransactions - 1; i++) {
    if (i % Math.round(samplingRatio) === 0) sampled.push(transactions[i]);
  }

  if (sampled[sampled.length - 1] !== transactions[totalTransactions - 1]) {
    sampled.push(transactions[totalTransactions - 1]);
  }

  return sampled;
}

function clearCalculation() {
  // The default scenario is prerendered into the HTML at build time, so the
  // cheapest way back to a clean slate is to drop the saved run and reload.
  localStorage.removeItem("lastDCACalculation");
  window.location.reload();
}

/*
 * O ClientRouter troca o <body> sem recarregar o documento, e um script ja
 * executado nao roda de novo. DOMContentLoaded so dispara na primeira carga,
 * entao a inicializacao passa a pendurar em astro:page-load, que dispara na
 * primeira carga e depois de cada navegacao. Os nos sao novos a cada troca, o
 * que faz o rebind ser obrigatorio e, ao mesmo tempo, impossivel de duplicar.
 */
async function initDcaPage() {
  // #calculate-btn tambem existe em /how-much-i-fucked-up, entao o guard usa um
  // id exclusivo desta pagina.
  if (!document.getElementById("dca-chart")) return; // outra pagina
  const calculateBtn = document.getElementById("calculate-btn");

  // Preload bitcoin data
  await loadAssetData("bitcoin");

  calculateBtn.addEventListener("click", calculateDCA);
  document
    .getElementById("clear-btn")
    .addEventListener("click", clearCalculation);
  initializeDateInputs();
  loadLastCalculation();
}

document.addEventListener("astro:page-load", initDcaPage);

function initializeDateInputs() {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    input.addEventListener("click", function () {
      try {
        this.showPicker?.();
      } catch (err) {
        this.focus();
      }
    });
  });
}

document.addEventListener("themechange", () => {
  // O listener e global e sobrevive a navegacao; drawChart precisa do svg.
  if (!document.getElementById("dca-chart")) return;
  const savedData = localStorage.getItem("lastDCACalculation");
  if (savedData) {
    try {
      const data = JSON.parse(savedData);
      if (data.transactions?.length > 0) drawChart(data.transactions);
    } catch (error) {}
  }
});
