// IndexedDB/Cache wrapper utilities for DEBASE

declare const idb: any;

const STORAGE_KEY_PREFIX = "csv_data_";

/**
 * Get data from IndexedDB with localStorage fallback
 */
export async function cacheGet(key: string): Promise<any> {
  try {
    if (typeof idb === "undefined") {
      throw new Error("idb library not loaded");
    }

    const db = await idb.openDB("csvDataStore", 1, {
      upgrade(db) {
        db.createObjectStore("datasets");
      },
    });
    const result = await db.get("datasets", key);
    if (result !== undefined) return result;
  } catch (e) {
    console.warn("IndexedDB unavailable, falling back to localStorage:", e);
  }

  // Fallback to localStorage
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

/**
 * Set data in IndexedDB with localStorage fallback
 */
export async function cacheSet(key: string, value: any): Promise<void> {
  try {
    if (typeof idb === "undefined") {
      throw new Error("idb library not loaded");
    }

    const db = await idb.openDB("csvDataStore", 1, {
      upgrade(db) {
        db.createObjectStore("datasets");
      },
    });
    await db.put("datasets", value, key);
    return;
  } catch (e) {
    console.warn("IndexedDB unavailable, falling back to localStorage:", e);
  }

  // Fallback to localStorage
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Both IndexedDB and localStorage failed:", err);
  }
}

/**
 * Generate storage key for a dataset
 */
export function getStorageKey(datasetName: string): string {
  return `${STORAGE_KEY_PREFIX}${datasetName}`;
}

/**
 * Check if data is current (updated today)
 */
export function isDataCurrent(lastUpdatedDate: string | null): boolean {
  if (!lastUpdatedDate) return false;
  const today = new Date();
  const dataDate = new Date(lastUpdatedDate);
  return dataDate.toDateString() === today.toDateString();
}
