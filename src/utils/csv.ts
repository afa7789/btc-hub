// CSV parsing utilities for DEBASE

export interface CSVRow {
  timestamp: string;
  [key: string]: string | number;
}

export interface CSVDataset {
  name: string;
  dataMap: Map<string, Record<string, string | number>>;
  dateList: string[];
  headers: string[];
  lastUpdated: string | null;
}

/**
 * Parse CSV text into a dataset structure
 */
export function parseCSV(csvText: string): {
  headers: string[];
  rows: CSVRow[];
} {
  const lines = csvText.trim().split("\n");
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Detect separator
  let headers = lines[0].split(";");
  let separator = ";";
  if (headers.length === 1) {
    headers = lines[0].split(",");
    separator = ",";
  }

  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator);
    if (values.length !== headers.length) continue;

    const row: CSVRow = { timestamp: values[0] };
    for (let j = 1; j < headers.length; j++) {
      const value = values[j];
      row[headers[j]] = Number.isNaN(Number(value))
        ? value
        : Number.parseFloat(value);
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Create a dataset from parsed CSV data
 */
export function createDataset(
  name: string,
  headers: string[],
  rows: CSVRow[],
): CSVDataset {
  const dataMap = new Map<string, Record<string, string | number>>();
  const dateList: string[] = [];

  for (const row of rows) {
    const { timestamp, ...data } = row;
    dataMap.set(timestamp, data);
    dateList.push(timestamp);
  }

  dateList.sort();

  return {
    name,
    dataMap,
    dateList,
    headers,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Fetch and parse a CSV file
 */
export async function fetchAndParseCSV(
  name: string,
  csvPath: string,
): Promise<CSVDataset> {
  const response = await fetch(csvPath);
  const csvText = await response.text();
  const { headers, rows } = parseCSV(csvText);
  return createDataset(name, headers, rows);
}
