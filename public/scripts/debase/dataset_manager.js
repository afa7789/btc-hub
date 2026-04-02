// Multi-Dataset CSV Manager - Functional Approach

const datasets = new Map();

const createDataset = (name) => ({
  name,
  dataMap: new Map(),
  dateList: [],
  headers: [],
  lastUpdated: null,
  fetchNewData: () => {
    return [];
  },
});

const isToday = (date) => {
  const today = new Date();
  const compareDate = new Date(date);
  return today.toDateString() === compareDate.toDateString();
};

const isDataCurrent = (lastUpdatedDate) => {
  if (!lastUpdatedDate) return false;
  const today = new Date();
  const dataDate = new Date(lastUpdatedDate);
  return dataDate.toDateString() === today.toDateString();
};

const shouldLookForNewInfo = (datasetName) => {
  const dataset = datasets.get(datasetName);
  return dataset ? !isDataCurrent(dataset.lastUpdated) : true;
};

const saveToStorage = async (datasetName) => {
  const dataset = datasets.get(datasetName);
  if (!dataset) {
    console.error(`✗ Dataset ${datasetName} not found`);
    return;
  }
  try {
    const storageKey = `csv_data_${datasetName}`;
    const dataToStore = {
      name: dataset.name,
      dataMap: Array.from(dataset.dataMap.entries()),
      dateList: [...dataset.dateList],
      headers: [...dataset.headers],
      lastUpdated: dataset.lastUpdated,
    };
    await window.idbSet(storageKey, dataToStore);
    console.log(`✓ Dataset ${datasetName} saved to IndexedDB`);
  } catch (error) {
    console.error(`✗ Error saving dataset ${datasetName} to IndexedDB:`, error);
  }
};

const loadFromStorage = async (datasetName) => {
  try {
    const storageKey = `csv_data_${datasetName}`;
    const parsed = await window.idbGet(storageKey);
    if (!parsed) return null;
    console.log(`✓ Dataset ${datasetName} loaded from IndexedDB`);
    return parsed;
  } catch (error) {
    console.error(
      `✗ Error loading dataset ${datasetName} from IndexedDB:`,
      error,
    );
    return null;
  }
};

const loadFromCSV = async (datasetName, csvPath, fetchFunction) => {
  try {
    const response = await fetch(csvPath);
    const csvData = await response.text();

    const dataset = createDataset(datasetName);
    const lines = csvData.trim().split("\n");

    let headers = lines[0].split(";");
    let separator = ";";
    if (headers.length === 1) {
      headers = lines[0].split(",");
      separator = ",";
    }
    dataset.headers = headers;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator);
      if (values.length !== dataset.headers.length) continue;

      const timestamp = values[0];
      const rowData = {};

      for (let j = 1; j < dataset.headers.length; j++) {
        const value = values[j];
        rowData[dataset.headers[j]] = Number.isNaN(value)
          ? value
          : Number.parseFloat(value);
      }

      dataset.dataMap.set(timestamp, rowData);
      dataset.dateList.push(timestamp);
    }

    dataset.dateList.sort();
    dataset.lastUpdated = new Date().toISOString();

    if (fetchFunction) {
      dataset.fetchNewData = fetchFunction;
    }

    datasets.set(datasetName, dataset);
    console.log(
      `✓ Dataset ${datasetName} loaded ${dataset.dateList.length} records from CSV`,
    );
  } catch (error) {
    console.error(`✗ Error loading CSV for ${datasetName}:`, error);
    throw error;
  }
};

const insertNew = (datasetName, arrayOfInformation) => {
  const dataset = datasets.get(datasetName);
  if (!dataset) {
    console.error(`✗ Dataset '${datasetName}' not found.`);
    return;
  }

  const timestamp = arrayOfInformation[0];
  const rowData = {};

  for (let i = 1; i < dataset.headers.length; i++) {
    const header = dataset.headers[i];
    const value = arrayOfInformation[i];
    rowData[header] = Number.isNaN(value) ? value : Number.parseFloat(value);
  }

  if (dataset.dataMap.has(timestamp)) {
    const existingRecord = dataset.dataMap.get(timestamp);
    Object.assign(existingRecord, rowData);
    console.log(`✓ Updated data for '${datasetName}' at ${timestamp}`);
  } else {
    dataset.dataMap.set(timestamp, rowData);

    if (
      dataset.dateList.length === 0 ||
      timestamp > dataset.dateList[dataset.dateList.length - 1]
    ) {
      dataset.dateList.push(timestamp);
    } else {
      let left = 0;
      let right = dataset.dateList.length;
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (dataset.dateList[mid] < timestamp) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }
      dataset.dateList.splice(left, 0, timestamp);
    }
    console.log(`✓ Inserted new data for '${datasetName}' at ${timestamp}`);
  }
};

const getNextDate = (datasetName, currentDate) => {
  const dataset = datasets.get(datasetName);
  if (!dataset) return null;

  const currentIndex = dataset.dateList.indexOf(currentDate);
  if (currentIndex === -1 || currentIndex === dataset.dateList.length - 1)
    return null;
  return dataset.dateList[currentIndex + 1];
};

const getPreviousDate = (datasetName, currentDate) => {
  const dataset = datasets.get(datasetName);
  if (!dataset) return null;

  const currentIndex = dataset.dateList.indexOf(currentDate);
  if (currentIndex === -1 || currentIndex === 0) return null;
  return dataset.dateList[currentIndex - 1];
};

const getData = (datasetName, timestamp) => {
  const dataset = datasets.get(datasetName);
  return dataset ? dataset.dataMap.get(timestamp) : null;
};

const getDataRange = (datasetName, startDate, endDate) => {
  const dataset = datasets.get(datasetName);
  if (!dataset) return [];

  const result = [];
  const startIndex = dataset.dateList.indexOf(startDate);
  const endIndex = dataset.dateList.indexOf(endDate);

  if (startIndex === -1 || endIndex === -1) return result;

  for (let i = startIndex; i <= endIndex; i++) {
    const date = dataset.dateList[i];
    result.push({
      timestamp: date,
      ...dataset.dataMap.get(date),
    });
  }

  return result;
};

const iterateRange = (datasetName, startDate, endDate, callback) => {
  const dataset = datasets.get(datasetName);
  if (!dataset) return;

  let currentDate = startDate;

  while (currentDate && currentDate <= endDate) {
    const data = dataset.dataMap.get(currentDate);
    callback(currentDate, data);
    currentDate = getNextDate(datasetName, currentDate);
  }
};

const lookForNewInformation = async (datasetName) => {
  const dataset = datasets.get(datasetName);
  if (!dataset || !dataset.fetchNewData) {
    console.log(`ℹ️ No update strategy defined for ${datasetName}.`);
    return;
  }

  console.log(`🔍 Looking for new information for ${datasetName}...`);
  try {
    const lastDate = getLastDate(datasetName);
    const newRows = await dataset.fetchNewData(lastDate);

    if (!newRows || newRows.length === 0) {
      console.log(`✅ No new information found for ${datasetName}.`);
      return;
    }

    console.log(`📥 Received ${newRows.length} new rows for ${datasetName}.`);

    newRows.forEach((row) => {
      if (row[0] > lastDate) {
        insertNew(datasetName, row);
      }
    });

    dataset.lastUpdated = new Date().toISOString();
    saveToStorage(datasetName);

    console.log(`💾 Dataset ${datasetName} updated and saved.`);
  } catch (error) {
    console.error(
      `✗ Error fetching new information for ${datasetName}:`,
      error,
    );
  }
};

const initDataset = async (datasetName, csvPath, fetchFunction) => {
  console.log(`🚀 Initializing dataset ${datasetName}...`);
  const stored = await loadFromStorage(datasetName);
  if (stored && isDataCurrent(stored.lastUpdated)) {
    console.log(`📦 Loading ${datasetName} from storage...`);
    const dataset = createDataset(datasetName);
    dataset.dataMap = new Map(stored.dataMap);
    dataset.dateList = stored.dateList;
    dataset.headers = stored.headers;
    dataset.lastUpdated = stored.lastUpdated;
    dataset.fetchNewData =
      fetchFunction ||
      (() => {
        return [];
      });
    datasets.set(datasetName, dataset);
  } else {
    console.log(`🌐 Fetching fresh data for ${datasetName}...`);
    await loadFromCSV(datasetName, csvPath, fetchFunction);
    await saveToStorage(datasetName);
  }
  if (shouldLookForNewInfo(datasetName)) {
    console.log(
      `📅 Dataset ${datasetName} is outdated, checking for updates...`,
    );
    lookForNewInformation(datasetName);
  }
  const dataset = datasets.get(datasetName);
  console.log(
    `✅ ${datasetName} initialized with ${dataset.dateList.length} records`,
  );
};

const initAllDatasets = async (datasetConfigs) => {
  console.log(`🚀 Initializing ${datasetConfigs.length} datasets...`);
  for (const config of datasetConfigs) {
    await initDataset(config.name, config.csvPath, config.fetchFunction);
  }
  console.log("✅ All datasets initialized");
  console.log(`📊 Loaded datasets: ${Array.from(datasets.keys()).join(", ")}`);
};

const getFirstDate = (datasetName) => {
  const dataset = datasets.get(datasetName);
  return dataset ? dataset.dateList[0] : null;
};

const getLastDate = (datasetName) => {
  const dataset = datasets.get(datasetName);
  return dataset ? dataset.dateList[dataset.dateList.length - 1] : null;
};

const getTotalRecords = (datasetName) => {
  const dataset = datasets.get(datasetName);
  return dataset ? dataset.dateList.length : 0;
};

const getHeaders = (datasetName) => {
  const dataset = datasets.get(datasetName);
  return dataset ? [...dataset.headers] : [];
};

const getLastUpdated = (datasetName) => {
  const dataset = datasets.get(datasetName);
  return dataset ? dataset.lastUpdated : null;
};

const getDatasetNames = () => Array.from(datasets.keys());

const getDatasetInfo = (datasetName) => {
  const dataset = datasets.get(datasetName);
  if (!dataset) return null;

  return {
    name: dataset.name,
    totalRecords: dataset.dateList.length,
    firstDate: dataset.dateList[0],
    lastDate: dataset.dateList[dataset.dateList.length - 1],
    headers: [...dataset.headers],
    lastUpdated: dataset.lastUpdated,
  };
};

const getAllDatasetsInfo = () => {
  const info = {};
  datasets.forEach((dataset, name) => {
    info[name] = getDatasetInfo(name);
  });
  return info;
};

const csvManager = {
  initDataset,
  initAllDatasets,
  insertNew,
  getData,
  getDataRange,
  iterateRange,
  getNextDate,
  getPreviousDate,
  getFirstDate,
  getLastDate,
  getTotalRecords,
  getHeaders,
  getLastUpdated,
  getDatasetNames,
  getDatasetInfo,
  getAllDatasetsInfo,
  lookForNewInformation,
  saveToStorage,
  loadFromStorage,
};
