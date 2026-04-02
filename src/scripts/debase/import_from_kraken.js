/**
 * Main function to fetch OHLC data from Kraken's public API.
 */
async function fetchKrakenData(pair, lastDate) {
  const sinceDate = new Date(lastDate);
  sinceDate.setDate(sinceDate.getDate() + 1);
  const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);

  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440&since=${sinceTimestamp}`;

  console.log(
    `🔍 Fetching data for ${pair} since ${sinceDate.toISOString().split("T")[0]}...`,
  );

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Network error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(", ")}`);
    }

    const resultPair = Object.keys(data.result)[0];
    const ohlcData = data.result[resultPair];

    if (!ohlcData) {
      console.log(`✅ No new information found for ${pair}.`);
      return [];
    }

    const newRows = ohlcData.map((row) => {
      const [timestamp, open, high, low, close, vwap, volume, count] = row;
      const date = new Date(timestamp * 1000).toISOString().split("T")[0];

      return [
        date,
        Number.parseFloat(open),
        Number.parseFloat(high),
        Number.parseFloat(low),
        Number.parseFloat(close),
        Number.parseFloat(volume),
      ];
    });

    console.log(`📥 Received ${newRows.length} new rows for ${pair}.`);
    return newRows;
  } catch (error) {
    console.error(`✗ Error fetching data for ${pair}:`, error);
    return [];
  }
}

// Gold (Tether Gold - XAUT)
const fetchGoldData = (lastDate) => fetchKrakenData("XAUTUSD", lastDate);

// Bitcoin (BTC) - Kraken uses XBT
const fetchBtcData = (lastDate) => fetchKrakenData("XBTUSD", lastDate);

// Ethereum (ETH)
const fetchEthData = (lastDate) => fetchKrakenData("ETHUSD", lastDate);

// Monero (XMR)
const fetchXmrData = (lastDate) => fetchKrakenData("XMRUSD", lastDate);
